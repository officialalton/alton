import { describe, expect, it } from "vitest";
import { validateCurriculum } from "./validate";
import type { ApCurriculumFile } from "./types";

const base = (): ApCurriculumFile => ({
  schemaVersion: 1,
  subject: { apCode: "ap_biology", name: "AP Biology", family: "biology", edition: "ced-2027", cedVersion: "x", examYear: 2027, sourceUrl: "https://apcentral.collegeboard.org/x", officialTopicCodes: true, designNotes: "" },
  skills: [{ code: "1.A", category: "Concept Explanation", label: "describe" }],
  weights: [{ axis: "unit", code: "1", section: "mc", min: 40, max: 60, source: "CED" }, { axis: "unit", code: "2", section: "mc", min: 40, max: 60, source: "CED" }],
  units: [
    { code: "1", title: "A", officialClassPeriods: null, topics: [{ code: "1.1", title: "T1", scope: "both", skills: ["1.A"], requires: [], estLessons: 1, subKeywords: [{ code: "1.1#1", label: "K1", kind: "concept", skills: ["1.A"], requires: [], estLessons: 0.5 }] }] },
    { code: "2", title: "B", officialClassPeriods: null, topics: [{ code: "2.1", title: "T2", scope: "both", skills: [], requires: ["1.1"], estLessons: 1, subKeywords: [{ code: "2.1#1", label: "K2", kind: "skill", skills: [], requires: ["1.1#1"], estLessons: 0.5 }] }] },
  ],
});

describe("validateCurriculum", () => {
  it("accepts a well-formed file", () => expect(validateCurriculum(base())).toEqual([]));
  it("rejects forward prerequisites", () => {
    const f = base();
    f.units[0].topics[0].requires = ["2.1"];
    expect(validateCurriculum(f).join()).toMatch(/later\/self/);
  });
  it("rejects topic under the wrong unit and bad sub-keyword code", () => {
    const f = base();
    f.units[1].topics[0].code = "1.9";
    expect(validateCurriculum(f).join()).toMatch(/not under unit/);
    const g = base();
    g.units[0].topics[0].subKeywords[0].code = "1.1#2";
    expect(validateCurriculum(g).join()).toMatch(/must be 1\.1#1/);
  });
  it("rejects duplicate labels across the subject and unknown skills", () => {
    const f = base();
    f.units[1].topics[0].title = "K1";
    f.units[0].topics[0].skills = ["9.Z"];
    const out = validateCurriculum(f).join();
    expect(out).toMatch(/duplicate keyword label/);
    expect(out).toMatch(/unknown skill/);
  });
  it("rejects inconsistent unit weights", () => {
    const f = base();
    f.weights = [{ axis: "unit", code: "1", section: "mc", min: 10, max: 20, source: "CED" }];
    expect(validateCurriculum(f).join()).toMatch(/inconsistent/);
  });
});
