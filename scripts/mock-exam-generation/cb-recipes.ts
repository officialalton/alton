// 2단계 A: hard 특성 -> skill당 레시피 2~3개 압축 (2026-09-30). 기존 archetypes.json 은 덮어쓰지 않고 recipes.json 을 새로 만든다.
// 실행: npx tsx scripts/mock-exam-generation/cb-recipes.ts -> data/mock-exam-generation/recipes.json
import Anthropic from "@anthropic-ai/sdk";
import { generationModel, reviewModel, weakModel } from "../../lib/problem-generation/models";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const chars = JSON.parse(readFileSync("data/mock-exam-generation/cb-hard/hard-characteristics.json", "utf-8")) as Record<string, { skill: string; characteristics?: { name: string; description: string; evidence: string[] }[]; skipped?: string }>;
(async () => {
  const out: Record<string, unknown> = {
    _readme: "skill별 hard 레시피(2026-09-30). instruction = 생성 프롬프트에 그대로 넣는 짧은 지시, checklist = 준수 여부를 LLM 1회로 확인하는 5항목 이하 체크리스트, minMet = 충족해야 하는 최소 항목 수, beyondMedium = 같은 skill medium 대비 추가로 요구하는 사고. officialDifficulty 는 College Board 공식 표기(없음=null), difficultySource 는 내부 추정의 출처. 긴 지문·복잡한 숫자·계산량 증가만으로는 hard 로 인정하지 않는다.",
  };
  for (const [skill, c] of Object.entries(chars)) {
    if (!c.characteristics?.length) continue;
    let recipes: { evidence: string[] }[] = [];
    for (let attempt = 0; attempt < 3 && !recipes.length; attempt++) {
    const m = await client.messages.create({
      model: generationModel(), max_tokens: 3000,
      tools: [{ name: "recipes", description: "레시피", input_schema: { type: "object", properties: { recipes: { type: "array", minItems: 2, maxItems: 3, items: { type: "object", properties: {
        id: { type: "string", description: `${skill} 접두어 + 짧은 이름(snake_case)` },
        instruction: { type: "string", description: "생성기에 그대로 넣는 지시 문단(한국어, 3문장 이내): 무엇을 묻고, 어떤 사고 구조로 만들고, 오답 3개를 어떤 실제 오개념으로 만드는가" },
        beyondMedium: { type: "string", description: "같은 skill의 medium 문항 대비 추가로 요구하는 사고(한 문장). 지문 길이·복잡한 숫자·계산량은 해당하지 않는다" },
        checklist: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" }, description: "예/아니오로 판정 가능한 문항 검사 항목(5개 이하)" },
        minMet: { type: "number", description: "충족해야 하는 최소 항목 수(체크리스트의 약 70~80%)" },
        evidence: { type: "array", items: { type: "string" }, description: "근거 문항 참조(특성의 evidence 에서만)" },
      }, required: ["id", "instruction", "beyondMedium", "checklist", "minMet", "evidence"] } } }, required: ["recipes"] } as never }],
      tool_choice: { type: "tool", name: "recipes" },
      messages: [{ role: "user", content: `디지털 SAT '${skill}'의 hard 특성(실전 시험 대조 결과)이다. 이를 skill당 2~3개의 '복잡하지 않은' 생성 레시피로 압축하라. 레시피마다 서로 다른 사고 구조를 쓰고, 긴 문장·복잡한 숫자·계산량 증가로 어렵게 만드는 지시는 금지한다. 체크리스트는 5항목 이하.\n\n${JSON.stringify(c.characteristics, null, 1)}` }],
    });
    const tu = m.content.find((x) => x.type === "tool_use");
    let got: unknown = tu && tu.type === "tool_use" ? (tu.input as { recipes: unknown }).recipes : [];
    if (typeof got === "string") { try { got = JSON.parse(got); } catch { got = []; } }
    if (got && !Array.isArray(got) && typeof got === "object" && Array.isArray((got as { recipes?: unknown }).recipes)) got = (got as { recipes: unknown }).recipes;
    if (Array.isArray(got)) recipes = got as { evidence: string[] }[];
    }
    out[skill] = recipes.map((r) => ({ ...r, officialDifficulty: null, difficultySource: "내부 추정: 7개 실전 시험 문항 내용 기반 사고 요구 상위 25% 대 하위 25% 대조(공식 난이도 표기 없음)" }));
    process.stderr.write(`${skill}: ${recipes.length}\n`);
  }
  writeFileSync("data/mock-exam-generation/recipes.json", JSON.stringify(out, null, 1));
})();
