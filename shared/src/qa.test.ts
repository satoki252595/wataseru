import { describe, expect, it } from "vitest";
import { makeDemoRecord } from "./record";
import { runQa, statusFromQa } from "./qa";
import { scrubText } from "./sanitize";
import { emptyArtifacts, emptyWork } from "./types";
import { DEMO_WORK } from "./demo";
import { renderAll } from "./templates";

describe("qa", () => {
  it("marks the demo ready", () => {
    const demo = makeDemoRecord("demo_x");
    expect(demo.status).toBe("ready");
    expect(demo.confirmCount).toBe(0);
    expect(demo.work.name_field).toBe("請求まわす");
    const artifacts = renderAll(DEMO_WORK, "log");
    const qa = runQa(DEMO_WORK, artifacts);
    expect(qa.notes.length).toBeGreaterThanOrEqual(0);
    expect(statusFromQa({ ...qa, confirmCount: 0, notes: [] })).toBe("ready");
  });

  it("keeps holes visible on an empty draft", () => {
    const work = emptyWork({ work_id: "x" });
    const artifacts = emptyArtifacts();
    artifacts.card = "担当：[要確認]";
    const qa = runQa(work, artifacts);
    expect(qa.confirmCount).toBeGreaterThan(0);
    expect(statusFromQa(qa)).not.toBe("ready");
  });
});

describe("sanitize", () => {
  it("drops individual wages and medical history", () => {
    expect(scrubText("月給：32万円")).toContain("賃金個別額は記載しない");
    expect(scrubText("病歴：高血圧")).toContain("病歴は記載しない");
  });
});
