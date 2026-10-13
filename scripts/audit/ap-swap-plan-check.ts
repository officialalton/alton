// AP 교체 계획(관리자 패널로 적용할 파일)이 DB 의 "현재 공개 버전"에 아직 맞는지 읽기 전용으로 점검한다(2026-10-13). DB 에 쓰지 않는다.
//   npx tsx scripts/audit/ap-swap-plan-check.ts [--out data/audit/2026-10-13-ap-swap-readout.json]
// 점검: (1) 계획의 제거 문항이 공개 세트의 그 칸에 있는가(resolveSwaps = 패널과 같은 해석) (2) 추가 후보가 DB 에 적재(변환·검수 환경 준비·모의고사 용도·확정 공개)돼 있는가
// (3) 현재 공개 구성 6세트에 계획을 적용했을 때 독립 검증기(verifyAssignment) 위반이 0 인가.
import { readFileSync, writeFileSync } from "node:fs";
import { resolveSwaps, parseSwapPlan, type PlanSwapInput } from "../../lib/ap-admin/new-version";
import { loadPool, type Item } from "../ap-generation/assign-pool";
import { verifyAssignment, type SetResult, type Spec } from "../ap-generation/exact-assign";
import { dbSelect } from "./apply-audit-fixes";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const SETS: Record<string, string> = {
  AB1: "AP Calculus AB — Practice Exam", AB2: "AP Calculus AB — Practice Exam 2", AB3: "AP Calculus AB — Practice Exam 3",
  BC1: "AP Calculus BC — Practice Exam 1", BC2: "AP Calculus BC — Practice Exam 2", BC3: "AP Calculus BC — Practice Exam 3",
};
const PENDING_PLANS = ["ab3-v2-audit-swap-plan.json", "bc1-v3-frq-audit-swap-plan.json", "bc2-v2-audit-swap-plan.json"];
const SEC: Record<string, "mcA" | "mcB" | "frqA" | "frqB"> = { ap_mc_a: "mcA", ap_mc_b: "mcB", ap_frq_a: "frqA", ap_frq_b: "frqB" };

type SlotRow = { name: string; version_no: number; section: string; position: number; ap_candidate_key: string | null };
type CandRow = { candidate_key: string; release_tier: string; purpose: string | null; review_env_ready: boolean | null; kind: string | null; calculator: string | null; ap_subject_code: string | null; is_current: boolean | null };
type ProbRow = { ap_candidate_key: string; ap_item_index: number; status: string; archived_at: string | null; usage_scope: string; published_version_id: string | null };

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
function main() {
  const names = Object.values(SETS);
  const slots = dbSelect<SlotRow>(`select s.name, s.version_no, i.section, i.position, p.ap_candidate_key from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id and s.status = 'published' and s.archived_at is null join problems p on p.id = i.problem_id where s.name = any (array[${names.map(lit).join(",")}]) order by 1, 3, 4`);
  const versions = Object.fromEntries(names.map((n) => [n, slots.find((s) => s.name === n)?.version_no ?? null]));
  const plans = PENDING_PLANS.map((f) => ({ file: f, plan: parseSwapPlan(JSON.parse(readFileSync(`data/ap/stock/${f}`, "utf-8"))) }));
  const addKeys = [...new Set(plans.flatMap((p) => p.plan.swaps.map((s) => s.addKey)))];
  const cands = dbSelect<CandRow>(`select candidate_key, release_tier, purpose, review_env_ready, kind, calculator, ap_subject_code, is_current from ap_candidate_items where candidate_key = any (array[${addKeys.map(lit).join(",")}])`);
  const probs = dbSelect<ProbRow>(`select p.ap_candidate_key, p.ap_item_index, p.status::text as status, p.archived_at, p.usage_scope, p.published_version_id from problems p where p.ap_candidate_key = any (array[${addKeys.map(lit).join(",")}])`);
  const report: Record<string, unknown> = { generatedAt: new Date().toISOString(), publishedVersions: versions, plans: [] as unknown[] };
  const { all } = loadPool({ strictFamilies: true }); const byKey = new Map(all.map((c) => [c.key, c] as const));

  const keysOf = (name: string) => {
    const k = { mcA: [] as string[], mcB: [] as string[], frqA: [] as string[], frqB: [] as string[] };
    for (const s of slots.filter((x) => x.name === name)) k[SEC[s.section]][s.position - 1] = s.ap_candidate_key ?? "";
    return k;
  };
  type Keys = ReturnType<typeof keysOf>;
  const comp = new Map<string, Keys>(Object.entries(SETS).map(([id, name]): [string, Keys] => [id, keysOf(name)]));
  const spec = (id: string): Spec => ({ id, subj: id.startsWith("BC") ? "bc" : "ab", floor: id === "AB1" ? 9 : 10 });
  const mk = (id: string, ks: ReturnType<typeof keysOf>): SetResult => ({ id, mcA: ks.mcA.map((k) => byKey.get(k)!), mcB: ks.mcB.map((k) => byKey.get(k)!), virtual: [], frqA: ks.frqA.map((k) => byKey.get(k)!), frqB: ks.frqB.map((k) => byKey.get(k)!), frqVirtual: [] });
  const verify = (m: Map<string, ReturnType<typeof keysOf>>) => { const ids = [...m.keys()]; const missing = ids.flatMap((i) => Object.values(m.get(i)!).flat()).filter((k) => !byKey.get(k)); if (missing.length) return [`pool 에 없는 후보: ${[...new Set(missing)].join(", ")}`]; return verifyAssignment(ids.map(spec), ids.map((i) => mk(i, m.get(i)!)), new Set()); };
  const baseViol = verify(comp);
  console.log(`현재 공개 구성 6세트 검증기 위반 ${baseViol.length}${baseViol.length ? `: ${baseViol.slice(0, 4).join(" | ")}` : ""}`);
  console.log(`공개 버전: ${Object.entries(versions).map(([n, v]) => `${n.replace("AP Calculus ", "")} v${v}`).join(", ")}`);

  const trial = new Map<string, Keys>([...comp].map(([id, k]): [string, Keys] => [id, { mcA: [...k.mcA], mcB: [...k.mcB], frqA: [...k.frqA], frqB: [...k.frqB] }]));
  const unloaded = new Set<string>();
  for (const { file, plan } of plans) {
    const name = plan.sourceSetName; const setId = Object.entries(SETS).find(([, n]) => n === name)?.[0] ?? "?";
    const sl = slots.filter((s) => s.name === name).map((s) => ({ section: s.section, position: s.position, candidateKey: s.ap_candidate_key }));
    const res = resolveSwaps(plan.swaps as PlanSwapInput[], sl);
    const lines: string[] = [];
    const ok = { versionMatches: plan.sourceVersionNo === undefined || plan.sourceVersionNo === versions[name], slotsResolve: res.problems.length === 0 };
    if (!ok.versionMatches) lines.push(`계획 sourceVersionNo ${plan.sourceVersionNo} ≠ 현재 공개 v${versions[name]}`);
    lines.push(...res.problems);
    const adds = plan.swaps.map((s) => {
      const c = cands.find((x) => x.candidate_key === s.addKey); const pr = probs.filter((p) => p.ap_candidate_key === s.addKey);
      const loaded = !!c && ["review_env", "launch"].includes(c.release_tier) && c.purpose === "mock_exam" && c.review_env_ready === true && pr.length > 0 && pr.every((p) => p.status === "confirmed" && !p.archived_at && !!p.published_version_id && ["mock_exam", "both"].includes(p.usage_scope));
      if (!loaded) unloaded.add(s.addKey);
      return { addKey: s.addKey, section: s.section, position: s.position, loaded, candidate: c ? { tier: c.release_tier, purpose: c.purpose, reviewEnvReady: c.review_env_ready } : null, problems: pr.length };
    });
    for (const a of adds) if (!a.loaded) lines.push(`미적재 후보: ${a.addKey} ${JSON.stringify(a.candidate)} problems=${a.problems}`);
    const k = trial.get(setId)!;
    for (const s of plan.swaps) { const g = SEC[s.section]; const idx = (s.position ?? 0) - 1; if (idx >= 0 && k[g][idx] === s.removeKey) k[g][idx] = s.addKey; }
    (report.plans as unknown[]).push({ file, set: setId, sourceVersionNo: plan.sourceVersionNo, publishedVersion: versions[name], ...ok, adds, problems: lines });
    console.log(`${file}: ${lines.length ? "문제 있음" : "OK"} (set ${setId}, 계획 v${plan.sourceVersionNo} / 공개 v${versions[name]}, 교체 ${plan.swaps.length})`);
    for (const l of lines) console.log(`   - ${l}`);
  }
  const after = verify(trial);
  console.log(`교체 3계획 적용 후 6세트 검증기 위반 ${after.length}${after.length ? `: ${after.slice(0, 5).join(" | ")}` : ""}`);
  report.verifier = { baseViolations: baseViol, afterViolations: after }; report.unloadedCandidates = [...unloaded];
  if (unloaded.size) console.log(`적재 필요 후보 ${unloaded.size}개: ${[...unloaded].join(", ")}`);
  const out = arg("--out"); if (out) { writeFileSync(out, JSON.stringify(report, null, 1) + "\n"); console.log(`wrote ${out}`); }
}
void ([] as Item[]);
if (process.argv[1]?.endsWith("ap-swap-plan-check.ts")) { try { main(); } catch (e) { console.error(String((e as Error).message ?? e)); process.exit(1); } }
