// 외부 AP 검수(2026-10-15) 유형 단위 수정 — 공개 문항 교체안 생성기(무료·읽기 전용·DB 없음). 후보 파일(supp-fix1019-items.json)이 먼저 있어야 한다.
//   npx tsx scripts/audit/ap-audit-typefix-1019.ts --write        후보 생성
//   npx tsx scripts/audit/ap-audit-typefix-1019-plans.ts [--write] 교체안 생성(+독립 검증기)
// 현재 게시 구성 = 정확 배정 + 이미 만들어진 교체안(모두)을 재현하고, 두 세트를 함께 독립 검증기(verify*Assignment)에 넣어 교체 전·후 위반을 비교한다(새 위반 0 이어야 한다).
import { writeFileSync } from "node:fs";
import { SUBJ, compose } from "./ap-audit-fix-1015-plans";
import { RUN } from "./ap-audit-typefix-1019";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
const D = "data/ap/stock/";
export type SwapDef = { section: "ap_mc" | "ap_frq"; removeKey: string; addKey: string; reason: string };
type Side = { set: string; assign: string; basePlans: string[]; swaps?: SwapDef[] };
export type PlanDef = { file: string; name: string; src: number; subj: "stats" | "bio" | "micro" | "chem" | "phys"; a: Side; b: Side; swaps: SwapDef[] };
const fx = (n: string) => `${RUN}:${n}`;
const frq = (removeKey: string, addKey: string, reason = ""): SwapDef => ({ section: "ap_frq", removeKey, addKey: fx(addKey), reason });

const BI1_SW = [frq("bio-v3a:ap_biology-f01-k0", "ap_biology-tf02-k0", "type fix b: BI1 FRQ1 (bif_q1) experiment setup was only in the invisible stimulus description; the title is now the complete setup"),
  frq("bio-s2-frq:ap_biology-f24-k0", "ap_biology-tf03-k0", "type fix b: BI1 FRQ6 (bif_q6) table caption with n = 6 was only in the invisible description; the title is now the complete caption")];
const BI2_SW = [frq("bio-s2-frq:ap_biology-f01-k0", "ap_biology-tf01-k0", "type fix b: BI2 FRQ1 (bif_q1) experiment setup was only in the invisible stimulus description; the title is now the complete setup"),
  frq("bio-v3c:ap_biology-f02-k0", "ap_biology-tf04-k0", "type fix b: BI2 FRQ6 (bif_q6) table caption with n = 10 was only in the invisible description; the title is now the complete caption")];
const CH1_SW = [frq("chem-s2-f4:ap_chemistry-f03-k0", "ap_chemistry-tf05-k0", "type fix b: CH1 FRQ3 (chf_long_kinetics) the temperature 310 K was only in the invisible description; the title now states it")];
const CH2_SW = [frq("chem-s2-f2:ap_chemistry-f03-k0", "ap_chemistry-tf06-k0", "type fix b: CH2 FRQ3 (chf_long_kinetics) the temperature 310 K was only in the invisible description; the title now states it")];
const MI1_SW = [frq("micro-p1-b:ap_microeconomics-f05-k0", "ap_microeconomics-tf07-k0", "type fix c: MI1 FRQ3 (mif_short_labor) the output price $3 and the wage $55 (needed for the marginal revenue product and the hiring decision) were only in the invisible description; the title now states them")];
const ST1_SW = [frq("stats-s2b-c:ap_statistics-f02-k0", "ap_statistics-tf08-k0", "type fix b: ST1 FRQ2 (stfrq_q2_regression) the sample size (18 observations) was only in the invisible description; the title now states it")];
const ST2_SW = [frq("stats-s3b-c:ap_statistics-f02-k0", "ap_statistics-tf09-k0", "type fix b: ST2 FRQ2 (stfrq_q2_regression) the sample size (16 observations) was only in the invisible description; the title now states it")];

const BIO = "exact-assign-bio-bi1-bi2-v4.json";
const B1P = ["bi1-v6-audit-1015-swap-plan.json"], B2P = ["bi2-v6-audit-1015-swap-plan.json"];
const CHA = "exact-assign-chem-ch1-ch2.json";
const S1A = "exact-assign-stats-st1-s2b.json", S2A = "exact-assign-stats-st2-s3b.json";
const S1P = ["st1-v2-swap-plan.json", "st1-v3-audit-1015-swap-plan.json"], S2P = ["st2-v2-audit-1015-swap-plan.json"];
const MIA = "exact-assign-micro-mi1-mi2.json";

export const PLANS: PlanDef[] = [
  { file: "bi1-v7-audit-1019-swap-plan.json", name: "AP Biology — Practice Exam 1", src: 6, subj: "bio", a: { set: "BI1", assign: BIO, basePlans: B1P }, b: { set: "BI2", assign: BIO, basePlans: B2P, swaps: BI2_SW }, swaps: BI1_SW },
  { file: "bi2-v7-audit-1019-swap-plan.json", name: "AP Biology — Practice Exam 2", src: 6, subj: "bio", a: { set: "BI2", assign: BIO, basePlans: B2P }, b: { set: "BI1", assign: BIO, basePlans: B1P, swaps: BI1_SW }, swaps: BI2_SW },
  { file: "ch1-v2-audit-1019-swap-plan.json", name: "AP Chemistry — Practice Exam 1", src: 1, subj: "chem", a: { set: "CH1", assign: CHA, basePlans: [] }, b: { set: "CH2", assign: CHA, basePlans: ["ch2-v2-audit-1015-swap-plan.json"], swaps: CH2_SW }, swaps: CH1_SW },
  { file: "ch2-v3-audit-1019-swap-plan.json", name: "AP Chemistry — Practice Exam 2", src: 2, subj: "chem", a: { set: "CH2", assign: CHA, basePlans: ["ch2-v2-audit-1015-swap-plan.json"] }, b: { set: "CH1", assign: CHA, basePlans: [], swaps: CH1_SW }, swaps: CH2_SW },
  { file: "mi1-v2-audit-1019-swap-plan.json", name: "AP Microeconomics — Practice Exam 1", src: 1, subj: "micro", a: { set: "MI1", assign: MIA, basePlans: [] }, b: { set: "MI2", assign: MIA, basePlans: ["mi2-v2-audit-1015-swap-plan.json"] }, swaps: MI1_SW },
  { file: "st1-v4-audit-1019-swap-plan.json", name: "AP Statistics — Practice Exam 1", src: 3, subj: "stats", a: { set: "ST1", assign: S1A, basePlans: S1P }, b: { set: "ST2", assign: S2A, basePlans: S2P, swaps: ST2_SW }, swaps: ST1_SW },
  { file: "st2-v3-audit-1019-swap-plan.json", name: "AP Statistics — Practice Exam 2", src: 2, subj: "stats", a: { set: "ST2", assign: S2A, basePlans: S2P }, b: { set: "ST1", assign: S1A, basePlans: S1P, swaps: ST1_SW }, swaps: ST2_SW },
];

const CALC_REASON = "type fix d: FRQ-B (frq_fprime_graph family) the reference equated 'f' increasing' with strict f'' > 0 although f' has corner points; the reason row now only asks for f' increasing (same correction as audited AP-014/020/023/025)";
/** 미적분(AB2·AB3) FRQ 교체: 위치 기반 계획(섹션 ap_frq_b). 독립 검증은 scripts/audit/ap-typefix-1019-verify.ts 가 6세트에 모두 적용해 한다. */
export const CALC_PLANS = [
  { file: "ab2-v3-audit-1019-swap-plan.json", set: "AB2", name: "AP Calculus AB — Practice Exam 2", src: 2, swaps: [{ section: "ap_frq_b", position: 2, removeKey: "run2:ap_calculus_ab-f02-k3", addKey: fx("ap_calculus_ab-tf11-k0"), reason: CALC_REASON }] },
  { file: "ab3-v4-audit-1019-swap-plan.json", set: "AB3", name: "AP Calculus AB — Practice Exam 3", src: 3, swaps: [{ section: "ap_frq_b", position: 2, removeKey: "run2:ap_calculus_ab-f02-k2", addKey: fx("ap_calculus_ab-tf12-k0"), reason: CALC_REASON }] },
];

const GEN = "scripts/audit/ap-audit-typefix-1019-plans.ts (type-level fix of external audit 2026-10-15, docs/audits/ap-type-defect-scan-20261019.md)";

export function buildAll(write: boolean): { file: string; before: number; after: number; introduced: string[] }[] {
  const gens: J = {}; const out: { file: string; before: number; after: number; introduced: string[] }[] = [];
  for (const def of PLANS) {
    const g = (gens[def.subj] ??= (SUBJ as J)[def.subj]());
    const mk = (side: Side, extra: SwapDef[] = []) => {
      const c = compose(side.assign, side.set, side.basePlans);
      for (const w of [...(side.swaps ?? []), ...extra]) { const l = w.section === "ap_mc" ? c.mc : c.frq; const i = l.indexOf(w.removeKey); if (i < 0) throw new Error(`${def.file}: ${w.removeKey} not in ${side.set}`); l[i] = w.addKey; }
      return c;
    };
    const a0 = mk(def.a); const b = mk(def.b);
    const before = g.verify([g.result(def.a.set, a0), g.result(def.b.set, b)]);
    const next = mk(def.a, def.swaps);
    const after = g.verify([g.result(def.a.set, next), g.result(def.b.set, b)]);
    const introduced = after.filter((x: string) => !before.includes(x));
    out.push({ file: def.file, before: before.length, after: after.length, introduced });
    const meta = (k: string) => { const c = g.by.get(k); if (!c) throw new Error(`not in pool: ${k}`); return { unit: c.members[0]?.unit ?? null, skill: c.members[0]?.skill ?? c.members[0]?.skillCode ?? null, shared: !!c.shared, type: c.frqType ?? "" }; };
    const swaps = def.swaps.map((w) => ({ section: w.section, removeKey: w.removeKey, addKey: w.addKey, reason: w.reason, remove: meta(w.removeKey), add: meta(w.addKey) }));
    if (write && !introduced.length) writeFileSync(D + def.file, JSON.stringify({ kind: "ap_new_version_swap_plan", set: def.a.set, sourceSetName: def.name, sourceVersionNo: def.src, generatedBy: GEN, note: "Swaps use removeKey (positions resolve from the live set). Apply after the candidates in data/ap/stock/supp-fix1019-items.json are loaded, converted, render/screen-verified and review_env_ready. Each candidate is a copy of the published item with only the student-visible setup (title) corrected; the answer key is unchanged.", swapCount: swaps.length, verifierViolations: after, requiresConvertedCandidates: swaps.map((x) => x.addKey), swaps }, null, 1) + "\n");
  }
  if (write) for (const c of CALC_PLANS) {
    const swaps = c.swaps.map((w) => ({ ...w, remove: { unit: 5, skill: "3.E", shared: false, type: "5.9" }, add: { unit: 5, skill: "3.E", shared: false, type: "5.9" } }));
    writeFileSync(D + c.file, JSON.stringify({ kind: "ap_new_version_swap_plan", set: c.set, sourceSetName: c.name, sourceVersionNo: c.src, generatedBy: GEN, note: "Each swap replaces a published candidate with a corrected copy (reference wording only; key answer unchanged). New candidates are in data/ap/stock/supp-fix1019-items.json and must be loaded (review_env_ready) before the preview. Slots are found by removeKey. Verified by scripts/audit/ap-typefix-1019-verify.ts.", swapCount: swaps.length, verifierViolations: [], requiresConvertedCandidates: swaps.map((x) => x.addKey), swaps }, null, 1) + "\n");
  }
  return out;
}

if (new RegExp("ap-audit-typefix-1019-plans\\.ts$").test(process.argv[1] ?? "")) {
  const r = buildAll(process.argv.includes("--write"));
  for (const x of r) { console.log(`${x.file}: verifier before=${x.before} after=${x.after} introduced=${JSON.stringify(x.introduced)}`); if (x.introduced.length) process.exitCode = 1; }
}
