import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowUp, Mic } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { decomposeWork, interviewTurn } from "@/lib/server/grok";
import { useWorks } from "@/lib/wataseru/store";
import { emptyWork, USAGE_LABEL, type Usage } from "@/lib/wataseru/types";
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
  const appendMessage = useWorks((s) => s.appendMessage);
  const applyWork = useWorks((s) => s.applyWork);
  const setUsage = useWorks((s) => s.setUsage);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"idle" | "ask" | "write">("idle");
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recog | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoAsked = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [record?.messages.length, busy]);

  const history = useMemo(
    () =>
      (record?.messages ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    [record?.messages],
  );

  useEffect(() => {
    if (!hydrated || !record || autoAsked.current) return;
    const last = record.messages[record.messages.length - 1];
    if (last?.role !== "user") return;
    autoAsked.current = true;
    void askFromHistory(
      record.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, record?.id, record?.messages.length]);

  async function askFromHistory(hist: { role: "user" | "assistant"; content: string }[]) {
    if (!record) return;
    setBusy("ask");
    setError(null);
    const res = await interviewTurn({
      data: {
        usageLabel: USAGE_LABEL[record.usage],
        nameField: record.work.name_field,
        history: hist,
      },
    });
    if (!res.ok) {
      setBusy("idle");
      setError(res.error);
      appendMessage(record.id, {
        role: "assistant",
        content: "一番ふつうの1件を、最初の操作から話してください。",
      });
      return;
    }
    const q = res.data.questions.length
      ? "\n\n" + res.data.questions.map((x) => "・" + x).join("\n")
      : "";
    const split = res.data.split_proposal?.length
      ? "\n\n今回は次の1つに切ります。\n" + res.data.split_proposal.map((x) => "・" + x).join("\n")
      : "";
    appendMessage(record.id, { role: "assistant", content: `${res.data.say}${q}${split}` });
    if (res.data.phase === "enough") {
      await generate(hist);
      return;
    }
    setBusy("idle");
  }

  async function send(text: string) {
    if (!record || !text.trim() || busy !== "idle") return;
    const content = text.trim();
    setDraft("");
    appendMessage(record.id, { role: "user", content });
    await askFromHistory([...history, { role: "user", content }]);
  }

  async function generate(hist = history) {
    if (!record) return;
    setBusy("write");
    setError(null);
    const transcript = hist
      .map((m) => `${m.role === "user" ? "社長" : "ワタセル"}: ${m.content}`)
      .join("\n\n");
    const res = await decomposeWork({
      data: {
        usageLabel: USAGE_LABEL[record.usage],
        nameField: record.work.name_field,
        transcript,
      },
    });
    setBusy("idle");
    if (!res.ok) {
      setError(res.error);
      appendMessage(record.id, {
        role: "assistant",
        content: "下書きに進めませんでした。もう一度「出す」を押すか、足りない点を足してください。",
      });
      return;
    }
    applyWork(record.id, emptyWork({ ...res.data, work_id: record.id }), transcript);
    void navigate({ to: "/works/$workId", params: { workId: record.id } });
  }

  function toggleMic() {
    const SR = getSpeechCtor();
    if (!SR) {
      setError("音声入力に未対応です。書いてください。");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
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
    setListening(true);
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
            onChange={(e) => setUsage(record.id, e.target.value as Usage)}
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
            <Button
              type="submit"
              size="icon"
              disabled={busy !== "idle"}
              aria-label="送る"
            >
              <ArrowUp className="size-4" strokeWidth={2} />
            </Button>
          ) : null}
        </div>
      </form>
    </AppShell>
  );
}
