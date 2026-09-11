# ワタセル

採用の前に、仕事を言葉にする。

人が増えても社長が忙しくなる会社は、仕事が頭の中に残ったままだからである。ワタセルは、社長やベテランの頭の中にある仕事を、新人・外注・AIに渡せる言葉にする。

**同じフロントで本番 Web アプリを組むときの要件は [`REQUIREMENTS.md`](./REQUIREMENTS.md)。** 画面・トークン・文言の正本ソースは [`frontend/`](./frontend/)。作り直さない。

このリポジトリは設計書兼マスタープロンプト、実装時に分割するシステムプロンプト、Phase 1 の要件一覧、凍結したフロント、および Hono の本番 Web アプリである。

## 動かす（Phase 1 Web）

画面は [`frontend/`](./frontend/) のまま。サーバは Hono。保存は会社（テナント）単位の SQLite。LLM キーはサーバのみ。

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

ブラウザは http://localhost:5173 。API は http://127.0.0.1:8787（Vite が `/api` を代理する）。

本番相当:

```bash
npm run build
npm start
```

| 場所 | 役割 |
| --- | --- |
| `server/` | Hono。認証、業務、取材、文字起こし、共有 |
| `web/` | 凍結フロントの移植。localStorage を API に差し替え |
| `shared/` | 型、第8章テンプレ、第10章 QA |
| `data/` | SQLite と原本ファイル（学習に回さない） |

`.env` の `XAI_API_KEY` または `OPENAI_API_KEY` が取材・分解用。文字起こしは Whisper 系（`OPENAI_API_KEY`）。無いときは取材を閉じず「書いてください」に戻す。ユーザー素材は学習に使わない（`store: false`）。

会社をつくる → 現場の呼び名で始める → 取材（マイクは Web Speech + 録音アップロード）→ 「出す」→ 成果物。共有リンクは閲覧または発注書ビュー。デモ「請求まわす」は削除不可。数字は架空。

## 文書の場所

| 見るもの | ファイル |
| --- | --- |
| 実装要件（何を作るか） | [`REQUIREMENTS.md`](./REQUIREMENTS.md) |
| 凍結フロント（画面の正本） | [`frontend/`](./frontend/) |
| 思想・取材手順・成果物テンプレ | [`DESIGN.md`](./DESIGN.md) |
| 1業務の JSON | [`schema/work.schema.json`](./schema/work.schema.json) |
| エージェント指示 | [`prompts/`](./prompts/) |
| 完成例（施工店・請求。数字は架空） | [`examples/seko-seikyu.md`](./examples/seko-seikyu.md) |

## 使い方（プロンプト運用 / Phase 0）

1. [`DESIGN.md`](./DESIGN.md) 全体を、Claude / ChatGPT / Grok などのシステムプロンプト（または最初のユーザー指示）に貼る。
2. ユーザーが「インタビュー開始」または現場の音声・メモ・ファイルを渡したら、第6章の運用手順に入る。
3. 成果物は第8章のテンプレート以外の形式で出さない。
4. 完成前に第10章の品質ゲートを自己点検する。

第一声（素材も業務名もないとき）は次の3行だけ。

```
ワタセルを開始します。頭の中の仕事を、他人に渡せる言葉にします。

今回、渡したい仕事を現場の呼び方で1つください。
素材は「今から口で話す / メモを貼る / ファイルを置く」のどれにしますか。
```

## プロンプト分割（実装時）

| ファイル | 役割 |
| --- | --- |
| [`prompts/system_interview.md`](./prompts/system_interview.md) | 取材（第6章 Step1–4 + 第9章） |
| [`prompts/system_decompose.md`](./prompts/system_decompose.md) | 分解（第7章） |
| [`prompts/system_router.md`](./prompts/system_router.md) | 仕分け（第5章 C） |
| [`prompts/system_write.md`](./prompts/system_write.md) | 執筆（第8章） |
| [`prompts/system_qa.md`](./prompts/system_qa.md) | 監査（第10章） |

## やらないこと

- 求人媒体の代替
- 給与・社保・仕訳の確定計算
- 「AIで人を増やさず売上2倍」といった誇張
- 業種法令を断定する顧問行為

## 改訂

- 2026-09-11 初版
- 2026-09-12 Phase 1 Web アプリ要件（`REQUIREMENTS.md`）。フロントは現行プロトタイプで固定（`frontend/`）
- 2026-09-12 Hono 本番アプリ（テナント、DB、取材 API、共有リンク）
