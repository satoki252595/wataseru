import { createServerFn } from "@tanstack/react-start";
import { SYSTEM_DECOMPOSE, SYSTEM_FILL, SYSTEM_INTERVIEW } from "@/lib/wataseru/prompts";
import type { WorkObject } from "@/lib/wataseru/types";

type ChatTurn = { role: "user" | "assistant"; content: string };

async function chatJson(system: string, messages: ChatTurn[], maxTokens: number) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false as const, error: "AI is not available" };

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!res.ok) {
    return { ok: false as const, error: `xAI API error ${res.status}` };
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(stripFence(text)) as unknown;
    return { ok: true as const, data: parsed };
  } catch {
    return { ok: false as const, error: "AIの応答を読めませんでした" };
  }
}

function stripFence(text: string): string {
  const t = text.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m?.[1] ?? t).trim();
}

export type InterviewResult = {
  phase: "ask" | "enough" | "split";
  say: string;
  questions: string[];
  split_proposal: string[] | null;
};

export const interviewTurn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      usageLabel: string;
      nameField: string;
      history: ChatTurn[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const userPreface = `使い道：${data.usageLabel}\n現場での呼び名：${data.nameField || "（未）"}`;
    const result = await chatJson(
      SYSTEM_INTERVIEW,
      [
        { role: "user", content: userPreface },
        ...data.history,
      ],
      900,
    );
    if (!result.ok) return result;

    const raw = result.data as Partial<InterviewResult>;
    const phase =
      raw.phase === "enough" || raw.phase === "split" || raw.phase === "ask"
        ? raw.phase
        : "ask";
    const questions = Array.isArray(raw.questions)
      ? raw.questions.filter((q) => typeof q === "string").slice(0, 3)
      : [];
    const say =
      typeof raw.say === "string" && raw.say.trim()
        ? raw.say.trim()
        : questions.join("\n");
    const split =
      Array.isArray(raw.split_proposal) && raw.split_proposal.length
        ? raw.split_proposal.map(String)
        : null;

    return {
      ok: true as const,
      data: { phase, say, questions, split_proposal: split } satisfies InterviewResult,
    };
  });

export const decomposeWork = createServerFn({ method: "POST" })
  .validator(
    (input: {
      usageLabel: string;
      nameField: string;
      transcript: string;
      existing?: WorkObject | null;
      fillAnswers?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const system = data.fillAnswers ? SYSTEM_FILL : SYSTEM_DECOMPOSE;
    const prompt = [
      `使い道：${data.usageLabel}`,
      `現場での呼び名：${data.nameField || "（未）"}`,
      data.existing ? `既存オブジェクト：\n${JSON.stringify(data.existing)}` : "",
      data.fillAnswers ? `穴埋め回答：\n${data.fillAnswers}` : "",
      `取材ログ：\n${data.transcript}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await chatJson(system, [{ role: "user", content: prompt }], 3500);
    if (!result.ok) return result;
    return { ok: true as const, data: result.data as WorkObject };
  });
