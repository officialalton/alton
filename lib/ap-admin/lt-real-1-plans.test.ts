// AP English Literature Stage 1(lt-real-1) 새 버전 계획의 정합성. DB 없이, 2026-10-15 SELECT 전용 스냅샷(게시 LT1·LT2 v1 슬롯 + 후보 메타)으로
// 관리자 새 버전 미리보기와 같은 경로(parseSwapPlan → resolveSwaps → checkNewVersionComposition, unitBounds = fullPracticeUnitBounds)를 재생하고,
// 교체 뒤 구성을 독립 검증기(verifyLtAssignment)로 다시 확인한다. 배치 등록·지문 머리말·출처 기록·등록부 원문 일치도 고정한다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fullPracticeUnitBounds } from "../ap-exam/full-set-rules";
import { startsWithRealTextMarker, isEnglishPassage } from "../ap-exam/stimulus-display";
import { checkNewVersionComposition, type SlotItem } from "../mock-exam/new-version";
import { frqViolations, type LtFrqPayload } from "../ap-generation/englit-frq";
import { locate, realAttribution, realSet } from "../ap-generation/englit-real";
import { keyPositionViolations } from "../ap-generation/englang-gates";
import type { Registry } from "../ap-generation/englit-sources";
import { loadLtPool } from "../../scripts/ap-generation/lt-pool";
import { verifyLtAssignment } from "../../scripts/ap-generation/lt-assign";
import { applySwaps, planFor, resultOf, STAGE_1, type Snap } from "../../scripts/ap-generation/lt-real-1-plans";
import { STOCK_BATCHES } from "./batches";
import { parseSwapPlan, resolveSwaps } from "./new-version";

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const snap = rd<Snap>("data/ap/stock/lt1-lt2-published-v1-slots.json");
const items = rd<J[]>("data/ap/stock/lt-real-1-items.json"); const newBy = new Map(items.map((i) => [i.stockKey as string, i]));
const cands = new Map<string, J>([...(snap.cands as J[]).map((c) => [c.candidate_key as string, c] as [string, J]), ...items.map((i) => [i.stockKey as string, { candidate_key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq_bundle", keyword_code: i.keywordCode, item_family_id: i.itemFamilyId, calculator: "na" }] as [string, J])]);
const { all } = loadLtPool({ requireScreen: false }); const by = new Map(all.map((c) => [c.key, c]));
const size = (key: string) => (by.get(key)?.kind === "mc" ? by.get(key)!.members.length : 1);
const brief = (key: string | null) => { const c = key ? cands.get(key) : undefined; return { candidateKey: key, kind: (c?.kind === "mc" ? "mc" : c?.kind ? "frq" : null) as "mc" | "frq" | null, unit: (c?.keyword_code as string | undefined)?.split(".")[0] ?? null, family: (c?.item_family_id as string | undefined) ?? null, calculator: (c?.calculator as string | undefined) ?? null }; };

function replay(id: "LT1" | "LT2", other: "LT1" | "LT2") {
  const cur = snap[id].slots; const plan = parseSwapPlan(rd(`data/ap/stock/${id.toLowerCase()}-v2-real-1-swap-plan.json`));
  const res = resolveSwaps(plan.swaps, cur.map((s) => ({ section: s.section, position: s.position, candidateKey: s.candidateKey })));
  const idx = (s: { section: string; position: number; candidateKey: string }) => cur.filter((x) => x.section === s.section && x.candidateKey === s.candidateKey).sort((a, b) => a.position - b.position).findIndex((x) => x.position === s.position);
  const slots: SlotItem[] = cur.map((s) => ({ section: s.section, position: s.position, problemId: `${s.candidateKey}#${idx(s)}`, ...brief(s.candidateKey) }));
  const pid = (sw: { addKey: string; addIndex?: number }) => `${sw.addKey}#${sw.addIndex ?? 0}`;
  const actionSwaps = res.swaps.map((s) => ({ section: s.section, position: s.position, problemId: pid(s) }));
  const used = new Set(snap[other].slots.map((s) => `${s.candidateKey}#${idx2(other, s)}`));
  const out = checkNewVersionComposition(slots, actionSwaps, { apLabel: "full_practice", sectionCalculator: { ap_mc: "na", ap_frq: "na" }, unitBounds: fullPracticeUnitBounds("ap_english_literature", "full_practice"), usedByOtherExams: used,
    setSizes: new Map([...new Set(res.swaps.map((s) => s.addKey))].map((k) => [k, size(k)] as [string, number])), replacements: new Map(res.swaps.map((s) => [pid(s), { problemId: pid(s), ...brief(s.addKey) }])) });
  return { plan, res, out, next: applySwaps(cur, plan.swaps.map((s) => ({ section: s.section, removeKey: s.removeKey!, addKey: s.addKey }))) };
}
const idx2 = (id: "LT1" | "LT2", s: { section: string; position: number; candidateKey: string }) => snap[id].slots.filter((x) => x.section === s.section && x.candidateKey === s.candidateKey).sort((a, b) => a.position - b.position).findIndex((x) => x.position === s.position);

describe("스냅샷", () => {
  it("게시 v1 두 시험: MC 55 + FRQ 3, FRQ 칸 순서가 Q1 시·Q2 산문·Q3 논증", () => {
    for (const id of ["LT1", "LT2"] as const) { expect(snap[id].sourceVersionNo).toBe(1); expect(snap[id].slots.filter((s) => s.section === "ap_mc")).toHaveLength(55); const f = snap[id].slots.filter((s) => s.section === "ap_frq").sort((a, b) => a.position - b.position); expect(f.map((s) => by.get(s.candidateKey)!.frqType)).toEqual(["q1", "q2", "q3"]); }
    expect(verifyLtAssignment([resultOf("LT1", snap.LT1.slots, by), resultOf("LT2", snap.LT2.slots, by)])).toEqual([]);
  });
});
describe("LT1·LT2 Stage 1 계획", () => {
  for (const [id, other, n, mcSwapSlots] of [["LT1", "LT2", 9, 8], ["LT2", "LT1", 1, 0]] as const) {
    it(`${id}: 계획 형식·제거 문항이 그 칸에 있음·실제 새 버전 검사 통과`, () => {
      const raw = rd<J>(`data/ap/stock/${id.toLowerCase()}-v2-real-1-swap-plan.json`); const { res, out, plan } = replay(id, other);
      expect(plan.sourceVersionNo).toBe(1); expect(raw.verifierViolations).toEqual([]); expect(raw.swapCount).toBe(plan.swaps.length); expect(raw.swapCount).toBe(STAGE_1[id].mc.length + STAGE_1[id].frq.length);
      for (const sw of plan.swaps) expect(snap[id].slots.find((x) => x.section === sw.section && x.position === sw.position)?.candidateKey).toBe(sw.removeKey);
      expect(res.problems).toEqual([]); expect(res.swaps).toHaveLength(n); expect(res.swaps.filter((s) => s.section === "ap_mc")).toHaveLength(mcSwapSlots);
      expect(out.issues).toEqual([]);
    });
  }
  it("교체 뒤 독립 검증기 위반 0(55 MC·묶음 5·장르·범주 1–7·FRQ q1/q2/q3·시험 간 서로소) + 장르 묶음·MC 칸 수 보존", () => {
    const a = replay("LT1", "LT2").next, b = replay("LT2", "LT1").next;
    expect(verifyLtAssignment([resultOf("LT1", a, by), resultOf("LT2", b, by)])).toEqual([]);
    const g = (id: "LT1" | "LT2", s: typeof a) => { const r = resultOf(id, s, by); return r.sets.map((c) => `${c.group}:${c.members.length}`).sort(); };
    expect(g("LT1", a)).toEqual(g("LT1", snap.LT1.slots)); expect(g("LT2", b)).toEqual(g("LT2", snap.LT2.slots));
    expect(a.filter((s) => s.section === "ap_mc")).toHaveLength(55); expect(a.filter((s) => s.section === "ap_frq").map((s) => s.candidateKey)).toContain("lt-real-1:ap_english_literature-real-rf1-k0"); expect(b.filter((s) => s.section === "ap_frq").map((s) => s.candidateKey)).toContain("lt-real-1:ap_english_literature-real-rf2-k0");
  });
  it("FRQ 교체는 같은 유형 칸 안(Q1 시 ↔ Q1, Q2 산문 ↔ Q2)에서만 이뤄지고, 유형이 다르면 계획기가 막는다", () => {
    expect(by.get("lt-real-1:ap_english_literature-real-rf1-k0")!.frqType).toBe("q1"); expect(by.get("lt-real-1:ap_english_literature-real-rf2-k0")!.frqType).toBe("q2");
    const bad = planFor("LT2", snap.LT2.slots, by, { mc: [], frq: [["englit-p1-b:ap_english_literature-fa2-k0", "lt-real-1:ap_english_literature-real-rf1-k0"]] }); expect(bad.problems.join(" ")).toMatch(/FRQ 유형이 다름/);
  });
  it("MC 세트 교체는 같은 크기·같은 장르 묶음만 허용한다", () => {
    const bad = planFor("LT1", snap.LT1.slots, by, { mc: [["englit-p1-a:ap_english_literature-p03-k0", "englit-p1-a:ap_english_literature-p06-k0"]], frq: [] }); expect(bad.problems.join(" ")).toMatch(/MC 세트 크기가 다름|장르 묶음이 다름/);
  });
});
describe("lt-real-1 배치", () => {
  const reg = rd<Registry>("data/ap/englit-sources/registry.json"); const mc = items.find((i) => i.kind === "mc")!;
  it("등록·통과 키·화면 증거 파일명", () => {
    expect(STOCK_BATCHES.find((x) => x.id === "lt-real-1")).toMatchObject({ itemsFile: "lt-real-1-items.json", passKeysFile: "lt-real-1-pass-keys.json", evidenceFile: "evidence-lt-real-1.json", supplement: true });
    expect(rd<string[]>("data/ap/stock/lt-real-1-pass-keys.json")).toEqual(items.map((i) => i.stockKey)); expect(items).toHaveLength(3);
    for (const i of items) { expect(i.validation).toBe("auto_passed"); expect(i.sourceKind ?? "real_public_domain").toBe("real_public_domain"); expect(i.stimulusOrigin).toBe("real_public_domain_text"); }
  });
  it("지문 머리말 = 'Public-domain source text — 저자, 작품, 판본', 영어 지문으로 인식, 출처·재사용 근거 기록", () => {
    for (const i of items) {
      const e = reg.entries.find((x) => x.id === i.sourceRegistryIds[0])!; const head = String(i.payload.set_intro).split("\n")[0];
      expect(head).toBe(realAttribution(e)); expect(head.startsWith("Public-domain source text — ")).toBe(true); expect(head).toContain(e.author); expect(head).toContain(e.title); expect(head).not.toMatch(/Gutenberg/); expect(startsWithRealTextMarker(i.payload.set_intro)).toBe(true); expect(isEnglishPassage(i.payload.set_intro)).toBe(true); expect(i.payload.set_intro).not.toContain("ALTON original");
      const prov = i.kind === "mc" ? i.payload.provenance : i.payload.lit_frq.provenance ?? i.payload.lit_frq.passage.provenance; expect(prov.registry_id ?? e.id).toBe(e.id);
    }
    expect(mc.payload.provenance).toMatchObject({ kind: "public_domain", registry_id: "dickinson-chariot" }); expect(mc.payload.provenance.reuse_basis).toMatch(/public domain/i);
  });
  it("지문은 등록부 저장 텍스트와 글자 그대로 같다(시 20줄, FRQ 도 같은 원문)", () => {
    const e = reg.entries.find((x) => x.id === "dickinson-chariot")!; const set = realSet(e, readFileSync(path.join("data/ap/englit-sources", e.text_file), "utf-8")); expect(mc.payload.lt_passage.stanzas).toEqual(set.stanzas);
    for (const [cell, id] of [["rf1", "hopkins-grandeur"], ["rf2", "chekhov-lady-dog"]] as const) { const i = items.find((x) => x.cellId.endsWith(cell))!; const en = reg.entries.find((x) => x.id === id)!; const s = realSet(en, readFileSync(path.join("data/ap/englit-sources", en.text_file), "utf-8")); expect(i.payload.lit_frq.passage.stanzas).toEqual(s.stanzas); expect(frqViolations(i.payload.lit_frq as LtFrqPayload, [], { realText: true })).toEqual([]); }
  });
  it("Chekhov 발췌는 공식 산문 FRQ 범위(약 600–800단어) 안, Hopkins 는 시 FRQ 범위(100–400단어) 안", () => {
    const words = (c: string) => { const p = items.find((x) => x.cellId.endsWith(c))!.payload.lit_frq.passage.stanzas as string[][]; return p.flat().join(" ").split(/\s+/).filter(Boolean).length; };
    expect(words("rf2")).toBeGreaterThanOrEqual(600); expect(words("rf2")).toBeLessThanOrEqual(800); expect(words("rf1")).toBeGreaterThanOrEqual(100); expect(words("rf1")).toBeLessThanOrEqual(400);
  });
  it("문항 단위: 근거 위치가 등록부 텍스트에서 코드로 다시 계산한 값과 같고, 키 위치 균형·설정(범주 2) ≤1·줄 참조 치환 완료", () => {
    const e = reg.entries.find((x) => x.id === "dickinson-chariot")!; const set = realSet(e, readFileSync(path.join("data/ap/englit-sources", e.text_file), "utf-8"));
    for (const it of mc.payload.items as J[]) { const rt = it.real_text; const re = locate(set, rt.key_evidence.quote); expect("error" in re).toBe(false); expect(re).toMatchObject({ from: rt.key_evidence.from, to: rt.key_evidence.to }); expect(rt.distractor_evidence).toHaveLength(3); expect(it.options).toHaveLength(4); expect(it.stem).not.toMatch(/\[\[/); expect(it.explanation_en).toBeTruthy(); }
    expect(keyPositionViolations((mc.payload.items as J[]).map((i) => i.key_index))).toEqual([]); expect((mc.payload.items as J[]).filter((i) => String(i.skill).startsWith("2.")).length).toBeLessThanOrEqual(1);
    expect(new Set((mc.payload.items as J[]).map((i) => String(i.stem).toLowerCase())).size).toBe(8); expect((mc.payload.excluded_items as J[]).length).toBe(3);
  });
  it("MC 8문항: 1차 전 단계 검증(블라인드 풀이 2·적대·심판·Fable 패널 전원 일치) + 재검증(같은 파이프라인 재실행) — 7문항은 재실행에서도 키와 일치, 1문항은 새로 생성·검증해 교체", () => {
    expect(mc.payload.items).toHaveLength(8); const sum = rd<J>("data/ap/stock/lt-real-1-summary.json"); const re = sum.reverification.mc as J[]; expect(re).toHaveLength(8);
    const panel = rd<J>("data/ap/sample-2027/englit-real-2/panel.json").rs1 as (J | null)[];
    mc.payload.items.forEach((it: J, i: number) => {
      const v = it.real_text.verification; expect(v.verified).toBe(true); expect(new Set(v.solver_votes).size).toBe(1); expect(v.panel_agree).toBe(true);
      if (i === 6) { expect(it.real_text.regenerated_in).toBe("englit-real-3"); expect(it.skill).toBe("5.A"); expect(re[i].reasons).toContain("solver_reports_second_defensible_option"); return; } // 재실행에서 탈락한 4.A → 교체
      expect(re[i].solverVotes).toEqual([it.key_index, it.key_index]); expect(re[i].key).toBe(it.key_index); expect(re[i].judge).toBe("key_clearly_better"); expect(re[i].adversary).not.toBe("strong"); expect(panel[i]?.agree).toBe(true); expect(panel[i]?.choice).toBe(it.key_index);
      if (![1, 5].includes(i)) expect(re[i].pass).toBe(true); else { expect(re[i].pass).toBe(false); expect(re[i].reasons).toEqual([]); expect(re[i].score).toBeGreaterThan(0.78); } // 경계: 점수 0.788 < 0.8 만 미달, 실질 이견 없음
    });
  });
  it("FRQ 샘플 6개를 운영 채점 경로(processEssay, englit-v1)로 재채점한 기록: 모두 완료·서열 유지·오차 1 이내", () => {
    const f = rd<J>("data/ap/stock/lt-real-1-summary.json").reverification.frq; expect(f.rows).toHaveLength(6);
    for (const r of f.rows) { expect(r.status).toBe("done"); expect(Math.abs(r.got - r.target)).toBeLessThanOrEqual(1); } for (const o of f.ordering) expect(o.ok).toBe(true);
  });
});
