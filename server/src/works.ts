import type { DatabaseSync } from "node:sqlite";
import {
  applyGeneratedWork,
  ensureExpertNote,
  makeDraftRecord,
  makeMessage,
  newId,
  nowIso,
  scrubWorkDeep,
  USAGE_LABEL,
  type SourceKind,
  type Usage,
  type WorkRecord,
} from "@wataseru/shared";
import { deleteWork, getWork, listWorks, saveWork } from "./db";
import { llmAvailable, runDecompose, runInterview, runQaLlm, type InterviewResult } from "./llm";

const OPENING =
  "ワタセルを開始します。頭の中の仕事を、他人に渡せる言葉にします。\n\n今回、渡したい仕事を現場の呼び方で1つください。";

const FALLBACK_ASK = "一番ふつうの1件を、最初の操作から話してください。書いてください。";

function withExpertNotes(record: WorkRecord): WorkRecord {
  const artifacts = { ...record.artifacts };
  for (const key of Object.keys(artifacts) as (keyof typeof artifacts)[]) {
    artifacts[key] = ensureExpertNote(artifacts[key]);
  }
  return { ...record, artifacts };
}

function appendLogMetrics(record: WorkRecord): WorkRecord {
  const first = record.confirmCountFirst;
  const now = record.confirmCount;
  const line = [
    `計測：初稿の要確認 ${first}（目標12以下）`,
    `改訂後の要確認 ${now}（目標3以下）`,
  ].join("\n");
  const log = record.artifacts.log.includes("計測：")
    ? record.artifacts.log
    : `${record.artifacts.log}\n\n${line}`.trim();
  return { ...record, artifacts: { ...record.artifacts, log } };
}

function formatInterview(data: InterviewResult): string {
  const q = data.questions.length ? "\n\n" + data.questions.map((x) => "・" + x).join("\n") : "";
  const split = data.split_proposal?.length
    ? "\n\n今回は次の1つに切ります。\n" + data.split_proposal.map((x) => "・" + x).join("\n")
    : "";
  return `${data.say}${q}${split}`;
}

export function createDraft(
  db: DatabaseSync,
  companyId: string,
  input: { nameField: string; usage?: Usage; source?: SourceKind; material?: string },
): WorkRecord {
  const record = makeDraftRecord({
    id: newId("work"),
    nameField: input.nameField,
    usage: input.usage ?? "organize",
    source: input.source ?? "talk",
    material: input.material,
  });
  const trimmed = input.nameField.trim();
  if (trimmed) {
    record.messages.push(makeMessage("user", `現場の呼び方：${trimmed}`));
  } else {
    record.messages.push(makeMessage("assistant", OPENING));
  }
  if (input.material?.trim()) {
    record.source = input.source ?? "memo";
    record.messages.push(makeMessage("user", input.material.trim()));
  }
  saveWork(db, companyId, record);
  return record;
}

export async function interviewOnce(
  db: DatabaseSync,
  companyId: string,
  workId: string,
  userContent?: string,
): Promise<{ record: WorkRecord; interview: InterviewResult | null; error?: string }> {
  const rec = getWork(db, companyId, workId);
  if (!rec) throw Object.assign(new Error("見つかりません"), { status: 404 });
  if (rec.isDemo) throw Object.assign(new Error("デモは取材できません"), { status: 400 });

  if (userContent?.trim()) {
    rec.messages.push(makeMessage("user", userContent.trim()));
    rec.updatedAt = nowIso();
  }

  const history = rec.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  if (!llmAvailable()) {
    rec.messages.push(makeMessage("assistant", FALLBACK_ASK));
    saveWork(db, companyId, rec);
    return { record: rec, interview: null, error: "書いてください" };
  }

  const result = await runInterview({
    usageLabel: USAGE_LABEL[rec.usage],
    nameField: rec.work.name_field,
    history,
  });

  if (!result.ok) {
    rec.messages.push(makeMessage("assistant", FALLBACK_ASK));
    saveWork(db, companyId, rec);
    return { record: rec, interview: null, error: result.error };
  }

  rec.messages.push(makeMessage("assistant", formatInterview(result.data)));
  rec.updatedAt = nowIso();
  saveWork(db, companyId, rec);
  return { record: rec, interview: result.data };
}

export async function generateWork(
  db: DatabaseSync,
  companyId: string,
  workId: string,
): Promise<{ record: WorkRecord; error?: string }> {
  const rec = getWork(db, companyId, workId);
  if (!rec) throw Object.assign(new Error("見つかりません"), { status: 404 });
  if (rec.isDemo) return { record: rec };

  const transcript = rec.messages
    .map((m) => `${m.role === "user" ? "社長" : "ワタセル"}: ${m.content}`)
    .join("\n\n");

  if (!llmAvailable()) {
    rec.messages.push(
      makeMessage(
        "assistant",
        "下書きに進めませんでした。もう一度「出す」を押すか、足りない点を足してください。",
      ),
    );
    saveWork(db, companyId, rec);
    return { record: rec, error: "書いてください" };
  }

  const result = await runDecompose({
    usageLabel: USAGE_LABEL[rec.usage],
    nameField: rec.work.name_field,
    transcript,
  });
  if (!result.ok) {
    rec.messages.push(
      makeMessage(
        "assistant",
        "下書きに進めませんでした。もう一度「出す」を押すか、足りない点を足してください。",
      ),
    );
    saveWork(db, companyId, rec);
    return { record: rec, error: result.error };
  }

  let work = scrubWorkDeep({ ...result.data, work_id: rec.id });
  let next = withExpertNotes(applyGeneratedWork(rec, work, transcript, rec.confirmCountFirst === 0));

  if (next.qaNotes && llmAvailable()) {
    const qa = await runQaLlm({ work: next.work, notes: next.qaNotes.split("\n").filter(Boolean) });
    if (qa.ok && (qa.data.patch || qa.data.notes.length)) {
      const fix = await runDecompose({
        usageLabel: USAGE_LABEL[rec.usage],
        nameField: rec.work.name_field,
        transcript,
        existing: next.work,
        fillAnswers: `QA指摘を直す：\n${qa.data.notes.join("\n")}\n${qa.data.patch ?? ""}`,
      });
      if (fix.ok) {
        work = scrubWorkDeep({ ...fix.data, work_id: rec.id });
        next = withExpertNotes(applyGeneratedWork(next, work, transcript, false));
      }
    }
  }

  next = appendLogMetrics(next);
  saveWork(db, companyId, next);
  return { record: next };
}

export async function fillWork(
  db: DatabaseSync,
  companyId: string,
  workId: string,
  answers: string,
): Promise<{ record: WorkRecord; error?: string }> {
  const rec = getWork(db, companyId, workId);
  if (!rec) throw Object.assign(new Error("見つかりません"), { status: 404 });
  if (rec.isDemo) throw Object.assign(new Error("デモは変更できません"), { status: 400 });

  const transcript = rec.messages
    .map((m) => `${m.role === "user" ? "社長" : "ワタセル"}: ${m.content}`)
    .join("\n\n");

  if (!llmAvailable()) return { record: rec, error: "書いてください" };

  const result = await runDecompose({
    usageLabel: USAGE_LABEL[rec.usage],
    nameField: rec.work.name_field,
    transcript,
    existing: rec.work,
    fillAnswers: answers,
  });
  if (!result.ok) return { record: rec, error: result.error };

  const work = scrubWorkDeep({ ...result.data, work_id: rec.id });
  let next = withExpertNotes(applyGeneratedWork(rec, work, rec.artifacts.log, false));
  next = appendLogMetrics(next);
  saveWork(db, companyId, next);
  return { record: next };
}

export function setUsage(
  db: DatabaseSync,
  companyId: string,
  workId: string,
  usage: Usage,
): WorkRecord {
  const rec = getWork(db, companyId, workId);
  if (!rec) throw Object.assign(new Error("見つかりません"), { status: 404 });
  rec.usage = usage;
  rec.updatedAt = nowIso();
  saveWork(db, companyId, rec);
  return rec;
}

export function removeWork(db: DatabaseSync, companyId: string, workId: string) {
  const rec = getWork(db, companyId, workId);
  if (!rec) throw Object.assign(new Error("見つかりません"), { status: 404 });
  if (rec.isDemo) throw Object.assign(new Error("デモは削除できません"), { status: 400 });
  deleteWork(db, companyId, workId);
}

export function spawnNext(
  db: DatabaseSync,
  companyId: string,
  workId: string,
): WorkRecord {
  const rec = getWork(db, companyId, workId);
  if (!rec) throw Object.assign(new Error("見つかりません"), { status: 404 });
  const name = rec.work.next_work?.trim();
  if (!name) throw Object.assign(new Error("次の業務がありません"), { status: 400 });
  return createDraft(db, companyId, {
    nameField: name.split(/[、,／/]/)[0]?.trim() || name,
    usage: rec.usage,
    source: "talk",
  });
}

export function companyWorks(db: DatabaseSync, companyId: string): WorkRecord[] {
  return listWorks(db, companyId);
}

export function createShare(
  db: DatabaseSync,
  companyId: string,
  workId: string,
  mode: "view" | "order",
): { token: string; mode: "view" | "order" } {
  const rec = getWork(db, companyId, workId);
  if (!rec) throw Object.assign(new Error("見つかりません"), { status: 404 });
  const token = newId("share");
  db.prepare(
    `INSERT INTO shares (id, work_id, company_id, token, mode, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(newId("sh"), rec.id, companyId, token, mode, nowIso());
  return { token, mode };
}
