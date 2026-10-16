// 라운드 2 패치 테스트(순수, 저장된 읽기 스냅샷 data/audit/2026-10-13-r2-readout.json 사용). 모든 패치가 현재 공개본에 계획되고(apply), 선택지가 유일하며, 표 해설이 실제 표에서 계산한 값과 일치함을 확인한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planPatch, type Overrides, type Patch, type ProblemReadout } from "./plan";
import { rep, repN, TABLE_GIDS, tableEdit, EDITS, buildPatch } from "./r2-edits";
import { evalRow, tableExplanations } from "./table-explanations";

const ro = JSON.parse(readFileSync("data/audit/2026-10-13-r2-readout.json", "utf-8")) as { problems: ProblemReadout[] };
const patches = (JSON.parse(readFileSync("data/audit/2026-10-13-r2-patches.json", "utf-8")) as { patches: Patch[] }).patches;
const overrides = JSON.parse(readFileSync("data/audit/2026-10-13-r2-overrides.json", "utf-8")) as Overrides;
const find = (p: Patch) => ro.problems.find((r) => (p.problemId ? r.problem_id === p.problemId : r.gid === p.gid))!;

describe("round 2 patch list", () => {
  it("has the 37 expected patches with unique ids, and the JSON equals what the edit functions produce now", () => {
    expect(patches.length).toBe(EDITS.length);
    expect(new Set(patches.map((p) => p.id)).size).toBe(patches.length);
    for (const def of EDITS) {
      const pr = ro.problems.find((r) => (def.problemId ? r.problem_id === def.problemId : r.gid === def.gid))!;
      expect(buildPatch(def, pr.pub!, pr.pub!.id).patch.changes, def.id).toEqual(patches.find((p) => p.id === def.id)!.changes);
    }
  });
  it("every patch plans as 'apply' against the stored current published versions (render check, key letters, math delimiters, blank junction all pass)", () => {
    for (const p of patches) {
      const plan = planPatch(p, find(p), { overrides, now: "2026-10-13T00:00:00.000Z" });
      expect(plan.status, `${p.id}: ${plan.reasons.join(" | ")}`).toBe("apply");
      const o = plan.args!.options;
      if (o) expect(new Set(o.map((x) => x.trim().toLowerCase())).size, p.id).toBe(o.length);
    }
  });
  it("replacing it again is idempotent (already) for text patches", () => {
    const p = patches.find((x) => x.id === "R2-M25")!;
    const pr = find(p);
    const applied = { ...pr, pub: { ...pr.pub!, passage: String(p.changes[0].new) } };
    expect(planPatch(p, applied, { overrides }).status).toBe("already");
  });
  it("rep requires exactly one occurrence", () => {
    expect(() => rep("a a", "a", "b")).toThrow(/2 times/);
    expect(() => rep("a", "z", "b")).toThrow(/0 times/);
    expect(rep("a b", "b", "c")).toBe("a c");
    expect(repN("a a", "a", "b", 2)).toBe("b b");
  });
});

describe("table explanations (S-M28)", () => {
  it("computes the values from the actual tables and agrees with the stored key", () => {
    const e = tableExplanations({ kind: "sum", a: 6, b: 5, op: "<", c: 27, xv: "c", yv: "d", ineq: "6c + 5d < 27" }, [[[1, 12], [2, 7], [3, 8]], [[1, 4], [2, 3], [3, 0]], [[1, 4], [2, 1], [3, 2]], [[1, 4], [2, 1], [3, 0]]], 3);
    expect(e.correctIndex).toBe(3);
    expect(e.en).toContain("6 \\cdot 1 + 5 \\cdot 12 = 66"); expect(e.en).toContain("so the answer is D");
    expect(e.ko).toContain("정답은 D이다");
    expect(evalRow({ kind: "sum", a: 6, b: 5, op: "<", c: 27, xv: "c", yv: "d", ineq: "" }, [3, 0]).ok).toBe(true); // 18 < 27
    expect(() => tableExplanations({ kind: "sum", a: 1, b: 1, op: "<", c: 0, xv: "x", yv: "y", ineq: "x+y<0" }, [[[1, 1]], [[2, 2]]])).toThrow(/exactly one/);
  });
  it("all nine stored table items have exactly one valid table, equal to the DB key, with balanced math and no Hangul in English", () => {
    expect(TABLE_GIDS.length).toBe(9);
    for (const g of TABLE_GIDS) {
      const pr = ro.problems.find((r) => r.gid === g)!;
      const out = tableEdit(g, pr.pub!);
      expect((out.explanation_en!.match(/\$/g) ?? []).length % 2, g).toBe(0);
      expect((out.explanation!.match(/\$/g) ?? []).length % 2, g).toBe(0);
      expect(/[가-힣]/.test(out.explanation_en!), g).toBe(false);
      expect(out.explanation_en).toContain(`so the answer is ${"ABCD"[pr.pub!.correct_index!]}`);
    }
  });
});
