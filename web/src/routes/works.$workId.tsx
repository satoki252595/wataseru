import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MarkdownView } from "@/components/markdown-view";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { isApiError } from "@/lib/api";
import { useWorks } from "@/lib/wataseru/store";
import {
  REQUIRED_ARTIFACTS,
  USAGE_LABEL,
  extractTaggedLines,
  type ArtifactKey,
} from "@/lib/wataseru/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/works/$workId")({
  component: WorkDetail,
});

const ALL_TABS: ArtifactKey[] = [
  "card",
  "sop",
  "checklist",
  "order",
  "routing",
  "quality",
  "hiring",
  "ai",
  "log",
];

const SHORT: Record<ArtifactKey, string> = {
  card: "カード",
  sop: "SOP",
  checklist: "リスト",
  order: "発注",
  routing: "仕分け",
  quality: "品質",
  hiring: "求人",
  ai: "AI",
  log: "ログ",
};

function WorkDetail() {
  const { workId } = Route.useParams();
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const record = useWorks((s) => s.works.find((w) => w.id === workId));
  const fillApi = useWorks((s) => s.fill);
  const remove = useWorks((s) => s.remove);
  const share = useWorks((s) => s.share);
  const spawnNext = useWorks((s) => s.spawnNext);
  const required = record ? REQUIRED_ARTIFACTS[record.usage] : [];
  const [tab, setTab] = useState<ArtifactKey>("card");
  const [fill, setFill] = useState(false);
  const [answers, setAnswers] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const holes = useMemo(() => {
    if (!record) return [];
    return extractTaggedLines(Object.values(record.artifacts).join("\n"), "[要確認]").slice(0, 8);
  }, [record]);

  const tabs = useMemo(() => {
    const base = ALL_TABS.filter((k) => k === "card" || k === "sop" || required.includes(k));
    if (more) return ALL_TABS;
    return base;
  }, [required, more]);

  async function submitFill() {
    if (!record || !answers.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fillApi(record.id, answers.trim());
      setBusy(false);
      if (res.error) {
        setErr(res.error);
        return;
      }
      setAnswers("");
      setFill(false);
    } catch (e) {
      setBusy(false);
      setErr(isApiError(e) ? e.error : "反映できませんでした");
    }
  }

  function downloadMd() {
    if (!record) return;
    const body = ALL_TABS.map((k) => record.artifacts[k] && record.artifacts[k])
      .filter(Boolean)
      .join("\n\n---\n\n");
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.work.name_field || "work"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function makeShare() {
    if (!record) return;
    const data = await share(record.id, "view");
    setShareUrl(data.url);
    try {
      await navigator.clipboard.writeText(data.url);
    } catch {
      /* ignore */
    }
  }

  async function goNext() {
    if (!record) return;
    const next = await spawnNext(record.id);
    void navigate({ to: "/interview/$workId", params: { workId: next.id } });
  }

  if (!hydrated) {
    return (
      <AppShell>
        <p className="text-sm text-muted">読み込み中…</p>
      </AppShell>
    );
  }
  if (!record) {
    return (
      <AppShell>
        <p>見つかりません。</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <p className="text-sm text-muted">{USAGE_LABEL[record.usage]}</p>
      <h1 className="font-display mt-1 text-3xl leading-tight font-semibold">
        {record.work.name_field}
      </h1>
      {record.confirmCount > 0 && (
        <button
          type="button"
          onClick={() => setFill((v) => !v)}
          className="mt-1 inline-flex min-h-11 items-center text-sm text-warn"
        >
          {fill ? "成果物を見る" : `要確認 ${record.confirmCount}`}
        </button>
      )}

      {fill ? (
        <section className="mt-10">
          <ul className="space-y-3 text-sm leading-relaxed">
            {holes.length ? (
              holes.map((h, i) => (
                <li key={i} className="text-muted">
                  {h}
                </li>
              ))
            ) : (
              <li className="text-muted">空欄はありません。</li>
            )}
          </ul>
          <textarea
            value={answers}
            onChange={(e) => setAnswers(e.target.value)}
            rows={5}
            placeholder="答えを短く"
            className="mt-6 w-full resize-none border-0 border-b border-border bg-transparent px-0 py-2 outline-none focus:border-primary"
          />
          {err && <p className="mt-3 text-sm text-danger">{err}</p>}
          <Button className="mt-6" disabled={busy || !answers.trim()} onClick={() => void submitFill()}>
            {busy ? "反映中…" : "反映する"}
          </Button>
        </section>
      ) : (
        <>
          <nav className="-mx-5 mt-8 overflow-x-auto px-5">
            <div className="flex gap-5 border-b border-border">
              {tabs.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={cn(
                    "h-11 shrink-0 border-b-2 text-sm",
                    tab === k ? "border-fg text-fg" : "border-transparent text-muted",
                  )}
                >
                  {SHORT[k]}
                </button>
              ))}
              {!more && (
                <button
                  type="button"
                  onClick={() => setMore(true)}
                  className="h-11 shrink-0 text-sm text-subtle"
                >
                  ほか
                </button>
              )}
            </div>
          </nav>
          <article className="mt-6">
            <MarkdownView markdown={record.artifacts[tab]} />
          </article>
          {record.work.next_work && (
            <p className="mt-14 text-sm text-muted">
              次は{" "}
              <button type="button" className="underline-offset-4 hover:underline" onClick={() => void goNext()}>
                {record.work.next_work}
              </button>
            </p>
          )}
        </>
      )}

      <p className="mt-16 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {!record.isDemo && (
          <Link
            to="/interview/$workId"
            params={{ workId: record.id }}
            className="inline-flex min-h-11 items-center text-muted hover:text-fg"
          >
            取材
          </Link>
        )}
        <Link
          to="/print/$workId"
          params={{ workId: record.id }}
          className="inline-flex min-h-11 items-center text-muted hover:text-fg"
        >
          印刷
        </Link>
        <button
          type="button"
          className="inline-flex min-h-11 items-center text-muted hover:text-fg"
          onClick={downloadMd}
        >
          書き出す
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center text-muted hover:text-fg"
          onClick={() => void makeShare()}
        >
          共有
        </button>
        {!record.isDemo && (
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-subtle hover:text-danger"
            onClick={() => {
              void remove(record.id).then(() => navigate({ to: "/works" }));
            }}
          >
            削除
          </button>
        )}
      </p>
      {shareUrl ? (
        <p className="mt-2 break-all text-sm">
          <a href={shareUrl} className="text-muted hover:text-fg" target="_blank" rel="noreferrer">
            {shareUrl}
          </a>
        </p>
      ) : null}
    </AppShell>
  );
}
