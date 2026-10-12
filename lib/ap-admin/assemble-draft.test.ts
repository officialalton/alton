import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planDraftSet, stockItems, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { published } from "../../scripts/ap-generation/assign-pool";

// 커밋된 보수 5세트 계획(가상 0)의 BC1 로 초안 계획·거부 규칙을 확인한다(DB 없음 — 변환 상태는 가짜 풀로 주입).
const report = JSON.parse(readFileSync("data/ap/stock/exact-assign-5sets-cons.json", "utf-8")) as { sets: (SetKeys & { id: string })[] };
const bc1 = report.sets.find((s) => s.id === "BC1")!;
const bc1Keys: SetKeys = { mcA: bc1.mcA, mcB: bc1.mcB, frqA: bc1.frqA, frqB: bc1.frqB };
const all = (k: SetKeys) => [...k.mcA, ...k.mcB, ...k.frqA, ...k.frqB];
const poolFor = (keys: string[], o: Partial<PoolRow> = {}): PoolRow[] => keys.map((k, i) => ({ candidate_key: k, kind: "mc", keyword_code: "1.1", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true, ap_candidate_problems: [{ item_index: 0, problem_id: `p-${i}`, problem_version_id: `v-${i}` }], ...o }));
const pub = published(); const publishedKeys = new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB]);
const ab1: FullSetUsage = { id: "ab1", name: "AP Calculus AB — Practice Exam 1", status: "published", problemIds: ["x1"], candidateKeys: [...publishedKeys] };
const base = () => ({ setId: "BC1", keys: bc1Keys, hasVirtual: false, pool: poolFor(all(bc1Keys)), existingFullSets: [ab1], publishedKeys, stock: stockItems() });

describe("planDraftSet", () => {
  it("공식 구성(MC 42 = 29+13, FRQ 6 = 2+4)·독립 검증 통과·변환 완료면 저장 가능, 기본 이름", () => {
    const p = planDraftSet(base());
    expect(p.problems).toEqual([]); expect(p.ok).toBe(true);
    expect(p.composition).toMatchObject({ mcA: 29, mcB: 13, frqA: 2, frqB: 4, mcTotal: 42, frqTotal: 6 });
    expect(p.items).toHaveLength(48); expect(p.name).toBe("AP Calculus BC — Practice Exam 1");
    expect(p.items.filter((i) => i.sectionKey === "ap_mc_a")[0].position).toBe(1);
  }, 120000);
  it("AB#1 은 저장 거부, 가상 문항 있는 배정도 거부", () => {
    expect(planDraftSet({ ...base(), setId: "AB1" }).problems.join()).toMatch(/AB#1/);
    expect(planDraftSet({ ...base(), hasVirtual: true }).problems.join()).toMatch(/가상 문항/);
  }, 120000);
  it("문제은행 변환·검증이 안 끝난 문항이 있으면 거부(목록 표시)", () => {
    const pool = poolFor(all(bc1Keys)); pool[0].purpose = null; pool[1].screen_verified = false; pool.pop();
    const p = planDraftSet({ ...base(), pool });
    expect(p.ok).toBe(false); expect(p.problems.join()).toMatch(/변환·검증이 끝나지 않은 문항 3건/);
  }, 120000);
  it("같은 이름 · 같은 문항 구성 · 저장된 풀 세트와 겹치는 문항은 거부 — 덮어쓰기·중복 없음", () => {
    const pool = poolFor(all(bc1Keys)); const ids = pool.map((r) => r.ap_candidate_problems![0].problem_id);
    const dupName = planDraftSet({ ...base(), existingFullSets: [ab1, { id: "d", name: "AP Calculus BC — Practice Exam 1", status: "draft", problemIds: ["zz"], candidateKeys: [] }] });
    expect(dupName.problems.join()).toMatch(/같은 이름/);
    const same = planDraftSet({ ...base(), existingFullSets: [ab1, { id: "d", name: "other", status: "draft", problemIds: ids, candidateKeys: all(bc1Keys) }] });
    expect(same.problems.join()).toMatch(/같은 문항 구성/);
    const overlap = planDraftSet({ ...base(), existingFullSets: [ab1, { id: "d", name: "other", status: "draft", problemIds: [ids[0]], candidateKeys: [bc1Keys.mcA[0]] }] });
    expect(overlap.problems.join()).toMatch(/같은 문항이 있습니다/); expect(overlap.problems.join()).toMatch(/독립 검증/);
  }, 120000);
  it("게시 AB#1 문항을 쓰면 독립 검증에서 거부", () => {
    const keys = { ...bc1Keys, mcA: [pub.mcA[0], ...bc1Keys.mcA.slice(1)] };
    const p = planDraftSet({ ...base(), keys, pool: poolFor(all(keys)) });
    expect(p.ok).toBe(false); expect(p.problems.join()).toMatch(/게시본 AB#1/);
  }, 120000);
  it("공식 구성에 못 미치면 거부", () => {
    const keys = { ...bc1Keys, mcA: bc1Keys.mcA.slice(1) };
    expect(planDraftSet({ ...base(), keys, pool: poolFor(all(keys)) }).problems.join()).toMatch(/공식 구성 불일치 ap_mc_a/);
  }, 120000);
});
