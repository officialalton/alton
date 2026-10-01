import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "./registry";
import { produceFromArchetypes, produceFromCompilers } from "./bulk";
import { jaccard, shingles } from "./sweep";
import { checkContent } from "@/lib/problem-content-check";
import { checkFigure } from "@/lib/problem-figures/check";
import { composeProblemText } from "@/lib/problem-question";

const body = (r: { problem: Record<string, unknown> }) => shingles(`${r.problem.stimulus} ${r.problem.question} ${(r.problem.options as string[]).join(" ")}`);

describe("produceFromArchetypes — 대량 산출기(원형 hard)", () => {
  const pool = ARCHETYPES.filter((a) => a.skill === "probability");
  const run = () => produceFromArchetypes(pool, { runId: "test-run", count: 48, seedStart: 100 });
  it("요청 수만큼 산출하고 import.ts 호환 레코드 형태를 지킨다", () => {
    const { records, stats } = run();
    expect(records).toHaveLength(48);
    expect(stats.accepted).toBe(48);
    for (const r of records) {
      expect(r).toMatchObject({ runId: "test-run", skill: "probability", domain: "problem_solving_data", examSystem: "sat_math", difficulty: "hard", format: "mc", createdVia: "compiler" });
      expect(r.gid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(r.recipeId).toMatch(/^probability\./);
      expect(r.subpattern.startsWith(`${r.recipeId}/`)).toBe(true);
      const p = r.problem as { options: string[]; correctIndex: number; passage: string; explanation: string };
      expect(p.options).toHaveLength(4); expect(p.correctIndex).toBeGreaterThanOrEqual(0); expect(p.passage).toContain("\n\n");
      const mg = (r.quality as { mockExamGeneration: Record<string, unknown> }).mockExamGeneration;
      expect(mg).toMatchObject({ difficultyStatus: "provisional_ai", source: "compiler_archetype", archetypeId: r.recipeId });
      expect(Array.isArray(mg.concepts) && (mg.concepts as string[]).length >= 2).toBe(true);
    }
  });
  it("레코드는 import.ts 의 공개 게이트(checkContent 이슈 0·checkFigure 통과)를 그대로 통과한다", () => {
    for (const r of run().records) {
      const p = r.problem as { stimulus: string; question: string; options: string[]; correctIndex: number; explanation: string };
      const text = composeProblemText(p.stimulus, p.question);
      expect(checkContent({ format: "mc", passage: text, options: p.options, correctIndex: p.correctIndex, explanation: p.explanation, answers: null, statements: null, skillCode: r.skill, figure: null })).toEqual([]);
      expect(checkFigure(null, text, p.options, p.correctIndex).ok).toBe(true);
    }
  });
  it("같은 실행 안 모든 쌍의 본문 유사도는 0.6 미만이다", () => {
    const sh = run().records.map(body);
    for (let i = 0; i < sh.length; i++) for (let j = i + 1; j < sh.length; j++) expect(jaccard(sh[i], sh[j])).toBeLessThan(0.6);
  });
  it("같은 입력이면 같은 레코드를 낸다(시드 재현성)", () => {
    expect(JSON.stringify(run().records.map((r) => r.gid))).toBe(JSON.stringify(run().records.map((r) => r.gid)));
    expect(JSON.stringify(run().records[5])).toBe(JSON.stringify(run().records[5]));
  });
  it("원형 라운드 로빈으로 한 원형에 쏠리지 않는다", () => {
    const { stats } = run();
    const counts = Object.values(stats.byArchetype).map((x) => x.accepted);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });
  it("그룹당 상한(maxPerGroup)을 지킨다", () => {
    const { stats } = produceFromArchetypes(pool, { runId: "t", count: 30, seedStart: 0, maxPerGroup: 2 });
    expect(Math.max(...Object.values(stats.byGroup))).toBeLessThanOrEqual(2);
  });
  it("기존 은행과 0.6 이상 비슷한 문항은 제외한다", () => {
    const first = produceFromArchetypes(pool, { runId: "t", count: 6, seedStart: 0 }).records;
    const existing = new Map([["probability", first.map(body)]]);
    const again = produceFromArchetypes(pool, { runId: "t", count: 6, seedStart: 0, existing });
    const gids = new Set(first.map((r) => r.gid));
    expect(again.records.every((r) => !gids.has(r.gid))).toBe(true);
    expect(again.stats.duplicate).toBeGreaterThan(0);
  });
});

describe("produceFromCompilers — 기존 컴파일러 easy/medium 산출", () => {
  it("시드 고정 재현·confirmed 표식·그룹 상한·유사도 제한", () => {
    const origLog = console.log; console.log = () => {};
    try {
      const a = produceFromCompilers("linear_equations_one_var", "medium", { runId: "t", count: 12, seedStart: 0 });
      const b = produceFromCompilers("linear_equations_one_var", "medium", { runId: "t", count: 12, seedStart: 0 });
      expect(a.records.length).toBe(12);
      expect(a.records.map((r) => r.gid)).toEqual(b.records.map((r) => r.gid));
      expect(JSON.stringify(a.records[3].problem)).toBe(JSON.stringify(b.records[3].problem));
      for (const r of a.records) expect((r.quality as { mockExamGeneration: { difficultyStatus: string } }).mockExamGeneration.difficultyStatus).toBe("confirmed");
      const sh = a.records.map(body);
      for (let i = 0; i < sh.length; i++) for (let j = i + 1; j < sh.length; j++) expect(jaccard(sh[i], sh[j])).toBeLessThan(0.6);
      const capped = produceFromCompilers("percentages", "easy", { runId: "t", count: 10, seedStart: 0, maxPerGroup: 3 });
      expect(Math.max(...Object.values(capped.stats.byGroup))).toBeLessThanOrEqual(3);
    } finally { console.log = origLog; }
  }, 60_000);
  it("Math.random 을 호출 뒤 원래대로 복원한다", () => {
    const before = Math.random;
    const origLog = console.log; console.log = () => {};
    try { produceFromCompilers("percentages", "easy", { runId: "t", count: 2, seedStart: 0 }); } finally { console.log = origLog; }
    expect(Math.random).toBe(before);
  });
});
