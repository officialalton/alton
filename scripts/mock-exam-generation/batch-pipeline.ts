// 단계별 배치 파이프라인 (2026-09-30): 1) 후보 전체 생성 배치 -> 결정론 필터(계약·수식 재계산) -> 2) 검수 배치(블라인드 풀이 + 감사) -> 3) 집계.
// 기존 동기 경로(generate.ts·recipe-gen.ts 등)는 소량 시험·디버깅용으로 그대로 둔다. DB 접근 없음.
// 실행: npx tsx scripts/mock-exam-generation/batch-pipeline.ts run    --combo A|B|C --method recipe|archetype [--per-rw 10 --per-math 5] [--budget 8] [--dry]
//       npx tsx scripts/mock-exam-generation/batch-pipeline.ts rereview --review-model claude-opus-5-5   (기존 레시피 채택 RW 14건을 다른 모델로 재검수)
//       npx tsx scripts/mock-exam-generation/batch-pipeline.ts report  --combo A --method recipe
// 조합: A 생성 sonnet-5-5 / 검수 sonnet-5-5, B 생성 opus-5-5 / 검수 fable-5-1, C 생성 fable-5-1 / 검수 opus-5-5 (MODELS 로 덮어쓰기: --gen-model/--review-model)
// 재개: 같은 명령을 다시 실행하면 끝난 custom_id 는 건너뛰고 진행 중 배치는 이어서 폴링한다(batch-lib.ts).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { runBatch, estimate, ledger, toolInput, type BatchReq } from "./batch-lib";
import { deterministicIssues, type Raw } from "./review";
import { buildLevelCands, explanationEnIssues, levelVerdict, levelInstruction, TARGET_LETTERS, LEVEL_RULE, HANGUL } from "./rw-level";
import { analyzeLeak, buildIdf } from "./answer-leak-detector";
import { RW_SATURATED_TOPICS } from "../../lib/problem-generation/rw-topic-saturation";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(n);
const SYNC = process.argv.includes("--sync");
const mult = () => (SYNC ? 2 : 1);
const COMBOS: Record<string, { gen: string; rev: string }> = {
  A: { gen: "claude-sonnet-5-5", rev: "claude-sonnet-5-5" },
  B: { gen: "claude-opus-5-5", rev: "claude-fable-5-1" },
  C: { gen: "claude-fable-5-1", rev: "claude-opus-5-5" },
};
const RUN = path.resolve("data/mock-exam-generation/mockgen-20260929");
const RW_SKILLS = ["transitions", "boundaries", "command_of_evidence_text", "text_structure_purpose"];
const MATH_SKILLS = ["linear_equations_one_var", "linear_equations_two_var", "equivalent_expressions", "systems_linear", "nonlinear_equations_systems"];
type Recipe = { id: string; instruction: string; beyondMedium: string; checklist: string[]; minMet: number };
const recipesAll = JSON.parse(readFileSync("data/mock-exam-generation/recipes.json", "utf-8")) as Record<string, Recipe[]>;
const recipesV2 = JSON.parse(readFileSync("data/mock-exam-generation/recipes-v2.json", "utf-8")) as Record<string, Recipe[]>;
const archetypes = JSON.parse(readFileSync("data/mock-exam-generation/archetypes.json", "utf-8")) as Record<string, string[]>;
const chars = JSON.parse(readFileSync("data/mock-exam-generation/cb-hard/hard-characteristics.json", "utf-8")) as Record<string, { characteristics?: { name: string; description: string }[] }>;
const recipesFor = (skill: string): Recipe[] => (MATH_SKILLS.includes(skill) ? recipesV2[skill] : recipesAll[skill].slice(0, 3));
const isMath = (skill: string) => MATH_SKILLS.includes(skill);

const QUESTION_RULE: Record<string, string> = {
  transitions: "지문에 빈칸 `______` 을 정확히 1개 두고(두 문장 사이 또는 문장 앞), 질문은 정확히 'Which choice completes the text with the most logical transition?'. 선택지는 전환어 4개(각 끝에 쉼표).",
  boundaries: "지문에 빈칸 `______` 을 정확히 1개 두고, 질문은 정확히 'Which choice completes the text so that it conforms to the conventions of Standard English?'. 선택지는 문장부호·접속 조합 4개. 빈칸 앞 단어를 선택지 첫 단어로 반복하지 않는다.",
  command_of_evidence_text: "지문은 주장(가설·견해)을 소개하고, 질문은 'Which finding, if true, would most directly support (또는 weaken) the ...?' 형식. 선택지는 발견 4개.",
  text_structure_purpose: "지문 안의 한 문장을 `__…__`(밑줄 표기)로 정확히 1곳 표시하고, 질문은 'Which choice best describes the function of the underlined sentence in the text as a whole?'. 선택지는 기능 설명 4개.",
  words_in_context: "지문에 빈칸 `______` 을 정확히 1개 두고, 질문은 정확히 'Which choice completes the text with the most logical and precise word or phrase?'. 선택지는 단어·구 4개.",
  central_ideas_details: "지문은 평서문 단락 1~2개(빈칸·밑줄·Text·메모 없음). 질문은 'Which choice best states the main idea of the text?' 또는 명시된 세부 정보를 묻는 완전한 의문문. 선택지는 진술 4개.",
  inferences: "지문 끝부분에 빈칸 `______` 을 정확히 1개 두고(논증의 결론을 완성), 질문은 정확히 'Which choice most logically completes the text?'. 선택지는 완결된 절·구 4개(지문 문장을 그대로 복제하지 않는다).",
  rhetorical_synthesis: "passage 는 'While researching a topic, a student has taken the following notes:' 한 줄 뒤에 줄마다 '- ' 로 시작하는 메모 3~6개. 질문은 'The student wants to … Which choice most effectively uses relevant information from the notes to accomplish this goal?' 형식(목표 문장 'The student wants to' 와 notes 언급 포함). 선택지는 문장 4개.",
  form_structure_sense: "지문에 빈칸 `______` 을 정확히 1개 두고, 질문은 정확히 'Which choice completes the text so that it conforms to the conventions of Standard English?'. 선택지는 동사형·대명사·수식어 위치 등이 다른 표현 4개. 빈칸 앞 단어를 선택지 첫 단어로 반복하지 않는다.",
  cross_text_connections: "지문은 'Text 1' 제목 줄 + 본문(20단어 이상), 빈 줄, 'Text 2' 제목 줄 + 본문(20단어 이상) 형식. 질문은 Text 1/Text 2 를 가리키며 'Based on the texts, how would the author of Text 2 most likely respond to ... in Text 1?' 류의 완전한 의문문. 선택지는 반응·관계 4개.",
  nonlinear_equations_systems: "자료 없는 텍스트 문항(그림 금지). 이차식·일차식 조건을 문장과 식으로 준다. 수식은 $…$ 만 사용.",
  systems_linear: "자료 없는 텍스트 문항(그림 금지). 연립일차방정식을 문장·식으로 준다. 수식은 $…$ 만 사용.",
  linear_equations_one_var: "자료 없는 텍스트 문항. 질문은 값을 구하거나 식을 세우는 한 문장. 수식은 $…$ 만 사용.",
  linear_equations_two_var: "자료 없는 텍스트 문항(그림 금지). 직선·연립 조건을 문장과 식으로 준다. 수식은 $…$ 만 사용.",
  equivalent_expressions: "자료 없는 텍스트 문항. 식·표(마크다운 금지, 값은 문장으로)를 문장으로 준다. 수식은 $…$ 만 사용.",
};
const SKILLS_LABEL: Record<string, string> = { words_in_context: "Words in Context", central_ideas_details: "Central Ideas and Details", inferences: "Inferences", rhetorical_synthesis: "Rhetorical Synthesis", form_structure_sense: "Form, Structure, and Sense", nonlinear_equations_systems: "Nonlinear equations and systems", cross_text_connections: "Cross-Text Connections", systems_linear: "Systems of two linear equations", transitions: "Transitions", boundaries: "Boundaries", command_of_evidence_text: "Command of Evidence (Textual)", text_structure_purpose: "Text Structure and Purpose", linear_equations_one_var: "Linear equations in one variable", linear_equations_two_var: "Linear equations in two variables", equivalent_expressions: "Equivalent expressions" };

type Cand = { cid: string; skill: string; system: "sat_rw" | "sat_math"; method: string; recipeId: string | null; instruction: string; idx: number; difficulty?: "easy" | "medium" | "hard"; seed?: string; targetLetter?: string };
function buildCands(method: string, perRw: number, perMath: number, spec?: Record<string, number>, offset = 0): Cand[] {
  const out: Cand[] = [];
  const skills = spec ? Object.keys(spec) : method === "archetype" ? RW_SKILLS : [...RW_SKILLS, ...MATH_SKILLS];
  for (const skill of skills) {
    const n = spec ? spec[skill] : isMath(skill) ? perMath : perRw;
    const rec = method === "archetype" ? null : recipesFor(skill);
    for (let i = offset; i < offset + n; i++) {
      const r = rec ? rec[i % rec.length] : null;
      const inst = r ? r.instruction : (archetypes[skill] ?? []).map((x) => `- ${x}`).join("\n");
      out.push({ cid: `${method}-${skill}-${String(i).padStart(2, "0")}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64), skill, system: isMath(skill) ? "sat_math" : "sat_rw", method, recipeId: r?.id ?? null, instruction: inst, idx: i });
    }
  }
  return out;
}

/** 신형 모델은 사고(thinking)를 끌 수 없고 max_tokens 를 사고 토큰이 같이 쓴다(1차 시도에서 55건 중 41건이 잘림). Sonnet 5.5 는 도구 호출 전 사고 없음(between_tools), Opus/Fable 은 adaptive + effort low 로 비용·잘림을 통제한다. 세 조합에 같은 원칙을 적용한다. */
const think = (model: string) => ({ thinking: model.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort: "low" } });
let MATH_PROMPT: "v1" | "v2" = "v1";
const MATH_NOTATION_V2 = "\n수식 표기 규칙(필수): 모든 수식은 $…$ 로 열고 반드시 닫는다(지문·선택지·해설 모두, 짝이 맞아야 함). 수식 안에는 영어·숫자·LaTeX 명령만 쓰고 한글을 넣지 않는다(한글 설명은 수식 밖). 금액 기호로 $ 를 쓰지 말고 'dollars' 같은 단어로 쓴다. 분수는 \\frac{a}{b}, 곱은 \\cdot, 수식 안에서 줄바꿈(\\\\)을 쓰지 않는다.";
const SYS_CACHE = { type: "ephemeral", ttl: "1h" };
const levelGenSystem = (c: Cand) => `당신은 디지털 SAT(Reading and Writing) 문항 출제자이다. 세부 기술: ${SKILLS_LABEL[c.skill]} (${c.skill}). **${c.difficulty}** 난이도 문항 1개를 새로 창작한다(기존 시험 문항 재현 금지).
형식 규칙: ${QUESTION_RULE[c.skill]}
지문·질문·선택지는 영어만(한글 금지). 해설은 두 벌: explanation(한국어 3~5문장)과 explanation_en(같은 내용의 영어 3~5문장, 한글 없음, 학생에게 설명하는 어조) 둘 다 필수. 두 해설 모두 선택지는 글자(A~D)로만 지칭하고, 두 해설의 글자 참조·결론은 서로 일치해야 한다. 정답이 지문·선택지 표면 일치로 드러나면 안 된다.
난이도 기준(반드시 지킨다; hard 로 올라가거나 너무 쉬워지지 않게):
${c.instruction}`;
const genSystem = (c: Cand) => c.difficulty && c.difficulty !== "hard" ? levelGenSystem(c) : `당신은 디지털 SAT(${c.system === "sat_rw" ? "Reading and Writing" : "Math"}) 문항 출제자이다. 세부 기술: ${SKILLS_LABEL[c.skill]} (${c.skill}). **${c.difficulty ?? "hard"}** 난이도 문항 1개를 새로 창작한다(기존 시험 문항 재현 금지).
형식 규칙: ${QUESTION_RULE[c.skill]}
${c.system === "sat_rw" ? "지문·질문·선택지는 영어, 해설은 한국어. 정답이 지문·선택지 표면 일치로 드러나면 안 된다." : "질문·선택지는 영어, 해설은 한국어(단계별 계산). 모든 계산을 생성 직전에 다시 검산하고, 해설에 '재계산' 같은 자기 수정 문구를 쓰지 않는다."}
오답 3개는 각각 서로 다른 실제 오개념·중간값·부분 일치에 기반해 그럴듯해야 하고 지문을 읽고도 근거를 따져야만 지워진다. 난이도는 긴 지문·복잡한 숫자·계산량이 아니라 아래 사고 구조로만 만든다.
hard 지시${c.recipeId ? `(레시피 ${c.recipeId})` : "(원형)"}:
${c.instruction}${c.system === "sat_math" && MATH_PROMPT === "v2" ? MATH_NOTATION_V2 : ""}${c.system === "sat_math" ? "\n선택지가 숫자이면 option_values 에 4개 값을 숫자로, 아니면 null. verification_js 에는 문제의 주어진 수치로 정답 값을 독립적으로 다시 계산해 return 하는 JavaScript 함수 본문(예: 'const a=3; return a*2+1;')을 쓴다(외부 입력 없음)." : ""}`;
const genTool = (c: Cand) => ({ name: "problem", description: "hard 문항 1개", input_schema: { type: "object", properties: {
  passage: { type: "string", description: "지문/자료 본문(빈칸·밑줄 표기 포함, 질문 문장 제외)" },
  question: { type: "string" },
  options: { type: "array", items: { type: "string" }, description: "선택지 4개(알파벳 접두어 없이)" },
  correct_letter: { type: "string", enum: ["A", "B", "C", "D"] },
  explanation: { type: "string", description: "한국어 해설: 정답 근거와 각 오답이 틀린 이유" },
  explanation_en: { type: "string", description: "같은 해설의 영어 버전(한글 없음, 학생에게 설명하는 어조). 학생 화면은 영어 기본이므로 필수" },
  design: { type: "string", description: "hard 지시를 어떻게 적용했는지 한두 문장" },
  ...(c.system === "sat_math" ? { option_values: { type: ["array", "null"], items: { type: "number" } }, verification_js: { type: "string" } } : {}),
}, required: ["passage", "question", "options", "correct_letter", "explanation", "explanation_en", "design", ...(c.system === "sat_math" ? ["option_values", "verification_js"] : [])] } });

type Gen = { passage: string; question: string; options: string[]; correct_letter: string; explanation: string; explanation_en?: string; design: string; option_values?: number[] | null; verification_js?: string };
const toRaw = (c: Cand, g: Gen): Raw => ({ gid: c.cid, runId: "batch", skill: c.skill, domain: "", examSystem: c.system, difficulty: c.difficulty ?? "hard", format: "mc", problem: { passage: `${g.passage}\n\n${g.question}`, stimulus: g.passage, question: g.question, options: g.options, correctIndex: "ABCD".indexOf(g.correct_letter), answers: null, explanation: g.explanation, explanationEn: g.explanation_en ?? null, figure: null, statements: null } } as Raw);

/** 결정론 검증: 품질 계약 + 원시 LaTeX 등 + Math 는 verification_js 재계산이 정답 값과 일치하고 다른 선택지 값과 겹치지 않는지. */
async function deterministic(c: Cand, g: Gen): Promise<{ issues: string[]; mathVerify: "pass" | "fail" | "skipped" | null }> {
  const { checkQualityContract } = await import("../../lib/problem-quality-contract");
  const r = toRaw(c, g);
  const p = r.problem;
  const cr = checkQualityContract({ skillCode: c.skill, examSystem: c.system, format: "mc", stimulus: g.passage, question: g.question, options: g.options, correctIndex: p.correctIndex ?? null, answers: null, statements: null, explanation: g.explanation, figure: null });
  const issues = [...cr.issues.map((i) => `contract:${i.code}`), ...deterministicIssues(r), ...(c.difficulty && c.difficulty !== "hard" ? [...explanationEnIssues(g.explanation_en), ...(HANGUL.test(`${g.passage}\n${g.question}\n${g.options.join("\n")}`) ? ["hangul_in_body"] : [])] : [])];
  let mathVerify: "pass" | "fail" | "skipped" | null = null;
  if (c.system === "sat_math") {
    const vals = g.option_values;
    if (!Array.isArray(vals) || vals.length !== 4 || vals.some((v) => typeof v !== "number") || !g.verification_js) mathVerify = "skipped";
    else {
      try {
        const out = vm.runInNewContext(`(function(){${g.verification_js}})()`, {}, { timeout: 300 }) as unknown;
        const num = typeof out === "number" ? out : NaN;
        const ci = p.correctIndex ?? -1;
        const close = (a: number, b: number) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a));
        mathVerify = Number.isFinite(num) && close(num, vals[ci]) && vals.filter((v, i) => i !== ci && close(v, num)).length === 0 ? "pass" : "fail";
      } catch { mathVerify = "fail"; }
      if (mathVerify === "fail") issues.push("math_verify_failed");
    }
  }
  return { issues, mathVerify };
}

const optText = (g: Gen, key: boolean) => g.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}${key && String.fromCharCode(65 + i) === g.correct_letter ? "   <- 정답" : ""}`).join("\n");
const blindReq = (model: string, cid: string, skill: string, g: Gen): BatchReq => ({ custom_id: `b-${cid}`.slice(0, 64), params: { model, ...think(model), max_tokens: 1500,
  tools: [{ name: "solve", description: "독립 풀이", input_schema: { type: "object", properties: {
    picked_letter: { type: "string", enum: ["A", "B", "C", "D"] }, other_defensible: { type: "boolean", description: "다른 선택지도 조건상 정답으로 방어 가능한가" }, confidence: { type: "string", enum: ["high", "medium", "low"] },
    easily_eliminated: { type: "array", items: { type: "string" }, description: "대충 읽어도 근거 없이 바로 지울 수 있는 오답 알파벳" }, note: { type: "string", description: "풀이 한 줄" } }, required: ["picked_letter", "other_defensible", "confidence", "easily_eliminated", "note"] } }],
  tool_choice: { type: "auto" },
  messages: [{ role: "user", content: `디지털 SAT 독립 채점자로서 정답 표시 없이 직접 풀고, 반드시 solve 도구 호출로 결과를 제출하라. 유형: ${skill}\n\n${g.passage}\n\n${g.question}\n${optText(g, false)}` }] } });
const auditReq = (model: string, c: Cand, g: Gen, recipe: Recipe | null): BatchReq => ({ custom_id: `a-${c.cid}`.slice(0, 64), params: { model, ...think(model), max_tokens: 2500,
  tools: [{ name: "audit", description: "정답·해설·형식·저작권·hard 적합성 감사", input_schema: { type: "object", properties: {
    explanation_consistent: { type: "boolean", description: "해설이 지정 정답을 논리적·수치적으로 정확히 뒷받침하고 해설 안에 모순·오계산이 없는가" },
    explanation_issue: { type: "string", description: "해설 문제 요약(없으면 빈 문자열)" },
    answer_correct: { type: "boolean", description: "지정 정답이 실제로 옳은가(직접 검산)" },
    format_ok: { type: "boolean" }, factual_error: { type: "boolean" }, copyright_suspect: { type: "boolean" },
    met: { type: "array", items: { type: "boolean" }, description: recipe ? "레시피 체크리스트 항목 순서대로 충족 여부" : "레시피 없음 — 빈 배열" },
    beyond_medium: { type: "boolean", description: "같은 skill의 전형적 medium 문항보다 추가 사고를 실제로 요구하는가" },
    only_complexity: { type: "boolean", description: "난이도가 길이·복잡한 숫자·계산량에서만 오는가" },
    which: { type: "array", items: { type: "string" }, description: "요구하는 추가 사고 이름" }, note: { type: "string" } },
    required: ["explanation_consistent", "explanation_issue", "answer_correct", "format_ok", "factual_error", "copyright_suspect", "met", "beyond_medium", "only_complexity", "which", "note"] } }],
  tool_choice: { type: "auto" },
  messages: [{ role: "user", content: `디지털 SAT 문항 감사관으로서 판정만 하라(고치지 않는다). 반드시 audit 도구 호출로 제출하라. 유형: ${c.skill}\n${recipe ? `[레시피 체크리스트]\n${recipe.checklist.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n` : ""}[이 skill의 hard 특성]\n${(chars[c.skill]?.characteristics ?? []).map((x) => `- ${x.name}: ${x.description}`).join("\n")}\n\n${g.passage}\n\n${g.question}\n${optText(g, true)}\n\n[해설]\n${g.explanation}` }] } });

/** easy/medium 감사: hard 의 beyond_medium 대신 목표 난이도 적합(level_verdict)과 영어 해설 검수를 본다. 판정만 하고 고치지 않는다. */
const levelAuditReq = (model: string, c: Cand, g: Gen): BatchReq => ({ custom_id: `a-${c.cid}`.slice(0, 64), params: { model, ...think(model), max_tokens: 2500,
  tools: [{ name: "audit", description: "정답·해설·영어해설·형식·저작권·난이도 적합 감사", input_schema: { type: "object", properties: {
    explanation_consistent: { type: "boolean", description: "한국어 해설이 지정 정답을 정확히 뒷받침하고 선택지 글자 참조가 아래 선택지와 일치하며 모순이 없는가" },
    explanation_issue: { type: "string", description: "해설 문제 요약(없으면 빈 문자열)" },
    explanation_en_ok: { type: "boolean", description: "영어 해설이 한국어 해설과 같은 결론·글자 참조를 갖고, 정확하며 자연스러운 영어이고, 한글이 없는가" },
    explanation_en_issue: { type: "string" },
    answer_correct: { type: "boolean", description: "지정 정답이 실제로 옳은가(직접 검산)" },
    format_ok: { type: "boolean" }, factual_error: { type: "boolean" }, copyright_suspect: { type: "boolean" },
    level_verdict: { type: "string", enum: ["too_easy", "fits", "too_hard"], description: `목표 난이도(${c.difficulty}) 적합성. 기준: ${LEVEL_RULE[c.difficulty as "easy" | "medium"]}` },
    note: { type: "string" } },
    required: ["explanation_consistent", "explanation_issue", "explanation_en_ok", "explanation_en_issue", "answer_correct", "format_ok", "factual_error", "copyright_suspect", "level_verdict", "note"] } }],
  tool_choice: { type: "auto" },
  messages: [{ role: "user", content: `디지털 SAT 문항 감사관으로서 판정만 하라(고치지 않는다). 반드시 audit 도구 호출로 제출하라. 유형: ${c.skill} / 목표 난이도: ${c.difficulty}\n\n${g.passage}\n\n${g.question}\n${optText(g, true)}\n\n[해설(한국어)]\n${g.explanation}\n\n[해설(English)]\n${g.explanation_en ?? ""}` }] } });

const tok = (s: string) => Math.ceil(s.length / 3);
async function main() {
  const cmd = process.argv[2];
  if (cmd === "report") return report();
  if (cmd === "compare") return compare();
  if (cmd === "cross") return cross();
  if (cmd === "basic") return basic();
  if (cmd === "cross-report") return crossReport(path.join(RUN, arg("--dir") ?? "batch2/D-cross"));
  if (cmd === "rereview") return rereview();
  const combo = arg("--combo")!, method = arg("--method") ?? "recipe";
  const cfg = { ...COMBOS[combo], gen: arg("--gen-model") ?? COMBOS[combo].gen, rev: arg("--review-model") ?? COMBOS[combo].rev };
  const budget = Number(arg("--budget") ?? 8);
  const dir = path.join(RUN, "batch", `${combo}-${method}`);
  mkdirSync(dir, { recursive: true });
  const cands = buildCands(method, Number(arg("--per-rw") ?? 10), Number(arg("--per-math") ?? 5));
  writeFileSync(path.join(dir, "candidates.json"), JSON.stringify(cands));
  const led = ledger(dir);
  // 1단계: 생성
  const genReqs: BatchReq[] = cands.map((c) => ({ custom_id: c.cid, params: { model: cfg.gen, ...think(cfg.gen), max_tokens: c.system === "sat_math" ? 5000 : 4500, system: [{ type: "text", text: genSystem(c), cache_control: SYS_CACHE }], tools: [genTool(c)], tool_choice: { type: "auto" }, messages: [{ role: "user", content: `후보 ${c.idx + 1}번. 같은 지시로 만든 다른 후보와 소재·수치가 겹치지 않게 새로 창작하라. 문항 1개를 반드시 problem 도구 호출로 제출하라(텍스트 답변 금지).` }] } }));
  const genEst = estimate(cfg.gen, cands.length, 1500, 1000) * mult();
  const revEst = estimate(cfg.rev, cands.length, 2800, 520) * mult();
  console.log(`[${combo}/${method}] 후보 ${cands.length} · 생성 ${cfg.gen} 추정 $${genEst.toFixed(2)} + 검수 ${cfg.rev} 추정 $${revEst.toFixed(2)} = $${(genEst + revEst).toFixed(2)} · 누적 $${led.spent().toFixed(2)} / 상한 $${budget}`);
  if (led.spent() + genEst + revEst > budget) throw new Error("예산 상한 초과 예상 — 실행하지 않음");
  if (flag("--dry")) return;
  const genRes = await runBatch({ dir, name: "gen", requests: genReqs, budgetUsd: budget, estimateUsd: genEst / mult(), sync: SYNC });
  // 결정론 필터
  const gens = new Map<string, { c: Cand; g: Gen; det: { issues: string[]; mathVerify: string | null } }>();
  const dropped: Record<string, string[]> = {};
  for (const c of cands) {
    const r = genRes.get(c.cid);
    const g = r ? (toolInput(r) as unknown as Gen | null) : null;
    if (!g || !Array.isArray(g.options) || g.options.length !== 4 || !g.question) { dropped[c.cid] = ["generation_failed"]; continue; }
    const det = await deterministic(c, g);
    gens.set(c.cid, { c, g, det });
    if (det.issues.length) dropped[c.cid] = det.issues;
  }
  writeFileSync(path.join(dir, "gens.json"), JSON.stringify([...gens.values()]));
  // 2단계: 검수(결정론 통과분만)
  const passDet = [...gens.values()].filter((x) => x.det.issues.length === 0);
  const revReqs: BatchReq[] = passDet.flatMap(({ c, g }) => [blindReq(cfg.rev, c.cid, c.skill, g), auditReq(cfg.rev, c, g, c.recipeId ? (recipesFor(c.skill).find((r) => r.id === c.recipeId) ?? null) : null)]);
  const rev2 = estimate(cfg.rev, revReqs.length / 2, 2800, 520) * mult();
  console.log(`결정론 통과 ${passDet.length}/${cands.length} -> 검수 요청 ${revReqs.length}건, 추정 $${rev2.toFixed(2)}`);
  if (led.spent() + rev2 > budget) throw new Error("검수 단계 예산 초과 예상 — 중단");
  const revRes = await runBatch({ dir, name: "review", requests: revReqs, budgetUsd: budget, estimateUsd: rev2 / mult(), sync: SYNC });
  writeFileSync(path.join(dir, "config.json"), JSON.stringify({ combo, method, ...cfg }));
  console.log("완료. `report` 로 집계하세요. 누적 비용 $" + led.spent().toFixed(2));
  void revRes; void dropped;
}

type Row = { skill: string; system: string; cand: number; detPass: number; correct: number; compliance: number; hardFit: number; adopted: number; causes: Record<string, number>; cost: number; calls: number; mathVerifyFail: number; mathVerifyPass: number; mathVerifySkipped: number; mathAnswerMismatch: number; mathExplInconsistent: number };
function judge(dir: string) {
  const gens = JSON.parse(readFileSync(path.join(dir, "gens.json"), "utf-8")) as { c: Cand; g: Gen; det: { issues: string[]; mathVerify: string | null } }[];
  const cands = JSON.parse(readFileSync(path.join(dir, "candidates.json"), "utf-8")) as Cand[];
  const read = (n: string) => { const m = new Map<string, { usage?: unknown; cost?: number; in: Record<string, unknown> | null }>(); const f = path.join(dir, `${n}.results.jsonl`); if (!existsSync(f)) return m; for (const l of readFileSync(f, "utf-8").split("\n").filter(Boolean)) { const r = JSON.parse(l); if (r.ok) m.set(r.custom_id, { cost: r.cost, in: toolInput(r) }); } return m; };
  const gen = read("gen"), rev = read("review");
  const genMap = new Map(gens.map((x) => [x.c.cid, x]));
  const rows = new Map<string, Row>();
  const items: { cid: string; skill: string; system: string; adopted: boolean; causes: string[]; hardFitOk: boolean | null; detOk?: boolean; correctOk?: boolean; complianceOk?: boolean; cost?: number; mathVerify?: string | null; idx?: number }[] = [];
  for (const c of cands) {
    const row = rows.get(c.skill) ?? { skill: c.skill, system: c.system, cand: 0, detPass: 0, correct: 0, compliance: 0, hardFit: 0, adopted: 0, causes: {}, cost: 0, calls: 0, mathVerifyFail: 0, mathVerifyPass: 0, mathVerifySkipped: 0, mathAnswerMismatch: 0, mathExplInconsistent: 0 };
    rows.set(c.skill, row);
    row.cand++; row.calls++; row.cost += gen.get(c.cid)?.cost ?? 0;
    const x = genMap.get(c.cid);
    const causes: string[] = [];
    const bump = (k: string) => { row.causes[k] = (row.causes[k] ?? 0) + 1; causes.push(k); };
    if (!x) { bump("생성실패"); items.push({ cid: c.cid, skill: c.skill, system: c.system, idx: c.idx, adopted: false, causes, hardFitOk: null, cost: gen.get(c.cid)?.cost ?? 0 }); continue; }
    if (x.det.mathVerify === "pass") row.mathVerifyPass++; else if (x.det.mathVerify === "fail") row.mathVerifyFail++; else if (x.det.mathVerify === "skipped") row.mathVerifySkipped++;
    if (x.det.issues.length) { for (const i of x.det.issues) bump(`생성:${i.replace(/^contract:contract_/, "계약:")}`); items.push({ cid: c.cid, skill: c.skill, system: c.system, idx: c.idx, adopted: false, causes, hardFitOk: null, detOk: false, cost: gen.get(c.cid)?.cost ?? 0, mathVerify: x.det.mathVerify }); continue; }
    row.detPass++;
    const b = rev.get(`b-${c.cid}`.slice(0, 64)), a = rev.get(`a-${c.cid}`.slice(0, 64));
    row.calls += 2; row.cost += (b?.cost ?? 0) + (a?.cost ?? 0);
    if (!b?.in || !a?.in) { bump("검수응답없음"); items.push({ cid: c.cid, skill: c.skill, system: c.system, idx: c.idx, adopted: false, causes, hardFitOk: null, detOk: true, cost: (gen.get(c.cid)?.cost ?? 0) + (b?.cost ?? 0) + (a?.cost ?? 0), mathVerify: x.det.mathVerify }); continue; }
    const recipe = c.recipeId ? recipesFor(c.skill).find((r) => r.id === c.recipeId) : null;
    const agree = b.in.picked_letter === x.g.correct_letter && !b.in.other_defensible;
    let correct = true;
    if (!agree) { correct = false; bump(b.in.picked_letter !== x.g.correct_letter ? "정답:블라인드불일치" : "정답:복수정답"); if (c.system === "sat_math") row.mathAnswerMismatch++; }
    if (!a.in.answer_correct) { if (correct) bump("정답:감사에서오답"); correct = false; }
    if (!a.in.explanation_consistent) { correct = false; bump("해설:불일치"); if (c.system === "sat_math") row.mathExplInconsistent++; }
    if (!a.in.format_ok) { correct = false; bump("형식결함"); }
    if (a.in.factual_error) { correct = false; bump("사실오류"); }
    if (a.in.copyright_suspect) { correct = false; bump("저작권의심"); }
    if (correct) row.correct++;
    const met = (a.in.met as boolean[]).filter(Boolean).length;
    const compOk = recipe ? met >= recipe.minMet : true;
    if (compOk) row.compliance++; else bump("레시피미준수");
    const fitOk = Boolean(a.in.beyond_medium) && !a.in.only_complexity;
    if (fitOk) row.hardFit++; else bump("hard적합실패");
    const ok = correct && compOk && fitOk;
    if (ok) row.adopted++;
    items.push({ cid: c.cid, skill: c.skill, system: c.system, idx: c.idx, adopted: ok, causes, hardFitOk: fitOk, detOk: true, correctOk: correct, complianceOk: compOk, cost: (gen.get(c.cid)?.cost ?? 0) + (b?.cost ?? 0) + (a?.cost ?? 0), mathVerify: x.det.mathVerify });
  }
  return { rows: [...rows.values()], items };
}

function report() {
  const combo = arg("--combo")!, method = arg("--method") ?? "recipe";
  const dir = path.join(RUN, "batch", `${combo}-${method}`);
  const { rows, items } = judge(dir);
  const cfg = JSON.parse(readFileSync(path.join(dir, "config.json"), "utf-8"));
  const tot = (sys?: string) => { const rs = rows.filter((r) => !sys || r.system === sys); const s = (f: (r: Row) => number) => rs.reduce((a, r) => a + f(r), 0); const adopted = s((r) => r.adopted); return { cand: s((r) => r.cand), detPass: s((r) => r.detPass), correct: s((r) => r.correct), compliance: s((r) => r.compliance), hardFit: s((r) => r.hardFit), adopted, yield: +(adopted / Math.max(1, s((r) => r.cand))).toFixed(3), calls: s((r) => r.calls), costUsd: +s((r) => r.cost).toFixed(4), costPerAdopted: adopted ? +(s((r) => r.cost) / adopted).toFixed(4) : null, mathVerifyFail: s((r) => r.mathVerifyFail), mathVerifyPass: s((r) => r.mathVerifyPass), mathVerifySkipped: s((r) => r.mathVerifySkipped), mathAnswerMismatch: s((r) => r.mathAnswerMismatch), mathExplInconsistent: s((r) => r.mathExplInconsistent) }; };
  const out = { combo, method, models: cfg, rows, totals: { all: tot(), rw: tot("sat_rw"), math: tot("sat_math") }, adoptedIds: items.filter((i) => i.adopted).map((i) => i.cid) };
  writeFileSync(path.join(dir, "report.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.totals, null, 1));
  for (const r of rows) console.log(r.skill, `후보 ${r.cand} 결정론통과 ${r.detPass} 정답·해설통과 ${r.correct} 레시피 ${r.compliance} hard적합 ${r.hardFit} 채택 ${r.adopted} ($${r.cost.toFixed(3)})`, JSON.stringify(r.causes));
}

/** 기존 레시피 채택 RW 14건(rc1)을 다른 모델로 재검수: 블라인드 풀이 + 감사. 정답·hard 적합성을 따로 기록하고 불일치는 보류. */
async function rereview() {
  const model = arg("--review-model")!;
  const dir = path.join(RUN, "batch", `rereview-${model}`);
  mkdirSync(dir, { recursive: true });
  // 기존 레시피 채택(rc1, RW) 문항: recipe-check/*.json 의 adopted=true 를 raw/ 에서 불러온다.
  const { readdirSync } = await import("node:fs");
  const adopted = readdirSync(path.join(RUN, "recipe-check")).map((f) => JSON.parse(readFileSync(path.join(RUN, "recipe-check", f), "utf-8")) as { gid: string; source: string; system: string; adopted: boolean }).filter((c) => c.source === "rc1" && c.system === "sat_rw" && c.adopted).map((c) => c.gid);
  const rawByGid = new Map(readdirSync(path.join(RUN, "raw")).filter((f) => f.includes("__rc1__")).map((f) => { const r = JSON.parse(readFileSync(path.join(RUN, "raw", f), "utf-8")) as Raw & { recipeId?: string | null }; return [r.gid, r] as const; }));
  const passed = adopted.map((g) => rawByGid.get(g)!).filter(Boolean);
  const items = passed.map((r) => {
    const p = r.problem;
    const g: Gen = { passage: p.stimulus ?? p.passage ?? "", question: p.question ?? "", options: p.options ?? [], correct_letter: String.fromCharCode(65 + (p.correctIndex ?? 0)), explanation: p.explanation, design: "" };
    const c: Cand = { cid: r.gid, skill: r.skill, system: "sat_rw", method: "recipe", recipeId: r.recipeId ?? null, instruction: "", idx: 0 };
    return { c, g };
  });
  const reqs = items.flatMap(({ c, g }) => [blindReq(model, c.cid, c.skill, g), auditReq(model, c, g, recipesFor(c.skill).find((x) => x.id === c.recipeId) ?? null)]);
  const est = estimate(model, items.length, 2800, 520) * mult();
  console.log(`재검수 ${items.length}건(요청 ${reqs.length}) ${model} 추정 $${est.toFixed(2)} 누적 $${ledger(dir).spent().toFixed(2)}`);
  if (flag("--dry")) return;
  const res = await runBatch({ dir, name: "rereview", requests: reqs, budgetUsd: Number(arg("--budget") ?? 8), estimateUsd: est / mult(), sync: SYNC });
  const out = items.map(({ c, g }) => { const b = res.get(`b-${c.cid}`.slice(0, 64)), a = res.get(`a-${c.cid}`.slice(0, 64)); const bi = b ? toolInput(b) : null, ai = a ? toolInput(a) : null; const rec = recipesFor(c.skill).find((x) => x.id === c.recipeId)!; const correct = Boolean(bi && ai && bi.picked_letter === g.correct_letter && !bi.other_defensible && ai.answer_correct && ai.explanation_consistent && ai.format_ok); const met = ai ? (ai.met as boolean[]).filter(Boolean).length : 0; const fit = Boolean(ai && ai.beyond_medium && !ai.only_complexity); return { gid: c.cid, skill: c.skill, recipeId: c.recipeId, correctOk: correct, complianceOk: met >= rec.minMet, hardFitOk: fit, which: ai?.which ?? [], note: ai?.note ?? "", hold: !(correct && fit) }; });
  writeFileSync(path.join(dir, "rereview.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ n: out.length, correct: out.filter((x) => x.correctOk).length, compliance: out.filter((x) => x.complianceOk).length, hardFit: out.filter((x) => x.hardFitOk).length, hold: out.filter((x) => x.hold).length }));
}

/** 조합 간 비교: 같은 후보 부분집합(RW·Math 각 idx < N)으로 A·B·C(+원형) 지표를 같은 식으로 집계. 실행: compare [--n-rw 3 --n-math 3] */
function compare() {
  const nRw = Number(arg("--n-rw") ?? 3), nMath = Number(arg("--n-math") ?? 3);
  const out: Record<string, unknown> = {};
  for (const [label, dir] of [["A(Sonnet5.5/Sonnet5.5)", "A-recipe"], ["B(Opus5.5/Fable5.1)", "B-recipe"], ["C(Fable5.1/Opus5.5)", "C-recipe"], ["A-원형(Sonnet5.5)", "A-archetype"]] as const) {
    const d = path.join(RUN, "batch", dir);
    if (!existsSync(path.join(d, "gens.json"))) continue;
    const { items } = judge(d);
    const res: Record<string, unknown> = {};
    for (const sys of ["sat_rw", "sat_math"]) {
      const sub = items.filter((i) => i.system === sys && (i.idx ?? 0) < (sys === "sat_rw" ? nRw : nMath));
      if (!sub.length) continue;
      const adopted = sub.filter((i) => i.adopted).length;
      const cause: Record<string, number> = {};
      for (const i of sub) for (const c of i.causes) cause[c] = (cause[c] ?? 0) + 1;
      const judged = sub.filter((i) => i.hardFitOk !== null);
      const mv = sub.filter((i) => i.mathVerify);
      res[sys] = { cand: sub.length, detPass: sub.filter((i) => i.detOk !== false && !i.causes.some((c) => c.startsWith("생성"))).length, reviewed: judged.length, correctOk: sub.filter((i) => i.correctOk).length, complianceOk: sub.filter((i) => i.complianceOk).length, hardFitOk: sub.filter((i) => i.hardFitOk).length, hardFitRateOfReviewed: judged.length ? +(judged.filter((i) => i.hardFitOk).length / judged.length).toFixed(2) : null, adopted, yield: +(adopted / sub.length).toFixed(3), costUsd: +sub.reduce((a, i) => a + (i.cost ?? 0), 0).toFixed(3), costPerAdopted: adopted ? +(sub.reduce((a, i) => a + (i.cost ?? 0), 0) / adopted).toFixed(3) : null, mathVerify: sys === "sat_math" ? { pass: mv.filter((i) => i.mathVerify === "pass").length, fail: mv.filter((i) => i.mathVerify === "fail").length, skipped: mv.filter((i) => i.mathVerify === "skipped").length } : undefined, causes: cause };
    }
    out[label] = res;
  }
  writeFileSync(path.join(RUN, "batch", "compare.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}

const REVIEWERS = [{ key: "fable", model: "claude-fable-5-1" }, { key: "opus", model: "claude-opus-5-5" }] as const;
const formatFail = (issues: string[]) => issues.some((i) => /math_|unbalanced_dollar|raw_latex/.test(i));
/** 2026-10-08 재조정 생성: 칸(skill x 난이도 x 과목)별 후보 파일. 각 후보는 구체 소재 씨앗을 가진다. */
type FileCand = { skill: string; difficulty: "easy" | "medium" | "hard"; seed: string };
function buildFileCands(rows: FileCand[], prefix: string): Cand[] {
  const cnt = new Map<string, number>();
  return rows.map((r, n) => {
    const k = `${r.skill}|${r.difficulty}`; const i = cnt.get(k) ?? 0; cnt.set(k, i + 1);
    const rc = r.difficulty === "hard" ? recipesFor(r.skill)[i % recipesFor(r.skill).length] : null;
    return { cid: `${prefix}-${r.skill}-${r.difficulty[0]}-${String(n).padStart(3, "0")}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64), skill: r.skill, system: "sat_rw" as const, method: r.difficulty === "hard" ? "recipe" : r.difficulty, recipeId: rc?.id ?? null, instruction: rc ? rc.instruction : levelInstruction(r.skill, r.difficulty as "easy" | "medium"), idx: n, difficulty: r.difficulty, seed: r.seed, targetLetter: TARGET_LETTERS[n % 4] };
  });
}
let AVOID_MSG = "";

/** 교차 채점 시험: 생성 Opus 5.5 고정(동기), 같은 후보를 검수 모델 2개(Fable 5.1·Opus 5.5)가 채점. 새 예산 구간 batch2/ledger.json. 실행: cross [--per 6] [--budget 6] [--dry] */
async function cross() {
  const per = Number(arg("--per") ?? 6), budget = Number(arg("--budget") ?? 6);
  const genModel = arg("--gen-model") ?? "claude-opus-5-5";
  MATH_PROMPT = (arg("--math-prompt") ?? "v2") as "v1" | "v2";
  const dir = path.join(RUN, arg("--dir") ?? "batch2/D-cross");
  mkdirSync(dir, { recursive: true });
  const specArg = arg("--skills");
  const spec = specArg ? Object.fromEntries(specArg.split(",").map((x) => { const [k, n] = x.split(":"); return [k, Number(n)]; })) : undefined;
  const level = (arg("--difficulty") ?? "hard") as "easy" | "medium" | "hard";
  if (!["easy", "medium", "hard"].includes(level)) throw new Error("--difficulty 는 easy|medium|hard");
  if (level !== "hard" && !spec && !arg("--cands-file")) throw new Error("--difficulty easy|medium 은 --skills skill:n,... 필요(RW 전용)");
  if (level !== "hard" && spec && Object.keys(spec).some((k) => isMath(k))) throw new Error("--difficulty easy|medium 은 RW skill 만 지원");
  const candsFile = arg("--cands-file");
  if (candsFile) { const av = arg("--avoid-file") ? (JSON.parse(readFileSync(arg("--avoid-file")!, "utf-8")) as string[]) : []; const avoid = [...new Set([...RW_SATURATED_TOPICS, ...av])]; AVOID_MSG = ` 질문에는 정답 선택지의 문구·핵심어를 그대로 쓰지 말고(정답이 질문과 닮아 보이지 않게), 오답도 정답과 같은 문장 틀로 쓴다. 다음 소재는 이미 은행에 넘치므로 쓰지 않는다: ${avoid.join("; ")}.`; }
  const cands: Cand[] = candsFile ? buildFileCands(JSON.parse(readFileSync(candsFile, "utf-8")) as FileCand[], arg("--prefix") ?? "rb") : level === "hard" ? buildCands("recipe", per, Number(arg("--per-math") ?? per), spec, Number(arg("--idx-offset") ?? 0)) : buildLevelCands(level, spec!, SEEDS, Number(arg("--idx-offset") ?? 0));
  writeFileSync(path.join(dir, "candidates.json"), JSON.stringify(cands));
  const led = ledger(dir);
  // 추정(동기 단가): 앞선 실측 — Opus 생성 약 $0.034/후보, Fable 검수 약 $0.105/후보, Opus 검수 약 $0.03/후보(결정론 통과 약 85%)
  const est = cands.length * 0.034 + cands.length * 0.85 * (0.105 + 0.03);
  console.log(`[D-cross] 후보 ${cands.length} · 생성 ${genModel} · 검수 fable+opus · 추정(동기) $${est.toFixed(2)} · 구간 누적 $${led.spent().toFixed(2)} / 상한 $${budget}`);
  if (led.spent() + est > budget * 1.15) throw new Error("추정이 상한을 크게 넘음 — 실행하지 않음");
  if (flag("--dry")) return;
  const genReqs: BatchReq[] = cands.map((c) => ({ custom_id: c.cid, params: { model: genModel, ...think(genModel), max_tokens: c.system === "sat_math" ? 5000 : 4500, system: [{ type: "text", text: genSystem(c), cache_control: SYS_CACHE }], tools: [genTool(c)], tool_choice: { type: "auto" }, messages: [{ role: "user", content: `후보 ${c.idx + 1}번. 같은 지시로 만든 다른 후보와 소재·수치가 겹치지 않게 새로 창작하라.${AVOID_MSG}${c.seed ? ` 소재(반드시 이 소재로 지문을 쓴다): ${c.seed}.` : ""}${c.targetLetter ? ` 정답(correct_letter)은 반드시 ${c.targetLetter} 위치에 놓아라(선택지 순서를 그에 맞게 구성).` : ""} 문항 1개를 반드시 problem 도구 호출로 제출하라(텍스트 답변 금지).` }] } }));
  const genRes = await runBatch({ dir, name: "gen", requests: genReqs, budgetUsd: budget, estimateUsd: cands.length * 0.017, sync: true });
  const gens = new Map<string, { c: Cand; g: Gen; det: { issues: string[]; mathVerify: string | null } }>();
  for (const c of cands) {
    const r = genRes.get(c.cid); const g = r ? (toolInput(r) as unknown as Gen | null) : null;
    if (!g || !Array.isArray(g.options) || g.options.length !== 4 || !g.question) continue;
    gens.set(c.cid, { c, g, det: await deterministic(c, g) });
  }
  if (candsFile) { // 정답 누설 게이트(강한 신호만): 스킬별 IDF 는 이번 배치의 질문·선택지로 만든다.
    const idfBySkill = new Map<string, ReturnType<typeof buildIdf>>();
    for (const sk of new Set([...gens.values()].map((x) => x.c.skill))) idfBySkill.set(sk, buildIdf([...gens.values()].filter((x) => x.c.skill === sk).map((x) => `${x.g.question}\n${x.g.options.join("\n")}`)));
    for (const x of gens.values()) { const a = analyzeLeak({ question: x.g.question, options: x.g.options, correctIndex: "ABCD".indexOf(x.g.correct_letter), skill: x.c.skill, passage: x.g.passage }, idfBySkill.get(x.c.skill)!); if (a.strong) x.det.issues.push("answer_leak:" + a.reasons.join("|")); }
  }
  writeFileSync(path.join(dir, "gens.json"), JSON.stringify([...gens.values()]));
  const passDet = [...gens.values()].filter((x) => x.det.issues.length === 0);
  for (const rv of REVIEWERS) {
    const reqs = passDet.flatMap(({ c, g }) => [blindReq(rv.model, c.cid, c.skill, g), c.difficulty && c.difficulty !== "hard" ? levelAuditReq(rv.model, c, g) : auditReq(rv.model, c, g, recipesFor(c.skill).find((r) => r.id === c.recipeId) ?? null)]);
    await runBatch({ dir, name: `review-${rv.key}`, requests: reqs, budgetUsd: budget, estimateUsd: passDet.length * (rv.key === "fable" ? 0.0525 : 0.015), sync: true });
  }
  crossReport(dir);
}
function crossReport(dir: string) {
  // crossReport 는 저장된 결과만 읽으므로 API 호출이 없다(`cross-report` 명령으로 재집계 가능).
  const cands = JSON.parse(readFileSync(path.join(dir, "candidates.json"), "utf-8")) as Cand[];
  const gens = new Map((JSON.parse(readFileSync(path.join(dir, "gens.json"), "utf-8")) as { c: Cand; g: Gen; det: { issues: string[]; mathVerify: string | null } }[]).map((x) => [x.c.cid, x]));
  const read = (n: string) => { const m = new Map<string, { cost?: number; in: Record<string, unknown> | null }>(); const f = path.join(dir, `${n}.results.jsonl`); if (!existsSync(f)) return m; for (const l of readFileSync(f, "utf-8").split("\n").filter(Boolean)) { const r = JSON.parse(l); if (r.ok) m.set(r.custom_id, { cost: r.cost, in: toolInput(r) }); } return m; };
  const gen = read("gen");
  const rev = { fable: read("review-fable"), opus: read("review-opus") };
  type V = { correct: boolean; comp: boolean; fit: boolean; which: string[]; note: string; issue: string };
  const verdict = (key: "fable" | "opus", c: Cand, g: Gen): V | null => {
    const b = rev[key].get(`b-${c.cid}`.slice(0, 64))?.in, a = rev[key].get(`a-${c.cid}`.slice(0, 64))?.in;
    if (!a || !b) return null;
    if (c.difficulty && c.difficulty !== "hard") {
      const lv = levelVerdict(c.difficulty, g.correct_letter, { answerCorrect: Boolean(a.answer_correct), explanationConsistent: Boolean(a.explanation_consistent), formatOk: Boolean(a.format_ok), factualError: Boolean(a.factual_error), copyrightSuspect: Boolean(a.copyright_suspect), explanationEnOk: Boolean(a.explanation_en_ok), levelVerdict: String(a.level_verdict), blindPicked: String(b.picked_letter), blindOtherDefensible: Boolean(b.other_defensible), eliminated: ((b.easily_eliminated as string[]) ?? []).length });
      return { correct: lv.correct, comp: true, fit: lv.fit, which: [String(a.level_verdict), `eliminated:${((b.easily_eliminated as string[]) ?? []).length}`], note: String(a.note ?? ""), issue: String(a.explanation_issue ?? "") + String(a.explanation_en_issue ?? "") };
    }
    const recipe = recipesFor(c.skill).find((r) => r.id === c.recipeId);
    const agree = b.picked_letter === g.correct_letter && !b.other_defensible;
    const correct = agree && Boolean(a.answer_correct) && Boolean(a.explanation_consistent) && Boolean(a.format_ok) && !a.factual_error && !a.copyright_suspect;
    const met = (a.met as boolean[]).filter(Boolean).length;
    return { correct, comp: recipe ? met >= recipe.minMet : true, fit: Boolean(a.beyond_medium) && !a.only_complexity, which: (a.which as string[]) ?? [], note: String(a.note ?? ""), issue: String(a.explanation_issue ?? "") + (agree ? "" : ` [블라인드: ${String(b.picked_letter)} 선택${b.other_defensible ? ", 복수정답 가능" : ""}]`) };
  };
  const items = cands.map((c) => {
    const x = gens.get(c.cid);
    const cost = (gen.get(c.cid)?.cost ?? 0) + (["fable", "opus"] as const).reduce((s, k) => s + (rev[k].get(`b-${c.cid}`.slice(0, 64))?.cost ?? 0) + (rev[k].get(`a-${c.cid}`.slice(0, 64))?.cost ?? 0), 0);
    if (!x) return { cid: c.cid, skill: c.skill, system: c.system, genFail: true, cost } as Record<string, unknown>;
    const f = verdict("fable", c, x.g), o = verdict("opus", c, x.g);
    return { cid: c.cid, skill: c.skill, system: c.system, recipeId: c.recipeId, detIssues: x.det.issues, formatFail: formatFail(x.det.issues), mathVerify: x.det.mathVerify, fable: f, opus: o, cost };
  });
  const out: Record<string, unknown> = {};
  for (const sys of ["sat_rw", "sat_math"]) {
    const sub = items.filter((i) => i.system === sys);
    const both = sub.filter((i) => i.fable && i.opus) as { fable: V; opus: V; cost: number; cid: string; skill: string }[];
    const dim = (k: "correct" | "comp" | "fit") => ({ agree: both.filter((i) => i.fable[k] === i.opus[k]).length, of: both.length, fablePass: both.filter((i) => i.fable[k]).length, opusPass: both.filter((i) => i.opus[k]).length });
    const adopt = (i: { fable: V; opus: V }, k: "fable" | "opus") => i[k].correct && i[k].comp && i[k].fit;
    const bothAdopt = both.filter((i) => adopt(i, "fable") && adopt(i, "opus")), one = both.filter((i) => adopt(i, "fable") !== adopt(i, "opus"));
    const totalCost = sub.reduce((a, i) => a + ((i.cost as number) ?? 0), 0);
    out[sys] = { cand: sub.length, genFail: sub.filter((i) => i.genFail).length, formatFail: sub.filter((i) => i.formatFail).length, detPass: sub.filter((i) => Array.isArray(i.detIssues) && (i.detIssues as string[]).length === 0).length, crossScored: both.length, correct: dim("correct"), compliance: dim("comp"), hardFit: dim("fit"), adoptedBoth: bothAdopt.length, adoptedOneOnly: one.length, yieldBoth: +(bothAdopt.length / Math.max(1, sub.length)).toFixed(3), costUsd: +totalCost.toFixed(3), costPerAdoptedBoth: bothAdopt.length ? +(totalCost / bothAdopt.length).toFixed(3) : null, fableOnlyPass: one.filter((i) => adopt(i, "fable")).length, opusOnlyPass: one.filter((i) => adopt(i, "opus")).length };
  }
  // 채택 기준(2026-09-30 총괄·오너): hard 인정 = Fable 5.1 hard 적합 통과 + 정답 정확성·레시피 준수 통과. Opus 5.5 의견은 채택 조건이 아니라 advisory 로만 기록.
  // 정답 정확성은 기본적으로 Fable·Opus 둘 다 통과를 요구한다(한쪽만 잡은 실제 결함 — 해설 자기 모순·형식 불일치 — 이 있었음). `--correct-fable-only` 로 Fable 만 요구.
  const fableOnly = flag("--correct-fable-only");
  const { SKILL_BY_CODE } = require("../../lib/problem-taxonomy") as typeof import("../../lib/problem-taxonomy");
  const adoptedHard = items.filter((i) => i.fable && i.opus).filter((i) => { const f = i.fable as V, o = i.opus as V; return f.correct && f.comp && f.fit && (fableOnly || o.correct); }).map((i) => {
    const x = gens.get(i.cid as string)!; const f = i.fable as V, o = i.opus as V; const meta = SKILL_BY_CODE.get(x.c.skill)!;
    const lvl = x.c.difficulty ?? "hard";
    return { gid: x.c.cid, runId: lvl === "hard" ? "batch2-D-cross" : `rw-supplement-${lvl}`, skill: x.c.skill, domain: meta.domain, examSystem: x.c.system, difficulty: lvl, format: "mc", recipeId: x.c.recipeId, ...(lvl === "hard" ? { difficultyStatus: "provisional_ai" } : {}),
      problem: { passage: `${x.g.passage}\n\n${x.g.question}`, stimulus: x.g.passage, question: x.g.question, options: x.g.options, correctIndex: "ABCD".indexOf(x.g.correct_letter), answers: null, explanation: x.g.explanation, explanationEn: x.g.explanation_en ?? null, figure: null, statements: null },
      quality: { generatedBy: "claude-opus-5-5", ...(lvl === "hard" ? {} : { levelTarget: lvl, targetLetter: x.c.targetLetter ?? null, seed: x.c.seed ?? null }), hardJudge: { model: "claude-fable-5-1", effort: "low", fit: f.fit, correctOk: f.correct, complianceOk: f.comp, which: f.which, note: f.note }, advisory: { model: "claude-opus-5-5", effort: "low", fit: o.fit, correctOk: o.correct, complianceOk: o.comp, which: o.which, note: o.note, passed: o.fit } } };
  });
  writeFileSync(path.join(dir, "adopted-hard.json"), JSON.stringify(adoptedHard, null, 1));
  if (adoptedHard.some((a) => a.difficulty !== "hard")) writeFileSync(path.join(dir, "adopted.json"), JSON.stringify(adoptedHard, null, 1));
  (out as Record<string, unknown>).adoptedHardFableRule = { total: adoptedHard.length, rw: adoptedHard.filter((a) => a.examSystem === "sat_rw").length, math: adoptedHard.filter((a) => a.examSystem === "sat_math").length, correctBothRequired: !fableOnly };
  writeFileSync(path.join(dir, "cross.json"), JSON.stringify({ summary: out, items }, null, 1));
  console.log(JSON.stringify(out, null, 1));
}


/** RW 일반 문항(easy/medium) — Sonnet 5.5 Message Batches 생성 + Sonnet 5.5 검수(블라인드 풀이 + 감사). 소재 씨앗을 주입한다. 실행: basic [--per 1] [--budget 1.5] [--dry] */
const SEEDS = ["자연과학(생물·생태)", "자연과학(물리·천문)", "역사(근대 사회 변화)", "예술·건축 비평", "문학(19세기 소설 분위기의 현대 서술)", "사회과학(경제·행동)", "기술·공학 사례", "인물 소개(과학자·예술가)", "환경·지리", "언어·인류학"];
async function basic() {
  const per = Number(arg("--per") ?? 1), budget = Number(arg("--budget") ?? 1.5);
  const dir = path.join(RUN, "batch4", "basic");
  mkdirSync(dir, { recursive: true });
  const RW_ALL = ["central_ideas_details", "inferences", "command_of_evidence_text", "words_in_context", "text_structure_purpose", "cross_text_connections", "rhetorical_synthesis", "transitions", "boundaries", "form_structure_sense"];
  const cands: Cand[] = [];
  for (const skill of RW_ALL) for (const difficulty of ["easy", "medium"] as const) for (let i = 0; i < per; i++) cands.push({ cid: `basic-${skill}-${difficulty}-${i}`.slice(0, 64), skill, system: "sat_rw", method: "basic", recipeId: null, instruction: "", idx: i, difficulty, seed: SEEDS[(cands.length + i) % SEEDS.length] });
  writeFileSync(path.join(dir, "candidates.json"), JSON.stringify(cands));
  const gm = "claude-sonnet-5-5", led = ledger(dir);
  const est = estimate(gm, cands.length, 1500, 1000) + estimate(gm, cands.length, 2800, 520);
  console.log(`[basic] 후보 ${cands.length} · 생성/검수 ${gm}(Message Batches) · 추정 $${est.toFixed(2)} · 구간 누적 $${led.spent().toFixed(2)} / 상한 $${budget}`);
  if (led.spent() + est > budget) throw new Error("예산 초과 예상");
  if (flag("--dry")) return;
  const genReqs: BatchReq[] = cands.map((c) => ({ custom_id: c.cid, params: { model: gm, ...think(gm), max_tokens: 4500, system: [{ type: "text", text: genSystem(c), cache_control: SYS_CACHE }], tools: [genTool(c)], tool_choice: { type: "auto" }, messages: [{ role: "user", content: `후보 ${c.idx + 1}번. 문항 1개를 반드시 problem 도구 호출로 제출하라(텍스트 답변 금지).` }] } }));
  const genRes = await runBatch({ dir, name: "gen", requests: genReqs, budgetUsd: budget, estimateUsd: estimate(gm, cands.length, 1500, 1000) });
  const gens: { c: Cand; g: Gen; det: { issues: string[]; mathVerify: string | null } }[] = [];
  for (const c of cands) { const r = genRes.get(c.cid); const g = r ? (toolInput(r) as unknown as Gen | null) : null; if (!g || !Array.isArray(g.options) || g.options.length !== 4) continue; gens.push({ c, g, det: await deterministic(c, g) }); }
  const passDet = gens.filter((x) => x.det.issues.length === 0);
  const revReqs = passDet.flatMap(({ c, g }) => [blindReq(gm, c.cid, c.skill, g), auditReq(gm, c, g, null)]);
  const revRes = await runBatch({ dir, name: "review", requests: revReqs, budgetUsd: budget, estimateUsd: estimate(gm, passDet.length, 2800, 520) });
  const { SKILL_BY_CODE } = require("../../lib/problem-taxonomy") as typeof import("../../lib/problem-taxonomy");
  const stats: Record<string, { cand: number; detPass: number; adopted: number; reasons: Record<string, number> }> = {};
  const adopted: unknown[] = [];
  for (const c of cands) {
    const st = (stats[c.skill] ??= { cand: 0, detPass: 0, adopted: 0, reasons: {} });
    st.cand++;
    const x = gens.find((y) => y.c.cid === c.cid);
    const why = (k: string) => (st.reasons[k] = (st.reasons[k] ?? 0) + 1);
    if (!x) { why("생성실패"); continue; }
    if (x.det.issues.length) { for (const i of x.det.issues) why(`생성:${i.replace(/^contract:contract_/, "")}`); continue; }
    st.detPass++;
    const b = revRes.get(`b-${c.cid}`.slice(0, 64)), a = revRes.get(`a-${c.cid}`.slice(0, 64));
    const bi = b ? toolInput(b) : null, ai = a ? toolInput(a) : null;
    if (!bi || !ai) { why("검수응답없음"); continue; }
    let ok = true;
    if (bi.picked_letter !== x.g.correct_letter || bi.other_defensible) { ok = false; why("정답:블라인드불일치"); }
    if (!ai.answer_correct) { ok = false; why("정답:감사오답"); }
    if (!ai.explanation_consistent) { ok = false; why("해설불일치"); }
    if (!ai.format_ok) { ok = false; why("형식결함"); }
    if (ai.factual_error) { ok = false; why("사실오류"); }
    if (ai.copyright_suspect) { ok = false; why("저작권의심"); }
    if (!ok) continue;
    st.adopted++;
    const meta = SKILL_BY_CODE.get(c.skill)!;
    adopted.push({ gid: `basic:${c.cid}`, runId: "batch3-basic", skill: c.skill, domain: meta.domain, examSystem: "sat_rw", difficulty: c.difficulty, format: "mc", recipeId: null, problem: { passage: `${x.g.passage}\n\n${x.g.question}`, stimulus: x.g.passage, question: x.g.question, options: x.g.options, correctIndex: "ABCD".indexOf(x.g.correct_letter), answers: null, explanation: x.g.explanation, figure: null, statements: null }, quality: { generatedBy: gm, reviewedBy: gm, seed: c.seed, blind: { picked: bi.picked_letter, confidence: bi.confidence }, audit: { which: ai.which, note: ai.note } } });
  }
  writeFileSync(path.join(dir, "adopted-basic.json"), JSON.stringify(adopted, null, 1));
  const cost = led.spent();
  console.log(JSON.stringify({ stats, adopted: adopted.length, cand: cands.length, costUsd: cost }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
