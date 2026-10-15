// AP Psychology 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). macro-assign.ts·bio-assign.ts 와 같은 방식(정수계획 HiGHS + 배정기와 별개인 독립 검증기)을 Psychology 구조에 적용한다.
//   npx tsx scripts/ap-generation/psych-assign.ts --sets PS1[,PS2] [--time-ms 120000] [--write-report <경로 .json>] [--files psych-p1a-items,...] [--no-screen] [--prefer-exam-prep] [--block-file <보고서.json[,..]>] [--joint]
// 조건(공식 구조, docs/ap/psychology-facts.md): MC 75 = 단독 + 3문항 세트 정확히 PSYCH_SET_COUNT 개(같은 단원, 연속 위치), 단원 5-단원 각 15-25 %(정수 11-19, **차단**), Practice 1/2/3 = 60-70 / 20-30 / 5-15 %(차단; CED 는 65/25/10 %를 '대략'으로 공표),
//   Practice 4 는 MC 에서 평가하지 않는다. FRQ 2 = AAQ 1 + EBQ 1. 한 시험 안에서 같은 문항군(원형+토픽, look-alike 포함)은 한 번만, 시험 사이 같은 문항 0,
//   시험 사이 같은 질문·같은 정답 문장(같은 변형의 다른 후보; sig)도 0. 재고에 없는 칸은 가상 문항으로 세어 부족분을 (단원 × 스킬) 칸 단위로 정확히 보고한다.
import { readFileSync, writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { PSYCH_FRQ_TYPES, PSYCH_FULL_TARGET, PSYCH_MC_COUNT, PSYCH_SET_COUNT, PSYCH_SET_SIZE, psychPracticeBounds, psychUnitBounds, verifyPsychFullComposition, type PsychSetItem } from "../../lib/ap-exam/psych-rules";
import { psychGuide } from "../../lib/ap-generation/subjects/psych";
import { loadPsychPool, type PsychItem } from "./psych-pool";
import { solveMipHighs } from "./ilp-highs";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export type PsychVirtual = { set: string; part: "A"; unit: number; practice: number; skill: string; archetype: string; topic: string };
export type PsychFrqVirtual = { set: string; part: "A"; native: false; type: string; archetype: string };
export type PsychResult = { id: string; singles: PsychItem[]; sets: PsychItem[]; frq: PsychItem[]; virtual: PsychVirtual[]; virtualSets: number[]; virtualSetArchetypes: string[]; frqVirtual: PsychFrqVirtual[] };
const UNITS = [1, 2, 3, 4, 5]; const PRACTICES = [1, 2, 3];
const unitOf = (topic: string) => Number(String(topic).split(".")[0]); const practiceOf = (skill: string) => Number(String(skill).split(".")[0]);
const guideRows = psychGuide.archetypes as { id: string; topic: string; skill: string }[];
/** 후보가 모두 반려되고 고치지 못한 원형은 EXCLUDED 에 적는다(가상 칸 계획에서 뺀다). */
export const EXCLUDED_ARCHETYPES = new Set<string>([]);
const setBase = (id: string) => id.replace(/_q\d+$/, "");
/** 라이브러리 단독 원형(원형 id + 토픽 = 문항군 키). 가상 단독 문항은 이 원형 중 하나를 시험당 최대 한 번 쓴다. */
export const LIB_SINGLES = guideRows.filter((g) => !g.id.startsWith("pss_") && !EXCLUDED_ARCHETYPES.has(g.id)).map((g) => ({ id: g.id, topic: g.topic, unit: unitOf(g.topic), practice: practiceOf(g.skill), skill: g.skill, key: `${g.id}|${g.topic}` }));
/** 3문항 세트 원형(pss_*_q1..q3 를 합친 것). */
export const LIB_SETS = [...new Set(guideRows.filter((g) => g.id.startsWith("pss_")).map((g) => setBase(g.id)))].filter((id) => !EXCLUDED_ARCHETYPES.has(id)).map((id) => { const m = guideRows.filter((g) => g.id.startsWith(`${id}_q`)); return { id, unit: unitOf(m[0].topic), members: m.map((g) => ({ unit: unitOf(g.topic), practice: practiceOf(g.skill), skill: g.skill })), key: id }; });
/** FRQ 시나리오: 가상 FRQ 는 이 시나리오 중 하나(유형 = template). */
export const LIB_FRQ = (psychGuide.frqTemplates ?? []).filter((t) => !EXCLUDED_ARCHETYPES.has(t.id)).map((t) => ({ id: t.id, type: String(t.template), key: t.id }));

export function solvePsychSets(ids: string[], items: PsychItem[], o: { timeMs: number; log?: (s: string) => void; blocked?: Set<string>; blockedArchetypes?: Set<string>; blockedSigs?: Set<string>; preferExamPrep?: boolean; cost?: (c: PsychItem) => number; setCount?: number }) {
  const blocked = o.blocked ?? new Set<string>(); const blockedArch = o.blockedArchetypes ?? new Set<string>(); const blockedSigs = o.blockedSigs ?? new Set<string>(); const SETN = o.setCount ?? PSYCH_SET_COUNT;
  const LS = LIB_SINGLES.filter((e) => !blockedArch.has(e.id)), LT = LIB_SETS.filter((e) => !blockedArch.has(e.id)), LF = LIB_FRQ.filter((e) => !blockedArch.has(e.id));
  const usable = items.filter((c) => !blocked.has(c.key) && !blockedArch.has(c.archetype) && !(c.sig && blockedSigs.has(c.sig)) && (c.kind === "frq" ? (PSYCH_FRQ_TYPES as readonly string[]).includes(c.frqType) : c.shared ? c.members.length === PSYCH_SET_SIZE && new Set(c.members.map((m) => m.unit)).size === 1 : c.members.length === 1) && (c.kind === "frq" || c.members.every((m) => PRACTICES.includes(practiceOf(m.skill)) && UNITS.includes(m.unit))));
  const mcSingles = usable.filter((c) => c.kind === "mc" && !c.shared), mcSets = usable.filter((c) => c.kind === "mc" && c.shared), frqs = usable.filter((c) => c.kind === "frq");
  let n = 0; const V = (): number => n++;
  const xv = new Map<string, number>();
  usable.forEach((c, i) => ids.forEach((_, s) => xv.set(`${i}|${s}`, V())));
  const idx = new Map(usable.map((c, i) => [c, i] as const));
  const x = (c: PsychItem, s: number) => xv.get(`${idx.get(c)}|${s}`)!;
  const vs = new Map<string, number>(), vset = new Map<string, number>(), vf = new Map<string, number>(), du = new Map<string, number>(), dp = new Map<string, number>();
  ids.forEach((_, s) => {
    LS.forEach((e) => vs.set(`${s}|${e.key}`, V()));
    LT.forEach((e) => vset.set(`${s}|${e.key}`, V()));
    LF.forEach((e) => vf.set(`${s}|${e.key}`, V()));
    for (const u of UNITS) du.set(`${s}|${u}`, V());
    for (const p of PRACTICES) dp.set(`${s}|${p}`, V());
  });
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = [];
  for (const j of vs.values()) obj[j] = 1000; for (const j of vset.values()) obj[j] = 2000; for (const j of vf.values()) obj[j] = 1000;
  for (const j of du.values()) obj[j] = 1; for (const j of dp.values()) obj[j] = 0.2;
  if (o.preferExamPrep) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += -0.01 * (c.exam ?? 0); }));
  if (o.cost) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += o.cost!(c); }));
  const uB = psychUnitBounds(), pB = psychPracticeBounds();
  usable.forEach((c) => cons.push({ coef: ids.map((_, s) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 })); // 같은 문항은 시험 하나에만
  ids.forEach((_, s) => {
    const singleTerms = (): [number, number][] => [...mcSingles.map((c) => [x(c, s), 1] as [number, number]), ...LS.map((e) => [vs.get(`${s}|${e.key}`)!, 1] as [number, number])];
    const setTerms = (): [number, number][] => [...mcSets.map((c) => [x(c, s), 1] as [number, number]), ...LT.map((e) => [vset.get(`${s}|${e.key}`)!, 1] as [number, number])];
    cons.push({ coef: [...singleTerms(), ...setTerms().map(([j, v]) => [j, v * PSYCH_SET_SIZE] as [number, number])], sense: "=", rhs: PSYCH_MC_COUNT }); // MC 75 = 단독 + 3 x 세트
    cons.push({ coef: setTerms(), sense: "=", rhs: SETN });
    for (const u of UNITS) {
      const co: [number, number][] = [...mcSingles.filter((c) => c.members[0].unit === u).map((c) => [x(c, s), 1] as [number, number]),
        ...mcSets.map((c) => [x(c, s), c.members.filter((m) => m.unit === u).length] as [number, number]).filter(([, v]) => v > 0),
        ...LS.filter((e) => e.unit === u).map((e) => [vs.get(`${s}|${e.key}`)!, 1] as [number, number]), ...LT.map((e) => [vset.get(`${s}|${e.key}`)!, e.members.filter((m) => m.unit === u).length] as [number, number]).filter(([, v]) => v > 0)];
      cons.push({ coef: co, sense: ">=", rhs: uB[String(u)].min }); cons.push({ coef: co, sense: "<=", rhs: uB[String(u)].max });
      const t = PSYCH_FULL_TARGET.units[String(u)]; const d = du.get(`${s}|${u}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    for (const p of PRACTICES) { // Practice(스킬 코드의 앞 숫자) 범위: 차단
      const co: [number, number][] = [...mcSingles.filter((c) => practiceOf(c.members[0].skill) === p).map((c) => [x(c, s), 1] as [number, number]),
        ...mcSets.map((c) => [x(c, s), c.members.filter((m) => practiceOf(m.skill) === p).length] as [number, number]).filter(([, v]) => v > 0),
        ...LS.filter((e) => e.practice === p).map((e) => [vs.get(`${s}|${e.key}`)!, 1] as [number, number]), ...LT.map((e) => [vset.get(`${s}|${e.key}`)!, e.members.filter((m) => m.practice === p).length] as [number, number]).filter(([, v]) => v > 0)];
      cons.push({ coef: co, sense: ">=", rhs: pB[String(p)].min }); cons.push({ coef: co, sense: "<=", rhs: pB[String(p)].max });
      const t = PSYCH_FULL_TARGET.practice[String(p)]; const d = dp.get(`${s}|${p}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    // 문항군: 한 시험에 한 번(실제·가상이 같은 군을 두 번 쓰지 않는다; look-alike 포함)
    const fam = new Map<string, [number, number][]>(); for (const c of [...mcSingles, ...mcSets]) (fam.get(c.fam) ?? fam.set(c.fam, []).get(c.fam)!).push([x(c, s), 1]);
    for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    const libFam = new Map<string, [number, number][]>();
    for (const c of mcSingles) (libFam.get(`${c.archetype}|${c.members[0].topic}`) ?? libFam.set(`${c.archetype}|${c.members[0].topic}`, []).get(`${c.archetype}|${c.members[0].topic}`)!).push([x(c, s), 1]);
    for (const e of LS) (libFam.get(e.key) ?? libFam.set(e.key, []).get(e.key)!).push([vs.get(`${s}|${e.key}`)!, 1]);
    for (const co of libFam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    // FRQ: 유형(aaq·ebq)마다 정확히 1 — 재고 후보 또는 가상 시나리오
    for (const t of PSYCH_FRQ_TYPES) cons.push({ coef: [...frqs.filter((c) => c.frqType === t).map((c) => [x(c, s), 1] as [number, number]), ...LF.filter((e) => e.type === t).map((e) => [vf.get(`${s}|${e.key}`)!, 1] as [number, number])], sense: "=", rhs: 1 });
  });
  // 시험 사이: 같은 질문·같은 정답 문장(sig)을 가진 후보는 전체에서 한 번만, FRQ 시나리오·세트 원형도 전체에서 한 번만
  if (ids.length > 1) {
    const bySig = new Map<string, PsychItem[]>(); for (const c of [...mcSingles, ...mcSets]) if (c.sig) (bySig.get(c.sig) ?? bySig.set(c.sig, []).get(c.sig)!).push(c);
    for (const g of bySig.values()) if (g.length > 1) cons.push({ coef: g.flatMap((c) => ids.map((_, s) => [x(c, s), 1] as [number, number])), sense: "<=", rhs: 1 });
  }
  const once = new Map<string, [number, number][]>(); const addOnce = (k: string, j: number) => (once.get(k) ?? once.set(k, []).get(k)!).push([j, 1]);
  ids.forEach((_, s) => { for (const c of [...mcSets, ...frqs]) addOnce(c.archetype, x(c, s)); for (const e of LT) addOnce(e.id, vset.get(`${s}|${e.key}`)!); for (const e of LF) addOnce(e.id, vf.get(`${s}|${e.key}`)!); });
  for (const co of once.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
  const binary = new Array<boolean>(n).fill(false); for (const j of [...xv.values(), ...vf.values(), ...vs.values(), ...vset.values()]) binary[j] = true;
  const prob = { n, obj, cons, integer: new Array(n).fill(true), binary };
  const r = has("--builtin-ilp") ? solveMip(prob, { timeMs: o.timeMs, log: o.log }) : solveMipHighs(prob, { timeMs: o.timeMs, log: o.log });
  const out: PsychResult[] = ids.map((id) => ({ id, singles: [], sets: [], frq: [], virtual: [], virtualSets: [], virtualSetArchetypes: [], frqVirtual: [] }));
  if (r.x.length) ids.forEach((id, s) => {
    for (const c of usable) if (r.x[x(c, s)] > 0.5) (c.kind === "frq" ? out[s].frq : c.shared ? out[s].sets : out[s].singles).push(c);
    for (const e of LS) if (r.x[vs.get(`${s}|${e.key}`)!] > 0.5) out[s].virtual.push({ set: id, part: "A", unit: e.unit, practice: e.practice, skill: e.skill, archetype: e.id, topic: e.topic });
    for (const e of LT) if (r.x[vset.get(`${s}|${e.key}`)!] > 0.5) { out[s].virtualSets.push(e.unit); out[s].virtualSetArchetypes.push(e.id); }
    for (const e of LF) if (r.x[vf.get(`${s}|${e.key}`)!] > 0.5) out[s].frqVirtual.push({ set: id, part: "A", native: false, type: e.type, archetype: e.id });
  });
  return { res: r, out };
}

/** 한 세트의 MC 위치 목록: 단원 오름차순 블록(단독 1칸, 세트 3칸 연속). 가상 문항은 candidateKey null(가상 세트는 `~virtual-set-<원형>`). */
export function buildPsychOrder(r: PsychResult): PsychSetItem[] {
  type Block = { unit: number; key: string; members: { unit: number; skill: string | null }[]; real: boolean };
  const setLib = (id: string) => LIB_SETS.find((e) => e.id === id)!;
  const blocks: Block[] = [
    ...r.singles.map((c) => ({ unit: c.members[0].unit, key: c.key, members: [{ unit: c.members[0].unit, skill: c.members[0].skill }], real: true })),
    ...r.sets.map((c) => ({ unit: c.members[0].unit, key: c.key, members: c.members.map((m) => ({ unit: m.unit, skill: m.skill })), real: true })),
    ...r.virtual.map((v, i) => ({ unit: v.unit, key: `~v${i}`, members: [{ unit: v.unit, skill: v.skill as string | null }], real: false })),
    ...r.virtualSetArchetypes.map((id) => ({ unit: setLib(id).unit, key: `~virtual-set-${id}`, members: setLib(id).members.map((m) => ({ unit: m.unit, skill: m.skill as string | null })), real: false })),
  ].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
  const out: PsychSetItem[] = []; let pos = 1;
  for (const b of blocks) for (const m of b.members) out.push({ kind: "mc", unit: String(m.unit), skill: m.skill, candidateKey: b.members.length > 1 ? b.key : null, position: pos++ });
  return out;
}

/** 독립 검증기(배정기와 별개): 공식 구조·단원·Practice·세트·FRQ 유형·문항군·시험 간 문항·변형(sig)·차단 키. 위반 목록(빈 배열 = 통과). */
export function verifyPsychAssignment(res: PsychResult[], blocked: Set<string> = new Set()): string[] {
  const bad: string[] = []; const used = new Map<string, string>(); const usedSig = new Map<string, string>(); const arch = new Map<string, string>();
  for (const r of res) {
    const mc = buildPsychOrder(r);
    const frqItems: PsychSetItem[] = [...r.frq.map((c, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: c.key, position: i + 1, frqType: c.frqType })), ...r.frqVirtual.map((v, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: null, position: r.frq.length + i + 1, frqType: v.type }))];
    for (const v of verifyPsychFullComposition([...mc, ...frqItems])) bad.push(`${r.id}: ${v}`);
    const fams = [...r.singles, ...r.sets].map((c) => c.fam); if (new Set(fams).size !== fams.length) bad.push(`${r.id}: 문항군 중복`);
    const ffams = r.frq.map((c) => c.fam); if (new Set(ffams).size !== ffams.length) bad.push(`${r.id}: FRQ 문항군 중복`);
    if (r.sets.some((c) => c.members.length !== PSYCH_SET_SIZE || new Set(c.members.map((m) => m.unit)).size !== 1)) bad.push(`${r.id}: 공유 세트 크기·단원`);
    const libKeys = [...r.singles.map((c) => `${c.archetype}|${c.members[0].topic}`), ...r.virtual.map((v) => `${v.archetype}|${v.topic}`)]; if (new Set(libKeys).size !== libKeys.length) bad.push(`${r.id}: 원형+토픽 문항군(가상 포함) 중복`);
    for (const a of [...r.sets.map((c) => c.archetype), ...r.virtualSetArchetypes, ...r.frq.map((c) => c.archetype), ...r.frqVirtual.map((v) => v.archetype)]) { if (arch.has(a) && arch.get(a) !== r.id) bad.push(`세트·FRQ 시나리오 ${a}: ${arch.get(a)} 와 ${r.id} 겹침`); arch.set(a, r.id); }
    for (const c of [...r.singles, ...r.sets]) { if (c.sig) { const o2 = usedSig.get(c.sig); if (o2 && o2 !== r.id) bad.push(`${c.key}: ${o2} 와 ${r.id} 에 같은 질문·정답 문장(sig) 중복`); usedSig.set(c.sig, r.id); } }
    for (const c of [...r.singles, ...r.sets, ...r.frq]) { if (blocked.has(c.key)) bad.push(`${r.id}: 차단된 항목 ${c.key}`); if (used.has(c.key)) bad.push(`${c.key}: ${used.get(c.key)} 와 ${r.id} 중복`); used.set(c.key, r.id); }
  }
  return bad;
}

/** 보고서(exact-assign 형식과 호환): mcA = MC 후보 키(세트는 한 번, 단원 순서), mcB = [], frqA = FRQ 키(AAQ → EBQ 순), frqB = []. */
export function toReportSet(r: PsychResult) {
  const seen = new Set<string>(); const mcKeys: string[] = [];
  const blocks = [...r.singles.map((c) => ({ unit: c.members[0].unit, key: c.key })), ...r.sets.map((c) => ({ unit: c.members[0].unit, key: c.key }))].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
  for (const b of blocks) if (!seen.has(b.key)) { seen.add(b.key); mcKeys.push(b.key); }
  const frqKeys = [...PSYCH_FRQ_TYPES].map((t) => r.frq.find((c) => c.frqType === t)?.key).filter((k): k is string => !!k);
  return { id: r.id, mcA: mcKeys, mcB: [] as string[], virtual: r.virtual, virtualSets: r.virtualSets, virtualSetArchetypes: r.virtualSetArchetypes, frqA: frqKeys, frqB: [] as string[], frqVirtual: r.frqVirtual, subject: "ap_psychology" };
}

export function practiceSummary(r: PsychResult) {
  const c: Record<string, number> = {}, k: Record<string, number> = {};
  for (const it of [...r.singles, ...r.sets]) for (const m of it.members) { c[String(practiceOf(m.skill))] = (c[String(practiceOf(m.skill))] ?? 0) + 1; k[m.skill] = (k[m.skill] ?? 0) + 1; }
  for (const v of r.virtual) { c[String(v.practice)] = (c[String(v.practice)] ?? 0) + 1; k[v.skill] = (k[v.skill] ?? 0) + 1; }
  for (const id of r.virtualSetArchetypes) for (const m of LIB_SETS.find((e) => e.id === id)!.members) { c[String(m.practice)] = (c[String(m.practice)] ?? 0) + 1; k[m.skill] = (k[m.skill] ?? 0) + 1; }
  return { practice: c, skills: k };
}

function main() {
  const ids = arg("--sets", "PS1,PS2").split(",").filter(Boolean); const TIME = Number(arg("--time-ms", "120000"));
  const files = arg("--files") ? arg("--files").split(",") : undefined;
  const { pool } = loadPsychPool({ requireScreen: !has("--no-screen"), files });
  const log = (s: string) => console.error(s);
  const blocked = new Set<string>(); for (const f of arg("--block-file").split(",").filter(Boolean)) for (const st of (JSON.parse(readFileSync(f, "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets) for (const k of [...(st.mcA ?? []), ...(st.frqA ?? [])]) blocked.add(k);
  const setCount = Number(arg("--set-count", String(PSYCH_SET_COUNT)));
  let m: ReturnType<typeof solvePsychSets>;
  if (has("--joint")) m = solvePsychSets(ids, pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked, setCount });
  else { // 순차: PS1 을 최적으로 푼 뒤 그 문항·변형·시나리오를 막고 PS2 를 푼다(세트 간 겹침 0 보장)
    const out: PsychResult[] = []; let res = { status: "optimal", obj: 0, nodes: 0, x: [0] } as unknown as ReturnType<typeof solvePsychSets>["res"]; const bl = new Set(blocked); const blArch = new Set<string>(); const blSig = new Set<string>();
    for (const id of ids) {
      const one = solvePsychSets([id], pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked: bl, blockedArchetypes: blArch, blockedSigs: blSig, setCount });
      out.push(...one.out); res = { ...one.res, obj: (res.obj ?? 0) + one.res.obj, nodes: (res.nodes ?? 0) + one.res.nodes, status: one.res.status } as typeof res;
      const r0 = one.out[0];
      for (const it of [...r0.singles, ...r0.sets, ...r0.frq]) { bl.add(it.key); if (it.sig) blSig.add(it.sig); }
      for (const a of [...r0.sets.map((c) => c.archetype), ...r0.virtualSetArchetypes, ...r0.frq.map((c) => c.archetype), ...r0.frqVirtual.map((v) => v.archetype)]) blArch.add(a);
    }
    m = { res, out };
  }
  const results = m.out;
  const bad = m.res.x.length ? verifyPsychAssignment(results) : ["해 없음"];
  const cnt = (f: (c: PsychItem) => boolean) => pool.filter(f).length;
  console.log(`# psych-assign sets=${ids.join(",")} 재고 단독 ${cnt((c) => c.kind === "mc" && !c.shared)} 세트 ${cnt((c) => c.shared)} FRQ ${cnt((c) => c.kind === "frq")}`);
  console.log(`status=${m.res.status} 목적값(가상×1000 + 단원 이탈 + Practice 이탈×0.2)=${m.res.obj} 노드 ${m.res.nodes} 가상 문항=${results.reduce((a, r) => a + r.virtual.length + r.virtualSets.length * PSYCH_SET_SIZE + r.frqVirtual.length, 0)}`);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of results) {
    const u: Record<string, number> = {}; for (const it of buildPsychOrder(r)) u[it.unit ?? "?"] = (u[it.unit ?? "?"] ?? 0) + 1;
    console.log(`- ${r.id}: 단독 ${r.singles.length}+가상 ${r.virtual.length}, 세트 ${r.sets.length}+가상 ${r.virtualSets.length}, FRQ ${r.frq.length}+가상 ${r.frqVirtual.length}, 단원 ${JSON.stringify(u)}`);
    const ex = [...r.singles, ...r.sets].reduce((a, c) => a + (c.exam ?? 0), 0); console.log(`    MC exam_prep ${ex}/${PSYCH_MC_COUNT}`);
    const sk = practiceSummary(r); console.log(`    Practice ${JSON.stringify(sk.practice)} 스킬 코드 ${JSON.stringify(sk.skills)}`);
    console.log(`    FRQ ${[...r.frq.map((c) => c.frqType), ...r.frqVirtual.map((v) => v.type)].join(" + ")}`);
    for (const v of r.virtual) console.log(`    가상 MC: 단원 ${v.unit} 스킬 ${v.skill} 원형 ${v.archetype} (${v.topic})`);
    r.virtualSets.forEach((v, i) => console.log(`    가상 세트: 단원 ${v} 원형 ${r.virtualSetArchetypes[i]}`));
    for (const v of r.frqVirtual) console.log(`    가상 FRQ: ${v.type} 시나리오 ${v.archetype}`);
  }
  const w = arg("--write-report");
  if (w) { writeFileSync(w, JSON.stringify({ sets: results.map(toReportSet) }, null, 1)); console.error(`보고서 기록: ${w}`); }
}
if (process.argv[1]?.endsWith("psych-assign.ts")) main();
