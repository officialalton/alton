// hard 승격 변형 (2026-09-30 총괄·오너 지시). DB 접근 없음.
// 실행: npx tsx scripts/mock-exam-generation/promote.ts --run <id> --skills a,b --per-skill N [--round P1] [--concurrency 8]
//   검수 통과한 medium 문항(같은 skill, 자료 없는 것)을 기반으로 hard 변형본을 '별개 새 문항'으로 raw/ 에 추가한다(원본 유지).
//   변형 지시: Math — 풀이 단계 추가·개념 결합·오답을 풀이 중간값/오개념 기반으로 교체 / RW — 지문 논리를 더 미묘하게·비교 단서 추가.
//   정답이 바뀌면 정답·해설 재작성. 변형본은 review.ts → repair.ts 를 원본 문항과 똑같이 거친다.
import Anthropic from "@anthropic-ai/sdk";
import { generationModel, reviewModel, weakModel } from "../../lib/problem-generation/models";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { evaluateAll, loadRun } from "./aggregate-lib";
import type { Raw } from "./review";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const RW_GUIDE = "R&W 승격: 지문의 논리를 더 미묘하게 만든다 — 결론이 지문에 직접 나오지 않고 두 문장 이상을 종합해야 하게, 비교·대조·조건 단서(however/only when/unlike 등)를 추가해 핵심 관계를 놓치면 틀리게 한다. 선지 3개 오답은 각각 '지문의 일부만 맞는' 서로 다른 오개념(범위 과장, 원인·결과 전도, 화자/텍스트 혼동, 부분 일치 등)이어야 한다. 소재·인물·수치는 원본과 완전히 다르게 새로 쓴다(원본 문장 재사용 금지).";
const MATH_GUIDE = "Math 승격: 풀이 단계를 1~2개 늘리고(예: 식 세우기 + 변형 + 계산) 다른 개념을 하나 결합한다. 오답 3개는 풀이 중간값(한 단계에서 멈춘 값)·부호/단위/조건 무시 같은 실제 오개념·계산 실수의 결과값이어야 한다. 숫자·맥락은 원본과 다르게 새로 만든다. 정답이 바뀌면 정답과 해설을 새로 계산해 일치시킨다. 수식은 $…$ 만 사용.";

async function promoteOne(base: Raw): Promise<Raw | null> {
  const p = base.problem;
  const isMath = base.examSystem === "sat_math";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const msg = await getClient().messages.create({
        model: generationModel(), max_tokens: 3500,
        tools: [{ name: "promote", description: "기반 문항을 hard 난이도의 새 문항으로 변형한다.", input_schema: { type: "object", properties: {
          passage: { type: "string", description: "지문/자료 텍스트(빈칸 ______ 포함, Text 1/Text 2 구조는 원본 형식 유지)" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" }, description: base.format === "mc" ? "선택지 4개(알파벳 접두어 없이)" : "SPR 이면 빈 배열" },
          correct_letter: { type: "string", description: "정답 알파벳 A-D (SPR 이면 빈 문자열)" },
          answers: { type: "array", items: { type: "string" }, description: "SPR 이면 정답 집합, 객관식이면 빈 배열" },
          explanation: { type: "string", description: "한국어 해설. 정답 근거와 각 오답이 틀린 이유(선지 알파벳 기준)" },
          hard_design: { type: "string", description: "hard 가 되는 이유(추론/풀이 단계 수, 오개념 설계) 한두 문장" },
        }, required: ["passage", "question", "options", "correct_letter", "answers", "explanation", "hard_design"] } as never }],
        tool_choice: { type: "tool", name: "promote" },
        messages: [{ role: "user", content: `아래 검수 통과 medium 문항을 바탕으로 **hard** 난이도의 새 문항을 만드세요. hard 의 정의: 정답에 도달하려면 여러 문장/여러 풀이 단계를 종합해야 하고, 오답 3개가 모두 정답과 핵심 정보를 일부 공유해 근거 없이는 지워지지 않는다.
${isMath ? MATH_GUIDE : RW_GUIDE}
원본과 본문 유사도가 높으면 폐기되므로 소재·수치·문장을 충분히 바꾼다. 같은 세부 기술(${base.skill}) 유형과 형식(${base.format})·지문 구조 규칙은 유지한다. 정답 위치는 원본과 다른 자리로 해도 된다.

[원본 지문/자료]
${p.stimulus ?? p.passage ?? ""}

[원본 질문]
${p.question ?? ""}

[원본 선택지]
${(p.options ?? []).map((o, i) => `${String.fromCharCode(65 + i)}) ${o}${i === p.correctIndex ? "   <- 정답" : ""}`).join("\n")}
${base.format === "spr" ? `[원본 정답] ${(p.answers ?? []).join(" / ")}` : ""}

[원본 해설]
${p.explanation}` }],
      });
      const tu = msg.content.find((c) => c.type === "tool_use");
      if (!tu || tu.type !== "tool_use") continue;
      const o = tu.input as { passage: string; question: string; options: string[]; correct_letter: string; answers: string[]; explanation: string; hard_design: string };
      const ci = base.format === "mc" ? "ABCD".indexOf(o.correct_letter.toUpperCase()) : null;
      if (base.format === "mc" && (o.options.length !== 4 || ci === null || ci < 0)) continue;
      if (base.format === "spr" && !o.answers.length) continue;
      const stimulus = o.passage.trim();
      return {
        gid: randomUUID(), generatedAt: new Date().toISOString(), runId: base.runId, skill: base.skill, domain: base.domain, examSystem: base.examSystem, difficulty: "hard", format: base.format,
        quality: { promotedFrom: base.gid, hardDesign: o.hard_design } as never,
        problem: { passage: `${stimulus}${stimulus ? "\n\n" : ""}${o.question.trim()}`, stimulus, question: o.question.trim(), options: base.format === "mc" ? o.options.map((x) => x.trim()) : null, correctIndex: ci, answers: base.format === "spr" ? o.answers : null, explanation: o.explanation.trim(), figure: null, statements: null },
      } as Raw;
    } catch { await new Promise((r) => setTimeout(r, 3000)); }
  }
  return null;
}

async function main() {
  const runId = arg("--run")!;
  const skills = (arg("--skills") ?? "").split(",").filter(Boolean);
  const perSkill = Number(arg("--per-skill") ?? 2);
  const tag = arg("--round") ?? "p1";
  const concurrency = Number(arg("--concurrency") ?? 8);
  const base = path.resolve("data/mock-exam-generation", runId);
  const run = loadRun(base);
  const ev = evaluateAll(run);
  const usedBases = new Set(run.raws.map((r) => (r.quality as { promotedFrom?: string } | undefined)?.promotedFrom).filter(Boolean) as string[]);
  const jobs: Raw[] = [];
  for (const skill of skills) {
    const pool = ev.filter((e) => e.verdict === "pass" && e.raw.skill === skill && e.finalDifficulty === "medium" && !e.raw.problem.figure && !usedBases.has(e.raw.gid) && !(e.raw.quality as { promotedFrom?: string })?.promotedFrom);
    for (const e of pool.slice(0, perSkill)) jobs.push({ ...e.raw, problem: { ...e.raw.problem, options: e.repaired ? (run.repairs.get(e.raw.gid)?.after?.options ?? e.raw.problem.options) : e.raw.problem.options } });
  }
  process.stderr.write(`승격 변형 대상 ${jobs.length}\n`);
  let ok = 0;
  const q = [...jobs];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (q.length) {
      const b = q.shift()!;
      const v = await promoteOne(b);
      if (v) { writeFileSync(path.join(base, "raw", `${v.skill}__hard__${v.format}__${tag}__${v.gid}.json`), JSON.stringify({ ...v, problem: v.problem })); ok++; }
    }
  }));
  process.stderr.write(`승격 완료 ${ok}/${jobs.length}\n`);
}
if (process.argv[1]?.endsWith("promote.ts")) main().catch((e) => { console.error(e); process.exit(1); });
