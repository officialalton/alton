// 2026-09-18 — command_of_evidence_quant hard 재검증 진단 스크립트.
// problem-quality-batch.ts는 실패 사유를 160자로 자르고 figure/options/정답/근거모델 필드를
// 전혀 남기지 않는다. 제품 오너가 실패 6건 전체 상세(figure 데이터, 근거 문장, 선택지 4개, 정답,
// distractor_error_types)를 요구해서, pipeline.ts의 Failure.raw(이번에 추가한 진단 전용 필드)를
// 그대로 마크다운으로 덤프한다. DB에 저장하지 않는다.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { runGenerationPipeline } = await import("../lib/problem-generation/pipeline");
  const difficulty = (process.argv.find((a) => a.startsWith("--difficulty="))?.split("=")[1] ?? "hard") as "easy" | "medium" | "hard";
  const count = Number(process.argv.find((a) => a.startsWith("--count="))?.split("=")[1] ?? "10");
  const out = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1] ?? `docs/2026-09-18-quant-evidence-${difficulty}-full-detail.md`;

  process.stderr.write(`▶ command_of_evidence_quant ${difficulty} count=${count} (전체 상세 캡처) …\n`);
  const t0 = Date.now();
  const r = await runGenerationPipeline({
    subjectName: "SAT Reading & Writing",
    skillType: "Command of Evidence (Quantitative)",
    skillCode: "command_of_evidence_quant",
    examSystem: "sat_rw",
    difficulty,
    format: "mc",
    figurePolicy: "require_data" as never,
    count,
  });
  const seconds = Math.round((Date.now() - t0) / 1000);

  const lines: string[] = [];
  lines.push(`# command_of_evidence_quant ${difficulty} n=${count} — 실패 전수 상세(${new Date().toISOString().slice(0, 16).replace("T", " ")})`, "");
  lines.push(`accepted=${r.accepted.length}/${count}, 후보 평가 수=${r.stats.candidatesEvaluated}, 문항당 평균 호출=${(r.stats.modelCalls).toFixed(1)}, 총 ${seconds}초`, "");
  lines.push(`미해소 실패=${r.failures.filter((f) => !f.resolved).length}건, 해소된 실패(재생성으로 통과)=${r.failures.filter((f) => f.resolved).length}건`, "");

  lines.push("## 미해소 실패 전체 상세", "");
  const unresolved = r.failures.filter((f) => !f.resolved);
  unresolved.forEach((f, i) => {
    lines.push(`### 실패 ${i + 1} — [${f.stage}] ${f.reason}`, "");
    if (f.raw) {
      lines.push("**passage**:", "```", f.raw.passage ?? "(없음)", "```");
      lines.push("**question**:", "```", f.raw.question ?? "(없음)", "```");
      lines.push("**options** (정답 인덱스: " + (f.raw.correctIndex ?? "?") + "):");
      (f.raw.options ?? []).forEach((o, idx) => lines.push(`- ${String.fromCharCode(65 + idx)}${idx === f.raw!.correctIndex ? " (정답)" : ""}: ${o}`));
      lines.push("", "**figure**:", "```json", JSON.stringify(f.raw.figure, null, 2), "```");
      lines.push("**evidence_span (target=" + (f.raw.evidenceTarget ?? "?") + ")**: " + (f.raw.evidenceSpan ?? "(없음)"));
      lines.push("**answer_rationale**: " + (f.raw.answerRationale ?? "(없음)"));
      lines.push("**distractor_error_types**: " + JSON.stringify(f.raw.distractorErrorTypes ?? []));
    } else {
      lines.push("(raw 스냅샷 없음 — generate 단계 예외)");
    }
    lines.push("");
  });

  lines.push("## 해소된 실패(재생성으로 통과 — 참고용, 첫 시도가 왜 걸렸는지)", "");
  const resolved = r.failures.filter((f) => f.resolved);
  resolved.forEach((f, i) => {
    lines.push(`### 해소 ${i + 1} — [${f.stage}] ${f.reason}`, "");
  });

  writeFileSync(path.resolve(process.cwd(), out), lines.join("\n"));
  process.stderr.write(`✓ ${out} 작성 완료 (accepted=${r.accepted.length}/${count})\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
