# 凍結フロント（画面の正本）

ワタセル Phase 1 の画面・トークン・操作はここが正本。本番 Web アプリは **この見た目のまま** テナントと DB を足す。再デザインしない。実装はリポジトリ直下の `web/` と `server/`。

要件の正本はリポジトリ直下の [`REQUIREMENTS.md`](../REQUIREMENTS.md)。

## 画面

| 経路 | ファイル |
| --- | --- |
| `/` | `src/routes/index.tsx` |
| `/interview/:workId` | `src/routes/interview.$workId.tsx` |
| `/works` | `src/routes/works.index.tsx` |
| `/works/:workId` | `src/routes/works.$workId.tsx` |
| `/print/:workId` | `src/routes/print.$workId.tsx` |

色と余白は `src/styles.css`。ヘッダと下タブは `src/components/app-shell.tsx`。

## 本番で差し替える箇所

- `src/lib/wataseru/store.ts`（localStorage）→ 会社スコープの API
- 取材のマイク: Web Speech のまま動かしつつ、録音アップロード + 文字起こしを裏に足す。ボタンの形は変えない
- 成果物末尾「書き出す」の横に「共有」を1語足してよい

## コピーしないもの

このディレクトリに入れてないホスト固有の部品（AuthProvider、PreviewHostBridge、`/__grok/` マニフェスト）は本番に持ち込まない。PWA は自前の `manifest.webmanifest`（name: ワタセル、theme_color: `#f3efe6`、display: standalone）。

`src/routes/__root.tsx` はホスト無しの骨格。`lang=ja`、`viewport-fit=cover`、紙色の theme-color、IBM Plex Sans JP と Shippori Mincho を維持する。
