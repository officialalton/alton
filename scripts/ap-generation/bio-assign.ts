// AP Biology 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). chem-assign.ts 와 같은 방식(정수계획 HiGHS + 배정기와 별개인 독립 검증기)을 Biology 구조에 적용한다.
//   npx tsx scripts/ap-generation/bio-assign.ts --sets BI1[,BI2] [--time-ms 120000] [--write-report data/ap/stock/exact-assign-bio-cs1-cs2.json] [--files bio-p1a-items,...] [--no-screen] [--prefer-exam-prep] [--min-exam-prep N] [--block-file <보고서.json[,..]>] [--sequential] [--frq-spread] [--forbid-swap-sets <slots.json>] [--converted-snapshot <slots.json> --new-batches <items파일,..>] [--allow-shared-structure]
// 조건(공식 구조, docs/ap/bio-facts.md): MC 42 = 단독 + 2문항 세트 1~3개, 단원 비중 15-25/25-35/10-18/30-40 %·Practice 비중 2-10/22-38/37-53/10-15/2-10 %(하한 내림·상한 올림 정수 범위, **둘 다 차단 조건**),
//   FRQ 4 = Q1 메서드·제어문 / Q2 클래스 설계 / Q3 ArrayList / Q4 2D 배열 각 1, 한 시험 안 문항군(look-alike 포함) 1, **시험 사이 구조(원형) 겹침 0**(기본: 같은 라이브러리 원형은 두 회 합쳐 한 번만 — 같은 코드 모양에 숫자만 바뀐 문항이
//   두 회에 나오지 않는다; 끄려면 --allow-shared-structure), 시험 사이 같은 문항 0. 재고에 없는 칸은 가상 문항으로 세어 부족분을 (단원 × 스킬) 칸 단위로 정확히 보고한다(가상 단독 = 라이브러리 단독 원형, 가상 세트 = 라이브러리 세트 원형, 가상 FRQ = 시나리오).
import { readFileSync, writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { BIO_FRQ_TYPES, BIO_FULL_TARGET, BIO_MC_COUNT, BIO_SET_COUNT, BIO_SET_SIZE, bioPracticeBounds, bioUnitBounds, verifyBioFullComposition, type BioSetItem } from "../../lib/ap-exam/full-set-rules";
import { biologyGuide } from "../../lib/ap-generation/subjects/bio";
import { BIO_FRQ_POINTS, bioFrqMaxAreaPoints, bioFrqUnitOf, BIO_FRQ_MIN_AREAS, verifyBioFrqSpread } from "../../lib/ap-exam/bio-frq-spread";
import { loadBioPool, type BioItem } from "./bio-pool";
import { solveMipHighs } from "./ilp-highs";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export type BioVirtual = { set: string; part: "A"; unit: number; practice: number; skill: string; archetype: string; topic: string };
export type BioFrqVirtual = { set: string; part: "A"; native: false; type: string; archetype: string };
export type BioResult = { id: string; singles: BioItem[]; sets: BioItem[]; frq: BioItem[]; virtual: BioVirtual[]; virtualSets: number[]; virtualSetArchetypes: string[]; frqVirtual: BioFrqVirtual[] };
const UNITS = [1, 2, 3, 4, 5, 6, 7, 8]; const PRACTICES = [1, 2, 3, 4, 5, 6];
const unitOf = (topic: string) => Number(String(topic).split(".")[0]); const practiceOf = (skill: string) => Number(String(skill).split(".")[0]);
const guideRows = biologyGuide.archetypes as { id: string; topic: string; skill: string }[];
/** 후보가 모두 반려되고 고치지 못한 원형은 여기에 적어 가상 칸 계획에서 뺀다(첫 유료 라운드 전에는 비어 있다). */
export const EXCLUDED_ARCHETYPES = new Set<string>([
  // 2026-10-19 bio-b34-mc: 후보 3개가 모두 반려된 원형(가상 칸 계획에서 뺀다)
  "bi_bar_biomass", "bi_chemiosmosis", "bi_community_interaction", "bi_cyclin_graph", "bi_dna_structure", "bi_graph_pcr_cycles", "bi_hw_conditions", "bi_hypothesis_signal", "bi_n_respirometer_table", "bi_new_investigation_selection", "bi_procedure_choice_dna", "bi_respiration_concept", "bi_selection_data_table", "bi_signal_steps", "bi_testcross", "bi_z_pcr_cycles_predict",
  // 2026-10-19 bio-b34b: 후보 전부 반려
  "bi_organism_response_data", "bis_hw_set",
]);
/** 라이브러리 단독 원형(원형 id = 구조). 가상 단독 문항은 이 원형 중 하나를 쓰고, 같은 원형은 시험당·(기본) 전체에서 최대 한 번 쓴다. */
export const LIB_SINGLES = guideRows.filter((g) => !g.id.startsWith("bis_") && !EXCLUDED_ARCHETYPES.has(g.id)).map((g) => ({ id: g.id, topic: g.topic, unit: unitOf(g.topic), practice: practiceOf(g.skill), skill: g.skill, key: g.id }));
if (process.env.BIO_DUMMY) for (let u = 1; u <= 8; u++) for (const pr of [1, 2, 3, 4, 5, 6]) for (let k = 0; k < 3; k++) LIB_SINGLES.push({ id: `dummy_u${u}p${pr}_${k}`, topic: `${u}.1`, unit: u, practice: pr, skill: `${pr}.A`, key: `dummy_u${u}p${pr}_${k}` }); // 분석용: 새로 써야 할 (단원, Practice) 칸을 센다
/** 2문항 세트 원형(bis_*_q1/q2 를 합친 것). */
export const LIB_SETS = [...new Set(guideRows.filter((g) => g.id.startsWith("bis_")).map((g) => g.id.replace(/_q\d+$/, "")))].filter((id) => !EXCLUDED_ARCHETYPES.has(id)).map((id) => { const m = guideRows.filter((g) => g.id.startsWith(`${id}_q`)); return { id, unit: unitOf(m[0].topic), members: m.map((g) => ({ unit: unitOf(g.topic), practice: practiceOf(g.skill), skill: g.skill })), key: id }; });
/** FRQ 시나리오(유형당 4개): 가상 FRQ 는 이 시나리오 중 하나. */
export const LIB_FRQ = (biologyGuide.frqTemplates ?? []).filter((t) => !EXCLUDED_ARCHETYPES.has(t.id)).map((t) => ({ id: t.id, type: String(t.template), key: t.id, topic: String((t as { topic?: string }).topic ?? "") }));

export function solveBioSets(ids: string[], items: BioItem[], o: { timeMs: number; log?: (s: string) => void; blocked?: Set<string>; blockedArchetypes?: Set<string>; preferExamPrep?: boolean; minExamPrep?: number; cost?: (c: BioItem) => number; disjoint?: boolean; frqSpread?: boolean; forbid?: Record<string, Set<string>> }) {
  const blocked = o.blocked ?? new Set<string>(); const blockedArch = o.blockedArchetypes ?? new Set<string>(); const disjoint = o.disjoint ?? true;
  const LS = LIB_SINGLES.filter((e) => !blockedArch.has(e.id)), LT = LIB_SETS.filter((e) => !blockedArch.has(e.id)), LF = LIB_FRQ.filter((e) => !blockedArch.has(e.id));
  const usable = items.filter((c) => !blocked.has(c.key) && !blockedArch.has(c.archetype) && (c.kind === "frq" ? (BIO_FRQ_TYPES as readonly string[]).includes(c.frqType) : c.shared ? c.members.length === BIO_SET_SIZE : c.members.length === 1) && (c.kind === "frq" || c.members.every((m) => PRACTICES.includes(practiceOf(m.skill)) && UNITS.includes(m.unit))));
  const mcSingles = usable.filter((c) => c.kind === "mc" && !c.shared), mcSets = usable.filter((c) => c.kind === "mc" && c.shared), frqs = usable.filter((c) => c.kind === "frq");
  let n = 0; const V = (): number => n++;
  const xv = new Map<string, number>();
  usable.forEach((c, i) => ids.forEach((_, s) => xv.set(`${i}|${s}`, V())));
  const idx = new Map(usable.map((c, i) => [c, i] as const));
  const x = (c: BioItem, s: number) => xv.get(`${idx.get(c)}|${s}`)!;
  const vs = new Map<string, number>(), vset = new Map<string, number>(), vf = new Map<string, number>(), du = new Map<string, number>(), dp = new Map<string, number>(), dy = new Map<string, number>();
  ids.forEach((_, s) => {
    LS.forEach((e) => vs.set(`${s}|${e.key}`, V()));
    LT.forEach((e) => vset.set(`${s}|${e.key}`, V()));
    LF.forEach((e) => vf.set(`${s}|${e.key}`, V()));
    for (const u of UNITS) du.set(`${s}|${u}`, V());
    for (const p of PRACTICES) dp.set(`${s}|${p}`, V());
    if (o.frqSpread) for (const u of UNITS) dy.set(`${s}|${u}`, V());
  });
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = [];
  for (const j of vs.values()) obj[j] = 1000; for (const j of vset.values()) obj[j] = 2000; for (const j of vf.values()) obj[j] = 1000;
  for (const j of du.values()) obj[j] = 1; for (const j of dp.values()) obj[j] = 0.2;
  if (o.frqSpread) for (const j of dy.values()) obj[j] = -1.5; // FRQ 영역(단원) 수를 넓히는 쪽으로 약하게 유도(4개 하한은 제약, 그 이상은 목적)
  if (o.preferExamPrep) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += -0.01 * (c.exam ?? 0); }));
  if (o.cost) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += o.cost!(c); }));
  const uB = bioUnitBounds(), pB = bioPracticeBounds();
  usable.forEach((c) => cons.push({ coef: ids.map((_, s) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 })); // 같은 문항은 시험 하나에만
  // forbid[시험 id] = 그 시험에 넣을 수 없는 키(새 버전 교체 계획용: 공유 세트가 두 시험 사이를 오가면 중간판을 채울 자유 세트가 없어 순환 교체를 풀 수 없다).
  ids.forEach((id, s) => usable.forEach((c) => { if (o.forbid?.[id]?.has(c.key)) cons.push({ coef: [[x(c, s), 1]], sense: "=", rhs: 0 }); }));
  ids.forEach((_, s) => {
    const singleTerms = (): [number, number][] => [...mcSingles.map((c) => [x(c, s), 1] as [number, number]), ...LS.map((e) => [vs.get(`${s}|${e.key}`)!, 1] as [number, number])];
    const setTerms = (): [number, number][] => [...mcSets.map((c) => [x(c, s), 1] as [number, number]), ...LT.map((e) => [vset.get(`${s}|${e.key}`)!, 1] as [number, number])];
    // MC 60 = 단독 + 4 x 세트, 세트는 정확히 2개
    cons.push({ coef: [...singleTerms(), ...setTerms().map(([j, v]) => [j, v * BIO_SET_SIZE] as [number, number])], sense: "=", rhs: BIO_MC_COUNT });
    cons.push({ coef: setTerms(), sense: "=", rhs: BIO_SET_COUNT });
    // 한 회의 exam_prep MC 문항 수 하한(선택): 재고 문항의 난이도 라벨 기준. 가상 문항은 라벨이 없어 세지 않는다.
    if (o.minExamPrep) cons.push({ coef: [...mcSingles, ...mcSets].filter((c) => (c.exam ?? 0) > 0).map((c) => [x(c, s), c.exam ?? 0] as [number, number]), sense: ">=", rhs: o.minExamPrep });
    for (const u of UNITS) {
      const co: [number, number][] = [...mcSingles.filter((c) => c.members[0].unit === u).map((c) => [x(c, s), 1] as [number, number]),
        ...mcSets.map((c) => [x(c, s), c.members.filter((m) => m.unit === u).length] as [number, number]).filter(([, v]) => v > 0),
        ...LS.filter((e) => e.unit === u).map((e) => [vs.get(`${s}|${e.key}`)!, 1] as [number, number]), ...LT.map((e) => [vset.get(`${s}|${e.key}`)!, e.members.filter((m) => m.unit === u).length] as [number, number]).filter(([, v]) => v > 0)];
      cons.push({ coef: co, sense: ">=", rhs: uB[String(u)].min }); cons.push({ coef: co, sense: "<=", rhs: uB[String(u)].max });
      const t = BIO_FULL_TARGET.units[String(u)]; const d = du.get(`${s}|${u}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    for (const p of PRACTICES) { // Practice(스킬 코드의 앞 숫자) 범위: 차단
      const co: [number, number][] = [...mcSingles.filter((c) => practiceOf(c.members[0].skill) === p).map((c) => [x(c, s), 1] as [number, number]),
        ...mcSets.map((c) => [x(c, s), c.members.filter((m) => practiceOf(m.skill) === p).length] as [number, number]).filter(([, v]) => v > 0),
        ...LS.filter((e) => e.practice === p).map((e) => [vs.get(`${s}|${e.key}`)!, 1] as [number, number]), ...LT.map((e) => [vset.get(`${s}|${e.key}`)!, e.members.filter((m) => m.practice === p).length] as [number, number]).filter(([, v]) => v > 0)];
      cons.push({ coef: co, sense: ">=", rhs: pB[String(p)].min }); cons.push({ coef: co, sense: "<=", rhs: pB[String(p)].max });
      const t = (pB[String(p)].min + pB[String(p)].max) / 2; const d = dp.get(`${s}|${p}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    // 문항군(look-alike 포함): 한 시험에 한 번
    const fam = new Map<string, [number, number][]>(); for (const c of [...mcSingles, ...mcSets]) (fam.get(c.fam) ?? fam.set(c.fam, []).get(c.fam)!).push([x(c, s), 1]);
    for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    // FRQ 주제 분산(선택): 한 단원이 FRQ 총점의 35 % 이하(= 11점 이하), 서로 다른 단원 4개 이상. 가상 FRQ 는 가이드의 topic 으로 센다.
    if (o.frqSpread) {
      const yv = UNITS.map((u) => ({ u, y: dy.get(`${s}|${u}`)! }));
      const pts = (type: string) => BIO_FRQ_POINTS[type] ?? 0;
      for (const { u, y } of yv) {
        const co: [number, number][] = [...frqs.filter((c) => Number(bioFrqUnitOf(c.frqTopic ?? "")) === u).map((c) => [x(c, s), pts(c.frqType)] as [number, number]), ...LF.filter((e) => Number(bioFrqUnitOf(e.topic)) === u).map((e) => [vf.get(`${s}|${e.key}`)!, pts(e.type)] as [number, number])];
        cons.push({ coef: co, sense: "<=", rhs: bioFrqMaxAreaPoints() });
        cons.push({ coef: [...co.map(([j]) => [j, 1] as [number, number]), [y, -1]], sense: ">=", rhs: 0 }); // y=1 이면 그 단원 FRQ 가 최소 1개(y ≤ 개수)
        for (const [j] of co) cons.push({ coef: [[y, 1], [j, -1]], sense: ">=", rhs: 0 }); // FRQ 가 있으면 y = 1
      }
      cons.push({ coef: yv.map(({ y }) => [y, 1] as [number, number]), sense: ">=", rhs: BIO_FRQ_MIN_AREAS });
    }
    // FRQ: 유형(q1~q4)마다 정확히 1 — 재고 후보 또는 가상 시나리오
    for (const t of BIO_FRQ_TYPES) cons.push({ coef: [...frqs.filter((c) => c.frqType === t).map((c) => [x(c, s), 1] as [number, number]), ...LF.filter((e) => e.type === t).map((e) => [vf.get(`${s}|${e.key}`)!, 1] as [number, number])], sense: "=", rhs: 1 });
  });
  // 구조(원형) 겹침: 같은 라이브러리 원형(시나리오 포함)은 시험당 한 번, disjoint 면 모든 시험을 합쳐 한 번
  const groups = new Map<string, [number, number][]>();
  const add = (k: string, s: number, j: number) => { const key = disjoint ? k : `${k}|${s}`; (groups.get(key) ?? groups.set(key, []).get(key)!).push([j, 1]); };
  ids.forEach((_, s) => {
    for (const c of [...mcSingles, ...mcSets, ...frqs]) add(c.archetype, s, x(c, s));
    for (const e of LS) add(e.id, s, vs.get(`${s}|${e.key}`)!);
    for (const e of LT) add(e.id, s, vset.get(`${s}|${e.key}`)!);
    for (const e of LF) add(e.id, s, vf.get(`${s}|${e.key}`)!);
  });
  for (const co of groups.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
  const binary = new Array<boolean>(n).fill(false); for (const j of [...xv.values(), ...vf.values(), ...vs.values(), ...vset.values(), ...dy.values()]) binary[j] = true;
  const prob = { n, obj, cons, integer: new Array(n).fill(true), binary };
  const r = has("--builtin-ilp") ? solveMip(prob, { timeMs: o.timeMs, log: o.log }) : solveMipHighs(prob, { timeMs: o.timeMs, log: o.log });
  const out: BioResult[] = ids.map((id) => ({ id, singles: [], sets: [], frq: [], virtual: [], virtualSets: [], virtualSetArchetypes: [], frqVirtual: [] }));
  if (r.x.length) ids.forEach((id, s) => {
    for (const c of usable) if (r.x[x(c, s)] > 0.5) (c.kind === "frq" ? out[s].frq : c.shared ? out[s].sets : out[s].singles).push(c);
    for (const e of LS) if (r.x[vs.get(`${s}|${e.key}`)!] > 0.5) out[s].virtual.push({ set: id, part: "A", unit: e.unit, practice: e.practice, skill: e.skill, archetype: e.id, topic: e.topic });
    for (const e of LT) if (r.x[vset.get(`${s}|${e.key}`)!] > 0.5) { out[s].virtualSets.push(e.unit); out[s].virtualSetArchetypes.push(e.id); }
    for (const e of LF) if (r.x[vf.get(`${s}|${e.key}`)!] > 0.5) out[s].frqVirtual.push({ set: id, part: "A", native: false, type: e.type, archetype: e.id });
  });
  return { res: r, out };
}

/** 한 세트의 MC 위치 목록: 단원 오름차순 블록(단독 1칸, 세트 2칸 연속). 가상 문항은 candidateKey null(가상 세트는 `~virtual-set-<원형>`). 세트의 단원은 첫 문항 기준. */
export function buildBioOrder(r: BioResult): BioSetItem[] {
  type Block = { unit: number; key: string; members: { unit: number; skill: string | null }[]; real: boolean };
  const setLib = (id: string) => LIB_SETS.find((e) => e.id === id)!;
  const blocks: Block[] = [
    ...r.singles.map((c) => ({ unit: c.members[0].unit, key: c.key, members: [{ unit: c.members[0].unit, skill: c.members[0].skill }], real: true })),
    ...r.sets.map((c) => ({ unit: c.members[0].unit, key: c.key, members: c.members.map((m) => ({ unit: m.unit, skill: m.skill })), real: true })),
    ...r.virtual.map((v, i) => ({ unit: v.unit, key: `~v${i}`, members: [{ unit: v.unit, skill: v.skill as string | null }], real: false })),
    ...r.virtualSetArchetypes.map((id) => ({ unit: setLib(id).unit, key: `~virtual-set-${id}`, members: setLib(id).members.map((m) => ({ unit: m.unit, skill: m.skill as string | null })), real: false })),
  ].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
  const out: BioSetItem[] = []; let pos = 1;
  for (const b of blocks) for (const m of b.members) out.push({ kind: "mc", unit: String(m.unit), skill: m.skill, candidateKey: b.real && b.members.length === 1 ? null : b.key, position: pos++ });
  return out;
}

/** 독립 검증기(배정기와 별개): 공식 구조·단원·Practice·세트·FRQ 유형·문항군·시험 간 문항·구조 중복·차단 키. 위반 목록(빈 배열 = 통과). */
export function verifyBioAssignment(res: BioResult[], blocked: Set<string> = new Set(), o: { disjoint?: boolean; frqSpread?: boolean } = {}): string[] {
  const bad: string[] = []; const used = new Map<string, string>(); const arch = new Map<string, string>();
  for (const r of res) {
    const mc = buildBioOrder(r);
    const frqItems: BioSetItem[] = [...r.frq.map((c, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: c.key, position: i + 1 })), ...r.frqVirtual.map((v, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: null, position: r.frq.length + i + 1 }))];
    for (const v of verifyBioFullComposition([...mc, ...frqItems])) bad.push(`${r.id}: ${v}`);
    const fams = [...r.singles, ...r.sets].map((c) => c.fam); if (new Set(fams).size !== fams.length) bad.push(`${r.id}: 문항군 중복`);
    if (o.frqSpread) for (const v of verifyBioFrqSpread([...r.frq.map((c) => ({ type: c.frqType, topic: c.frqTopic ?? "" })), ...r.frqVirtual.map((v) => ({ type: v.type, topic: LIB_FRQ.find((e) => e.id === v.archetype)?.topic ?? "" }))])) bad.push(`${r.id}: ${v}`);
    const ffams = r.frq.map((c) => c.fam); if (new Set(ffams).size !== ffams.length) bad.push(`${r.id}: FRQ 문항군 중복`);
    const types = [...r.frq.map((c) => c.frqType), ...r.frqVirtual.map((v) => v.type)].sort(); if (types.join() !== [...BIO_FRQ_TYPES].sort().join()) bad.push(`${r.id}: FRQ 유형 ${types.join("+")} ≠ 6유형 각 1개`);
    if (r.sets.some((c) => c.members.length !== BIO_SET_SIZE)) bad.push(`${r.id}: 공유 세트 크기`);
    const structs = [...r.singles.map((c) => c.archetype), ...r.sets.map((c) => c.archetype), ...r.frq.map((c) => c.archetype), ...r.virtual.map((v) => v.archetype), ...r.virtualSetArchetypes, ...r.frqVirtual.map((v) => v.archetype)];
    if (new Set(structs).size !== structs.length) bad.push(`${r.id}: 같은 구조(원형)를 한 시험에 두 번`);
    if (o.disjoint ?? true) for (const a of structs) { if (arch.has(a) && arch.get(a) !== r.id) bad.push(`구조 ${a}: ${arch.get(a)} 와 ${r.id} 겹침`); arch.set(a, r.id); }
    for (const c of [...r.singles, ...r.sets, ...r.frq]) { if (blocked.has(c.key)) bad.push(`${r.id}: 차단된 항목 ${c.key}`); if (used.has(c.key)) bad.push(`${c.key}: ${used.get(c.key)} 와 ${r.id} 중복`); used.set(c.key, r.id); }
  }
  return bad;
}

/** 보고서(exact-assign 형식과 호환): mcA = MC 후보 키(세트는 한 번, 단원 순서), mcB = [], frqA = FRQ 키(q1→q4 순), frqB = []. */
export function toReportSet(r: BioResult) {
  const seen = new Set<string>(); const mcKeys: string[] = [];
  const blocks = [...r.singles.map((c) => ({ unit: c.members[0].unit, key: c.key })), ...r.sets.map((c) => ({ unit: c.members[0].unit, key: c.key }))].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
  for (const b of blocks) if (!seen.has(b.key)) { seen.add(b.key); mcKeys.push(b.key); }
  const frqKeys = [...BIO_FRQ_TYPES].map((t) => r.frq.find((c) => c.frqType === t)?.key).filter((k): k is string => !!k);
  return { id: r.id, mcA: mcKeys, mcB: [] as string[], virtual: r.virtual, virtualSets: r.virtualSets, virtualSetArchetypes: r.virtualSetArchetypes, frqA: frqKeys, frqB: [] as string[], frqVirtual: r.frqVirtual, subject: "ap_biology" };
}

export function practiceSummary(r: BioResult) {
  const c: Record<string, number> = {}, k: Record<string, number> = {};
  for (const it of [...r.singles, ...r.sets]) for (const m of it.members) { c[String(practiceOf(m.skill))] = (c[String(practiceOf(m.skill))] ?? 0) + 1; k[m.skill] = (k[m.skill] ?? 0) + 1; }
  for (const v of r.virtual) { c[String(v.practice)] = (c[String(v.practice)] ?? 0) + 1; k[v.skill] = (k[v.skill] ?? 0) + 1; }
  for (const id of r.virtualSetArchetypes) for (const m of LIB_SETS.find((e) => e.id === id)!.members) { c[String(m.practice)] = (c[String(m.practice)] ?? 0) + 1; k[m.skill] = (k[m.skill] ?? 0) + 1; }
  return { practice: c, skills: k };
}

function main() {
  const ids = arg("--sets", "BI1,BI2").split(",").filter(Boolean); const TIME = Number(arg("--time-ms", "120000"));
  const files = arg("--files") ? arg("--files").split(",") : undefined;
  const { pool: pool0 } = loadBioPool({ requireScreen: !has("--no-screen"), files });
  // --converted-snapshot <slots.json> [--new-batches bio-v3a-items,...]: 이미 DB 에 변환된 키(스냅샷 convertedKeys) + 새 배치(적재·변환 예정)만 쓴다. 변환 안 된 옛 재고(예: bio-r2:…m18-k0)는 쓰지 않는다.
  const convSnap = arg("--converted-snapshot"); const newBatches = new Set(arg("--new-batches").split(",").filter(Boolean));
  const convSet = convSnap ? new Set((JSON.parse(readFileSync(convSnap, "utf-8")) as { convertedKeys: string[] }).convertedKeys) : null;
  const pool = convSet ? pool0.filter((c) => convSet.has(c.key) || newBatches.has(c.batch)) : pool0;
  // --forbid-swap-sets <slots.json>: 현재 한 시험이 쓰는 공유 세트는 다른 시험에 넣지 않는다(세트는 같은 크기 세트로만 통째 교체되므로 순환 교체를 막는다).
  let forbid: Record<string, Set<string>> | undefined;
  if (arg("--forbid-swap-sets")) { const sn = JSON.parse(readFileSync(arg("--forbid-swap-sets"), "utf-8")) as Record<string, { slots: { section: string; candidateKey: string }[] }>; const setKeys = new Set(pool0.filter((c) => c.shared).map((c) => c.key)); forbid = {}; for (const id of ids) forbid[id] = new Set(ids.filter((o) => o !== id).flatMap((o) => sn[o].slots.filter((x) => x.section === "ap_mc" && setKeys.has(x.candidateKey)).map((x) => x.candidateKey))); }
  const log = (s: string) => console.error(s);
  const blocked = new Set<string>(); for (const f of arg("--block-file").split(",").filter(Boolean)) for (const st of (JSON.parse(readFileSync(f, "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets) for (const k of [...(st.mcA ?? []), ...(st.frqA ?? [])]) blocked.add(k);
  const disjoint = !has("--allow-shared-structure");
  const blockedArchetypes = new Set<string>(arg("--block-archetypes") ? (JSON.parse(readFileSync(arg("--block-archetypes"), "utf-8")) as string[]) : []); // 공개 세트가 쓴 원형(풀이 틀)은 재고·가상 칸 모두에서 제외
  let m: ReturnType<typeof solveBioSets>;
  if (!has("--sequential")) m = solveBioSets(ids, pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), minExamPrep: Number(arg("--min-exam-prep", "0")) || undefined, blocked, disjoint, frqSpread: has("--frq-spread"), forbid, blockedArchetypes });
  else { // 순차: BI1 을 최적으로 푼 뒤 그 문항·구조를 막고 BI2 를 푼다
    const out: BioResult[] = []; let res = { status: "optimal", obj: 0, nodes: 0, x: [0] } as unknown as ReturnType<typeof solveBioSets>["res"]; const bl = new Set(blocked); const blArch = new Set<string>(blockedArchetypes);
    for (const id of ids) {
      const one = solveBioSets([id], pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), minExamPrep: Number(arg("--min-exam-prep", "0")) || undefined, blocked: bl, blockedArchetypes: blArch, disjoint });
      out.push(...one.out); res = { ...one.res, obj: (res.obj ?? 0) + one.res.obj, nodes: (res.nodes ?? 0) + one.res.nodes, status: one.res.status } as typeof res;
      const r0 = one.out[0];
      for (const it of [...r0.singles, ...r0.sets, ...r0.frq]) { bl.add(it.key); if (disjoint) blArch.add(it.archetype); }
      if (disjoint) for (const a of [...r0.virtual.map((v) => v.archetype), ...r0.virtualSetArchetypes, ...r0.frqVirtual.map((v) => v.archetype)]) blArch.add(a);
    }
    m = { res, out };
  }
  const results = m.out;
  const bad = m.res.x.length ? verifyBioAssignment(results, new Set(), { disjoint, frqSpread: has("--frq-spread") }) : ["해 없음"];
  const cnt = (f: (c: BioItem) => boolean) => pool.filter(f).length;
  console.log(`# bio-assign sets=${ids.join(",")} 재고 단독 ${cnt((c) => c.kind === "mc" && !c.shared)} 세트 ${cnt((c) => c.shared)} FRQ ${cnt((c) => c.kind === "frq")}`);
  console.log(`status=${m.res.status} 목적값(가상×1000 + 단원 이탈 + Practice 이탈×0.2)=${m.res.obj} 노드 ${m.res.nodes} 가상 문항=${results.reduce((a, r) => a + r.virtual.length + r.virtualSets.length * BIO_SET_SIZE + r.frqVirtual.length, 0)}`);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of results) {
    const u: Record<string, number> = {}; for (const it of buildBioOrder(r)) u[it.unit ?? "?"] = (u[it.unit ?? "?"] ?? 0) + 1;
    console.log(`- ${r.id}: 단독 ${r.singles.length}+가상 ${r.virtual.length}, 세트 ${r.sets.length}+가상 ${r.virtualSets.length}, FRQ ${r.frq.length}+가상 ${r.frqVirtual.length}, 단원 ${JSON.stringify(u)}`);
    const mcq = [...r.singles, ...r.sets].reduce((a, c) => a + (c.kind === "mc" ? c.members.length : 0), 0), ex = [...r.singles, ...r.sets].reduce((a, c) => a + (c.exam ?? 0), 0);
    console.log(`    MC exam_prep ${ex}/${BIO_MC_COUNT}${mcq ? ` (재고 문항 기준 ${((ex / mcq) * 100).toFixed(0)}%)` : ""}`);
    const sk = practiceSummary(r); console.log(`    Practice ${JSON.stringify(sk.practice)} 스킬 코드 ${JSON.stringify(sk.skills)}`);
    for (const v of r.virtual) console.log(`    가상 MC: 단원 ${v.unit} 스킬 ${v.skill} 원형 ${v.archetype} (${v.topic})`);
    r.virtualSets.forEach((v, i) => console.log(`    가상 세트: 단원 ${v} 원형 ${r.virtualSetArchetypes[i]}`));
    for (const v of r.frqVirtual) console.log(`    가상 FRQ: ${v.type} 시나리오 ${v.archetype}`);
  }
  const w = arg("--write-report");
  if (w) { writeFileSync(w, JSON.stringify({ sets: results.map(toReportSet) }, null, 1)); console.error(`보고서 기록: ${w}`); }
}
if (process.argv[1]?.endsWith("bio-assign.ts")) main();
