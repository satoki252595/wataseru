import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import type { DatabaseSync } from "node:sqlite";
import type { WorkRecord } from "@wataseru/shared";
import {
  clearSessionCookie,
  consumeMagicLink,
  createMagicLink,
  createSession,
  currentUser,
  destroySession,
  registerCompany,
  setSessionCookie,
  toAuthUser,
  verifyPassword,
  readSessionToken,
  type AuthUser,
} from "./auth";
import { env } from "./env";
import { getUserByEmail, getWork, openDb } from "./db";
import { saveUpload } from "./files";
import { transcribeAudio } from "./transcribe";
import {
  companyWorks,
  createDraft,
  createShare,
  fillWork,
  generateWork,
  interviewOnce,
  removeWork,
  setUsage,
  spawnNext,
} from "./works";

export type AppEnv = {
  Variables: {
    db: DatabaseSync;
    user: AuthUser;
  };
};

const PUBLIC_PATHS = new Set([
  "/api/health",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/magic",
  "/api/auth/me",
]);

function filterForRole(user: AuthUser, record: WorkRecord): WorkRecord {
  if (user.role !== "contractor") return record;
  const order = record.artifacts.order;
  return {
    ...record,
    artifacts: {
      card: "",
      sop: "",
      checklist: "",
      order,
      routing: "",
      quality: "",
      hiring: "",
      ai: "",
      log: "",
    },
    messages: [],
    work: {
      ...record.work,
      never_do: [],
      failures: [],
    },
  };
}

function httpError(err: unknown): { status: number; message: string } {
  if (err && typeof err === "object" && "status" in err) {
    const status = Number((err as { status: number }).status) || 500;
    const message = err instanceof Error ? err.message : "error";
    return { status, message };
  }
  return { status: 500, message: err instanceof Error ? err.message : "error" };
}

export function createApp(db: DatabaseSync) {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });

  app.use(
    "/api/*",
    cors({
      origin: env.isProd ? env.appUrl : ["http://localhost:5173", "http://127.0.0.1:5173", env.appUrl],
      credentials: true,
    }),
  );

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.post("/api/auth/register", async (c) => {
    const body = await c.req.json<{
      companyName?: string;
      email?: string;
      password?: string;
      name?: string;
    }>();
    if (!body.email || !body.password) {
      return c.json({ error: "メールとパスワードを入れてください" }, 400);
    }
    if (body.password.length < 8) {
      return c.json({ error: "パスワードは8文字以上です" }, 400);
    }
    try {
      const user = registerCompany(db, {
        companyName: body.companyName || "会社",
        email: body.email,
        password: body.password,
        name: body.name || "社長",
      });
      const token = createSession(db, user.id);
      setSessionCookie(c, token);
      return c.json({ user: toAuthUser(user) });
    } catch (err) {
      const { status, message } = httpError(err);
      return c.json({ error: message }, status as 400);
    }
  });

  app.post("/api/auth/login", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>();
    if (!body.email || !body.password) {
      return c.json({ error: "メールとパスワードを入れてください" }, 400);
    }
    const user = getUserByEmail(db, body.email);
    if (!user?.password_hash || !verifyPassword(body.password, user.password_hash)) {
      return c.json({ error: "メールまたはパスワードが違います" }, 401);
    }
    const token = createSession(db, user.id);
    setSessionCookie(c, token);
    return c.json({ user: toAuthUser(user) });
  });

  app.post("/api/auth/magic", async (c) => {
    const body = await c.req.json<{ email?: string }>();
    if (!body.email) return c.json({ error: "メールを入れてください" }, 400);
    const existing = getUserByEmail(db, body.email);
    if (!existing) {
      return c.json({ ok: true });
    }
    const { url } = createMagicLink(db, body.email);
    if (env.authDevLinks && !env.smtpHost) {
      return c.json({ ok: true, dev_link: url });
    }
    return c.json({ ok: true });
  });

  app.get("/api/auth/magic/:token", (c) => {
    const user = consumeMagicLink(db, c.req.param("token"));
    if (!user) return c.redirect("/login?error=magic");
    const token = createSession(db, user.id);
    setSessionCookie(c, token);
    return c.redirect("/");
  });

  app.post("/api/auth/logout", (c) => {
    const token = readSessionToken(c);
    if (token) destroySession(db, token);
    clearSessionCookie(c);
    return c.json({ ok: true });
  });

  app.get("/api/auth/me", (c) => {
    const user = currentUser(db, c);
    if (!user) return c.json({ user: null });
    return c.json({ user });
  });

  app.get("/api/share/:token", (c) => {
    const row = db
      .prepare(
        `SELECT s.mode, s.company_id, s.work_id FROM shares s WHERE s.token = ?`,
      )
      .get(c.req.param("token")) as
      | { mode: "view" | "order"; company_id: string; work_id: string }
      | undefined;
    if (!row) return c.json({ error: "見つかりません" }, 404);
    const record = getWork(db, row.company_id, row.work_id);
    if (!record) return c.json({ error: "見つかりません" }, 404);
    if (row.mode === "order") {
      return c.json({
        mode: "order",
        record: {
          ...record,
          artifacts: { ...record.artifacts, card: "", sop: "", checklist: "", routing: "", quality: "", hiring: "", ai: "", log: "" },
          messages: [],
        },
      });
    }
    return c.json({ mode: "view", record: { ...record, messages: [] } });
  });

  app.use("/api/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    const path = new URL(c.req.url).pathname;
    if (PUBLIC_PATHS.has(path) || path.startsWith("/api/auth/magic/") || path.startsWith("/api/share/")) {
      return next();
    }
    const user = currentUser(db, c);
    if (!user) return c.json({ error: "ログインしてください" }, 401);
    c.set("user", user);
    await next();
  });

  app.get("/api/works", (c) => {
    const user = c.get("user");
    const works = companyWorks(db, user.companyId).map((w) => filterForRole(user, w));
    return c.json({ works });
  });

  app.post("/api/works", async (c) => {
    const user = c.get("user");
    if (user.role === "contractor") return c.json({ error: "権限がありません" }, 403);
    const body = await c.req.json<{
      nameField?: string;
      usage?: WorkRecord["usage"];
      source?: WorkRecord["source"];
      material?: string;
    }>();
    const record = createDraft(db, user.companyId, {
      nameField: body.nameField ?? "",
      usage: body.usage,
      source: body.source,
      material: body.material,
    });
    return c.json({ record });
  });

  app.get("/api/works/:id", (c) => {
    const user = c.get("user");
    const record = getWork(db, user.companyId, c.req.param("id"));
    if (!record) return c.json({ error: "見つかりません" }, 404);
    return c.json({ record: filterForRole(user, record) });
  });

  app.patch("/api/works/:id", async (c) => {
    const user = c.get("user");
    if (user.role === "contractor") return c.json({ error: "権限がありません" }, 403);
    const body = await c.req.json<{ usage?: WorkRecord["usage"] }>();
    try {
      if (!body.usage) return c.json({ error: "usage が必要です" }, 400);
      const record = setUsage(db, user.companyId, c.req.param("id"), body.usage);
      return c.json({ record });
    } catch (err) {
      const { status, message } = httpError(err);
      return c.json({ error: message }, status as 400);
    }
  });

  app.delete("/api/works/:id", (c) => {
    const user = c.get("user");
    if (user.role === "contractor") return c.json({ error: "権限がありません" }, 403);
    try {
      removeWork(db, user.companyId, c.req.param("id"));
      return c.json({ ok: true });
    } catch (err) {
      const { status, message } = httpError(err);
      return c.json({ error: message }, status as 400);
    }
  });

  app.post("/api/works/:id/messages", async (c) => {
    const user = c.get("user");
    if (user.role === "contractor") return c.json({ error: "権限がありません" }, 403);
    const body = await c.req.json<{ content?: string }>();
    try {
      const out = await interviewOnce(db, user.companyId, c.req.param("id"), body.content);
      return c.json(out);
    } catch (err) {
      const { status, message } = httpError(err);
      return c.json({ error: message }, status as 400);
    }
  });

  app.post("/api/works/:id/generate", async (c) => {
    const user = c.get("user");
    if (user.role === "contractor") return c.json({ error: "権限がありません" }, 403);
    try {
      const out = await generateWork(db, user.companyId, c.req.param("id"));
      return c.json(out);
    } catch (err) {
      const { status, message } = httpError(err);
      return c.json({ error: message }, status as 400);
    }
  });

  app.post("/api/works/:id/fill", async (c) => {
    const user = c.get("user");
    if (user.role === "contractor") return c.json({ error: "権限がありません" }, 403);
    const body = await c.req.json<{ answers?: string }>();
    if (!body.answers?.trim()) return c.json({ error: "答えを短く" }, 400);
    try {
      const out = await fillWork(db, user.companyId, c.req.param("id"), body.answers.trim());
      return c.json(out);
    } catch (err) {
      const { status, message } = httpError(err);
      return c.json({ error: message }, status as 400);
    }
  });

  app.post("/api/works/:id/share", async (c) => {
    const user = c.get("user");
    if (user.role === "contractor") return c.json({ error: "権限がありません" }, 403);
    const body = await c.req.json<{ mode?: "view" | "order" }>().catch(() => ({ mode: "view" as const }));
    const mode = body.mode === "order" ? "order" : "view";
    try {
      const { token } = createShare(db, user.companyId, c.req.param("id"), mode);
      const url = `${env.appUrl}/s/${token}`;
      return c.json({ token, mode, url });
    } catch (err) {
      const { status, message } = httpError(err);
      return c.json({ error: message }, status as 400);
    }
  });

  app.post("/api/works/:id/next", (c) => {
    const user = c.get("user");
    if (user.role === "contractor") return c.json({ error: "権限がありません" }, 403);
    try {
      const record = spawnNext(db, user.companyId, c.req.param("id"));
      return c.json({ record });
    } catch (err) {
      const { status, message } = httpError(err);
      return c.json({ error: message }, status as 400);
    }
  });

  app.post("/api/transcribe", async (c) => {
    const user = c.get("user");
    if (user.role === "contractor") return c.json({ error: "権限がありません" }, 403);
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: "書いてください" }, 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await transcribeAudio(bytes, file.name, file.type);
    if (!result.ok) return c.json({ error: result.error }, 503);
    return c.json({ text: result.text });
  });

  app.post("/api/files", async (c) => {
    const user = c.get("user");
    if (user.role === "contractor") return c.json({ error: "権限がありません" }, 403);
    const form = await c.req.formData();
    const file = form.get("file");
    const workId = String(form.get("workId") ?? "") || null;
    if (!(file instanceof File)) return c.json({ error: "ファイルがありません" }, 400);
    try {
      const saved = await saveUpload(db, {
        companyId: user.companyId,
        workId,
        filename: file.name,
        mime: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      return c.json({
        file: {
          id: saved.id,
          name: saved.original_name,
          extractedText: saved.extracted_text,
        },
      });
    } catch (err) {
      const { status, message } = httpError(err);
      return c.json({ error: message }, status as 400);
    }
  });

  if (existsSync(env.webDist)) {
    app.use("/*", serveStatic({ root: env.webDist }));
  }

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) return c.json({ error: "見つかりません" }, 404);
    const index = join(env.webDist, "index.html");
    if (existsSync(index)) return c.html(readFileSync(index, "utf8"));
    return c.text("not found", 404);
  });

  return app;
}

export function createAppFromPath(dbPath = env.databasePath) {
  return createApp(openDb(dbPath));
}
