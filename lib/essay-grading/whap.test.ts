import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveRubric, WHAP_RUBRIC_ID } from "./rubric";
import { toEssayPayload } from "./payload";
import { essayGradingSubject } from "./subject";
import { parseEssayContext } from "./context";

describe("whap-v1 essay rubric", () => {
  it("resolves SAQ 3 / DBQ 7 / LEQ 6 points with World History wording", () => {
    expect([resolveRubric(WHAP_RUBRIC_ID, "saq")!.total, resolveRubric(WHAP_RUBRIC_ID, "dbq")!.total, resolveRubric(WHAP_RUBRIC_ID, "leq")!.total]).toEqual([3, 7, 6]);
    expect(resolveRubric(WHAP_RUBRIC_ID, "dbq")!.head[0]).toContain("World History"); expect(resolveRubric(WHAP_RUBRIC_ID)).toBeNull(); expect(essayGradingSubject("ap_world_history")).toBe(true);
  });
  it("reads payload.whap_frq (schema whap-frq-1) into the grader context with the whap-v1 rubric", () => {
    const items = JSON.parse(readFileSync("data/ap/stock/wh-f1-items.json", "utf-8")) as { payload: Record<string, unknown> }[];
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) { const p = toEssayPayload(it.payload) as { rubricId: string; taskType: string; samples: unknown[] } | null; expect(p).not.toBeNull(); expect(p!.rubricId).toBe("whap-v1"); expect(p!.samples.length).toBe(3); const ctx = parseEssayContext(p, "A"); expect(ctx?.rubricId).toBe("whap-v1"); }
    expect(toEssayPayload({ whap_frq: { schema_version: "ush-frq-1", task_type: "saq", prompt: { task: "x" } } })).toBeNull();
  });
});
