import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[要確認\]|\[推論\])/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part === "[要確認]") {
      return (
        <mark key={key} className="rounded-sm bg-warn/20 px-1 py-px font-medium text-warn">
          要確認
        </mark>
      );
    }
    if (part === "[推論]") {
      return (
        <mark
          key={key}
          className="rounded-sm bg-primary/10 px-1 py-px font-medium text-primary"
        >
          推論
        </mark>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="rounded-sm bg-surface px-1 text-sm">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

function parseTable(block: string) {
  const rows = block
    .trim()
    .split("\n")
    .map((r) =>
      r
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim()),
    );
  if (rows.length < 2) return null;
  const header = rows[0];
  const body = rows.slice(2);
  return { header, body };
}

export function MarkdownView({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("|") && i + 1 < lines.length && /^\|?\s*-+/.test(lines[i + 1])) {
      const start = i;
      i += 1;
      while (i < lines.length && lines[i].startsWith("|")) i += 1;
      const table = parseTable(lines.slice(start, i).join("\n"));
      if (table) {
        nodes.push(
          <div key={k++} className="my-4 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            <table className="w-full min-w-96 border-collapse text-left text-sm">
              <thead>
                <tr>
                  {table.header.map((h, hi) => (
                    <th
                      key={hi}
                      className="border-b border-border bg-surface px-3 py-2 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.body.map((row, ri) => (
                  <tr key={ri} className="border-b border-border/70">
                    {row.map((c, ci) => (
                      <td key={ci} className="px-3 py-2 align-top">
                        {renderInline(c, `${k}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
    }

    if (line.startsWith("# ")) {
      nodes.push(
        <h1 key={k++} className="font-display mt-2 mb-4 text-2xl font-semibold tracking-tight">
          {renderInline(line.slice(2), `h1-${k}`)}
        </h1>,
      );
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={k++} className="font-display mt-8 mb-3 text-lg font-semibold tracking-tight">
          {renderInline(line.slice(3), `h2-${k}`)}
        </h2>,
      );
      i += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      nodes.push(
        <h3 key={k++} className="mt-5 mb-2 text-base font-medium">
          {renderInline(line.slice(4), `h3-${k}`)}
        </h3>,
      );
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const start = i;
      while (
        i < lines.length &&
        (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))
      ) {
        i += 1;
      }
      const items = lines.slice(start, i);
      nodes.push(
        <ul key={k++} className="my-3 space-y-1.5 pl-1">
          {items.map((item, ii) => {
            const body = item
              .replace(/^\s*[-*]\s+/, "")
              .replace(/^\s*\d+\.\s+/, "")
              .replace(/^\s+/, "");
            const numbered = /^\s*\d+\./.test(item);
            return (
              <li key={ii} className="flex gap-2 text-sm leading-relaxed sm:text-base">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                <span>
                  {numbered ? (
                    <span className="mr-1 text-muted">{item.match(/^\s*(\d+\.)/)?.[1]} </span>
                  ) : null}
                  {renderInline(body, `li-${k}-${ii}`)}
                </span>
              </li>
            );
          })}
        </ul>,
      );
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    nodes.push(
      <p key={k++} className="my-2 text-sm leading-relaxed sm:text-base">
        {renderInline(line, `p-${k}`)}
      </p>,
    );
    i += 1;
  }

  return <div className={cn("max-w-3xl", className)}>{nodes}</div>;
}
