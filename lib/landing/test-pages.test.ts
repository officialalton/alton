import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => { throw new Error("no db"); } }));

import { getAllPublicTestPaths, getPublicTests, setsForSubject, summarizeComposition, testSlug } from "./test-pages";

describe("test pages data", () => {
  it("slugifies set names", () => {
    expect(testSlug("SAT Practice Test 1")).toBe("sat-practice-test-1");
    expect(testSlug("AP Calculus AB — Full Exam #2")).toBe("ap-calculus-ab-full-exam-2");
    expect(testSlug("***")).toBe("");
  });
  it("groups by subject, dedupes slugs, natural-sorts", () => {
    const rows = [
      { id: "a", name: "SAT Practice Test 10", exam_program: "sat", ap_subject: null },
      { id: "b", name: "SAT Practice Test 2", exam_program: null, ap_subject: null },
      { id: "c", name: "SAT Practice Test 2", exam_program: "sat", ap_subject: null },
      { id: "d", name: "AP Statistics Test 1", exam_program: "ap", ap_subject: "ap_statistics" },
      { id: "e", name: null, exam_program: "sat", ap_subject: null },
    ];
    expect(setsForSubject(rows, "sat").map((t) => t.slug)).toEqual(["sat-practice-test-2", "sat-practice-test-10"]);
    expect(setsForSubject(rows, "ap_statistics")).toHaveLength(1);
  });
  it("summarizes SAT and AP composition without question text", () => {
    const sat = summarizeComposition([
      { section: "rw", sat_domain: "rw_craft_structure", difficulty: "easy" },
      { section: "rw", sat_domain: "rw_craft_structure", difficulty: "hard" },
      { section: "math", sat_domain: "algebra", difficulty: "medium" },
    ], "sat");
    expect(sat.total).toBe(3);
    expect(sat.topics[0]).toEqual({ label: "Craft and Structure", count: 2 });
    expect(sat.difficulty.map((d) => d.label)).toEqual(["Easier", "Medium", "Harder"]);
    const ap = summarizeComposition([{ section: "mc", sat_domain: "ap:1.2", difficulty: "easy" }], "ap_biology");
    expect(ap.topics[0].label).toBe("Unit 1: Chemistry of Life");
    expect(ap.topicsTitle).toBe("Units covered");
  });
  it("returns empty when the database is unavailable", async () => {
    expect(await getPublicTests("sat")).toEqual([]);
    expect(await getAllPublicTestPaths(["sat"])).toEqual([]);
  });
});
