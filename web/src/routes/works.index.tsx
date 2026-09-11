import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useHydrated } from "@/hooks/use-hydrated";
import { useAuth } from "@/lib/auth";
import { useWorks } from "@/lib/wataseru/store";

export const Route = createFileRoute("/works/")({ component: WorksIndex });

function statusLabel(status: string) {
  if (status === "ready") return "済";
  if (status === "holes") return "穴";
  return "途中";
}

function WorksIndex() {
  const hydrated = useHydrated();
  const works = useWorks((s) => s.works);
  const { logout } = useAuth();

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">一覧</h1>

      {!hydrated ? (
        <p className="mt-10 text-sm text-muted">読み込み中…</p>
      ) : (
        <ul className="mt-10">
          {works.map((w) => (
            <li key={w.id}>
              <Link
                to="/works/$workId"
                params={{ workId: w.id }}
                className="flex min-h-14 items-center justify-between gap-4 border-b border-border/80 py-4"
              >
                <span className="min-w-0 truncate">{w.work.name_field}</span>
                <span className="shrink-0 text-sm text-muted">{statusLabel(w.status)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-16 text-sm">
        <button type="button" className="text-subtle hover:text-fg" onClick={() => void logout()}>
          出る
        </button>
      </p>
    </AppShell>
  );
}
