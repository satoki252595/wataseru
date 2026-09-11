import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, isApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"in" | "create">("in");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [magicNote, setMagicNote] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") {
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            companyName: companyName.trim() || "会社",
            email,
            password,
            name: "社長",
          }),
        });
      } else {
        await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      }
      await refresh();
    } catch (e) {
      setError(isApiError(e) ? e.error : "入れませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function magic() {
    setBusy(true);
    setError(null);
    setMagicNote(null);
    try {
      const data = await api<{ ok: true; dev_link?: string }>("/api/auth/magic", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMagicNote(
        data.dev_link
          ? "開発用リンクを送りました。下のリンクで入れます。"
          : "メールを送りました。届いたリンクから入ってください。",
      );
      if (data.dev_link) {
        setMagicNote(data.dev_link);
      }
    } catch (e) {
      setError(isApiError(e) ? e.error : "送れませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-5 pt-20 pb-28 sm:px-6">
      <p className="font-display text-lg font-semibold">ワタセル</p>
      <h1 className="font-display mt-10 text-4xl leading-[1.25] font-semibold">
        仕事を、
        <br />
        渡せる言葉に。
      </h1>
      <p className="mt-5 text-muted">会社のメールで入ります。</p>

      <form
        className="mt-14"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {mode === "create" ? (
          <>
            <label htmlFor="company" className="sr-only">
              会社名
            </label>
            <input
              id="company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="会社名"
              autoComplete="organization"
              className="h-12 w-full border-0 border-b border-border bg-transparent px-0 text-lg outline-none placeholder:text-subtle focus:border-primary"
            />
          </>
        ) : null}
        <label htmlFor="email" className="sr-only">
          メール
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メール"
          autoComplete="email"
          className="mt-6 h-12 w-full border-0 border-b border-border bg-transparent px-0 text-lg outline-none placeholder:text-subtle focus:border-primary"
        />
        <label htmlFor="password" className="sr-only">
          パスワード
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          autoComplete={mode === "create" ? "new-password" : "current-password"}
          className="mt-6 h-12 w-full border-0 border-b border-border bg-transparent px-0 text-lg outline-none placeholder:text-subtle focus:border-primary"
        />
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        <Button type="submit" size="lg" className="mt-10 w-full sm:w-auto" disabled={busy}>
          {mode === "create" ? "会社をつくる" : "入る"}
        </Button>
      </form>

      <p className="mt-8 text-sm">
        <button
          type="button"
          className="text-muted hover:text-fg"
          onClick={() => setMode(mode === "in" ? "create" : "in")}
        >
          {mode === "in" ? "会社をつくる" : "すでにアカウントがある"}
        </button>
        <span className="mx-2 text-subtle">·</span>
        <button type="button" className="text-muted hover:text-fg" disabled={busy} onClick={() => void magic()}>
          メールで入る
        </button>
      </p>
      {magicNote ? (
        magicNote.startsWith("http") ? (
          <p className="mt-4 break-all text-sm">
            <a className="text-muted underline" href={magicNote}>
              メールのリンク（開発）
            </a>
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">{magicNote}</p>
        )
      ) : null}
    </div>
  );
}
