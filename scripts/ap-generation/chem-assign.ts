// AP Chemistry 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). phys-assign.ts 와 같은 방식(정수계획 + 배정기와 별개인 독립 검증기)을 화학 구조에 적용한다.
//   npx tsx scripts/ap-generation/chem-assign.ts --sets CH1[,CH2] [--time-ms 120000] [--write-report <경로 .json>] [--files chem-p1a-items,...] [--no-screen] [--prefer-exam-prep] [--block-file <보고서.json[,..]>]
// 조건(공식 구조, docs/ap/chemistry-facts.md): MC 60 = 단독 56 + 2문항 공유 세트 2, 단원 비중 U3 18-22 / U8 11-15 / 나머지 7-9 %(하한 내림·상한 올림 정수 범위), Practice(스킬) 비중
//   P1 8-12 / P2 8-12 / P4 23-30 / P5 35-42 / P6 8-12 % — **Practice 범위는 차단 조건**(물리와 다름), FRQ 7 = 7유형 각 1, 세트 안 문항군 1(look-alike 포함), 세트 간 같은 문항 0.
//   재고에 없는 칸은 가상 문항으로 세어 부족분을 (단원 × Practice) 칸 단위로 정확히 보고한다(가상 단독 = 단원 u·Practice p, 가상 세트 = 단원 5/7/8 의 2문항 Practice 5, 가상 FRQ = 유형).
import { readFileSync, writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { CHEM_FRQ_TYPES, CHEM_FULL_TARGET, CHEM_MC_COUNT, CHEM_SET_COUNT, CHEM_SET_SIZE, chemPracticeBounds, chemUnitBounds, verifyChemFullComposition, type ChemSetItem } from "../../lib/ap-exam/full-set-rules";
import chemGuide from "../../lib/ap-generation/subjects/chem-archetypes.json";
import { loadChemPool, type ChemItem } from "./chem-pool";
import { solveMipHighs } from "./ilp-highs";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export type ChemVirtual = { set: string; part: "A"; unit: number; practice: number; archetype: string; topic: string };
export type ChemResult = { id: string; singles: ChemItem[]; sets: ChemItem[]; frq: ChemItem[]; virtual: ChemVirtual[]; virtualSets: number[]; virtualSetArchetypes: string[]; frqVirtual: { set: string; part: "A"; native: false; type: string }[] };
const UNITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]; const PRACTICES = [1, 2, 4, 5, 6];
const SINGLES_PER_SET = CHEM_MC_COUNT - CHEM_SET_COUNT * CHEM_SET_SIZE;
const unitOf = (topic: string) => Number(String(topic).split(".")[0]); const practiceOf = (skill: string) => Number(String(skill).split(".")[0]);
const guideRows = chemGuide as { id: string; topic: string; skill: string }[];
/** 라이브러리 단독 원형(원형 id + 토픽 = 문항군 키). 가상 단독 문항은 이 원형 중 하나를 시험당 최대 한 번 쓴다(같은 문항군은 한 시험에 한 번). */
/** 2026-10-13 chem-s2-m-a/b 에서 후보가 모두 반려되고 고치지 못한 원형(절차 선택 3·시험 가능한 질문·모형 평가·너무 쉬운 암기형 6): 가상 칸 계획에서 뺀다. */
export const EXCLUDED_ARCHETYPES = new Set(["ch_procedure_calorimetry", "ch_procedure_titration", "ch_procedure_rate", "ch_testable_question", "ch_model_conductivity", "ch_acid_strength", "ch_ie_trend", "ch_gas_deviation", "ch_lattice_energy", "ch_indicator", "ch_particle_phase"]);
export const LIB_SINGLES = guideRows.filter((g) => !g.id.startsWith("chs_") && !EXCLUDED_ARCHETYPES.has(g.id)).map((g) => ({ id: g.id, topic: g.topic, unit: unitOf(g.topic), practice: practiceOf(g.skill), key: `${g.id}|${g.topic}` }));
/** 2문항 세트 원형(chs_*_q1/q2 를 합친 것): 가상 세트는 이 중 하나를 시험당 최대 한 번 쓴다. */
export const LIB_SETS = [...new Set(guideRows.filter((g) => g.id.startsWith("chs_")).map((g) => g.id.replace(/_q\d+$/, "")))].map((id) => { const m = guideRows.filter((g) => g.id.startsWith(`${id}_q`)); return { id, unit: unitOf(m[0].topic), practices: m.map((g) => practiceOf(g.skill)), key: id }; });

// 분석용(2026-10-19): CHEM_BLOCK_ARCH=<원형 id JSON 배열> 이면 공개 세트가 쓴 원형을 가상 칸에서 빼고, CHEM_DUMMY=1 이면 단원×Practice 칸마다 가상 "새 원형" 3개를 더해 새로 써야 할 칸 수를 센다.
if (process.env.CHEM_BLOCK_ARCH) { const bl = new Set<string>(JSON.parse(readFileSync(process.env.CHEM_BLOCK_ARCH, "utf-8")) as string[]); for (let i = LIB_SINGLES.length - 1; i >= 0; i--) if (bl.has(LIB_SINGLES[i].id)) LIB_SINGLES.splice(i, 1); for (let i = LIB_SETS.length - 1; i >= 0; i--) if (bl.has(LIB_SETS[i].id)) LIB_SETS.splice(i, 1); }
export const BLOCK_ARCH = new Set<string>(process.env.CHEM_BLOCK_ARCH ? (JSON.parse(readFileSync(process.env.CHEM_BLOCK_ARCH, "utf-8")) as string[]) : []); // 같은 원형(풀이 틀)의 재고 문항도 막는다(엄격 규칙)
if (process.env.CHEM_DUMMY) for (let u = 1; u <= 9; u++) for (let k = 0; k < 2; k++) LIB_SETS.push({ id: `dummyset_u${u}_${k}`, unit: u, practices: [4, 5], key: `dummyset_u${u}_${k}` });
if (process.env.CHEM_DUMMY) for (let u = 1; u <= 9; u++) for (let pr = 1; pr <= 6; pr++) for (let k = 0; k < 4; k++) LIB_SINGLES.push({ id: `dummy_u${u}p${pr}_${k}`, topic: `${u}.1`, unit: u, practice: pr, key: `dummy_u${u}p${pr}_${k}` });
export function solveChemSets(ids: string[], items: ChemItem[], o: { timeMs: number; log?: (s: string) => void; blocked?: Set<string>; preferExamPrep?: boolean; cost?: (c: ChemItem) => number }) {
  const blocked = o.blocked ?? new Set<string>();
  const usable = items.filter((c) => !blocked.has(c.key) && !BLOCK_ARCH.has(c.archetype) && (c.kind === "frq" ? (CHEM_FRQ_TYPES as readonly string[]).includes(c.frqType) : c.shared ? c.members.length === CHEM_SET_SIZE : c.members.length === 1) && (c.kind === "frq" || c.members.every((m) => PRACTICES.includes(practiceOf(m.skill)))));
  const mcSingles = usable.filter((c) => c.kind === "mc" && !c.shared), mcSets = usable.filter((c) => c.kind === "mc" && c.shared), frqs = usable.filter((c) => c.kind === "frq");
  let n = 0; const V = (): number => n++;
  const xv = new Map<string, number>();
  usable.forEach((c, i) => ids.forEach((_, s) => xv.set(`${i}|${s}`, V())));
  const idx = new Map(usable.map((c, i) => [c, i] as const));
  const x = (c: ChemItem, s: number) => xv.get(`${idx.get(c)}|${s}`)!;
  const vs = new Map<string, number>(), vset = new Map<string, number>(), vf = new Map<string, number>(), du = new Map<string, number>(), dp = new Map<string, number>();
  ids.forEach((_, s) => {
    LIB_SINGLES.forEach((e) => vs.set(`${s}|${e.key}`, V()));
    LIB_SETS.forEach((e) => vset.set(`${s}|${e.key}`, V()));
    for (const u of UNITS) du.set(`${s}|${u}`, V());
    for (const p of PRACTICES) dp.set(`${s}|${p}`, V());
    for (const t of CHEM_FRQ_TYPES) vf.set(`${s}|${t}`, V());
  });
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = [];
  for (const j of vs.values()) obj[j] = 1000; for (const j of vset.values()) obj[j] = 2000; for (const j of vf.values()) obj[j] = 1000;
  for (const j of du.values()) obj[j] = 1; for (const j of dp.values()) obj[j] = 0.2;
  if (o.preferExamPrep) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += -0.01 * (c.exam ?? 0); }));
  if (o.cost) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += o.cost!(c); }));
  const uB = chemUnitBounds(), pB = chemPracticeBounds();
  usable.forEach((c) => cons.push({ coef: ids.map((_, s) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 }));
  ids.forEach((_, s) => {
    cons.push({ coef: [...mcSingles.map((c) => [x(c, s), 1] as [number, number]), ...LIB_SINGLES.map((e) => [vs.get(`${s}|${e.key}`)!, 1] as [number, number])], sense: "=", rhs: SINGLES_PER_SET });
    cons.push({ coef: [...mcSets.map((c) => [x(c, s), 1] as [number, number]), ...LIB_SETS.map((e) => [vset.get(`${s}|${e.key}`)!, 1] as [number, number])], sense: "=", rhs: CHEM_SET_COUNT });
    for (const u of UNITS) {
      const co: [number, number][] = [...mcSingles.filter((c) => unitOf(c.members[0].topic) === u).map((c) => [x(c, s), 1] as [number, number]),
        ...mcSets.map((c) => [x(c, s), c.members.filter((m) => unitOf(m.topic) === u).length] as [number, number]).filter(([, v]) => v > 0),
        ...LIB_SINGLES.filter((e) => e.unit === u).map((e) => [vs.get(`${s}|${e.key}`)!, 1] as [number, number]), ...LIB_SETS.filter((e) => e.unit === u).map((e) => [vset.get(`${s}|${e.key}`)!, CHEM_SET_SIZE] as [number, number])];
      cons.push({ coef: co, sense: ">=", rhs: uB[String(u)].min }); cons.push({ coef: co, sense: "<=", rhs: uB[String(u)].max });
      const t = CHEM_FULL_TARGET.units[String(u)]; const d = du.get(`${s}|${u}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    for (const p of PRACTICES) { // Practice(스킬 코드의 앞 숫자) 범위: 차단. 가상 세트는 Practice 5(세트 원형이 모두 5.D/5.F)
      const co: [number, number][] = [...mcSingles.filter((c) => practiceOf(c.members[0].skill) === p).map((c) => [x(c, s), 1] as [number, number]),
        ...mcSets.map((c) => [x(c, s), c.members.filter((m) => practiceOf(m.skill) === p).length] as [number, number]).filter(([, v]) => v > 0),
        ...LIB_SINGLES.filter((e) => e.practice === p).map((e) => [vs.get(`${s}|${e.key}`)!, 1] as [number, number]), ...LIB_SETS.map((e) => [vset.get(`${s}|${e.key}`)!, e.practices.filter((pp) => pp === p).length] as [number, number]).filter(([, v]) => v > 0)];
      cons.push({ coef: co, sense: ">=", rhs: pB[String(p)].min }); cons.push({ coef: co, sense: "<=", rhs: pB[String(p)].max });
      const t = (pB[String(p)].min + pB[String(p)].max) / 2; const d = dp.get(`${s}|${p}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    const fam = new Map<string, [number, number][]>(); for (const c of [...mcSingles, ...mcSets]) (fam.get(c.fam) ?? fam.set(c.fam, []).get(c.fam)!).push([x(c, s), 1]);
    for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    // 라이브러리 문항군(원형+토픽): 이 시험의 실제 문항과 가상 문항이 같은 군을 두 번 쓰지 않는다
    const libFam = new Map<string, [number, number][]>();
    for (const c of mcSingles) (libFam.get(`${c.archetype}|${c.members[0].topic}`) ?? libFam.set(`${c.archetype}|${c.members[0].topic}`, []).get(`${c.archetype}|${c.members[0].topic}`)!).push([x(c, s), 1]);
    for (const c of mcSets) (libFam.get(c.archetype) ?? libFam.set(c.archetype, []).get(c.archetype)!).push([x(c, s), 1]);
    for (const e of LIB_SINGLES) (libFam.get(e.key) ?? libFam.set(e.key, []).get(e.key)!).push([vs.get(`${s}|${e.key}`)!, 1]);
    for (const e of LIB_SETS) (libFam.get(e.key) ?? libFam.set(e.key, []).get(e.key)!).push([vset.get(`${s}|${e.key}`)!, 1]);
    for (const co of libFam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    for (const t of CHEM_FRQ_TYPES) cons.push({ coef: [...frqs.filter((c) => c.frqType === t).map((c) => [x(c, s), 1] as [number, number]), [vf.get(`${s}|${t}`)!, 1]], sense: "=", rhs: 1 });
  });
  const binary = new Array<boolean>(n).fill(false); for (const j of xv.values()) binary[j] = true; for (const j of vf.values()) binary[j] = true; for (const j of vs.values()) binary[j] = true; for (const j of vset.values()) binary[j] = true;
  const prob = { n, obj, cons, integer: new Array(n).fill(true), binary };
  const r = has("--builtin-ilp") ? solveMip(prob, { timeMs: o.timeMs, log: o.log }) : solveMipHighs(prob, { timeMs: o.timeMs, log: o.log }); // 기본은 HiGHS(분기한정 내장 솔버는 변수 수백 개에서 해를 못 찾는다)
  const out: ChemResult[] = ids.map((id) => ({ id, singles: [], sets: [], frq: [], virtual: [], virtualSets: [], virtualSetArchetypes: [], frqVirtual: [] }));
  if (r.x.length) ids.forEach((id, s) => {
    for (const c of usable) if (r.x[x(c, s)] > 0.5) (c.kind === "frq" ? out[s].frq : c.shared ? out[s].sets : out[s].singles).push(c);
    for (const e of LIB_SINGLES) if (r.x[vs.get(`${s}|${e.key}`)!] > 0.5) out[s].virtual.push({ set: id, part: "A", unit: e.unit, practice: e.practice, archetype: e.id, topic: e.topic });
    for (const e of LIB_SETS) if (r.x[vset.get(`${s}|${e.key}`)!] > 0.5) { out[s].virtualSets.push(e.unit); out[s].virtualSetArchetypes.push(e.id); }
    for (const t of CHEM_FRQ_TYPES) if (r.x[vf.get(`${s}|${t}`)!] > 0.5) out[s].frqVirtual.push({ set: id, part: "A", native: false, type: t });
  });
  return { res: r, out };
}

/** 한 세트의 MC 위치 목록: 단원 오름차순 블록(단독 1칸, 세트 2칸 연속). 가상 문항은 candidateKey null(가상 세트는 `~virtual-set-<단원>`). 세트의 단원은 첫 문항 기준. */
export function buildChemOrder(r: ChemResult): ChemSetItem[] {
  type Block = { unit: number; key: string; members: { unit: number; skill: string | null }[]; real: boolean };
  const blocks: Block[] = [
    ...r.singles.map((c) => ({ unit: unitOf(c.members[0].topic), key: c.key, members: [{ unit: unitOf(c.members[0].topic), skill: c.members[0].skill }], real: true })),
    ...r.sets.map((c) => ({ unit: unitOf(c.members[0].topic), key: c.key, members: c.members.map((m) => ({ unit: unitOf(m.topic), skill: m.skill })), real: true })),
    ...r.virtual.map((v, i) => ({ unit: v.unit, key: `~v${i}`, members: [{ unit: v.unit, skill: `${v.practice}.?` as string | null }], real: false })),
    ...r.virtualSets.map((u) => ({ unit: u, key: `~virtual-set-${u}`, members: Array.from({ length: CHEM_SET_SIZE }, () => ({ unit: u, skill: "5.?" as string | null })), real: false })),
  ].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
  const out: ChemSetItem[] = []; let pos = 1;
  for (const b of blocks) for (const m of b.members) out.push({ kind: "mc", unit: String(m.unit), skill: m.skill, candidateKey: b.real && b.members.length === 1 ? null : b.key, position: pos++ });
  return out;
}

/** 독립 검증기(배정기와 별개): 공식 구조·단원·Practice·세트·FRQ 유형·문항군·세트 간 중복·차단 키. 위반 목록(빈 배열 = 통과). */
export function verifyChemAssignment(res: ChemResult[], blocked: Set<string> = new Set()): string[] {
  const bad: string[] = []; const used = new Map<string, string>();
  for (const r of res) {
    const mc = buildChemOrder(r);
    const frqItems: ChemSetItem[] = [...r.frq.map((c, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: c.key, position: i + 1 })), ...r.frqVirtual.map((v, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: null, position: r.frq.length + i + 1 }))];
    for (const v of verifyChemFullComposition([...mc, ...frqItems])) bad.push(`${r.id}: ${v}`);
    const keys = [...r.singles, ...r.sets, ...r.frq];
    const fams = [...r.singles, ...r.sets].map((c) => c.fam); if (new Set(fams).size !== fams.length) bad.push(`${r.id}: 문항군 중복`);
    const ffams = r.frq.map((c) => c.fam); if (new Set(ffams).size !== ffams.length) bad.push(`${r.id}: FRQ 문항군 중복`);
    const types = [...r.frq.map((c) => c.frqType), ...r.frqVirtual.map((v) => v.type)].sort(); if (types.join() !== [...CHEM_FRQ_TYPES].sort().join()) bad.push(`${r.id}: FRQ 유형 ${types.join("+")} ≠ 7유형 각 1개`);
    if (r.sets.some((c) => c.members.length !== CHEM_SET_SIZE)) bad.push(`${r.id}: 공유 세트 크기`);
    for (const c of keys) { if (blocked.has(c.key)) bad.push(`${r.id}: 차단된 항목 ${c.key}`); if (used.has(c.key)) bad.push(`${c.key}: ${used.get(c.key)} 와 ${r.id} 중복`); used.set(c.key, r.id); }
  }
  return bad;
}

/** 보고서(exact-assign 형식과 호환): mcA = MC 후보 키(세트는 한 번, 단원 순서), mcB = [], frqA = FRQ 키(7유형 순), frqB = []. */
export function toReportSet(r: ChemResult) {
  const seen = new Set<string>(); const mcKeys: string[] = [];
  const blocks = [...r.singles.map((c) => ({ unit: unitOf(c.members[0].topic), key: c.key })), ...r.sets.map((c) => ({ unit: unitOf(c.members[0].topic), key: c.key }))].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
  for (const b of blocks) if (!seen.has(b.key)) { seen.add(b.key); mcKeys.push(b.key); }
  const frqKeys = [...CHEM_FRQ_TYPES].map((t) => r.frq.find((c) => c.frqType === t)?.key).filter((k): k is string => !!k);
  return { id: r.id, mcA: mcKeys, mcB: [] as string[], virtual: r.virtual, virtualSets: r.virtualSets, virtualSetArchetypes: r.virtualSetArchetypes, frqA: frqKeys, frqB: [] as string[], frqVirtual: r.frqVirtual, subject: "ap_chemistry" };
}

export function practiceSummary(r: ChemResult) {
  const c: Record<string, number> = {}, k: Record<string, number> = {};
  for (const it of [...r.singles, ...r.sets]) for (const m of it.members) { c[String(practiceOf(m.skill))] = (c[String(practiceOf(m.skill))] ?? 0) + 1; k[m.skill] = (k[m.skill] ?? 0) + 1; }
  for (const v of r.virtual) c[String(v.practice)] = (c[String(v.practice)] ?? 0) + 1;
  c["5"] = (c["5"] ?? 0) + r.virtualSets.length * CHEM_SET_SIZE;
  return { practice: c, skills: k };
}

function main() {
  const ids = arg("--sets", "CH1").split(",").filter(Boolean); const TIME = Number(arg("--time-ms", "120000"));
  const files = arg("--files") ? arg("--files").split(",") : undefined;
  const { all, pool } = loadChemPool({ requireScreen: !has("--no-screen"), files }); void all;
  const log = (s: string) => console.error(s);
  const blocked = new Set<string>(); for (const f of arg("--block-file").split(",").filter(Boolean)) for (const st of (JSON.parse(readFileSync(f, "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets) for (const k of [...(st.mcA ?? []), ...(st.frqA ?? [])]) blocked.add(k);
  let m: ReturnType<typeof solveChemSets>;
  if (has("--joint")) m = solveChemSets(ids, pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked });
  else { // 순차: CH1 을 최적으로 푼 뒤 그 문항을 막고 CH2 를 푼다(세트 간 겹침 0 보장)
    const out: ChemResult[] = []; let res = { status: "optimal", obj: 0, nodes: 0, x: [0] } as unknown as ReturnType<typeof solveChemSets>["res"]; const bl = new Set(blocked);
    for (const id of ids) {
      const one = solveChemSets([id], pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked: bl });
      out.push(...one.out); res = { ...one.res, obj: (res.obj ?? 0) + one.res.obj, nodes: (res.nodes ?? 0) + one.res.nodes, status: one.res.status } as typeof res;
      for (const it of [...one.out[0].singles, ...one.out[0].sets, ...one.out[0].frq]) bl.add(it.key);
    }
    m = { res, out };
  }
  const results = m.out;
  const bad = m.res.x.length ? verifyChemAssignment(results) : ["해 없음"];
  const cnt = (f: (c: ChemItem) => boolean) => pool.filter(f).length;
  console.log(`# chem-assign sets=${ids.join(",")} 재고 단독 ${cnt((c) => c.kind === "mc" && !c.shared)} 세트 ${cnt((c) => c.shared)} FRQ ${cnt((c) => c.kind === "frq")}`);
  console.log(`status=${m.res.status} 목적값(가상×1000 + 단원 이탈 + Practice 이탈×0.2)=${m.res.obj} 노드 ${m.res.nodes} 가상 문항=${results.reduce((a, r) => a + r.virtual.length + r.virtualSets.length * CHEM_SET_SIZE + r.frqVirtual.length, 0)}`);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of results) {
    const u: Record<string, number> = {}; for (const it of buildChemOrder(r)) u[it.unit ?? "?"] = (u[it.unit ?? "?"] ?? 0) + 1;
    console.log(`- ${r.id}: 단독 ${r.singles.length}+가상 ${r.virtual.length}, 세트 ${r.sets.length}+가상 ${r.virtualSets.length}, FRQ ${r.frq.length}+가상 ${r.frqVirtual.length}, 단원 ${JSON.stringify(u)}`);
    const mcq = [...r.singles, ...r.sets].reduce((a, c) => a + (c.kind === "mc" ? c.members.length : 0), 0), ex = [...r.singles, ...r.sets].reduce((a, c) => a + (c.exam ?? 0), 0);
    console.log(`    MC exam_prep ${ex}/${mcq + r.virtual.length + r.virtualSets.length * CHEM_SET_SIZE}${mcq ? ` (재고 문항 기준 ${((ex / mcq) * 100).toFixed(0)}%)` : ""}`);
    const sk = practiceSummary(r); console.log(`    Practice ${JSON.stringify(sk.practice)} 스킬 코드 ${JSON.stringify(sk.skills)}`);
    for (const v of r.virtual) console.log(`    가상 MC: 단원 ${v.unit} Practice ${v.practice} 원형 ${v.archetype} (${v.topic})`);
    r.virtualSets.forEach((v, i) => console.log(`    가상 세트: 단원 ${v} 원형 ${r.virtualSetArchetypes[i]}`));
    for (const v of r.frqVirtual) console.log(`    가상 FRQ: ${v.type}`);
  }
  const w = arg("--write-report");
  if (w) { writeFileSync(w, JSON.stringify({ sets: results.map(toReportSet) }, null, 1)); console.error(`보고서 기록: ${w}`); }
}
if (process.argv[1]?.endsWith("chem-assign.ts")) main();
