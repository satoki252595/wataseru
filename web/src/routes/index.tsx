import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { InstallHint } from "@/components/install-hint";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useWorks } from "@/lib/wataseru/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const createDraft = useWorks((s) => s.createDraft);
  const works = useWorks((s) => s.works);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const demo = works.find((w) => w.isDemo);

  async function start() {
    if (busy) return;
    setBusy(true);
    const trimmed = name.trim();
    const record = await createDraft({
      nameField: trimmed,
      usage: "organize",
      source: "talk",
    });
    void navigate({ to: "/interview/$workId", params: { workId: record.id } });
  }

  return (
    <AppShell>
      <h1 className="font-display text-4xl leading-[1.25] font-semibold sm:text-5xl">
        仕事を、
        <br />
        渡せる言葉に。
      </h1>
      <p className="mt-5 max-w-xs text-muted">現場の呼び名をひとつ。</p>

      <form
        className="mt-14"
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
      >
        <label htmlFor="work-name" className="sr-only">
          現場での呼び名
        </label>
        <input
          id="work-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="請求まわす、上がり写真…"
          autoComplete="off"
          autoCapitalize="off"
          enterKeyHint="go"
          disabled={!hydrated || busy}
          className="h-12 w-full border-0 border-b border-border bg-transparent px-0 text-lg outline-none ring-0 placeholder:text-subtle focus:border-primary"
        />
        <Button type="submit" size="lg" className="mt-10 w-full sm:w-auto" disabled={!hydrated || busy}>
          始める
        </Button>
      </form>

      {demo ? (
        <p className="mt-10">
          <Link
            to="/works/$workId"
            params={{ workId: demo.id }}
            className="text-sm text-muted hover:text-fg"
          >
            デモを見る
          </Link>
        </p>
      ) : null}

      <InstallHint />
    </AppShell>
  );
}
