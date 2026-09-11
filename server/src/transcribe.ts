import { env } from "./env";

export function transcribeAvailable(): boolean {
  return Boolean(env.transcribeKey);
}

export async function transcribeAudio(
  bytes: Uint8Array,
  filename: string,
  mime: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!env.transcribeKey) {
    return { ok: false, error: "音声入力に未対応です。書いてください。" };
  }

  const copy = Uint8Array.from(bytes);
  const blob = new Blob([copy], { type: mime || "audio/webm" });
  const form = new FormData();
  form.set("file", blob, filename || "audio.webm");
  form.set("model", env.transcribeModel);
  form.set("language", "ja");

  const url = env.llmBaseUrl?.includes("x.ai")
    ? "https://api.openai.com/v1/audio/transcriptions"
    : `${(env.llmBaseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/audio/transcriptions`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.transcribeKey}` },
      body: form,
    });
    if (!res.ok) {
      return { ok: false, error: "文字起こしに失敗しました。書いてください。" };
    }
    const body = (await res.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return { ok: false, error: "聞き取れませんでした。書いてください。" };
    return { ok: true, text };
  } catch {
    return { ok: false, error: "文字起こしに失敗しました。書いてください。" };
  }
}
