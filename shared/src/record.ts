import { DEMO_LOG, DEMO_WORK } from "./demo";
import { runQa, statusFromQa } from "./qa";
import { renderAll } from "./templates";
import type { Artifacts, ChatMessage, SourceKind, Usage, WorkObject, WorkRecord } from "./types";
import { emptyArtifacts, emptyWork } from "./types";

export const DEMO_FIELD_NAME = "請求まわす";

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = "id"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function makeMessage(
  role: ChatMessage["role"],
  content: string,
  at = nowIso(),
): ChatMessage {
  return { id: newId("m"), role, content, at };
}

export function makeDemoRecord(id: string, createdAt = "2026-09-11T00:00:00.000Z"): WorkRecord {
  const artifacts = renderAll(DEMO_WORK, DEMO_LOG);
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    usage: "outsource",
    source: "memo",
    status: "ready",
    work: { ...DEMO_WORK, work_id: id },
    artifacts,
    messages: [
      makeMessage(
        "assistant",
        "デモです。施工店の「請求まわす」を、他人に渡せる言葉にした完成例です。数字は架空なので事実扱いしないでください。",
        createdAt,
      ),
    ],
    qaNotes: "",
    confirmCount: 0,
    confirmCountFirst: 0,
    isDemo: true,
  };
}

export function makeDraftRecord(input: {
  id: string;
  nameField: string;
  usage: Usage;
  source: SourceKind;
  material?: string;
}): WorkRecord {
  const t = nowIso();
  const name = input.nameField.trim() || "[要確認]";
  const work = emptyWork({
    work_id: input.id,
    name_field: name,
    name_official: name,
  });
  const log = input.material ? `素材：\n${input.material}` : "";
  return {
    id: input.id,
    createdAt: t,
    updatedAt: t,
    usage: input.usage,
    source: input.source,
    status: "draft",
    work,
    artifacts: renderAll(work, log),
    messages: [],
    qaNotes: "",
    confirmCount: 0,
    confirmCountFirst: 0,
    isDemo: false,
  };
}

export function applyGeneratedWork(
  record: WorkRecord,
  work: WorkObject,
  log: string,
  firstDraft = false,
): WorkRecord {
  const artifacts: Artifacts = renderAll(work, log || record.artifacts.log);
  const qa = runQa(work, artifacts);
  const confirmCountFirst = firstDraft
    ? qa.confirmCount
    : record.confirmCountFirst || qa.confirmCount;
  return {
    ...record,
    work: { ...work, work_id: record.id },
    artifacts,
    updatedAt: nowIso(),
    status: statusFromQa(qa),
    qaNotes: qa.notes.join("\n"),
    confirmCount: qa.confirmCount,
    confirmCountFirst,
  };
}

export function emptyRecordArtifacts(): Artifacts {
  return emptyArtifacts();
}

export function transcriptOf(record: WorkRecord): string {
  return record.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role === "user" ? "社長" : "ワタセル"}: ${m.content}`)
    .join("\n\n");
}
