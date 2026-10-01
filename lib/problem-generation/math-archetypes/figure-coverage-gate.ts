// 자료 원형 커버리지 게이트 G1~G9 평가기(조사 문서 5-5). 게이트 테스트와 보고서 생성(WRITE_GATE_REPORT=1)이 이 함수를 쓴다.
//   G1 manifest 완전성 · G2 수량(hard 4 연산자 + easy/medium) · G3 렌더러 준비 · G4 시드 스윕(생성 실패 0·자료 존재·checkFigure·내용 검사) ·
//   G5 정답 재계산(+자료 의존 검사, verifyInstance 안) · G6 돌연변이(자료 변조·정답 키 교환) · G7 분포·중복 · G8 렌더 구조 검사(figure-qa.ts: 비율·값 충실도·라벨·축척·단위·자료 존재) ·
//   G9 시각 검수 판정(조합 PNG 를 검수자가 보고 남긴 판정 — 현재 코드 해시와 같을 때만 유효) · G10 SPR 공급(30세트 규모).
// 2026-10-01 시각 검수 절차(docs/qa/2026-10-01-math-figure-visual-qa.md) 추가에 맞춰 번호를 다시 정했다: G8 = 렌더 구조 검사(자동), G9 = 시각 검수 판정(코드 해시 기준), G10 = SPR 공급.
// 면제(waiver)는 두지 않는다 — hard 4개를 못 채우는 항목은 면제하지 않고 fail 로 보고한다(오너 결정 2026-10-01).
import { ARCHETYPES } from "./registry";
import { D_ARCHETYPES } from "./registry-d";
import { FIGURE_ITEMS, NO_FIGURE, sprPlanned, type FigureItemRow } from "./figure-coverage-manifest";
import type { GateReport, ItemResult } from "./figure-coverage";
import { checkInstanceFigureQa } from "./figure-qa";
import { codeHash, reviewStatus } from "./figure-qa-hash";
import { qaSamples } from "./figure-qa-samples";
import { generateOne, bodyShingles, jaccard, type Fmt } from "./sweep";
import { verifyLevel, type LArch } from "./levels-d";
import { verifyInstance } from "./verify";
import { sprCapability, levelOf } from "./spr-capability";
import { sprTarget } from "./spr";
import { CHOICES_LINE, FIGURE_LINE, TAMPER_MODES, tamperFigure, type TamperMode } from "./figure-verify";
import type { Archetype, Instance } from "./types";

/** SPR 공급 요구(30세트 × 세트당 hard SPR 약 2개). 같은 유사문항 그룹은 한 세트에 하나라 그룹 수가 60 이상이어야 그룹을 재사용하지 않고 30세트를 채운다. */
export const SPR_SETS = 30, SPR_HARD_PER_SET = 2, SPR_REQUIRED_GROUPS = SPR_SETS * SPR_HARD_PER_SET;

const verifyAny = (a: Archetype, inst: Instance) => ((a as LArch).level ? verifyLevel(a as LArch, inst) : verifyInstance(a, inst));
export const figureArchetypes = (): LArch[] => D_ARCHETYPES.filter((a) => a.figureItem);

function mutate(inst: Instance, mode: TamperMode): Instance {
  const figure = tamperFigure(inst.figure, mode); let js = inst.verificationJs;
  if (CHOICES_LINE.test(js)) js = js.replace(CHOICES_LINE, `const CHOICES = ${JSON.stringify((figure as { choices: unknown[] }).choices)};`);
  else js = js.replace(FIGURE_LINE, `const FIGURE = ${JSON.stringify(figure)};`);
  return { ...inst, figure, verificationJs: js };
}
export const mutantsOf = (inst: Instance): Instance[] => TAMPER_MODES.map((m) => mutate(inst, m)).filter((m) => JSON.stringify(m.figure) !== JSON.stringify(inst.figure));
export const keySwapped = (inst: Instance): Instance => (inst.format === "spr" ? { ...inst, answers: ["999"] } : { ...inst, correctIndex: (inst.correctIndex + 1) % 4 });

export type ArchResult = { id: string; fmt: Fmt; seeds: number; produced: number; genFail: number; thrown: number; verifyFail: number; noFigure: number; failSamples: string[]; slots: number[]; variants: Record<string, number>; qaFail: number; qaSamples: string[]; dup: number; /** 시드 0~199 안의 지문+자료 완전 중복(게이트 기준: 2% 이하) */ dup200: number; /** 시드 전체 범위의 완전 중복률 정보(조합 공간의 크기를 보여 준다) */ dupAll: number; independent: number; mutants: number; mutantsCaught: number; keyCaught: number; keyTotal: number; groups: string[] };
export function sweepFigureArchetype(a: LArch, seeds: number, fmt: Fmt, o: { mutationSeeds?: number; independentCap?: number } = {}): ArchResult {
  const r: ArchResult = { id: a.id, fmt, seeds, produced: 0, genFail: 0, thrown: 0, verifyFail: 0, noFigure: 0, failSamples: [], slots: [0, 0, 0, 0], variants: {}, qaFail: 0, qaSamples: [], dup: 0, dup200: 0, dupAll: 0, independent: 0, mutants: 0, mutantsCaught: 0, keyCaught: 0, keyTotal: 0, groups: [] };
  const seen = new Set<string>(); const keep: Set<string>[] = []; const cap = o.independentCap ?? 400; const mut = o.mutationSeeds ?? 12;
  for (let s = 0; s < seeds; s++) {
    const g = generateOne(a, s, fmt);
    if (!g.ok) { if (g.why === "genfail") { r.genFail++; if (r.failSamples.length < 3) r.failSamples.push(`genfail: ${g.msg}`); } else { r.thrown++; if (r.failSamples.length < 3) r.failSamples.push(`throw: ${g.msg}`); } continue; }
    const v = verifyAny(a, g.inst);
    if (!v.ok) { r.verifyFail++; if (r.failSamples.length < 3) r.failSamples.push(`seed ${s}: ${v.failures.join(" | ").slice(0, 200)}`); continue; }
    if (!g.inst.figure) r.noFigure++;
    if (s < 200) { const q = checkInstanceFigureQa(g.inst); if (q.length) { r.qaFail++; if (r.qaSamples.length < 3) r.qaSamples.push(`seed ${s}: ${q.map((x) => x.code).join(",")} ${q[0].message}`); } }
    r.produced++; r.variants[g.inst.variant] = (r.variants[g.inst.variant] ?? 0) + 1;
    if (fmt === "mc" && g.inst.correctIndex >= 0) r.slots[g.inst.correctIndex]++;
    const fp = JSON.stringify([g.inst.stimulus, g.inst.question, g.inst.options, g.inst.figure]); if (seen.has(fp)) { r.dupAll++; if (s < 200) r.dup200++; } else seen.add(fp);
    if (s < cap) { const sh = bodyShingles(g.inst); if (keep.every((k) => jaccard(k, sh) < 0.6)) keep.push(sh); }
    if (s < mut && g.inst.figure) {
      r.mutants++; if (mutantsOf(g.inst).some((m) => !verifyAny(a, m).ok)) r.mutantsCaught++;
      r.keyTotal++; if (!verifyAny(a, keySwapped(g.inst)).ok) r.keyCaught++;
    }
  }
  r.independent = keep.length; r.dup = r.dupAll; r.groups = Object.keys(r.variants).map((v) => `${a.groupId ?? a.id}/${v}`);
  return r;
}

export type GateOptions = { seeds: number; mutationSeeds?: number };
export function evaluateCoverageGate(o: GateOptions): { report: GateReport; arch: ArchResult[] } {
  const figArch = figureArchetypes(); const byItem = new Map<string, LArch[]>();
  for (const a of figArch) byItem.set(a.figureItem!, [...(byItem.get(a.figureItem!) ?? []), a]);
  const arch: ArchResult[] = []; const items: Record<string, ItemResult> = {}; const sprByItem: Record<string, number> = {};
  const gates: GateReport["gates"] = {}; const qaByItem: GateReport["qaByItem"] = {};
  // G1 manifest 완전성
  const legacy = new Set(ARCHETYPES.filter((a) => !a.figureItem).map((a) => `${a.skill}.${a.kind}`));
  const manifestPatterns = new Set([...FIGURE_ITEMS.filter((r) => r.source === "A").map((r) => `${r.skill}.${r.kind}`), ...NO_FIGURE.filter((r) => r.source === "A").map((r) => `${r.skill}.${r.kind}`)]);
  const g1Missing = [...legacy].filter((p) => !manifestPatterns.has(p)); const ids = new Set(FIGURE_ITEMS.map((r) => r.id)); const g1Orphans = figArch.filter((a) => !ids.has(a.figureItem!)).map((a) => a.id);
  const g1Dup = FIGURE_ITEMS.length - ids.size;
  gates.G1 = { ok: !g1Missing.length && !g1Orphans.length && !g1Dup, note: `기존 패턴 ${legacy.size}개 중 manifest 누락 ${g1Missing.length}, manifest 밖 자료 원형 ${g1Orphans.length}, 중복 id ${g1Dup}${g1Missing.length ? ` (${g1Missing.slice(0, 5).join(", ")})` : ""}` };
  for (const row of FIGURE_ITEMS) {
    const list = byItem.get(row.id) ?? []; const blocked = row.support.startsWith("미지원");
    if (!list.length) { items[row.id] = { status: blocked ? "blocked_renderer" : "unimplemented", hard: 0, em: 0, operators: [], sprHard: 0, failures: [], qa: { state: "unimplemented", detail: "구현되지 않은 조합" } }; qaByItem[row.id] = { state: "unimplemented", detail: "구현되지 않은 조합" }; continue; }
    const hard = list.filter((a) => a.level === "hard"), em = list.filter((a) => a.level !== "hard"); const failures: string[] = [];
    const ops = hard.map((a) => a.operator); // G2
    if (hard.length < 4 || new Set(ops).size < 4) failures.push(`G2 hard 원형 ${hard.length}개·서로 다른 연산자 ${new Set(ops).size}개(4 필요)`);
    if (em.filter((a) => a.level === "easy").length < 1 || em.filter((a) => a.level === "medium").length < 1) failures.push(`G2 easy/medium 틀 ${em.length}개(easy 1·medium 1 이상, 목표 2~3)`);
    if (blocked) failures.push("G3 필요한 렌더러가 미지원");
    let sprHard = 0; const variantNames = new Set<string>();
    for (const a of list) {
      const modes: Fmt[] = a.level === "hard" && sprCapability(a).capable ? ["mc", "spr"] : ["mc"];
      for (const fmt of modes) {
        const r = sweepFigureArchetype(a, o.seeds, fmt, { mutationSeeds: o.mutationSeeds }); arch.push(r);
        if (r.genFail || r.thrown || r.verifyFail) failures.push(`G4/G5 ${a.id}(${fmt}): 생성 실패 ${r.genFail}·예외 ${r.thrown}·검증 실패 ${r.verifyFail} — ${r.failSamples[0] ?? ""}`);
        if (r.noFigure) failures.push(`G4 ${a.id}(${fmt}): 자료 없는 인스턴스 ${r.noFigure}개`);
        if (r.qaFail) failures.push(`G8 ${a.id}(${fmt}): 렌더 구조 검사 실패 ${r.qaFail}건(시드 0~199) — ${r.qaSamples[0] ?? ""}`);
        if (r.produced === 0) failures.push(`G4 ${a.id}(${fmt}): 산출 0`);
        if (r.mutants && r.mutantsCaught / r.mutants < 0.97) failures.push(`G6 ${a.id}(${fmt}): 자료 변조 검출 ${r.mutantsCaught}/${r.mutants}`);
        if (r.keyTotal && r.keyCaught !== r.keyTotal) failures.push(`G6 ${a.id}(${fmt}): 정답 키 변조 검출 ${r.keyCaught}/${r.keyTotal}`);
        if (r.dup200 > Math.ceil(Math.min(200, r.produced) * 0.02)) failures.push(`G7 ${a.id}(${fmt}): 시드 200 내 지문+자료 완전 중복 ${r.dup200}(2% 초과)`);
        if (fmt === "mc" && a.level === "hard") for (const v of Object.keys(r.variants)) variantNames.add(`${a.id}/${v}`);
        if (fmt === "mc" && r.produced >= 100 && !a.qualitative) { const tot = r.slots.reduce((x, y) => x + y, 0); if (tot >= 100) { const mx = Math.max(...r.slots) / tot, mn = Math.min(...r.slots) / tot; if (mx > 0.4 || mn < 0.12) failures.push(`G7 ${a.id}: 정답 자리 편향 ${r.slots.join("/")}`); } }
        if (fmt === "spr" && a.level === "hard") sprHard++;
        if (a.level === "hard" && fmt === "mc" && r.independent < 30 && o.seeds >= 400) failures.push(`G7 ${a.id}: 독립 변형 ${r.independent} < 30`);
      }
    }
    if (variantNames.size < 3) failures.push(`G7 항목의 hard 변형 ${variantNames.size}개(3 이상 필요)`);
    // G9 시각 검수: 현재 코드 해시 기준 판정이 pass 여야 한다
    const types = [...new Set(qaSamples(row.id).flatMap((x) => x.types))]; const cur = codeHash(row.id, types); const st = reviewStatus(row.id, cur);
    qaByItem[row.id] = { state: st.state, detail: st.detail }; if (st.state !== "pass") failures.push(`G9 시각 검수 ${st.state}: ${st.detail}`);
    items[row.id] = { status: failures.length ? "fail" : "pass", hard: hard.length, em: em.length, operators: ops, sprHard, failures, qa: qaByItem[row.id] }; sprByItem[row.id] = sprHard;
  }
  // G9 SPR 공급: 자료 원형이 있는 skill 의 hard 버킷에서 SPR 가능 유사문항 그룹 수
  const skills = [...new Set(figArch.map((a) => a.skill))]; const g9: string[] = []; let supply = 0;
  for (const sk of skills) {
    const hardAll = ARCHETYPES.filter((a) => a.skill === sk && levelOf(a) === "hard"); const groupsOf = (a: Archetype) => { const vs = new Set<string>(); for (let s = 0; s < 60; s++) { const g = generateOne(a, s); if (g.ok) vs.add(g.inst.variant); } return [...vs].map((v) => `${a.groupId ?? a.id}/${v}`); };
    const all = new Set<string>(), cap = new Set<string>(); for (const a of hardAll) { const gs = groupsOf(a); gs.forEach((g) => all.add(g)); if (sprCapability(a).capable) gs.forEach((g) => cap.add(g)); }
    supply += cap.size; const ratio = cap.size / Math.max(1, all.size);
    if (cap.size < SPR_REQUIRED_GROUPS) g9.push(`${sk}: SPR 가능 그룹 ${cap.size} < ${SPR_REQUIRED_GROUPS}`); if (ratio < 0.25) g9.push(`${sk}: SPR 가능 그룹 비율 ${(ratio * 100).toFixed(0)}% < 25%`);
  }
  gates.G10 = { ok: !g9.length, note: g9.length ? g9.join("; ") : `자료 원형 skill ${skills.join(", ")}: SPR 가능 유사문항 그룹 ${supply}개(필요 ${SPR_REQUIRED_GROUPS}: ${SPR_SETS}세트 × 세트당 ${SPR_HARD_PER_SET})` };
  const implemented = Object.entries(qaByItem).filter(([, q]) => q.state !== "unimplemented"); const qaPass = implemented.filter(([, q]) => q.state === "pass").length;
  gates.G8 = { ok: !Object.values(items).some((r) => r.failures.some((f) => f.startsWith("G8"))), note: `구현된 ${implemented.length}개 조합의 렌더 구조 검사(전 원형·시드 0~199) 실패 ${Object.values(items).filter((r) => r.failures.some((f) => f.startsWith("G8"))).length}개 조합` };
  gates.G9 = { ok: FIGURE_ITEMS.every((r) => qaByItem[r.id]?.state === "pass"), note: `시각 검수 pass ${qaPass}/${FIGURE_ITEMS.length}(구현 ${implemented.length}개 중 ${qaPass}개; 상태: ${Object.entries(implemented.reduce((m: Record<string, number>, [, q]) => ((m[q.state] = (m[q.state] ?? 0) + 1), m), {})).map(([k, v]) => `${k} ${v}`).join(", ") || "없음"})` };
  const summary = { items: FIGURE_ITEMS.length, pass: 0, fail: 0, unimplemented: 0, blockedRenderer: 0, waived: 0 };
  for (const r of Object.values(items)) { if (r.status === "pass") summary.pass++; else if (r.status === "fail") summary.fail++; else if (r.status === "unimplemented") summary.unimplemented++; else summary.blockedRenderer++; }
  // 형식 축: 구현된 항목은 원형 선언(hard 원형 중 SPR 가능이 하나라도 있으면 가능), 미구현 항목은 계획 기본값(sprPlanned)
  const declaredCapable = (id: string) => (byItem.get(id) ?? []).some((a) => a.level === "hard" && sprCapability(a).capable);
  const sprItemsCapable = FIGURE_ITEMS.filter((r) => (byItem.has(r.id) ? declaredCapable(r.id) : sprPlanned(r))).length;
  const report: GateReport = {
    version: 1, generatedAt: new Date().toISOString(), seedsPerArchetype: o.seeds, ok: summary.pass === summary.items && Object.values(gates).every((g) => g.ok), summary, gates, items, qaByItem,
    spr: { requiredHardSprFor30Sets: SPR_REQUIRED_GROUPS, supplyImplemented: supply, sprCapableItems: sprItemsCapable, sprIncapableItems: FIGURE_ITEMS.length - sprItemsCapable, byItem: sprByItem },
  };
  void sprTarget;
  return { report, arch };
}

export const itemRow = (id: string): FigureItemRow | undefined => FIGURE_ITEMS.find((r) => r.id === id);

/** 전체 원형의 SPR 가능 비율·불가 목록(선언이 있으면 선언, 없는 옛 원형은 시드 프로브 판정) — 매니페스트 보고용. */
export function sprInventory(): { total: number; capable: number; declared: number; probed: number; incapable: { id: string; reason: string; declared: boolean }[] } {
  const list: Archetype[] = [...ARCHETYPES]; let capable = 0, declared = 0; const incapable: { id: string; reason: string; declared: boolean }[] = [];
  for (const a of list) { const c = sprCapability(a); if (c.declared) declared++; if (c.capable) capable++; else incapable.push({ id: a.id, reason: c.reason, declared: c.declared }); }
  return { total: list.length, capable, declared, probed: list.length - declared, incapable };
}
