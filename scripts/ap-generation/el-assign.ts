// AP English Language 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). cs-assign.ts 와 같은 방식(정수계획 + 배정기와 별개인 독립 검증기)을 영어 구조에 적용한다.
//   npx tsx scripts/ap-generation/el-assign.ts --sets EL1[,EL2] [--time-ms 120000] [--write-report data/ap/stock/exact-assign-el-el1-el2.json] [--files el-p1a-items,...] [--no-screen] [--highs]
// 조건(docs/ap/englang-facts.md, lib/ap-exam/elang-rules.ts): MC 45 = 읽기 23–25(스킬 1·3·5·7) + 글쓰기 20–22(스킬 2·4·6·8), 8 스킬 범주 범위(RS-R 4–7 / RS-W 4–7 / CE-R 5–8 / CE-W 4–7 / RO-R 5–8 / RO-W 4–7 / S-R 4–7 / S-W 4–7: 공식 % 의 하한 내림·상한 올림, 차단 조건),
//   지문 묶음 3–6문항·읽기 4–6묶음·글쓰기 4–6묶음·읽기 먼저, FRQ 3 = q1 종합 / q2 수사 분석 / q3 논증 각 1. 시험 사이 같은 문항 0, 문항군(look-alike 포함)은 시험당 1 이고 두 시험을 합쳐도 1 번(지문·주제 재사용 방지).
// 가상 칸(재고에 없는 칸)은 만들지 않는다: 재고만으로 불가능하면 해 없음(infeasible)과 부족 요약을 보고한다.
import { writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { ELANG_OFFICIAL_READING_SETS, ELANG_OFFICIAL_WRITING_SETS, ELANG_CATEGORIES, ELANG_FRQ_COUNT, ELANG_FRQ_TYPES, ELANG_FULL_TARGET, ELANG_MC_COUNT, ELANG_READING_RANGE, ELANG_SET_COUNT, ELANG_SET_SIZE, ELANG_WRITING_RANGE, elangCategoryBounds, elangSectionOf, verifyElangFullComposition, type ElangSetItem } from "../../lib/ap-exam/elang-rules";
import { loadElPool, type ElItem } from "./el-pool";
import { solveMipHighs } from "./ilp-highs";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export type ElResult = { id: string; sets: ElItem[]; frq: ElItem[] };

/** 공식 5묶음 구성(읽기 11–14, 글쓰기 7–9 ×2 + 4–6)에서 후보 묶음 크기 범주. */
export const officialClass = (c: ElItem): "r" | "wl" | "ws" | null => c.section === "reading" ? (c.members.length >= ELANG_OFFICIAL_READING_SETS.size.min && c.members.length <= ELANG_OFFICIAL_READING_SETS.size.max ? "r" : null) : c.section === "writing" ? (c.members.length >= ELANG_OFFICIAL_WRITING_SETS.sizes[0].min && c.members.length <= ELANG_OFFICIAL_WRITING_SETS.sizes[0].max ? "wl" : c.members.length >= ELANG_OFFICIAL_WRITING_SETS.sizes[2].min && c.members.length <= ELANG_OFFICIAL_WRITING_SETS.sizes[2].max ? "ws" : null) : null;
const usableOf = (items: ElItem[], blocked: Set<string>, official = false) => items.filter((c) => !blocked.has(c.key) && (c.kind === "frq" ? (ELANG_FRQ_TYPES as readonly string[]).includes(c.frqType) : official ? officialClass(c) !== null : c.section !== null && c.members.length >= ELANG_SET_SIZE.min && c.members.length <= ELANG_SET_SIZE.max));

export function solveElSets(ids: string[], items: ElItem[], o: { timeMs: number; log?: (s: string) => void; blocked?: Set<string>; highs?: boolean; official?: boolean; frqPins?: Record<string, string[]>; mcPins?: Record<string, string[]> }) {
  const usable = usableOf(items, o.blocked ?? new Set(), o.official); const mc = usable.filter((c) => c.kind === "mc"), frqs = usable.filter((c) => c.kind === "frq");
  let n = 0; const xv = new Map<string, number>(); usable.forEach((c, i) => ids.forEach((_, s) => xv.set(`${i}|${s}`, n++)));
  const idx = new Map(usable.map((c, i) => [c, i] as const)); const x = (c: ElItem, s: number) => xv.get(`${idx.get(c)}|${s}`)!;
  const dv = new Map<string, number>(); ids.forEach((_, s) => ELANG_CATEGORIES.forEach((k) => dv.set(`${s}|${k}`, n++)));
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = []; const bounds = elangCategoryBounds();
  for (const j of dv.values()) obj[j] = 1;
  mc.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += (1 - c.conf) * 2 * c.members.length; })); // 키 신뢰도가 낮은 묶음을 약하게 피한다
  usable.forEach((c) => cons.push({ coef: ids.map((_, s) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 })); // 같은 후보는 시험 하나에만
  const fam = new Map<string, [number, number][]>(); for (const c of [...mc, ...frqs]) for (let s = 0; s < ids.length; s++) (fam.get(`${c.kind}|${c.fam}`) ?? fam.set(`${c.kind}|${c.fam}`, []).get(`${c.kind}|${c.fam}`)!).push([x(c, s), 1]);
  for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 }); // 문항군은 두 시험을 합쳐 한 번
  ids.forEach((_, s) => {
    const count = (f: (c: ElItem) => number): [number, number][] => mc.map((c) => [x(c, s), f(c)] as [number, number]).filter(([, v]) => v > 0);
    const total = count((c) => c.members.length); cons.push({ coef: total, sense: "=", rhs: ELANG_MC_COUNT });
    const rd = count((c) => (c.section === "reading" ? c.members.length : 0)), wr = count((c) => (c.section === "writing" ? c.members.length : 0));
    cons.push({ coef: rd, sense: ">=", rhs: ELANG_READING_RANGE.min }); cons.push({ coef: rd, sense: "<=", rhs: ELANG_READING_RANGE.max });
    cons.push({ coef: wr, sense: ">=", rhs: ELANG_WRITING_RANGE.min }); cons.push({ coef: wr, sense: "<=", rhs: ELANG_WRITING_RANGE.max });
    if (o.official) { for (const [cl, n] of [["r", ELANG_OFFICIAL_READING_SETS.count], ["wl", 2], ["ws", 1]] as const) cons.push({ coef: count((c) => (officialClass(c) === cl ? 1 : 0)), sense: "=", rhs: n }); }
    else for (const sec of ["reading", "writing"] as const) { const sc = count((c) => (c.section === sec ? 1 : 0)); cons.push({ coef: sc, sense: ">=", rhs: ELANG_SET_COUNT.min }); cons.push({ coef: sc, sense: "<=", rhs: ELANG_SET_COUNT.max }); }
    for (const k of o.mcPins?.[ids[s]] ?? []) { const c = mc.find((f) => f.key === k); if (c) cons.push({ coef: [[x(c, s), 1]], sense: "=", rhs: 1 }); }
    for (const k of o.frqPins?.[ids[s]] ?? []) { const c = frqs.find((f) => f.key === k); if (c) cons.push({ coef: [[x(c, s), 1]], sense: "=", rhs: 1 }); }
    for (const k of ELANG_CATEGORIES) {
      const co = count((c) => c.members.filter((m) => m.cat === k).length); const b = bounds[k]; const t = ELANG_FULL_TARGET.categories[k]; const d = dv.get(`${s}|${k}`)!;
      cons.push({ coef: co, sense: ">=", rhs: b.min }); cons.push({ coef: co, sense: "<=", rhs: b.max });
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    for (const t of ELANG_FRQ_TYPES) cons.push({ coef: frqs.filter((c) => c.frqType === t).map((c) => [x(c, s), 1] as [number, number]), sense: "=", rhs: 1 });
  });
  const binary = new Array<boolean>(n).fill(false); for (const j of xv.values()) binary[j] = true;
  const prob = { n, obj, cons, integer: new Array(n).fill(true), binary };
  const r = o.highs ? solveMipHighs(prob, { timeMs: o.timeMs, log: o.log }) : solveMip(prob, { timeMs: o.timeMs, log: o.log });
  const out: ElResult[] = ids.map((id) => ({ id, sets: [], frq: [] }));
  if (r.x.length) ids.forEach((_, s) => { for (const c of usable) if (r.x[x(c, s)] > 0.5) (c.kind === "frq" ? out[s].frq : out[s].sets).push(c); });
  return { res: r, out };
}

/** 한 시험의 MC 위치 목록: 읽기 묶음 먼저(묶음 키 순), 글쓰기 묶음이 뒤. 묶음은 연속 칸. */
export function buildElOrder(r: ElResult): ElangSetItem[] {
  const rank = (c: ElItem) => (c.section === "reading" ? 0 : 1);
  const blocks = [...r.sets].sort((a, b) => rank(a) - rank(b) || (a.section === "writing" ? b.members.length - a.members.length : 0) || a.key.localeCompare(b.key)); const out: ElangSetItem[] = []; let pos = 1; // 글쓰기는 큰 묶음(7–9) 먼저, 마지막이 4–6
  for (const b of blocks) for (const m of b.members) out.push({ kind: "mc", skill: m.skill, candidateKey: b.key, position: pos++ });
  return out;
}

/** 독립 검증기(배정기와 별개): 공식 구조·8범주·묶음 크기/수/순서·FRQ 유형·문항군·시험 간 중복·차단 키. 위반 목록(빈 배열 = 통과). */
export function verifyElAssignment(res: ElResult[], blocked: Set<string> = new Set()): string[] {
  const bad: string[] = []; const used = new Map<string, string>(); const fams = new Map<string, string>();
  for (const r of res) {
    const mc = buildElOrder(r); const frqItems: ElangSetItem[] = r.frq.map((c, i) => ({ kind: "frq" as const, skill: null, candidateKey: c.key, position: i + 1 }));
    for (const v of verifyElangFullComposition([...mc, ...frqItems])) bad.push(`${r.id}: ${v}`);
    const types = r.frq.map((c) => c.frqType); if (types.length !== ELANG_FRQ_COUNT || !ELANG_FRQ_TYPES.every((t) => types.includes(t))) bad.push(`${r.id}: FRQ 유형이 q1/q2/q3 각 1개가 아님(${types.join(",")})`);
    for (const c of [...r.sets, ...r.frq]) {
      if (blocked.has(c.key)) bad.push(`${r.id}: 차단된 키 ${c.key}`);
      if (used.has(c.key)) bad.push(`${r.id}: ${c.key} 는 ${used.get(c.key)} 와 겹침`); used.set(c.key, r.id);
      const fk = `${c.kind}|${c.fam}`; if (fams.has(fk)) bad.push(`${r.id}: 문항군 ${c.fam} 가 ${fams.get(fk)} 와 겹침`); fams.set(fk, r.id);
      if (c.kind === "mc" && elangSectionOf(c.members[0]?.skill) !== c.section) bad.push(`${r.id}: ${c.key} 읽기/글쓰기 구분 불일치`);
    }
  }
  return bad;
}

export function toReportSet(r: ElResult) {
  const order = buildElOrder(r); const seen = new Set<string>(); const mcKeys: string[] = [];
  for (const it of order) if (it.candidateKey && !seen.has(it.candidateKey)) { seen.add(it.candidateKey); mcKeys.push(it.candidateKey); }
  const frqKeys = [...ELANG_FRQ_TYPES].map((t) => r.frq.find((c) => c.frqType === t)?.key).filter((k): k is string => !!k);
  return { id: r.id, mcA: mcKeys, mcB: [] as string[], virtual: [], virtualSets: [], virtualSetArchetypes: [], frqA: frqKeys, frqB: [] as string[], frqVirtual: [], subject: "ap_english_language" };
}
export function categorySummary(r: ElResult) { const c: Record<string, number> = {}; for (const s of r.sets) for (const m of s.members) c[m.cat] = (c[m.cat] ?? 0) + 1; return c; }

function main() {
  const official = has("--official"); const mcPins = arg("--mc-pins") ? (JSON.parse(arg("--mc-pins")) as Record<string, string[]>) : undefined; const pins = arg("--frq-pins") ? (JSON.parse(arg("--frq-pins")) as Record<string, string[]>) : undefined;
  const ids = arg("--sets", "EL1,EL2").split(",").filter(Boolean); const TIME = Number(arg("--time-ms", "120000")); const files = arg("--files") ? arg("--files").split(",") : undefined;
  const { pool } = loadElPool({ requireScreen: !has("--no-screen"), files }); const log = (s: string) => console.error(s);
  const m = solveElSets(ids, pool, { timeMs: TIME, log, highs: has("--highs"), official, frqPins: pins, mcPins });
  const bad = m.res.x.length ? verifyElAssignment(m.out) : ["해 없음(재고만으로 공식 구조를 채울 수 없음)"];
  const cnt = (f: (c: ElItem) => boolean) => pool.filter(f).length;
  console.log(`# el-assign sets=${ids.join(",")} 재고 읽기 묶음 ${cnt((c) => c.section === "reading")} 글쓰기 묶음 ${cnt((c) => c.section === "writing")} (문항 ${pool.filter((c) => c.kind === "mc").reduce((a, c) => a + c.members.length, 0)}) FRQ ${cnt((c) => c.kind === "frq")} (${ELANG_FRQ_TYPES.map((t) => `${t}:${cnt((c) => c.frqType === t)}`).join(" ")})`);
  console.log(`status=${m.res.status} 목적값(범주 목표 이탈 + 낮은 키 신뢰도)=${m.res.obj}`);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of m.out) {
    const mcq = r.sets.reduce((a, c) => a + c.members.length, 0), ex = r.sets.reduce((a, c) => a + (c.exam ?? 0), 0);
    console.log(`- ${r.id}: 읽기 묶음 ${r.sets.filter((c) => c.section === "reading").length} 글쓰기 묶음 ${r.sets.filter((c) => c.section === "writing").length}, MC ${mcq}, FRQ ${r.frq.length}, 범주 ${JSON.stringify(categorySummary(r))}, exam_prep ${ex}/${mcq}`);
  }
  const w = arg("--write-report"); if (w && !bad.length) { writeFileSync(w, JSON.stringify({ sets: m.out.map(toReportSet) }, null, 1)); console.error(`보고서 기록: ${w}`); }
  if (bad.length) process.exitCode = 1;
}
if (process.argv[1]?.endsWith("el-assign.ts")) main();
