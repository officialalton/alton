// 1단계 A: 실전 시험지(test4·6~11) 문항별 '내용 기반' 사고 프로파일 추출 (2026-09-30). 문항 문장 복제 없이 등급·태그만 저장한다.
// 실행: npx tsx scripts/mock-exam-generation/cb-extract.ts [--tests test6,test7] [--concurrency 6]
//   입력: /tmp/sat/r<N>.txt (pdftotext 본문), /tmp/sat/skillmap.json (커버리지 맵의 문항→skill)
//   출력: data/mock-exam-generation/cb-hard/profiles/<test>-<sec>-<mod>.json  [{n, skill, steps, combine, shift, abstract, subtle, traps[], note}]
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const NORM: Record<string, string> = { linear_two_variables: "linear_equations_two_var", ratios_rates: "ratios_rates_units", inference_from_sample: "inference_margin_error" };
const out = path.resolve("data/mock-exam-generation/cb-hard/profiles");
mkdirSync(out, { recursive: true });
const map = JSON.parse(readFileSync("/tmp/sat/skillmap.json", "utf-8")) as Record<string, Record<string, string>>;

async function one(test: string, sec: "R&W" | "Math", mod: "M1" | "M2") {
  const file = path.join(out, `${test}-${sec === "Math" ? "math" : "rw"}-${mod}.json`);
  if (existsSync(file)) return;
  const skills = map[`${test}|${sec}|${mod}`];
  const n = Object.keys(skills).length;
  const text = readFileSync(`/tmp/sat/r${test.replace("test", "")}.txt`, "utf-8");
  const list = Object.entries(skills).map(([k, v]) => `${k}: ${NORM[v] ?? v}`).join("\n");
  for (let a = 0; a < 3; a++) {
    try {
      const m = await client.messages.create({
        model: "claude-sonnet-5", max_tokens: 9000,
        tools: [{ name: "profiles", description: "문항별 사고 프로파일", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: {
          n: { type: "number", description: "모듈 안 문항 번호" },
          steps: { type: "number", description: "정답 도달에 필요한 독립 추론/풀이 단계 수 1~5" },
          combine: { type: "number", description: "결합해야 하는 개념·텍스트 단서·정보원 수 1~4" },
          shift: { type: "number", description: "표현 변환(식↔그래프↔표↔문장, 비유·함축 해석) 필요도 1~3" },
          abstract: { type: "number", description: "지문/맥락의 추상도·낯선 정도 1~3" },
          subtle: { type: "number", description: "정답과 오답 선지 구분의 미세함 1~3" },
          traps: { type: "array", items: { type: "string" }, description: "함정 유형 이름(짧은 영어 snake_case, 예: scope_overreach, reversed_relation, partial_computation). 문항 문장 인용 금지" },
          note: { type: "string", description: "이 문항이 요구하는 사고를 20단어 이내로 요약(문장 인용·복제 금지)" },
        }, required: ["n", "steps", "combine", "shift", "abstract", "subtle", "traps", "note"] } } }, required: ["items"] } as never }],
        tool_choice: { type: "tool", name: "profiles" },
        messages: [{ role: "user", content: `아래는 디지털 SAT 실전 연습 시험(${test}) 전체 본문이다. 이 중 **${sec === "Math" ? "Math" : "Reading and Writing"} 섹션의 Module ${mod.slice(1)}** 문항 ${n}개(섹션 안에서 번호 순서대로 나온다)를 각각 '무엇을 생각해야 풀리는가' 기준으로 프로파일링하라. 난이도 추정이 아니라 내용의 사고 요구를 채점한다(모듈 앞/뒤 위치는 고려하지 않는다). 문항·지문 문장을 그대로 옮기지 말고 등급과 이름만 적어라.\n번호: 세부 기술(참고용)\n${list}\n\n===== 시험 본문 =====\n${text}` }],
      });
      const tu = m.content.find((c) => c.type === "tool_use");
      if (tu && tu.type === "tool_use") {
        const items = ((tu.input as { items: Record<string, unknown>[] }).items ?? []).map((i) => ({ ...i, skill: NORM[skills[String(i.n)]] ?? skills[String(i.n)] ?? null }));
        writeFileSync(file, JSON.stringify({ test, sec, mod, expected: n, items }));
        process.stderr.write(`${test} ${sec} ${mod}: ${items.length}/${n}\n`);
        return;
      }
    } catch (e) { process.stderr.write(`재시도 ${test} ${sec} ${mod}: ${(e as Error).message.slice(0, 80)}\n`); await new Promise((r) => setTimeout(r, 4000)); }
  }
}
(async () => {
  const tests = (arg("--tests") ?? "test4,test6,test7,test8,test9,test10,test11").split(",");
  const jobs = tests.flatMap((t) => (["R&W", "Math"] as const).flatMap((s) => (["M1", "M2"] as const).map((m) => () => one(t, s, m))));
  const conc = Number(arg("--concurrency") ?? 6);
  const q = [...jobs];
  await Promise.all(Array.from({ length: conc }, async () => { while (q.length) await q.shift()!(); }));
})();
