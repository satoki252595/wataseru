import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowUp, Mic, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { api, isApiError } from "@/lib/api";
import { useWorks } from "@/lib/wataseru/store";
import { USAGE_LABEL, type Usage } from "@/lib/wataseru/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/interview/$workId")({
  component: InterviewPage,
});

const USAGES = Object.keys(USAGE_LABEL) as Usage[];

type Recog = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getSpeechCtor(): (new () => Recog) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recog;
    webkitSpeechRecognition?: new () => Recog;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

function InterviewPage() {
  const { workId } = Route.useParams();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const record = useWorks((s) => s.works.find((w) => w.id === workId));
  const sendMessage = useWorks((s) => s.sendMessage);
  const generateApi = useWorks((s) => s.generate);
  const setUsage = useWorks((s) => s.setUsage);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"idle" | "ask" | "write">("idle");
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recog | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoAsked = useRef(false);
  const draftRef = useRef("");

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const raw = sessionStorage.getItem(`wataseru-draft-${workId}`);
    if (raw) setDraft(raw);
  }, [workId]);

  useEffect(() => {
    sessionStorage.setItem(`wataseru-draft-${workId}`, draft);
  }, [draft, workId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [record?.messages.length, busy]);

  const historyLen = record?.messages.length ?? 0;

  useEffect(() => {
    if (!hydrated || !record || autoAsked.current) return;
    const last = record.messages[record.messages.length - 1];
    if (last?.role !== "user") return;
    autoAsked.current = true;
    void ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, record?.id, historyLen]);

  async function ask(content?: string) {
    if (!record) return;
    setBusy("ask");
    setError(null);
    try {
      const res = await sendMessage(record.id, content);
      if (res.interview?.phase === "enough") {
        await generate();
        return;
      }
    } catch (e) {
      setError(isApiError(e) ? e.error : "書いてください");
    }
    setBusy("idle");
  }

  async function send(text: string) {
    if (!record || !text.trim() || busy !== "idle") return;
    const content = text.trim();
    setDraft("");
    sessionStorage.removeItem(`wataseru-draft-${workId}`);
    await ask(content);
  }

  async function generate() {
    if (!record) return;
    setBusy("write");
    setError(null);
    try {
      const res = await generateApi(record.id);
      setBusy("idle");
      if (res.error) {
        setError(res.error);
        return;
      }
      void navigate({ to: "/works/$workId", params: { workId: record.id } });
    } catch (e) {
      setBusy("idle");
      setError(isApiError(e) ? e.error : "書いてください");
    }
  }

  async function uploadRecording(blob: Blob) {
    try {
      const form = new FormData();
      form.set("file", blob, "interview.webm");
      const data = await api<{ text: string }>("/api/transcribe", { method: "POST", body: form });
      if (data.text) setDraft((prev) => (prev.trim() ? `${prev.trim()}\n${data.text}` : data.text));
    } catch {
      if (!draftRef.current.trim()) setError("書いてください。");
    }
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
      setListening(false);
      return;
    }

    const SR = getSpeechCtor();
    if (SR) {
      const rec = new SR();
      rec.lang = "ja-JP";
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (ev) => {
        let text = "";
        for (let i = 0; i < ev.results.length; i += 1) text += ev.results[i][0].transcript;
        setDraft(text);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      rec.start();
    }

    if (navigator.mediaDevices?.getUserMedia) {
      void navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          chunksRef.current = [];
          const mr = new MediaRecorder(stream);
          mediaRef.current = mr;
          mr.ondataavailable = (ev) => {
            if (ev.data.size) chunksRef.current.push(ev.data);
          };
          mr.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
            if (blob.size > 800) void uploadRecording(blob);
          };
          mr.start();
        })
        .catch(() => {
          if (!SR) setError("音声入力に未対応です。書いてください。");
        });
    } else if (!SR) {
      setError("音声入力に未対応です。書いてください。");
      return;
    }

    setListening(true);
  }

  async function onFile(file: File) {
    if (!record) return;
    const form = new FormData();
    form.set("file", file);
    form.set("workId", record.id);
    try {
      const data = await api<{ file: { name: string; extractedText: string } }>("/api/files", {
        method: "POST",
        body: form,
      });
      const extra = data.file.extractedText ? `\n\n${data.file.extractedText.slice(0, 8000)}` : "";
      await send(`ファイルを置きました：${data.file.name}${extra}`);
    } catch (e) {
      setError(isApiError(e) ? e.error : "ファイルを置けませんでした");
    }
  }

  const title =
    !record || record.work.name_field === "[要確認]" ? "取材" : record.work.name_field;

  if (!hydrated) {
    return (
      <AppShell chat title="取材">
        <p className="px-5 py-8 text-sm text-muted">読み込み中…</p>
      </AppShell>
    );
  }

  if (!record) {
    return (
      <AppShell chat title="取材">
        <p className="px-5 py-8">見つかりません。</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      chat
      title={title}
      trailing={
        <button
          type="button"
          disabled={busy !== "idle"}
          onClick={() => void generate()}
          className="min-h-11 px-3 text-sm text-muted hover:text-fg disabled:opacity-40"
        >
          出す
        </button>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto max-w-xl">
          <label className="sr-only" htmlFor="usage">
            使い道
          </label>
          <select
            id="usage"
            value={record.usage}
            onChange={(e) => void setUsage(record.id, e.target.value as Usage)}
            className="mb-5 bg-transparent text-sm text-muted outline-none"
          >
            {USAGES.map((u) => (
              <option key={u} value={u}>
                {USAGE_LABEL[u]}
              </option>
            ))}
          </select>

          <div className="space-y-3">
            {record.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "assistant"
                    ? "rounded-md rounded-bl-sm bg-bg-elevated text-fg"
                    : "ml-auto rounded-md rounded-br-sm bg-primary text-primary-fg",
                )}
              >
                {m.content}
              </div>
            ))}
            {busy !== "idle" && (
              <p className="text-sm text-muted">
                {busy === "write" ? "書いています…" : "聞いています…"}
              </p>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      <form
        className="border-t border-border/60 bg-bg px-3 pt-1 pb-safe"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <div className="mx-auto flex max-w-xl items-end gap-1">
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? "止める" : "話す"}
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-md",
              listening ? "text-danger" : "text-fg",
            )}
          >
            <Mic className="size-5" strokeWidth={1.5} />
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.xlsx,.xls,.txt,.csv,image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onFile(f);
            }}
          />
          <button
            type="button"
            aria-label="ファイルを置く"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-fg"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-5" strokeWidth={1.5} />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            placeholder={listening ? "聞いています" : "一番ふつうの1件から"}
            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(draft);
              }
            }}
          />
          {draft.trim() ? (
            <Button type="submit" size="icon" disabled={busy !== "idle"} aria-label="送る">
              <ArrowUp className="size-4" strokeWidth={2} />
            </Button>
          ) : null}
        </div>
      </form>
    </AppShell>
  );
}

