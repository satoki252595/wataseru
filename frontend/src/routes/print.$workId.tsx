import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MarkdownView } from "@/components/markdown-view";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useWorks } from "@/lib/wataseru/store";
import { ARTIFACT_LABEL, REQUIRED_ARTIFACTS, type ArtifactKey } from "@/lib/wataseru/types";

export const Route = createFileRoute("/print/$workId")({
  component: PrintPage,
});

const ORDER: ArtifactKey[] = [
  "card",
  "sop",
  "checklist",
  "order",
  "routing",
  "quality",
  "hiring",
  "ai",
];

function PrintPage() {
  const { workId } = Route.useParams();
  const hydrated = useHydrated();
  const record = useWorks((s) => s.works.find((w) => w.id === workId));

  if (!hydrated || !record) {
    return (
      <AppShell>
        <p className="text-sm text-muted">読み込み中…</p>
      </AppShell>
    );
  }

  const keys = ORDER.filter(
    (k) => REQUIRED_ARTIFACTS[record.usage].includes(k) || k === "card" || k === "sop",
  );

  return (
    <AppShell>
      <div className="no-print mb-10 flex items-center justify-between">
        <Link
          to="/works/$workId"
          params={{ workId: record.id }}
          className="inline-flex min-h-11 items-center text-sm text-muted"
        >
          戻る
        </Link>
        <Button onClick={() => window.print()}>印刷</Button>
      </div>
      <h1 className="font-display mb-10 text-3xl font-semibold">{record.work.name_field}</h1>
      {keys.map((k) => (
        <section key={k} className="mb-14 break-inside-avoid">
          <p className="mb-3 text-sm text-muted">{ARTIFACT_LABEL[k]}</p>
          <MarkdownView markdown={record.artifacts[k]} />
        </section>
      ))}
    </AppShell>
  );
}
