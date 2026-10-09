import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SAT_DOMAINS, SKILL_CODES, inferDomainFromLegacy, skillsForDomain } from "./problem-taxonomy";

// 분류 원본은 DB(problem_skill_codes, 20261367). 화면 사본이 어긋나면 필터·배지가 거짓말을 하므로 같은지 확인한다.
describe("문제 분류 — TS 사본과 마이그레이션 시드가 같다", () => {
  const sql = readFileSync("supabase/migrations/20261367000000_p3_problem_taxonomy.sql", "utf-8");
  it("모든 기술 코드가 시드에 같은 영역·라벨로 있다", () => {
    for (const k of SKILL_CODES) {
      const re = new RegExp(`\\('${k.code}','${k.domain}','${k.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}',\\d+\\)`);
      expect(sql, k.code).toMatch(re);
    }
    const seeded = Array.from(sql.matchAll(/\('([a-z_]+)','(rw_)?[a-z_]+','/g)).map((m) => m[1]);
    expect(new Set(seeded).size).toBe(SKILL_CODES.length);
  });
  it("영역 코드가 시드의 check 목록과 같다", () => {
    for (const d of SAT_DOMAINS) expect(sql).toContain(`'${d.code}'`);
    expect(skillsForDomain("problem_solving_data").map((k) => k.code)).toContain("probability");
  });
  it("옛 유형 라벨에서 영역을 추정한다(세부 기술은 추정하지 않는다)", () => {
    expect(inferDomainFromLegacy("Geometry and Trigonometry")).toBe("geometry_trig");
    expect(inferDomainFromLegacy("Advanced Math (이차·지수·다항)")).toBe("advanced_math");
    expect(inferDomainFromLegacy("Words in Context")).toBe("rw_craft_structure");
    expect(inferDomainFromLegacy("random text")).toBeNull();
  });
});
