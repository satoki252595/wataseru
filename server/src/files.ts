import { mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { newId, nowIso } from "@wataseru/shared";
import { env } from "./env";
import type { FileRow } from "./db";

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function looksAllowed(name: string, mime: string): boolean {
  const ext = extname(name).toLowerCase();
  if (ALLOWED.has(mime)) return true;
  return [".pdf", ".xlsx", ".xls", ".txt", ".csv", ".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(
    ext,
  );
}

export async function extractText(bytes: Uint8Array, mime: string, name: string): Promise<string> {
  const ext = extname(name).toLowerCase();
  if (mime.startsWith("text/") || ext === ".txt" || ext === ".csv") {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 80_000);
  }
  if (ext === ".xlsx" || mime.includes("spreadsheet")) {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(bytes, { type: "buffer" });
      const parts: string[] = [];
      for (const sheet of wb.SheetNames.slice(0, 6)) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet] ?? {});
        if (csv.trim()) parts.push(`# ${sheet}\n${csv}`);
      }
      return parts.join("\n\n").slice(0, 80_000);
    } catch {
      return "";
    }
  }
  return "";
}

export async function saveUpload(
  db: DatabaseSync,
  input: {
    companyId: string;
    workId: string | null;
    filename: string;
    mime: string;
    bytes: Uint8Array;
  },
): Promise<FileRow> {
  if (!looksAllowed(input.filename, input.mime)) {
    throw Object.assign(new Error("PDF / xlsx / 画像 / テキストのみです"), { status: 400 });
  }
  mkdirSync(env.uploadDir, { recursive: true });
  const id = newId("file");
  const ext = extname(input.filename).toLowerCase() || ".bin";
  const rel = `${input.companyId}/${id}${ext}`;
  const abs = join(env.uploadDir, rel);
  mkdirSync(join(env.uploadDir, input.companyId), { recursive: true });
  writeFileSync(abs, input.bytes);
  const extracted = await extractText(input.bytes, input.mime, input.filename);
  const t = nowIso();
  db.prepare(
    `INSERT INTO files (id, company_id, work_id, original_name, mime, path, extracted_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.companyId, input.workId, input.filename, input.mime, rel, extracted, t);
  return {
    id,
    company_id: input.companyId,
    work_id: input.workId,
    original_name: input.filename,
    mime: input.mime,
    path: rel,
    extracted_text: extracted,
    created_at: t,
  };
}
