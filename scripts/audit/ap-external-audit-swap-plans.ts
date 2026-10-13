// 외부 감사(2026-10-08 Codex 학생 계정 풀이) 삼각검증 결과로 만든 AP 풀 모의고사 교체 계획 생성기(무료·읽기 전용·DB 없음).
//  1) MC: fprime_graph_statements 원형(전제 모순)으로 만든 3건 — AB1 mcA#17, AB2 mcA#18, BC1 mcA#7 을 같은 단원·계산기의 미사용 DB 준비 재고로 1:1 교체(스킬·그래프는 근접 우선).
//  2) FRQ: (a) AB2·AB3 가 6개 중 5개 원형을 공유 → AB3 의 3칸을 미사용 AB 재고(다른 원형)로 교체, (b) BC1·BC2 에 실생활 맥락 FRQ 가 1개뿐 → 맥락형 재고로 교체.
//   STRUCTURE_GROUPS_FILE=data/ap/stock/structure-groups.conservative.json npx tsx scripts/audit/ap-external-audit-swap-plans.ts [--write]
// 계획 파일은 data/ap/stock/*swap-plan*.json 이름 규칙(lib/ap-admin/new-version.ts)을 따르고, 독립 검증기(verifyAssignment)를 6세트 전체에 대해 통과해야 쓴다.
import { readFileSync, writeFileSync } from "node:fs";
import { loadPool, type Item } from "../ap-generation/assign-pool";
import { verifyAssignment, type SetResult, type Spec } from "../ap-generation/exact-assign";
import { dbReadyKeys } from "../ap-generation/ab1-new-version-plan";

type Sec = "mcA" | "mcB" | "frqA" | "frqB";
type Keys = Record<Sec, string[]>;
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const write = process.argv.includes("--write");

const ab1v1 = rd<{ keys: Keys }>("data/ap/stock/ab-full-set-selection.json").keys;
const v2plan = rd<{ swaps: { section: string; position: number; removeKey: string; addKey: string }[] }>("data/ap/stock/ab1-v2-swap-plan.json");
const secOf: Record<string, Sec> = { ap_mc_a: "mcA", ap_mc_b: "mcB", ap_frq_a: "frqA", ap_frq_b: "frqB" };
const planSec: Record<Sec, string> = { mcA: "ap_mc_a", mcB: "ap_mc_b", frqA: "ap_frq_a", frqB: "ap_frq_b" };
const ab1v2: Keys = { mcA: [...ab1v1.mcA], mcB: [...ab1v1.mcB], frqA: [...ab1v1.frqA], frqB: [...ab1v1.frqB] };
for (const s of v2plan.swaps) { const g = secOf[s.section]; if (ab1v2[g][s.position - 1] !== s.removeKey) throw new Error(`AB1 v2 계획이 게시본과 어긋남 ${s.section}#${s.position}`); ab1v2[g][s.position - 1] = s.addKey; }
const five = rd<{ sets: ({ id: string } & Keys)[] }>("data/ap/stock/exact-assign-5sets-cons.json").sets;
const comp = new Map<string, Keys>([["AB1", ab1v2], ...five.map((s) => [s.id, { mcA: [...s.mcA], mcB: [...s.mcB], frqA: [...s.frqA], frqB: [...s.frqB] }] as [string, Keys])]);

const { all } = loadPool({ strictFamilies: true });
const byKey = new Map(all.map((c) => [c.key, c]));
const ready = dbReadyKeys();
const spec = (id: string): Spec => ({ id, subj: id.startsWith("BC") ? "bc" : "ab", floor: id === "AB1" ? 9 : 10 });
const mk = (id: string, ks: Keys): SetResult => ({ id, mcA: ks.mcA.map((k) => byKey.get(k)!), mcB: ks.mcB.map((k) => byKey.get(k)!), virtual: [], frqA: ks.frqA.map((k) => byKey.get(k)!), frqB: ks.frqB.map((k) => byKey.get(k)!), frqVirtual: [] });
const verifyAll = (m: Map<string, Keys>) => { const ids = [...m.keys()]; return verifyAssignment(ids.map(spec), ids.map((i) => mk(i, m.get(i)!)), new Set()); };
const eligible = (c: Item | undefined) => !!c && c.screen && (c.pending === "" || c.pending === "sib21" || ready.has(c.key));

const base = verifyAll(comp);
console.log(`기준 6세트 검증기 위반 ${base.length}${base.length ? `: ${base.slice(0, 5).join(" | ")}` : ""}`);

const SRC: Record<string, { name: string; version: number }> = {
  AB1: { name: "AP Calculus AB — Practice Exam", version: 2 }, AB2: { name: "AP Calculus AB — Practice Exam 2", version: 1 }, AB3: { name: "AP Calculus AB — Practice Exam 3", version: 1 },
  BC1: { name: "AP Calculus BC — Practice Exam 1", version: 1 }, BC2: { name: "AP Calculus BC — Practice Exam 2", version: 1 },
};
const meta = (c: Item) => ({ unit: c.unit, skill: c.skill, calculator: c.calc, graph: c.graph, family: c.fam, type: c.type });
type Swap = { section: string; position: number; removeKey: string; addKey: string; reason: string; remove: ReturnType<typeof meta>; add: ReturnType<typeof meta> };
const plans = new Map<string, Swap[]>();
const addSwap = (set: string, sec: Sec, position: number, addKey: string, reason: string) => {
  const ks = comp.get(set)!; const removeKey = ks[sec][position - 1]; const r = byKey.get(removeKey)!; const c = byKey.get(addKey);
  if (!c) throw new Error(`후보 ${addKey} 이(가) 재고 풀(렌더 게이트·결함 스캔·중복)에 없음`);
  if (!eligible(c)) throw new Error(`후보 ${addKey} 는 화면 증거·DB 준비 조건 미충족(pending=${c.pending})`);
  ks[sec][position - 1] = addKey;
  plans.set(set, [...(plans.get(set) ?? []), { section: planSec[sec], position, removeKey, addKey, reason, remove: meta(r), add: meta(c) }]);
  console.log(`  ${set} ${planSec[sec]}#${position}: ${removeKey} [${r.type}] -> ${addKey} [${c.type}] (단원 ${c.unit}·스킬 ${c.skill}·${c.calc}${c.graph ? "·그래프" : ""}·${c.pending || "db-ready"})`);
};

// 1) MC — 전제 모순 원형 3건
const BAD_ARCH = "fprime_graph_statements";
const mcTargets: { set: string; section: Sec; position: number }[] = [{ set: "AB1", section: "mcA", position: 17 }, { set: "AB2", section: "mcA", position: 18 }, { set: "BC1", section: "mcA", position: 7 }];
const usedAll = new Set([...comp.values()].flatMap((k) => [...k.mcA, ...k.mcB, ...k.frqA, ...k.frqB]));
const taken = new Set<string>();
const score = (r: Item, c: Item) => (c.unit === r.unit ? 40 : 0) + (c.skill === r.skill ? 20 : 0) + (c.graph === r.graph ? 10 : 0) + (c.pending === "" ? 5 : 0);
console.log("MC");
for (const t of mcTargets) {
  const ks = comp.get(t.set)!; const r = byKey.get(ks[t.section][t.position - 1])!; const setSubj = t.set.startsWith("BC") ? "bc" : "ab";
  const cands = all.filter((c) => c.kind === "mc" && c.calc === r.calc && !usedAll.has(c.key) && !taken.has(c.key) && c.archetype !== BAD_ARCH && eligible(c) && (setSubj === "bc" || (c.subj === "ab" && !c.bcOnly)));
  const ranked = cands.map((c) => ({ c, s: score(r, c) })).sort((a, b) => b.s - a.s || a.c.key.localeCompare(b.c.key));
  let chosen: Item | null = null;
  for (const { c } of ranked) {
    const trial = new Map(comp); const nk: Keys = { mcA: [...ks.mcA], mcB: [...ks.mcB], frqA: [...ks.frqA], frqB: [...ks.frqB] }; nk[t.section][t.position - 1] = c.key; trial.set(t.set, nk);
    if (verifyAll(trial).length === 0) { chosen = c; break; }
  }
  if (!chosen) { console.log(`  ${t.set} ${t.section}#${t.position}: 검증기 통과 후보 없음`); continue; }
  taken.add(chosen.key); addSwap(t.set, t.section, t.position, chosen.key, `external audit: ${BAD_ARCH} premises contradict (f' increasing from its own sign-change point while negative)`);
}

// 2) FRQ — 회차 간 원형 반복 해소(AB3)와 실생활 맥락 보강(BC1·BC2). 후보는 stock 의 사용되지 않은 FRQ(원형 겹침·맥락은 사람이 읽고 고른 것; 검증기가 계산기·유형·문항군·BC 전용 FRQ 수를 다시 점검).
console.log("FRQ");
const AB3R = "external audit: AB2/AB3 share 5 of 6 FRQ archetypes (identical sub-goal order, some identical answers); diversify AB3";
addSwap("AB3", "frqA", 1, "v45ab-final:v5-ab:ap_calculus_ab-f01-k0", AB3R); // 면적·부피 → 직선 운동(AB2 와 안 겹침)
addSwap("AB3", "frqA", 2, "supp-r3c-ab-final:ap_calculus_ab-f01-k0", AB3R); // 변화율 표 → 누적함수(전류)
addSwap("AB3", "frqB", 3, "supp-r3c2-ab-final:ap_calculus_ab-f05-k0", AB3R); // 냉각 미분방정식 → 지수 감소 방사성 추적자
const CTX = "external audit: the BC set has only one real-world-context FRQ; official minimum is two";
addSwap("BC1", "frqA", 2, "supp-r3c-ab-final:ap_calculus_ab-f03-k0", CTX); // 추상 면적·부피 → 한계수익·한계비용(맥락)
addSwap("BC1", "frqB", 2, "supp-r3c-ab-final:ap_calculus_ab-f09-k0", CTX); // 추상 분리형 DE → 울타리 비용 최적화(맥락)
addSwap("BC2", "frqA", 2, "supp-r3c-ab-final:ap_calculus_ab-f04-k0", CTX); // 추상 면적·부피 → 도랑 부피(맥락, 표)

const fin = verifyAll(comp);
console.log(`교체 후 6세트 검증기 위반 ${fin.length}${fin.length ? `: ${fin.join(" | ")}` : ""}`);
const files: Record<string, string> = { AB1: "ab1-v3-audit-swap-plan.json", AB2: "ab2-v2-audit-swap-plan.json", AB3: "ab3-v2-audit-swap-plan.json", BC1: "bc1-v2-audit-swap-plan.json", BC2: "bc2-v2-audit-swap-plan.json" };
if (write && fin.length === 0) {
  for (const [set, swaps] of plans) {
    const s = SRC[set];
    writeFileSync(`data/ap/stock/${files[set]}`, JSON.stringify({ kind: "ap_new_version_swap_plan", set, sourceSetName: s.name, sourceVersionNo: s.version, generatedBy: "scripts/audit/ap-external-audit-swap-plans.ts", note: "external audit triage 2026-10-13 (docs/audit/2026-10-13-external-audit-triage.md); verifier violations checked across all 6 full sets", swapCount: swaps.length, verifierViolations: [], swaps }, null, 1) + "\n");
    console.log("wrote", files[set]);
  }
}
