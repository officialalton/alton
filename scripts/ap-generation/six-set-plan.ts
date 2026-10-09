// AB 3 + BC 3 풀 모의고사(6세트) 재고 분배·부족 계획(읽기 전용, 무료, DB 없음, 디스크 무변경).
//   npx tsx scripts/ap-generation/six-set-plan.ts [--floor 10] [--write <json경로>]
// 방식: AB#1 = 게시본 대비 최소 교체(그래프 필수 하한 9, 오너 승인) → 나머지 5세트는 남은 재고에서 고정 시드 담금질로 동시 분배.
// 재고가 모자라면 "가상 문항"(단원·계산기·스킬·그래프 칸 지정, 칸마다 무제한)을 최소 개수로 써서 부족을 칸별로 센다(휴리스틱 상한, 불가능 증명 아님).
import { readFileSync, writeFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { clusterLookAlikes } from "../../lib/ap-exam/look-alike";
import { selectMc, type Cand } from "../../lib/ap-exam/ab-select";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const FLOOR = Number(arg("--floor", "10")); const AB1_FLOOR = 9;
type Raw = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation: string; keywordCode: string; calculator: string; itemFamilyId: string; payload: Record<string, unknown>; skillPrimary?: string; duplicateOf?: string | null; archetype?: string };
type It = { key: string; kind: "mc" | "frq"; subj: "ab" | "bc"; unit: number; skill: number; calc: "required" | "not_allowed" | "na"; fam: string; type: string; graph: boolean; native: boolean; bcOnly: boolean; virtual: boolean };
const scan = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
const bcCur = JSON.parse(readFileSync("data/ap/curriculum-2027/ap_calculus_bc.json", "utf-8")) as ApCurriculumFile;
const scope = new Map(bcCur.units.flatMap((u) => u.topics.map((t) => [t.code, (t as unknown as { scope: string }).scope] as const)));
const raws = ["items", "s1a-items", "v1ab-items", "v45ab-items", "bc-topup-items", "graph-s1-items", "graph-s2a-items", "graph-s2b-items", "graph-s3a-items", "graph-s3b-items", "graph-s3c-items", "graph-s3d-items", "graph-s3e-items", "graph-s3f-items", "graph-s3g-items"].flatMap((f) => JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as Raw[]).filter((i) => (i.apSubjectCode === "ap_calculus_ab" || i.apSubjectCode === "ap_calculus_bc") && i.validation === "auto_passed" && !scan.has(i.stockKey) && !i.duplicateOf);
const seen = new Set<string>(); const uniq = raws.filter((r) => (seen.has(r.stockKey) ? false : (seen.add(r.stockKey), true)));
const gated = uniq.map((i) => ({ i, g: gateCandidate({ stockKey: i.stockKey, candidateKey: i.stockKey, apSubjectCode: i.apSubjectCode, kind: i.kind, payload: i.payload }) })).filter((x) => x.g.status !== "fail");
const P = (r: Raw) => r.payload as { archetype?: string; stem?: string; stimulus?: { kind?: string }; blueprint?: { student_thinking?: string[] } };
const mcRaw = gated.filter((x) => x.i.kind === "mc");
const cl = clusterLookAlikes(mcRaw.map(({ i }) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: P(i).archetype, topic: i.keywordCode, stimKind: P(i).stimulus?.kind ?? "none", stem: P(i).stem ?? "", thinking: P(i).blueprint?.student_thinking })));
const pool: It[] = gated.map(({ i, g }) => ({ key: i.stockKey, kind: i.kind === "mc" ? "mc" : "frq", subj: i.apSubjectCode === "ap_calculus_bc" ? "bc" : "ab", unit: Number(i.keywordCode.split(".")[0]), skill: Number((i.skillPrimary ?? "0")[0]), calc: i.calculator as It["calc"], fam: i.kind === "mc" ? (cl.effectiveFamily.get(i.stockKey) ?? i.itemFamilyId) : i.itemFamilyId, type: i.kind === "frq_bundle" ? (i.archetype ?? i.keywordCode) : i.keywordCode, graph: g.need === "required" && g.stimKind === "graph", native: i.apSubjectCode === "ap_calculus_bc", bcOnly: scope.get(i.keywordCode) === "bc_only", virtual: false }));
const REAL_MC = pool.filter((c) => c.kind === "mc"), REAL_FRQ = pool.filter((c) => c.kind === "frq");

// ---------- 규격 ----------
const AB_B: Record<number, [number, number]> = { 1: [5, 6], 2: [5, 6], 3: [3, 4], 4: [5, 6], 5: [7, 8], 6: [7, 8], 7: [3, 4], 8: [5, 6] };
const BC_B: Record<number, [number, number]> = { 1: [3, 4], 2: [3, 4], 3: [3, 4], 4: [3, 4], 5: [5, 6], 6: [7, 8], 7: [3, 4], 8: [3, 4], 9: [5, 6], 10: [7, 8] };
const SK: Record<number, [number, number]> = { 1: [21, 29], 2: [7, 12], 3: [5, 8] };
type Spec = { id: string; subj: "ab" | "bc"; floor: number };
const cnt = <T,>(xs: T[], f: (x: T) => string | number) => { const m = new Map<string | number, number>(); for (const x of xs) m.set(f(x), (m.get(f(x)) ?? 0) + 1); return m; };
const rng = (s: number) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

// ---------- 가상 문항(부족 칸 계수용) ----------
let vid = 0; const mkV = (subj: "ab" | "bc", unit: number, calc: It["calc"], skill: number, graph: boolean): It => ({ key: `V#${++vid}:u${unit}:${calc === "required" ? "C" : "N"}:s${skill}:${graph ? "G" : "t"}`, kind: "mc", subj, unit, skill, calc, fam: `V#${vid}`, type: `V${vid}`, graph, native: subj === "bc", bcOnly: unit >= 9, virtual: true });

// ---------- AB#1: 게시본 대비 최소 교체(그래프 하한 9) ----------
const published = (JSON.parse(readFileSync("data/ap/stock/ab-full-set-selection.json", "utf-8")) as { keys: Record<string, string[]> }).keys;
const byKeyPool = new Map(pool.map((c) => [c.key, c]));
const toCand = (c: It): Cand => ({ key: c.key, kind: c.kind, unit: c.unit, skillCat: c.skill, calc: c.calc, family: c.fam, type: c.type, graphRequired: c.graph, screenVerified: true, renderOk: true, fullMockUses: 0, practiceUses: 0 });
const abMcCand = REAL_MC.filter((c) => c.subj === "ab").map(toCand); const byC = new Map(abMcCand.map((c) => [c.key, c]));
const prevSel = { mcA: published.mcA.map((k) => byC.get(k)!).filter(Boolean), mcB: published.mcB.map((k) => byC.get(k)!).filter(Boolean) };
// 오너 승인 AB#1 최소 교체안(docs/ap/family-cap-1-report.md 표, 10건): 군집당 앞 번호 유지, 나머지 교체. selectMc 재탐색은 교체가 31건으로 늘어 쓰지 않는다.
const SWAP: [string, string][] = [["v45ab-final:v4-ab:ap_calculus_ab-m02-k2", "run1:ap_calculus_ab-c023-k3"], ["s1a-final:ap_calculus_ab-m13-k0", "s1a-final:ap_calculus_ab-m04-k1"], ["run2:ap_calculus_ab-m12-k2", "run2:ap_calculus_ab-m08-k3"], ["run2:ap_calculus_ab-m21-k2", "run2:ap_calculus_ab-m25-k0"], ["run2:ap_calculus_ab-m07-k3", "run1:ap_calculus_ab-c009-k0"], ["run2:ap_calculus_ab-m15-k0", "run2:ap_calculus_ab-m23-k1"], ["v1ab-final:ap_calculus_ab-m03-k0", "run1:ap_calculus_ab-c011-k2"], ["v1ab-final:ap_calculus_ab-m02-k1", "run1:ap_calculus_ab-c017-k3"], ["v1ab-final:ap_calculus_ab-m01-k4", "run2:ap_calculus_ab-m11-k0"], ["run2:ap_calculus_ab-m29-k0", "run2:ap_calculus_ab-m30-k1"]];
const ab1 = { mcA: prevSel.mcA.map((c) => byC.get(SWAP.find(([o]) => o === c.key)?.[1] ?? c.key)!), mcB: prevSel.mcB.map((c) => byC.get(SWAP.find(([o]) => o === c.key)?.[1] ?? c.key)!) };
const ab1Frq = [...published.frqA, ...published.frqB].map((k) => byKeyPool.get(k)!);
const pubMc = new Set([...published.mcA, ...published.mcB]);
const ab1Keys = ab1 ? [...ab1.mcA, ...ab1.mcB].map((c) => c.key) : [...pubMc];
const swaps = ab1 ? { removed: [...pubMc].filter((k) => !ab1Keys.includes(k)), added: ab1Keys.filter((k) => !pubMc.has(k)) } : null;
const ab1Items = ab1Keys.map((k) => byKeyPool.get(k)!);

// ---------- MC 동시 분배(담금질) ----------
type State = { spec: Spec; a: It[]; b: It[] };
function setCost(s: State): number {
  const mc = [...s.a, ...s.b]; const B = s.spec.subj === "ab" ? AB_B : BC_B; let v = 0;
  const u = cnt(mc, (c) => c.unit); for (const [k, [lo, hi]] of Object.entries(B)) v += Math.max(0, lo - (u.get(+k) ?? 0)) + Math.max(0, (u.get(+k) ?? 0) - hi);
  const sk = cnt(mc, (c) => c.skill); for (const [k, [lo, hi]] of Object.entries(SK)) v += Math.max(0, lo - (sk.get(+k) ?? 0)) + Math.max(0, (sk.get(+k) ?? 0) - hi);
  const f = cnt(mc, (c) => c.fam); for (const n of f.values()) v += Math.max(0, n - 1);
  v += Math.max(0, s.spec.floor - mc.filter((c) => c.graph).length);
  return v * 20 + mc.filter((c) => c.virtual).length * 4;
}
function solveMc(specs: Spec[], fixedUsed: Set<string>, seed: number, iters: number) {
  const eligible = (s: Spec) => REAL_MC.filter((c) => !fixedUsed.has(c.key) && (s.subj === "bc" || c.subj === "ab"));
  const poolBy = specs.map((s) => ({ A: eligible(s).filter((c) => c.calc === "not_allowed"), B: eligible(s).filter((c) => c.calc === "required") }));
  const r = rng(seed); const owner = new Map<string, number>();
  const virtualFor = (si: number, part: "A" | "B") => { const s = specs[si]; const units = s.subj === "ab" ? 8 : 10; return mkV(s.subj, 1 + Math.floor(r() * units), part === "A" ? "not_allowed" : "required", 1 + Math.floor(r() * 3), r() < 0.5); };
  const st: State[] = specs.map((spec, si) => { const mk = (part: "A" | "B", n: number) => { const out: It[] = []; const cand = [...poolBy[si][part]].filter((c) => !owner.has(c.key)); while (out.length < n) { if (cand.length) { const c = cand.splice(Math.floor(r() * cand.length), 1)[0]; owner.set(c.key, si); out.push(c); } else out.push(virtualFor(si, part)); } return out; }; return { spec, a: mk("A", 29), b: mk("B", 13) }; });
  const costs = st.map(setCost); let total = costs.reduce((x, y) => x + y, 0); let T = 40;
  for (let t = 0; t < iters; t++) {
    const si = Math.floor(r() * st.length); const part = r() < 0.7 ? "A" : "B"; const arr = part === "A" ? st[si].a : st[si].b; const p = Math.floor(r() * arr.length); const old = arr[p];
    const useVirtual = r() < 0.12; let n: It; if (useVirtual) n = virtualFor(si, part); else { const pl = poolBy[si][part]; n = pl[Math.floor(r() * pl.length)]; if (!n || arr.includes(n)) continue; }
    const t2 = n.virtual ? -1 : (owner.get(n.key) ?? -1);
    if (t2 === si) continue;
    if (t2 >= 0) { // 다른 세트가 가진 문항: 맞교환(old 가 가상이면 불가)
      if (old.virtual) continue; const t2arr = part === "A" ? st[t2].a : st[t2].b; const q = t2arr.indexOf(n); if (q < 0) continue;
      if (st[t2].spec.subj === "ab" && old.subj !== "ab") continue; if (old.unit > (st[t2].spec.subj === "ab" ? 8 : 10)) continue;
      arr[p] = n; t2arr[q] = old; const c1 = setCost(st[si]), c2 = setCost(st[t2]); const d = c1 + c2 - costs[si] - costs[t2];
      if (d <= 0 || r() < Math.exp(-d / Math.max(T, 0.05))) { costs[si] = c1; costs[t2] = c2; total += d; owner.set(n.key, si); owner.set(old.key, t2); } else { arr[p] = old; t2arr[q] = n; }
    } else {
      arr[p] = n; const c1 = setCost(st[si]); const d = c1 - costs[si];
      if (d <= 0 || r() < Math.exp(-d / Math.max(T, 0.05))) { costs[si] = c1; total += d; if (!old.virtual) owner.delete(old.key); if (!n.virtual) owner.set(n.key, si); } else arr[p] = old;
    }
    T *= 0.9999985;
  }
  return { st, total, costs };
}

// ---------- FRQ 분배 ----------
type FS = { spec: Spec; a: It[]; b: It[] };
const frqCost = (s: FS, minNative: number) => { const all = [...s.a, ...s.b]; let v = 0; v += all.length - new Set(all.map((c) => c.type)).size; v += all.length - new Set(all.map((c) => c.fam)).size; if (s.spec.subj === "bc") v += Math.max(0, minNative - all.filter((c) => c.native).length); return v * 20 + all.filter((c) => c.virtual).length * 4; };
let fvid = 0; const mkFV = (subj: "ab" | "bc", calc: It["calc"], native: boolean): It => ({ key: `VF#${++fvid}:${calc === "required" ? "A" : "B"}:${native ? "bc" : "sh"}`, kind: "frq", subj, unit: 0, skill: 0, calc, fam: `VF${fvid}`, type: `VF${fvid}`, graph: false, native, bcOnly: native, virtual: true });
function solveFrq(specs: Spec[], fixedUsed: Set<string>, seed: number, iters: number, minNative: number) {
  const r = rng(seed); const owner = new Map<string, number>();
  const el = (s: Spec) => REAL_FRQ.filter((c) => !fixedUsed.has(c.key) && (s.subj === "bc" || !c.native));
  const pl = specs.map((s) => ({ A: el(s).filter((c) => c.calc === "required"), B: el(s).filter((c) => c.calc !== "required") }));
  const st: FS[] = specs.map((spec, si) => { const mk = (part: "A" | "B", n: number) => { const out: It[] = []; const cand = [...pl[si][part]].filter((c) => !owner.has(c.key)); while (out.length < n) { if (cand.length) { const c = cand.splice(Math.floor(r() * cand.length), 1)[0]; owner.set(c.key, si); out.push(c); } else out.push(mkFV(spec.subj, part === "A" ? "required" : "not_allowed", spec.subj === "bc" && r() < 0.4)); } return out; }; return { spec, a: mk("A", 2), b: mk("B", 4) }; });
  const costs = st.map((s) => frqCost(s, minNative)); let T = 40;
  for (let t = 0; t < iters; t++) {
    const si = Math.floor(r() * st.length); const part = r() < 0.33 ? "A" : "B"; const arr = part === "A" ? st[si].a : st[si].b; const p = Math.floor(r() * arr.length); const old = arr[p];
    let n: It; if (r() < 0.06) n = mkFV(st[si].spec.subj, part === "A" ? "required" : "not_allowed", st[si].spec.subj === "bc" && r() < 0.5); else { const l = pl[si][part]; n = l[Math.floor(r() * l.length)]; if (!n || arr.includes(n)) continue; }
    const t2 = n.virtual ? -1 : (owner.get(n.key) ?? -1); if (t2 === si) continue;
    if (t2 >= 0) { if (old.virtual) continue; const t2arr = part === "A" ? st[t2].a : st[t2].b; const q = t2arr.indexOf(n); if (q < 0) continue; if (st[t2].spec.subj === "ab" && old.native) continue; arr[p] = n; t2arr[q] = old; const c1 = frqCost(st[si], minNative), c2 = frqCost(st[t2], minNative); const d = c1 + c2 - costs[si] - costs[t2]; if (d <= 0 || r() < Math.exp(-d / Math.max(T, 0.05))) { costs[si] = c1; costs[t2] = c2; owner.set(n.key, si); owner.set(old.key, t2); } else { arr[p] = old; t2arr[q] = n; } }
    else { arr[p] = n; const c1 = frqCost(st[si], minNative); const d = c1 - costs[si]; if (d <= 0 || r() < Math.exp(-d / Math.max(T, 0.05))) { costs[si] = c1; if (!old.virtual) owner.delete(old.key); if (!n.virtual) owner.set(n.key, si); } else arr[p] = old; }
    T *= 0.99997;
  }
  return { st, costs };
}

// ---------- 실행: 누적 단계 ----------
const MIN_BC_NATIVE_FRQ = 2; // 내부 가정: BC 풀 세트 FRQ 6 중 BC 전용 2 이상(급수·매개변수·미분방정식 등)
const fixedAb1 = new Set([...ab1Keys, ...ab1Frq.map((c) => c.key)]);
const S = (id: string, subj: "ab" | "bc"): Spec => ({ id, subj, floor: FLOOR });
const stages: { name: string; specs: Spec[] }[] = [
  { name: "단계0: BC#1 단독(새 AB#1 항목 제외)", specs: [S("BC#1", "bc")] },
  { name: "단계1: BC#1 + AB#2", specs: [S("BC#1", "bc"), S("AB#2", "ab")] },
  { name: "단계2: + BC#2", specs: [S("BC#1", "bc"), S("AB#2", "ab"), S("BC#2", "bc")] },
  { name: "단계3: + AB#3 + BC#3", specs: [S("BC#1", "bc"), S("AB#2", "ab"), S("BC#2", "bc"), S("AB#3", "ab"), S("BC#3", "bc")] },
];
const LB_ONLY = process.argv.includes("--lb-only");
const res = (LB_ONLY ? [] : stages).map((g) => { let best: ReturnType<typeof solveMc> | null = null; for (const sd of [11, 23, 37, 51]) { const x = solveMc(g.specs, fixedAb1, sd, 2500000); if (!best || x.total < best.total) best = x; } let bf: ReturnType<typeof solveFrq> | null = null; for (const sd of [5, 9, 13]) { const x = solveFrq(g.specs, fixedAb1, sd, 200000, MIN_BC_NATIVE_FRQ); if (!bf || x.costs.reduce((a, b) => a + b, 0) < bf.costs.reduce((a, b) => a + b, 0)) bf = x; } return { g, mc: best!, frq: bf! }; });

const out: string[] = []; const L = (s = "") => out.push(s);
L(`# six-set-plan (그래프 필수 하한: AB#1=${AB1_FLOOR}(승인), 나머지=${FLOOR})`);
L(`재고(렌더 통과·결함 0·중복 제외): MC ${REAL_MC.length}(AB ${REAL_MC.filter((c) => c.subj === "ab").length}, BC ${REAL_MC.filter((c) => c.subj === "bc").length}) 그래프 필수 ${REAL_MC.filter((c) => c.graph).length}; FRQ ${REAL_FRQ.length}(BC 고유 ${REAL_FRQ.filter((c) => c.native).length}); MC 문항군 군집 ${new Set(REAL_MC.map((c) => c.fam)).size}`);
L(`AB#1: ${ab1 ? "해 있음" : "해 없음"}, 교체 ${swaps?.removed.length ?? "-"}건, 그래프 필수 ${ab1Items.filter((c) => c.graph).length}`);
L(`AB#1 검증(단원·스킬 범위·문항군 상한 1(AB+BC 합산 군집 기준)·그래프 ≥${AB1_FLOOR}, 0 이면 위반 없음): ${setCost({ spec: { id: "AB#1", subj: "ab", floor: AB1_FLOOR }, a: ab1Items.slice(0, 29), b: ab1Items.slice(29) })}`);
if (swaps) { L("교체(제거→추가):"); swaps.removed.forEach((k, i) => { const o = byKeyPool.get(k)!, n = byKeyPool.get(swaps.added[i])!; L(`  ${k} (${o.unit}, s${o.skill}, ${o.calc === "required" ? "C" : "N"}, ${o.graph ? "G" : "-"}) → ${n.key} (${n.unit}, s${n.skill}, ${n.calc === "required" ? "C" : "N"}, ${n.graph ? "G" : "-"})`); }); }
const frqs = (st: FS[]) => st.map((s) => ({ id: s.spec.id, items: [...s.a, ...s.b].filter((c) => !c.virtual).map((c) => c.key), virtual: [...s.a, ...s.b].filter((c) => c.virtual).map((c) => c.key) }));
const summary: unknown[] = []; let prevVirt = new Map<string, number>();
for (const { g, mc, frq } of res) {
  L(""); L(`## ${g.name} — MC 위반 점수 ${mc.total}`);
  const virt = new Map<string, number>(); const perSet: unknown[] = [];
  for (const s of mc.st) { const all = [...s.a, ...s.b]; const v = all.filter((c) => c.virtual); const u = cnt(all, (c) => c.unit); const sk = cnt(all, (c) => c.skill);
    L(`- ${s.spec.id}: 단원 ${Object.keys(s.spec.subj === "ab" ? AB_B : BC_B).map((k) => `${k}:${u.get(+k) ?? 0}`).join(" ")} / 스킬 ${[1, 2, 3].map((k) => `${k}:${sk.get(k) ?? 0}`).join(" ")} / 그래프 ${all.filter((c) => c.graph).length} / 가상(부족) ${v.length} / 위반 ${Math.round(setCost(s) - v.length * 4)}`);
    for (const c of v) { const k = `${c.subj}|u${c.unit}|${c.calc === "required" ? "계산기" : "불가"}|스킬${c.skill}|${c.graph ? "그래프" : "비그래프"}`; virt.set(k, (virt.get(k) ?? 0) + 1); }
    perSet.push({ id: s.spec.id, keys: all.filter((c) => !c.virtual).map((c) => c.key), virtual: v.map((c) => c.key) }); }
  const totalV = [...virt.values()].reduce((a, b) => a + b, 0); L(`MC 부족 합계(누적): ${totalV}`); for (const [k, n] of [...virt].sort()) L(`  ${k} × ${n}`);
  const fv = frq.st.flatMap((s) => [...s.a, ...s.b].filter((c) => c.virtual).map((c) => ({ set: s.spec.id, calc: c.calc === "required" ? "A계산기" : "B불가", kind: c.native ? "BC전용" : "공유" })));
  L(`FRQ 부족 합계(누적): ${fv.length}`); const fc = cnt(fv, (x) => `${x.calc}|${x.kind}`); for (const [k, n] of fc) L(`  ${k} × ${n}`);
  L(`FRQ BC전용 수: ${frq.st.map((s) => `${s.spec.id}[${[...s.a, ...s.b].filter((c) => c.native).length}]`).join(" ")}`);
  summary.push({ stage: g.name, mcShortage: Object.fromEntries(virt), frqShortage: fv, sets: perSet, frq: frqs(frq.st), prevMcShortageTotal: [...prevVirt.values()].reduce((a, b) => a + b, 0) }); prevVirt = virt;
}
console.log(out.join("\n"));
// ---------- 하한(분석적) — 휴리스틱 부족 수가 이보다 작을 수 없다 ----------
{
  const rem = REAL_MC.filter((c) => !fixedAb1.has(c.key)); const nSets = { ab: 2, bc: 3 };
  const L2: string[] = ["", "## 남은 재고(AB#1 제외)와 5세트(AB#2·#3, BC#1~#3) 수요 하한"];
  L2.push("| 단원 | 수요(합 하한~상한) | 재고 AB출처 | 재고 BC고유 | 계산기 불가/필수 | 그래프 | 군집 | 단원 하한 부족 |", "|---|---|---|---|---|---|---|---|");
  let lbU = 0;
  for (let u = 1; u <= 10; u++) { const lo = (u <= 8 ? AB_B[u][0] * nSets.ab : 0) + BC_B[u][0] * nSets.bc, hi = (u <= 8 ? AB_B[u][1] * nSets.ab : 0) + BC_B[u][1] * nSets.bc; const x = rem.filter((c) => c.unit === u);
    const short = Math.max(0, lo - x.length); lbU += short; L2.push(`| ${u} | ${lo}~${hi} | ${x.filter((c) => !c.native).length} | ${x.filter((c) => c.native).length} | ${x.filter((c) => c.calc === "not_allowed").length}/${x.filter((c) => c.calc === "required").length} | ${x.filter((c) => c.graph).length} | ${new Set(x.map((c) => c.fam)).size} | ${short} |`); }
  const needA = 29 * 5, needB = 13 * 5; const stA = rem.filter((c) => c.calc === "not_allowed").length, stB = rem.filter((c) => c.calc === "required").length;
  const gStock = rem.filter((c) => c.graph).length; const gNeed = FLOOR * 5;
  L2.push(`단원 하한 부족 합 ${lbU}; 계산기 불가 수요 ${needA} vs 재고 ${stA} (부족 ${Math.max(0, needA - stA)}); 계산기 필수 수요 ${needB} vs 재고 ${stB} (부족 ${Math.max(0, needB - stB)}); 그래프 필수 수요 ${gNeed}(하한 ${FLOOR}×5) vs 재고 ${gStock} → 부족 ${Math.max(0, gNeed - gStock)}`);
  const fr = REAL_FRQ.filter((c) => !fixedAb1.has(c.key)); L2.push(`FRQ 남은 재고: 계산기 ${fr.filter((c) => c.calc === "required").length} / 불가 ${fr.filter((c) => c.calc !== "required").length} (수요 A 10 / B 20), BC고유 ${fr.filter((c) => c.native).length} (수요 ${MIN_BC_NATIVE_FRQ * 3}), 유형 ${new Set(fr.map((c) => c.type)).size}`);
  console.log(L2.join("\n"));
}
const w = arg("--write"); if (w) writeFileSync(w, JSON.stringify({ floor: FLOOR, ab1: { keys: ab1Keys, frq: ab1Frq.map((c) => c.key), swaps }, stages: summary }, null, 1));
