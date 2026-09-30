// 보수 패스: '쉽게 지워지는 오답'만 고친다 (2026-09-29 총괄 지시). DB 접근 없음.
// 실행: npx tsx scripts/mock-exam-generation/repair.ts --run <run-id> [--plan plan.json] [--concurrency 8] [--only-short]
//   대상: 현재 규칙 집계에서 보관 사유가 weak_distractors 하나뿐인 객관식 문항(문항당 보수 1회).
//   지문·질문·정답 위치·정답 선지는 그대로, 쉽게 지워진다고 판정된 선지만 '그럴듯한 오개념/계산 실수' 오답으로 교체하고
//   해설 중 교체된 선지를 설명하는 문장만 맞춘다. 보수본은 블라인드 풀이·감사(review.ts reviewOne)를 다시 통과해야 한다.
//   출력: <run>/repair/<gid>.json (before/after diff 로그), <run>/review-repaired/<gid>.json (재검수 결과).
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { reviewOne, type Raw, type ReviewResult } from "./review";
import { evaluateAll, loadRun } from "./aggregate-lib";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

async function repairOne(r: Raw, flagged: number[]): Promise<{ options: string[]; explanation: string; note: string } | null> {
  const p = r.problem;
  const stim = p.stimulus ?? p.passage ?? "";
  const opts = p.options ?? [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const msg = await getClient().messages.create({
        model: "claude-sonnet-5", max_tokens: 2500,
        tools: [{ name: "repair_distractors", description: "쉽게 지워지는 오답 선지만 교체한다.", input_schema: { type: "object", properties: {
          replacements: { type: "array", items: { type: "object", properties: { index: { type: "number" }, text: { type: "string" }, misconception: { type: "string", description: "이 오답이 기반한 구체적 오개념·계산 실수(한국어 한 줄)" } }, required: ["index", "text", "misconception"] } },
          explanation: { type: "string", description: "해설 전체. 교체된 선지를 설명하던 문장만 새 선지에 맞게 고치고 나머지는 글자 그대로 유지" },
        }, required: ["replacements", "explanation"] } as never }],
        tool_choice: { type: "tool", name: "repair_distractors" },
        messages: [{ role: "user", content: `디지털 SAT 문항의 오답 선지 일부가 피상적으로 읽어도 쉽게 지워집니다. 아래 "교체 대상" 선지만, 학생이 실제로 저지를 법한 오개념·계산 실수(R&W는 범위 오류·일부만 맞는 진술·화자/관계 혼동·과장, Math는 부호·단위·한 단계 누락·조건 무시·공식 오적용)에 기반한 그럴듯한 오답으로 바꾸세요.
엄격한 제약: 지문·질문·정답 선지·정답 위치·교체 대상이 아닌 선지는 절대 바꾸지 않는다. 새 선지는 정답과 구분되는 명백한 오답이어야 하고(두 번째 정답이 되면 안 됨), 다른 선지와 중복되지 않으며, 길이·문법 구조·표기 형식(수식 $…$ 사용 방식, 영어 유지)이 기존 선지와 비슷해야 한다. 정답이 더 길거나 더 구체적이어서 드러나지 않게 한다.
유형: ${r.skill} · 난이도 라벨: ${r.difficulty}

[지문/자료]
${stim}
${p.figure ? "\n(자료 있음 — 자료 수치와 모순되지 않게)\n" : ""}
[질문]
${p.question ?? ""}

[선택지]
${opts.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}${i === p.correctIndex ? "   <- 정답(수정 금지)" : flagged.includes(i) ? "   <- 교체 대상" : ""}`).join("\n")}

[해설]
${p.explanation}` }],
      });
      const tu = msg.content.find((c) => c.type === "tool_use");
      if (!tu || tu.type !== "tool_use") continue;
      const inp = tu.input as { replacements?: { index: number; text: string; misconception: string }[]; explanation?: string };
      const next = [...opts];
      const seen = new Set<number>();
      for (const rep of inp.replacements ?? []) if (flagged.includes(rep.index) && rep.index !== p.correctIndex && rep.text?.trim()) { next[rep.index] = rep.text.trim(); seen.add(rep.index); }
      if (seen.size !== flagged.length || new Set(next.map((o) => o.trim().toLowerCase())).size !== next.length) continue;
      return { options: next, explanation: (inp.explanation ?? p.explanation).trim() || p.explanation, note: (inp.replacements ?? []).map((x) => `${String.fromCharCode(65 + x.index)}: ${x.misconception}`).join(" / ") };
    } catch { await new Promise((res) => setTimeout(res, 3000 * (attempt + 1))); }
  }
  return null;
}

async function main() {
  const runId = arg("--run");
  if (!runId) throw new Error("--run 필요");
  const base = path.resolve("data/mock-exam-generation", runId);
  const concurrency = Number(arg("--concurrency") ?? 8);
  mkdirSync(path.join(base, "repair"), { recursive: true });
  mkdirSync(path.join(base, "review-repaired"), { recursive: true });
  const run = loadRun(base);
  const evals = evaluateAll(run);
  const todo = evals.filter((e) => e.verdict === "archive" && e.reasons.length === 1 && e.reasons[0] === "weak_distractors" && e.raw.format === "mc"
    && !existsSync(path.join(base, "repair", `${e.raw.gid}.json`)));
  process.stderr.write(`보수 대상 ${todo.length}\n`);
  let n = 0;
  const q = [...todo];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (q.length) {
      const e = q.shift()!;
      const r = e.raw;
      const flagged = (e.review?.blind?.easilyEliminated ?? []).filter((i) => i !== r.problem.correctIndex);
      const rep = flagged.length ? await repairOne(r, flagged) : null;
      const log = { gid: r.gid, skill: r.skill, difficulty: r.difficulty, flagged, ok: Boolean(rep), before: { options: r.problem.options, explanation: r.problem.explanation }, after: rep ? { options: rep.options, explanation: rep.explanation, misconceptions: rep.note } : null };
      writeFileSync(path.join(base, "repair", `${r.gid}.json`), JSON.stringify(log));
      if (rep) {
        const fixed: Raw = { ...r, problem: { ...r.problem, options: rep.options, explanation: rep.explanation } };
        try {
          const res: ReviewResult = await reviewOne(fixed);
          writeFileSync(path.join(base, "review-repaired", `${r.gid}.json`), JSON.stringify(res));
        } catch (err) { process.stderr.write(`재검수 오류 ${r.gid}: ${err instanceof Error ? err.message : err}\n`); }
      }
      if (++n % 10 === 0) process.stderr.write(`보수 ${n}/${todo.length}\n`);
    }
  }));
  process.stderr.write("보수 완료\n");
}
if (process.argv[1]?.endsWith("repair.ts")) main().catch((e) => { console.error(e); process.exit(1); });
