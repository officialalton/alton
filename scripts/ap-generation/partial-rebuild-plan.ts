// AB 부분 연습 세트 3종(Non-Calculator / Calculator / Free-Response) 재구성 계획 — 무료·읽기 전용·DB 없음(2026-10-12 오너: 풀 모의고사와 겹침 0).
// 입력 재고 = 화면 증거 보유 + "DB 준비"(비프로덕션 검증 완료로 간주: pass-keys 또는 형제 21건) 항목. 제외 = 풀 모의고사 6세트의 모든 문항:
//   AB#1(게시본 v1 에서 v2 가 빼는 10건은 제외하지 않음, v2 가 넣는 10건은 제외), 초안 5세트(AB2·AB3·BC1·BC2·BC3 = exact-assign-5sets-cons.json).
// 세 세트를 각각 정수계획(lib/ap-exam/ilp.ts)으로 푼다: 정확한 문항 수·계산기 파트·MC 문항군 상한(기본 1, 불가능할 때만 2)·FRQ 서로 다른 유형·문항군,
// 목적 = (이전 부분 세트에 있던 문항 재사용·AB#1 v1 에서 빠지는 문항 사용 최소) + 단원·스킬 비중 편차 + 그래프 MC 목표 미달 최소.
//   STRUCTURE_GROUPS_FILE=data/ap/stock/structure-groups.conservative.json npx tsx scripts/ap-generation/partial-rebuild-plan.ts [--write data/ap/stock/assembled/partial-rebuild-ab-plan.json] [--time-ms 120000]
import { mkdirSync, writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { planPartialDraftSet, type PartialPlanFile, type PartialPlanSet } from "../../lib/ap-admin/partial-draft";
import { partialSetName, type ApPartialId } from "../../lib/ap-exam/layouts";
import { AB_B, SK, loadPool, type Item } from "./assign-pool";
import { dbReadyKeys } from "./ab1-new-version-plan";
import { fullExamKeys, oldPartialKeys } from "../../lib/ap-admin/reserved-keys";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const SUBJECT = "ap_calculus_ab";
const TIME = Number(arg("--time-ms", "120000"));
type G = "mcA" | "mcB" | "frqA" | "frqB";

const idx = (cand: Item[], f: (c: Item) => boolean) => cand.map((c, i) => [i, f(c)] as const).filter(([, b]) => b).map(([i]) => [i, 1] as [number, number]);
/** 정수 목표를 비율대로 나눈다(최대잔여법). */
function apportion(total: number, w: number[]): number[] { const s = w.reduce((a, b) => a + b, 0); const raw = w.map((x) => (total * x) / s); const fl = raw.map(Math.floor); let rest = total - fl.reduce((a, b) => a + b, 0); raw.map((r, i) => [r - fl[i], i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest-- > 0) fl[i]++; }); return fl; }

type McSpec = { count: number; calc: "not_allowed" | "required"; graphTarget: number };
export function solveMcSet(items: Item[], spec: McSpec, o: { cap: number; penalty: (c: Item) => number; timeMs: number }) {
  const cand = items.filter((c) => c.kind === "mc" && c.calc === spec.calc); const nx = cand.length;
  const units = Object.keys(AB_B).map(Number); const unitT = apportion(spec.count, units.map((u) => (AB_B[u][0] + AB_B[u][1]) / 2));
  const skills = Object.keys(SK).map(Number); const skillT = apportion(spec.count, skills.map((k) => (SK[k][0] + SK[k][1]) / 2));
  // 변수: x(nx) | 단원 편차 +/- (2*U) | 스킬 편차 +/- (2*S) | 그래프 미달(1)
  const U = units.length, S = skills.length; const n = nx + 2 * U + 2 * S + 1;
  const obj = new Array<number>(n).fill(0); cand.forEach((c, i) => { obj[i] = o.penalty(c); });
  for (let j = 0; j < 2 * U; j++) obj[nx + j] = 3; for (let j = 0; j < 2 * S; j++) obj[nx + 2 * U + j] = 2; obj[n - 1] = 4;
  const cons: Cons[] = [];
  cons.push({ coef: cand.map((_, i) => [i, 1] as [number, number]), sense: "=", rhs: spec.count });
  cand.forEach((_, i) => cons.push({ coef: [[i, 1]], sense: "<=", rhs: 1 }));
  units.forEach((u, k) => cons.push({ coef: [...idx(cand, (c) => c.unit === u), [nx + 2 * k, 1], [nx + 2 * k + 1, -1]], sense: "=", rhs: unitT[k] })); // 개수 + 부족(+) − 초과(−) = 목표
  skills.forEach((s, k) => cons.push({ coef: [...idx(cand, (c) => c.skill === s), [nx + 2 * U + 2 * k, 1], [nx + 2 * U + 2 * k + 1, -1]], sense: "=", rhs: skillT[k] }));
  cons.push({ coef: [...idx(cand, (c) => c.graph), [n - 1, 1]], sense: ">=", rhs: spec.graphTarget });
  const fam = new Map<string, [number, number][]>(); cand.forEach((c, i) => (fam.get(c.fam) ?? fam.set(c.fam, []).get(c.fam)!).push([i, 1]));
  for (const co of fam.values()) if (co.length > o.cap) cons.push({ coef: co, sense: "<=", rhs: o.cap });
  const binary = new Array<boolean>(n).fill(false); for (let i = 0; i < nx; i++) binary[i] = true;
  const r = solveMip({ n, obj, cons, integer: new Array(n).fill(true), binary }, { timeMs: o.timeMs });
  return { status: r.status, obj: r.obj, bestBound: r.bestBound, candidates: nx, chosen: r.x.length ? cand.filter((_, i) => r.x[i] > 0.5) : null, unitTarget: Object.fromEntries(units.map((u, k) => [u, unitT[k]])) };
}
export function solveFrqSet(items: Item[], o: { penalty: (c: Item) => number; timeMs: number; a: number; b: number }) {
  const cand = items.filter((c) => c.kind === "frq" && !c.native); const nx = cand.length; const units = [...new Set(cand.map((c) => c.unit))].sort((x, y) => x - y);
  const n = nx + units.length; const obj = new Array<number>(n).fill(0); cand.forEach((c, i) => { obj[i] = o.penalty(c); }); units.forEach((_, k) => { obj[nx + k] = 2; });
  const cons: Cons[] = [];
  cons.push({ coef: idx(cand, (c) => c.calc === "required"), sense: "=", rhs: o.a }); cons.push({ coef: idx(cand, (c) => c.calc !== "required"), sense: "=", rhs: o.b });
  cand.forEach((_, i) => cons.push({ coef: [[i, 1]], sense: "<=", rhs: 1 }));
  for (const key of ["type", "fam"] as const) { const g = new Map<string, [number, number][]>(); cand.forEach((c, i) => (g.get(c[key]) ?? g.set(c[key], []).get(c[key])!).push([i, 1])); for (const co of g.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 }); }
  units.forEach((u, k) => cons.push({ coef: [...idx(cand, (c) => c.unit === u), [nx + k, -1]], sense: "<=", rhs: 1 })); // 같은 단원 2개째부터 편차
  const binary = new Array<boolean>(n).fill(false); for (let i = 0; i < nx; i++) binary[i] = true;
  const r = solveMip({ n, obj, cons, integer: new Array(n).fill(true), binary }, { timeMs: o.timeMs });
  return { status: r.status, obj: r.obj, bestBound: r.bestBound, candidates: nx, chosen: r.x.length ? cand.filter((_, i) => r.x[i] > 0.5) : null };
}

function main() {
  const full = fullExamKeys(); const oldP = oldPartialKeys(); const removed = new Set(full.removedByV2);
  const ready = dbReadyKeys(); const { all } = loadPool({ strictFamilies: true });
  const usable = all.filter((c) => c.screen && (!c.pending || c.pending === "sib21" || ready.has(c.key)));
  // 기본: AB#1 v1 에서 v2 가 빼는 10건도 쓰지 않는다(게시 순서와 무관하게 v1·v2 모두와 겹침 0). --allow-v1-removed 면 예비로 허용(v2 공개 뒤 보관된 v1 과는 겹치지 않음).
  const allowRemoved = process.argv.includes("--allow-v1-removed");
  const free = usable.filter((c) => c.subj === "ab" && !c.bcOnly && !full.all.has(c.key) && (allowRemoved || !removed.has(c.key)));
  const penalty = (c: Item) => (oldP.has(c.key) ? 100 : 0) + (removed.has(c.key) ? 5 : 0);
  console.log(`# AB 부분 세트 재구성 — 재고(DB 준비) ${usable.length}건, 풀 모의고사 6세트 사용·예약 ${full.all.size}건 제외 → 예비 ${free.length}건`);
  const cell = (k: string, c: string) => free.filter((x) => x.kind === k && (c === "frqB" ? x.calc !== "required" : x.calc === c));
  console.log(`예비: MC 계산기불가 ${cell("mc", "not_allowed").length}(문항군 ${new Set(cell("mc", "not_allowed").map((x) => x.fam)).size}) · MC 계산기필수 ${cell("mc", "required").length}(문항군 ${new Set(cell("mc", "required").map((x) => x.fam)).size}) · FRQ 계산기 ${cell("frq", "required").length} · FRQ 불가 ${cell("frq", "frqB").length}`);
  const out: { set: PartialPlanSet; meta: Record<string, unknown> }[] = [];
  const fail: string[] = [];
  for (const [id, partial, spec] of [["PNC", "noncalc_mc", { count: 29, calc: "not_allowed", graphTarget: 3 }], ["PC", "calc_mc", { count: 13, calc: "required", graphTarget: 2 }]] as [string, ApPartialId, McSpec][]) {
    let cap = 1; let r = solveMcSet(free, spec, { cap, penalty, timeMs: TIME });
    if (!r.chosen) { cap = 2; r = solveMcSet(free, spec, { cap, penalty, timeMs: TIME }); }
    console.log(`${partialSetName(SUBJECT, partial)}: ${r.status} 문항군 상한 ${cap} 목적값 ${r.obj} (하한 ${r.bestBound}, 후보 ${r.candidates})`);
    if (!r.chosen) { fail.push(`${id}: MC 배정 불가 (상한 ${cap}까지 시도, 후보 ${r.candidates})`); continue; }
    const g: G = spec.calc === "not_allowed" ? "mcA" : "mcB";
    out.push({ set: { id, partial, name: partialSetName(SUBJECT, partial), keys: { mcA: [], mcB: [], frqA: [], frqB: [], [g]: r.chosen.map((c) => c.key) } }, meta: { status: r.status, cap, objective: r.obj, bestBound: r.bestBound, unitTarget: r.unitTarget } });
  }
  const fr = solveFrqSet(free, { penalty, timeMs: TIME, a: 2, b: 4 });
  console.log(`${partialSetName(SUBJECT, "frq")}: ${fr.status} 목적값 ${fr.obj} (후보 ${fr.candidates})`);
  if (!fr.chosen) fail.push(`PF: 공식 FRQ 6(Part A 2 + Part B 4) 배정 불가 (후보 ${fr.candidates})`);
  else out.push({ set: { id: "PF", partial: "frq", name: partialSetName(SUBJECT, "frq"), keys: { mcA: [], mcB: [], frqA: fr.chosen.filter((c) => c.calc === "required").map((c) => c.key), frqB: fr.chosen.filter((c) => c.calc !== "required").map((c) => c.key) } }, meta: { status: fr.status, objective: fr.obj } });
  if (fail.length) { console.log(`불가능: ${fail.join("; ")}`); process.exitCode = 1; }

  // 독립 검증(배정기와 별개 코드): 부분 세트 검증 + 풀 6세트·세트끼리 겹침 행렬
  const byKey = new Map(all.map((c) => [c.key, c])); const reserved = new Map([...full.all].map((k) => [k, "풀 모의고사 사용·예약"] as const));
  const keysOf = (s: PartialPlanSet) => [...s.keys.mcA, ...s.keys.mcB, ...s.keys.frqA, ...s.keys.frqB];
  const fakeRow = (k: string) => ({ candidate_key: k, kind: byKey.get(k)?.kind ?? "mc", keyword_code: `${byKey.get(k)?.unit ?? 1}.1`, difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true, ap_candidate_problems: [{ item_index: 0, problem_id: k, problem_version_id: `${k}#v` }] });
  const fullSets: Record<string, string[]> = { "AB#1 v1(게시본)": full.ab1v1, "AB#1 v2(계획)": full.ab1v2, ...Object.fromEntries(Object.entries(full.draftSets).map(([k, v]) => [k === "AB2" || k === "AB3" ? `AB#${k.slice(2)} 초안` : `BC#${k.slice(2)} 초안`, v])) };
  const problems: string[] = [];
  for (const o of out) {
    const others: { id: string; name: string; status: string; problemIds: string[]; candidateKeys: string[] }[] = out.filter((x) => x.set.id !== o.set.id).map((x) => ({ id: x.set.id, name: x.set.name, status: "draft", problemIds: keysOf(x.set), candidateKeys: keysOf(x.set) }));
    const p = planPartialDraftSet({ set: o.set, subject: SUBJECT, pool: keysOf(o.set).map(fakeRow) as never, existingSets: others, reservedKeys: reserved, stock: loadPool({ strictFamilies: true }).all });
    problems.push(...p.problems.map((x) => `${o.set.id}: ${x}`));
    const items = keysOf(o.set).map((k) => byKey.get(k)!);
    o.meta = { ...o.meta, units: p.units, graphMc: p.stats.graphMc, doubledFamilies: p.stats.doubledFamilies, unitCounts: Object.fromEntries(p.units.map((u) => [u, items.filter((c) => String(c.unit) === u).length])), skillCounts: Object.fromEntries([1, 2, 3].map((k) => [k, items.filter((c) => c.kind === "mc" && c.skill === k).length])), oldPartialReused: items.filter((c) => oldP.has(c.key)).length, fromAb1V1Removed: items.filter((c) => removed.has(c.key)).length };
    console.log(`- ${o.set.name}: ${keysOf(o.set).length}문항, 다루는 단원 ${p.units.join(",")}, 그래프 MC ${p.stats.graphMc}, 문항군 2개 이상 사용 ${p.stats.doubledFamilies}, 이전 부분 세트 문항 재사용 ${(o.meta as { oldPartialReused: number }).oldPartialReused}, AB#1 v1 에서 빠지는 문항 사용 ${(o.meta as { fromAb1V1Removed: number }).fromAb1V1Removed}`);
  }
  console.log("\n## 겹침 행렬(동일 문항 수; 행 = 새 부분 세트)");
  const cols = { ...fullSets, ...Object.fromEntries(out.map((o) => [`새 ${o.set.id}`, keysOf(o.set)])) };
  console.log(["세트", ...Object.keys(cols)].join(" | "));
  const matrix: Record<string, Record<string, number>> = {};
  for (const o of out) { const mine = new Set(keysOf(o.set)); matrix[o.set.id] = Object.fromEntries(Object.entries(cols).map(([n, ks]) => [n, ks.filter((k) => mine.has(k)).length])); matrix[o.set.id][`새 ${o.set.id}`] = 0; console.log([o.set.id, ...Object.keys(cols).map((n) => (n === `새 ${o.set.id}` ? "-" : matrix[o.set.id][n]))].join(" | ")); }
  const bad = Object.values(matrix).some((r) => Object.entries(r).some(([n, v]) => v > 0 && !(allowRemoved && n.startsWith("AB#1 v1"))));
  const used = new Set(out.flatMap((o) => keysOf(o.set))); const left = free.filter((c) => !used.has(c.key));
  console.log(`\n## 재구성 뒤 남는 예비(AB 전용, 초안 5세트 교체 여유): MC 계산기불가 ${left.filter((c) => c.kind === "mc" && c.calc === "not_allowed").length}(문항군 ${new Set(left.filter((c) => c.kind === "mc" && c.calc === "not_allowed").map((c) => c.fam)).size}, 그래프 ${left.filter((c) => c.kind === "mc" && c.calc === "not_allowed" && c.graph).length}) · MC 계산기필수 ${left.filter((c) => c.kind === "mc" && c.calc === "required").length}(문항군 ${new Set(left.filter((c) => c.kind === "mc" && c.calc === "required").map((c) => c.fam)).size}, 그래프 ${left.filter((c) => c.kind === "mc" && c.calc === "required" && c.graph).length}) · FRQ 계산기 ${left.filter((c) => c.kind === "frq" && c.calc === "required").length} · FRQ 불가 ${left.filter((c) => c.kind === "frq" && c.calc !== "required").length}`);
  console.log(`\n독립 검증 위반: ${problems.length ? problems.join("; ") : "0"} / 겹침 0: ${bad ? "위반" : "통과"}`);
  const w = arg("--write");
  if (w && (fail.length || problems.length || bad)) console.log("불가능하거나 검증 실패 — 계획 파일을 쓰지 않습니다.");
  else if (w) {
    if (!/data\/ap\/stock\/assembled\/partial-rebuild-[A-Za-z0-9.-]+\.json$/.test(w)) throw new Error("계획 파일 경로는 data/ap/stock/assembled/partial-rebuild-*.json 이어야 합니다.");
    mkdirSync("data/ap/stock/assembled", { recursive: true });
    const file: PartialPlanFile & Record<string, unknown> = { kind: "ap_partial_rebuild_plan", subject: SUBJECT, generatedBy: "scripts/ap-generation/partial-rebuild-plan.ts", reserveFree: free.length, excludedFullExamKeys: full.all.size, overlapMatrix: matrix, sets: out.map((o) => ({ ...o.set, meta: o.meta })) as never };
    writeFileSync(w, JSON.stringify(file, null, 1) + "\n"); console.log(`계획 저장: ${w}`);
  }
}
if (process.argv[1]?.endsWith("partial-rebuild-plan.ts")) main();
