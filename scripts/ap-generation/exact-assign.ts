// 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). 휴리스틱(담금질)이 아니라 정수계획(lib/ap-exam/ilp.ts: 단체법 + 분기한정)으로
// "가상 문항(재고에 없는 칸) 최소 개수"를 정확히 구한다. 가능한 배정을 먼저 구하고(상한), 분기한정이 끝나면 하한과 같아져 최소가 증명된다.
//   npx tsx scripts/ap-generation/exact-assign.ts --sets BC1,AB2 [--floor 10] [--ab1 published|free] [--no-pending] [--strict-families] [--min-pending] [--screen-all] [--write-report <경로 .json>] [--time-ms N]
// 세트 이름: BC1..BC3, AB2..AB3(AB1 은 게시본 고정 = 항목 제외). --ab1 free 는 게시본 AB#1 도 다시 배정에 포함(게시본 변경 가정, 별도 표시).
// 조건: 세트 간 같은 문항 0, 세트 안 문항군(구조 look-alike 군집) 1, 단원·스킬 공식 범위, 계산기 29/13, 그래프 필수 ≥ floor(AB#1 제외 5세트 10),
//   FRQ 6(A 계산기 2 + B 불가 4) 서로 다른 유형·문항군, BC 세트 BC 전용 FRQ ≥ 2. 재고 = 화면 증거 보유(신규 70 건 증거 포함) 항목.
import { writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { AB_B, BC_B, SK, loadPool, published, type Item } from "./assign-pool";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
const FLOOR = Number(arg("--floor", "10")); const TIME = Number(arg("--time-ms", "600000"));
export type Spec = { id: string; subj: "ab" | "bc"; floor: number };
const specOf = (id: string): Spec => ({ id, subj: id.startsWith("BC") ? "bc" : "ab", floor: id === "AB1" ? 9 : FLOOR });
export type Virtual = { set: string; part: "A" | "B"; unit: number; skill: number; graph: boolean };
export type FrqVirtual = { set: string; part: "A" | "B"; native: boolean };
export type SetResult = { id: string; mcA: Item[]; mcB: Item[]; virtual: Virtual[]; frqA: Item[]; frqB: Item[]; frqVirtual: FrqVirtual[] };

export function solveMc(sets: Spec[], items: Item[], o: { timeMs: number; log?: (s: string) => void; extra?: (v: { x: (i: number, s: number) => number; vv: (s: number, p: "A" | "B", u: number, k: number, g: 0 | 1) => number }) => Cons[]; cutoff?: number; objSel?: (s: number, p: "A" | "B", u: number, k: number, g: 0 | 1) => boolean; minPending?: boolean }) {
  const mc = items.filter((c) => c.kind === "mc" && c.calc !== "na");
  const idx = new Map<string, number>(); let n = 0; const xv: (number | undefined)[][] = mc.map(() => sets.map(() => undefined));
  mc.forEach((c, i) => sets.forEach((s, si) => { if (s.subj === "bc" || c.subj === "ab") { xv[i][si] = n++; } }));
  void idx;
  const vIdx = new Map<string, number>(); const vKey = (si: number, p: "A" | "B", u: number, k: number, g: 0 | 1) => `${si}|${p}|${u}|${k}|${g}`;
  sets.forEach((s, si) => { for (const p of ["A", "B"] as const) for (let u = 1; u <= (s.subj === "ab" ? 8 : 10); u++) for (let k = 1; k <= 3; k++) for (const g of [0, 1] as const) vIdx.set(vKey(si, p, u, k, g), n++); });
  const obj = new Array<number>(n).fill(0); for (const [k, j] of vIdx) { const [si, p, u, kk, g] = k.split("|"); obj[j] = (!o.objSel || o.objSel(Number(si), p as "A" | "B", Number(u), Number(kk), Number(g) as 0 | 1) ? 1 : 0) * (o.minPending ? 1000 : 1); }
  if (o.minPending) mc.forEach((c, i) => { if (c.pending) sets.forEach((_, si) => { const j = xv[i][si]; if (j !== undefined) obj[j] = 1; }); }); // 2차 목표: 비프로덕션 검증 대기 항목 사용 최소화(가상 문항 1건 = 1000)
  const cons: Cons[] = [];
  mc.forEach((c, i) => { const co = sets.map((_, si) => xv[i][si]).filter((j): j is number => j !== undefined).map((j) => [j, 1] as [number, number]); if (co.length >= 1) cons.push({ coef: co, sense: "<=", rhs: 1 }); });
  sets.forEach((s, si) => {
    const B = s.subj === "ab" ? AB_B : BC_B; const mine = mc.map((c, i) => ({ c, j: xv[i][si] })).filter((x): x is { c: Item; j: number } => x.j !== undefined);
    const vs = [...vIdx].filter(([k]) => k.startsWith(`${si}|`)).map(([k, j]) => { const [, p, u, kk, g] = k.split("|"); return { p, u: Number(u), k: Number(kk), g: g === "1", j }; });
    cons.push({ coef: [...mine.filter((x) => x.c.calc === "not_allowed").map((x) => [x.j, 1] as [number, number]), ...vs.filter((v) => v.p === "A").map((v) => [v.j, 1] as [number, number])], sense: "=", rhs: 29 });
    cons.push({ coef: [...mine.filter((x) => x.c.calc === "required").map((x) => [x.j, 1] as [number, number]), ...vs.filter((v) => v.p === "B").map((v) => [v.j, 1] as [number, number])], sense: "=", rhs: 13 });
    for (const [u, [lo, hi]] of Object.entries(B)) { const co = [...mine.filter((x) => x.c.unit === Number(u)).map((x) => [x.j, 1] as [number, number]), ...vs.filter((v) => v.u === Number(u)).map((v) => [v.j, 1] as [number, number])]; cons.push({ coef: co, sense: ">=", rhs: lo }); cons.push({ coef: co, sense: "<=", rhs: hi }); }
    for (const [k, [lo, hi]] of Object.entries(SK)) { const co = [...mine.filter((x) => x.c.skill === Number(k)).map((x) => [x.j, 1] as [number, number]), ...vs.filter((v) => v.k === Number(k)).map((v) => [v.j, 1] as [number, number])]; cons.push({ coef: co, sense: ">=", rhs: lo }); cons.push({ coef: co, sense: "<=", rhs: hi }); }
    cons.push({ coef: [...mine.filter((x) => x.c.graph).map((x) => [x.j, 1] as [number, number]), ...vs.filter((v) => v.g).map((v) => [v.j, 1] as [number, number])], sense: ">=", rhs: s.floor });
    const fam = new Map<string, [number, number][]>(); for (const x of mine) (fam.get(x.c.fam) ?? fam.set(x.c.fam, []).get(x.c.fam)!).push([x.j, 1]);
    for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
  });
  if (o.extra) cons.push(...o.extra({ x: (i, s) => xv[i][s] ?? -1, vv: (s, p, u, k, g) => vIdx.get(vKey(s, p, u, k, g)) ?? -1 }));
  const binary = new Array<boolean>(n).fill(false); for (const row of xv) for (const j of row) if (j !== undefined) binary[j] = true;
  const r = solveMip({ n, obj, cons, integer: new Array(n).fill(true), binary }, { timeMs: o.timeMs, log: o.log, cutoff: o.cutoff });
  const out = sets.map((s) => ({ id: s.id, mcA: [] as Item[], mcB: [] as Item[], virtual: [] as Virtual[] }));
  if (r.x.length) {
    mc.forEach((c, i) => sets.forEach((_, si) => { const j = xv[i][si]; if (j !== undefined && r.x[j] > 0.5) (c.calc === "not_allowed" ? out[si].mcA : out[si].mcB).push(c); }));
    for (const [k, j] of vIdx) { const cnt = Math.round(r.x[j]); if (cnt > 0) { const [si, p, u, kk, g] = k.split("|"); for (let q = 0; q < cnt; q++) out[Number(si)].virtual.push({ set: sets[Number(si)].id, part: p as "A" | "B", unit: Number(u), skill: Number(kk), graph: g === "1" }); } }
  }
  return { res: r, out, vIdx, xv, mc };
}

export function solveFrq(sets: Spec[], items: Item[], o: { timeMs: number; log?: (s: string) => void }) {
  const fr = items.filter((c) => c.kind === "frq"); let n = 0; const xv = fr.map((c) => sets.map((s) => (s.subj === "bc" || !c.native ? n++ : undefined)));
  const vIdx = new Map<string, number>(); sets.forEach((s, si) => { for (const p of ["A", "B"] as const) for (const nat of s.subj === "bc" ? [false, true] : [false]) vIdx.set(`${si}|${p}|${nat ? 1 : 0}`, n++); });
  const obj = new Array<number>(n).fill(0); for (const j of vIdx.values()) obj[j] = 1; const cons: Cons[] = [];
  fr.forEach((_, i) => { const co = sets.map((__, si) => xv[i][si]).filter((j): j is number => j !== undefined).map((j) => [j, 1] as [number, number]); if (co.length >= 1) cons.push({ coef: co, sense: "<=", rhs: 1 }); });
  sets.forEach((s, si) => {
    const mine = fr.map((c, i) => ({ c, j: xv[i][si] })).filter((x): x is { c: Item; j: number } => x.j !== undefined); const vs = [...vIdx].filter(([k]) => k.startsWith(`${si}|`)).map(([k, j]) => { const [, p, nat] = k.split("|"); return { p, nat: nat === "1", j }; });
    cons.push({ coef: [...mine.filter((x) => x.c.calc === "required").map((x) => [x.j, 1] as [number, number]), ...vs.filter((v) => v.p === "A").map((v) => [v.j, 1] as [number, number])], sense: "=", rhs: 2 });
    cons.push({ coef: [...mine.filter((x) => x.c.calc !== "required").map((x) => [x.j, 1] as [number, number]), ...vs.filter((v) => v.p === "B").map((v) => [v.j, 1] as [number, number])], sense: "=", rhs: 4 });
    for (const key of ["type", "fam"] as const) { const g = new Map<string, [number, number][]>(); for (const x of mine) (g.get(x.c[key]) ?? g.set(x.c[key], []).get(x.c[key])!).push([x.j, 1]); for (const co of g.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 }); }
    if (s.subj === "bc") cons.push({ coef: [...mine.filter((x) => x.c.native).map((x) => [x.j, 1] as [number, number]), ...vs.filter((v) => v.nat).map((v) => [v.j, 1] as [number, number])], sense: ">=", rhs: 2 });
  });
  const binary = new Array<boolean>(n).fill(false); for (const row of xv) for (const j of row) if (j !== undefined) binary[j] = true;
  const r = solveMip({ n, obj, cons, integer: new Array(n).fill(true), binary }, { timeMs: o.timeMs, log: o.log });
  const out = sets.map((s) => ({ id: s.id, frqA: [] as Item[], frqB: [] as Item[], frqVirtual: [] as FrqVirtual[] }));
  if (r.x.length) {
    fr.forEach((c, i) => sets.forEach((_, si) => { const j = xv[i][si]; if (j !== undefined && r.x[j] > 0.5) (c.calc === "required" ? out[si].frqA : out[si].frqB).push(c); }));
    for (const [k, j] of vIdx) { const cnt = Math.round(r.x[j]); for (let q = 0; q < cnt; q++) { const [si, p, nat] = k.split("|"); out[Number(si)].frqVirtual.push({ set: sets[Number(si)].id, part: p as "A" | "B", native: nat === "1" }); } }
  }
  return { res: r, out };
}

/** 독립 검증기: 배정 결과가 모든 조건을 지키는지 다시 계산(가상 문항은 칸 속성으로 센다). 위반 목록을 돌려준다(빈 배열 = 통과). */
export function verifyAssignment(sets: Spec[], res: SetResult[], blocked: Set<string>): string[] {
  const bad: string[] = []; const used = new Map<string, string>();
  for (const s of sets) {
    const r = res.find((x) => x.id === s.id)!; const B = s.subj === "ab" ? AB_B : BC_B;
    const a = [...r.mcA], b = [...r.mcB]; const all = [...a, ...b];
    if (a.length + r.virtual.filter((v) => v.part === "A").length !== 29) bad.push(`${s.id}: MC Part A 수`);
    if (b.length + r.virtual.filter((v) => v.part === "B").length !== 13) bad.push(`${s.id}: MC Part B 수`);
    if (a.some((c) => c.calc !== "not_allowed") || b.some((c) => c.calc !== "required")) bad.push(`${s.id}: 계산기 조건`);
    const units = (u: number) => all.filter((c) => c.unit === u).length + r.virtual.filter((v) => v.unit === u).length;
    for (const [u, [lo, hi]] of Object.entries(B)) if (units(Number(u)) < lo || units(Number(u)) > hi) bad.push(`${s.id}: 단원 ${u} = ${units(Number(u))}`);
    const sk = (k: number) => all.filter((c) => c.skill === k).length + r.virtual.filter((v) => v.skill === k).length;
    for (const [k, [lo, hi]] of Object.entries(SK)) if (sk(Number(k)) < lo || sk(Number(k)) > hi) bad.push(`${s.id}: 스킬 ${k} = ${sk(Number(k))}`);
    if (all.filter((c) => c.graph).length + r.virtual.filter((v) => v.graph).length < s.floor) bad.push(`${s.id}: 그래프 필수 < ${s.floor}`);
    if (new Set(all.map((c) => c.fam)).size !== all.length) bad.push(`${s.id}: 문항군 중복`);
    if (s.subj === "ab" && all.some((c) => c.subj !== "ab")) bad.push(`${s.id}: AB 세트에 BC 문항`);
    const fr = [...r.frqA, ...r.frqB]; if (r.frqA.length + r.frqVirtual.filter((v) => v.part === "A").length !== 2 || r.frqB.length + r.frqVirtual.filter((v) => v.part === "B").length !== 4) bad.push(`${s.id}: FRQ 수`);
    if (r.frqA.some((c) => c.calc !== "required") || r.frqB.some((c) => c.calc === "required")) bad.push(`${s.id}: FRQ 계산기`);
    if (new Set(fr.map((c) => c.type)).size !== fr.length || new Set(fr.map((c) => c.fam)).size !== fr.length) bad.push(`${s.id}: FRQ 유형·문항군 중복`);
    if (s.subj === "bc" && fr.filter((c) => c.native).length + r.frqVirtual.filter((v) => v.native).length < 2) bad.push(`${s.id}: BC 전용 FRQ < 2`);
    if (s.subj === "ab" && fr.some((c) => c.native)) bad.push(`${s.id}: AB 세트에 BC 전용 FRQ`);
    for (const c of [...all, ...fr]) { if (blocked.has(c.key)) bad.push(`${s.id}: 게시본 AB#1 항목 ${c.key}`); if (used.has(c.key)) bad.push(`${c.key}: ${used.get(c.key)} 와 ${s.id} 중복`); used.set(c.key, s.id); }
  }
  return bad;
}

async function main() {
  const ids = arg("--sets", "BC1,AB2").split(",").map((x) => x.replace(/^(AB|BC)#?/, "$1")); const sets = ids.map(specOf);
  const pub = published(); const pubKeys = new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB]);
  const ab1Free = arg("--ab1", "published") === "free";
  const { all, pool } = loadPool({ strictFamilies: has("--strict-families") }); let items = (has("--screen-all") ? all : pool).filter((c) => (ab1Free ? true : !pubKeys.has(c.key)) && (!has("--no-pending") || !c.pending));
  const setsRun = ab1Free ? [specOf("AB1"), ...sets] : sets;
  const log = (s: string) => console.error(s);
  const m = solveMc(setsRun, items, { timeMs: TIME, log, minPending: has("--min-pending") }); const f = solveFrq(setsRun, items, { timeMs: TIME, log });
  const results: SetResult[] = setsRun.map((s, i) => ({ ...m.out[i], ...f.out[i] }));
  const bad = m.res.x.length && f.res.x.length ? verifyAssignment(setsRun, results, ab1Free ? new Set() : pubKeys) : ["해 없음"];
  const pend = (c: Item) => (c.isNew ? "신규(비프로덕션 검증 대기)" : "");
  console.log(`# exact-assign sets=${setsRun.map((s) => s.id).join(",")} floor=${FLOOR} ab1=${ab1Free ? "free(게시본 변경 가정)" : "published(고정, 항목 제외)"} 재고 MC ${items.filter((c) => c.kind === "mc").length} FRQ ${items.filter((c) => c.kind === "frq").length}${has("--no-pending") ? " (비프로덕션 검증 대기 91건 제외)" : ""}`);
  console.log(`MC: status=${m.res.status} ${has("--min-pending") ? "목적값(가상×1000 + 검증 대기 사용 수)" : "가상 문항 최소"}=${m.res.obj} (LP 하한 ${m.res.rootBound.toFixed(3)}, 증명된 하한 ${m.res.bestBound}, 노드 ${m.res.nodes}) 가상 문항 수=${m.out.reduce((a, r) => a + r.virtual.length, 0)}`);
  console.log(`FRQ: status=${f.res.status} 가상 FRQ 최소=${f.res.obj} (LP 하한 ${f.res.rootBound.toFixed(3)}, 노드 ${f.res.nodes})`);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of results) {
    const all2 = [...r.mcA, ...r.mcB]; const u = new Map<number, number>(); for (const c of all2) u.set(c.unit, (u.get(c.unit) ?? 0) + 1); for (const v of r.virtual) u.set(v.unit, (u.get(v.unit) ?? 0) + 1);
    console.log(`- ${r.id}: MC A ${r.mcA.length}+가상${r.virtual.filter((v) => v.part === "A").length} / B ${r.mcB.length}+가상${r.virtual.filter((v) => v.part === "B").length}, 그래프 필수 ${all2.filter((c) => c.graph).length}+가상${r.virtual.filter((v) => v.graph).length}, 검증 대기 의존 ${all2.filter((c) => c.pending).length}건(신규70 ${all2.filter((c) => c.pending === "graph70").length}+형제21 ${all2.filter((c) => c.pending === "sib21").length}) / 단원 ${[...u].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" ")} / FRQ A ${r.frqA.length} B ${r.frqB.length} 가상 ${r.frqVirtual.length}, BC 전용 ${[...r.frqA, ...r.frqB].filter((c) => c.native).length}`);
    for (const v of r.virtual) console.log(`    가상 MC: Part ${v.part} 단원 ${v.unit} 스킬 ${v.skill} ${v.graph ? "그래프 필수" : "비그래프"}`);
    for (const v of r.frqVirtual) console.log(`    가상 FRQ: Part ${v.part} ${v.native ? "BC 전용" : "공유"}`);
  }
  const w = arg("--write-report");
  if (w) { if (/ab-full-set-selection/.test(w)) throw new Error("게시본 경로에는 쓰지 않습니다."); writeFileSync(w, JSON.stringify({ sets: results.map((r) => ({ id: r.id, mcA: r.mcA.map((c) => c.key), mcB: r.mcB.map((c) => c.key), virtual: r.virtual, frqA: r.frqA.map((c) => c.key), frqB: r.frqB.map((c) => c.key), frqVirtual: r.frqVirtual, pendingNonprod: [...r.mcA, ...r.mcB, ...r.frqA, ...r.frqB].filter((c) => c.pending).map((c) => c.key) })), mcShortage: m.out.reduce((a, r) => a + r.virtual.length, 0), frqShortage: f.res.obj, verifierViolations: bad, ab1: ab1Free ? "free" : "published" }, null, 1)); console.log(`보고서 저장: ${w}`); }
  void pend;
}
if (process.argv[1]?.endsWith("exact-assign.ts")) main().catch((e) => { console.error(e); process.exit(1); });
