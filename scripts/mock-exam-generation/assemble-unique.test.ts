import { describe, expect, it } from "vitest";
import { assertUnique, demandVsSupply, buildSlots, planUnique, type Weights } from "./assemble-unique";
import type { EligibleProblem } from "../../lib/mock-exam/assemble";

describe("assertUnique", () => {
  const it1 = (id: string) => ({ problemId: id });
  it("통과: 세트 간·세트 내 중복 없음", () => { expect(() => assertUnique([[it1("a"), it1("b")], [it1("c")]], new Set(["k"]))).not.toThrow(); });
  it("세트 간 중복이면 throw", () => { expect(() => assertUnique([[it1("a")], [it1("a")]], new Set())).toThrow(/appears in new sets 1 and 2/); });
  it("세트 내 반복이면 throw", () => { expect(() => assertUnique([[it1("a"), it1("a")]], new Set())).toThrow(/repeated within/); });
  it("유지 세트 문항을 쓰면 throw", () => { expect(() => assertUnique([[it1("k")]], new Set(["k"]))).toThrow(/kept set/); });
});

// 작은 풀: 1개 영역·세 난이도, 모듈당 문항을 1~2개로 만드는 가중치는 쓸 수 없으니(모듈 정원 고정) 정원을 충족하는 큰 풀 대신 부족 보고만 검증한다.
describe("demandVsSupply / planUnique", () => {
  const W: Weights = { dom: [{ section: "rw", sat_domain: "d1", weight_pct: 100 }, { section: "math", sat_domain: "m1", weight_pct: 100 }],
    diff: ["easy", "medium", "hard"].flatMap((d, i) => ["rw", "math"].map((s) => ({ section: s, problem_difficulty: d, weight_pct: [25, 50, 25][i] }))) };
  const mk = (n: number, domain: string, difficulty: string, format = "mc", skills = 3): EligibleProblem[] =>
    Array.from({ length: n }, (_, i) => ({ problemId: `${domain}-${difficulty}-${format}-${i}`, problemVersionId: `v-${domain}-${difficulty}-${format}-${i}`, satDomain: domain, skillCode: `${domain}_s${i % skills}`, difficulty: difficulty as never, format: format as never, similarityGroup: null, exposureCount: 0 }));
  it("재고 부족이면 셀별 부족분을 정확히 보고한다", () => {
    const pool = [...mk(10, "d1", "easy"), ...mk(10, "d1", "medium"), ...mk(10, "d1", "hard")];
    const sh = demandVsSupply(pool, buildSlots(W, 1, true)).find((x) => x.domain === "d1" && x.difficulty === "medium")!;
    expect(sh.extraNeeded).toBe(sh.demand - 10);
  });
  it("재고가 충분하면 N개 세트를 만들고 중복이 0이다", () => {
    const pool = [...mk(200, "d1", "easy"), ...mk(200, "d1", "medium"), ...mk(200, "d1", "hard"), ...mk(200, "m1", "easy"), ...mk(200, "m1", "medium"), ...mk(200, "m1", "hard")];
    expect(demandVsSupply(pool, buildSlots(W, 2, true))).toEqual([]);
    const r = planUnique(pool, W, 2, new Map(), true);
    expect(r.sets.map((s) => s.length)).toEqual([147, 147]);
    expect(() => assertUnique(r.sets, new Set())).not.toThrow();
    expect(new Set(r.sets.flat().map((i) => i.problemId)).size).toBe(294);
  });
});

import { assertGroupLimits } from "./assemble-unique";
describe("그룹 한도 (오너 규칙 3·4)", () => {
  const g = (...x: string[]) => x.map((group) => ({ group }));
  it("쌍 공유 수 초과면 throw", () => { expect(() => assertGroupLimits([g("a", "b", "c"), g("a", "b", "c")], 2)).toThrow(/share 3/); expect(() => assertGroupLimits([g("a", "b"), g("a", "b")], 2)).not.toThrow(); });
  it("그룹 총 출현 상한", () => { expect(() => assertGroupLimits([g("a"), g("a"), g("a")], 15, 2)).toThrow(/group a used in 3/); });
  it("유지 세트와의 공유도 센다", () => { expect(() => assertGroupLimits([g("a", "b")], 1, Infinity, [new Set(["a", "b"])])).toThrow(/share 2/); });
  it("planUnique 는 maxShared 를 지킨다", () => {
    const W: Weights = { dom: [{ section: "rw", sat_domain: "d1", weight_pct: 100 }, { section: "math", sat_domain: "m1", weight_pct: 100 }], diff: ["easy", "medium", "hard"].flatMap((d, i) => ["rw", "math"].map((s) => ({ section: s, problem_difficulty: d, weight_pct: [25, 50, 25][i] }))) };
    const mk = (dom: string, d: string): EligibleProblem[] => Array.from({ length: 300 }, (_, i) => ({ problemId: `${dom}-${d}-${i}`, problemVersionId: `v${dom}-${d}-${i}`, satDomain: dom, skillCode: `${dom}_s${i % 3}`, difficulty: d as never, format: "mc" as never, similarityGroup: `g${dom}${d}${i % 80}`, exposureCount: 0 }));
    const pool = ["d1", "m1"].flatMap((dm) => ["easy", "medium", "hard"].flatMap((d) => mk(dm, d)));
    const r = planUnique(pool, W, 3, new Map(), true, { maxShared: 15 });
    expect(() => assertGroupLimits(r.sets, 15)).not.toThrow();
    expect(() => assertUnique(r.sets, new Set())).not.toThrow();
  });
});

import { capViolations, TopicLedger, saturationList, rwPaths, type TopicMap } from "./rw-topics-lib";
describe("소재 상한 (2026-10-08)", () => {
  const W: Weights = { dom: [{ section: "rw", sat_domain: "d1", weight_pct: 100 }, { section: "math", sat_domain: "m1", weight_pct: 100 }], diff: ["easy", "medium", "hard"].flatMap((d, i) => ["rw", "math"].map((s) => ({ section: s, problem_difficulty: d, weight_pct: [25, 50, 25][i] }))) };
  // 같은 cluster 문항이 id 순서로 붙어 있어 상한이 없으면 한 모듈이 같은 소재로 채워진다.
  const mk = (dom: string, d: string): EligibleProblem[] => Array.from({ length: 300 }, (_, i) => ({ problemId: `${dom}-${d}-${String(i).padStart(3, "0")}`, problemVersionId: `v${dom}-${d}-${i}`, satDomain: dom, skillCode: `${dom}_s${i % 3}`, difficulty: d as never, format: "mc" as const, similarityGroup: null, exposureCount: 0 }));
  const pool = ["d1", "m1"].flatMap((dm) => ["easy", "medium", "hard"].flatMap((d) => mk(dm, d)));
  const subjects = ["literature_fiction", "humanities", "science_life", "history_civics", "social_science"];
  const topics: TopicMap = new Map(pool.filter((c) => c.satDomain === "d1").map((c, i) => [c.problemId, { subject: subjects[Math.floor(i / 7) % 5], cluster: `c${Math.floor(Number(c.problemId.slice(-3)) / 12)}-${c.difficulty}`, family: `f${Math.floor(Number(c.problemId.slice(-3)) / 12) % 8}` }]));
  it("상한 없이는 위반이 생기고(대조군), 상한을 주면 위반 0 + 중복 0", () => {
    const base = planUnique(pool, W, 2, new Map(), true, {});
    expect(capViolations(base.sets[0].filter((i) => i.section === "rw"), topics).length).toBeGreaterThan(0);
    const r = planUnique(pool, W, 2, new Map(), true, { topics });
    expect(r.topicViolations).toEqual([]); expect(r.topicRelaxed).toEqual([]);
    expect(() => assertUnique(r.sets, new Set())).not.toThrow();
    expect(r.sets.map((s) => s.length)).toEqual([147, 147]);
  });
  it("cluster 수가 모자라 상한을 지킬 수 없으면 풀어서 채우고 topicRelaxed 에 기록한다", () => {
    const tiny: TopicMap = new Map([...topics].map(([id, t]) => [id, { ...t, cluster: "same", family: "same" }]));
    const r = planUnique(pool, W, 1, new Map(), true, { topics: tiny });
    expect(r.sets[0].length).toBe(147); expect(r.topicRelaxed.length).toBeGreaterThan(0);
  });
  it("TopicLedger: 모듈당 1, 경로당 2, family 4 (문학은 family 제외)", () => {
    const t: TopicMap = new Map([["a", { subject: "science_life", cluster: "x", family: "f" }], ["b", { subject: "science_life", cluster: "x", family: "f" }], ["c", { subject: "science_life", cluster: "x", family: "f" }], ["d", { subject: "science_life", cluster: "y", family: "f" }]]);
    const L = new TopicLedger(t); L.add(0, "rw_m1", null, "a");
    expect(L.ok(0, "rw_m1", null, "b")).toBe(false); // 같은 모듈
    expect(L.ok(0, "rw_m2", "lower", "b")).toBe(true); L.add(0, "rw_m2", "lower", "b");
    expect(L.ok(0, "rw_m2", "higher", "c")).toBe(true); // 경로 higher 는 M1 에서 1회뿐
    expect(L.ok(0, "rw_m2", "lower", "c")).toBe(false); // 경로 lower 가 이미 2회
    expect(L.ok(1, "rw_m1", null, "a")).toBe(true); // 다른 세트
    expect(L.ok(0, "rw_m2", "higher", "d")).toBe(true);
  });
  it("capViolations / saturationList / rwPaths", () => {
    const items = ["a", "b"].map((problemId, i) => ({ problemId, moduleKey: "rw_m2", route: i ? "higher" : "lower" }));
    expect(rwPaths([{ moduleKey: "rw_m1", route: null }, ...items]).map((p) => p.length)).toEqual([2, 2]);
    const t: TopicMap = new Map([["a", { subject: "x", cluster: "c", family: "f" }], ["b", { subject: "x", cluster: "c", family: "f" }]]);
    expect(capViolations([...items, { problemId: "a", moduleKey: "rw_m1", route: null }, { problemId: "b", moduleKey: "rw_m1", route: null }], t).some((v) => v.kind === "module" && v.key === "c")).toBe(true);
    const s = saturationList([{ cluster: "o", family: "m" }, { cluster: "o", family: "m" }, { cluster: "z", family: "k" }], { clusterCap: 1, familyCap: 1 });
    expect(s.clusters).toEqual([{ cluster: "o", count: 2 }]); expect(s.families).toEqual([{ family: "m", count: 2 }]);
  });
});
