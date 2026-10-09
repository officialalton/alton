// BC 풀 세트 가능성 점검(읽기 전용, 무료, DB 없음): npx tsx scripts/ap-generation/bc-feasibility.ts
// 기존 재고(AB 고유 + BC 고유, 최신 게이트 통과·결함 스캔 0·완전 중복 제외·렌더 통과)만으로 BC 풀 세트(MC 42 = A 29 + B 13, FRQ 6 = A 2 + B 4)를 조립할 수 있는지 탐색한다. 파일을 쓰지 않는다.
import { readFileSync, existsSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
type It = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; calculator: string; itemFamilyId: string; payload: Record<string, unknown>; skillPrimary?: string; duplicateOf?: string | null; archetype?: string };
const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
const bcCur = JSON.parse(readFileSync("data/ap/curriculum-2027/ap_calculus_bc.json", "utf-8")) as ApCurriculumFile;
const scope = new Map(bcCur.units.flatMap((u) => u.topics.map((t) => [t.code, (t as unknown as { scope: string }).scope] as const)));
const files = ["items", "s1a-items", "v1ab-items", "v45ab-items", "bc-topup-items"];
const all = files.flatMap((f) => JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as It[]).filter((i) => (i.apSubjectCode === "ap_calculus_ab" || i.apSubjectCode === "ap_calculus_bc") && i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf);
const abSel = JSON.parse(readFileSync("data/ap/stock/ab-full-set-selection.json", "utf-8")).keys as Record<string, string[]>; const abUsed = new Set(Object.values(abSel).flat());
type C = { key: string; kind: "mc" | "frq"; unit: number; skill: number; calc: string; fam: string; type: string; graph: boolean; bcOnly: boolean; native: boolean; inAbSet: boolean };
const pool: C[] = all.map((i) => { const g = gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }); return { i, g }; }).filter((x) => x.g.status !== "fail").map(({ i, g }) => ({ key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq", unit: Number(i.keywordCode.split(".")[0]), skill: Number((i.skillPrimary ?? "0")[0]), calc: i.calculator, fam: i.itemFamilyId, type: i.kind === "frq_bundle" ? (i.archetype ?? i.keywordCode) : i.keywordCode, graph: g.need === "required" && g.stimKind === "graph", bcOnly: scope.get(i.keywordCode) === "bc_only", native: i.apSubjectCode === "ap_calculus_bc", inAbSet: abUsed.has(i.stockKey) }));
const BOUNDS: Record<number, [number, number]> = { 1: [3, 4], 2: [3, 4], 3: [3, 4], 4: [3, 4], 5: [5, 6], 6: [7, 8], 7: [3, 4], 8: [3, 4], 9: [5, 6], 10: [7, 8] };
const SK: Record<number, [number, number]> = { 1: [21, 29], 2: [7, 12], 3: [5, 8] };
const cnt = <T,>(xs: T[], f: (x: T) => string | number) => { const m = new Map<string | number, number>(); for (const x of xs) m.set(f(x), (m.get(f(x)) ?? 0) + 1); return m; };
const rng = (s: number) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const out: string[] = []; const P = (s = "") => out.push(s);
const mcAll = pool.filter((c) => c.kind === "mc"), frqAll = pool.filter((c) => c.kind === "frq");
for (const excl of [true, false]) {
  const mcp = mcAll.filter((c) => !(excl && c.inAbSet)); const A = mcp.filter((c) => c.calc === "not_allowed"), B = mcp.filter((c) => c.calc === "required");
  const cost = (a: C[], b: C[]) => { const mc = [...a, ...b]; let v = 0; const u = cnt(mc, (c) => c.unit); for (const [k, [lo, hi]] of Object.entries(BOUNDS)) v += Math.max(0, lo - (u.get(+k) ?? 0)) + Math.max(0, (u.get(+k) ?? 0) - hi); const s = cnt(mc, (c) => c.skill); for (const [k, [lo, hi]] of Object.entries(SK)) v += Math.max(0, lo - (s.get(+k) ?? 0)) + Math.max(0, (s.get(+k) ?? 0) - hi); const f = cnt(mc, (c) => c.fam); v += [...f.values()].reduce((x, n) => x + Math.max(0, n - 2), 0) + Math.max(0, 21 - f.size) + Math.max(0, 10 - mc.filter((c) => c.graph).length); return v; };
  let best: { a: C[]; b: C[] } | null = null, bestCost = 1e9;
  for (let at = 0; at < 6 && bestCost > 0; at++) { const r = rng(11 + at * 97); const pick = (p: C[], n: number) => { const q = [...p], o: C[] = []; while (o.length < n && q.length) o.push(q.splice(Math.floor(r() * q.length), 1)[0]); return o; }; const a = pick(A, 29), b = pick(B, 13); let cur = cost(a, b), T = 20;
    for (let t = 0; t < 150000 && cur > 0; t++) { const inA = r() < 0.7, part = inA ? a : b, pl = inA ? A : B, p = Math.floor(r() * part.length), n = pl[Math.floor(r() * pl.length)]; if (part.includes(n)) continue; const old = part[p]; part[p] = n; const c = cost(a, b); if (c <= cur || r() < Math.exp((cur - c) / Math.max(T, 0.05))) cur = c; else part[p] = old; T *= 0.99995; }
    if (cur < bestCost) { bestCost = cur; best = { a: [...a], b: [...b] }; } }
  P(`### MC 조립 탐색(AB 풀 세트 항목 ${excl ? "제외 = 풀끼리 겹침 0" : "재사용 허용"}): 위반 점수 ${bestCost} ${bestCost === 0 ? "(모든 제약 통과)" : "(해 못 찾음)"}`);
  if (best) { const mc = [...best.a, ...best.b]; P(`- 단원: ${Object.keys(BOUNDS).map((k) => `${k}:${cnt(mc, (c) => c.unit).get(+k) ?? 0}`).join(" ")} / 스킬: ${[1, 2, 3].map((k) => `${k}:${cnt(mc, (c) => c.skill).get(k) ?? 0}`).join(" ")} / 문항군 ${new Set(mc.map((c) => c.fam)).size} / 그래프필수 ${mc.filter((c) => c.graph).length} / BC 고유 문항 ${mc.filter((c) => c.native).length} / AB 연습·풀 공유 출처 ${mc.filter((c) => !c.native).length} / BC 전용 토픽 ${mc.filter((c) => c.bcOnly).length}`); }
}
// FRQ: 서로 다른 유형 6개, BC 전용 2(급수·매개변수) + 공유 4
const fa = frqAll.filter((c) => !c.inAbSet); const fA = fa.filter((c) => c.calc === "required"), fB = fa.filter((c) => c.calc !== "required");
const bcA = fA.filter((c) => c.native), bcB = fB.filter((c) => c.native);
P(`### FRQ 재고: 공유(AB) ${frqAll.filter((c) => !c.native).length} / BC 고유 ${frqAll.filter((c) => c.native).length}; AB 풀 세트 제외 후 계산기 ${fA.length} / 불가·무관 ${fB.length}; BC 고유 계산기 ${bcA.length}(유형 ${new Set(bcA.map((c) => c.type)).size}, 문항군 ${new Set(bcA.map((c) => c.fam)).size}) / 불가 ${bcB.length}(유형 ${new Set(bcB.map((c) => c.type)).size}, 문항군 ${new Set(bcB.map((c) => c.fam)).size})`);
const sharedA = fA.filter((c) => !c.native), sharedB = fB.filter((c) => !c.native);
P(`- 공유 FRQ 계산기 유형: ${[...cnt(sharedA, (c) => c.type)].map(([k, v]) => `${k}×${v}`).join(", ")}; 불가 유형: ${[...cnt(sharedB, (c) => c.type)].map(([k, v]) => `${k}×${v}`).join(", ")}`);
// 풀 단위 표(셀)
const tab = (xs: C[], label: string) => { P(`### ${label}`); P("| 단원 | 필요(MC) | 재고 합 | 계산기 불가 | 계산기 필수 | 스킬1/2/3 | 문항군 | 그래프필수 | BC 고유 | AB 풀 세트 사용분 |"); P("|---|---|---|---|---|---|---|---|---|---|"); for (const u of Object.keys(BOUNDS).map(Number)) { const x = xs.filter((c) => c.unit === u); const s = cnt(x, (c) => c.skill); P(`| ${u} | ${BOUNDS[u][0]}-${BOUNDS[u][1]} | ${x.length} | ${x.filter((c) => c.calc === "not_allowed").length} | ${x.filter((c) => c.calc === "required").length} | ${s.get(1) ?? 0}/${s.get(2) ?? 0}/${s.get(3) ?? 0} | ${new Set(x.map((c) => c.fam)).size} | ${x.filter((c) => c.graph).length} | ${x.filter((c) => c.native).length} | ${x.filter((c) => c.inAbSet).length} |`); } };
tab(mcAll, "MC 단원별 재고(자동 통과·결함 0·중복 제외·렌더 통과)");
P(`### BC 고유 MC 표현: 자료(그래프/표) 포함 ${mcAll.filter((c) => c.native && (c.graph)).length} (그래프 필수) — BC 고유 MC ${mcAll.filter((c) => c.native).length}건 중 자료 없는 텍스트형 ${mcAll.filter((c) => c.native).length}`);
const bcNative = mcAll.filter((c) => c.native); P(`BC 고유 MC 스킬: ${[1, 2, 3].map((k) => `${k}:${bcNative.filter((c) => c.skill === k).length}`).join(" ")}; 단원 9·10 스킬: ${[1, 2, 3].map((k) => `${k}:${bcNative.filter((c) => c.unit >= 9 && c.skill === k).length}`).join(" ")}; BC 전용 토픽 문항군 ${new Set(bcNative.map((c) => c.fam)).size}`);
console.log(out.join("\n")); void existsSync;
