import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLessonPlan, checkLessonPlan, lessonTotals, LESSON_MAX_ATOMS, LESSON_MAX_LOAD } from "./lessons";
import type { ApCurriculumFile } from "./types";

const DIR = path.resolve(__dirname, "../../data/ap/curriculum-2027");
const data = readdirSync(DIR).filter((n) => n.endsWith(".json")).map((n) => [n.replace(".json", ""), JSON.parse(readFileSync(path.join(DIR, n), "utf-8")) as ApCurriculumFile] as const);

describe("AP lesson-level template generator", () => {
  it.each(data)("%s: every topic and sub-keyword is primary in exactly one lesson; order and load limits hold", (_c, f) => {
    expect(checkLessonPlan(f, buildLessonPlan(f))).toEqual([]);
  });

  it.each(data)("%s: lessons are numbered 1..N, codes unique, per-unit review and exam-prep phase exist", (_c, f) => {
    const plan = buildLessonPlan(f);
    expect(plan.map((l) => l.position)).toEqual(plan.map((_, i) => i + 1));
    for (const u of f.units) expect(plan.filter((l) => l.unitCode === u.code && l.kind === "unit_review").length).toBeGreaterThanOrEqual(1);
    expect(plan.filter((l) => l.kind === "exam_prep").length).toBe(6);
    expect(plan[plan.length - 1].kind).toBe("exam_prep");
    expect(Math.max(...plan.filter((l) => l.kind === "content").map((l) => l.estLoad))).toBeLessThanOrEqual(LESSON_MAX_LOAD);
  });

  it("Calculus AB gives a realistic lesson count, not 8", () => {
    const t = lessonTotals(buildLessonPlan(data.find(([c]) => c === "ap_calculus_ab")![1]));
    expect(t.content).toBeGreaterThanOrEqual(61);
    expect(t.total).toBeGreaterThan(70);
  });

  it("Calculus BC covers BC-only topics and shares AB topic codes (content_key family)", () => {
    const ab = data.find(([c]) => c === "ap_calculus_ab")![1];
    const bc = data.find(([c]) => c === "ap_calculus_bc")![1];
    const bcPrimary = new Set(buildLessonPlan(bc).flatMap((l) => l.links.filter((k) => k.role === "primary").map((k) => k.contentCode)));
    for (const u of ab.units) for (const t of u.topics) expect(bcPrimary.has(t.code), t.code).toBe(true);
    const bcOnly = bc.units.flatMap((u) => u.topics).filter((t) => t.scope === "bc_only");
    expect(bcOnly.length).toBe(30);
    for (const t of bcOnly) expect(bcPrimary.has(t.code)).toBe(true);
  });

  it("checker detects duplicates, omissions, prerequisite and load violations", () => {
    const f = data[0][1];
    const plan = buildLessonPlan(f);
    const dup = structuredClone(plan);
    dup[1].links.push(dup[0].links.find((k) => k.role === "primary")!);
    expect(checkLessonPlan(f, dup).some((e) => e.includes("중복"))).toBe(true);
    const miss = structuredClone(plan);
    miss[0].links = miss[0].links.filter((k) => k.role !== "primary");
    expect(checkLessonPlan(f, miss).some((e) => e.includes("없음"))).toBe(true);
    const heavy = structuredClone(plan);
    heavy[0].estLoad = LESSON_MAX_LOAD + 1;
    expect(checkLessonPlan(f, heavy).some((e) => e.includes("부하"))).toBe(true);
    const swapped = structuredClone(plan);
    const a = swapped.findIndex((l) => l.kind === "content");
    const b = swapped.findIndex((l, i) => l.kind === "content" && i > a + 3);
    [swapped[a].links, swapped[b].links] = [swapped[b].links, swapped[a].links];
    expect(checkLessonPlan(f, swapped).length).toBeGreaterThan(0);
    expect(LESSON_MAX_ATOMS).toBeGreaterThan(0);
  });
});
