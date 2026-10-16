// RW 게시 문항 렌더 무결성 감사(읽기 전용, 2026-10-08). 입력: 덤프 JSON(아래 dump 스크립트) → 결과 JSON.
// 실행: npx tsx scripts/qa/rw-render-integrity-audit.ts <dump.json> <out.json>
// 덤프는 서비스 키(stdin)로 problems/problem_versions(published)/mock_exam_* 를 SELECT 만 한다(키 출력·저장 금지).
import { readFileSync, writeFileSync } from "node:fs";
import { checkRwStructure, countUnderlines, quotedTargetWord, rwDataReference } from "../../lib/rw-stimulus";

type Row = { id: string; sat_domain: string; skill_code: string | null; usage_scope: string; archived_at: string | null; problem_versions: { id: string; version_no: number; passage: string | null; question: string | null; options: string[] | null; figure: unknown }[] };
const d = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const setsById = new Map<string, { name: string; status: string }>(d.mock_exam_sets.map((s: { id: string; name: string; status: string }) => [s.id, s]));
const startedSets = new Set<string>(d.mock_exam_attempts.filter((a: { started_at: string | null }) => a.started_at).map((a: { exam_set_id: string }) => a.exam_set_id));
const attemptsBySet = new Map<string, number>();
for (const a of d.mock_exam_attempts as { exam_set_id: string }[]) attemptsBySet.set(a.exam_set_id, (attemptsBySet.get(a.exam_set_id) ?? 0) + 1);

const LOOSE_DATA = /\b(?:table|graph|chart|diagram|infographic|bar graph|scatterplot|histogram)\b/i;
const out: any[] = [];
let scanned = 0;
for (const p of d.items as Row[]) {
  if (p.archived_at || !["mock_exam", "both"].includes(p.usage_scope)) continue;
  const v = p.problem_versions[0]; if (!v) continue; scanned++;
  const passage = v.passage ?? "", question = v.question ?? "";
  const text = `${passage}\n${question}`;
  const hasFig = !!(v.figure && typeof v.figure === "object");
  const hasMdTable = /^\s*\|.*\|\s*$/m.test(passage);
  const defects: string[] = [];
  const strict = rwDataReference(text);
  if (strict && !hasFig && !hasMdTable && p.skill_code !== "command_of_evidence_quant") defects.push("data_ref_no_figure");
  else if (!strict && LOOSE_DATA.test(text) && !hasFig && !hasMdTable) defects.push("data_word_loose_no_figure");
  if (p.skill_code === "command_of_evidence_quant" && !hasFig) defects.push("quant_no_figure");
  const underRef = /\bunderlin/i.test(text);
  if (underRef && countUnderlines(passage) === 0) defects.push("underlined_ref_no_markup");
  const target = quotedTargetWord(question);
  let quoted: "none" | "renderer_underlines" | "target_missing" = "none";
  if (target && countUnderlines(passage) === 0) {
    const found = new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(passage);
    quoted = found ? "renderer_underlines" : "target_missing";
    if (!found) defects.push("quoted_target_missing_in_passage");
  }
  const gate = checkRwStructure({ skillCode: p.skill_code, passage: `${passage}\n\n${question}`.trim(), options: v.options, figure: v.figure }).filter((i) => ["rw_data_missing", "rw_target"].includes(i.code)).map((i) => i.message);
  const sets = (d.mock_exam_set_items as any[]).filter((i) => i.problem_id === p.id && i.problem_version_id === v.id).map((i) => {
    const s = setsById.get(i.exam_set_id)!;
    return { name: s.name, status: s.status, module: i.module_key, position: i.position, setId: i.exam_set_id, started: startedSets.has(i.exam_set_id), attempts: attemptsBySet.get(i.exam_set_id) ?? 0 };
  });
  if (defects.length || quoted === "renderer_underlines") out.push({ problemId: p.id, versionId: v.id, versionNo: v.version_no, skill: p.skill_code, domain: p.sat_domain, defects, quoted, target, gate, hasFigure: hasFig, sets, question: question.slice(0, 160), passageHead: passage.slice(0, 120) });
}
writeFileSync(process.argv[3], JSON.stringify({ scanned, rows: out }, null, 1));
console.log("scanned", scanned, "flagged", out.length);
