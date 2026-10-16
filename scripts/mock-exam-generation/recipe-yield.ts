// 레시피 수율표 (2026-09-30): skill별 최초 후보 수 -> 파이프라인 통과 -> 정답 검수 -> 레시피 준수 -> hard 적합 -> 채택, 탈락 원인, 호출 수, 채택 1문항당 총 호출.
// 실행: npx tsx scripts/mock-exam-generation/recipe-yield.ts --run <id> --tag rc1 [--old r7]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const base = path.resolve("data/mock-exam-generation", arg("--run")!);
type C = { gid: string; source: string; skill: string; system: string; correctOk: boolean; strong3: number; compliance: { ok: boolean } | null; hardFit: { ok: boolean }; adopted: boolean; reviewReasons: string[]; calls: { review: number; compliance: number; hardFit: number; strong: number } };
const checks = readdirSync(path.join(base, "recipe-check")).map((f) => JSON.parse(readFileSync(path.join(base, "recipe-check", f), "utf-8")) as C);
const stats = existsSync(path.join(base, "recipe-gen-stats.jsonl")) ? readFileSync(path.join(base, "recipe-gen-stats.jsonl"), "utf-8").trim().split("\n").map((l) => JSON.parse(l) as { tag: string; skill: string; candidates: number; accepted: number; modelCallsTotalEst: number }) : [];
const rows: Record<string, unknown>[] = [];
const agg = (src: string, label: string) => {
  const bySkill = new Map<string, C[]>();
  for (const c of checks.filter((x) => x.source === src)) (bySkill.get(c.skill) ?? bySkill.set(c.skill, []).get(c.skill)!).push(c);
  const tot = { cand: 0, acc: 0, correct: 0, comp: 0, fit: 0, adopted: 0, calls: 0 };
  for (const [skill, cs] of [...bySkill].sort()) {
    const st = stats.filter((s) => s.tag === src && s.skill === skill);
    const cand = st.reduce((a, s) => a + s.candidates, 0) || cs.length;
    const genCalls = st.reduce((a, s) => a + s.modelCallsTotalEst, 0);
    const chkCalls = cs.reduce((a, c) => a + c.calls.review + c.calls.compliance + c.calls.hardFit + c.calls.strong, 0);
    const adopted = cs.filter((c) => c.adopted).length;
    const reasons: Record<string, number> = {};
    for (const c of cs) { if (!c.correctOk) for (const r of c.reviewReasons) reasons[r.replace(/:.*/, "")] = (reasons[r.replace(/:.*/, "")] ?? 0) + 1; if (c.compliance && !c.compliance.ok) reasons["recipe_noncompliant"] = (reasons["recipe_noncompliant"] ?? 0) + 1; if (!c.hardFit.ok) reasons["hard_fit_fail"] = (reasons["hard_fit_fail"] ?? 0) + 1; }
    rows.push({ method: label, skill, system: cs[0].system, candidates: cand, pipelineAccepted: cs.length, correctOk: cs.filter((c) => c.correctOk).length, complianceOk: cs.filter((c) => c.compliance?.ok ?? true).length, hardFitOk: cs.filter((c) => c.hardFit.ok).length, adopted, strong3All: cs.filter((c) => c.strong3 === 3).length, calls: genCalls + chkCalls, callsPerAdopted: adopted ? Math.round((genCalls + chkCalls) / adopted) : null, dropReasons: reasons });
    tot.cand += cand; tot.acc += cs.length; tot.correct += cs.filter((c) => c.correctOk).length; tot.comp += cs.filter((c) => c.compliance?.ok ?? true).length; tot.fit += cs.filter((c) => c.hardFit.ok).length; tot.adopted += adopted; tot.calls += genCalls + chkCalls;
  }
  return tot;
};
const t1 = agg(arg("--tag") ?? "rc1", "recipe");
const t2 = arg("--old") ? agg(arg("--old")!, "archetype(old)") : null;
console.log(JSON.stringify({ rows, totals: { recipe: t1, archetypeOld: t2 } }, null, 1));
