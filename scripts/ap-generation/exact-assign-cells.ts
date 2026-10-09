// 최소 부족이 확정된 뒤(exact-assign.ts), 어느 칸에 가상 문항이 "반드시" 들어가야 하는지 확인한다(무료·읽기 전용).
// 최적해는 여러 개일 수 있다. 칸 묶음마다 "전체 부족 = 최소값"을 유지하면서 그 묶음에 놓이는 가상 문항 수를 최소화하면, 그 값이 해당 묶음의 **필수 부족**(어느 최적 배정에서도 피할 수 없는 값)이다.
//   npx tsx scripts/ap-generation/exact-assign-cells.ts --sets BC1,AB2,BC2,AB3,BC3 [--floor 10] [--no-pending]
import { solveMc, type Spec } from "./exact-assign";
import { loadPool, published } from "./assign-pool";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const FLOOR = Number(arg("--floor", "10"));
const sets: Spec[] = arg("--sets", "BC1,AB2,BC2,AB3,BC3").split(",").map((id) => ({ id, subj: id.startsWith("BC") ? "bc" : "ab", floor: FLOOR }));
const pub = published(); const pubKeys = new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB]);
const items = loadPool({ strictFamilies: process.argv.includes("--strict-families") }).pool.filter((c) => !pubKeys.has(c.key) && (!process.argv.includes("--no-pending") || !c.pending));
const base = solveMc(sets, items, { timeMs: 600000 }); const OPT = Math.round(base.res.obj);
console.log(`최소 MC 부족 ${OPT} (${base.res.status}, 하한 ${base.res.bestBound})`);
const groups: [string, (s: number, p: "A" | "B", u: number, k: number, g: 0 | 1) => boolean][] = [];
for (let u = 1; u <= 10; u++) groups.push([`단원 ${u}`, (_s, _p, uu) => uu === u]);
for (const p of ["A", "B"] as const) groups.push([`Part ${p}(계산기 ${p === "A" ? "불가" : "필수"})`, (_s, pp) => pp === p]);
for (const k of [1, 2, 3]) groups.push([`스킬 ${k}`, (_s, _p, _u, kk) => kk === k]);
groups.push(["그래프 필수 칸", (_s, _p, _u, _k, g) => g === 1], ["비그래프 칸", (_s, _p, _u, _k, g) => g === 0]);
for (const p of ["A", "B"] as const) for (let u = 1; u <= 10; u++) groups.push([`Part ${p} × 단원 ${u}`, (_s, pp, uu) => pp === p && uu === u]);
const only = arg("--only"); const forced: string[] = [];
for (const [name, sel] of groups) {
  if (only && !only.split(",").includes(name)) continue;
  const r = solveMc(sets, items, { timeMs: 45000, objSel: sel, extra: (v) => { const co: [number, number][] = []; for (let s = 0; s < sets.length; s++) for (const p of ["A", "B"] as const) for (let u = 1; u <= (sets[s].subj === "ab" ? 8 : 10); u++) for (let k = 1; k <= 3; k++) for (const g of [0, 1] as const) co.push([v.vv(s, p, u, k, g), 1]); return [{ coef: co, sense: "<=", rhs: OPT }]; } });
  const m = Math.round(r.res.status === "optimal" ? r.res.obj : r.res.bestBound);
  if (m > 0) forced.push(`${name}: 최소 ${m}${r.res.status === "optimal" ? "" : "(증명된 하한)"}`);
  process.stdout.write(`  ${name}: ${r.res.status} ${m}\n`);
}
console.log(forced.length ? `필수 부족(어느 최적 배정에서도 이 묶음에 최소 이만큼 필요):\n- ${forced.join("\n- ")}` : "묶음 단위 필수 부족 없음: 최적 배정은 여러 칸 조합으로 가능(단일 칸이 강제되지 않음)");
console.log("예시 최적 배정의 가상 문항(한 가지 해):"); for (const r of base.out) for (const v of r.virtual) console.log(`  ${r.id}: Part ${v.part} 단원 ${v.unit} 스킬 ${v.skill} ${v.graph ? "그래프 필수" : "비그래프"}`);
