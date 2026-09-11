import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { InstallHint } from "@/components/install-hint";
import { Button } from "@/components/ui/button";
import { DEMO_ID, useWorks } from "@/lib/wataseru/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const createDraft = useWorks((s) => s.createDraft);
  const appendMessage = useWorks((s) => s.appendMessage);
  const [name, setName] = useState("");

  function start() {
    const trimmed = name.trim();
    const record = createDraft({
      nameField: trimmed,
      usage: "organize",
      source: "talk",
    });
    if (trimmed) {
      appendMessage(record.id, {
        role: "user",
        content: `現場の呼び方：${trimmed}`,
      });
    } else {
      appendMessage(record.id, {
        role: "assistant",
        content:
          "ワタセルを開始します。頭の中の仕事を、他人に渡せる言葉にします。\n\n今回、渡したい仕事を現場の呼び方で1つください。",
      });
    }
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
          start();
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
          className="h-12 w-full border-0 border-b border-border bg-transparent px-0 text-lg outline-none ring-0 placeholder:text-subtle focus:border-primary"
        />
        <Button type="submit" size="lg" className="mt-10 w-full sm:w-auto">
          始める
        </Button>
      </form>

      <p className="mt-10">
        <Link
          to="/works/$workId"
          params={{ workId: DEMO_ID }}
          className="text-sm text-muted hover:text-fg"
        >
          デモを見る
        </Link>
      </p>

      <InstallHint />
    </AppShell>
  );
}
