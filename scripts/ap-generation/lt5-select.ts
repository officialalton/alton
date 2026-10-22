// LT5 새 묶음(Wharton·Cather·Hughes)의 문항 부분집합 선택(무료, DB 없음): LT4 는 기존 묶음(s05·rs21·p05·p03·l01)으로 확정돼 있으므로 LT5 = 새 묶음 3 + 기존 시 p06 + 장편 l02|l04 로 공식 구성(MC 55, 묶음 크기·장르 문항 수, 7범주 상·하한)을 정수계획으로 맞춘다.
//   npx tsx scripts/ap-generation/lt5-select.ts [--write data/ap/stock/lt5-selection.json]
import { readFileSync, writeFileSync } from "node:fs";
import type { Cons } from "../../lib/ap-exam/ilp";
import { solveMipHighs } from "./ilp-highs";
import { englitCategoryBounds, englitCategoryOf, ENGLIT_FULL_TARGET } from "../../lib/ap-exam/englit-rules";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const cats = ["1", "2", "3", "4", "5", "6", "7"]; const cb = englitCategoryBounds();
const run = JSON.parse(readFileSync("data/ap/sample-2027/englit-real-9/real-sample-items.json", "utf-8")) as Json[];
const SETS = ["rs32", "rs33", "rs34"]; const sets: Record<string, Json[]> = {}; for (const c of run) { const id = String(c.cellId).split("-").pop()!; if (SETS.includes(id) && c.reviewState === "auto_passed") sets[id] = c.payload.items as Json[]; }
const FIX_P06 = [1, 1, 3, 3, 2, 2, 1]; const LONG: Record<string, number[]> = { l04: [2, 0, 3, 2, 1, 0, 2], l02: [3, 0, 2, 2, 0, 0, 2] }; const LONG_N: Record<string, number> = { l04: 10, l02: 9 };
let n = 0; const xv = new Map<string, number>(); for (const s of SETS) sets[s].forEach((_, i) => xv.set(`${s}|${i}`, n++)); const yl: Record<string, number> = { l04: n++, l02: n++ };
const obj = new Array<number>(n).fill(0); const cons: Cons[] = []; const conf = (it: Json) => Number(it.key_confidence?.score ?? 0.8);
for (const s of SETS) sets[s].forEach((it, i) => { obj[xv.get(`${s}|${i}`)!] = -conf(it); }); // 최대화 = 음수 최소화
const size = (s: string): [number, number][] => sets[s].map((_, i) => [xv.get(`${s}|${i}`)!, 1]);
cons.push({ coef: size("rs32"), sense: ">=", rhs: 8 }); cons.push({ coef: size("rs32"), sense: "<=", rhs: 13 }); cons.push({ coef: size("rs34"), sense: ">=", rhs: 8 }); cons.push({ coef: size("rs34"), sense: "<=", rhs: 13 });
cons.push({ coef: [...size("rs32"), ...size("rs34")], sense: ">=", rhs: 23 }); cons.push({ coef: [...size("rs32"), ...size("rs34")], sense: "<=", rhs: 27 });
cons.push({ coef: size("rs33"), sense: ">=", rhs: 8 }); cons.push({ coef: size("rs33"), sense: "<=", rhs: 12 }); // p06(13)+rs33 ∈ [19,25] → rs33 ∈ [6,12], 묶음 최소 8
cons.push({ coef: [[yl.l04, 1], [yl.l02, 1]], sense: "=", rhs: 1 });
cons.push({ coef: [...size("rs32"), ...size("rs34"), ...size("rs33"), [yl.l04, LONG_N.l04], [yl.l02, LONG_N.l02]], sense: "=", rhs: 55 - 13 });
cats.forEach((k, ci) => { const co: [number, number][] = []; for (const s of SETS) sets[s].forEach((it, i) => { if (englitCategoryOf(it.skill) === k) co.push([xv.get(`${s}|${i}`)!, 1]); }); co.push([yl.l04, LONG.l04[ci]], [yl.l02, LONG.l02[ci]]); const lo = cb[k].min - FIX_P06[ci], hi = cb[k].max - FIX_P06[ci]; cons.push({ coef: co, sense: ">=", rhs: lo }); cons.push({ coef: co, sense: "<=", rhs: hi }); });
const binary = new Array<boolean>(n).fill(true);
const r = solveMipHighs({ n, obj, cons, integer: new Array(n).fill(true), binary }, { timeMs: 60000 });
console.log("status", r.status); if (!r.x.length || r.status !== "optimal") { console.log("infeasible: 새 묶음 문항만으로 LT5 범주 상·하한을 채울 수 없음"); process.exit(1); }
const picks: Record<string, number[]> = {}; for (const s of SETS) picks[s] = sets[s].map((_, i) => i).filter((i) => r.x[xv.get(`${s}|${i}`)!] > 0.5);
const longPick = r.x[yl.l04] > 0.5 ? "l04" : "l02"; const vec: Record<string, number> = {}; cats.forEach((k, ci) => { let c = FIX_P06[ci] + LONG[longPick][ci]; for (const s of SETS) for (const i of picks[s]) if (englitCategoryOf(sets[s][i].skill) === k) c++; vec[k] = c; });
console.log(JSON.stringify({ sizes: Object.fromEntries(SETS.map((s) => [s, picks[s].length])), long: longPick, categories: vec, target: ENGLIT_FULL_TARGET.categories }));
const w = process.argv.indexOf("--write"); if (w > 0) writeFileSync(process.argv[w + 1], JSON.stringify({ picks, long: longPick, categories: vec }, null, 1) + "\n");
