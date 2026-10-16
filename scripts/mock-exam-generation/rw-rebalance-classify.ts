// 재조정 신규 생성분(adopted.json) 지문의 과목·소재 분류(2026-10-08). 결과는 rw-topics 의 classified.json(지문 해시 키)에 병합 — 이후 새 덤프로 rw-topics.ts 를 돌리면 다시 분류하지 않는다.
// 실행: npx tsx scripts/mock-exam-generation/rw-rebalance-classify.ts --in a.json,b.json [--out classified-new.json] [--classified data/mock-exam-generation/rw-topics-20261008/classified.json]
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { SYSTEM } from "./rw-topics";
import { SUBJECTS, passageHash, slug } from "./rw-topics-lib";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const envPath = path.resolve(process.cwd(), ".env.local");
if (!process.env.ANTHROPIC_API_KEY && existsSync(envPath)) for (const l of readFileSync(envPath, "utf-8").split("\n")) { const m = l.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/); if (m) process.env.ANTHROPIC_API_KEY = m[1].replace(/^["']|["']$/g, ""); }
type Rec = { gid: string; skill: string; quality?: { seedSubject?: string }; problem: { stimulus?: string | null; passage?: string | null } };
async function main() {
  const recs = (arg("--in") ?? "").split(",").filter(Boolean).flatMap((f) => JSON.parse(readFileSync(f, "utf-8")) as Rec[]);
  const clsPath = arg("--classified") ?? "data/mock-exam-generation/rw-topics-20261008/classified.json";
  const cls = JSON.parse(readFileSync(clsPath, "utf-8")) as Record<string, { subject: string; cluster: string; family: string }>;
  const outPath = arg("--out") ?? "data/mock-exam-generation/rebalance-20261008/gen/classified-new.json";
  const prev = existsSync(outPath) ? (JSON.parse(readFileSync(outPath, "utf-8")) as Record<string, { subject: string; cluster: string; family: string; gid: string; skill: string }>) : {};
  const todo = recs.map((r) => ({ r, h: passageHash(r.problem.stimulus ?? r.problem.passage ?? "") })).filter((x) => !prev[x.h]);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); let usd = 0;
  for (let i = 0; i < todo.length; i += 25) {
    const b = todo.slice(i, i + 25);
    const user = b.map((x, k) => `[${k + 1}] ${(x.r.problem.stimulus ?? x.r.problem.passage ?? "").replace(/\s+/g, " ").slice(0, 900)}`).join("\n\n");
    const r = await client.messages.create({ model: "claude-haiku-4-5", max_tokens: 4000, temperature: 0, system: SYSTEM, messages: [{ role: "user", content: user }] });
    usd += (r.usage.input_tokens * 1 + r.usage.output_tokens * 5) / 1e6;
    const m = r.content.map((c) => (c.type === "text" ? c.text : "")).join("").match(/\[[\s\S]*\]/); if (!m) throw new Error("no json");
    for (const e of JSON.parse(m[0]) as { i: number; subject: string; cluster: string; family: string }[]) { const x = b[e.i - 1]; if (!x) continue; const lit = x.r.quality?.seedSubject === "literature_fiction"; // 소설 장면 소재로 생성된 지문은 분류기가 주제로 오분류해도 문학으로 확정한다.
      const v = { subject: lit ? "literature_fiction" : (SUBJECTS as readonly string[]).includes(e.subject) ? e.subject : "humanities", cluster: lit ? slug(`fiction-${String(e.cluster || "unknown").replace(/^fiction-/, "")}`) : slug(e.cluster || "unknown"), family: slug(e.family || "unknown") }; prev[x.h] = { ...v, gid: x.r.gid, skill: x.r.skill }; cls[x.h] = v; }
  }
  writeFileSync(outPath, JSON.stringify(prev, null, 1)); writeFileSync(clsPath, JSON.stringify(cls));
  console.log(JSON.stringify({ classified: todo.length, total: Object.keys(prev).length, usd: +usd.toFixed(4) }));
}
main().catch((e) => { console.error(e); process.exit(1); });
