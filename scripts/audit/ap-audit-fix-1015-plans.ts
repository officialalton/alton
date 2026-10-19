// 외부 AP 전체 검수(2026-10-15) 수정본 후보로 칸을 교체하는 새 버전 교체안 생성기(무료·읽기 전용·DB 없음).
//   npx tsx scripts/audit/ap-audit-fix-1015-plans.ts [--explore] [--write]
// 현재 게시 구성 = 정확 배정 보고서(+ 이미 만들어진 교체안 적용)로 재현해 독립 검증기(verify*Assignment)로 교체 전·후 위반 목록을 비교한다.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { STOCK_FILES } from "../ap-generation/keys-file";
import { loadStatsPool, type StatsItem } from "../ap-generation/stats-pool";
import { verifyStatsAssignment, type StatsResult } from "../ap-generation/stats-assign";
import { loadBioPool, type BioItem } from "../ap-generation/bio-pool";
import { verifyBioAssignment, type BioResult } from "../ap-generation/bio-assign";
import { loadMicroPool, type MicroItem } from "../ap-generation/micro-pool";
import { verifyMicroAssignment, type MicroResult } from "../ap-generation/micro-assign";
import { loadChemPool, type ChemItem } from "../ap-generation/chem-pool";
import { verifyChemAssignment, type ChemResult } from "../ap-generation/chem-assign";
import { loadPhysPool, type PhysItem } from "../ap-generation/phys-pool";
import { verifyPhysAssignment, type PhysResult } from "../ap-generation/phys-assign";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
const rd = (p: string): J => JSON.parse(readFileSync(p, "utf-8"));
const D = "data/ap/stock/";
export type Comp = { mc: string[]; frq: string[] };
export function compose(assign: string, id: string, plans: string[] = []): Comp {
  const s = rd(D + assign).sets.find((x: J) => x.id === id);
  const c: Comp = { mc: [...s.mcA], frq: [...s.frqA] };
  for (const pf of plans) for (const w of rd(D + pf).swaps) {
    const l = w.section === "ap_mc" ? c.mc : c.frq; const i = l.indexOf(w.removeKey);
    if (i < 0) throw new Error(`${pf}: ${w.removeKey} not in composition`);
    l[i] = w.addKey;
  }
  return c;
}

const payloads = new Map<string, J>();
for (const f of STOCK_FILES) { const p = `${D}${f}.json`; if (existsSync(p)) for (const r of rd(p)) payloads.set(r.stockKey, r.payload); }
/** 내용 서명(보기 순서 무관): 줄기·보기 텍스트 + 자료. 시험 사이 완전 재사용 판정에 쓴다. */
export function sigOf(key: string): string {
  const p = payloads.get(key); if (!p) return `?${key}`;
  const its: J[] = p.items ?? [p];
  return JSON.stringify([its.map((i) => [i.stem, (i.options ?? []).map((o: J) => (typeof o === "string" ? o : o.text)).sort()]), p.stimulus?.data ?? null, p.stimulus?.description ?? null, p.set_intro ?? null]);
}
type Gen = { by: Map<string, J>; verify: (r: J[], b?: Set<string>) => string[]; result: (id: string, c: Comp) => J };
function gen(by: Map<string, J>, verify: (r: J[], b?: Set<string>) => string[], extra: J = {}): Gen {
  return { by, verify, result: (id, c) => {
    const get = (k: string) => { const x = by.get(k); if (!x) throw new Error(`not in pool: ${k}`); return x; };
    const mc = c.mc.map(get);
    return { id, singles: mc.filter((x) => !x.shared), sets: mc.filter((x) => x.shared), frq: c.frq.map(get), virtual: [], virtualSets: [], virtualSetArchetypes: [], frqVirtual: [], ...extra };
  } };
}
const poolMap = (p: { all: J[] }) => new Map(p.all.map((x: J) => [x.key, x] as [string, J]));

export const SUBJ = {
  stats: () => gen(poolMap(loadStatsPool({ requireScreen: false })), verifyStatsAssignment as never),
  bio: () => gen(poolMap(loadBioPool({ requireScreen: false })), verifyBioAssignment as never),
  micro: () => gen(poolMap(loadMicroPool({ requireScreen: false })), verifyMicroAssignment as never),
  chem: () => gen(poolMap(loadChemPool({ requireScreen: false })), verifyChemAssignment as never),
  phys: () => gen(poolMap(loadPhysPool({ requireScreen: false })), verifyPhysAssignment as never),
};
export type { StatsItem, BioItem, MicroItem, ChemItem, PhysItem, StatsResult, BioResult, MicroResult, ChemResult, PhysResult };

/** 후보 탐색: removeKey 를 같은 부류(단독/세트, MC)의 다른 후보로 바꿨을 때 두 시험의 독립 검증기 위반이 늘지 않고, 상대 시험과 문항군·원형이 겹치지 않는 후보. */
export function tryReplace(g: Gen, a: { id: string; c: Comp }, b: { id: string; c: Comp }, removeKey: string, opts: { sameUnit?: boolean } = {}) {
  const rm = g.by.get(removeKey)!;
  const used = new Set([...a.c.mc, ...a.c.frq, ...b.c.mc, ...b.c.frq]);
  const base = new Set(g.verify([g.result(a.id, a.c), g.result(b.id, b.c)]));
  const sigsB = new Set(b.c.mc.map(sigOf)); const itemSigsB = new Set(b.c.mc.flatMap((k) => (payloads.get(k)?.items ?? [payloads.get(k)]).map((i: J) => JSON.stringify([i?.stem, (i?.options ?? []).map((o: J) => o.text).sort()]))));
  const out: J[] = [];
  for (const c of g.by.values()) {
    if (c.kind !== "mc" || c.shared !== rm.shared || used.has(c.key)) continue;
    if (opts.sameUnit && c.members[0].unit !== rm.members[0].unit) continue;
    if (sigsB.has(sigOf(c.key))) continue;
    if ((payloads.get(c.key)?.items ?? [payloads.get(c.key)]).some((i: J) => itemSigsB.has(JSON.stringify([i?.stem, (i?.options ?? []).map((o: J) => o.text).sort()])))) continue;
    const na = { ...a.c, mc: a.c.mc.map((k) => (k === removeKey ? c.key : k)) };
    let v: string[]; try { v = g.verify([g.result(a.id, na), g.result(b.id, b.c)]); } catch { continue; }
    if (v.every((x) => base.has(x))) out.push(c);
  }
  return out;
}

if (new RegExp("ap-audit-fix-1015-plans\\.ts$").test(process.argv[1] ?? "")) {
  const explore = process.argv.includes("--explore");
  if (explore) {
    const st = SUBJ.stats(); const ch = SUBJ.chem();
    const show = (g: Gen, rm: string, sameSkill = true) => {
      const r = g.by.get(rm)!; console.log(`\n== replace ${rm} ${r.archetype} members=${JSON.stringify(r.members.map((m: J) => [m.unit, m.skill ?? m.skillCode, m.topic]))} fam=${r.fam}`);
      for (const c of g.by.values()) {
        if (c.kind !== r.kind || c.shared !== r.shared || c.key === rm) continue;
        const same = c.members.length === r.members.length && c.members.every((m: J, i: number) => m.unit === r.members[i].unit && (!sameSkill || String(m.skill ?? m.skillCode)[0] === String(r.members[i].skill ?? r.members[i].skillCode)[0]));
        if (same) console.log(`  ${c.key} ${c.archetype} fam=${c.fam} screen=${c.screen} exam=${c.exam} members=${JSON.stringify(c.members.map((m: J) => [m.unit, m.skill ?? m.skillCode]))}`);
      }
    };
    show(st, "stats-s3b-a:ap_statistics-m03-k0"); show(st, "stats-s3b-a:ap_statistics-m04-k0");
    show(ch, "chem-p1-a2:ap_chemistry-m18-k0"); show(ch, "chem-p1-a:ap_chemistry-m21-k1");
    const s1 = compose("exact-assign-stats-st1-s2b.json", "ST1", ["st1-v2-swap-plan.json"]), s2 = compose("exact-assign-stats-st2-s3b.json", "ST2");
    for (const rk of ["stats-s3b-a:ap_statistics-m03-k0", "stats-s3b-a:ap_statistics-m04-k0"]) {
      const r = tryReplace(st, { id: "ST2", c: s2 }, { id: "ST1", c: s1 }, rk, { sameUnit: true });
      console.log(`\n-- stats candidates for ${rk}: ${r.length}`); for (const c of r.slice(0, 40)) console.log(`  ${c.key} ${c.archetype} fam=${c.fam} screen=${c.screen} exam=${c.exam} ${JSON.stringify(c.members.map((m: J) => [m.unit, m.skill]))}`);
    }
    const c1 = compose("exact-assign-chem-ch1-ch2.json", "CH1"), c2 = compose("exact-assign-chem-ch1-ch2.json", "CH2");
    for (const rk of ["chem-p1-a2:ap_chemistry-m18-k0", "chem-p1-a:ap_chemistry-m21-k1"]) {
      const r = tryReplace(ch, { id: "CH2", c: c2 }, { id: "CH1", c: c1 }, rk);
      console.log(`\n-- chem candidates for ${rk}: ${r.length}`); for (const c of r.slice(0, 40)) console.log(`  ${c.key} ${c.archetype} fam=${c.fam} screen=${c.screen} exam=${c.exam} ${JSON.stringify(c.members.map((m: J) => [m.unit, m.skill]))}`);
    }
  }
}

// ── 교체안 ────────────────────────────────────────────────────────────────
const fx = (n: string) => `${"fix1015"}:${n}`;
type PlanDef = { file: string; set: string; name: string; src: number; subj: keyof typeof SUBJ; assign: string; basePlans: string[]; other: { set: string; assign: string; basePlans: string[]; swaps?: [string, string][] }; swaps: { section: "ap_mc" | "ap_frq"; removeKey: string; addKey: string; reason: string }[] };
export const PLANS: PlanDef[] = [
  { file: "st1-v3-audit-1015-swap-plan.json", set: "ST1", name: "AP Statistics — Practice Exam 1", src: 2, subj: "stats", assign: "exact-assign-stats-st1-s2b.json", basePlans: ["st1-v2-swap-plan.json"], other: { set: "ST2", assign: "exact-assign-stats-st2-s3b.json", basePlans: [] }, swaps: [
    { section: "ap_mc", removeKey: "stats-s3-a:ap_statistics-m10-k0", addKey: fx("ap_statistics-fx03-k0"), reason: "AP-003 (P1) MC27: homogeneity and independence nulls were equivalent options" },
    { section: "ap_mc", removeKey: "stats-s1-h-final:ap_statistics-m03-k0", addKey: fx("ap_statistics-fx67-k0"), reason: "AP-067 MC21: n=200 cannot produce p-hat 0.459; now 0.46 with P=0.042" },
  ] },
  { file: "st2-v2-audit-1015-swap-plan.json", set: "ST2", name: "AP Statistics — Practice Exam 2", src: 1, subj: "stats", assign: "exact-assign-stats-st2-s3b.json", basePlans: [], other: { set: "ST1", assign: "exact-assign-stats-st1-s2b.json", basePlans: ["st1-v2-swap-plan.json"], swaps: [["stats-s3-a:ap_statistics-m10-k0", fx("ap_statistics-fx03-k0")], ["stats-s1-h-final:ap_statistics-m03-k0", fx("ap_statistics-fx67-k0")]] }, swaps: [
    { section: "ap_mc", removeKey: "stats-s3-a:ap_statistics-m10-k1", addKey: fx("ap_statistics-fx04-k0"), reason: "AP-004 (P1) MC23: homogeneity and independence nulls were equivalent options" },
    { section: "ap_mc", removeKey: "stats-s3b-d:ap_statistics-m05-k0", addKey: fx("ap_statistics-fx05-k0"), reason: "same equivalent-null defect in the sibling chi-square setup item (MC28)" },
    { section: "ap_mc", removeKey: "stats-s3b-a:ap_statistics-m03-k0", addKey: "stats-s3b-a:ap_statistics-m03-k1", reason: "AP-070 MC7: identical to ST1 MC7 (household survey); same task with a different scenario (gym members)" },
    { section: "ap_mc", removeKey: "stats-s3b-a:ap_statistics-m04-k0", addKey: "stats-s3b-a:ap_statistics-m04-k1", reason: "AP-070 MC8: identical to ST1 MC8 (employee SRS); same task with a different scenario (apartment cluster sample)" },
  ] },
  { file: "bi1-v6-audit-1015-swap-plan.json", set: "BI1", name: "AP Biology — Practice Exam 1", src: 5, subj: "bio", assign: "exact-assign-bio-bi1-bi2-v4.json", basePlans: [], other: { set: "BI2", assign: "exact-assign-bio-bi1-bi2-v4.json", basePlans: [] }, swaps: [
    { section: "ap_frq", removeKey: "bio-p1-b:ap_biology-f02-k0", addKey: fx("ap_biology-fx06-k0"), reason: "AP-006 FRQ2 D: more ions make solute potential lower (more negative), not greater; title completed" },
    { section: "ap_frq", removeKey: "bio-v3a:ap_biology-f06-k0", addKey: fx("ap_biology-fx08-k0"), reason: "AP-008 FRQ3 C/D: UV doses stated as nonlethal; conditional prediction accepted" },
  ] },
  { file: "bi2-v6-audit-1015-swap-plan.json", set: "BI2", name: "AP Biology — Practice Exam 2", src: 5, subj: "bio", assign: "exact-assign-bio-bi1-bi2-v4.json", basePlans: [], other: { set: "BI1", assign: "exact-assign-bio-bi1-bi2-v4.json", basePlans: [] }, swaps: [
    { section: "ap_frq", removeKey: "bio-s2-frq:ap_biology-f21-k0", addKey: fx("ap_biology-fx02-k0"), reason: "AP-001 (P1) FRQ5 A/B: replication-fork direction was not visible to students; now stated" },
    { section: "ap_frq", removeKey: "bio-v3a:ap_biology-f04-k0", addKey: fx("ap_biology-fx10-k0"), reason: "AP-010 FRQ2: truncated experiment introduction; title is now the complete setup" },
    { section: "ap_mc", removeKey: "bio-v2a:ap_biology-m31-k2", addKey: fx("ap_biology-fx12-k0"), reason: "AP-012 MC22 (population set): 'stops changing' vs 798 -> 800; now 'changes very little'" },
  ] },
  { file: "mi2-v2-audit-1015-swap-plan.json", set: "MI2", name: "AP Microeconomics — Practice Exam 2", src: 1, subj: "micro", assign: "exact-assign-micro-mi1-mi2.json", basePlans: [], other: { set: "MI1", assign: "exact-assign-micro-mi1-mi2.json", basePlans: [] }, swaps: [
    { section: "ap_mc", removeKey: "micro-p2-a:ap_microeconomics-m32-k0", addKey: fx("ap_microeconomics-fx01-k0"), reason: "AP-002 (P1) MC56: marginal cost $26 is now stated in the question text" },
  ] },
  { file: "ch2-v2-audit-1015-swap-plan.json", set: "CH2", name: "AP Chemistry — Practice Exam 2", src: 1, subj: "chem", assign: "exact-assign-chem-ch1-ch2.json", basePlans: [], other: { set: "CH1", assign: "exact-assign-chem-ch1-ch2.json", basePlans: [] }, swaps: [
    { section: "ap_mc", removeKey: "chem-p1-a2:ap_chemistry-m18-k0", addKey: fx("ap_chemistry-fx27-k0"), reason: "AP-027 CH1 MC39 = CH2 MC38: CH2 now asks the reversed calorimetry-error question (higher magnitude)" },
    { section: "ap_mc", removeKey: "chem-p1-a:ap_chemistry-m21-k1", addKey: "chem-p1-a2:ap_chemistry-m21-k0", reason: "AP-027 CH1 MC49/50 = CH2 MC48/49 (titration-curve set): CH2 gets the other seed of the same set type, with different data" },
  ] },
  { file: "ph3-v2-audit-1015-swap-plan.json", set: "PH3", name: "AP Physics 1 — Practice Exam 1", src: 1, subj: "phys", assign: "exact-assign-phys-ph3-ph4.json", basePlans: [], other: { set: "PH4", assign: "exact-assign-phys-ph3-ph4.json", basePlans: ["ph2-v2-frq-swap-plan.json"] }, swaps: [
    { section: "ap_mc", removeKey: "phys-s3-a:ap_physics_1-m24-k0", addKey: fx("ap_physics_1-fx58-k0"), reason: "AP-058 MC26: displayed speeds now exact (0.2 and 0.4 m/s): p = 1 kg m/s, K falls from 0.5 J to 0.18 J" },
  ] },
];

export function buildPlan(def: PlanDef, g: Gen) {
  const a = { id: def.set, c: compose(def.assign, def.set, def.basePlans) };
  const bc = compose(def.other.assign, def.other.set, def.other.basePlans);
  for (const [r, add] of def.other.swaps ?? []) { const i = bc.mc.indexOf(r); if (i < 0) throw new Error(`other-set swap missing ${r}`); bc.mc[i] = add; }
  const b = { id: def.other.set, c: bc };
  const before = g.verify([g.result(a.id, a.c), g.result(b.id, b.c)]);
  const next: Comp = { mc: [...a.c.mc], frq: [...a.c.frq] };
  const meta = (k: string) => { const c = g.by.get(k); if (!c) throw new Error(`not in pool: ${k}`); return { unit: c.members[0]?.unit ?? null, skill: c.members[0]?.skill ?? c.members[0]?.skillCode ?? null, shared: !!c.shared, type: c.frqType ?? "" }; };
  const swaps = def.swaps.map((w) => {
    const l = w.section === "ap_mc" ? next.mc : next.frq; const i = l.indexOf(w.removeKey);
    if (i < 0) throw new Error(`${def.file}: ${w.removeKey} not in ${def.set}`);
    l[i] = w.addKey;
    return { section: w.section, removeKey: w.removeKey, addKey: w.addKey, reason: w.reason, remove: meta(w.removeKey), add: meta(w.addKey) };
  });
  const after = g.verify([g.result(a.id, next), g.result(b.id, b.c)]);
  const introduced = after.filter((x) => !before.includes(x));
  return { swaps, before, after, introduced };
}

if (new RegExp("ap-audit-fix-1015-plans\\.ts$").test(process.argv[1] ?? "") && !process.argv.includes("--explore")) {
  const write = process.argv.includes("--write"); const gens: Partial<Record<keyof typeof SUBJ, Gen>> = {};
  for (const def of PLANS) {
    const g = (gens[def.subj] ??= SUBJ[def.subj]());
    const r = buildPlan(def, g);
    console.log(`${def.file}: swaps=${r.swaps.length} verifier before=${r.before.length} after=${r.after.length} introduced=${JSON.stringify(r.introduced)}`);
    if (r.introduced.length) process.exitCode = 1;
    if (write) writeFileSync(D + def.file, JSON.stringify({ kind: "ap_new_version_swap_plan", set: def.set, sourceSetName: def.name, sourceVersionNo: def.src, generatedBy: "scripts/audit/ap-audit-fix-1015-plans.ts (external audit 2026-10-15, docs/audits/ap-external-audit-20261015-confirmed-fixes.csv)", note: "Swaps use removeKey (positions resolve from the live set). Apply after the candidates in data/ap/stock/supp-fix1015-items.json are loaded, converted, render/screen-verified and review_env_ready.", swapCount: r.swaps.length, verifierViolations: r.after, requiresConvertedCandidates: r.swaps.map((x) => x.addKey), swaps: r.swaps }, null, 1) + "\n");
  }
}
