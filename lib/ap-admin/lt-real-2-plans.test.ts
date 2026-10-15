// AP English Literature Stage 2(lt-real-2) 새 버전 계획의 정합성. DB 없이, 2026-10-15 SELECT 전용 스냅샷(게시 LT1·LT2 v1 슬롯 + 후보 메타)에 Stage 1 계획을 적용한 슬롯(= Stage 1 공개 뒤 v2)을 원본으로
// 관리자 새 버전 미리보기와 같은 경로(parseSwapPlan → resolveSwaps → checkNewVersionComposition, unitBounds = fullPracticeUnitBounds)를 재생하고, 교체 뒤 구성을 독립 검증기(verifyLtAssignment)로 다시 확인한다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fullPracticeUnitBounds } from "../ap-exam/full-set-rules";
import { englitCategoryBounds } from "../ap-exam/englit-rules";
import { startsWithRealTextMarker, isEnglishPassage } from "../ap-exam/stimulus-display";
import { checkNewVersionComposition, type SlotItem } from "../mock-exam/new-version";
import { LENGTH_CUE_RATIO, lengthCueRatio } from "../ap-generation/englit-gates";
import { frqViolations, type LtFrqPayload } from "../ap-generation/englit-frq";
import { locate, realAttribution, realSet } from "../ap-generation/englit-real";
import { keyPositionViolations } from "../ap-generation/englang-gates";
import type { Registry } from "../ap-generation/englit-sources";
import { loadLtPool } from "../../scripts/ap-generation/lt-pool";
import { categorySummary, verifyLtAssignment } from "../../scripts/ap-generation/lt-assign";
import { applySwaps, resultOf, type Snap } from "../../scripts/ap-generation/lt-real-1-plans";
import { STAGE_2, stage1Slots } from "../../scripts/ap-generation/lt-real-2-plans";
import { STOCK_BATCHES } from "./batches";
import { parseSwapPlan, resolveSwaps } from "./new-version";

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const snap = rd<Snap>("data/ap/stock/lt1-lt2-published-v1-slots.json");
const items1 = rd<J[]>("data/ap/stock/lt-real-1-items.json"); const items = rd<J[]>("data/ap/stock/lt-real-2-items.json");
const cands = new Map<string, J>([...(snap.cands as J[]).map((c) => [c.candidate_key as string, c] as [string, J]), ...[...items1, ...items].map((i) => [i.stockKey as string, { candidate_key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq_bundle", keyword_code: i.keywordCode, item_family_id: i.itemFamilyId, calculator: "na" }] as [string, J])]);
const { all } = loadLtPool({ requireScreen: false }); const by = new Map(all.map((c) => [c.key, c]));
const size = (key: string) => (by.get(key)?.kind === "mc" ? by.get(key)!.members.length : 1);
const brief = (key: string | null) => { const c = key ? cands.get(key) : undefined; return { candidateKey: key, kind: (c?.kind === "mc" ? "mc" : c?.kind ? "frq" : null) as "mc" | "frq" | null, unit: (c?.keyword_code as string | undefined)?.split(".")[0] ?? null, family: (c?.item_family_id as string | undefined) ?? null, calculator: (c?.calculator as string | undefined) ?? null }; };
const idxIn = (slots: { section: string; position: number; candidateKey: string }[], s: { section: string; position: number; candidateKey: string }) => slots.filter((x) => x.section === s.section && x.candidateKey === s.candidateKey).sort((a, b) => a.position - b.position).findIndex((x) => x.position === s.position);
const V2 = { LT1: stage1Slots("LT1", snap, by), LT2: stage1Slots("LT2", snap, by) }; // Stage 1 공개 뒤(게시 v2) 슬롯

function replay(id: "LT1" | "LT2", other: "LT1" | "LT2") {
  const cur = V2[id]; const plan = parseSwapPlan(rd(`data/ap/stock/${id.toLowerCase()}-v3-real-2-swap-plan.json`));
  const res = resolveSwaps(plan.swaps, cur.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey })));
  const slots: SlotItem[] = cur.map((s) => ({ section: s.section, position: s.position, problemId: `${s.candidateKey}#${idxIn(cur, s)}`, ...brief(s.candidateKey) }));
  const pid = (sw: { addKey: string; addIndex?: number }) => `${sw.addKey}#${sw.addIndex ?? 0}`;
  const used = new Set(V2[other].map((s) => `${s.candidateKey}#${idxIn(V2[other], s)}`));
  const out = checkNewVersionComposition(slots, res.swaps.map((s) => ({ section: s.section, position: s.position, problemId: pid(s) })), { apLabel: "full_practice", sectionCalculator: { ap_mc: "na", ap_frq: "na" }, unitBounds: fullPracticeUnitBounds("ap_english_literature", "full_practice"), usedByOtherExams: used,
    setSizes: new Map([...new Set(res.swaps.map((s) => s.addKey))].map((k) => [k, size(k)] as [string, number])), replacements: new Map(res.swaps.map((s) => [pid(s), { problemId: pid(s), ...brief(s.addKey) }])) });
  return { plan, res, out, next: applySwaps(cur, plan.swaps.map((s) => ({ section: s.section, removeKey: s.removeKey!, addKey: s.addKey }))) };
}

describe("원본(Stage 1 공개 뒤 v2) = 게시 v1 + Stage 1 계획", () => {
  it("55 MC + 3 FRQ, Stage 1 지문이 들어 있고 Stage 2 대상은 아직 ALTON 지문", () => {
    for (const id of ["LT1", "LT2"] as const) { expect(snap[id].sourceVersionNo).toBe(1); expect(V2[id].filter((s) => s.section === "ap_mc")).toHaveLength(55); expect(V2[id].filter((s) => s.section === "ap_frq")).toHaveLength(3); }
    expect(V2.LT1.map((s) => s.candidateKey)).toContain("lt-real-1:ap_english_literature-real-rs1-k0"); expect(V2.LT2.map((s) => s.candidateKey)).toContain("lt-real-1:ap_english_literature-real-rf2-k0");
    for (const id of ["LT1", "LT2"] as const) for (const [rk] of STAGE_2[id].mc) expect(V2[id].some((s) => s.candidateKey === rk)).toBe(true);
    expect(verifyLtAssignment([resultOf("LT1", V2.LT1, by), resultOf("LT2", V2.LT2, by)])).toEqual([]);
  });
});
describe("LT1·LT2 Stage 2 계획", () => {
  for (const [id, other, n, mcSlots] of [["LT1", "LT2", 24, 23], ["LT2", "LT1", 21, 21]] as const) {
    it(`${id}: 계획 형식(원본 v2)·제거 문항이 그 칸에 있음·실제 새 버전 검사 통과`, () => {
      const raw = rd<J>(`data/ap/stock/${id.toLowerCase()}-v3-real-2-swap-plan.json`); const { res, out, plan } = replay(id, other);
      expect(plan.sourceVersionNo).toBe(2); expect(raw.verifierViolations).toEqual([]); expect(raw.swapCount).toBe(plan.swaps.length); expect(raw.swapCount).toBe(STAGE_2[id].mc.length + STAGE_2[id].frq.length);
      for (const sw of plan.swaps) expect(V2[id].find((x) => x.section === sw.section && x.position === sw.position)?.candidateKey).toBe(sw.removeKey);
      expect(res.problems).toEqual([]); expect(res.swaps).toHaveLength(n); expect(res.swaps.filter((s) => s.section === "ap_mc")).toHaveLength(mcSlots);
      expect(out.issues).toEqual([]);
    });
  }
  it("교체 뒤 독립 검증기 위반 0(55 MC·묶음 5·장르·범주 1–7·FRQ q1/q2/q3·시험 간 서로소), 장르 묶음·크기 보존, 범주 상·하한 안(LT1 범주 6 ≥ 5)", () => {
    const a = replay("LT1", "LT2").next, b = replay("LT2", "LT1").next;
    expect(verifyLtAssignment([resultOf("LT1", a, by), resultOf("LT2", b, by)])).toEqual([]);
    const g = (id: "LT1" | "LT2", s: typeof a) => resultOf(id, s, by).sets.map((c) => `${c.group}:${c.members.length}`).sort(); expect(g("LT1", a)).toEqual(g("LT1", V2.LT1)); expect(g("LT2", b)).toEqual(g("LT2", V2.LT2));
    const bd = englitCategoryBounds(); for (const [id, s] of [["LT1", a], ["LT2", b]] as const) { const c = categorySummary(resultOf(id, s, by)); for (const k of Object.keys(bd)) { expect(c[k] ?? 0).toBeGreaterThanOrEqual(bd[k].min); expect(c[k] ?? 0).toBeLessThanOrEqual(bd[k].max); } }
    expect(categorySummary(resultOf("LT1", a, by))["6"]).toBeGreaterThanOrEqual(5);
    const keys = (s: typeof a) => s.map((x) => x.candidateKey); expect(keys(a)).toEqual(expect.arrayContaining(["lt-real-2:ap_english_literature-real-ls3-k0", "lt-real-2:ap_english_literature-real-ll4-k0", "lt-real-2:ap_english_literature-real-rf3-k0"])); expect(keys(b)).toEqual(expect.arrayContaining(["lt-real-2:ap_english_literature-real-ls5-k0", "lt-real-2:ap_english_literature-real-ll1-k0"]));
  });
  it("Stage 1 이 아직 공개되지 않았어도(원본 = 게시 v1) 같은 교체 칸이 존재한다(계획은 v2 가 원본이라고 선언하므로 v1 에는 적용 불가 — 미리보기가 version 불일치를 알린다)", () => {
    for (const id of ["LT1", "LT2"] as const) for (const [rk] of STAGE_2[id].mc) expect(snap[id].slots.some((s) => s.candidateKey === rk)).toBe(true);
  });
});
describe("lt-real-2 배치", () => {
  const reg = rd<Registry>("data/ap/englit-sources/registry.json"); const mcs = items.filter((i) => i.kind === "mc"); const sizes: Record<string, number> = { ls3: 13, ll4: 10, ls5: 13, ll1: 8 };
  it("등록·통과 키·화면 증거 파일명, 5건(MC 4 + FRQ 1)", () => {
    expect(STOCK_BATCHES.find((x) => x.id === "lt-real-2")).toMatchObject({ itemsFile: "lt-real-2-items.json", passKeysFile: "lt-real-2-pass-keys.json", evidenceFile: "evidence-lt-real-2.json", supplement: true });
    expect(rd<string[]>("data/ap/stock/lt-real-2-pass-keys.json")).toEqual(items.map((i) => i.stockKey)); expect(items).toHaveLength(5); expect(mcs).toHaveLength(4);
    for (const i of items) { expect(i.validation).toBe("auto_passed"); expect(i.sourceKind ?? "real_public_domain").toBe("real_public_domain"); expect(i.stimulusOrigin).toBe("real_public_domain_text"); }
  });
  it("지문 머리말 = 'Public-domain source text — 저자, 작품, 판본', 영어 지문으로 인식, 출처·재사용 근거 기록, ALTON 창작 표지 없음", () => {
    for (const i of items) {
      const e = reg.entries.find((x) => x.id === i.sourceRegistryIds[0])!; const head = String(i.payload.set_intro).split("\n")[0];
      expect(head).toBe(realAttribution(e)); expect(head.startsWith("Public-domain source text — ")).toBe(true); expect(head).toContain(e.author); expect(head).not.toMatch(/Gutenberg|UNVERIFIED/); expect(startsWithRealTextMarker(i.payload.set_intro)).toBe(true); expect(isEnglishPassage(i.payload.set_intro)).toBe(true); expect(i.payload.set_intro).not.toContain("ALTON original");
      const prov = i.kind === "mc" ? i.payload.provenance : i.payload.lit_frq.passage.provenance; expect(prov.registry_id ?? e.id).toBe(e.id); if (i.kind === "mc") expect(prov.reuse_basis).toMatch(/public domain/i);
    }
  });
  it("지문은 등록부 저장 텍스트와 글자 그대로 같고(저장 형식 = 시 줄 단위·산문/희곡 56자 접힘 줄, 기존 ALTON 지문과 같은 경로), 시는 30줄 이상, Crane FRQ 는 600–800단어", () => {
    for (const c of mcs) { const k = String(c.cellId).split("-").pop()!; const e = reg.entries.find((x) => x.id === c.sourceRegistryIds[0])!; const set = realSet(e, readFileSync(path.join("data/ap/englit-sources", e.text_file), "utf-8")); expect(c.payload.lt_passage.stanzas).toEqual(set.stanzas); expect(c.payload.lt_passage.group).toBe({ ls3: "short", ll4: "longer", ls5: "poetry", ll1: "longer" }[k]); expect(c.payload.items).toHaveLength(sizes[k]); }
    const dover = mcs.find((c) => String(c.cellId).endsWith("-ls5"))!; expect(dover.payload.lt_passage.line_count).toBeGreaterThanOrEqual(30); expect(dover.payload.lt_passage.form).toBe("poem");
    const f = items.find((i) => i.kind !== "mc")!; const en = reg.entries.find((x) => x.id === "crane-open-boat-q2")!; expect(f.payload.lit_frq.passage.stanzas).toEqual(realSet(en, readFileSync(path.join("data/ap/englit-sources", en.text_file), "utf-8")).stanzas); expect(frqViolations(f.payload.lit_frq as LtFrqPayload, [], { realText: true })).toEqual([]);
    const words = (f.payload.lit_frq.passage.stanzas as string[][]).flat().join(" ").split(/\s+/).filter(Boolean).length; expect(words).toBeGreaterThanOrEqual(600); expect(words).toBeLessThanOrEqual(800); expect(f.payload.lit_frq.samples).toHaveLength(3);
  });
  it("Crane 확장 발췌는 기존 등록부 발췌(531단어)의 글자 그대로 연장(앞 9문단 동일)", () => {
    const a = readFileSync("data/ap/englit-sources/texts/crane-open-boat.txt", "utf-8").trim(); const b = readFileSync("data/ap/englit-sources/texts/crane-open-boat-q2.txt", "utf-8"); expect(b.startsWith(a)).toBe(true);
    const c = readFileSync("data/ap/englit-sources/texts/chopin-silk-stockings.txt", "utf-8").trim(); expect(readFileSync("data/ap/englit-sources/texts/chopin-silk-stockings-long.txt", "utf-8").startsWith(c)).toBe(true);
  });
  it("문항 단위: 근거 위치가 등록부 텍스트에서 코드로 다시 계산한 값과 같고, 키 위치 균형·설정(범주 2) ≤1·줄 참조 치환 완료·정답 가장 긴 선지 아님·검증 기록(풀이 2·적대·심판·Fable 패널 일치)", () => {
    for (const c of mcs) { const e = reg.entries.find((x) => x.id === c.sourceRegistryIds[0])!; const set = realSet(e, readFileSync(path.join("data/ap/englit-sources", e.text_file), "utf-8")); const its = c.payload.items as J[];
      for (const it of its) { const rt = it.real_text; const re = locate(set, rt.key_evidence.quote); expect("error" in re).toBe(false); expect(re).toMatchObject({ from: rt.key_evidence.from, to: rt.key_evidence.to }); expect(rt.distractor_evidence).toHaveLength(3); expect(rt.distractor_evidence.filter((d: J) => d.evidence_kind === "text").length).toBeGreaterThanOrEqual(2); expect(it.options).toHaveLength(4); expect(it.stem).not.toMatch(/\[\[/); expect(it.explanation_en).toBeTruthy();
        const v = rt.verification; expect(v.verified).toBe(true); expect(new Set(v.solver_votes).size).toBe(1); expect(v.solver_votes[0]).toBe(it.key_index); expect(v.panel_agree).toBe(true); expect(v.panel_choice).toBe(it.key_index);
        const len = it.options.map((o: J) => String(o.text).length); expect(len[it.key_index]).toBeLessThan(Math.max(...len)); expect(lengthCueRatio({ options: it.options.map((o: J, i: number) => ({ ...o, is_key: i === it.key_index })) })).toBeLessThan(LENGTH_CUE_RATIO); }
      expect(keyPositionViolations(its.map((i) => i.key_index))).toEqual([]); expect(its.filter((i) => String(i.skill).startsWith("2.")).length).toBeLessThanOrEqual(1); expect(new Set(its.map((i) => String(i.stem).toLowerCase())).size).toBe(its.length); }
  });
  it("FRQ 샘플 3개를 운영 채점 경로(processEssay, englit-v1)로 채점한 기록: 모두 완료·서열 6>4>2 유지", () => {
    const f = rd<J>("data/ap/stock/lt-real-2-summary.json").frqProcessEssay; expect(f.rows).toHaveLength(3); for (const r of f.rows) { expect(r.status).toBe("done"); expect(Math.abs(r.got - r.target)).toBeLessThanOrEqual(1); } for (const o of f.ordering) expect(o.ok).toBe(true);
  });
});
