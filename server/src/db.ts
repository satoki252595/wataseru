import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Artifacts,
  ChatMessage,
  SourceKind,
  Usage,
  WorkObject,
  WorkRecord,
  WorkStatus,
} from "@wataseru/shared";

export type Role = "member" | "contractor";

export type UserRow = {
  id: string;
  company_id: string;
  email: string;
  password_hash: string | null;
  name: string;
  role: Role;
  created_at: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  created_at: string;
};

export type FileRow = {
  id: string;
  company_id: string;
  work_id: string | null;
  original_name: string;
  mime: string;
  path: string;
  extracted_text: string;
  created_at: string;
};

export type ShareRow = {
  id: string;
  work_id: string;
  company_id: string;
  token: string;
  mode: "view" | "order";
  created_at: string;
};

type WorkRow = {
  id: string;
  company_id: string;
  created_at: string;
  updated_at: string;
  usage: Usage;
  source: SourceKind;
  status: WorkStatus;
  work_json: string;
  artifacts_json: string;
  messages_json: string;
  qa_notes: string;
  confirm_count: number;
  confirm_count_first: number;
  is_demo: number;
};

export type Db = ReturnType<typeof openDb>;

export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS magic_links (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS works (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      usage TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      work_json TEXT NOT NULL,
      artifacts_json TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      qa_notes TEXT NOT NULL DEFAULT '',
      confirm_count INTEGER NOT NULL DEFAULT 0,
      confirm_count_first INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS works_company ON works(company_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      work_id TEXT NOT NULL REFERENCES works(id),
      company_id TEXT NOT NULL REFERENCES companies(id),
      token TEXT NOT NULL UNIQUE,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      work_id TEXT,
      original_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      path TEXT NOT NULL,
      extracted_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);
}

export function rowToRecord(row: WorkRow): WorkRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usage: row.usage,
    source: row.source,
    status: row.status,
    work: JSON.parse(row.work_json) as WorkObject,
    artifacts: JSON.parse(row.artifacts_json) as Artifacts,
    messages: JSON.parse(row.messages_json) as ChatMessage[],
    qaNotes: row.qa_notes,
    confirmCount: row.confirm_count,
    confirmCountFirst: row.confirm_count_first,
    isDemo: Boolean(row.is_demo),
  };
}

export function saveWork(db: DatabaseSync, companyId: string, record: WorkRecord) {
  db.prepare(
    `INSERT INTO works (
      id, company_id, created_at, updated_at, usage, source, status,
      work_json, artifacts_json, messages_json, qa_notes,
      confirm_count, confirm_count_first, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      usage = excluded.usage,
      source = excluded.source,
      status = excluded.status,
      work_json = excluded.work_json,
      artifacts_json = excluded.artifacts_json,
      messages_json = excluded.messages_json,
      qa_notes = excluded.qa_notes,
      confirm_count = excluded.confirm_count,
      confirm_count_first = excluded.confirm_count_first
    `,
  ).run(
    record.id,
    companyId,
    record.createdAt,
    record.updatedAt,
    record.usage,
    record.source,
    record.status,
    JSON.stringify(record.work),
    JSON.stringify(record.artifacts),
    JSON.stringify(record.messages),
    record.qaNotes,
    record.confirmCount,
    record.confirmCountFirst,
    record.isDemo ? 1 : 0,
  );
}

export function getWork(db: DatabaseSync, companyId: string, id: string): WorkRecord | null {
  const row = db
    .prepare(`SELECT * FROM works WHERE id = ? AND company_id = ?`)
    .get(id, companyId) as WorkRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function getWorkById(db: DatabaseSync, id: string): (WorkRecord & { companyId: string }) | null {
  const row = db.prepare(`SELECT * FROM works WHERE id = ?`).get(id) as WorkRow | undefined;
  if (!row) return null;
  return { ...rowToRecord(row), companyId: row.company_id };
}

export function listWorks(db: DatabaseSync, companyId: string): WorkRecord[] {
  const rows = db
    .prepare(`SELECT * FROM works WHERE company_id = ? ORDER BY is_demo DESC, updated_at DESC`)
    .all(companyId) as WorkRow[];
  return rows.map(rowToRecord);
}

export function deleteWork(db: DatabaseSync, companyId: string, id: string): boolean {
  const row = db
    .prepare(`SELECT is_demo FROM works WHERE id = ? AND company_id = ?`)
    .get(id, companyId) as { is_demo: number } | undefined;
  if (!row || row.is_demo) return false;
  db.prepare(`DELETE FROM shares WHERE work_id = ?`).run(id);
  db.prepare(`DELETE FROM files WHERE work_id = ?`).run(id);
  db.prepare(`DELETE FROM works WHERE id = ? AND company_id = ?`).run(id, companyId);
  return true;
}

export function getUserByEmail(db: DatabaseSync, email: string): UserRow | null {
  return (
    (db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase()) as UserRow | undefined) ??
    null
  );
}

export function getUserById(db: DatabaseSync, id: string): UserRow | null {
  return (db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined) ?? null;
}

export function getSessionUser(db: DatabaseSync, token: string): UserRow | null {
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, new Date().toISOString()) as UserRow | undefined;
  return row ?? null;
}
