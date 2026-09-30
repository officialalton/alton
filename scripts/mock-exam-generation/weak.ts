// 난이도 판정 기준 시험: 약한 모델(haiku)로 N회 독립 풀이 → 정답률, + 강한 모델 구조 루브릭(풀이 단계·결합 개념·함정 오답 수). DB 접근 없음.
// 실행: npx tsx scripts/mock-exam-generation/weak.ts --run <id> --mode calib|pool|gids [--per 20] [--n 5] [--gids file.json] [--concurrency 10]
//   결과: <run>/weak/<gid>.json  { gid, label, n, correct, acc, rubric:{steps,concepts,traps,score} }
//   calib: 최종 라벨별(easy/medium/hard)로 per 건씩 표본 → 정답률·루브릭이 라벨과 맞는지(타당성) 본다.
//   pool : 통과 문항 전부(또는 --gids 목록)에 적용 → hard 후보 선별.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { evaluateAll, loadRun } from "./aggregate-lib";
import type { Raw } from "./review";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
const WEAK = "claude-haiku-4-5";
const STRONG = "claude-sonnet-5";
const normSpr = (s: string) => { const t = s.trim().replace(/,/g, "").replace(/\s+/g, ""); const f = t.match(/^(-?\d+)\/(\d+)$/); const n = f ? Number(f[1]) / Number(f[2]) : Number(t); return Number.isFinite(n) ? String(Math.round(n * 10000) / 10000) : t; };

async function alt(figure: unknown): Promise<string> {
  if (!figure) return "";
  try { const { figureAlt } = await import("../../lib/problem-figures/alt"); return `\n[자료 설명]\n${figureAlt(figure as never) ?? ""}`; } catch { return ""; }
}
const body = async (r: Raw) => {
  const p = r.problem;
  const opts = r.format === "mc" ? `\n${(p.options ?? []).map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")}` : "";
  return `${p.stimulus ?? p.passage ?? ""}${await alt(p.figure)}\n\n${p.question ?? ""}${opts}`;
};

export async function weakSolve(r: Raw, n: number, model = WEAK): Promise<{ correct: number; answers: string[] }> {
  const text = await body(r);
  const ask = r.format === "mc" ? "정답 선지의 알파벳(A, B, C, D) 하나만 답하세요." : "최종 답(숫자 또는 분수)만 답하세요.";
  const answers: string[] = [];
  await Promise.all(Array.from({ length: n }, async () => {
    for (let a = 0; a < 3; a++) {
      try {
        const m = await getClient().messages.create({ model, max_tokens: 1500, temperature: 1,
          messages: [{ role: "user", content: `디지털 SAT 문제입니다. 직접 풀고 마지막 줄에 'ANSWER: <답>' 형식으로만 결론을 적으세요. ${ask}\n\n${text}` }] });
        const t = m.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("\n");
        const mm = t.match(/ANSWER:\s*\(?([^\n)]+)/i);
        answers.push(mm ? mm[1].trim() : "?");
        return;
      } catch { await new Promise((res) => setTimeout(res, 2000 * (a + 1))); }
    }
    answers.push("?");
  }));
  const p = r.problem;
  const correct = answers.filter((x) => r.format === "mc" ? x.trim().toUpperCase().startsWith(String.fromCharCode(65 + (p.correctIndex ?? 0))) : (p.answers ?? []).some((k) => normSpr(k) === normSpr(x))).length;
  return { correct, answers };
}

export async function rubric(r: Raw): Promise<{ steps: number; concepts: number; traps: number; score: number }> {
  const text = await body(r);
  for (let a = 0; a < 3; a++) {
    try {
      const m = await getClient().messages.create({ model: STRONG, max_tokens: 600,
        tools: [{ name: "rubric", description: "구조 루브릭 채점", input_schema: { type: "object", properties: {
          steps: { type: "number", description: "정답 도달에 필요한 독립 추론/풀이 단계 수(정수)" },
          concepts: { type: "number", description: "결합해야 하는 서로 다른 개념·텍스트 단서 수(정수)" },
          traps: { type: "number", description: "정답과 핵심 정보를 공유해 근거 없이는 못 지우는 오답 수(0~3)" },
        }, required: ["steps", "concepts", "traps"] } as never }],
        tool_choice: { type: "tool", name: "rubric" },
        messages: [{ role: "user", content: `디지털 SAT 문항의 구조적 난이도를 채점하세요(문항이 쉽다/어렵다는 느낌이 아니라 구조를 센다).\n유형: ${r.skill}\n\n${text}\n\n정답: ${r.format === "mc" ? String.fromCharCode(65 + (r.problem.correctIndex ?? 0)) : (r.problem.answers ?? []).join("/")}\n해설: ${r.problem.explanation}` }] });
      const tu = m.content.find((c) => c.type === "tool_use");
      if (tu && tu.type === "tool_use") { const i = tu.input as { steps: number; concepts: number; traps: number }; return { ...i, score: i.steps + i.concepts + i.traps }; }
    } catch { await new Promise((res) => setTimeout(res, 2000 * (a + 1))); }
  }
  return { steps: 0, concepts: 0, traps: 0, score: 0 };
}

async function main() {
  const runId = arg("--run")!;
  const mode = arg("--mode") ?? "calib";
  const strongN = Number(arg("--strong") ?? 0);
  const per = Number(arg("--per") ?? 20);
  const n = Number(arg("--n") ?? 5);
  const conc = Number(arg("--concurrency") ?? 10);
  const base = path.resolve("data/mock-exam-generation", runId);
  mkdirSync(path.join(base, "weak"), { recursive: true });
  const run = loadRun(base);
  const ev = evaluateAll(run).filter((e) => e.verdict === "pass" && e.raw.gid !== "eabd2b5b-8d5f-46a0-b1ce-732e5e4360b2");
  let items: { raw: Raw; label: string }[] = [];
  if (mode === "calib") for (const d of ["easy", "medium", "hard"]) items.push(...ev.filter((e) => e.finalDifficulty === d).sort((a, b) => a.raw.gid.localeCompare(b.raw.gid)).filter((_, i) => i % Math.max(1, Math.floor(ev.filter((e) => e.finalDifficulty === d).length / per)) === 0).slice(0, per).map((e) => ({ raw: e.raw, label: d })));
  else if (mode === "gids") { const g = new Set(JSON.parse(readFileSync(path.resolve(arg("--gids")!), "utf-8")) as string[]); items = run.raws.filter((r) => g.has(r.gid)).map((raw) => ({ raw, label: raw.difficulty })); }
  else items = ev.map((e) => ({ raw: e.raw, label: e.finalDifficulty }));
  items = items.filter((it) => !existsSync(path.join(base, "weak", `${it.raw.gid}.json`)));
  process.stderr.write(`대상 ${items.length}\n`);
  let done = 0;
  const q = [...items];
  await Promise.all(Array.from({ length: conc }, async () => {
    while (q.length) {
      const it = q.shift()!;
      const [w, rb, st] = await Promise.all([weakSolve(it.raw, n), rubric(it.raw), strongN ? weakSolve(it.raw, strongN, STRONG) : Promise.resolve(null)]);
      writeFileSync(path.join(base, "weak", `${it.raw.gid}.json`), JSON.stringify({ gid: it.raw.gid, skill: it.raw.skill, system: it.raw.examSystem, label: it.label, format: it.raw.format, n, correct: w.correct, acc: w.correct / n, answers: w.answers, rubric: rb, strong: st ? { n: strongN, correct: st.correct } : null }));
      if (++done % 20 === 0) process.stderr.write(`${done}/${items.length}\n`);
    }
  }));
  process.stderr.write("완료\n");
}
if (process.argv[1]?.endsWith("weak.ts")) main().catch((e) => { console.error(e); process.exit(1); });
