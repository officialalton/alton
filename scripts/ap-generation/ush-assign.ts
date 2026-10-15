// AP U.S. History 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). el-assign.ts 와 같은 방식(정수계획 + 배정기와 별개인 독립 검증기).
//   npx tsx scripts/ap-generation/ush-assign.ts --sets US1[,US2] [--time-ms 120000] [--write-report data/ap/stock/exact-assign-ushistory-us1-us2.json] [--files ush-p1a-items,...] [--no-screen] [--highs]
// 조건(lib/ap-exam/ush-rules.ts): MC 55 = 3–4문항 세트 14–18개, 단원(Period) 범위(2–4/3–5/5–10×6/2–4), 자료 유형 최소(paired≥1·quantitative≥1·primary≥5·secondary≥2), 스킬 범주 1–5 각 ≥3·6.x 금지,
//   FRQ 5 = saq1·saq2·saq3(서로 다른 시대)·dbq·leq 각 1. 두 시험 사이 같은 후보 0, 문항군(주제)은 두 시험을 합쳐 1 번. 가상 칸 없음: 재고만으로 불가능하면 해 없음.
import { writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { USH_FRQ_COUNT, USH_FRQ_TEMPLATES, USH_FULL_TARGET, USH_MC_COUNT, USH_SET_COUNT, USH_SET_SIZE, USH_SKILL_CATEGORY_MIN, USH_STIM_MIN, USH_STIM_TYPES, ushUnitBounds, verifyUshFullComposition, type UshSetItem } from "../../lib/ap-exam/ush-rules";
import { loadUshPool, type UshItem } from "./ush-pool";
import { solveMipHighs } from "./ilp-highs";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export type UshResult = { id: string; sets: UshItem[]; frq: UshItem[] };
const usableOf = (items: UshItem[], blocked: Set<string>) => items.filter((c) => !blocked.has(c.key) && (c.kind === "frq" ? (USH_FRQ_TEMPLATES as readonly string[]).includes(c.template) && c.period >= 1 : c.members.length >= USH_SET_SIZE.min && c.members.length <= USH_SET_SIZE.max && c.members.every((m) => /^[1-5]$/.test(m.cat))));
const UNITS = Object.keys(ushUnitBounds());

export function solveUshSets(ids: string[], items: UshItem[], o: { timeMs: number; log?: (s: string) => void; blocked?: Set<string>; highs?: boolean; mcOnly?: boolean }) {
  const usable = usableOf(items, o.blocked ?? new Set()); const mc = usable.filter((c) => c.kind === "mc"), frqs = usable.filter((c) => c.kind === "frq");
  let n = 0; const xv = new Map<string, number>(); usable.forEach((c, i) => ids.forEach((_, s) => xv.set(`${i}|${s}`, n++)));
  const idx = new Map(usable.map((c, i) => [c, i] as const)); const x = (c: UshItem, s: number) => xv.get(`${idx.get(c)}|${s}`)!;
  const dv = new Map<string, number>(); ids.forEach((_, s) => UNITS.forEach((k) => dv.set(`${s}|${k}`, n++)));
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = []; const bounds = ushUnitBounds();
  for (const j of dv.values()) obj[j] = 1;
  usable.forEach((c) => cons.push({ coef: ids.map((_, s) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 }));
  const fam = new Map<string, [number, number][]>(); for (const c of usable) for (let s = 0; s < ids.length; s++) (fam.get(`${c.kind}|${c.fam}`) ?? fam.set(`${c.kind}|${c.fam}`, []).get(`${c.kind}|${c.fam}`)!).push([x(c, s), 1]);
  for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
  ids.forEach((_, s) => {
    const count = (f: (c: UshItem) => number): [number, number][] => mc.map((c) => [x(c, s), f(c)] as [number, number]).filter(([, v]) => v > 0);
    cons.push({ coef: count((c) => c.members.length), sense: "=", rhs: USH_MC_COUNT });
    const sc = count(() => 1); cons.push({ coef: sc, sense: ">=", rhs: USH_SET_COUNT.min }); cons.push({ coef: sc, sense: "<=", rhs: USH_SET_COUNT.max });
    for (const k of UNITS) {
      const co = count((c) => c.members.filter((m) => m.unit === k).length); const b = bounds[k]; const t = USH_FULL_TARGET.units[k]; const d = dv.get(`${s}|${k}`)!;
      cons.push({ coef: co, sense: ">=", rhs: b.min }); cons.push({ coef: co, sense: "<=", rhs: b.max });
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    for (const cat of ["1", "2", "3", "4", "5"]) cons.push({ coef: count((c) => c.members.filter((m) => m.cat === cat).length), sense: ">=", rhs: USH_SKILL_CATEGORY_MIN });
    for (const t of USH_STIM_TYPES) cons.push({ coef: count((c) => (c.stim === t ? 1 : 0)), sense: ">=", rhs: USH_STIM_MIN[t] });
    if (!o.mcOnly) for (const t of USH_FRQ_TEMPLATES) cons.push({ coef: frqs.filter((c) => c.template === t).map((c) => [x(c, s), 1] as [number, number]), sense: "=", rhs: 1 });
    if (!o.mcOnly) for (let p = 1; p <= 9; p++) cons.push({ coef: frqs.filter((c) => /^saq/.test(c.template) && c.period === p).map((c) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 }); // SAQ 3개는 서로 다른 시대
  });
  const binary = new Array<boolean>(n).fill(false); for (const j of xv.values()) binary[j] = true;
  const prob = { n, obj, cons, integer: new Array(n).fill(true), binary };
  const r = o.highs ? solveMipHighs(prob, { timeMs: o.timeMs, log: o.log }) : solveMip(prob, { timeMs: o.timeMs, log: o.log });
  const out: UshResult[] = ids.map((id) => ({ id, sets: [], frq: [] }));
  if (r.x.length) ids.forEach((_, s) => { for (const c of usable) if (r.x[x(c, s)] > 0.5) (c.kind === "frq" ? out[s].frq : out[s].sets).push(c); });
  return { res: r, out };
}
/** 한 시험의 MC 위치 목록: 시대(단원) 순으로 세트를 놓는다. 세트는 연속 칸. */
export function buildUshOrder(r: UshResult): (UshSetItem & { stim: string })[] {
  const blocks = [...r.sets].sort((a, b) => Number(a.members[0].unit) - Number(b.members[0].unit) || a.key.localeCompare(b.key)); const out: (UshSetItem & { stim: string })[] = []; let pos = 1;
  for (const b of blocks) for (const m of b.members) out.push({ kind: "mc", unit: m.unit, dbUnit: b.keyUnit, skill: m.skill, candidateKey: b.key, position: pos++, stim: b.stim });
  return out;
}
export const frqOrder = (r: UshResult) => USH_FRQ_TEMPLATES.map((t) => r.frq.find((c) => c.template === t)).filter((c): c is UshItem => !!c);
export function verifyUshAssignment(res: UshResult[], blocked: Set<string> = new Set()): string[] {
  const bad: string[] = []; const used = new Map<string, string>(); const fams = new Map<string, string>();
  for (const r of res) {
    const frqItems: UshSetItem[] = frqOrder(r).map((c, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: c.key, position: i + 1, template: c.template, period: c.period }));
    for (const v of verifyUshFullComposition([...buildUshOrder(r), ...frqItems])) bad.push(`${r.id}: ${v}`);
    for (const c of [...r.sets, ...r.frq]) {
      if (blocked.has(c.key)) bad.push(`${r.id}: 차단된 키 ${c.key}`);
      if (used.has(c.key)) bad.push(`${r.id}: ${c.key} 는 ${used.get(c.key)} 와 겹침`); used.set(c.key, r.id);
      const fk = `${c.kind}|${c.fam}`; if (fams.has(fk)) bad.push(`${r.id}: 문항군 ${c.fam} 가 ${fams.get(fk)} 와 겹침`); fams.set(fk, r.id);
    }
  }
  return bad;
}
export function toReportSet(r: UshResult) {
  const order = buildUshOrder(r); const seen = new Set<string>(); const mcKeys: string[] = [];
  for (const it of order) if (it.candidateKey && !seen.has(it.candidateKey)) { seen.add(it.candidateKey); mcKeys.push(it.candidateKey); }
  return { id: r.id, mcA: mcKeys, mcB: [] as string[], virtual: [], virtualSets: [], virtualSetArchetypes: [], frqA: frqOrder(r).map((c) => c.key), frqB: [] as string[], frqVirtual: [], subject: "ap_us_history" };
}
export function unitSummary(r: UshResult) { const c: Record<string, number> = {}; for (const s of r.sets) for (const m of s.members) c[m.unit] = (c[m.unit] ?? 0) + 1; return c; }
function main() {
  const ids = arg("--sets", "US1,US2").split(",").filter(Boolean); const TIME = Number(arg("--time-ms", "120000")); const files = arg("--files") ? arg("--files").split(",") : undefined;
  const { pool } = loadUshPool({ requireScreen: !has("--no-screen"), files }); const log = (s: string) => console.error(s);
  const m = solveUshSets(ids, pool, { timeMs: TIME, log, highs: has("--highs"), mcOnly: has("--mc-only") });
  const bad = m.res.x.length ? verifyUshAssignment(m.out).filter((v) => !has("--mc-only") || !/frq/.test(v)) : ["해 없음(재고만으로 공식 구조를 채울 수 없음)"];
  const cnt = (f: (c: UshItem) => boolean) => pool.filter(f).length;
  console.log(`# ush-assign sets=${ids.join(",")} 재고 MC 세트 ${cnt((c) => c.kind === "mc")} (문항 ${pool.filter((c) => c.kind === "mc").reduce((a, c) => a + c.members.length, 0)}) FRQ ${cnt((c) => c.kind === "frq")} (${USH_FRQ_TEMPLATES.map((t) => `${t}:${cnt((c) => c.template === t)}`).join(" ")})`);
  console.log(`status=${m.res.status} 목적값(단원 목표 이탈)=${m.res.obj}`);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of m.out) { const mcq = r.sets.reduce((a, c) => a + c.members.length, 0), ex = r.sets.reduce((a, c) => a + (c.exam ?? 0), 0); console.log(`- ${r.id}: 세트 ${r.sets.length}, MC ${mcq}, FRQ ${r.frq.length}, 단원 ${JSON.stringify(unitSummary(r))}, exam_prep ${ex}/${mcq}, SAQ 시대 ${frqOrder(r).filter((c) => /^saq/.test(c.template)).map((c) => c.period).join("/")}`); }
  const w = arg("--write-report"); if (w && !bad.length) { writeFileSync(w, JSON.stringify({ sets: m.out.map(toReportSet) }, null, 1)); console.error(`보고서 기록: ${w}`); }
  if (bad.length) process.exitCode = 1;
}
if (process.argv[1]?.endsWith("ush-assign.ts")) main();
void USH_FRQ_COUNT;
