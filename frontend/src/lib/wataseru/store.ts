import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { DEMO_LOG, DEMO_WORK } from "./demo";
import { runQa, statusFromQa } from "./qa";
import { renderAll } from "./templates";
import type {
  ChatMessage,
  SourceKind,
  Usage,
  WorkObject,
  WorkRecord,
} from "./types";
import { emptyWork } from "./types";

const DEMO_ID = "demo_seikyu_mawasu";

function makeDemo(): WorkRecord {
  const artifacts = renderAll(DEMO_WORK, DEMO_LOG);
  const qa = runQa(DEMO_WORK, artifacts);
  return {
    id: DEMO_ID,
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
    usage: "outsource",
    source: "memo",
    status: "ready",
    work: DEMO_WORK,
    artifacts,
    messages: [
      {
        id: "m0",
        role: "assistant",
        content:
          "デモです。施工店の「請求まわす」を、他人に渡せる言葉にした完成例です。数字は架空なので事実扱いしないでください。",
        at: "2026-09-11T00:00:00.000Z",
      },
    ],
    qaNotes: qa.notes.join("\n"),
    confirmCount: qa.confirmCount,
  };
}

interface WorksState {
  works: WorkRecord[];
  ensureDemo: () => void;
  upsert: (record: WorkRecord) => void;
  remove: (id: string) => void;
  get: (id: string) => WorkRecord | undefined;
  createDraft: (input: {
    nameField: string;
    usage: Usage;
    source: SourceKind;
    material?: string;
  }) => WorkRecord;
  appendMessage: (id: string, msg: Omit<ChatMessage, "id" | "at">) => void;
  applyWork: (id: string, work: WorkObject, log?: string) => void;
  setUsage: (id: string, usage: Usage) => void;
}

export const useWorks = create<WorksState>()(
  persist(
    (set, get) => ({
      works: [makeDemo()],
      ensureDemo: () => {
        const has = get().works.some((w) => w.id === DEMO_ID);
        if (!has) set({ works: [makeDemo(), ...get().works] });
      },
      get: (id) => get().works.find((w) => w.id === id),
      upsert: (record) =>
        set({
          works: [record, ...get().works.filter((w) => w.id !== record.id)],
        }),
      remove: (id) => {
        if (id === DEMO_ID) return;
        set({ works: get().works.filter((w) => w.id !== id) });
      },
      createDraft: ({ nameField, usage, source, material }) => {
        const id = uid("work");
        const now = new Date().toISOString();
        const work = emptyWork({
          work_id: id,
          name_field: nameField.trim() || "[要確認]",
          name_official: nameField.trim() || "[要確認]",
        });
        const artifacts = renderAll(work, material ? `素材：\n${material}` : "");
        const record: WorkRecord = {
          id,
          createdAt: now,
          updatedAt: now,
          usage,
          source,
          status: "draft",
          work,
          artifacts,
          messages: [],
          qaNotes: "",
          confirmCount: 0,
        };
        set({ works: [record, ...get().works] });
        return record;
      },
      appendMessage: (id, msg) => {
        const rec = get().works.find((w) => w.id === id);
        if (!rec) return;
        const next: WorkRecord = {
          ...rec,
          updatedAt: new Date().toISOString(),
          messages: [
            ...rec.messages,
            {
              id: uid("m"),
              at: new Date().toISOString(),
              ...msg,
            },
          ],
        };
        set({
          works: get().works.map((w) => (w.id === id ? next : w)),
        });
      },
      applyWork: (id, work, log) => {
        const rec = get().works.find((w) => w.id === id);
        if (!rec) return;
        const artifacts = renderAll(work, log ?? rec.artifacts.log);
        const qa = runQa(work, artifacts);
        const next: WorkRecord = {
          ...rec,
          work,
          artifacts,
          updatedAt: new Date().toISOString(),
          status: statusFromQa(qa),
          qaNotes: qa.notes.join("\n"),
          confirmCount: qa.confirmCount,
        };
        set({
          works: get().works.map((w) => (w.id === id ? next : w)),
        });
      },
      setUsage: (id, usage) => {
        const rec = get().works.find((w) => w.id === id);
        if (!rec) return;
        set({
          works: get().works.map((w) =>
            w.id === id ? { ...w, usage, updatedAt: new Date().toISOString() } : w,
          ),
        });
      },
    }),
    {
      name: "wataseru-works-v1",
      skipHydration: true,
      partialize: (s) => ({ works: s.works }),
    },
  ),
);

export { DEMO_ID };
