// AP English Literature 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). el-assign.ts 와 같은 방식(정수계획 + 배정기와 별개인 독립 검증기)을 문학 구조에 적용한다.
//   npx tsx scripts/ap-generation/lt-assign.ts --sets LT1[,LT2] [--time-ms 120000] [--write-report data/ap/stock/exact-assign-englit-lt1-lt2.json] [--files lt-p1a-items,...] [--no-screen] [--highs]
// 조건(docs/ap/englit-facts.md, lib/ap-exam/englit-rules.ts): MC 55 = 5묶음(각 8–13문항, 한 장르), 장르 문항 수(단편 23–27 / 시 19–25 / 장편·희곡 8–10), 7범주 범위(차단 조건), 산문 ≥2·시 ≥2 묶음, FRQ 3 = q1 시 / q2 산문 / q3 논증 각 1.
// 시험 사이 같은 문항 0, 문항군(look-alike 포함)은 두 시험을 합쳐 한 번. 가상 칸(재고에 없는 칸)은 만들지 않는다: 재고만으로 불가능하면 해 없음(infeasible)과 부족 요약을 보고한다.
import { writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { ENGLIT_CATEGORIES, ENGLIT_FRQ_COUNT, ENGLIT_FRQ_TYPES, ENGLIT_FULL_TARGET, ENGLIT_GROUPS, ENGLIT_MC_COUNT, ENGLIT_SET_COUNT, ENGLIT_SET_SIZE, englitCategoryBounds, englitGroupBounds, verifyEnglitFullComposition, type EnglitSetItem } from "../../lib/ap-exam/englit-rules";
import { loadLtPool, type LtItem } from "./lt-pool";
import { solveMipHighs } from "./ilp-highs";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export type LtResult = { id: string; sets: LtItem[]; frq: LtItem[] };
const usableOf = (items: LtItem[], blocked: Set<string>) => items.filter((c) => !blocked.has(c.key) && (c.kind === "frq" ? (ENGLIT_FRQ_TYPES as readonly string[]).includes(c.frqType) : c.group !== null && c.members.length >= ENGLIT_SET_SIZE.min && c.members.length <= ENGLIT_SET_SIZE.max));

export function solveLtSets(ids: string[], items: LtItem[], o: { timeMs: number; log?: (s: string) => void; blocked?: Set<string>; highs?: boolean }) {
  const usable = usableOf(items, o.blocked ?? new Set()); const mc = usable.filter((c) => c.kind === "mc"), frqs = usable.filter((c) => c.kind === "frq");
  let n = 0; const xv = new Map<string, number>(); usable.forEach((c, i) => ids.forEach((_, s) => xv.set(`${i}|${s}`, n++)));
  const idx = new Map(usable.map((c, i) => [c, i] as const)); const x = (c: LtItem, s: number) => xv.get(`${idx.get(c)}|${s}`)!;
  const dv = new Map<string, number>(); ids.forEach((_, s) => ENGLIT_CATEGORIES.forEach((k) => dv.set(`${s}|${k}`, n++)));
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = []; const cb = englitCategoryBounds(); const gb = englitGroupBounds();
  for (const j of dv.values()) obj[j] = 1;
  mc.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += (1 - c.conf) * 2 * c.members.length; })); // 키 신뢰도가 낮은 묶음을 약하게 피한다
  usable.forEach((c) => cons.push({ coef: ids.map((_, s) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 })); // 같은 후보는 시험 하나에만
  const fam = new Map<string, [number, number][]>(); for (const c of [...mc, ...frqs]) for (let s = 0; s < ids.length; s++) (fam.get(`${c.kind}|${c.fam}`) ?? fam.set(`${c.kind}|${c.fam}`, []).get(`${c.kind}|${c.fam}`)!).push([x(c, s), 1]);
  for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 }); // 문항군은 두 시험을 합쳐 한 번
  ids.forEach((_, s) => {
    const count = (f: (c: LtItem) => number): [number, number][] => mc.map((c) => [x(c, s), f(c)] as [number, number]).filter(([, v]) => v > 0);
    cons.push({ coef: count((c) => c.members.length), sense: "=", rhs: ENGLIT_MC_COUNT }); cons.push({ coef: count(() => 1), sense: "=", rhs: ENGLIT_SET_COUNT });
    for (const g of ENGLIT_GROUPS) { const co = count((c) => (c.group === g ? c.members.length : 0)); cons.push({ coef: co, sense: ">=", rhs: gb[g].min }); cons.push({ coef: co, sense: "<=", rhs: gb[g].max }); }
    cons.push({ coef: count((c) => (c.group === "poetry" ? 1 : 0)), sense: ">=", rhs: 2 }); cons.push({ coef: count((c) => (c.group !== "poetry" ? 1 : 0)), sense: ">=", rhs: 2 });
    for (const k of ENGLIT_CATEGORIES) {
      const co = count((c) => c.members.filter((m) => m.cat === k).length); const b = cb[k]; const t = ENGLIT_FULL_TARGET.categories[k]; const d = dv.get(`${s}|${k}`)!;
      cons.push({ coef: co, sense: ">=", rhs: b.min }); cons.push({ coef: co, sense: "<=", rhs: b.max });
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    for (const t of ENGLIT_FRQ_TYPES) cons.push({ coef: frqs.filter((c) => c.frqType === t).map((c) => [x(c, s), 1] as [number, number]), sense: "=", rhs: 1 });
  });
  const binary = new Array<boolean>(n).fill(false); for (const j of xv.values()) binary[j] = true;
  const prob = { n, obj, cons, integer: new Array(n).fill(true), binary };
  const r = o.highs ? solveMipHighs(prob, { timeMs: o.timeMs, log: o.log }) : solveMip(prob, { timeMs: o.timeMs, log: o.log });
  const out: LtResult[] = ids.map((id) => ({ id, sets: [], frq: [] }));
  if (r.x.length) ids.forEach((_, s) => { for (const c of usable) if (r.x[x(c, s)] > 0.5) (c.kind === "frq" ? out[s].frq : out[s].sets).push(c); });
  return { res: r, out };
}
/** 한 시험의 MC 위치 목록: 장르 순(단편 → 시 → 장편·희곡), 같은 장르는 키 순. 묶음은 연속 칸. */
export function buildLtOrder(r: LtResult): EnglitSetItem[] {
  const rank = (c: LtItem) => ENGLIT_GROUPS.indexOf(c.group!); const blocks = [...r.sets].sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key)); const out: EnglitSetItem[] = []; let pos = 1;
  for (const b of blocks) for (const m of b.members) out.push({ kind: "mc", skill: m.skill, group: b.group, candidateKey: b.key, position: pos++ });
  return out;
}
/** 독립 검증기(배정기와 별개): 공식 구조·7범주·묶음 크기/수·장르·FRQ 유형·문항군·시험 간 중복·차단 키. 위반 목록(빈 배열 = 통과). */
export function verifyLtAssignment(res: LtResult[], blocked: Set<string> = new Set()): string[] {
  const bad: string[] = []; const used = new Map<string, string>(); const fams = new Map<string, string>();
  for (const r of res) {
    const mc = buildLtOrder(r); const frqItems: EnglitSetItem[] = r.frq.map((c, i) => ({ kind: "frq" as const, skill: null, group: null, candidateKey: c.key, position: i + 1 }));
    for (const v of verifyEnglitFullComposition([...mc, ...frqItems])) bad.push(`${r.id}: ${v}`);
    const types = r.frq.map((c) => c.frqType); if (types.length !== ENGLIT_FRQ_COUNT || !ENGLIT_FRQ_TYPES.every((t) => types.includes(t))) bad.push(`${r.id}: FRQ 유형이 q1/q2/q3 각 1개가 아님(${types.join(",")})`);
    for (const c of [...r.sets, ...r.frq]) {
      if (blocked.has(c.key)) bad.push(`${r.id}: 차단된 키 ${c.key}`); if (used.has(c.key)) bad.push(`${r.id}: ${c.key} 는 ${used.get(c.key)} 와 겹침`); used.set(c.key, r.id);
      const fk = `${c.kind}|${c.fam}`; if (fams.has(fk)) bad.push(`${r.id}: 문항군 ${c.fam} 가 ${fams.get(fk)} 와 겹침`); fams.set(fk, r.id);
    }
  }
  return bad;
}
export function toReportSet(r: LtResult) {
  const order = buildLtOrder(r); const seen = new Set<string>(); const mcKeys: string[] = []; for (const it of order) if (it.candidateKey && !seen.has(it.candidateKey)) { seen.add(it.candidateKey); mcKeys.push(it.candidateKey); }
  const frqKeys = [...ENGLIT_FRQ_TYPES].map((t) => r.frq.find((c) => c.frqType === t)?.key).filter((k): k is string => !!k);
  return { id: r.id, mcA: mcKeys, mcB: [] as string[], virtual: [], virtualSets: [], virtualSetArchetypes: [], frqA: frqKeys, frqB: [] as string[], frqVirtual: [], subject: "ap_english_literature" };
}
export function categorySummary(r: LtResult) { const c: Record<string, number> = {}; for (const s of r.sets) for (const m of s.members) c[m.cat] = (c[m.cat] ?? 0) + 1; return c; }
export function groupSummary(r: LtResult) { const c: Record<string, number> = {}; for (const s of r.sets) c[`${s.group}`] = (c[`${s.group}`] ?? 0) + s.members.length; return c; }

function main() {
  const ids = arg("--sets", "LT1,LT2").split(",").filter(Boolean); const TIME = Number(arg("--time-ms", "120000")); const files = arg("--files") ? arg("--files").split(",") : undefined;
  const { pool } = loadLtPool({ requireScreen: !has("--no-screen"), files }); const log = (s: string) => console.error(s);
  const m = solveLtSets(ids, pool, { timeMs: TIME, log, highs: has("--highs") });
  const bad = m.res.x.length ? verifyLtAssignment(m.out) : ["해 없음(재고만으로 공식 구조를 채울 수 없음)"]; const cnt = (f: (c: LtItem) => boolean) => pool.filter(f).length;
  console.log(`# lt-assign sets=${ids.join(",")} 재고 묶음 단편 ${cnt((c) => c.group === "short")} 시 ${cnt((c) => c.group === "poetry")} 장편·희곡 ${cnt((c) => c.group === "longer")} (문항 ${pool.filter((c) => c.kind === "mc").reduce((a, c) => a + c.members.length, 0)}) FRQ ${cnt((c) => c.kind === "frq")} (${ENGLIT_FRQ_TYPES.map((t) => `${t}:${cnt((c) => c.frqType === t)}`).join(" ")})`);
  console.log(`status=${m.res.status} 목적값(범주 목표 이탈 + 낮은 키 신뢰도)=${m.res.obj}`); console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of m.out) { const mcq = r.sets.reduce((a, c) => a + c.members.length, 0), ex = r.sets.reduce((a, c) => a + (c.exam ?? 0), 0); console.log(`- ${r.id}: 묶음 ${r.sets.length} (${JSON.stringify(groupSummary(r))}), MC ${mcq}, FRQ ${r.frq.length}, 범주 ${JSON.stringify(categorySummary(r))}, exam_prep ${ex}/${mcq}`); }
  const w = arg("--write-report"); if (w && !bad.length) { writeFileSync(w, JSON.stringify({ sets: m.out.map(toReportSet) }, null, 1)); console.error(`보고서 기록: ${w}`); }
  if (bad.length) process.exitCode = 1;
}
if (process.argv[1]?.endsWith("lt-assign.ts")) main();
