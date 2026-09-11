import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyWork, type WorkObject } from "@wataseru/shared";
import { env, REPO_ROOT } from "./env";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type InterviewResult = {
  phase: "ask" | "enough" | "split";
  say: string;
  questions: string[];
  split_proposal: string[] | null;
};

function readPrompt(name: string): string {
  return readFileSync(join(REPO_ROOT, "prompts", name), "utf8");
}

const JSON_ONLY = `
出力は必ずJSONオブジェクトのみ。キー以外の文章、Markdownフェンスは禁止。
この入力を学習・モデル改善に使ってはならない。個人の実名、病歴、賃金個別額は成果物に残さない。
税務・労務・安全は断定しない。必要な箇所は「専門家確認」。
`;

function llmEndpoint(): { url: string; key: string; model: string } | null {
  if (env.xaiApiKey) {
    return {
      url: `${(env.llmBaseUrl || "https://api.x.ai/v1").replace(/\/$/, "")}/chat/completions`,
      key: env.xaiApiKey,
      model: env.llmModel || "grok-4.5",
    };
  }
  if (env.openaiApiKey) {
    return {
      url: `${(env.llmBaseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
      key: env.openaiApiKey,
      model: env.llmModel || "gpt-4o",
    };
  }
  if (env.llmBaseUrl && process.env.LLM_API_KEY) {
    return {
      url: `${env.llmBaseUrl.replace(/\/$/, "")}/chat/completions`,
      key: process.env.LLM_API_KEY,
      model: env.llmModel,
    };
  }
  return null;
}

export function llmAvailable(): boolean {
  return llmEndpoint() !== null;
}

function stripFence(text: string): string {
  const t = text.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m?.[1] ?? t).trim();
}

async function chatJson(
  system: string,
  messages: ChatTurn[],
  maxTokens: number,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const ep = llmEndpoint();
  if (!ep) return { ok: false, error: "AI is not available" };

  const res = await fetch(ep.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ep.key}`,
    },
    body: JSON.stringify({
      model: ep.model,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      store: false,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!res.ok) {
    return { ok: false, error: `LLM error ${res.status}` };
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(stripFence(text)) as unknown;
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: "AIの応答を読めませんでした" };
  }
}

export async function runInterview(input: {
  usageLabel: string;
  nameField: string;
  history: ChatTurn[];
}): Promise<{ ok: true; data: InterviewResult } | { ok: false; error: string }> {
  const system = `${readPrompt("system_interview.md")}\n${JSON_ONLY}
phase は ask | enough | split。questions は最大3。`;
  const userPreface = `使い道：${input.usageLabel}\n現場での呼び名：${input.nameField || "（未）"}`;
  const result = await chatJson(
    system,
    [{ role: "user", content: userPreface }, ...input.history],
    900,
  );
  if (!result.ok) return result;
  const raw = result.data as Partial<InterviewResult>;
  const phase =
    raw.phase === "enough" || raw.phase === "split" || raw.phase === "ask" ? raw.phase : "ask";
  const questions = Array.isArray(raw.questions)
    ? raw.questions.filter((q) => typeof q === "string").slice(0, 3)
    : [];
  const say =
    typeof raw.say === "string" && raw.say.trim() ? raw.say.trim() : questions.join("\n");
  const split =
    Array.isArray(raw.split_proposal) && raw.split_proposal.length
      ? raw.split_proposal.map(String)
      : null;
  return { ok: true, data: { phase, say, questions, split_proposal: split } };
}

export async function runDecompose(input: {
  usageLabel: string;
  nameField: string;
  transcript: string;
  existing?: WorkObject | null;
  fillAnswers?: string;
}): Promise<{ ok: true; data: WorkObject } | { ok: false; error: string }> {
  const decompose = readPrompt("system_decompose.md");
  const router = readPrompt("system_router.md");
  const system = input.fillAnswers
    ? `${decompose}\n\nあなたは穴埋めエージェントでもある。既存オブジェクトを更新して返す。推測は [推論]。\n${router}\n${JSON_ONLY}`
    : `${decompose}\n\n${router}\n${JSON_ONLY}`;
  const prompt = [
    `使い道：${input.usageLabel}`,
    `現場での呼び名：${input.nameField || "（未）"}`,
    input.existing ? `既存オブジェクト：\n${JSON.stringify(input.existing)}` : "",
    input.fillAnswers ? `穴埋め回答：\n${input.fillAnswers}` : "",
    `取材ログ：\n${input.transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const result = await chatJson(system, [{ role: "user", content: prompt }], 3500);
  if (!result.ok) return result;
  return { ok: true, data: emptyWork({ ...(result.data as WorkObject) }) };
}

export async function runQaLlm(input: {
  work: WorkObject;
  notes: string[];
}): Promise<{ ok: true; data: { notes: string[]; patch?: string } } | { ok: false; error: string }> {
  const system = `${readPrompt("system_qa.md")}\n${JSON_ONLY}
出力: { "notes": ["指摘"], "patch": "直すべき点の短い指示" }`;
  const prompt = `アプリ側QA指摘:\n${input.notes.join("\n")}\n\n業務オブジェクト:\n${JSON.stringify(input.work)}`;
  const result = await chatJson(system, [{ role: "user", content: prompt }], 800);
  if (!result.ok) return result;
  const raw = result.data as { notes?: unknown; patch?: unknown };
  const notes = Array.isArray(raw.notes) ? raw.notes.map(String) : [];
  const patch = typeof raw.patch === "string" ? raw.patch : undefined;
  return { ok: true, data: { notes, patch } };
}
