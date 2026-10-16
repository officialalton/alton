// 라운드 2(D5): DB 에 없던 R-*/D-* 문항의 저장소 원본이 깨끗한지(다시 임포트해도 결함이 되살아나지 않는지) + 은행 게이트(빈칸 이음새)가 옛 지문을 실제로 거절하는지 확인한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blankJunctionIssues } from "../problem-blank-junction";
import { dedupeStem, draftBankGateError } from "../problem-text-guards";
import { STOCK_ONLY_PATCH_IDS } from "../../scripts/audit/apply-patches-to-stock";

type Rec = { gid: string; examSystem: string; problem: { passage?: string; stimulus?: string; question?: string; options?: string[] } };
const FILE = "data/mock-exam-generation/mockgen-20260929/acceptance/import-general.json";
const recs = JSON.parse(readFileSync(FILE, "utf-8")) as Rec[];
const patches = (JSON.parse(readFileSync("data/audit/2026-10-13-sat-patch-list.json", "utf-8")) as { patches: { id: string; changes: { field: string; old?: string; new?: string }[] }[] }).patches;
const gidOf = (id: string) => (id.startsWith("R-") ? id.slice(2) : patches.find((p) => p.id === id) && recs.find((r) => r.problem.passage === patches.find((p) => p.id === id)!.changes[0].new)?.gid);

describe("stock originals of the stock-only audit patches", () => {
  it("every stock-only patch has its new passage in the stock file (and the old one is gone)", () => {
    for (const id of STOCK_ONLY_PATCH_IDS) {
      const p = patches.find((x) => x.id === id)!;
      const ch = p.changes.find((c) => c.field === "passage")!;
      const r = recs.find((x) => x.problem.stimulus === ch.new);
      expect(r, id).toBeTruthy();
      expect(r!.problem.stimulus, id).toBe(ch.new);
      expect(recs.some((x) => x.problem.stimulus === ch.old), id).toBe(false);
    }
  });
  it("R-* originals have no blank junction defect and pass the bank gate", () => {
    for (const id of STOCK_ONLY_PATCH_IDS.filter((x) => x.startsWith("R-"))) {
      const r = recs.find((x) => x.gid === gidOf(id))!;
      expect(r, id).toBeTruthy();
      expect(blankJunctionIssues(r.problem.stimulus!, r.problem.options!), id).toEqual([]);
      expect(draftBankGateError({ examSystem: r.examSystem, usageScope: null, passage: r.problem.stimulus, question: r.problem.question, options: r.problem.options }), id).toBeNull();
    }
  });
  it("D-* originals no longer repeat the question inside the stimulus", () => {
    for (const id of STOCK_ONLY_PATCH_IDS.filter((x) => x.startsWith("D-"))) {
      const ch = patches.find((x) => x.id === id)!.changes[0];
      const r = recs.find((x) => x.problem.stimulus === ch.new)!;
      expect(dedupeStem(r.problem.stimulus, r.problem.question), id).toBe(r.problem.stimulus!.trim());
    }
  });
  it("the gate rejects the pre-fix R-* passages (these are the defects that were imported)", () => {
    for (const id of STOCK_ONLY_PATCH_IDS.filter((x) => x.startsWith("R-"))) {
      const p = patches.find((x) => x.id === id)!;
      const r = recs.find((x) => x.gid === gidOf(id))!;
      const old = p.changes.find((c) => c.field === "passage")!.old!;
      expect(draftBankGateError({ examSystem: "sat_rw", usageScope: null, passage: old, question: r.problem.question, options: r.problem.options }), id).toMatch(/빈칸 뒤 지문이 선택지와 겹쳐/);
    }
  });
});
