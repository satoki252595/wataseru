import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { openDb } from "./db";

function cookieFrom(res: Response): string {
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") {
    return getSetCookie.call(res.headers).join("; ");
  }
  return res.headers.get("set-cookie") ?? "";
}

function sessionHeader(res: Response): Record<string, string> {
  const raw = cookieFrom(res);
  const m = raw.match(/wataseru_session=[^;]+/);
  return m ? { cookie: m[0] } : {};
}

describe("wataseru api", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  function app() {
    const dir = mkdtempSync(join(tmpdir(), "wataseru-"));
    dirs.push(dir);
    return createApp(openDb(join(dir, "t.db")));
  }

  it("registers, seeds demo, and isolates tenants", async () => {
    const hono = app();
    const a = await hono.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyName: "A社",
        email: "a@example.com",
        password: "password1",
        name: "A",
      }),
    });
    expect(a.status).toBe(200);
    const aCookie = sessionHeader(a);

    const b = await hono.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyName: "B社",
        email: "b@example.com",
        password: "password1",
        name: "B",
      }),
    });
    const bCookie = sessionHeader(b);

    const created = await hono.request("/api/works", {
      method: "POST",
      headers: { "content-type": "application/json", ...aCookie },
      body: JSON.stringify({ nameField: "上がり写真", usage: "organize", source: "talk" }),
    });
    expect(created.status).toBe(200);
    const work = (await created.json()) as { record: { id: string; work: { name_field: string } } };
    expect(work.record.work.name_field).toBe("上がり写真");

    const listA = (await (
      await hono.request("/api/works", { headers: aCookie })
    ).json()) as { works: { work: { name_field: string }; isDemo: boolean }[] };
    expect(listA.works.some((w) => w.isDemo)).toBe(true);
    expect(listA.works.some((w) => w.work.name_field === "上がり写真")).toBe(true);

    const listB = (await (
      await hono.request("/api/works", { headers: bCookie })
    ).json()) as { works: { id: string }[] };
    expect(listB.works.some((w) => w.id === work.record.id)).toBe(false);

    const sneak = await hono.request(`/api/works/${work.record.id}`, { headers: bCookie });
    expect(sneak.status).toBe(404);
  });

  it("does not delete the demo work", async () => {
    const hono = app();
    const a = await hono.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "demo@example.com",
        password: "password1",
        companyName: "デモ社",
      }),
    });
    const cookie = sessionHeader(a);
    const list = (await (await hono.request("/api/works", { headers: cookie })).json()) as {
      works: { id: string; isDemo: boolean }[];
    };
    const demo = list.works.find((w) => w.isDemo)!;
    const del = await hono.request(`/api/works/${demo.id}`, { method: "DELETE", headers: cookie });
    expect(del.status).toBe(400);
  });

  it("creates a view share link without login", async () => {
    const hono = app();
    const a = await hono.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "share@example.com",
        password: "password1",
        companyName: "共有社",
      }),
    });
    const cookie = sessionHeader(a);
    const list = (await (await hono.request("/api/works", { headers: cookie })).json()) as {
      works: { id: string }[];
    };
    const id = list.works[0]!.id;
    const shared = await hono.request(`/api/works/${id}/share`, {
      method: "POST",
      headers: { "content-type": "application/json", ...cookie },
      body: JSON.stringify({ mode: "order" }),
    });
    expect(shared.status).toBe(200);
    const body = (await shared.json()) as { token: string; url: string };
    const open = await hono.request(`/api/share/${body.token}`);
    expect(open.status).toBe(200);
    const page = (await open.json()) as { mode: string; record: { artifacts: { order: string; card: string } } };
    expect(page.mode).toBe("order");
    expect(page.record.artifacts.order.length).toBeGreaterThan(10);
    expect(page.record.artifacts.card).toBe("");
  });

  it("keeps interview open when LLM is missing", async () => {
    const hono = app();
    const a = await hono.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "talk@example.com",
        password: "password1",
        companyName: "取材社",
      }),
    });
    const cookie = sessionHeader(a);
    const created = await hono.request("/api/works", {
      method: "POST",
      headers: { "content-type": "application/json", ...cookie },
      body: JSON.stringify({ nameField: "日報", usage: "onboarding", source: "talk" }),
    });
    const { record } = (await created.json()) as { record: { id: string } };
    const msg = await hono.request(`/api/works/${record.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", ...cookie },
      body: JSON.stringify({ content: "毎朝LINEで写真が来る" }),
    });
    expect(msg.status).toBe(200);
    const out = (await msg.json()) as { record: { messages: { role: string; content: string }[] }; error?: string };
    expect(out.error).toBeTruthy();
    expect(out.record.messages.some((m) => m.content.includes("書いてください"))).toBe(true);
  });
});
