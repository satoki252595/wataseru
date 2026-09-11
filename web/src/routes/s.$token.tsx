import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MarkdownView } from "@/components/markdown-view";
import { api } from "@/lib/api";
import type { ArtifactKey, WorkRecord } from "@/lib/wataseru/types";
import { ARTIFACT_LABEL, REQUIRED_ARTIFACTS } from "@/lib/wataseru/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/s/$token")({ component: SharePage });

const ALL_TABS: ArtifactKey[] = [
  "card",
  "sop",
  "checklist",
  "order",
  "routing",
  "quality",
  "hiring",
  "ai",
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

function SharePage() {
  const { token } = Route.useParams();
  const [mode, setMode] = useState<"view" | "order" | null>(null);
  const [record, setRecord] = useState<WorkRecord | null>(null);
  const [tab, setTab] = useState<ArtifactKey>("card");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void api<{ mode: "view" | "order"; record: WorkRecord }>(`/api/share/${token}`)
      .then((data) => {
        setMode(data.mode);
        setRecord(data.record);
        if (data.mode === "order") setTab("order");
      })
      .catch(() => setErr("見つかりません。"));
  }, [token]);

  const tabs = useMemo(() => {
    if (!record || !mode) return [];
    if (mode === "order") return ["order"] as ArtifactKey[];
    const required = REQUIRED_ARTIFACTS[record.usage];
    return ALL_TABS.filter((k) => k === "card" || k === "sop" || required.includes(k));
  }, [record, mode]);

  if (err) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <p>{err}</p>
      </div>
    );
  }
  if (!record) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <p className="text-sm text-muted">読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-5 pt-12 pb-28 sm:px-6 sm:pt-20">
      <p className="font-display text-lg font-semibold">ワタセル</p>
      <h1 className="font-display mt-8 text-3xl leading-tight font-semibold">
        {record.work.name_field}
      </h1>
      {mode === "order" ? <p className="mt-2 text-sm text-muted">発注書ビュー</p> : null}

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
        </div>
      </nav>
      <article className="mt-6">
        <p className="mb-3 text-sm text-muted">{ARTIFACT_LABEL[tab]}</p>
        <MarkdownView markdown={record.artifacts[tab]} />
      </article>
    </div>
  );
}
