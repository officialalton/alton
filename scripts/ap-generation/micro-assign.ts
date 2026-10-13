// AP Microeconomics 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). chem-assign.ts 와 같은 방식(정수계획 + 배정기와 별개인 독립 검증기)을 마이크로 구조에 적용한다.
//   npx tsx scripts/ap-generation/micro-assign.ts --sets MI1[,MI2] [--time-ms 120000] [--write-report <경로 .json>] [--files micro-p1a-items,...] [--no-screen] [--prefer-exam-prep] [--block-file <보고서.json[,..]>] [--joint]
// 조건(공식 구조, docs/ap/microeconomics-facts.md): MC 60 = 모두 단독 5지선다, 단원 비중 12-15/20-25/22-25/15-22/10-13/8-13 %(하한 내림·상한 올림 정수 범위), 스킬 범주 비중 범주1 30-42 / 범주2 37-47 / 범주3 16-25 %,
//   수치 분석 스킬(1.C·2.C·3.C) 20-30 % — 단원·범주·수치 분석 범위는 **차단 조건**. FRQ 3 = 긴 1(10점) + 짧은 2(각 5점), 과제 유형 점수 비중(그래프 6-10 / 단언 2-4 / 설명 5-7 / 수치 3-6점).
//   한 시험 안에서 같은 문항군(원형+토픽, look-alike 포함)은 한 번만, 시험 사이 같은 문항은 0. 재고에 없는 칸은 가상 문항으로 세어 부족분을 (단원 × 스킬) 칸 단위로 정확히 보고한다.
import { readFileSync, writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { MICRO_FRQ_PROFILES, MICRO_FRQ_TYPES, MICRO_FULL_TARGET, MICRO_LONG_TYPES, MICRO_MC_COUNT, MICRO_NUMERIC_SKILLS, microCategoryBounds, microFrqTypeBounds, microNumericBounds, microUnitBounds, verifyMicroFullComposition, type MicroSetItem } from "../../lib/ap-exam/micro-rules";
import microGuide from "../../lib/ap-generation/subjects/micro-archetypes.json";
import { loadMicroPool, type MicroItem } from "./micro-pool";
import { solveMipHighs } from "./ilp-highs";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export type MicroVirtual = { set: string; part: "A"; unit: number; skill: string; archetype: string; topic: string };
export type MicroResult = { id: string; singles: MicroItem[]; frq: MicroItem[]; virtual: MicroVirtual[]; frqVirtual: { set: string; part: "A"; native: false; type: string }[] };
const UNITS = [1, 2, 3, 4, 5, 6]; const CATS = [1, 2, 3];
const unitOf = (topic: string) => Number(String(topic).split(".")[0]); const catOf = (skill: string) => Number(String(skill).split(".")[0]);
const isNumeric = (skill: string) => (MICRO_NUMERIC_SKILLS as readonly string[]).includes(skill);
const guideRows = microGuide as { id: string; topic: string; skill: string }[];
/** 라이브러리 단독 원형(원형 id + 토픽 = 문항군 키). 가상 단독 문항은 이 원형 중 하나를 시험당 최대 한 번 쓴다. 후보가 모두 반려되고 고치지 못한 원형은 EXCLUDED 에 적는다. */
export const EXCLUDED_ARCHETYPES = new Set<string>([]);
/** 한 시험에서만 쓸 수 있는 원형: 고정 문장 질문이 사실상 한 가지(질문·키 문장이 같고 선택지 순서만 바뀜)라서 두 시험에 넣으면 학생에게 같은 문제가 두 번 나온다. */
export const ONE_EXAM_ONLY = new Set<string>(["mi_barriers", "mi_cartel_cheat", "mi_demand_determinant", "mi_firm_supply", "mi_free_rider", "mi_lorenz_gini", "mi_mc_excess_capacity", "mi_min_wage_monopsony", "mi_monopoly_vs_pc", "mi_monopsony_concept", "mi_mr_demand", "mi_natural_monopoly", "mi_normal_profit", "mi_pc_longrun", "mi_pd_conditions", "mi_pd_perfect", "mi_surplus_concept", "mi_subsidy_effect"]);
export const LIB_SINGLES = guideRows.filter((g) => !EXCLUDED_ARCHETYPES.has(g.id)).map((g) => ({ id: g.id, topic: g.topic, unit: unitOf(g.topic), skill: g.skill, key: `${g.id}|${g.topic}` }));

export function solveMicroSets(ids: string[], items: MicroItem[], o: { timeMs: number; log?: (s: string) => void; blocked?: Set<string>; blockedArchetypes?: Set<string>; preferExamPrep?: boolean; cost?: (c: MicroItem) => number }) {
  const blocked = o.blocked ?? new Set<string>(); const blockedArch = o.blockedArchetypes ?? new Set<string>();
  const LIB = LIB_SINGLES.filter((e) => !blockedArch.has(e.id));
  const usable = items.filter((c) => !blocked.has(c.key) && !blockedArch.has(c.archetype) && (c.kind === "frq" ? MICRO_FRQ_TYPES.includes(c.frqType) : c.members.length === 1 && c.members.every((m) => CATS.includes(catOf(m.skill)))));
  const mcSingles = usable.filter((c) => c.kind === "mc"), frqs = usable.filter((c) => c.kind === "frq");
  let n = 0; const V = (): number => n++;
  const xv = new Map<string, number>();
  usable.forEach((c, i) => ids.forEach((_, s) => xv.set(`${i}|${s}`, V())));
  const idx = new Map(usable.map((c, i) => [c, i] as const));
  const x = (c: MicroItem, s: number) => xv.get(`${idx.get(c)}|${s}`)!;
  const vs = new Map<string, number>(), vf = new Map<string, number>(), du = new Map<string, number>();
  ids.forEach((_, s) => {
    LIB.forEach((e) => vs.set(`${s}|${e.key}`, V()));
    for (const u of UNITS) du.set(`${s}|${u}`, V());
    for (const t of MICRO_FRQ_TYPES) vf.set(`${s}|${t}`, V());
  });
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = [];
  for (const j of vs.values()) obj[j] = 1000; for (const j of vf.values()) obj[j] = 1000; for (const j of du.values()) obj[j] = 1;
  if (o.preferExamPrep) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += -0.01 * (c.exam ?? 0); }));
  if (o.cost) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += o.cost!(c); }));
  const uB = microUnitBounds(), cB = microCategoryBounds(), nB = microNumericBounds(), fB = microFrqTypeBounds();
  usable.forEach((c) => cons.push({ coef: ids.map((_, s) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 }));
  ids.forEach((_, s) => {
    const mcTerms = (pred: (m: { unit: number; skill: string }) => boolean): [number, number][] => [
      ...mcSingles.filter((c) => pred(c.members[0])).map((c) => [x(c, s), 1] as [number, number]),
      ...LIB.filter((e) => pred(e)).map((e) => [vs.get(`${s}|${e.key}`)!, 1] as [number, number])];
    cons.push({ coef: mcTerms(() => true), sense: "=", rhs: MICRO_MC_COUNT });
    for (const u of UNITS) {
      const co = mcTerms((m) => m.unit === u);
      cons.push({ coef: co, sense: ">=", rhs: uB[String(u)].min }); cons.push({ coef: co, sense: "<=", rhs: uB[String(u)].max });
      const t = MICRO_FULL_TARGET.units[String(u)]; const d = du.get(`${s}|${u}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    for (const c of CATS) { const co = mcTerms((m) => catOf(m.skill) === c); cons.push({ coef: co, sense: ">=", rhs: cB[String(c)].min }); cons.push({ coef: co, sense: "<=", rhs: cB[String(c)].max }); }
    { const co = mcTerms((m) => isNumeric(m.skill)); cons.push({ coef: co, sense: ">=", rhs: nB.min }); cons.push({ coef: co, sense: "<=", rhs: nB.max }); }
    // 문항군: 한 시험에 한 번(실제 문항·가상 문항이 같은 군을 두 번 쓰지 않는다)
    const fam = new Map<string, [number, number][]>(); for (const c of mcSingles) (fam.get(c.fam) ?? fam.set(c.fam, []).get(c.fam)!).push([x(c, s), 1]);
    for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    const libFam = new Map<string, [number, number][]>();
    for (const c of mcSingles) (libFam.get(`${c.archetype}|${c.members[0].topic}`) ?? libFam.set(`${c.archetype}|${c.members[0].topic}`, []).get(`${c.archetype}|${c.members[0].topic}`)!).push([x(c, s), 1]);
    for (const e of LIB) (libFam.get(e.key) ?? libFam.set(e.key, []).get(e.key)!).push([vs.get(`${s}|${e.key}`)!, 1]);
    for (const co of libFam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    // FRQ: 유형마다 한 번, 긴 1 + 짧은 2, 과제 유형 점수 비중
    for (const t of MICRO_FRQ_TYPES) cons.push({ coef: [...frqs.filter((c) => c.frqType === t).map((c) => [x(c, s), 1] as [number, number]), [vf.get(`${s}|${t}`)!, 1]], sense: "<=", rhs: 1 });
    const frqTerm = (f: (t: string) => number): [number, number][] => [...frqs.map((c) => [x(c, s), f(c.frqType)] as [number, number]), ...MICRO_FRQ_TYPES.map((t) => [vf.get(`${s}|${t}`)!, f(t)] as [number, number])].filter(([, v]) => v !== 0);
    cons.push({ coef: frqTerm(() => 1), sense: "=", rhs: 3 });
    cons.push({ coef: frqTerm((t) => (MICRO_LONG_TYPES.includes(t) ? 1 : 0)), sense: "=", rhs: 1 });
    for (const k of ["graph", "assertion", "explain", "numeric"] as const) { const co = frqTerm((t) => MICRO_FRQ_PROFILES[t][k]); cons.push({ coef: co, sense: ">=", rhs: fB[k].min }); cons.push({ coef: co, sense: "<=", rhs: fB[k].max }); }
  });
  const binary = new Array<boolean>(n).fill(false); for (const j of xv.values()) binary[j] = true; for (const j of vf.values()) binary[j] = true; for (const j of vs.values()) binary[j] = true;
  const prob = { n, obj, cons, integer: new Array(n).fill(true), binary };
  const r = has("--builtin-ilp") ? solveMip(prob, { timeMs: o.timeMs, log: o.log }) : solveMipHighs(prob, { timeMs: o.timeMs, log: o.log });
  const out: MicroResult[] = ids.map((id) => ({ id, singles: [], frq: [], virtual: [], frqVirtual: [] }));
  if (r.x.length) ids.forEach((id, s) => {
    for (const c of usable) if (r.x[x(c, s)] > 0.5) (c.kind === "frq" ? out[s].frq : out[s].singles).push(c);
    for (const e of LIB) if (r.x[vs.get(`${s}|${e.key}`)!] > 0.5) out[s].virtual.push({ set: id, part: "A", unit: e.unit, skill: e.skill, archetype: e.id, topic: e.topic });
    for (const t of MICRO_FRQ_TYPES) if (r.x[vf.get(`${s}|${t}`)!] > 0.5) out[s].frqVirtual.push({ set: id, part: "A", native: false, type: t });
  });
  return { res: r, out };
}

/** 한 세트의 MC 위치 목록: 단원 오름차순 블록. 가상 문항은 candidateKey null. */
export function buildMicroOrder(r: MicroResult): MicroSetItem[] {
  type Block = { unit: number; key: string; skill: string };
  const blocks: Block[] = [...r.singles.map((c) => ({ unit: unitOf(c.members[0].topic), key: c.key, skill: c.members[0].skill })), ...r.virtual.map((v, i) => ({ unit: v.unit, key: `~v${i}`, skill: v.skill }))].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
  return blocks.map((b, i) => ({ kind: "mc" as const, unit: String(b.unit), skill: b.skill, candidateKey: b.key.startsWith("~") ? null : b.key, position: i + 1 }));
}

/** 독립 검증기(배정기와 별개): 공식 구조·단원·범주·수치 분석·FRQ 유형·문항군·세트 간 중복·차단 키. 위반 목록(빈 배열 = 통과). */
export function verifyMicroAssignment(res: MicroResult[], blocked: Set<string> = new Set()): string[] {
  const bad: string[] = []; const used = new Map<string, string>();
  for (const r of res) {
    const mc = buildMicroOrder(r);
    const frqItems: MicroSetItem[] = [...r.frq.map((c, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: c.key, position: i + 1, frqType: c.frqType })), ...r.frqVirtual.map((v, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: null, position: r.frq.length + i + 1, frqType: v.type }))];
    for (const v of verifyMicroFullComposition([...mc, ...frqItems])) bad.push(`${r.id}: ${v}`);
    const fams = r.singles.map((c) => c.fam); if (new Set(fams).size !== fams.length) bad.push(`${r.id}: 문항군 중복`);
    const ffams = r.frq.map((c) => c.fam); if (new Set(ffams).size !== ffams.length) bad.push(`${r.id}: FRQ 문항군 중복`);
    const libKeys = [...r.singles.map((c) => `${c.archetype}|${c.members[0].topic}`), ...r.virtual.map((v) => `${v.archetype}|${v.topic}`)]; if (new Set(libKeys).size !== libKeys.length) bad.push(`${r.id}: 원형+토픽 문항군(가상 포함) 중복`);
    for (const c of [...r.singles, ...r.frq]) { if (blocked.has(c.key)) bad.push(`${r.id}: 차단된 항목 ${c.key}`); if (used.has(c.key)) bad.push(`${c.key}: ${used.get(c.key)} 와 ${r.id} 중복`); used.set(c.key, r.id); }
  }
  return bad;
}

/** 보고서(exact-assign 형식과 호환): mcA = MC 후보 키(단원 순서), frqA = FRQ 키(긴 1 → 짧은 2 순), virtual·frqVirtual = 가상 칸. */
export function toReportSet(r: MicroResult) {
  const mcKeys = [...r.singles].sort((a, b) => unitOf(a.members[0].topic) - unitOf(b.members[0].topic) || a.key.localeCompare(b.key)).map((c) => c.key);
  const frqKeys = [...r.frq].sort((a, b) => MICRO_FRQ_PROFILES[b.frqType].points - MICRO_FRQ_PROFILES[a.frqType].points || a.key.localeCompare(b.key)).map((c) => c.key);
  return { id: r.id, mcA: mcKeys, mcB: [] as string[], virtual: r.virtual, virtualSets: [] as number[], frqA: frqKeys, frqB: [] as string[], frqVirtual: r.frqVirtual, subject: "ap_microeconomics" };
}

export function categorySummary(r: MicroResult) {
  const c: Record<string, number> = {}, k: Record<string, number> = {}; let numeric = 0;
  for (const it of r.singles) { const m = it.members[0]; c[String(catOf(m.skill))] = (c[String(catOf(m.skill))] ?? 0) + 1; k[m.skill] = (k[m.skill] ?? 0) + 1; if (isNumeric(m.skill)) numeric++; }
  for (const v of r.virtual) { c[String(catOf(v.skill))] = (c[String(catOf(v.skill))] ?? 0) + 1; k[v.skill] = (k[v.skill] ?? 0) + 1; if (isNumeric(v.skill)) numeric++; }
  return { category: c, skills: k, numeric };
}

function main() {
  const ids = arg("--sets", "MI1").split(",").filter(Boolean); const TIME = Number(arg("--time-ms", "120000"));
  const files = arg("--files") ? arg("--files").split(",") : undefined;
  const { all, pool } = loadMicroPool({ requireScreen: !has("--no-screen"), files }); void all;
  const log = (s: string) => console.error(s);
  const blocked = new Set<string>(); for (const f of arg("--block-file").split(",").filter(Boolean)) for (const st of (JSON.parse(readFileSync(f, "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets) for (const k of [...(st.mcA ?? []), ...(st.frqA ?? [])]) blocked.add(k);
  let m: ReturnType<typeof solveMicroSets>;
  if (has("--joint")) m = solveMicroSets(ids, pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked });
  else { // 순차: MI1 을 최적으로 푼 뒤 그 문항을 막고 MI2 를 푼다(세트 간 겹침 0 보장)
    const out: MicroResult[] = []; let res = { status: "optimal", obj: 0, nodes: 0, x: [0] } as unknown as ReturnType<typeof solveMicroSets>["res"]; const bl = new Set(blocked); const blArch = new Set<string>();
    for (const id of ids) {
      const one = solveMicroSets([id], pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked: bl, blockedArchetypes: blArch });
      out.push(...one.out); res = { ...one.res, obj: (res.obj ?? 0) + one.res.obj, nodes: (res.nodes ?? 0) + one.res.nodes, status: one.res.status } as typeof res;
      for (const it of [...one.out[0].singles, ...one.out[0].frq]) bl.add(it.key);
      for (const a of [...one.out[0].singles.map((c) => c.archetype), ...one.out[0].virtual.map((v) => v.archetype)]) if (ONE_EXAM_ONLY.has(a)) blArch.add(a);
    }
    m = { res, out };
  }
  const results = m.out;
  const bad = m.res.x.length ? verifyMicroAssignment(results) : ["해 없음"];
  const cnt = (f: (c: MicroItem) => boolean) => pool.filter(f).length;
  console.log(`# micro-assign sets=${ids.join(",")} 재고 단독 ${cnt((c) => c.kind === "mc")} FRQ ${cnt((c) => c.kind === "frq")}`);
  console.log(`status=${m.res.status} 목적값(가상×1000 + 단원 이탈)=${m.res.obj} 노드 ${m.res.nodes} 가상 문항=${results.reduce((a, r) => a + r.virtual.length + r.frqVirtual.length, 0)}`);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of results) {
    const u: Record<string, number> = {}; for (const it of buildMicroOrder(r)) u[it.unit ?? "?"] = (u[it.unit ?? "?"] ?? 0) + 1;
    console.log(`- ${r.id}: 단독 ${r.singles.length}+가상 ${r.virtual.length}, FRQ ${r.frq.length}+가상 ${r.frqVirtual.length}, 단원 ${JSON.stringify(u)}`);
    const ex = r.singles.reduce((a, c) => a + (c.exam ?? 0), 0); console.log(`    MC exam_prep ${ex}/${MICRO_MC_COUNT}`);
    const sk = categorySummary(r); console.log(`    범주 ${JSON.stringify(sk.category)} 수치 분석 ${sk.numeric} 스킬 코드 ${JSON.stringify(sk.skills)}`);
    const fr = [...r.frq.map((c) => c.frqType), ...r.frqVirtual.map((v) => v.type)]; console.log(`    FRQ ${fr.join(" + ")}`);
    for (const v of r.virtual) console.log(`    가상 MC: 단원 ${v.unit} 스킬 ${v.skill} 원형 ${v.archetype} (${v.topic})`);
    for (const v of r.frqVirtual) console.log(`    가상 FRQ: ${v.type}`);
  }
  const w = arg("--write-report");
  if (w) { writeFileSync(w, JSON.stringify({ sets: results.map(toReportSet) }, null, 1)); console.error(`보고서 기록: ${w}`); }
}
if (process.argv[1]?.endsWith("micro-assign.ts")) main();
