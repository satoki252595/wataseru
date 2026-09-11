import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { DatabaseSync } from "node:sqlite";
import { env } from "./env";
import { getSessionUser, getUserByEmail, type Role, type UserRow } from "./db";
import { makeDemoRecord, newId, nowIso } from "@wataseru/shared";
import { saveWork } from "./db";

const COOKIE = "wataseru_session";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  companyId: string;
  email: string;
  name: string;
  role: Role;
};

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    companyId: row.company_id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

export function setSessionCookie(c: Context, token: string) {
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: env.isProd,
    expires,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
}

export function readSessionToken(c: Context): string | undefined {
  return getCookie(c, COOKIE);
}

export function currentUser(db: DatabaseSync, c: Context): AuthUser | null {
  const token = readSessionToken(c);
  if (!token) return null;
  const row = getSessionUser(db, token);
  return row ? toAuthUser(row) : null;
}

export function createSession(db: DatabaseSync, userId: string): string {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).run(
    token,
    userId,
    expires,
  );
  return token;
}

export function destroySession(db: DatabaseSync, token: string) {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function registerCompany(
  db: DatabaseSync,
  input: { companyName: string; email: string; password: string; name: string },
): UserRow {
  const email = input.email.trim().toLowerCase();
  if (getUserByEmail(db, email)) {
    throw Object.assign(new Error("このメールは既に使われています"), { status: 409 });
  }
  const companyId = newId("co");
  const userId = newId("user");
  const t = nowIso();
  db.exec("BEGIN");
  try {
    db.prepare(`INSERT INTO companies (id, name, created_at) VALUES (?, ?, ?)`).run(
      companyId,
      input.companyName.trim() || "会社",
      t,
    );
    db.prepare(
      `INSERT INTO users (id, company_id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, 'member', ?)`,
    ).run(userId, companyId, email, hashPassword(input.password), input.name.trim() || "社長", t);
    const demo = makeDemoRecord(newId("demo"));
    saveWork(db, companyId, demo);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return getUserByEmail(db, email)!;
}

export function createMagicLink(db: DatabaseSync, email: string): { token: string; url: string } {
  const token = newToken();
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO magic_links (token, email, expires_at, used) VALUES (?, ?, ?, 0)`,
  ).run(token, email.trim().toLowerCase(), expires);
  const url = `${env.appUrl}/api/auth/magic/${token}`;
  return { token, url };
}

export function consumeMagicLink(db: DatabaseSync, token: string): UserRow | null {
  const row = db
    .prepare(
      `SELECT * FROM magic_links WHERE token = ? AND used = 0 AND expires_at > ?`,
    )
    .get(token, nowIso()) as { email: string } | undefined;
  if (!row) return null;
  db.prepare(`UPDATE magic_links SET used = 1 WHERE token = ?`).run(token);
  return getUserByEmail(db, row.email);
}

/** 学習利用しないためのリクエスト指紋。プロンプト本文は残さない。 */
export function requestFingerprint(kind: string): string {
  return createHash("sha256").update(`${kind}:${Date.now()}`).digest("hex").slice(0, 12);
}
