import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(here, "../..");
loadEnv({ path: join(REPO_ROOT, ".env") });

function resolvePath(p: string): string {
  return isAbsolute(p) ? p : join(REPO_ROOT, p);
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  databasePath: resolvePath(process.env.DATABASE_PATH ?? "./data/wataseru.db"),
  uploadDir: resolvePath(process.env.UPLOAD_DIR ?? "./data/uploads"),
  sessionSecret: process.env.SESSION_SECRET ?? "dev-only-change-me",
  xaiApiKey: process.env.XAI_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  llmBaseUrl: process.env.LLM_BASE_URL ?? "",
  llmModel: process.env.LLM_MODEL ?? "grok-4.5",
  transcribeKey: process.env.OPENAI_API_KEY_TRANSCRIBE || process.env.OPENAI_API_KEY || "",
  transcribeModel: process.env.TRANSCRIBE_MODEL ?? "whisper-1",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "ワタセル <noreply@localhost>",
  authDevLinks: process.env.AUTH_DEV_LINKS === "1" || process.env.NODE_ENV !== "production",
  isProd: process.env.NODE_ENV === "production",
  webDist: join(REPO_ROOT, "web/dist"),
};
