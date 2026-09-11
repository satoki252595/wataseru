import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  title,
  trailing,
  chat = false,
}: {
  children: ReactNode;
  title?: string;
  trailing?: ReactNode;
  chat?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideTabs = chat || pathname.startsWith("/print");
  const onStart = pathname === "/";
  const onList = pathname.startsWith("/works");

  return (
    <div className={cn("bg-bg text-fg", chat ? "flex h-dvh flex-col" : "min-h-dvh")}>
      <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/90 pt-safe backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-2xl items-center pl-safe pr-safe sm:h-14">
          {chat ? (
            <Link
              to="/"
              className="inline-flex size-11 shrink-0 items-center justify-center"
              aria-label="戻る"
            >
              <ArrowLeft className="size-5" strokeWidth={1.5} />
            </Link>
          ) : (
            <Link
              to="/"
              className="font-display inline-flex min-h-11 items-center px-4 text-lg font-semibold tracking-tight"
            >
              ワタセル
            </Link>
          )}
          {title ? (
            <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h1>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center pr-1">
            {trailing}
            {!hideTabs && (
              <nav className="hidden items-center sm:flex">
                <Link
                  to="/"
                  className={cn(
                    "inline-flex min-h-11 items-center px-3 text-sm",
                    onStart ? "text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  始める
                </Link>
                <Link
                  to="/works"
                  className={cn(
                    "inline-flex min-h-11 items-center px-3 text-sm",
                    onList ? "text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  一覧
                </Link>
              </nav>
            )}
          </div>
        </div>
      </header>

      <main
        className={cn(
          chat
            ? "flex min-h-0 flex-1 flex-col"
            : "mx-auto w-full max-w-2xl px-5 pt-12 pb-28 sm:px-6 sm:pt-20 sm:pb-16",
        )}
      >
        {children}
      </main>

      {!hideTabs && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-bg/95 pb-safe pl-safe pr-safe backdrop-blur-sm sm:hidden">
          <div className="mx-auto grid max-w-2xl grid-cols-2">
            <Link
              to="/"
              className={cn(
                "flex min-h-12 items-center justify-center text-sm",
                onStart ? "text-fg" : "text-muted",
              )}
            >
              始める
            </Link>
            <Link
              to="/works"
              className={cn(
                "flex min-h-12 items-center justify-center text-sm",
                onList ? "text-fg" : "text-muted",
              )}
            >
              一覧
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
