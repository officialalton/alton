import { describe, expect, it } from "vitest";
import { SAT_KEYWORDS, satKeywordsFor, satKeywordDomainLabel } from "./taxonomy";

describe("SAT 키워드 사전", () => {
  it("30개 = Math 19 + R&W 11", () => {
    expect(SAT_KEYWORDS).toHaveLength(30);
    expect(satKeywordsFor("sat_math")).toHaveLength(19);
    expect(satKeywordsFor("sat_rw")).toHaveLength(11);
  });
  it("과목 안에서 label·skillCode 가 유일하다", () => {
    for (const sys of ["sat_math", "sat_rw"] as const) {
      const ks = satKeywordsFor(sys);
      expect(new Set(ks.map((k) => k.label.trim().toLowerCase())).size).toBe(ks.length);
      expect(new Set(ks.map((k) => k.skillCode)).size).toBe(ks.length);
    }
  });
  it("도메인·과목명이 맞다", () => {
    const wic = SAT_KEYWORDS.find((k) => k.skillCode === "words_in_context")!;
    expect(wic).toMatchObject({ examSystem: "sat_rw", subjectName: "SAT Reading & Writing", domainCode: "rw_craft_structure", domainLabel: "Craft and Structure", label: "Words in Context" });
    expect(satKeywordsFor("sat_math").every((k) => k.subjectName === "SAT Math" && !k.domainCode.startsWith("rw_"))).toBe(true);
    expect(satKeywordDomainLabel("circles")).toBe("Geometry and Trigonometry");
    expect(satKeywordDomainLabel(null)).toBeNull();
  });
});
