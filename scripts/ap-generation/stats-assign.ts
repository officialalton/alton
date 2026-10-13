// AP Statistics 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). exact-assign.ts 와 같은 방식(정수계획 + 독립 검증기)을 통계 구조에 적용한다.
//   npx tsx scripts/ap-generation/stats-assign.ts --sets ST1[,ST2,ST3] [--time-ms 120000] [--write-report <경로 .json>] [--files stats-s1-items,stats-s2a-items] [--no-screen] [--prefer-exam-prep]
// 조건(공식 구조, docs/ap/statistics-facts.md): MC 42 = 단독 36 + 3문항 공유 세트 2(단원 2 확률·이항 / 단원 5 회귀), 단원 비중 범위 [9–12]/[7–10]/[7–10]/[5–8]/[5–8] 와 목표 10/9/9/7/7,
//   스킬(Practice) 범위 [3–4]/[9–12]/[11–14]/[11–14] 와 목표 4/10/14/14, FRQ 4(유형 q1~q4 각 1개), 세트 간 같은 문항 0, 세트 안 문항군 1. 재고에 없는 칸은 가상 문항으로 세어 부족분을 정확히 보고한다.
import { writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { STATS_FULL_TARGET, STATS_MC_COUNT, STATS_SETS, statsSkillBounds, statsUnitBounds, verifyStatsFullComposition, type StatsSetItem } from "../../lib/ap-exam/full-set-rules";
import { STATS_FRQ_TEMPLATES } from "../../lib/ap-generation/stats-frq-checks";
import { loadStatsPool, type StatsItem } from "./stats-pool";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export const STATS_SET_POSITIONS = [13, 31] as const; // 공유 세트 시작 위치(1부터): 단원 2 세트, 단원 5 세트 순
export type StatsVirtual = { set: string; part: "A"; unit: number; skill: number; graph: false; fromSet?: boolean };
export type StatsResult = { id: string; singles: StatsItem[]; sets: StatsItem[]; frq: StatsItem[]; virtual: StatsVirtual[]; virtualSets: number[]; frqVirtual: { set: string; part: "A"; native: false; type: string }[] };
const SET_UNITS = STATS_SETS.map((x) => Number(x.unit)); const UNITS = [1, 2, 3, 4, 5]; const SKILLS = [1, 2, 3, 4];

export function solveStatsSets(ids: string[], items: StatsItem[], o: { timeMs: number; log?: (s: string) => void; blocked?: Set<string>; /** exam_prep MC 문항을 더 많이 쓰는 해를 선호(동점 처리: 가상 1000 과 목표 이탈 1 보다 항상 작은 가중 0.01, 목적값은 음수가 될 수 있다). 기본 꺼짐 — 기존 배정·고정 테스트 불변. */ preferExamPrep?: boolean }) {
  const blocked = o.blocked ?? new Set<string>();
  const usable = items.filter((c) => !blocked.has(c.key) && (c.kind === "frq" ? (STATS_FRQ_TEMPLATES as readonly string[]).includes(c.frqType) : c.shared ? SET_UNITS.includes(c.members[0]?.unit) && new Set(c.members.map((m) => m.unit)).size === 1 && c.members.length === 3 : c.members.length === 1));
  const mcSingles = usable.filter((c) => c.kind === "mc" && !c.shared), mcSets = usable.filter((c) => c.kind === "mc" && c.shared), frqs = usable.filter((c) => c.kind === "frq");
  let n = 0; const V = (): number => n++;
  const xv = new Map<string, number>(); // `${i}|${s}`
  usable.forEach((c, i) => ids.forEach((_, s) => xv.set(`${i}|${s}`, V())));
  const x = (c: StatsItem, s: number) => xv.get(`${usable.indexOf(c)}|${s}`)!;
  const vs = new Map<string, number>(), vsm = new Map<string, number>(), vset = new Map<string, number>(), vf = new Map<string, number>(), du = new Map<string, number>(), dk = new Map<string, number>();
  ids.forEach((_, s) => {
    for (const u of UNITS) for (const k of SKILLS) { vs.set(`${s}|${u}|${k}`, V()); vsm.set(`${s}|${u}|${k}`, V()); }
    for (const u of SET_UNITS) vset.set(`${s}|${u}`, V());
    for (const t of STATS_FRQ_TEMPLATES) vf.set(`${s}|${t}`, V());
    for (const u of UNITS) du.set(`${s}|${u}`, V()); for (const k of SKILLS) dk.set(`${s}|${k}`, V());
  });
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = [];
  for (const j of [...vs.values(), ...vsm.values(), ...vf.values()]) obj[j] = 1000;
  for (const j of du.values()) obj[j] = 1; for (const j of dk.values()) obj[j] = 1;
  if (o.preferExamPrep) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] = -0.01 * (c.exam ?? 0); }));
  const uB = statsUnitBounds(), kB = statsSkillBounds();
  usable.forEach((c) => cons.push({ coef: ids.map((_, s) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 }));
  ids.forEach((_, s) => {
    cons.push({ coef: [...mcSingles.map((c) => [x(c, s), 1] as [number, number]), ...UNITS.flatMap((u) => SKILLS.map((k) => [vs.get(`${s}|${u}|${k}`)!, 1] as [number, number]))], sense: "=", rhs: STATS_MC_COUNT - 3 * STATS_SETS.length });
    for (const u of SET_UNITS) {
      cons.push({ coef: [...mcSets.filter((c) => c.members[0].unit === u).map((c) => [x(c, s), 1] as [number, number]), [vset.get(`${s}|${u}`)!, 1]], sense: "=", rhs: 1 });
      cons.push({ coef: [...SKILLS.map((k) => [vsm.get(`${s}|${u}|${k}`)!, 1] as [number, number]), [vset.get(`${s}|${u}`)!, -3]], sense: "=", rhs: 0 });
    }
    for (const u of UNITS) if (!SET_UNITS.includes(u)) for (const k of SKILLS) cons.push({ coef: [[vsm.get(`${s}|${u}|${k}`)!, 1]], sense: "=", rhs: 0 });
    for (const u of UNITS) {
      const co: [number, number][] = [...mcSingles.filter((c) => c.members[0].unit === u).map((c) => [x(c, s), 1] as [number, number]), ...mcSets.filter((c) => c.members[0].unit === u).map((c) => [x(c, s), 3] as [number, number]), ...SKILLS.flatMap((k) => [[vs.get(`${s}|${u}|${k}`)!, 1], [vsm.get(`${s}|${u}|${k}`)!, 1]] as [number, number][])];
      cons.push({ coef: co, sense: ">=", rhs: uB[String(u)].min }); cons.push({ coef: co, sense: "<=", rhs: uB[String(u)].max });
      const t = STATS_FULL_TARGET.units[String(u)]; const d = du.get(`${s}|${u}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    for (const k of SKILLS) {
      const co: [number, number][] = [...mcSingles.filter((c) => c.members[0].skill === k).map((c) => [x(c, s), 1] as [number, number]), ...mcSets.map((c) => [x(c, s), c.members.filter((m) => m.skill === k).length] as [number, number]).filter(([, v]) => v > 0), ...UNITS.flatMap((u) => [[vs.get(`${s}|${u}|${k}`)!, 1], [vsm.get(`${s}|${u}|${k}`)!, 1]] as [number, number][])];
      cons.push({ coef: co, sense: ">=", rhs: kB[String(k)].min }); cons.push({ coef: co, sense: "<=", rhs: kB[String(k)].max });
      const t = STATS_FULL_TARGET.skills[String(k)]; const d = dk.get(`${s}|${k}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    const fam = new Map<string, [number, number][]>(); for (const c of [...mcSingles, ...mcSets]) (fam.get(c.fam) ?? fam.set(c.fam, []).get(c.fam)!).push([x(c, s), 1]);
    for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    for (const t of STATS_FRQ_TEMPLATES) cons.push({ coef: [...frqs.filter((c) => c.frqType === t).map((c) => [x(c, s), 1] as [number, number]), [vf.get(`${s}|${t}`)!, 1]], sense: "=", rhs: 1 });
    const ffam = new Map<string, [number, number][]>(); for (const c of frqs) (ffam.get(c.fam) ?? ffam.set(c.fam, []).get(c.fam)!).push([x(c, s), 1]);
    for (const co of ffam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
  });
  const binary = new Array<boolean>(n).fill(false); for (const j of xv.values()) binary[j] = true; for (const j of vset.values()) binary[j] = true; for (const j of vf.values()) binary[j] = true;
  const r = solveMip({ n, obj, cons, integer: new Array(n).fill(true), binary }, { timeMs: o.timeMs, log: o.log });
  const out: StatsResult[] = ids.map((id) => ({ id, singles: [], sets: [], frq: [], virtual: [], virtualSets: [], frqVirtual: [] }));
  if (r.x.length) ids.forEach((id, s) => {
    for (const c of usable) if (r.x[x(c, s)] > 0.5) (c.kind === "frq" ? out[s].frq : c.shared ? out[s].sets : out[s].singles).push(c);
    for (const u of UNITS) for (const k of SKILLS) {
      for (let q = 0; q < Math.round(r.x[vs.get(`${s}|${u}|${k}`)!]); q++) out[s].virtual.push({ set: id, part: "A", unit: u, skill: k, graph: false });
      for (let q = 0; q < Math.round(r.x[vsm.get(`${s}|${u}|${k}`)!]); q++) out[s].virtual.push({ set: id, part: "A", unit: u, skill: k, graph: false, fromSet: true });
    }
    for (const u of SET_UNITS) if (r.x[vset.get(`${s}|${u}`)!] > 0.5) out[s].virtualSets.push(u);
    for (const t of STATS_FRQ_TEMPLATES) if (r.x[vf.get(`${s}|${t}`)!] > 0.5) out[s].frqVirtual.push({ set: id, part: "A", native: false, type: t });
  });
  return { res: r, out };
}

/** 한 세트의 MC 위치 목록: 단독은 단원 오름차순, 공유 세트는 STATS_SET_POSITIONS 에서 시작해 연속 3칸(단원 2 세트 → 단원 5 세트). 가상 문항은 candidateKey null. */
export function buildStatsOrder(r: StatsResult): StatsSetItem[] {
  const singles = [...r.singles.map((c) => ({ unit: String(c.members[0].unit), skillCat: String(c.members[0].skill), key: c.key })), ...r.virtual.filter((v) => !v.fromSet).map((v) => ({ unit: String(v.unit), skillCat: String(v.skill), key: null as string | null }))].sort((a, b) => Number(a.unit) - Number(b.unit) || String(a.key).localeCompare(String(b.key)));
  const sets = SET_UNITS.map((u) => ({ u, real: r.sets.find((c) => c.members[0].unit === u) ?? null })).map(({ u, real }) => real ? real.members.map((m, j) => ({ unit: String(u), skillCat: String(m.skill), key: real.key, j })) : r.virtual.filter((v) => v.fromSet && v.unit === u).map((v, j) => ({ unit: String(u), skillCat: String(v.skill), key: `~virtual-set-${u}` as string | null, j })));
  const out: StatsSetItem[] = []; let si = 0; let pos = 1;
  const starts = [...STATS_SET_POSITIONS];
  while (out.length < STATS_MC_COUNT) {
    if (starts.length && pos === starts[0]) { starts.shift(); for (const m of sets.shift() ?? []) out.push({ kind: "mc", unit: m.unit, skillCat: m.skillCat, candidateKey: m.key, position: pos++ }); continue; }
    const s = singles[si++]; if (!s) break;
    out.push({ kind: "mc", unit: s.unit, skillCat: s.skillCat, candidateKey: s.key, position: pos++ });
  }
  return out;
}

/** 독립 검증기(배정기와 별개): 공식 구조·단원·스킬·세트·FRQ 유형·문항군·세트 간 중복·차단 키. 위반 목록(빈 배열 = 통과). */
export function verifyStatsAssignment(res: StatsResult[], blocked: Set<string> = new Set()): string[] {
  const bad: string[] = []; const used = new Map<string, string>();
  for (const r of res) {
    const mc = buildStatsOrder(r);
    const frqItems: StatsSetItem[] = [...r.frq.map((c, i) => ({ kind: "frq" as const, unit: null, skillCat: null, candidateKey: c.key, position: i + 1 })), ...r.frqVirtual.map((v, i) => ({ kind: "frq" as const, unit: null, skillCat: null, candidateKey: null, position: r.frq.length + i + 1, type: v.type }))];
    for (const v of verifyStatsFullComposition([...mc, ...frqItems])) bad.push(`${r.id}: ${v}`);
    const keys = [...r.singles, ...r.sets, ...r.frq];
    const fams = [...r.singles, ...r.sets].map((c) => c.fam); if (new Set(fams).size !== fams.length) bad.push(`${r.id}: 문항군 중복`);
    const ffams = r.frq.map((c) => c.fam); if (new Set(ffams).size !== ffams.length) bad.push(`${r.id}: FRQ 문항군 중복`);
    const types = [...r.frq.map((c) => c.frqType), ...r.frqVirtual.map((v) => v.type)].sort(); if (types.join() !== [...STATS_FRQ_TEMPLATES].sort().join()) bad.push(`${r.id}: FRQ 유형 ${types.join("+")} ≠ 4 유형 각 1개`);
    if (r.sets.some((c) => !SET_UNITS.includes(c.members[0].unit))) bad.push(`${r.id}: 공유 세트 단원`);
    for (const c of keys) { if (blocked.has(c.key)) bad.push(`${r.id}: 차단된 항목 ${c.key}`); if (used.has(c.key)) bad.push(`${c.key}: ${used.get(c.key)} 와 ${r.id} 중복`); used.set(c.key, r.id); }
  }
  return bad;
}

/** 보고서(exact-assign 형식과 호환): mcA = MC 후보 키(세트는 한 번, 위치 순서), mcB = [], frqA = FRQ 키(Q1~Q4 순), frqB = []. */
export function toReportSet(r: StatsResult) {
  const order = buildStatsOrder(r); const seen = new Set<string>(); const mcKeys: string[] = [];
  for (const it of order) if (it.candidateKey && !it.candidateKey.startsWith("~") && !seen.has(it.candidateKey)) { seen.add(it.candidateKey); mcKeys.push(it.candidateKey); }
  const frqKeys = [...STATS_FRQ_TEMPLATES].map((t) => r.frq.find((c) => c.frqType === t)?.key).filter((k): k is string => !!k);
  return { id: r.id, mcA: mcKeys, mcB: [] as string[], virtual: r.virtual, virtualSets: r.virtualSets, frqA: frqKeys, frqB: [] as string[], frqVirtual: r.frqVirtual, subject: "ap_statistics" };
}

function main() {
  const ids = arg("--sets", "ST1").split(",").filter(Boolean); const TIME = Number(arg("--time-ms", "120000"));
  const files = arg("--files") ? arg("--files").split(",") : undefined;
  const { all, pool } = loadStatsPool({ requireScreen: !has("--no-screen"), files }); void all;
  const log = (s: string) => console.error(s);
  const m = solveStatsSets(ids, pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep") });
  const results = m.out;
  const bad = m.res.x.length ? verifyStatsAssignment(results) : ["해 없음"];
  const cnt = (f: (c: StatsItem) => boolean) => pool.filter(f).length;
  console.log(`# stats-assign sets=${ids.join(",")} 재고 단독 ${cnt((c) => c.kind === "mc" && !c.shared)} 세트 ${cnt((c) => c.shared)} FRQ ${cnt((c) => c.kind === "frq")}`);
  console.log(`status=${m.res.status} 목적값(가상×1000 + 목표 이탈 합)=${m.res.obj} 노드 ${m.res.nodes} 가상 문항=${results.reduce((a, r) => a + r.virtual.length + r.frqVirtual.length, 0)}`);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of results) {
    const u: Record<string, number> = {}; for (const it of buildStatsOrder(r)) u[it.unit ?? "?"] = (u[it.unit ?? "?"] ?? 0) + 1;
    console.log(`- ${r.id}: 단독 ${r.singles.length}+가상 ${r.virtual.filter((v) => !v.fromSet).length}, 세트 ${r.sets.length}+가상 ${r.virtualSets.length}, FRQ ${r.frq.length}+가상 ${r.frqVirtual.length}, 단원 ${JSON.stringify(u)}`);
    const mcq = [...r.singles, ...r.sets].reduce((a, c) => a + (c.kind === "mc" ? (c.shared ? 3 : 1) : 0), 0), ex = [...r.singles, ...r.sets].reduce((a, c) => a + (c.exam ?? 0), 0);
    console.log(`    MC exam_prep ${ex}/${mcq + r.virtual.length}${mcq ? ` (재고 문항 기준 ${((ex / mcq) * 100).toFixed(0)}%)` : ""}`);
    for (const v of r.virtual) console.log(`    가상 MC: 단원 ${v.unit} 스킬 ${v.skill}${v.fromSet ? " (세트 문항)" : ""}`);
    for (const v of r.virtualSets) console.log(`    가상 세트: 단원 ${v}`);
    for (const v of r.frqVirtual) console.log(`    가상 FRQ: ${v.type}`);
  }
  const w = arg("--write-report");
  if (w) { writeFileSync(w, JSON.stringify({ sets: results.map(toReportSet) }, null, 1)); console.error(`보고서 기록: ${w}`); }
}
if (process.argv[1]?.endsWith("stats-assign.ts")) main();
