// AP Biology Practice Exam 1·2 주제 분산 새 버전 계획(2026-10-15, bi1-v4·bi2-v5·bi1-v5-swap-plan.json)의 정합성. 현재 게시본(BI1 v3·BI2 v4 스냅샷) → v4 배정. DB 없이 관리자 '새 버전' 흐름(resolveSwaps + checkNewVersionComposition)을
// 게시 v1 스냅샷에서 세 단계로 그대로 재현해, 각 단계가 흐름의 검증을 통과하고 최종 구성이 v4 배정(+기록된 대체)과 같음을 확인한다.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bioUnitBounds } from "../ap-exam/full-set-rules";
import { bioFrqSpread, verifyBioFrqSpread } from "../ap-exam/bio-frq-spread";
import { checkNewVersionComposition, type SlotItem } from "../mock-exam/new-version";
import { loadBioPool } from "../../scripts/ap-generation/bio-pool";
import { verifyBioAssignment, type BioResult } from "../../scripts/ap-generation/bio-assign";
import { parseSwapPlan, resolveSwaps, type PlanSwapInput } from "./new-version";

type Id = "BI1" | "BI2";
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const snap = rd<Record<Id, { slots: { section: string; position: number; candidateKey: string }[] }> & { convertedKeys: string[] }>("data/ap/stock/bio-bi1-bi2-published-v3v4-slots.json");
const v4 = Object.fromEntries(rd<{ sets: { id: Id; mcA: string[]; frqA: string[] }[] }>("data/ap/stock/exact-assign-bio-bi1-bi2-v4.json").sets.map((s) => [s.id, s])) as unknown as Record<Id, { mcA: string[]; frqA: string[] }>;
const { all } = loadBioPool(); const by = new Map(all.map((c) => [c.key, c]));
const planFiles = readdirSync("data/ap/stock").filter((f) => /^bi[12]-v[45]-swap-plan\.json$/.test(f)).sort();
const plans = planFiles.map((f) => ({ f, p: parseSwapPlan(rd(`data/ap/stock/${f}`)), raw: rd<{ note: string; swapCount: number }>(`data/ap/stock/${f}`) }));
const first = (["BI1", "BI2"] as Id[]).find((id) => plans.filter((x) => x.p.set === id).length === 2)!; // 중간판을 거치는 시험(계획 2개)
const second: Id = first === "BI1" ? "BI2" : "BI1";
const mine = plans.filter((x) => x.p.set === first).sort((a, b) => (a.p.sourceVersionNo ?? 0) - (b.p.sourceVersionNo ?? 0));
const step1 = mine[0], last = mine[1], step2 = plans.find((x) => x.p.set === second)!; // ① 중간판 ② 상대 ③ 최종

type Slot = { section: string; position: number; candidateKey: string };
const slotsOf = (id: Id): Slot[] => snap[id].slots.map((s) => ({ ...s }));
const pid = (key: string, i: number) => `${key}#${i}`;
const unitOf = (key: string) => String(by.get(key)!.members[0]?.unit ?? "");
function apply(label: string, cur: Slot[], other: Slot[], inputs: PlanSwapInput[]) {
  const res = resolveSwaps(inputs, cur.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey })));
  expect(res.problems, `${label} resolveSwaps`).toEqual([]);
  const toSlot = (s: Slot, i = 0): SlotItem => { const c = by.get(s.candidateKey)!; return { section: s.section, position: s.position, problemId: pid(s.candidateKey, i), candidateKey: s.candidateKey, kind: c.kind === "mc" ? "mc" : "frq", unit: unitOf(s.candidateKey), family: c.fam, calculator: "na" }; };
  const idx = (s: Slot) => cur.filter((x) => x.section === s.section && x.candidateKey === s.candidateKey).sort((a, b) => a.position - b.position).findIndex((x) => x.position === s.position);
  const before = cur.map((s) => toSlot(s, idx(s)));
  const actionSwaps = res.swaps.map((sw) => ({ section: sw.section, position: sw.position, problemId: pid(sw.addKey, sw.addIndex ?? 0) }));
  const replacements = new Map(res.swaps.map((sw) => { const c = by.get(sw.addKey)!; return [pid(sw.addKey, sw.addIndex ?? 0), { problemId: pid(sw.addKey, sw.addIndex ?? 0), candidateKey: sw.addKey, kind: (c.kind === "mc" ? "mc" : "frq") as "mc" | "frq", unit: unitOf(sw.addKey), family: c.fam, calculator: "na" }] as const; }));
  const used = new Set(other.map((s) => pid(s.candidateKey, 0)).concat(other.flatMap((s) => [1, 2, 3].map((i) => pid(s.candidateKey, i)))));
  const setSizes = new Map(all.filter((c) => c.shared).map((c) => [c.key, c.members.length] as [string, number]));
  const out = checkNewVersionComposition(before, actionSwaps, { apLabel: "full_practice", sectionCalculator: { ap_mc: "allowed", ap_frq: "allowed" }, unitBounds: bioUnitBounds(), usedByOtherExams: used, replacements, setSizes });
  expect(out.issues, `${label} 새 버전 검증`).toEqual([]);
  const next = cur.map((s) => { const sw = res.swaps.find((x) => x.section === s.section && x.position === s.position); return sw ? { ...s, candidateKey: sw.addKey } : s; });
  return { next, swaps: res.swaps };
}
const keysOf = (s: Slot[]) => new Set(s.map((x) => x.candidateKey));
const resultOf = (id: string, s: Slot[]): BioResult => {
  const mc = [...new Set(s.filter((x) => x.section === "ap_mc").map((x) => x.candidateKey))].map((k) => by.get(k)!);
  return { id, singles: mc.filter((c) => !c.shared), sets: mc.filter((c) => c.shared), frq: s.filter((x) => x.section === "ap_frq").map((x) => by.get(x.candidateKey)!), virtual: [], virtualSets: [], virtualSetArchetypes: [], frqVirtual: [] };
};

describe("AP Biology Practice Exam 1·2 새 버전 계획", () => {
  it("계획 파일 3개(중간판 v2, 상대 v2, 중간판의 v3)와 형식", () => {
    expect(plans).toHaveLength(3);
    for (const { p, raw } of plans) { expect(p.swaps.length).toBe(raw.swapCount); for (const s of p.swaps) { expect(["ap_mc", "ap_frq"]).toContain(s.section); expect(s.position).toBeGreaterThan(0); } }
    expect(step1.p.sourceVersionNo).toBe(first === "BI1" ? 3 : 4); expect(step2.p.sourceVersionNo).toBe(second === "BI1" ? 3 : 4); expect(last.p.sourceVersionNo).toBe((step1.p.sourceVersionNo ?? 0) + 1);
  });
  it("현재 게시 구성: 두 시험 모두 ap_mc 60 + ap_frq 6, 계획의 제거 문항이 그 칸에 있다", () => {
    for (const id of ["BI1", "BI2"] as Id[]) { const s = slotsOf(id); expect(s.filter((x) => x.section === "ap_mc")).toHaveLength(60); expect(s.filter((x) => x.section === "ap_frq")).toHaveLength(6); }
    for (const { p } of [step1, step2]) for (const sw of p.swaps) expect(slotsOf(p.set as Id).find((x) => x.section === sw.section && x.position === sw.position)?.candidateKey).toBe(sw.removeKey);
  });
  it("세 단계가 관리자 새 버전 흐름 검증(단원 범위·문항군 상한·공유 세트 통째 교체·시험 간 겹침 0)을 통과한다", () => {
    const a = apply("① 중간판", slotsOf(first), slotsOf(second), step1.p.swaps);
    const b = apply("② 상대", slotsOf(second), a.next, step2.p.swaps); // BI(first) 중간판이 공개된 뒤: 상대 계열에 쓰인 문항 = 중간판 구성
    const c = apply("③ 최종", a.next, b.next, last.p.swaps);
    const T = (id: Id) => new Set([...v4[id].mcA, ...v4[id].frqA]);
    // 최종 구성 = v4 배정 그대로(대체 없음). 새 배치 키는 적재·변환 후에만 적용 가능하므로 requiresConvertedCandidates 에 적혀 있다.
    const f1 = keysOf(first === "BI1" ? c.next : b.next), f2 = keysOf(first === "BI1" ? b.next : c.next);
    for (const id of ["BI1", "BI2"] as Id[]) { const f = id === "BI1" ? f1 : f2; expect([...f].filter((k) => !T(id).has(k))).toEqual([]); expect([...T(id)].filter((k) => !f.has(k))).toEqual([]); }
    expect([...f1].filter((k) => f2.has(k))).toEqual([]);
  });
  it("공유 세트(4문항)는 같은 크기 세트로만 통째로 바뀌고 FRQ 는 같은 유형끼리 바뀐다", () => {
    for (const { p } of plans) for (const sw of p.swaps) {
      const r = by.get(sw.removeKey!)!, a = by.get(sw.addKey)!;
      expect(a.shared).toBe(r.shared); if (a.shared) expect(a.members.length).toBe(4);
      if (r.kind === "frq") expect(a.frqType).toBe(r.frqType);
    }
  });
  it("최종 구성: 독립 검증기 위반 0(구조 겹침 포함), 두 시험 문항 서로소, exam_prep MC 각 26/60 이상, FRQ 주제 분산(영역당 ≤35%·≥4영역)", () => {
    const a = apply("① 중간판", slotsOf(first), slotsOf(second), step1.p.swaps);
    const b = apply("② 상대", slotsOf(second), a.next, step2.p.swaps);
    const c = apply("③ 최종", a.next, b.next, last.p.swaps);
    const s1 = first === "BI1" ? c.next : b.next, s2 = first === "BI1" ? b.next : c.next;
    expect(verifyBioAssignment([resultOf("BI1", s1), resultOf("BI2", s2)])).toEqual([]);
    const ex = (s: Slot[]) => [...new Set(s.filter((x) => x.section === "ap_mc").map((x) => x.candidateKey))].reduce((n, k) => n + (by.get(k)!.exam ?? 0), 0);
    expect(ex(s1)).toBeGreaterThanOrEqual(26); expect(ex(s2)).toBeGreaterThanOrEqual(26);
    for (const [id, st] of [["BI1", s1], ["BI2", s2]] as const) { const frq = st.filter((x) => x.section === "ap_frq").map((x) => ({ type: by.get(x.candidateKey)!.frqType, topic: by.get(x.candidateKey)!.frqTopic ?? "" })); expect(verifyBioFrqSpread(frq), `${id} FRQ 주제 분산`).toEqual([]); expect(bioFrqSpread(frq).areas).toBeGreaterThanOrEqual(4); }
  });
  it("교체 문항은 DB 변환 완료 후보이거나, 계획의 requiresConvertedCandidates(새 배치 bio-v3a/b/c 통과 키)에 적혀 있다", () => {
    const newKeys = new Set(["bio-v3a", "bio-v3b", "bio-v3c"].flatMap((b) => rd<{ stockKey: string; validation: string; duplicateOf?: string | null }[]>(`data/ap/stock/${b}-items.json`).filter((r) => r.validation === "auto_passed" && !r.duplicateOf).map((r) => r.stockKey)));
    for (const { p, f } of plans) {
      const adds = p.swaps.map((s) => s.addKey); expect(new Set(adds).size).toBe(adds.length);
      const req = new Set(rd<{ requiresConvertedCandidates?: string[] }>(`data/ap/stock/${f}`).requiresConvertedCandidates ?? []);
      for (const k of adds) { if (snap.convertedKeys.includes(k)) continue; expect(newKeys.has(k), `${f} ${k} 는 변환 완료도 새 배치 통과 키도 아니다`).toBe(true); expect(req.has(k)).toBe(true); }
      for (const k of req) expect(adds.includes(k)).toBe(true);
    }
  });
  it("공유 세트는 시험 사이를 오가지 않는다(세트는 같은 크기 세트로만 통째 교체되므로 중간판을 채울 자유 세트가 필요 없다)", () => {
    const cur = (id: Id) => new Set(slotsOf(id).filter((x) => by.get(x.candidateKey)?.shared).map((x) => x.candidateKey));
    for (const id of ["BI1", "BI2"] as Id[]) { const other = cur(id === "BI1" ? "BI2" : "BI1"); for (const k of [...v4[id].mcA].filter((k) => by.get(k)?.shared)) expect(other.has(k), `${id} 의 목표 세트 ${k} 가 상대 시험의 현재 세트`).toBe(false); }
  });
});
