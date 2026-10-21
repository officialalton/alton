import { describe, expect, it } from "vitest";
import { summarizeApResult } from "./result-score";
import { AP_EXAM_WEIGHTS } from "./section-weights";
import { AP_LAYOUTS, AP_SECTION_WEIGHTS_PCT } from "./layouts";
import type { MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";
import type { EssayScoreView } from "@/lib/essay-grading/view";

const mcItem = (id: string, section: string, correct: boolean | null, response: string | null = correct === null ? null : "0"): MockExamAttemptItem =>
  ({ setItemId: id, section, format: "mc", correct, response, parts: null } as unknown as MockExamAttemptItem);
const frqIt = (id: string, section: string, points: number[]): MockExamAttemptItem =>
  ({ setItemId: id, section, format: "essay", correct: null, response: "x", parts: points.map((p, i) => ({ label: "abc"[i], points: p, prompt: "", mode: "essay" })) } as unknown as MockExamAttemptItem);
const score = (id: string, label: string, status: EssayScoreView["status"], total: number | null, over: Partial<EssayScoreView> = {}): EssayScoreView =>
  ({ setItemId: id, partLabel: label, status, rubricVersion: "englang-v2", scores: total === null ? null : { total }, rationale: null, lastError: null, ...over });

// English Language 풀 구성: MC 45 + 3 essays × 6점 (MC 45% · FRQ 55%)
const engItems = (mcCorrect: number) => [
  ...Array.from({ length: 45 }, (_, i) => mcItem(`m${i}`, "ap_mc", i < mcCorrect)),
  frqIt("e1", "ap_frq", [6]), frqIt("e2", "ap_frq", [6]), frqIt("e3", "ap_frq", [6]),
];
const eng = (items: MockExamAttemptItem[], essay: EssayScoreView[], aiScoring = true) =>
  summarizeApResult({ subject: "ap_english_language", items, layout: AP_LAYOUTS.ap_english_language, essayScores: essay, aiScoring });

describe("summarizeApResult — MC", () => {
  it("counts correct / answered / total", () => {
    const items = [mcItem("a", "ap_mc", true), mcItem("b", "ap_mc", false), mcItem("c", "ap_mc", null)];
    const r = summarizeApResult({ subject: "ap_english_language", items, layout: null, aiScoring: false });
    expect(r.mc).toEqual({ total: 3, answered: 2, correct: 1, pct: 33 });
  });
});

describe("summarizeApResult — FRQ state", () => {
  it("unscored FRQ is not zero: no AI scoring means earned null / not_scored", () => {
    const r = eng(engItems(30), [], false);
    expect(r.frq.state).toBe("not_scored");
    expect(r.frq.items.every((i) => i.earned === null && i.state === "not_scored")).toBe(true);
    expect(r.frq.scoredPoints).toBe(0);
    expect(r.frq.scoredItems).toBe(0);
    expect(r.frq.max).toBe(18);
    expect(r.weighted).toEqual({ status: "withheld", reason: "frq_not_scored" });
  });
  it("missing / pending / failed rows are in progress, not zero, and block the weighted total", () => {
    const essay = [score("e1", "a", "done", 5), score("e2", "a", "pending", null)]; // e3 row missing
    const r = eng(engItems(30), essay);
    expect(r.frq.state).toBe("in_progress");
    expect(r.frq.items.map((i) => i.state)).toEqual(["scored", "in_progress", "in_progress"]);
    expect(r.frq.scoredPoints).toBe(5);
    expect(r.weighted).toEqual({ status: "withheld", reason: "frq_in_progress" });
    const failed = eng(engItems(30), [score("e1", "a", "done", 5), score("e2", "a", "failed", null), score("e3", "a", "done", 4)]);
    expect(failed.weighted).toEqual({ status: "withheld", reason: "frq_in_progress" });
  });
  it("dead / skipped(non-empty) rows are unavailable and block the weighted total", () => {
    const r = eng(engItems(30), [score("e1", "a", "done", 5), score("e2", "a", "dead", null), score("e3", "a", "skipped", null, { lastError: "too_short" })]);
    expect(r.frq.state).toBe("unavailable");
    expect(r.weighted).toEqual({ status: "withheld", reason: "frq_unavailable" });
  });
  it("a blank answer (skipped: empty) is a real zero", () => {
    const r = eng(engItems(45), [score("e1", "a", "done", 6), score("e2", "a", "skipped", null, { lastError: "empty" }), score("e3", "a", "done", 3)]);
    expect(r.frq.items[1]).toMatchObject({ state: "scored", earned: 0, noResponse: true });
    expect(r.weighted).toMatchObject({ status: "available", points: 45 + (9 / 18) * 55 });
  });
  it("a score above the item maximum is rejected instead of summed", () => {
    const r = eng(engItems(30), [score("e1", "a", "done", 9), score("e2", "a", "done", 4), score("e3", "a", "done", 4)]);
    expect(r.frq.items[0].state).toBe("unavailable");
    expect(r.weighted).toEqual({ status: "withheld", reason: "frq_unavailable" });
  });
});

describe("summarizeApResult — supported subject with scoring start off", () => {
  const off = (essay: EssayScoreView[]) => summarizeApResult({ subject: "ap_english_language", items: engItems(30), layout: AP_LAYOUTS.ap_english_language, essayScores: essay, aiScoring: true, scoringActive: false });
  it("missing rows are paused (not in progress, not zero, not 'unsupported')", () => {
    const r = off([score("e1", "a", "done", 5)]);
    expect(r.frq.state).toBe("paused");
    expect(r.frq.items.map((i) => i.state)).toEqual(["scored", "paused", "paused"]);
    expect(r.weighted).toEqual({ status: "withheld", reason: "frq_paused" });
  });
  it("stored rows still count when scoring start is off", () => {
    const r = off(["e1", "e2", "e3"].map((id) => score(id, "a", "done", 6)));
    expect(r.frq.state).toBe("complete");
    expect(r.weighted.status).toBe("available");
  });
  it("skipped(too_short) carries its reason", () => {
    const r = off([score("e1", "a", "done", 5), score("e2", "a", "skipped", null, { lastError: "too_short" }), score("e3", "a", "done", 5)]);
    expect(r.frq.items[1]).toMatchObject({ state: "unavailable", reason: "too_short" });
  });
});

describe("blank answer = 0 only for a submitted (graded) attempt", () => {
  const rows = [score("e1", "a", "done", 5), score("e2", "a", "skipped", null, { lastError: "empty" }), score("e3", "a", "done", 4)];
  it("graded: real 0", () => {
    const r = summarizeApResult({ subject: "ap_english_language", items: engItems(30), layout: AP_LAYOUTS.ap_english_language, essayScores: rows, aiScoring: true, submitted: true });
    expect(r.frq.items[1]).toMatchObject({ state: "scored", earned: 0, noResponse: true });
  });
  it("not submitted: undecided, no weighted total", () => {
    const r = summarizeApResult({ subject: "ap_english_language", items: engItems(30), layout: AP_LAYOUTS.ap_english_language, essayScores: rows, aiScoring: true, submitted: false });
    expect(r.frq.items[1].state).toBe("in_progress");
    expect(r.weighted.status).toBe("withheld");
  });
});

describe("summarizeApResult — weighted total", () => {
  it("applies official section weights only after everything is scored (English Language 45/55)", () => {
    const r = eng(engItems(36), [score("e1", "a", "done", 6), score("e2", "a", "done", 3), score("e3", "a", "done", 3)]);
    // MC 36/45 × 45 = 36 ; FRQ 12/18 × 55 = 36.666…
    expect(r.weighted.status).toBe("available");
    if (r.weighted.status !== "available") return;
    expect(r.weighted.points).toBe(72.7);
    expect(r.weighted.components.map((c) => [c.id, c.earned, c.max, c.weightPct])).toEqual([["mc", 36, 45, 45], ["frq", 12, 18, 55]]);
  });
  it("perfect and zero attempts map to 100 and 0", () => {
    const perfect = eng(engItems(45), ["e1", "e2", "e3"].map((id) => score(id, "a", "done", 6)));
    expect(perfect.weighted).toMatchObject({ status: "available", points: 100 });
    const zero = eng(engItems(0), ["e1", "e2", "e3"].map((id) => score(id, "a", "done", 0)));
    expect(zero.weighted).toMatchObject({ status: "available", points: 0 });
  });
  it("is withheld for a partial practice set even when everything is scored", () => {
    const items = [...Array.from({ length: 20 }, (_, i) => mcItem(`m${i}`, "ap_mc", true)), frqIt("e1", "ap_frq", [6])];
    const r = summarizeApResult({ subject: "ap_english_language", items, layout: [{ key: "ap_mc", kind: "mc", count: 20, minutes: 30 }], essayScores: [score("e1", "a", "done", 6)], aiScoring: true });
    expect(r.weighted).toEqual({ status: "withheld", reason: "partial_set" });
  });
  it("is withheld when the attempt lacks questions of the official layout", () => {
    const items = engItems(30).slice(1); // 44 MC
    const r = eng(items, ["e1", "e2", "e3"].map((id) => score(id, "a", "done", 6)));
    expect(r.weighted).toEqual({ status: "withheld", reason: "mc_incomplete" });
  });
  it("is withheld for a subject without a weights entry", () => {
    const r = summarizeApResult({ subject: "ap_computer_science_principles", items: engItems(30), layout: AP_LAYOUTS.ap_english_language, aiScoring: true });
    expect(r.weighted).toEqual({ status: "withheld", reason: "partial_set" });
  });
  it("weights a US History attempt as MC 40 + SAQ 20 + DBQ 25 + LEQ 15, SAQ graded as one grouped row", () => {
    const L = AP_LAYOUTS.ap_us_history;
    const items = [
      ...Array.from({ length: 55 }, (_, i) => mcItem(`m${i}`, "ap_mc", i < 44)), // 80%
      frqIt("s1", "ap_saq", [1, 1, 1]), frqIt("s2", "ap_saq", [1, 1, 1]), frqIt("s3", "ap_saq", [1, 1, 1]),
      frqIt("dbq", "ap_frq", [7]), frqIt("leq", "ap_frq", [6]),
    ];
    const u = (id: string, label: string, total: number, taskType: string): EssayScoreView => ({ ...score(id, label, "done", total), rubricVersion: "ushistory-v1", scores: { total, taskType } });
    const essay = [u("s1", "a", 3, "saq"), u("s2", "a", 2, "saq"), u("s3", "a", 1, "saq"), u("dbq", "a", 7, "dbq"), u("leq", "a", 3, "leq")];
    const r = summarizeApResult({ subject: "ap_us_history", items, layout: L, essayScores: essay, aiScoring: true });
    expect(r.frq.max).toBe(22);
    expect(r.weighted.status).toBe("available");
    if (r.weighted.status !== "available") return;
    // MC .8×40=32 ; SAQ 6/9×20=13.33 ; DBQ 7/7×25=25 ; LEQ 3/6×15=7.5 → 77.8
    expect(r.weighted.components.map((c) => [c.id, c.earned, c.max])).toEqual([["mc", 44, 55], ["saq", 6, 9], ["dbq", 7, 7], ["leq", 3, 6]]);
    expect(r.weighted.points).toBe(77.8);
  });
  it("US History without a task type on the DBQ/LEQ rows cannot be weighted (point mismatch, not silently dropped)", () => {
    const L = AP_LAYOUTS.ap_us_history;
    const items = [...Array.from({ length: 55 }, (_, i) => mcItem(`m${i}`, "ap_mc", true)), frqIt("s1", "ap_saq", [1, 1, 1]), frqIt("s2", "ap_saq", [1, 1, 1]), frqIt("s3", "ap_saq", [1, 1, 1]), frqIt("dbq", "ap_frq", [7]), frqIt("leq", "ap_frq", [6])];
    const u = (id: string, total: number): EssayScoreView => ({ ...score(id, "a", "done", total), rubricVersion: "ushistory-v1", scores: { total } });
    const r = summarizeApResult({ subject: "ap_us_history", items, layout: L, essayScores: ["s1", "s2", "s3", "dbq", "leq"].map((id) => u(id, 1)), aiScoring: true });
    expect(r.weighted).toEqual({ status: "withheld", reason: "point_mismatch" });
  });
});

describe("section weights registry", () => {
  it("every entry sums to 100 and has a source", () => {
    for (const [k, w] of Object.entries(AP_EXAM_WEIGHTS)) {
      expect(Math.round(w.components.reduce((n, c) => n + c.pct, 0) * 1000) / 1000, k).toBe(100);
      expect(w.source.length, k).toBeGreaterThan(5);
      expect(AP_LAYOUTS[k], k).toBeDefined();
    }
  });
  it("Micro/Macro use the Fall 2026 CED values 66.65 / 33.35 and a 50/25/25 FRQ split that sums to 100", () => {
    for (const k of ["ap_microeconomics", "ap_macroeconomics"]) {
      const w = AP_EXAM_WEIGHTS[k];
      expect(w.components.map((c) => c.pct), k).toEqual([66.65, 33.35]);
      expect(w.frqSplit, k).toEqual([50, 25, 25]);
      expect(w.frqSplit!.reduce((a, b) => a + b, 0)).toBe(100);
      expect(Math.round((66.65 + 33.35) * 100) / 100).toBe(100);
      expect(w.basis).toBe("owner");
    }
  });
  it("agrees with the older AP_SECTION_WEIGHTS_PCT entries", () => {
    for (const [k, w] of Object.entries(AP_SECTION_WEIGHTS_PCT)) {
      const c = AP_EXAM_WEIGHTS[k].components;
      expect(c.find((x) => x.id === "mc")?.pct, k).toBe(w.mc);
      expect(c.find((x) => x.id === "frq")?.pct, k).toBe(w.frq);
    }
  });
});
