// 1.5배 예비 계획 3차(무료·읽기 전용, 생성·DB 없음): 'AB#1 v2 + 5세트 + 부분 3종' 묶음의 사용분을 이중 계산 없이 제외하고 구조 묶음별 1.5배 부족 칸을 센다.
//   npx tsx scripts/ap-generation/reserve-plan-3.ts [--no-strict] [--overlap-replaced]
// 묶음: 풀 6세트(AB#1 v2·AB#2·AB#3·BC#1·BC#2·BC#3) + AB 부분 3종(Non-Calculator 29·Calculator 13·Free-Response 6). 부분 세트 사용분은 게시 사용으로 센다.
// AB#1 v2 로 빠지는 10건은 사용분이 아니라 예비로 복귀(다른 세트에 쓰이지 않는 한).
// --overlap-replaced: v2 추가분과 5세트가 겹친 문항을 5세트 쪽이 다른 예비로 교체했다고 보고 같은 칸의 예비를 그만큼 더 소비한 것으로 센다(보수 가정).
import { readFileSync } from "node:fs";
import { AB_B, BC_B, SK, loadPool, published, type Item } from "./assign-pool";

const strict = !process.argv.includes("--no-strict");
const replaced = process.argv.includes("--overlap-replaced");
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
type K = { mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[] };
const flat = (k: K) => [...k.mcA, ...k.mcB, ...k.frqA, ...k.frqB];
const v1 = published();
const swaps = rd<{ swaps: { removeKey: string; addKey: string }[] }>("data/ap/stock/ab1-v2-swap-plan.json").swaps;
const rem = new Set(swaps.map((s) => s.removeKey));
const v2 = new Set([...flat(v1).filter((k) => !rem.has(k)), ...swaps.map((s) => s.addKey)]);
const five = new Set(rd<{ sets: K[] }>("data/ap/stock/exact-assign-5sets-cons.json").sets.flatMap(flat));
const partial = rd<{ sets: { id: string; keys: K; meta: { unitCounts: Record<string, number>; skillCounts: Record<string, number> } }[] }>("data/ap/stock/assembled/partial-rebuild-ab-plan.json");
const part = new Set(partial.sets.flatMap((s) => flat(s.keys)));
const overlap = [...v2].filter((k) => five.has(k));
const used = new Set([...v2, ...five, ...part]);
const noScreen = process.argv.includes("--no-screen"); // 화면 증거 없는 새 통과분도 재고로 센다(R3 단계 중 남은 부족 계산용)
const { pool } = loadPool({ strictFamilies: strict, requireScreen: !noScreen });
const up = (x: number) => Math.ceil(x - 1e-9);
const inPool = new Set(pool.map((c) => c.key));
const isUsed = (c: Item) => used.has(c.key);
console.log(`# 입력 확인`);
console.log(`- 묶음: 풀 6세트(AB#1 v2·AB#2·AB#3·BC#1·BC#2·BC#3) + AB 부분 3종. v2 문항 ${v2.size}(v1 에서 빠진 ${rem.size}건은 예비 복귀), 5세트 ${five.size}, 부분 ${part.size}, v2·5세트 겹침 ${overlap.length}, 사용 합집합 ${used.size}(재고 안 ${pool.filter(isUsed).length}); 재고(화면 증거) ${pool.length}, 미사용 예비 ${pool.filter((c) => !isUsed(c)).length}.`);
const missing = [...used].filter((k) => !inPool.has(k));
console.log(`- 사용분 중 재고에 없는 키: ${missing.length}건 ${missing.slice(0, 5).join(", ")}`);
console.log(`- 겹침 5건 교체 가정(--overlap-replaced): ${replaced ? "적용(같은 칸 예비 추가 소비)" : "미적용(겹침은 한 번만 사용으로 계산)"}`);
const extra = new Set(replaced ? overlap : []);
const mc = pool.filter((c) => c.kind === "mc");
const fr = pool.filter((c) => c.kind === "frq");
const NF = 6, NAB = 3, NBC = 3;
const pc = partial.sets;
type Row = { name: string; demand: number; sup: Item[] };
const row = (name: string, demand: number, sup: Item[]): Row => ({ name, demand, sup });
const show = (title: string, rows: Row[]) => {
  console.log(`\n## ${title}`);
  console.log("| 칸 | 수요(묶음 사용) | 1.5배 목표 | 총 통과 재고 | 사용 | 미사용 예비 (AB전용/BC전용) | 부족(목표 − 재고) |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of rows) {
    const t = up(r.demand * 1.5);
    const u = r.sup.filter(isUsed).length;
    const ex = r.sup.filter((c) => extra.has(c.key)).length; // 교체 가정으로 추가 소비되는 예비 수(같은 칸)
    const f = r.sup.filter((c) => !isUsed(c));
    const need = Math.max(0, t - (r.sup.length - ex));
    console.log(`| ${r.name} | ${r.demand} | ${t} | ${r.sup.length - ex} | ${u} | ${f.length} (AB ${f.filter((c) => c.subj === "ab").length}/BC ${f.filter((c) => c.subj === "bc").length}) | **${need}** |`);
  }
};
const sumLo = (u: number) => (u <= 8 ? AB_B[u][0] * NAB : 0) + BC_B[u][0] * NBC;
const pu = (u: number) => pc.reduce((a, s) => a + (s.meta.unitCounts[String(u)] ?? 0), 0);
show("구조 묶음(MC)", [
  row("MC 계산기 불가 Part A (29×6 + NC 29)", 29 * NF + 29, mc.filter((c) => c.calc === "not_allowed")),
  row("MC 계산기 필수 Part B (13×6 + C 13)", 13 * NF + 13, mc.filter((c) => c.calc === "required")),
  row("MC 그래프 필수 (세트당 하한 10×6 + 부분 NC3·C2)", 10 * NF + 5, mc.filter((c) => c.graph)),
  row("MC BC 전용 단원 9·10 (하한 12×3)", 12 * NBC, mc.filter((c) => c.unit >= 9)),
]);
show("FRQ", [
  row("FRQ Part A 계산기 (2×6 + 부분 2)", 2 * NF + 2, fr.filter((c) => c.calc === "required")),
  row("FRQ Part B 계산기 불가 (4×6 + 부분 4)", 4 * NF + 4, fr.filter((c) => c.calc !== "required")),
  row("FRQ BC 전용 (2×3)", 2 * NBC, fr.filter((c) => c.native)),
]);
console.log(`FRQ 유형: 재고 ${new Set(fr.map((c) => c.type)).size}종, 미사용 ${new Set(fr.filter((c) => !isUsed(c)).map((c) => c.type)).size}종.`);
show("단원별 MC (수요 = 풀 6세트 하한 합 + 부분 3종 실제 배치)", Array.from({ length: 10 }, (_, i) => i + 1).map((u) => row(`단원 ${u}${u >= 9 ? " (BC 전용)" : ""}`, sumLo(u) + pu(u), mc.filter((c) => c.unit === u))));
show("단원별 MC 계산기 필수 (수요 = 현재 사용 중인 해당 칸 수)", Array.from({ length: 8 }, (_, i) => i + 1).map((u) => { const s = mc.filter((c) => c.unit === u && c.calc === "required"); return row(`단원 ${u} 계산기 필수`, s.filter(isUsed).length, s); }));
show("단원별 MC 그래프 필수 (수요 = 현재 사용 중인 해당 칸 수)", Array.from({ length: 10 }, (_, i) => i + 1).map((u) => { const s = mc.filter((c) => c.unit === u && c.graph); return row(`단원 ${u} 그래프 필수`, s.filter(isUsed).length, s); }));
const skD = (s: number) => SK[s][0] * NF + pc.reduce((a, p) => a + (p.meta.skillCounts[String(s)] ?? 0), 0);
show("스킬별 MC (수요 = 풀 6세트 하한 합 + 부분 MC 실제)", [1, 2, 3].map((s) => row(`스킬 ${s}`, skD(s), mc.filter((c) => c.skill === s))));
console.log(`\n문항군: MC 재고 ${new Set(mc.map((c) => c.fam)).size}군(미사용 ${new Set(mc.filter((c) => !isUsed(c)).map((c) => c.fam)).size}군), 그래프 필수 재고 ${mc.filter((c) => c.graph).length}.`);
