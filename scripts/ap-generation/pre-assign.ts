// AP Precalculus 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). phys-assign.ts 와 같은 방식(정수계획 + 배정기와 별개인 독립 검증기).
//   npx tsx scripts/ap-generation/pre-assign.ts --sets PC1[,PC2,...] [--time-ms 120000] [--write-report <경로 .json>] [--files pre-a-items,...] [--no-screen] [--prefer-exam-prep] [--block-file <보고서.json[,..]>]
// 조건(공식 구조, AP Central 시험 페이지·CED): MC 42 = 파트 A 29(계산기 불가) + 파트 B 13(계산기 필수), 단독 문항만. 단원 비중 30-40/25-40/30-35 % → [13,16]/[11,16]/[13,14], 목표 15/13/14.
//   FRQ 4 = fc·mn(파트 A, 계산기 필수) + mp·sy(파트 B, 계산기 불가) 각 1, 세트 안 문항군 1(look-alike 포함), 세트 간 같은 문항 0. 재고에 없는 칸은 가상 문항으로 세어 부족분을 정확히 보고한다.
//   보고서 형식은 exact-assign 과 같다: mcA = 파트 A 키, mcB = 파트 B 키, frqA = fc·mn, frqB = mp·sy.
import { readFileSync, writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { PRE_FRQ_CALC, PRE_FRQ_TEMPLATES, PRE_FULL_TARGET, PRE_MC_PART_A, PRE_MC_PART_B, preUnitBounds, verifyPreFullComposition, type PreSetItem } from "../../lib/ap-exam/full-set-rules";
import { loadPrePool, type PreItem } from "./pre-pool";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export type PreVirtual = { set: string; part: "A" | "B"; unit: number };
export type PreResult = { id: string; mcA: PreItem[]; mcB: PreItem[]; virtual: PreVirtual[]; frq: PreItem[]; frqVirtual: { set: string; type: string }[] };
const UNITS = Object.keys(PRE_FULL_TARGET.units).map(Number);

export function solvePreSets(ids: string[], items: PreItem[], o: { timeMs: number; log?: (s: string) => void; blocked?: Set<string>; preferExamPrep?: boolean; cost?: (c: PreItem) => number; joint?: boolean }) {
  const blocked = o.blocked ?? new Set<string>();
  const usable = items.filter((c) => !blocked.has(c.key) && (c.kind === "frq" ? (PRE_FRQ_TEMPLATES as readonly string[]).includes(c.template) : (c.calc === "required" || c.calc === "not_allowed")));
  const mcs = usable.filter((c) => c.kind === "mc"), frqs = usable.filter((c) => c.kind === "frq");
  let n = 0; const V = (): number => n++;
  const xv = new Map<string, number>();
  usable.forEach((c, i) => ids.forEach((_, s) => xv.set(`${i}|${s}`, V())));
  const idx = new Map(usable.map((c, i) => [c, i] as const));
  const x = (c: PreItem, s: number) => xv.get(`${idx.get(c)}|${s}`)!;
  const vm = new Map<string, number>(), vf = new Map<string, number>(), du = new Map<string, number>();
  ids.forEach((_, s) => {
    for (const p of ["A", "B"]) for (const u of UNITS) vm.set(`${s}|${p}|${u}`, V());
    for (const u of UNITS) du.set(`${s}|${u}`, V());
    for (const t of PRE_FRQ_TEMPLATES) vf.set(`${s}|${t}`, V());
  });
  const obj = new Array<number>(n + 1).fill(0); const cons: Cons[] = [];
  for (const j of vm.values()) obj[j] = 1000; for (const j of vf.values()) obj[j] = 1000; for (const j of du.values()) obj[j] = 1;
  if (o.preferExamPrep) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += -0.01 * (c.exam ?? 0); }));
  if (o.cost) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += o.cost!(c); }));
  const uB = preUnitBounds();
  usable.forEach((c) => cons.push({ coef: ids.map((_, s) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 }));
  ids.forEach((_, s) => {
    cons.push({ coef: [...mcs.filter((c) => c.calc === "not_allowed").map((c) => [x(c, s), 1] as [number, number]), ...UNITS.map((u) => [vm.get(`${s}|A|${u}`)!, 1] as [number, number])], sense: "=", rhs: PRE_MC_PART_A });
    cons.push({ coef: [...mcs.filter((c) => c.calc === "required").map((c) => [x(c, s), 1] as [number, number]), ...UNITS.map((u) => [vm.get(`${s}|B|${u}`)!, 1] as [number, number])], sense: "=", rhs: PRE_MC_PART_B });
    for (const u of UNITS) {
      const co: [number, number][] = [...mcs.filter((c) => c.unit === u).map((c) => [x(c, s), 1] as [number, number]), [vm.get(`${s}|A|${u}`)!, 1], [vm.get(`${s}|B|${u}`)!, 1]];
      cons.push({ coef: co, sense: ">=", rhs: uB[String(u)].min }); cons.push({ coef: co, sense: "<=", rhs: uB[String(u)].max });
      const t = PRE_FULL_TARGET.units[String(u)]; const d = du.get(`${s}|${u}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    const fam = new Map<string, [number, number][]>(); for (const c of mcs) (fam.get(c.fam) ?? fam.set(c.fam, []).get(c.fam)!).push([x(c, s), 1]);
    for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    for (const t of PRE_FRQ_TEMPLATES) cons.push({ coef: [...frqs.filter((c) => c.template === t).map((c) => [x(c, s), 1] as [number, number]), [vf.get(`${s}|${t}`)!, 1]], sense: "=", rhs: 1 });
    const ffam = new Map<string, [number, number][]>(); for (const c of frqs) (ffam.get(c.fam) ?? ffam.set(c.fam, []).get(c.fam)!).push([x(c, s), 1]);
    for (const co of ffam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
  });
  if (o.joint) { // 여러 세트를 한 번에: 원형은 세트 전체에서 최대 1회, exam_prep 최소값(m)을 최대화(세트 간 균형)
    const mv = V();
    obj[mv] = -1;
    const byArch = new Map<string, [number, number][]>(); for (const c of usable) for (let s = 0; s < ids.length; s++) (byArch.get(`${c.kind}|${c.archetype}`) ?? byArch.set(`${c.kind}|${c.archetype}`, []).get(`${c.kind}|${c.archetype}`)!).push([x(c, s), 1]);
    for (const co of byArch.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    ids.forEach((_, s) => cons.push({ coef: [...mcs.filter((c) => (c.exam ?? 0) > 0).map((c) => [x(c, s), c.exam ?? 0] as [number, number]), [mv, -1]], sense: ">=", rhs: 0 }));
  }
  const binary = new Array<boolean>(n).fill(false); for (const j of xv.values()) binary[j] = true; for (const j of vf.values()) binary[j] = true;
  obj.length = n;
  const r = solveMip({ n, obj, cons, integer: new Array(n).fill(true), binary }, { timeMs: o.timeMs, log: o.log });
  const out: PreResult[] = ids.map((id) => ({ id, mcA: [], mcB: [], virtual: [], frq: [], frqVirtual: [] }));
  if (r.x.length) ids.forEach((id, s) => {
    for (const c of usable) if (r.x[x(c, s)] > 0.5) (c.kind === "frq" ? out[s].frq : c.calc === "not_allowed" ? out[s].mcA : out[s].mcB).push(c);
    for (const p of ["A", "B"] as const) for (const u of UNITS) for (let q = 0; q < Math.round(r.x[vm.get(`${s}|${p}|${u}`)!]); q++) out[s].virtual.push({ set: id, part: p, unit: u });
    for (const t of PRE_FRQ_TEMPLATES) if (r.x[vf.get(`${s}|${t}`)!] > 0.5) out[s].frqVirtual.push({ set: id, type: t });
  });
  return { res: r, out };
}

/** 한 세트의 MC 위치 목록: 파트 A(계산기 불가) 단원 오름차순 뒤에 파트 B(필수) 단원 오름차순. 가상 문항은 candidateKey null. */
export function buildPreOrder(r: PreResult): PreSetItem[] {
  const blocks = (part: "A" | "B", real: PreItem[]) => [...real.map((c) => ({ unit: c.unit, key: c.key, calc: c.calc })), ...r.virtual.filter((v) => v.part === part).map((v, i) => ({ unit: v.unit, key: `~v${part}${i}`, calc: part === "A" ? "not_allowed" : "required" }))].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
  const out: PreSetItem[] = []; let pos = 1;
  for (const b of [...blocks("A", r.mcA), ...blocks("B", r.mcB)]) out.push({ kind: "mc", unit: String(b.unit), calc: b.calc, template: null, candidateKey: null, position: pos++ });
  return out;
}

/** 독립 검증기(배정기와 별개): 구조·단원·계산기 분할·FRQ 유형·문항군·세트 간 중복·차단 키. 위반 목록(빈 배열 = 통과). */
export function verifyPreAssignment(res: PreResult[], blocked: Set<string> = new Set()): string[] {
  const bad: string[] = []; const used = new Map<string, string>();
  for (const r of res) {
    const mc = buildPreOrder(r);
    const frqItems: PreSetItem[] = [...r.frq.map((c, i) => ({ kind: "frq" as const, unit: null, calc: PRE_FRQ_CALC[c.template], template: c.template, candidateKey: c.key, position: i + 1 })), ...r.frqVirtual.map((v, i) => ({ kind: "frq" as const, unit: null, calc: PRE_FRQ_CALC[v.type], template: v.type, candidateKey: null, position: r.frq.length + i + 1 }))];
    for (const v of verifyPreFullComposition([...mc, ...frqItems])) bad.push(`${r.id}: ${v}`);
    const keys = [...r.mcA, ...r.mcB, ...r.frq];
    const fams = [...r.mcA, ...r.mcB].map((c) => c.fam); if (new Set(fams).size !== fams.length) bad.push(`${r.id}: 문항군 중복`);
    const ffams = r.frq.map((c) => c.fam); if (new Set(ffams).size !== ffams.length) bad.push(`${r.id}: FRQ 문항군 중복`);
    if (r.mcA.some((c) => c.calc !== "not_allowed") || r.mcB.some((c) => c.calc !== "required")) bad.push(`${r.id}: 계산기 파트 불일치`);
    for (const c of keys) { if (blocked.has(c.key)) bad.push(`${r.id}: 차단된 항목 ${c.key}`); if (used.has(c.key)) bad.push(`${c.key}: ${used.get(c.key)} 와 ${r.id} 중복`); used.set(c.key, r.id); }
  }
  return bad;
}

/** 보고서(exact-assign 형식과 호환): mcA = 파트 A 키(단원 순), mcB = 파트 B 키, frqA = fc·mn, frqB = mp·sy. */
export function toReportSet(r: PreResult) {
  const ord = (xs: PreItem[]) => [...xs].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key)).map((c) => c.key);
  const f = (t: string) => r.frq.find((c) => c.template === t)?.key;
  return { id: r.id, mcA: ord(r.mcA), mcB: ord(r.mcB), virtual: r.virtual, frqA: ["fc", "mn"].map(f).filter((k): k is string => !!k), frqB: ["mp", "sy"].map(f).filter((k): k is string => !!k), frqVirtual: r.frqVirtual, subject: "ap_precalculus" };
}

function main() {
  const ids = arg("--sets", "PC1").split(",").filter(Boolean); const TIME = Number(arg("--time-ms", "120000"));
  const files = arg("--files") ? arg("--files").split(",") : undefined;
  const { pool } = loadPrePool({ requireScreen: !has("--no-screen"), files });
  const log = (s: string) => console.error(s);
  const blocked = new Set<string>(); for (const f of arg("--block-file").split(",").filter(Boolean)) for (const st of (JSON.parse(readFileSync(f, "utf-8")) as { sets: { mcA?: string[]; mcB?: string[]; frqA?: string[]; frqB?: string[] }[] }).sets) for (const k of [...(st.mcA ?? []), ...(st.mcB ?? []), ...(st.frqA ?? []), ...(st.frqB ?? [])]) blocked.add(k);
  const out: PreResult[] = []; let total = 0; const bl = new Set(blocked); let status = "optimal";
  if (has("--joint")) { const one = solvePreSets(ids, pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked: bl, joint: true }); out.push(...one.out); total = one.res.obj; status = one.res.status; }
  else for (const id of ids) {
    const one = solvePreSets([id], pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked: bl });
    out.push(...one.out); total += one.res.obj; status = one.res.status;
    // 세트 간 원형 겹침 0(오너 정책 "숫자만 바꾼 변형 금지"): 쓴 문항의 원형 전체를 이후 세트에서 막는다(같은 원형의 다른 시드 후보 포함).
    const usedArch = new Set([...one.out[0].mcA, ...one.out[0].mcB, ...one.out[0].frq].map((c) => `${c.kind}|${c.archetype}`));
    for (const c of pool) if (usedArch.has(`${c.kind}|${c.archetype}`)) bl.add(c.key);
  }
  const bad = verifyPreAssignment(out);
  const cnt = (f: (c: PreItem) => boolean) => pool.filter(f).length;
  console.log(`# pre-assign sets=${ids.join(",")} 재고 MC ${cnt((c) => c.kind === "mc")} (계산기 불가 ${cnt((c) => c.kind === "mc" && c.calc === "not_allowed")}, 필수 ${cnt((c) => c.kind === "mc" && c.calc === "required")}) FRQ ${cnt((c) => c.kind === "frq")}`);
  console.log(`status=${status} 목적값=${total.toFixed(2)} 가상 문항=${out.reduce((a, r) => a + r.virtual.length + r.frqVirtual.length, 0)}`);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of out) {
    const u: Record<string, number> = {}; for (const it of buildPreOrder(r)) u[it.unit ?? "?"] = (u[it.unit ?? "?"] ?? 0) + 1;
    console.log(`- ${r.id}: 파트 A ${r.mcA.length}+가상 ${r.virtual.filter((v) => v.part === "A").length}, 파트 B ${r.mcB.length}+가상 ${r.virtual.filter((v) => v.part === "B").length}, FRQ ${r.frq.length}+가상 ${r.frqVirtual.length}, 단원 ${JSON.stringify(u)}`);
    const real = [...r.mcA, ...r.mcB]; const ex = real.reduce((a, c) => a + (c.exam ?? 0), 0);
    console.log(`    MC exam_prep ${ex}/${real.length + r.virtual.length}${real.length ? ` (재고 문항 기준 ${((ex / real.length) * 100).toFixed(0)}%)` : ""}`);
    for (const v of r.virtual) console.log(`    가상 MC: 파트 ${v.part} 단원 ${v.unit}`);
    for (const v of r.frqVirtual) console.log(`    가상 FRQ: ${v.type}`);
  }
  const w = arg("--write-report");
  if (w) { writeFileSync(w, JSON.stringify({ sets: out.map(toReportSet) }, null, 1)); console.error(`보고서 기록: ${w}`); }
}
if (process.argv[1]?.endsWith("pre-assign.ts")) main();
