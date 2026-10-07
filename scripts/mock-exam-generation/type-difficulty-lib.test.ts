import { describe, expect, it } from "vitest";
import { aggregateBank, aggregateGen, classifyBank, classifyGen, collectWeak, countStatus, independentCount, type Attempt } from "./type-difficulty-lib";

const att = (o: Partial<Attempt> & { id?: string }): Attempt => ({ source: "archetype", archetypeId: o.id ?? "a", difficulty: "hard", outcome: "produced", ...o });
const sh = (...w: string[]) => new Set(w);

describe("independentCount", () => {
  it("본문이 거의 같으면 하나로 센다", () => {
    expect(independentCount([sh("a", "b", "c"), sh("a", "b", "c"), sh("x", "y", "z")])).toBe(2);
  });
});
describe("aggregateGen / classifyGen", () => {
  it("생성기가 없으면 EMPTY", () => {
    expect(aggregateGen([], new Set()).status).toBe("EMPTY");
  });
  it("산출 0이면 EMPTY(실패 수 보고)", () => {
    const c = aggregateGen([att({ outcome: "genfail" }), att({ outcome: "verifyfail" })], new Set(["a"]));
    expect(c.status).toBe("EMPTY"); expect(c.genFail).toBe(1); expect(c.verifyFail).toBe(1);
  });
  it("독립 변형 3 미만이면 WEAK, 3 이상이면 OK", () => {
    const two = [att({ shingles: sh("a") }), att({ shingles: sh("b") })];
    expect(aggregateGen(two, new Set(["a"])).status).toBe("WEAK");
    const three = [...two, att({ shingles: sh("c"), variant: "v" })];
    const c = aggregateGen(three, new Set(["a"])); expect(c.status).toBe("OK"); expect(c.variants).toBe(1); expect(c.bySource.archetype).toBe(3);
  });
  it("검증 실패·렌더 실패가 섞이면 WEAK", () => {
    const xs = [att({ shingles: sh("a") }), att({ shingles: sh("b") }), att({ shingles: sh("c"), qaFail: true }), att({ outcome: "verifyfail" })];
    const c = aggregateGen(xs, new Set(["a"])); expect(c.status).toBe("WEAK"); expect(c.reasons.join()).toContain("렌더");
  });
  it("classifyGen 직접 호출", () => {
    expect(classifyGen({ archetypes: 1, attempts: 5, produced: 5, genFail: 0, thrown: 0, verifyFail: 0, qaFail: 0, variants: 2, independent: 5, bySource: {} }).status).toBe("OK");
  });
});
describe("aggregateBank", () => {
  const p = (id: string, skill: string, difficulty: string, o: object = {}) => ({ id, skill_code: skill, difficulty, status: "confirmed", usage_scope: "mock_exam", archived_at: null, published_version_id: `v${id}`, ...o });
  const problems = [p("1", "s", "easy"), p("2", "s", "easy", { published_version_id: null }), p("3", "s", "easy", { archived_at: "x" }), p("4", "s", "hard", { usage_scope: "general" }), p("5", "t", "easy")];
  const versions = [{ id: "v1", problem_id: "1", explanation_en: "ok" }, { id: "v4", problem_id: "4", explanation_en: "  " }, { id: "v5", problem_id: "5", explanation_en: "ok" }];
  const sets = [{ id: "S1", status: "published", archived_at: null }, { id: "S2", status: "draft", archived_at: null }];
  const items = [{ exam_set_id: "S1", problem_id: "1" }, { exam_set_id: "S2", problem_id: "5" }];
  const m = aggregateBank(problems, versions, sets, items);
  it("보관·미게시를 구분해 센다", () => {
    expect(m.get("s|easy")).toMatchObject({ live: 2, published: 1, explEnOk: 1, mockScope: 1, exposedInSets: 1 });
    expect(m.get("s|hard")).toMatchObject({ published: 1, explEnMissing: 1, mockScope: 0 });
    expect(m.get("t|easy")!.exposedInSets).toBe(0);
  });
  it("classifyBank: 없음 EMPTY, 3 미만·설명 누락 WEAK", () => {
    expect(classifyBank(undefined).status).toBe("EMPTY");
    expect(classifyBank(m.get("s|easy")).status).toBe("WEAK");
    expect(classifyBank({ live: 5, published: 5, explEnOk: 5, explEnMissing: 0, mockScope: 5, exposedInSets: 0, status: "OK", reasons: [] }).status).toBe("OK");
  });
});
describe("collectWeak / countStatus", () => {
  const ok = { status: "OK" as const, reasons: [] };
  const rows = [{ id: "x", cells: { easy: ok, medium: { status: "EMPTY" as const, reasons: ["r"] }, hard: { status: "WEAK" as const, reasons: ["w"] } } }];
  it("OK 아닌 칸만 모은다", () => {
    expect(collectWeak("m", rows).map((w) => w.difficulty)).toEqual(["medium", "hard"]);
    expect(countStatus(rows)).toEqual({ OK: 1, WEAK: 1, EMPTY: 1, cells: 3 });
  });
});
