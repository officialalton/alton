import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planPartialDraftSet, type PartialPlanFile, type PartialPlanSet } from "./partial-draft";
import { stockItems, type FullSetUsage, type PoolRow } from "./assemble-draft";
import { fullExamKeys, reservedKeyMap } from "./reserved-keys";
import { readPartialPlan, listPartialPlans } from "./batches";

// 커밋된 재구성 계획(data/ap/stock/assembled/partial-rebuild-ab-plan.json)의 세트 3종으로 검증·거부 규칙을 확인한다(DB 없음 — 변환 상태는 가짜 풀로 주입).
const FILE = "partial-rebuild-ab-plan.json";
const plan = readPartialPlan(FILE) as PartialPlanFile;
const stock = stockItems(); const byKey = new Map(stock.map((c) => [c.key, c]));
const keysOf = (s: PartialPlanSet) => [...s.keys.mcA, ...s.keys.mcB, ...s.keys.frqA, ...s.keys.frqB];
const rows = (keys: string[], o: Partial<PoolRow> = {}): PoolRow[] => keys.map((k) => ({ candidate_key: k, kind: byKey.get(k)?.kind ?? "mc", keyword_code: `${byKey.get(k)?.unit ?? 1}.1`, difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true, ap_candidate_problems: [{ item_index: 0, problem_id: `p:${k}`, problem_version_id: `v:${k}` }], ...o }));
const usage = (name: string, keys: string[], status = "published"): FullSetUsage => ({ id: name, name, status, problemIds: keys.map((k) => `p:${k}`), candidateKeys: keys });
const reserved = reservedKeyMap();
const get = (id: string) => plan.sets.find((s) => s.id === id)!;
const base = (id: string, over: Partial<Parameters<typeof planPartialDraftSet>[0]> = {}) => {
  const set = get(id);
  return planPartialDraftSet({ set, subject: plan.subject, pool: rows(keysOf(set)), existingSets: [], reservedKeys: reserved, stock, ...over });
};

describe("부분 연습 세트 재구성 계획 파일", () => {
  it("목록에 나오고 세트 3종의 공식 이름을 그대로 쓴다", () => {
    expect(listPartialPlans().some((p) => p.file === FILE)).toBe(true);
    expect(plan.sets.map((s) => s.name)).toEqual(["AP Calculus AB — Non-Calculator Practice", "AP Calculus AB — Calculator Practice", "AP Calculus AB — Free-Response Practice"]);
  });
  it("풀 모의고사 6세트(AB#1 v1·v2 포함)·세트끼리 동일 문항 0, BC 전용 0", () => {
    const f = fullExamKeys(); const full = new Set([...f.ab1v1, ...f.ab1v2, ...f.all]);
    const seen = new Map<string, string>();
    for (const s of plan.sets) for (const k of keysOf(s)) { expect(full.has(k), `${s.id} ${k} 는 풀 모의고사 문항`).toBe(false); expect(seen.has(k), `${k} 는 ${seen.get(k)} 와 중복`).toBe(false); seen.set(k, s.id); expect(byKey.get(k)!.bcOnly).toBe(false); expect(byKey.get(k)!.subj).toBe("ab"); }
    expect(seen.size).toBe(29 + 13 + 6);
  });
});

describe("planPartialDraftSet", () => {
  it("3종 모두 독립 검증 통과: 공식 문항 수·계산기·문항군 1·다루는 단원 표시", () => {
    const nc = base("PNC"), c = base("PC"), f = base("PF");
    for (const p of [nc, c, f]) expect(p.problems).toEqual([]);
    expect(nc.composition).toMatchObject({ mcA: 29, mcB: 0, frqTotal: 0 }); expect(nc.label).toBe("mc_practice"); expect(nc.layout.sections.map((x) => x.key)).toEqual(["ap_mc_a"]);
    expect(c.composition).toMatchObject({ mcA: 0, mcB: 13 }); expect(c.layout.sections.map((x) => x.key)).toEqual(["ap_mc_b"]);
    expect(f.composition).toMatchObject({ frqA: 2, frqB: 4 }); expect(f.label).toBe("frq_practice"); expect(f.stats.short).toBe(false);
    for (const p of [nc, c, f]) { expect(p.units.length).toBeGreaterThan(0); expect(p.stats.doubledFamilies).toBe(0); }
    expect(nc.items.filter((i) => i.sectionKey === "ap_mc_a")[0].position).toBe(1);
  });
  it("이전(아직 보관 안 한) 부분 세트와 같은 이름·같은 문항은 거부하고 보관을 안내한다", () => {
    const old = usage("AP Calculus AB — Calculator Practice", [get("PC").keys.mcB[0], "old:x"]);
    const p = base("PC", { existingSets: [old] });
    expect(p.ok).toBe(false); expect(p.problems.join()).toMatch(/같은 이름의 비보관 세트/); expect(p.problems.join()).toMatch(/보관/); expect(p.problems.join()).toMatch(/겹침 0 위반/);
  });
  it("다른 새 부분 세트(초안)와 한 문항이라도 겹치면 거부", () => {
    const other = usage("AP Calculus AB — Free-Response Practice", [get("PF").keys.frqA[0], get("PNC").keys.mcA[0]], "draft");
    const p = base("PNC", { existingSets: [other] });
    expect(p.ok).toBe(false); expect(p.problems.join()).toMatch(/겹침 0 위반/);
  });
  it("풀 모의고사 초안·AB#1 v2 예약 문항은 거부", () => {
    const f = fullExamKeys(); const draftKey = Object.values(f.draftSets)[0][0];
    const set: PartialPlanSet = { ...get("PNC"), keys: { ...get("PNC").keys, mcA: [draftKey, ...get("PNC").keys.mcA.slice(1)] } };
    const p = planPartialDraftSet({ set, subject: plan.subject, pool: rows(keysOf(set)), existingSets: [], reservedKeys: reserved, stock });
    expect(p.problems.join()).toMatch(/예약된 문항/);
  });
  it("공식 문항 수 미달·계산기 위반·BC 과목 문항은 거부, 이름은 공식 이름만", () => {
    const short: PartialPlanSet = { ...get("PNC"), keys: { ...get("PNC").keys, mcA: get("PNC").keys.mcA.slice(1) } };
    expect(planPartialDraftSet({ set: short, subject: plan.subject, pool: rows(keysOf(short)), existingSets: [], reservedKeys: reserved, stock }).problems.join()).toMatch(/공식 구성 불일치 ap_mc_a: 28\/29/);
    const wrongCalc: PartialPlanSet = { ...get("PC"), keys: { ...get("PC").keys, mcB: [get("PNC").keys.mcA[0], ...get("PC").keys.mcB.slice(1)] } };
    expect(planPartialDraftSet({ set: wrongCalc, subject: plan.subject, pool: rows(keysOf(wrongCalc)), existingSets: [], reservedKeys: reserved, stock }).problems.join()).toMatch(/계산기 조건 위반/);
    const bcItem = stock.find((c) => c.subj === "bc" && c.kind === "mc" && c.calc === "not_allowed")!;
    const withBc: PartialPlanSet = { ...get("PNC"), keys: { ...get("PNC").keys, mcA: [bcItem.key, ...get("PNC").keys.mcA.slice(1)] } };
    expect(planPartialDraftSet({ set: withBc, subject: plan.subject, pool: rows(keysOf(withBc)), existingSets: [], reservedKeys: reserved, stock }).problems.join()).toMatch(/BC/);
    const renamed: PartialPlanSet = { ...get("PNC") };
    expect(base("PNC", { name: "AP Calculus AB — Non-Calculator Practice 2", set: renamed }).problems.join()).not.toMatch(/이름은 공식/);
    expect(base("PNC", { name: "AP Calculus AB — Full Practice Exam" }).problems.join()).toMatch(/이름은 공식 부분 연습 이름/);
  });
  it("문제은행 변환·검증이 안 끝난 문항이 있으면 거부", () => {
    const set = get("PC"); const pool = rows(keysOf(set)); pool[0].purpose = null; pool[1].screen_verified = false;
    expect(base("PC", { pool }).problems.join()).toMatch(/변환·검증이 끝나지 않은 문항 2건/);
  });
  it("짧은 Free-Response 연습(2~4 묶음)은 허용하고 Practice Section 레이아웃으로 저장, 1·5~6개 중간 구성은 거부", () => {
    const f = get("PF");
    const four: PartialPlanSet = { ...f, keys: { ...f.keys, frqA: f.keys.frqA.slice(0, 1), frqB: f.keys.frqB.slice(0, 3) } };
    const p = planPartialDraftSet({ set: four, subject: plan.subject, pool: rows(keysOf(four)), existingSets: [], reservedKeys: reserved, stock });
    expect(p.problems).toEqual([]); expect(p.stats.short).toBe(true); expect(p.layout.sections.map((x) => x.label)).toEqual(["Practice Section 1: Free Response (calculator allowed)", "Practice Section 2: Free Response (no calculator)"]);
    expect(p.layout.sections.map((x) => x.minutes)).toEqual([15, 45]);
    const five: PartialPlanSet = { ...f, keys: { ...f.keys, frqA: f.keys.frqA, frqB: f.keys.frqB.slice(0, 3) } };
    expect(planPartialDraftSet({ set: five, subject: plan.subject, pool: rows(keysOf(five)), existingSets: [], reservedKeys: reserved, stock }).problems.join()).toMatch(/Free-Response 구성 오류/);
  });
  it("계획 파일 이름·형식 검사(경로 주입 거부)", () => {
    expect(() => readPartialPlan("../exact-assign-5sets-cons.json")).toThrow(/이름/);
    expect(() => readPartialPlan("partial-rebuild-x.json")).toThrow();
  });
});
