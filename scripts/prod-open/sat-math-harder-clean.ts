// SAT 수학 상향 2단계: gap-bulk 가 만든 신규 hard 후보에서 (1) 은행과 정확히 같은 문항, (2) 다른 원형과 3-gram 0.6 이상 근접 문항, (3) 외부 오류 신고(2026-10-18) 결함 규칙에 걸리는 문항,
// (4) 그래프+식 같은 곡선 이중 제시, (5) π 보기 혼재를 빼고 final/adopted-all.json 으로 쓴다. DB 접근 없음(입력은 파일).
//   npx tsx scripts/prod-open/sat-math-harder-clean.ts --in data/.../passed.json --bank tmp/bank-dump-math/all-content.json --out data/.../final/adopted-all.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { exactKey, findNearDuplicate, shingles, type PoolEntry } from "../mock-exam-generation/dup-rule";
import { planSatErrorReportFix } from "../../lib/audit-fix/sat-error-report-1018";
import { findAwkwardFraming, stripMetaLead } from "../../lib/problem-generation/awkward-framing";
import { hasGraphAndExpressionForSameCurves } from "../../lib/problem-generation/graph-expression-redundancy";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const recs = JSON.parse(readFileSync(arg("--in")!, "utf8")) as any[];
const bank = JSON.parse(readFileSync(arg("--bank")!, "utf8")) as any[];
const exact = new Set<string>(); const bySkill = new Map<string, (PoolEntry)[]>();
for (const b of bank) {
  exact.add(exactKey(b.passage ?? "", b.question ?? null, b.options));
  (bySkill.get(b.skill_code) ?? bySkill.set(b.skill_code, []).get(b.skill_code)!).push({ problemId: b.problem_id, sh: shingles(`${b.passage ?? ""} ${b.question ?? ""} ${(b.options ?? []).join(" ")}`), group: b.similarity_group ?? null });
}
const piMixed = (p: any) => /in terms of (π|pi)/i.test(`${p.passage ?? ""} ${p.question ?? ""}`) && !!p.options && p.options.some((o: string) => /π/.test(o)) && p.options.some((o: string) => !/π/.test(o));
const drop: Record<string, number> = {}; const out: any[] = [];
const bump = (k: string) => { drop[k] = (drop[k] ?? 0) + 1; };
for (const r of recs) {
  const p = r.problem; if (p.stimulus) p.stimulus = stripMetaLead(p.stimulus); if (p.passage) p.passage = stripMetaLead(p.passage); const text = `${p.stimulus ?? ""}\n\n${p.question ?? ""}`;
  const stem = p.stimulus ?? p.passage ?? "";
  if (exact.has(exactKey(stem, p.question ?? null, p.options))) { bump("exact_dup"); continue; }
  const sh = shingles(`${stem} ${p.question ?? ""} ${(p.options ?? []).join(" ")}`);
  const group = r.quality?.mockExamGeneration?.archetypeId ?? null;
  const pool = bySkill.get(r.skill) ?? [];
  if (findNearDuplicate(sh, group, pool)) { bump("near_dup"); continue; }
  const row = { passage: p.passage ?? stem, question: p.question ?? null, options: p.options ?? null, correct_index: p.correctIndex ?? null, explanation: p.explanation ?? null, explanation_en: p.explanationEn ?? null, figure: p.figure ?? null };
  if (/[가-힣]/.test(`${stem} ${p.question ?? ""} ${(p.options ?? []).join(" ")} ${p.explanationEn ?? ""}`) || !p.explanationEn) { bump("hangul_or_no_explanation_en"); continue; }
  { const f = findAwkwardFraming(`${stem} ${p.question ?? ""}`); if (f) { bump(`framing:${f.rule}`); continue; } }
  const hit = planSatErrorReportFix(row);
  if (hit) { bump(`rule:${hit.rule}`); continue; }
  if (piMixed(row)) { bump("pi_mixed"); continue; }
  if (p.figure && hasGraphAndExpressionForSameCurves(p.figure, text)) { bump("graph_and_expression"); continue; }
  pool.push({ problemId: r.gid, sh, group }); bySkill.set(r.skill, pool); exact.add(exactKey(stem, p.question ?? null, p.options));
  out.push(r);
}
const o = path.resolve(arg("--out")!); mkdirSync(path.dirname(o), { recursive: true }); writeFileSync(o, JSON.stringify(out));
const by: Record<string, number> = {}; for (const r of out) { const k = `${r.skill}|${r.format}`; by[k] = (by[k] ?? 0) + 1; }
console.log(JSON.stringify({ in: recs.length, kept: out.length, dropped: drop, by }, null, 1));
