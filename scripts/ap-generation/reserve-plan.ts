// 1.5배 예비 계획(무료·읽기 전용): 품질 통과·고유 재고(후보 수 아님)를 게시·예약 항목 제외로 세어 "세트 필수 부족"과 "1.5배 예비 부족"을 따로 낸다.
//   npx tsx scripts/ap-generation/reserve-plan.ts [--strict-families]
// 필수 수요 = AB#1 게시본을 뺀 5세트(AB#2·#3, BC#1~#3). 1.5배 목표 = ceil(1.5 × 필수 수요). 재고 = 자동 통과·결함 0·완전 중복 제외·렌더 게이트 통과·화면 증거 보유(신규·형제 91건은 비프로덕션 검증 대기로 따로 표시).
import { AB_B, BC_B, loadPool, published } from "./assign-pool";

const strict = process.argv.includes("--strict-families");
const pub = published(); const pubKeys = new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB]);
const { pool } = loadPool({ strictFamilies: strict });
const free = pool.filter((c) => !pubKeys.has(c.key)); const mc = free.filter((c) => c.kind === "mc"), fr = free.filter((c) => c.kind === "frq");
const nAB = 2, nBC = 3; const up = (x: number) => Math.ceil(x - 1e-9);
const rows: [string, number, number, number][] = []; // 묶음, 필수 수요, 재고, 대기 포함 수
const add = (name: string, req: number, items: { pending: string }[]) => rows.push([name, req, items.length, items.filter((c) => c.pending).length]);
add("MC 계산기 불가(Part A)", 29 * (nAB + nBC), mc.filter((c) => c.calc === "not_allowed"));
add("MC 계산기 필수(Part B)", 13 * (nAB + nBC), mc.filter((c) => c.calc === "required"));
add("MC 그래프 필수(세트당 하한 10)", 10 * (nAB + nBC), mc.filter((c) => c.graph));
add("MC BC 전용 단원 9·10(하한 9:5·10:7)", (5 + 7) * nBC, mc.filter((c) => c.unit >= 9));
add("FRQ Part A(계산기)", 2 * (nAB + nBC), fr.filter((c) => c.calc === "required"));
add("FRQ Part B(계산기 불가)", 4 * (nAB + nBC), fr.filter((c) => c.calc !== "required"));
add("FRQ BC 전용(세트당 ≥2)", 2 * nBC, fr.filter((c) => c.native));
console.log(`# 1.5배 예비 계획 (${strict ? "구조 문항군 엄격 기준" : "기본 문항군 기준"}) — 재고는 게시 AB#1 48건 제외, 화면 증거 보유 항목`);
console.log("| 묶음 | 필수 수요(5세트) | 통과·고유 재고 | (검증 대기 포함) | 세트 필수 부족(단순 총량) | 1.5배 목표 | 1.5배까지 부족(총) | 그중 예비분 |");
console.log("|---|---|---|---|---|---|---|---|");
for (const [n, req, st, pend] of rows) { const tgt = up(req * 1.5); const sf = Math.max(0, req - st), tf = Math.max(0, tgt - st); console.log(`| ${n} | ${req} | ${st} | ${pend} | ${sf} | ${tgt} | ${tf} | ${tf - sf} |`); }
// 단원별(하한 합) — 대체가 어려운 얇은 칸 찾기
console.log("\n| 단원 | 필수 하한(5세트) | 상한 | 재고 총 | 계산기 불가/필수 | 그래프 필수 | 1.5배 목표(하한 기준) | 목표까지 부족 | 칸 구분 |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (let u = 1; u <= 10; u++) {
  const lo = (u <= 8 ? AB_B[u][0] * nAB : 0) + BC_B[u][0] * nBC, hi = (u <= 8 ? AB_B[u][1] * nAB : 0) + BC_B[u][1] * nBC; const x = mc.filter((c) => c.unit === u);
  const tgt = up(lo * 1.5); console.log(`| ${u} | ${lo} | ${hi} | ${x.length} | ${x.filter((c) => c.calc === "not_allowed").length}/${x.filter((c) => c.calc === "required").length} | ${x.filter((c) => c.graph).length} | ${tgt} | ${Math.max(0, tgt - x.length)} | ${u >= 9 ? "BC 전용" : "AB·BC 공유"} |`);
}
console.log(`\n구조 문항군(군집) 수: MC 재고 ${new Set(mc.map((c) => c.fam)).size}군집 / ${mc.length}문항, 그래프 필수 ${new Set(mc.filter((c) => c.graph).map((c) => c.fam)).size}군집 / ${mc.filter((c) => c.graph).length}문항.`);
console.log(`품질 통과 FRQ 유형: ${new Set(fr.map((c) => c.type)).size}종 / ${fr.length}건`);
