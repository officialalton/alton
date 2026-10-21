import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => { throw new Error("no db"); } }));

import { allSubjectSlugs, apSlug, getPublicSetsBySubject, getSubjectMeta, groupPublicSets, subjectCodeFromSlug } from "./subjects";
import { AP_NEW_SUBJECTS, AP_NEW_SUBJECTS_PUBLIC, AP_PENDING_PUBLIC_SUBJECTS, AP_SUBJECT_NAME } from "@/lib/ap-exam/layouts";

describe("subject slugs", () => {
  it("maps ap codes to ap-* slugs and back; rejects unknown or malformed", () => {
    expect(apSlug("ap_calculus_ab")).toBe("ap-calculus-ab");
    expect(subjectCodeFromSlug("ap-calculus-ab")).toBe("ap_calculus_ab");
    expect(subjectCodeFromSlug("ap-physics-1")).toBe("ap_physics_1");
    expect(subjectCodeFromSlug("sat")).toBe("sat");
    for (const bad of ["ap-nope", "AP-Calculus-AB", "ap_calculus_ab", "../x", "", "constructor", "ap-"]) expect(subjectCodeFromSlug(bad)).toBeNull();
  });
  it("covers 14 AP subjects plus SAT, all resolvable with units for AP", () => {
    const slugs = allSubjectSlugs();
    expect(slugs).toHaveLength(Object.keys(AP_SUBJECT_NAME).length - AP_PENDING_PUBLIC_SUBJECTS.length + 1);
    expect(slugs).toHaveLength(15 + AP_NEW_SUBJECTS_PUBLIC.length);
    for (const s of slugs) {
      const m = getSubjectMeta(s)!;
      expect(m).not.toBeNull();
      expect(m.rows.length).toBeGreaterThan(0);
      expect(m.faq.length).toBeGreaterThanOrEqual(2);
      if (m.kind === "ap") expect(m.units.length).toBeGreaterThan(0);
    }
  });
  it("subjects added 2026-10-20 stay hidden (404, not listed) until their sets are published", () => {
    expect(AP_PENDING_PUBLIC_SUBJECTS).toHaveLength(AP_NEW_SUBJECTS.length - AP_NEW_SUBJECTS_PUBLIC.length);
    for (const code of AP_PENDING_PUBLIC_SUBJECTS) {
      expect(AP_SUBJECT_NAME[code], code).toBeTruthy();
      expect(subjectCodeFromSlug(apSlug(code)), code).toBeNull();
      expect(allSubjectSlugs()).not.toContain(apSlug(code));
    }
  });
  it("calculus AB exposes official exam structure and unit weights", () => {
    const m = getSubjectMeta("ap-calculus-ab")!;
    expect(m.name).toBe("AP Calculus AB");
    expect(m.rows).toHaveLength(4);
    expect(m.units[0].mc).toEqual([10, 15]);
  });
});

describe("public sets", () => {
  it("groups names only, by subject, SAT for null/sat programs", () => {
    const g = groupPublicSets([
      { name: "B set", exam_program: "ap", ap_subject: "ap_biology" },
      { name: "A set", exam_program: "ap", ap_subject: "ap_biology" },
      { name: "SAT 1", exam_program: null, ap_subject: null },
      { name: null, exam_program: "sat", ap_subject: null },
      { name: "X", exam_program: "ap", ap_subject: null },
    ]);
    expect(g.ap_biology.map((s) => s.name)).toEqual(["A set", "B set"]);
    expect(g.sat).toEqual([{ name: "SAT 1" }]);
    expect(Object.keys(g[ "ap_biology"][0])).toEqual(["name"]);
  });
  it("falls back to empty when the DB fails", async () => {
    expect(await getPublicSetsBySubject()).toEqual({});
  });
});
