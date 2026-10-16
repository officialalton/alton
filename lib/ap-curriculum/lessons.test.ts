import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLessonPlan, checkLessonPlan, lessonTotals, maxAtomsOf, maxLoadOf, resolveOptions, type LessonTrackSet } from "./lessons";
import type { ApCurriculumFile } from "./types";

const DIR = path.resolve(__dirname, "../../data/ap/curriculum-2027");
const data = readdirSync(DIR).filter((n) => n.endsWith(".json")).map((n) => [n.replace(".json", ""), JSON.parse(readFileSync(path.join(DIR, n), "utf-8")) as ApCurriculumFile] as const);
const get = (c: string) => data.find(([k]) => k === c)![1];
const tracks: LessonTrackSet[] = ["compact", "full"];
const cases = data.flatMap(([c, f]) => tracks.map((t) => [c, t, f] as const));

describe("AP lesson-level template generator", () => {
  it.each(cases)("%s/%s: every topic and sub-keyword is primary in exactly one lesson; order and load caps hold", (_c, track, f) => {
    expect(checkLessonPlan(f, buildLessonPlan(f, { track }), { track })).toEqual([]);
  });

  it.each(cases)("%s/%s: numbered 1..N, caps per option, exam-prep phase last, every sub-keyword has a depth tier", (_c, track, f) => {
    const o = resolveOptions(track);
    const plan = buildLessonPlan(f, { track });
    expect(plan.map((l) => l.position)).toEqual(plan.map((_, i) => i + 1));
    expect(plan.every((l) => l.estMinutes === o.minutes)).toBe(true);
    expect(plan.filter((l) => l.kind === "exam_prep").length).toBe(o.examPrepSessions);
    expect(plan[plan.length - 1].kind).toBe("exam_prep");
    for (const l of plan.filter((x) => x.kind === "content")) {
      expect(l.estLoad).toBeLessThanOrEqual(maxLoadOf(o) + 1e-9);
      expect(l.links.filter((k) => k.role === "primary" && k.contentCode.includes("#")).length).toBeLessThanOrEqual(maxAtomsOf(o));
    }
    if (track === "full") for (const u of f.units) expect(plan.filter((l) => l.unitCode === u.code && l.kind === "unit_review").length).toBeGreaterThanOrEqual(1);
    else expect(plan.some((l) => l.kind === "unit_review")).toBe(false);
    const t = lessonTotals(plan);
    expect(t.coreKeywords + t.lightKeywords).toBe(f.units.reduce((n, u) => n + u.topics.reduce((m, tp) => m + tp.subKeywords.length, 0), 0));
  });

  it("compact AB is ~30 lessons (+-10%), BC ~40 (+-10%), 110 teaching minutes; full AB stays the 81-lesson course", () => {
    const ab = lessonTotals(buildLessonPlan(get("ap_calculus_ab"), { track: "compact" }));
    const bc = lessonTotals(buildLessonPlan(get("ap_calculus_bc"), { track: "compact" }));
    expect(Math.abs(ab.total - 30) / 30).toBeLessThanOrEqual(0.1);
    expect(Math.abs(bc.total - 40) / 40).toBeLessThanOrEqual(0.1);
    expect(ab.minutes).toBe(110);
    expect(lessonTotals(buildLessonPlan(get("ap_calculus_ab"), { track: "full" })).total).toBe(81);
  });

  it("compact folds unit review into the next lesson's warm-up (review-role links, no primary)", () => {
    const plan = buildLessonPlan(get("ap_calculus_ab"), { track: "compact" });
    const u2first = plan.find((l) => l.code === "C2.01")!;
    expect(u2first.links.some((k) => k.role === "review")).toBe(true);
    expect(u2first.note).toContain("warm-up");
  });

  it("Calculus BC covers every AB topic and the 30 BC-only topics", () => {
    for (const track of tracks) {
      const bcPrimary = new Set(buildLessonPlan(get("ap_calculus_bc"), { track }).flatMap((l) => l.links.filter((k) => k.role === "primary").map((k) => k.contentCode)));
      for (const u of get("ap_calculus_ab").units) for (const t of u.topics) expect(bcPrimary.has(t.code), t.code).toBe(true);
      const bcOnly = get("ap_calculus_bc").units.flatMap((u) => u.topics).filter((t) => t.scope === "bc_only");
      expect(bcOnly.length).toBe(30);
      for (const t of bcOnly) expect(bcPrimary.has(t.code)).toBe(true);
    }
  });

  it("checker detects duplicates, omissions, load and order violations", () => {
    const f = get("ap_calculus_ab");
    const plan = buildLessonPlan(f, { track: "compact" });
    const dup = structuredClone(plan);
    dup[1].links.push(dup[0].links.find((k) => k.role === "primary")!);
    expect(checkLessonPlan(f, dup).some((e) => e.includes("중복"))).toBe(true);
    const miss = structuredClone(plan);
    miss[0].links = miss[0].links.filter((k) => k.role !== "primary");
    expect(checkLessonPlan(f, miss).some((e) => e.includes("없음"))).toBe(true);
    const heavy = structuredClone(plan);
    heavy[0].estLoad = 99;
    expect(checkLessonPlan(f, heavy).some((e) => e.includes("부하"))).toBe(true);
    const swapped = structuredClone(plan);
    [swapped[0].links, swapped[6].links] = [swapped[6].links, swapped[0].links];
    expect(checkLessonPlan(f, swapped).length).toBeGreaterThan(0);
  });
});
