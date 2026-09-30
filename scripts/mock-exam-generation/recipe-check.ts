// 2단계 C: 레시피 hard 문항의 3단계 분리 검수 (2026-09-30). DB 접근 없음. 문항을 고치지 않는다.
//   (a) 레시피 준수: 체크리스트를 LLM 1회로 확인, minMet 이상 충족
//   (b) 정답 정확성: 기존 품질 검수(review.ts: 블라인드 풀이·감사·결정론) 통과. 강한 모델 3회 일치는 보조 자료로만 기록
//   (c) hard 적합성: 같은 skill medium 대비 추가 사고를 요구하는가 + 난이도가 길이·복잡한 숫자·계산량만에서 오지 않는가 (LLM 1회)
// 실행: npx tsx scripts/mock-exam-generation/recipe-check.ts --run <id> --source rc1|r7 [--concurrency 8]
//   출력: <run>/recipe-check/<gid>.json
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { reviewOne, deterministicIssues, type Raw } from "./review";
import { weakSolve } from "./weak";
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
type Recipe = { id: string; instruction: string; beyondMedium: string; checklist: string[]; minMet: number };

async function ask(name: string, schema: Record<string, unknown>, prompt: string): Promise<Record<string, unknown>> {
  for (let a = 0; a < 3; a++) {
    try {
      const m = await client.messages.create({ model: "claude-sonnet-5", max_tokens: 1200, tools: [{ name, description: name, input_schema: { type: "object", properties: schema, required: Object.keys(schema) } as never }], tool_choice: { type: "tool", name }, messages: [{ role: "user", content: prompt }] });
      const tu = m.content.find((c) => c.type === "tool_use");
      if (tu && tu.type === "tool_use") return tu.input as Record<string, unknown>;
    } catch { await new Promise((r) => setTimeout(r, 3000)); }
  }
  throw new Error("no response");
}
const text = (r: Raw) => `${r.problem.stimulus ?? r.problem.passage ?? ""}\n\n질문: ${r.problem.question ?? ""}\n${(r.problem.options ?? []).map((o, i) => `${String.fromCharCode(65 + i)}) ${o}${i === r.problem.correctIndex ? " (정답)" : ""}`).join("\n")}\n해설: ${r.problem.explanation}`;

(async () => {
  const runId = arg("--run")!, source = arg("--source") ?? "rc1";
  const base = path.resolve("data/mock-exam-generation", runId);
  mkdirSync(path.join(base, "recipe-check"), { recursive: true });
  const recipes = JSON.parse(readFileSync(path.resolve("data/mock-exam-generation/recipes.json"), "utf-8")) as Record<string, Recipe[]>;
  const chars = JSON.parse(readFileSync(path.resolve("data/mock-exam-generation/cb-hard/hard-characteristics.json"), "utf-8")) as Record<string, { characteristics?: { name: string; description: string }[] }>;
  const files = readdirSync(path.join(base, "raw")).filter((f) => f.includes(`__${source}__`));
  const items = files.map((f) => JSON.parse(readFileSync(path.join(base, "raw", f), "utf-8")) as Raw & { recipeId?: string }).filter((r) => !existsSync(path.join(base, "recipe-check", `${r.gid}.json`)));
  process.stderr.write(`검수 대상 ${items.length}\n`);
  const q = [...items];
  await Promise.all(Array.from({ length: Number(arg("--concurrency") ?? 8) }, async () => {
    while (q.length) {
      const r = q.shift()!;
      const rec = r.recipeId ? recipes[r.skill]?.find((x) => x.id === r.recipeId) : undefined;
      const [rev, compl, fit, strong] = await Promise.all([
        reviewOne(r),
        rec ? ask("compliance", { met: { type: "array", items: { type: "boolean" }, description: "체크리스트 항목 순서대로 충족 여부" }, note: { type: "string" } }, `다음 체크리스트를 이 SAT 문항이 충족하는지 항목별로 판정하라(엄격하게).\n${rec.checklist.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\n${text(r)}`) : Promise.resolve(null),
        ask("hardfit", { beyondMedium: { type: "boolean", description: "같은 skill의 전형적인 medium 문항보다 추가 사고(아래 특성 중 둘 이상 또는 그에 준하는 것)를 실제로 요구하는가" }, onlyComplexity: { type: "boolean", description: "난이도가 지문 길이·복잡한 숫자·계산량·어휘에서만 오는가" }, which: { type: "array", items: { type: "string" }, description: "요구하는 추가 사고 이름" }, note: { type: "string" } },
          `디지털 SAT '${r.skill}' 문항의 hard 적합성을 판정하라. 같은 skill의 전형적 medium 문항 대비 추가로 요구하는 사고가 있는지, 난이도가 단지 긴 문장·복잡한 숫자·계산량 증가에서만 오는지 본다.\n[이 skill의 hard 특성]\n${(chars[r.skill]?.characteristics ?? []).map((c) => `- ${c.name}: ${c.description}`).join("\n")}\n\n${text(r)}`),
        weakSolve(r, 3, "claude-sonnet-5"),
      ]);
      const met = compl ? (compl.met as boolean[]).filter(Boolean).length : null;
      const correctOk = rev.reasons.filter((x) => !["difficulty_label_mismatch"].includes(x)).length === 0;
      const complianceOk = rec ? (met ?? 0) >= rec.minMet : null;
      const fitOk = Boolean(fit.beyondMedium) && !fit.onlyComplexity;
      const adopted = correctOk && fitOk && (complianceOk ?? true);
      writeFileSync(path.join(base, "recipe-check", `${r.gid}.json`), JSON.stringify({ gid: r.gid, source, skill: r.skill, system: r.examSystem, recipeId: r.recipeId ?? null, reviewReasons: rev.reasons, correctOk, strong3: strong.correct, compliance: rec ? { met, minMet: rec.minMet, of: rec.checklist.length, ok: complianceOk } : null, hardFit: { ok: fitOk, which: fit.which, note: fit.note, onlyComplexity: fit.onlyComplexity }, adopted, calls: { review: 2, compliance: rec ? 1 : 0, hardFit: 1, strong: 3 } }));
    }
  }));
  process.stderr.write("완료\n");
})();
