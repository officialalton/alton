// 보충 생성분 공개 전 감사(2026-10-06): 정답 독립 재계산 기록(verified)·explanation_en 존재·영어 전용·보기 중복·SPR 정답·그림 존재·난이도 표기를 점검한다. DB 접근 없음.
// 실행: npx tsx scripts/mock-exam-generation/gap-audit.ts <passed.json> [--write-clean <out.json>]   (통과분만 out 에 저장)
import { readFileSync, writeFileSync } from "node:fs";
type R = { gid: string; skill: string; difficulty: string; format: "mc" | "spr"; problem: { stimulus?: string; question?: string; options?: string[] | null; correctIndex?: number | null; answers?: string[] | null; explanation?: string; explanationEn?: string | null; figure?: unknown; needsFigure?: boolean }; quality: { mockExamGeneration?: { verification?: { verified?: number | null; method?: string }; archetypeId?: string; source?: string } } };
const file = process.argv[2]; const recs = JSON.parse(readFileSync(file, "utf-8")) as R[];
const HAN = /[가-힣]/; const bad: string[] = []; const clean: R[] = [];
for (const r of recs) {
  const p = r.problem; const issues: string[] = [];
  const v = r.quality.mockExamGeneration?.verification;
  const viaCompiler = r.quality.mockExamGeneration?.source;
  if (!v || (v.method === "verification_js" && (v.verified == null))) issues.push("no_independent_recompute");
  if (!p.explanationEn || p.explanationEn.trim().length < 40) issues.push("explanation_en_missing");
  const body = `${p.stimulus ?? ""}\n${p.question ?? ""}\n${(p.options ?? []).join("\n")}\n${(p.answers ?? []).join("\n")}\n${p.explanationEn ?? ""}`; // 한국어 해설(explanation)은 기존 정책대로 한글 허용
  if (HAN.test(body)) issues.push("hangul");
  if (r.format === "mc") {
    const o = (p.options ?? []).map((x) => x.trim().toLowerCase().replace(/\s+/g, ""));
    if (o.length !== 4 || new Set(o).size !== 4) issues.push("options_not_4_unique");
    if (p.correctIndex == null || p.correctIndex < 0 || p.correctIndex > 3) issues.push("bad_correct_index");
  } else if (!p.answers?.length) issues.push("spr_no_answers");
  if (p.needsFigure && !p.figure) issues.push("figure_missing");
  if (!["easy", "medium", "hard"].includes(r.difficulty)) issues.push("difficulty");
  void viaCompiler;
  if (issues.length) bad.push(`${r.gid} ${r.skill}|${r.difficulty}|${r.format}: ${issues.join(",")}`); else clean.push(r);
}
console.log(JSON.stringify({ total: recs.length, clean: clean.length, bad: bad.length }));
if (bad.length) console.log(bad.slice(0, 40).join("\n"));
const w = process.argv.indexOf("--write-clean"); if (w > 0) writeFileSync(process.argv[w + 1], JSON.stringify(clean));
