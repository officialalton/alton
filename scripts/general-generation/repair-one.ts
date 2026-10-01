// 오답 보수 1회 — mock-exam-generation/repair.ts 의 repairOne 을 그대로 복사(원본은 export 가 없고 다른 에이전트가 수정 중이라 복사).
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Raw } from "../mock-exam-generation/review";
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

let lastFail = "";
export async function repairOne(r: Raw, flagged: number[]): Promise<{ options: string[]; explanation: string; note: string } | null> {
  const p = r.problem;
  const stim = p.stimulus ?? p.passage ?? "";
  const opts = p.options ?? [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const msg = await getClient().messages.create({
        model: "claude-sonnet-5", max_tokens: 2500,
        tools: [{ name: "repair_distractors", description: "쉽게 지워지는 오답 선지만 교체한다.", input_schema: { type: "object", properties: {
          replacements: { type: "array", items: { type: "object", properties: { letter: { type: "string", enum: ["A", "B", "C", "D"], description: "교체할 선지의 알파벳" }, text: { type: "string" }, misconception: { type: "string", description: "이 오답이 기반한 구체적 오개념·계산 실수(한국어 한 줄)" } }, required: ["letter", "text", "misconception"] } },
          explanation: { type: "string", description: "해설 전체. 교체된 선지를 설명하던 문장만 새 선지에 맞게 고치고 나머지는 글자 그대로 유지" },
        }, required: ["replacements", "explanation"] } as never }],
        tool_choice: { type: "tool", name: "repair_distractors" },
        messages: [{ role: "user", content: `디지털 SAT 문항의 오답 선지 일부가 피상적으로 읽어도 쉽게 지워집니다. 아래 "교체 대상" 선지만, 학생이 실제로 저지를 법한 오개념·계산 실수(R&W는 범위 오류·일부만 맞는 진술·화자/관계 혼동·과장, Math는 부호·단위·한 단계 누락·조건 무시·공식 오적용)에 기반한 그럴듯한 오답으로 바꾸세요.
v2 보강: 독립 채점자는 '정답이 아니라는 근거를 지문에서 한 줄로 바로 댈 수 있는 선지'를 쉽게 지워지는 오답으로 본다. 새 선지는 (a) 지문/자료의 핵심 어휘·수치를 실제로 사용하고 (b) 정답과 같은 범주·같은 길이·같은 문법 구조이며 (c) 지문을 일부만 읽거나 한 단계만 잘못 추론·계산해도 고를 수 있어야 한다. 교체 전 선지와 같은 종류의 눈에 띄는 결함(정반대, 지문에 없는 새 정보, 'only/always/never' 같은 극단어, 정답과 다른 범주)을 반복하지 말고, 교체 대상이 아닌 선지가 이미 쉽게 지워지는 종류면 그 선지와 비슷해지지 않게 한다. 각 선지가 정답과 얼마나 가까운지(정답의 핵심 요소 2개 중 1개만 맞음 등)를 misconception 에 구체적으로 적어라.
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
      if (!tu || tu.type !== "tool_use") { lastFail = "no_tool_use"; continue; }
      const inp = tu.input as { replacements?: { letter: string; text: string; misconception: string }[]; explanation?: string };
      const next = [...opts];
      const seen = new Set<number>();
      for (const rep of inp.replacements ?? []) { const ix = "ABCD".indexOf(String(rep.letter).toUpperCase()); if (ix >= 0 && flagged.includes(ix) && ix !== p.correctIndex && rep.text?.trim()) { next[ix] = rep.text.trim(); seen.add(ix); } }
      if (seen.size !== flagged.length) { lastFail = `replaced ${seen.size}/${flagged.length} letters=${JSON.stringify((inp.replacements ?? []).map((x) => x.letter))} flagged=${JSON.stringify(flagged)}`; continue; }
      if (new Set(next.map((o) => o.trim().toLowerCase())).size !== next.length) { lastFail = "duplicate_option"; continue; }
      return { options: next, explanation: (inp.explanation ?? p.explanation).trim() || p.explanation, note: (inp.replacements ?? []).map((x) => `${x.letter}: ${x.misconception}`).join(" / ") };
    } catch { await new Promise((res) => setTimeout(res, 3000 * (attempt + 1))); }
  }
  return null;
}

