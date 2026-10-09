// data/ap/sample-2027/<run>/{report.json,candidates.json,cells.json} → docs/ap/sample-report-<run>.md (요약 표). API·DB 없음.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const run = process.argv[2] ?? "run1";
const root = path.resolve(process.cwd(), "data/ap/sample-2027");
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rep = JSON.parse(readFileSync(path.join(root, run, "report.json"), "utf-8")) as J;
const cands = JSON.parse(readFileSync(path.join(root, run, "candidates.json"), "utf-8")) as J[];
const adopted = cands.filter((c) => c.reviewState === "pending_expert_review" && !c.reserve);
const n = (x: number) => String(x);
const tally = (xs: string[]) => xs.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});
const itemsOf = (c: J) => (c.kind === "mc" ? (c.structure === "shared_stimulus_set" ? (c.payload.items?.length ?? 0) : 1) : 0);
const lines: string[] = [];
lines.push(`# AP 샘플 생성 보고 (${run})`, "", `생성: ${rep.generatedAt} · 총 비용 $${rep.totalCostUsd} (상한 $${rep.cap}) · 호출 ${rep.calls}건 · 후보 ${rep.candidates} → 전체 통과 ${rep.passedAll} → 셀당 1개 채택 ${rep.adopted} (+ reserve ${rep.reserve})`, "");
lines.push("## 과목별 수율·비용", "", "| 과목 | 후보 | 통과 | 채택(칸 채움) | MC 문항 채택 | FRQ 번들 채택 | 수율(채택/후보) | 비용 | 호출/채택 | 미충전 칸 |", "|---|---|---|---|---|---|---|---|---|---|");
for (const [s, v] of Object.entries<J>(rep.bySubject)) lines.push(`| ${s} | ${v.candidates} | ${v.passedAll} | ${v.adoptedCandidates}/${v.cellsTotal} | ${v.mcItemsAdopted} | ${v.frqBundlesAdopted} | ${(v.yieldAdoptedOverCandidates * 100).toFixed(0)}% | $${v.costUsd} | ${v.callsPerAdopted} | ${v.unfilledCells.length} |`);
lines.push("", "## 반려 사유", "", "| 사유 | 건수 |", "|---|---|", ...Object.entries<number>(rep.rejectionReasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`));
for (const s of Object.keys(rep.bySubject)) {
  const a = adopted.filter((c) => c.apSubjectCode === s);
  lines.push("", `## 재고(채택 후보): ${s}`, "", "| 단원 | MC 문항 | FRQ 번들 |", "|---|---|---|");
  const units = [...new Set(a.map((c) => c.unitCode))].sort((x, y) => Number(x) - Number(y));
  for (const u of units) lines.push(`| ${u} | ${a.filter((c) => c.unitCode === u).reduce((m, c) => m + itemsOf(c), 0)} | ${a.filter((c) => c.unitCode === u && c.kind !== "mc").length} |`);
  const skills = tally(a.flatMap((c) => (c.kind === "mc" ? Array(itemsOf(c)).fill(c.skillPrimary) : [c.skillPrimary])));
  const struct = tally(a.map((c) => c.structure));
  const diff = tally(a.map((c) => c.difficultyProvisional ?? "(없음)"));
  lines.push("", `- 스킬: ${Object.entries(skills).map(([k, v]) => `${k}×${v}`).join(", ")}`, `- 구조: ${Object.entries(struct).map(([k, v]) => `${k}×${v}`).join(", ")}`, `- 잠정 난이도(근거는 후보 파일): ${Object.entries(diff).map(([k, v]) => `${k}×${v}`).join(", ")}`);
}
lines.push("", "## 중복·검수", "", `- 채택 후보 쌍 ${n(rep.duplicate.adoptedPairs)} 중 3-gram 유사(>0.5) ${n(rep.duplicate.similarPairs)}쌍`, `- Fable 표본 확인 ${rep.spotChecked}건`, `- 전원 \`pending_expert_review\` (학생 비노출). 전문가 검수 필요 시간 추정: MC 문항 ${adopted.reduce((m, c) => m + itemsOf(c), 0)}개 × 6분 + FRQ ${adopted.filter((c) => c.kind !== "mc").length}개 × 25분 + 세트/구조 검토 = 약 ${((adopted.reduce((m, c) => m + itemsOf(c), 0) * 6 + adopted.filter((c) => c.kind !== "mc").length * 25) / 60 + 3).toFixed(1)}시간.`);
writeFileSync(path.resolve(process.cwd(), `docs/ap/sample-report-${run}.md`), lines.join("\n") + "\n");
console.log(lines.join("\n"));
