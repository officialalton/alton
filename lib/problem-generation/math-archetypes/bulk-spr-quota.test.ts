// 대량 생성기의 형식 쿼터(수량의 25% 는 항상 SPR) — 소량 배치에서도 누적 비율이 25% 에 수렴하고, mc/spr 변형은 같은 유사문항 그룹을 공유한다.
import { describe, expect, it } from "vitest";
import realReport from "./coverage-gate-report.json";
import { FTVD_HARD, FTVD_ALL } from "./skills/two-variable-data-figure";
import { ARCHETYPES } from "./registry";
import { produceFromArchetypes, produceFromCompilers, type PassedRecord } from "./bulk";
import { sprTarget } from "./spr";
import { CoverageGateError, type GateReport } from "./figure-coverage";
import { checkContent } from "@/lib/problem-content-check";
import { checkFigure } from "@/lib/problem-figures/check";
import { composeProblemText } from "@/lib/problem-question";
import type { Archetype } from "./types";

const OPEN: GateReport = { version: 1, generatedAt: "t", seedsPerArchetype: 1, ok: true, summary: { items: 303, pass: 303, fail: 0, unimplemented: 0, blockedRenderer: 0, waived: 0 }, gates: {}, items: {}, qaByItem: {}, spr: { requiredHardSprFor30Sets: 60, supplyImplemented: 60, sprCapableItems: 1, sprIncapableItems: 0, byItem: {} } };
const run = (pool: Archetype[], count: number, extra: Record<string, unknown> = {}) => produceFromArchetypes(pool, { runId: "quota", count, seedStart: 0, coverageReport: OPEN, ...extra });
const sprCount = (rs: PassedRecord[]) => rs.filter((r) => r.format === "spr").length;
const buckets = (rs: PassedRecord[]) => { const m = new Map<string, PassedRecord[]>(); for (const r of rs) m.set(`${r.skill}|${r.difficulty}`, [...(m.get(`${r.skill}|${r.difficulty}`) ?? []), r]); return m; };

describe("형식 쿼터 25% — (skill × 난이도) 단위, 결정론적 배정", () => {
  for (const n of [4, 10, 100, 1000]) {
    it(`${n}건 배치: SPR 개수 = half-up(${n} × 25%) = ${sprTarget(n)}, 나머지는 MC, 본문 유사도 제한 유지`, () => {
      const { records, stats } = run(FTVD_HARD, n);
      expect(records).toHaveLength(n);
      expect(sprCount(records)).toBe(sprTarget(n));
      expect(stats.format.shortfalls).toEqual([]);
      for (const r of records) {
        const p = r.problem as { format: string; options: unknown; correctIndex: unknown; answers: string[] | null; figure: unknown; needsFigure: boolean };
        expect(p.format).toBe(r.format);
        if (r.format === "spr") { expect(p.options).toBeNull(); expect(p.correctIndex).toBeNull(); expect(p.answers!.length).toBeGreaterThan(0); } else { expect(p.answers).toBeNull(); expect(Array.isArray(p.options)).toBe(true); }
        expect(p.figure).toBeTruthy(); expect(p.needsFigure).toBe(true);
      }
    }, 120_000);
  }
  it("누적 비율이 25% 에 수렴한다 — 어느 시점에서도 |SPR − 0.25×n| ≤ 1", () => {
    const { records } = run(FTVD_HARD, 120); let s = 0;
    records.forEach((r, i) => { if (r.format === "spr") s++; expect(Math.abs(s - (i + 1) * 0.25), `i=${i + 1}`).toBeLessThanOrEqual(1); });
  }, 60_000);
  it("레코드는 import.ts 의 공개 게이트(checkContent·checkFigure)를 SPR·선택지형 포함해 그대로 통과한다", () => {
    for (const r of run(FTVD_HARD, 80).records) {
      const p = r.problem as { stimulus: string; question: string; options: string[] | null; correctIndex: number | null; answers: string[] | null; explanation: string; figure: unknown };
      const text = composeProblemText(p.stimulus, p.question);
      expect(checkContent({ format: r.format, passage: text, options: p.options, correctIndex: p.correctIndex, explanation: p.explanation, answers: p.answers, statements: null, skillCode: r.skill, figure: p.figure }), r.recipeId ?? "").toEqual([]);
      expect(checkFigure(p.figure, text, p.options, p.correctIndex).ok).toBe(true);
    }
  }, 60_000);
  it("SPR 불가 원형(선택지형)만 있는 버킷은 조용히 mc 로 바꾸지 않고 부족분을 보고한다 · strictSpr 면 던진다", () => {
    const choiceOnly = FTVD_HARD.filter((a) => a.spr?.capable === false);
    const { records, stats } = run(choiceOnly, 20);
    expect(sprCount(records)).toBe(0); expect(stats.format.shortfalls.length).toBe(sprTarget(20)); expect(stats.format.shortfalls[0].reason).toContain("SPR 가능한 원형이 없다");
    expect(() => run(choiceOnly, 8, { strictSpr: true })).toThrow(/SPR 쿼터/);
  }, 60_000);
  it("선택지형이 섞여 있으면 같은 버킷의 SPR 가능 원형이 쿼터를 더 채운다", () => {
    const mixed = [...FTVD_HARD.filter((a) => a.spr?.capable === false), ...FTVD_HARD.filter((a) => a.spr?.capable).slice(0, 3)];
    const { records, stats } = run(mixed, 40); expect(sprCount(records)).toBe(sprTarget(40)); expect(stats.format.shortfalls).toEqual([]);
    const sprIds = new Set(records.filter((r) => r.format === "spr").map((r) => r.recipeId)); for (const id of sprIds) expect(FTVD_HARD.find((a) => a.id === id)!.spr!.capable).toBe(true);
  }, 60_000);
  it("easy/medium 틀도 버킷별로 쿼터를 따른다(skill×난이도 단위)", () => {
    const em = FTVD_ALL.filter((a) => a.level !== "hard") as unknown as Archetype[]; const { records } = run(em, 60);
    for (const [b, rs] of buckets(records)) { expect(Math.abs(sprCount(rs) - rs.length * 0.25), b).toBeLessThanOrEqual(1); expect(["easy", "medium"]).toContain(b.split("|")[1]); }
  }, 60_000);
  it("쿼터 0 이면 이전 동작(전부 mc)", () => { expect(sprCount(run(FTVD_HARD, 40, { sprQuota: 0 }).records)).toBe(0); }, 60_000);
  it("옛 원형(자료 없음)도 25% 를 지키고, SPR 불가 원형은 프로브 판정으로 SPR 가능 원형이 대신 채운다", () => {
    const pool = ARCHETYPES.filter((a) => a.skill === "probability"); const { records, stats } = run(pool, 48);
    expect(sprCount(records) + stats.format.shortfalls.length).toBeGreaterThanOrEqual(sprTarget(48) - 0); expect(records.every((r) => r.format === "mc" || (r.problem as { answers: string[] }).answers.length > 0)).toBe(true);
  }, 120_000);
});

describe("유사문항 그룹 — mc/spr 변형은 키를 공유하고, 한 세트에 같은 그룹 1문항 규칙으로 30세트를 채울 수 있다", () => {
  it("SPR 레코드의 그룹 키(subpattern)는 같은 원형·변형의 MC 레코드와 같은 형식이다", () => {
    const { records } = run(FTVD_HARD, 200); const keys = new Map<string, Set<string>>();
    for (const r of records) { const base = `${r.recipeId}/${r.subpattern.split("/").pop()}`; expect(r.subpattern).toBe(base); keys.set(r.subpattern, new Set([...(keys.get(r.subpattern) ?? []), r.format])); }
    expect([...keys.values()].some((f) => f.has("mc") && f.has("spr"))).toBe(true);
  }, 120_000);
  it("30세트 시뮬레이션: 세트마다 hard 8문항(SPR 2) — 같은 그룹은 한 세트에 하나만, 전 세트를 채운다", () => {
    const { records } = run(FTVD_HARD, 1000); const used = new Set<string>(); let filled = 0;
    for (let set = 0; set < 30; set++) {
      const inSet = new Set<string>(); const take = (fmt: "mc" | "spr") => { const r = records.find((x) => x.format === fmt && !used.has(x.gid) && !inSet.has(x.subpattern)); if (!r) return false; used.add(r.gid); inSet.add(r.subpattern); return true; };
      const okSpr = take("spr") && take("spr"); let okMc = true; for (let k = 0; k < 6; k++) okMc = take("mc") && okMc; if (okSpr && okMc) filled++;
    }
    expect(filled).toBe(30);
  }, 180_000);
});

describe("커버리지 게이트 가드 — 자료 원형은 게이트 미통과면 시작하지 않는다", () => {
  it("보고서 ok=false 이면 대량 생성 거부", () => { expect(() => produceFromArchetypes(FTVD_HARD, { runId: "g", count: 4, coverageReport: { ...OPEN, ok: false } })).toThrow(CoverageGateError); });
});

describe("컴파일러 경로(easy/medium)도 25% — 단, 컴파일러의 손실 SPR 표기는 정확한 표기로 바로잡는다", () => {
  it("linear_equations_one_var medium 12건: SPR 3건, 정답 목록은 재계산값의 정확한 표기만", () => {
    const { records, stats } = produceFromCompilers("linear_equations_one_var", "medium", { runId: "c", count: 12, seedStart: 0 });
    expect(records).toHaveLength(12); const spr = records.filter((r) => r.format === "spr"); expect(spr).toHaveLength(sprTarget(12)); expect(stats.format.shortfalls).toEqual([]);
    for (const r of spr) { const p = r.problem as { options: unknown; answers: string[]; format: string }; expect(p.format).toBe("spr"); expect(p.options).toBeNull(); expect(p.answers.length).toBeGreaterThan(0); const v = Number(p.answers[0].includes("/") ? Number(p.answers[0].split("/")[0]) / Number(p.answers[0].split("/")[1]) : p.answers[0]); for (const a of p.answers) { const x = a.includes("/") ? Number(a.split("/")[0]) / Number(a.split("/")[1]) : Number(a); expect(Math.abs(x - v), `${a}`).toBeLessThan(1.1e-3); } }
  }, 120_000);
  it("SPR 1차 범위 밖 skill 은 부족분을 보고서에 남긴다(조용히 mc 로 대체하지 않음)", () => {
    const { records, stats } = produceFromCompilers("linear_functions", "easy", { runId: "c", count: 8, seedStart: 0 });
    expect(records.filter((r) => r.format === "spr")).toHaveLength(0); expect(stats.format.shortfalls.length).toBe(sprTarget(8)); expect(stats.format.shortfalls[0].reason).toContain("SPR_ELIGIBLE_SKILLS");
  }, 60_000);
});

describe("승인 부분집합 — 실제 게이트 보고서로 파일럿 15항목만 연다", () => {
  it("보고서가 ok=false 이면 allowItems 없이는 거부하고, 실제 보고서(전체 통과)로는 파일럿 15항목이 20건(SPR 5건) 산출된다", () => {
    const items = [...new Set(FTVD_HARD.map((a) => a.figureItem!))];
    expect(() => produceFromArchetypes(FTVD_HARD, { runId: "real", count: 4, coverageReport: { ...(realReport as object), ok: false } as never })).toThrow(CoverageGateError);
    const { records } = produceFromArchetypes(FTVD_HARD, { runId: "real", count: 20, allowItems: items });
    expect(records).toHaveLength(20); expect(sprCount(records)).toBe(sprTarget(20));
    for (const r of records) { const p = r.problem as { figure: unknown }; expect(p.figure).toBeTruthy(); expect((r.quality.mockExamGeneration as { figureItem?: string }).figureItem).toBeTruthy(); }
  }, 120_000);
});
