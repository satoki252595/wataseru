import { create } from "zustand";
import { api } from "@/lib/api";
import type { SourceKind, Usage, WorkRecord } from "./types";

interface WorksState {
  works: WorkRecord[];
  loaded: boolean;
  load: () => Promise<void>;
  upsert: (record: WorkRecord) => void;
  get: (id: string) => WorkRecord | undefined;
  createDraft: (input: {
    nameField: string;
    usage: Usage;
    source: SourceKind;
    material?: string;
  }) => Promise<WorkRecord>;
  sendMessage: (id: string, content?: string) => Promise<{
    record: WorkRecord;
    interview: { phase: "ask" | "enough" | "split" } | null;
    error?: string;
  }>;
  generate: (id: string) => Promise<{ record: WorkRecord; error?: string }>;
  fill: (id: string, answers: string) => Promise<{ record: WorkRecord; error?: string }>;
  setUsage: (id: string, usage: Usage) => Promise<void>;
  remove: (id: string) => Promise<void>;
  share: (id: string, mode: "view" | "order") => Promise<{ url: string; mode: "view" | "order" }>;
  spawnNext: (id: string) => Promise<WorkRecord>;
}

export const useWorks = create<WorksState>((set, get) => ({
  works: [],
  loaded: false,
  get: (id) => get().works.find((w) => w.id === id),
  upsert: (record) =>
    set({
      works: [record, ...get().works.filter((w) => w.id !== record.id)],
    }),
  load: async () => {
    const data = await api<{ works: WorkRecord[] }>("/api/works");
    set({ works: data.works, loaded: true });
  },
  createDraft: async (input) => {
    const data = await api<{ record: WorkRecord }>("/api/works", {
      method: "POST",
      body: JSON.stringify(input),
    });
    set({ works: [data.record, ...get().works] });
    return data.record;
  },
  sendMessage: async (id, content) => {
    const data = await api<{
      record: WorkRecord;
      interview: { phase: "ask" | "enough" | "split" } | null;
      error?: string;
    }>(`/api/works/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    get().upsert(data.record);
    return data;
  },
  generate: async (id) => {
    const data = await api<{ record: WorkRecord; error?: string }>(`/api/works/${id}/generate`, {
      method: "POST",
    });
    get().upsert(data.record);
    return data;
  },
  fill: async (id, answers) => {
    const data = await api<{ record: WorkRecord; error?: string }>(`/api/works/${id}/fill`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
    get().upsert(data.record);
    return data;
  },
  setUsage: async (id, usage) => {
    const data = await api<{ record: WorkRecord }>(`/api/works/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ usage }),
    });
    get().upsert(data.record);
  },
  remove: async (id) => {
    await api(`/api/works/${id}`, { method: "DELETE" });
    set({ works: get().works.filter((w) => w.id !== id) });
  },
  share: async (id, mode) => {
    return api<{ url: string; mode: "view" | "order" }>(`/api/works/${id}/share`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
  },
  spawnNext: async (id) => {
    const data = await api<{ record: WorkRecord }>(`/api/works/${id}/next`, { method: "POST" });
    set({ works: [data.record, ...get().works] });
    return data.record;
  },
}));
