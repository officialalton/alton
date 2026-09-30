// 1단계 B: skill별 hard 특성 합성 (2026-09-30). 프로파일(내용 기반 등급)에서 같은 skill 의 '사고 요구 상위 25%' 대 '하위 25%'를 대조한다.
// 모듈 위치(앞/뒤)는 근거로 쓰지 않고 참고 상관만 기록한다. 공식 난이도(College Board 표기)는 이 자료에 없어 officialDifficulty=null.
// 실행: npx tsx scripts/mock-exam-generation/cb-synth.ts  -> data/mock-exam-generation/cb-hard/hard-characteristics.json
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const dir = path.resolve("data/mock-exam-generation/cb-hard/profiles");
type Item = { n: number; steps: number; combine: number; shift: number; abstract: number; subtle: number; traps: string[]; note: string; skill: string | null };
type Rec = Item & { ref: string; score: number; pos: number };
const all: Rec[] = [];
for (const f of readdirSync(dir)) {
  const d = JSON.parse(readFileSync(path.join(dir, f), "utf-8")) as { test: string; sec: string; mod: string; expected: number; items: Item[] };
  for (const i of d.items) if (i.skill && i.skill !== "없음" && i.skill !== "boundesar") all.push({ ...i, ref: `${d.test}-${d.sec === "Math" ? "Math" : "RW"}-${d.mod}-Q${i.n}`, score: i.steps + i.combine + i.shift + i.abstract + i.subtle, pos: i.n / d.expected });
}
const bySkill = new Map<string, Rec[]>();
for (const r of all) (bySkill.get(r.skill!) ?? bySkill.set(r.skill!, []).get(r.skill!)!).push(r);
const mean = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) / 100 : 0);
const corr = (xs: number[], ys: number[]) => { const mx = mean(xs), my = mean(ys); const c = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0); const d = Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0) * ys.reduce((a, y) => a + (y - my) ** 2, 0)); return d ? Math.round((c / d) * 100) / 100 : 0; };
const freq = (g: Rec[]) => { const m = new Map<string, number>(); for (const r of g) for (const t of r.traps) m.set(t, (m.get(t) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6); };

(async () => {
  const result: Record<string, unknown> = {};
  for (const [skill, items] of [...bySkill.entries()].sort()) {
    if (items.length < 8) { result[skill] = { skill, n: items.length, skipped: "표본 8 미만" }; continue; }
    const sorted = [...items].sort((a, b) => b.score - a.score);
    const k = Math.max(3, Math.round(items.length * 0.25));
    const hi = sorted.slice(0, k), lo = sorted.slice(-k);
    const stats = (g: Rec[]) => ({ steps: mean(g.map((r) => r.steps)), combine: mean(g.map((r) => r.combine)), shift: mean(g.map((r) => r.shift)), abstract: mean(g.map((r) => r.abstract)), subtle: mean(g.map((r) => r.subtle)), traps: freq(g) });
    const m = await client.messages.create({
      model: "claude-sonnet-5", max_tokens: 2500,
      tools: [{ name: "characteristics", description: "hard 특성", input_schema: { type: "object", properties: { characteristics: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", properties: {
        name: { type: "string", description: "특성 이름(짧은 영어 snake_case)" },
        description: { type: "string", description: "하위 그룹 대비 추가로 요구하는 사고를 한국어 1~2문장으로. 긴 문장·복잡한 숫자·계산량만으로 어려운 것은 특성이 아니다" },
        evidence: { type: "array", items: { type: "string" }, description: "근거 문항 참조(입력에 있는 ref 문자열만, 2~4개)" },
      }, required: ["name", "description", "evidence"] } } }, required: ["characteristics"] } as never }],
      tool_choice: { type: "tool", name: "characteristics" },
      messages: [{ role: "user", content: `디지털 SAT '${skill}' 문항 ${items.length}개(7개 실전 시험)를 사고 요구 점수로 나눈 상위 그룹(사고 요구 큼)과 하위 그룹을 대조해, 상위 그룹이 하위 그룹보다 **추가로 요구하는 사고**를 3~5개 특성으로 정리하라. 모듈 위치는 고려하지 않는다. 지문·문항 문장을 복제하지 말고 특성 이름과 설명만 쓴다. evidence 는 입력의 ref 문자열만 쓴다.\n\n[상위 그룹 평균] ${JSON.stringify(stats(hi))}\n[하위 그룹 평균] ${JSON.stringify(stats(lo))}\n\n[상위 그룹 문항 요약]\n${hi.map((r) => `${r.ref} (점수 ${r.score}; 함정 ${r.traps.join(",")}): ${r.note}`).join("\n")}\n\n[하위 그룹 문항 요약]\n${lo.map((r) => `${r.ref} (점수 ${r.score}; 함정 ${r.traps.join(",")}): ${r.note}`).join("\n")}` }],
    });
    const tu = m.content.find((c) => c.type === "tool_use");
    const chars = tu && tu.type === "tool_use" ? (tu.input as { characteristics: unknown[] }).characteristics : [];
    result[skill] = { skill, n: items.length, groupSize: k, hiStats: stats(hi), loStats: stats(lo), positionCorrelation: corr(items.map((r) => r.pos), items.map((r) => r.score)), officialDifficulty: null, difficultySource: "내부 추정: 문항 내용 기반 사고 요구 점수 상위 25% 대 하위 25% 대조(College Board 공식 난이도 표기는 이 시험지 PDF에 없음)", characteristics: chars, hiRefs: hi.map((r) => r.ref) };
    process.stderr.write(`${skill}: ${items.length} -> ${(chars as unknown[]).length}\n`);
  }
  writeFileSync(path.resolve("data/mock-exam-generation/cb-hard/hard-characteristics.json"), JSON.stringify(result, null, 1));
})();
