// AP Macroeconomics 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). chem-assign.ts 와 같은 방식(정수계획 + 배정기와 별개인 독립 검증기)을 매크로 구조에 적용한다.
//   npx tsx scripts/ap-generation/macro-assign.ts --sets MA1[,MA2] [--time-ms 120000] [--write-report <경로 .json>] [--files macro-p1a-items,...] [--no-screen] [--prefer-exam-prep] [--block-file <보고서.json[,..]>] [--joint]
// 조건(공식 구조, docs/ap/macroeconomics-facts.md): MC 60 = 모두 단독 5지선다, 단원 비중 5-10/12-17/17-27/18-23/20-30/10-13 %(하한 내림·상한 올림 정수 범위), 스킬 범주 비중 범주1 30-40 / 범주2 25-32 / 범주3 30-40 %,
//   수치 분석 스킬(1.C·2.C·3.C) 16-20 % — 단원·범주·수치 분석 범위는 **차단 조건**. FRQ 3 = 긴 1(10점) + 짧은 2(각 5점), 과제 유형 점수 비중(그래프 6-10 / 단언 2-4 / 설명 5-7 / 수치 2-5점).
//   한 시험 안에서 같은 문항군(원형+토픽, look-alike 포함)은 한 번만, 시험 사이 같은 문항은 0, 시험 사이 같은 질문·같은 정답 문장(고정 문장 변형의 다른 후보)도 0(sig). 재고에 없는 칸은 가상 문항으로 세어 부족분을 (단원 × 스킬) 칸 단위로 정확히 보고한다.
import { readFileSync, writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { MACRO_FRQ_PROFILES, MACRO_FRQ_TYPES, MACRO_FULL_TARGET, MACRO_LONG_TYPES, MACRO_MC_COUNT, MACRO_NUMERIC_SKILLS, macroCategoryBounds, macroFrqTypeBounds, macroNumericBounds, macroUnitBounds, verifyMacroFullComposition, type MacroSetItem } from "../../lib/ap-exam/macro-rules";
import macroGuide from "../../lib/ap-generation/subjects/macro-archetypes.json";
import { loadMacroPool, type MacroItem } from "./macro-pool";
import { solveMipHighs } from "./ilp-highs";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export type MacroVirtual = { set: string; part: "A"; unit: number; skill: string; archetype: string; topic: string };
export type MacroResult = { id: string; singles: MacroItem[]; frq: MacroItem[]; virtual: MacroVirtual[]; frqVirtual: { set: string; part: "A"; native: false; type: string }[] };
const UNITS = [1, 2, 3, 4, 5, 6]; const CATS = [1, 2, 3];
const unitOf = (topic: string) => Number(String(topic).split(".")[0]); const catOf = (skill: string) => Number(String(skill).split(".")[0]);
const isNumeric = (skill: string) => (MACRO_NUMERIC_SKILLS as readonly string[]).includes(skill);
const guideRows = macroGuide as { id: string; topic: string; skill: string }[];
/** 라이브러리 단독 원형(원형 id + 토픽 = 문항군 키). 가상 단독 문항은 이 원형 중 하나를 시험당 최대 한 번 쓴다. 후보가 모두 반려되고 고치지 못한 원형은 EXCLUDED 에 적는다. */
export const EXCLUDED_ARCHETYPES = new Set<string>([]);
/** 한 시험에서만 쓸 수 있는 원형: 고정 문장 질문이 사실상 한 가지(질문·키 문장이 같고 선택지 순서만 바뀜)라서 두 시험에 넣으면 학생에게 같은 문제가 두 번 나온다. */
export const ONE_EXAM_ONLY = new Set<string>(["ma_ad_vs_demand", "ma_bop_identity", "ma_crowding_concept", "ma_growth_tradeoff", "ma_money_vs_lf", "ma_multiplier_overstated"]);
export const LIB_SINGLES = guideRows.filter((g) => !EXCLUDED_ARCHETYPES.has(g.id)).map((g) => ({ id: g.id, topic: g.topic, unit: unitOf(g.topic), skill: g.skill, key: `${g.id}|${g.topic}` }));

export function solveMacroSets(ids: string[], items: MacroItem[], o: { timeMs: number; log?: (s: string) => void; blocked?: Set<string>; blockedArchetypes?: Set<string>; blockedSigs?: Set<string>; preferExamPrep?: boolean; cost?: (c: MacroItem) => number }) {
  const blocked = o.blocked ?? new Set<string>(); const blockedArch = o.blockedArchetypes ?? new Set<string>();
  const LIB = LIB_SINGLES.filter((e) => !blockedArch.has(e.id));
  const blockedSigs = o.blockedSigs ?? new Set<string>();
  const usable = items.filter((c) => !blocked.has(c.key) && !blockedArch.has(c.archetype) && !(c.sig && blockedSigs.has(c.sig)) && (c.kind === "frq" ? MACRO_FRQ_TYPES.includes(c.frqType) : c.members.length === 1 && c.members.every((m) => CATS.includes(catOf(m.skill)))));
  const mcSingles = usable.filter((c) => c.kind === "mc"), frqs = usable.filter((c) => c.kind === "frq");
  let n = 0; const V = (): number => n++;
  const xv = new Map<string, number>();
  usable.forEach((c, i) => ids.forEach((_, s) => xv.set(`${i}|${s}`, V())));
  const idx = new Map(usable.map((c, i) => [c, i] as const));
  const x = (c: MacroItem, s: number) => xv.get(`${idx.get(c)}|${s}`)!;
  const vs = new Map<string, number>(), vf = new Map<string, number>(), du = new Map<string, number>();
  ids.forEach((_, s) => {
    LIB.forEach((e) => vs.set(`${s}|${e.key}`, V()));
    for (const u of UNITS) du.set(`${s}|${u}`, V());
    for (const t of MACRO_FRQ_TYPES) vf.set(`${s}|${t}`, V());
  });
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = [];
  for (const j of vs.values()) obj[j] = 1000; for (const j of vf.values()) obj[j] = 1000; for (const j of du.values()) obj[j] = 1;
  if (o.preferExamPrep) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += -0.01 * (c.exam ?? 0); }));
  if (o.cost) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += o.cost!(c); }));
  const uB = macroUnitBounds(), cB = macroCategoryBounds(), nB = macroNumericBounds(), fB = macroFrqTypeBounds();
  usable.forEach((c) => cons.push({ coef: ids.map((_, s) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 }));
  ids.forEach((_, s) => {
    const mcTerms = (pred: (m: { unit: number; skill: string }) => boolean): [number, number][] => [
      ...mcSingles.filter((c) => pred(c.members[0])).map((c) => [x(c, s), 1] as [number, number]),
      ...LIB.filter((e) => pred(e)).map((e) => [vs.get(`${s}|${e.key}`)!, 1] as [number, number])];
    cons.push({ coef: mcTerms(() => true), sense: "=", rhs: MACRO_MC_COUNT });
    for (const u of UNITS) {
      const co = mcTerms((m) => m.unit === u);
      cons.push({ coef: co, sense: ">=", rhs: uB[String(u)].min }); cons.push({ coef: co, sense: "<=", rhs: uB[String(u)].max });
      const t = MACRO_FULL_TARGET.units[String(u)]; const d = du.get(`${s}|${u}`)!;
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
    for (const t of MACRO_FRQ_TYPES) cons.push({ coef: [...frqs.filter((c) => c.frqType === t).map((c) => [x(c, s), 1] as [number, number]), [vf.get(`${s}|${t}`)!, 1]], sense: "<=", rhs: 1 });
    const frqTerm = (f: (t: string) => number): [number, number][] => [...frqs.map((c) => [x(c, s), f(c.frqType)] as [number, number]), ...MACRO_FRQ_TYPES.map((t) => [vf.get(`${s}|${t}`)!, f(t)] as [number, number])].filter(([, v]) => v !== 0);
    cons.push({ coef: frqTerm(() => 1), sense: "=", rhs: 3 });
    cons.push({ coef: frqTerm((t) => (MACRO_LONG_TYPES.includes(t) ? 1 : 0)), sense: "=", rhs: 1 });
    for (const k of ["graph", "assertion", "explain", "numeric"] as const) { const co = frqTerm((t) => MACRO_FRQ_PROFILES[t][k]); cons.push({ coef: co, sense: ">=", rhs: fB[k].min }); cons.push({ coef: co, sense: "<=", rhs: fB[k].max }); }
  });
  // 시험 사이: 같은 질문·같은 정답 문장(sig)을 가진 후보는 전체에서 한 번만(한 시험 안에서도 같은 문항군 제약이 이미 있다)
  if (ids.length > 1) {
    const bySig = new Map<string, MacroItem[]>(); for (const c of mcSingles) if (c.sig) (bySig.get(c.sig) ?? bySig.set(c.sig, []).get(c.sig)!).push(c);
    for (const g of bySig.values()) if (g.length > 1) cons.push({ coef: g.flatMap((c) => ids.map((_, s) => [x(c, s), 1] as [number, number])), sense: "<=", rhs: 1 });
  }
  const binary = new Array<boolean>(n).fill(false); for (const j of xv.values()) binary[j] = true; for (const j of vf.values()) binary[j] = true; for (const j of vs.values()) binary[j] = true;
  const prob = { n, obj, cons, integer: new Array(n).fill(true), binary };
  const r = has("--builtin-ilp") ? solveMip(prob, { timeMs: o.timeMs, log: o.log }) : solveMipHighs(prob, { timeMs: o.timeMs, log: o.log });
  const out: MacroResult[] = ids.map((id) => ({ id, singles: [], frq: [], virtual: [], frqVirtual: [] }));
  if (r.x.length) ids.forEach((id, s) => {
    for (const c of usable) if (r.x[x(c, s)] > 0.5) (c.kind === "frq" ? out[s].frq : out[s].singles).push(c);
    for (const e of LIB) if (r.x[vs.get(`${s}|${e.key}`)!] > 0.5) out[s].virtual.push({ set: id, part: "A", unit: e.unit, skill: e.skill, archetype: e.id, topic: e.topic });
    for (const t of MACRO_FRQ_TYPES) if (r.x[vf.get(`${s}|${t}`)!] > 0.5) out[s].frqVirtual.push({ set: id, part: "A", native: false, type: t });
  });
  return { res: r, out };
}

/** 한 세트의 MC 위치 목록: 단원 오름차순 블록. 가상 문항은 candidateKey null. */
export function buildMacroOrder(r: MacroResult): MacroSetItem[] {
  type Block = { unit: number; key: string; skill: string };
  const blocks: Block[] = [...r.singles.map((c) => ({ unit: unitOf(c.members[0].topic), key: c.key, skill: c.members[0].skill })), ...r.virtual.map((v, i) => ({ unit: v.unit, key: `~v${i}`, skill: v.skill }))].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
  return blocks.map((b, i) => ({ kind: "mc" as const, unit: String(b.unit), skill: b.skill, candidateKey: b.key.startsWith("~") ? null : b.key, position: i + 1 }));
}

/** 독립 검증기(배정기와 별개): 공식 구조·단원·범주·수치 분석·FRQ 유형·문항군·세트 간 중복·차단 키. 위반 목록(빈 배열 = 통과). */
export function verifyMacroAssignment(res: MacroResult[], blocked: Set<string> = new Set()): string[] {
  const bad: string[] = []; const used = new Map<string, string>(); const usedSig = new Map<string, string>();
  for (const r of res) {
    const mc = buildMacroOrder(r);
    const frqItems: MacroSetItem[] = [...r.frq.map((c, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: c.key, position: i + 1, frqType: c.frqType })), ...r.frqVirtual.map((v, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: null, position: r.frq.length + i + 1, frqType: v.type }))];
    for (const v of verifyMacroFullComposition([...mc, ...frqItems])) bad.push(`${r.id}: ${v}`);
    const fams = r.singles.map((c) => c.fam); if (new Set(fams).size !== fams.length) bad.push(`${r.id}: 문항군 중복`);
    const ffams = r.frq.map((c) => c.fam); if (new Set(ffams).size !== ffams.length) bad.push(`${r.id}: FRQ 문항군 중복`);
    const libKeys = [...r.singles.map((c) => `${c.archetype}|${c.members[0].topic}`), ...r.virtual.map((v) => `${v.archetype}|${v.topic}`)]; if (new Set(libKeys).size !== libKeys.length) bad.push(`${r.id}: 원형+토픽 문항군(가상 포함) 중복`);
    for (const c of r.singles) { if (c.sig) { const o2 = usedSig.get(c.sig); if (o2 && o2 !== r.id) bad.push(`${c.key}: ${o2} 와 ${r.id} 에 같은 질문·정답 문장(sig) 중복`); usedSig.set(c.sig, r.id); } }
    for (const c of [...r.singles, ...r.frq]) { if (blocked.has(c.key)) bad.push(`${r.id}: 차단된 항목 ${c.key}`); if (used.has(c.key)) bad.push(`${c.key}: ${used.get(c.key)} 와 ${r.id} 중복`); used.set(c.key, r.id); }
  }
  return bad;
}

/** 보고서(exact-assign 형식과 호환): mcA = MC 후보 키(단원 순서), frqA = FRQ 키(긴 1 → 짧은 2 순), virtual·frqVirtual = 가상 칸. */
export function toReportSet(r: MacroResult) {
  const mcKeys = [...r.singles].sort((a, b) => unitOf(a.members[0].topic) - unitOf(b.members[0].topic) || a.key.localeCompare(b.key)).map((c) => c.key);
  const frqKeys = [...r.frq].sort((a, b) => MACRO_FRQ_PROFILES[b.frqType].points - MACRO_FRQ_PROFILES[a.frqType].points || a.key.localeCompare(b.key)).map((c) => c.key);
  return { id: r.id, mcA: mcKeys, mcB: [] as string[], virtual: r.virtual, virtualSets: [] as number[], frqA: frqKeys, frqB: [] as string[], frqVirtual: r.frqVirtual, subject: "ap_macroeconomics" };
}

export function categorySummary(r: MacroResult) {
  const c: Record<string, number> = {}, k: Record<string, number> = {}; let numeric = 0;
  for (const it of r.singles) { const m = it.members[0]; c[String(catOf(m.skill))] = (c[String(catOf(m.skill))] ?? 0) + 1; k[m.skill] = (k[m.skill] ?? 0) + 1; if (isNumeric(m.skill)) numeric++; }
  for (const v of r.virtual) { c[String(catOf(v.skill))] = (c[String(catOf(v.skill))] ?? 0) + 1; k[v.skill] = (k[v.skill] ?? 0) + 1; if (isNumeric(v.skill)) numeric++; }
  return { category: c, skills: k, numeric };
}

function main() {
  const ids = arg("--sets", "MA1").split(",").filter(Boolean); const TIME = Number(arg("--time-ms", "120000"));
  const files = arg("--files") ? arg("--files").split(",") : undefined;
  const { all, pool } = loadMacroPool({ requireScreen: !has("--no-screen"), files }); void all;
  const log = (s: string) => console.error(s);
  const blocked = new Set<string>(); for (const f of arg("--block-file").split(",").filter(Boolean)) for (const st of (JSON.parse(readFileSync(f, "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets) for (const k of [...(st.mcA ?? []), ...(st.frqA ?? [])]) blocked.add(k);
  let m: ReturnType<typeof solveMacroSets>;
  if (has("--joint")) m = solveMacroSets(ids, pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked });
  else { // 순차: MA1 을 최적으로 푼 뒤 그 문항을 막고 MA2 를 푼다(세트 간 겹침 0 보장)
    const out: MacroResult[] = []; let res = { status: "optimal", obj: 0, nodes: 0, x: [0] } as unknown as ReturnType<typeof solveMacroSets>["res"]; const bl = new Set(blocked); const blArch = new Set<string>(); const blSig = new Set<string>();
    for (const id of ids) {
      const one = solveMacroSets([id], pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked: bl, blockedArchetypes: blArch, blockedSigs: blSig });
      out.push(...one.out); res = { ...one.res, obj: (res.obj ?? 0) + one.res.obj, nodes: (res.nodes ?? 0) + one.res.nodes, status: one.res.status } as typeof res;
      for (const it of [...one.out[0].singles, ...one.out[0].frq]) { bl.add(it.key); if (it.sig) blSig.add(it.sig); }
      for (const a of [...one.out[0].singles.map((c) => c.archetype), ...one.out[0].virtual.map((v) => v.archetype)]) if (ONE_EXAM_ONLY.has(a)) blArch.add(a);
      for (const c of one.out[0].frq) blArch.add(c.archetype); // FRQ 유형은 시험마다 다르게(같은 상황의 숫자만 바꾼 문항이 두 시험에 나오지 않게)
    }
    m = { res, out };
  }
  const results = m.out;
  const bad = m.res.x.length ? verifyMacroAssignment(results) : ["해 없음"];
  const cnt = (f: (c: MacroItem) => boolean) => pool.filter(f).length;
  console.log(`# macro-assign sets=${ids.join(",")} 재고 단독 ${cnt((c) => c.kind === "mc")} FRQ ${cnt((c) => c.kind === "frq")}`);
  console.log(`status=${m.res.status} 목적값(가상×1000 + 단원 이탈)=${m.res.obj} 노드 ${m.res.nodes} 가상 문항=${results.reduce((a, r) => a + r.virtual.length + r.frqVirtual.length, 0)}`);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of results) {
    const u: Record<string, number> = {}; for (const it of buildMacroOrder(r)) u[it.unit ?? "?"] = (u[it.unit ?? "?"] ?? 0) + 1;
    console.log(`- ${r.id}: 단독 ${r.singles.length}+가상 ${r.virtual.length}, FRQ ${r.frq.length}+가상 ${r.frqVirtual.length}, 단원 ${JSON.stringify(u)}`);
    const ex = r.singles.reduce((a, c) => a + (c.exam ?? 0), 0); console.log(`    MC exam_prep ${ex}/${MACRO_MC_COUNT}`);
    const sk = categorySummary(r); console.log(`    범주 ${JSON.stringify(sk.category)} 수치 분석 ${sk.numeric} 스킬 코드 ${JSON.stringify(sk.skills)}`);
    const fr = [...r.frq.map((c) => c.frqType), ...r.frqVirtual.map((v) => v.type)]; console.log(`    FRQ ${fr.join(" + ")}`);
    for (const v of r.virtual) console.log(`    가상 MC: 단원 ${v.unit} 스킬 ${v.skill} 원형 ${v.archetype} (${v.topic})`);
    for (const v of r.frqVirtual) console.log(`    가상 FRQ: ${v.type}`);
  }
  const w = arg("--write-report");
  if (w) { writeFileSync(w, JSON.stringify({ sets: results.map(toReportSet) }, null, 1)); console.error(`보고서 기록: ${w}`); }
}
if (process.argv[1]?.endsWith("macro-assign.ts")) main();
