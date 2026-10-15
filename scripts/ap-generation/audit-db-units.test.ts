import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditUnitSnapshot, type UnitRow } from "./audit-db-units";
import { STOCK_FILES } from "./keys-file";

describe("DB-unit audit", () => {
  it("flags a set whose DB unit counts leave the absolute bounds, passes a balanced one, and skips subjects without a rule", () => {
    const row = (id: string, subject: string, unit: string, n: number): UnitRow => ({ id, name: id, ap_subject: subject, version_no: 1, unit, n });
    const ok = [["1", 3], ["2", 4], ["3", 8], ["4", 7], ["5", 8], ["6", 7], ["7", 8], ["8", 7], ["9", 3]].map(([u, n]) => row("ok", "ap_us_history", String(u), Number(n)));
    const bad = ok.map((r) => ({ ...r, id: "bad", n: r.unit === "3" ? 12 : r.unit === "4" ? 3 : r.n }));
    const res = auditUnitSnapshot([...ok, ...bad, row("ela", "ap_english_language", "1", 5)]);
    expect(res.find((r) => r.id === "ok")!.violations).toEqual([]);
    expect(res.find((r) => r.id === "bad")!.violations).toEqual(expect.arrayContaining(["unit 3: 12 > max 10", "unit 4: 3 < min 5"]));
    expect(res.find((r) => r.id === "ela")).toMatchObject({ noRule: true, violations: [] });
  });
  it("the published snapshot of 2026-10-15 has no rule-bearing set outside the absolute bounds", () => {
    const rows = JSON.parse(readFileSync("data/ap/audits/db-unit-snapshot-2026-10-15.json", "utf-8")) as UnitRow[];
    expect(auditUnitSnapshot(rows).filter((r) => r.violations.length)).toEqual([]);
  });
  // 배정기·검증기는 문항별 토픽 단원(payload.items[].topic)으로, 관리자 점검은 후보 keyword_code 단원으로 센다. 두 값이 어긋난 세트가 재고에 생기면 그 과목 배정기도 keyUnit 제약이 필요하다(US History 처럼).
  it("in every unit-bounded subject except US History, each shared set's item topic units equal its candidate keyword_code unit", () => {
    const seen = new Set<string>(); const mism: string[] = [];
    for (const f of STOCK_FILES) {
      const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue;
      for (const r of JSON.parse(readFileSync(p, "utf-8")) as { stockKey: string; apSubjectCode: string; kind: string; validation: string; keywordCode: string; payload: { items?: { topic?: string }[] } }[]) {
        if (seen.has(r.stockKey) || r.kind !== "mc" || r.validation !== "auto_passed" || !Array.isArray(r.payload.items)) continue; seen.add(r.stockKey);
        if (!["ap_biology", "ap_chemistry", "ap_physics_1", "ap_psychology", "ap_statistics", "ap_computer_science_a"].includes(r.apSubjectCode)) continue;
        const ku = r.keywordCode.split(".")[0];
        if (r.payload.items.some((i) => String(i.topic).split(".")[0] !== ku)) mism.push(`${r.apSubjectCode}:${r.stockKey}`);
      }
    }
    expect(mism).toEqual([]);
  });
});
