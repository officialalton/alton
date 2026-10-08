// 13세트 재조정용 R&W 신규 생성 후보 목록 작성(2026-10-08). DB 접근 없음(분류 캐시 파일만 읽음), LLM 은 소재 브레인스토밍 1종(haiku-4-5, 수 센트).
// 실행: npx tsx scripts/mock-exam-generation/rw-rebalance-cands.ts --need data/mock-exam-generation/rebalance-20261008/shortfall-4pp.json --subjects social_science,science_physical,... --out DIR [--exclude-seeds a.json,b.json]
//   -> DIR/cands.json (batch-pipeline.ts cross --cands-file), DIR/avoid.json (--avoid-file), DIR/alloc.json (칸x과목 배분)
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { SUBJECTS } from "./rw-topics-lib";
import { RW_SATURATED_TOPICS } from "../../lib/problem-generation/rw-topic-saturation";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const envPath = path.resolve(process.cwd(), ".env.local");
if (!process.env.ANTHROPIC_API_KEY && existsSync(envPath)) for (const l of readFileSync(envPath, "utf-8").split("\n")) { const m = l.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/); if (m) process.env.ANTHROPIC_API_KEY = m[1].replace(/^["']|["']$/g, ""); }

const DESC: Record<string, string> = {
  literature_fiction: "an excerpt of literary fiction (novel/short story scene): give a concrete premise — who, where, what quiet tension (varied eras, places, voices; avoid family secrets, reconciliation, apprenticeship, rival bakers, grief-and-memory, immigrant-family clichés)",
  humanities: "arts and humanities nonfiction: a specific artist, work, art movement, musical form, architectural feature, philosophical idea, language/linguistic phenomenon or critical debate (NOT Dutch painting, Renaissance workshops, still life)",
  social_science: "social science research: a specific psychology, sociology, anthropology, education, political-science or linguistics study/finding (named phenomenon, method, a concrete result)",
  history_civics: "history and civics: a specific historical episode, institution, law, treaty, movement or person with a concrete detail",
  economics_business: "economics and business: a specific market mechanism, firm, historical commercial practice, labor-market finding or trade pattern (NOT congestion pricing, induced demand, bus rapid transit, textile decline)",
  science_life: "life science: a specific organism, physiological mechanism, ecological relationship or medical finding (NOT cephalopods, bioluminescence, coral, carnivorous plants, anglerfish)",
  science_earth_space: "earth and space science: a specific geological, atmospheric, oceanographic, climatic or astronomical phenomenon or study (NOT exoplanet detection, Okavango delta, fast radio bursts, magnetars)",
  science_physical: "physical science: a specific chemistry, physics or materials-science phenomenon, experiment or discovery (superconductors, crystallization, acoustics, optics, thermodynamics, polymers, catalysis, fluid dynamics, etc.)",
  technology: "technology and engineering: a specific device, system, material application or engineering project with a concrete mechanism (NOT bus rapid transit, bridges, storm-surge barriers, boat lifts)",
};
const FACTOR: Record<string, number> = { easy: 1.4, medium: 1.7, hard: 2.1 };

type Cell = { cell: string; need: Record<string, number>; total: number };
function allocate(c: Cell): Record<string, number> {
  const ent = Object.entries(c.need).map(([s, v]) => ({ s, base: Math.floor(v + 1e-9), rem: v - Math.floor(v + 1e-9) }));
  let sum = ent.reduce((a, e) => a + e.base, 0);
  for (const e of [...ent].sort((a, b) => b.rem - a.rem)) { if (sum >= c.total) break; if (e.rem > 1e-9) { e.base++; sum++; } }
  for (const e of [...ent].sort((a, b) => b.rem - a.rem)) { if (sum >= c.total) break; e.base++; sum++; }
  return Object.fromEntries(ent.filter((e) => e.base > 0).map((e) => [e.s, e.base]));
}

const LIT_SETTINGS = ["1920s Lagos market town", "Edo-period Japanese fishing village", "present-day Seoul apartment complex", "1970s Appalachian mining town", "Andean highland village at harvest", "postwar Vienna boarding house", "Caribbean island ferry crossing", "Soviet-era Georgian mountain village", "present-day Nairobi matatu route", "1930s Great Plains farmstead", "1950s Parisian bookshop", "Mumbai rooftop during monsoon", "Icelandic fishing port in winter", "19th-century Mississippi riverboat", "Texas border town in summer", "Istanbul ferry commuters", "Scottish island primary school", "California Gold Rush camp", "Cairo rooftop pigeon keepers", "Norwegian coastal sauna", "Hanoi street-food alley at dawn", "Mexican mountain bus depot", "Prairie Canadian grain elevator town", "Lisbon tram line", "Sri Lankan tea estate", "Korean island haenyeo cove", "Kyoto pottery district", "Brooklyn tenement stoop, 1910s", "Patagonian sheep ranch", "Bavarian village brass band", "Louisiana bayou fish camp", "Ethiopian highland coffee ceremony", "Greek island summer ferry kiosk", "Chicago elevated train platform, 1960s", "Appalachian trail shelter", "Philippine island school boat", "Kerala backwater houseboat", "Montana ranch auction", "Berlin allotment garden", "Moroccan riverside tannery"];
const LIT_MOODS = ["wry and comic", "elegiac", "quietly tense", "tender", "ironic", "lyrical", "melancholic but hopeful", "restless", "wistful", "gently absurd"];
const LIT_SITUATIONS = ["a chance meeting between strangers", "an inheritance of a small object", "a misunderstanding over a gift", "a long journey made for a small errand", "a child noticing something adults ignore", "a rivalry that turns to respect", "a promise made years ago resurfaces", "a letter arrives late", "a local festival goes slightly wrong", "someone learning a craft or skill", "a storm interrupts a routine", "a stray animal changes a household", "a borrowed tool never returned", "two friends drifting apart", "an old teacher's last lesson", "an unexpected guest at a meal", "a decision about whether to leave home", "a game or contest between neighbors", "a rumor about a newcomer", "a repaired object revealing its history"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

async function brainstorm(client: Anthropic, subject: string, n: number, avoid: string[], used: string[]): Promise<{ seeds: string[]; usd: number }> {
  const seeds: string[] = []; let usd = 0;
  while (seeds.length < n) {
    const k = Math.min(30, n - seeds.length);
    const lit = subject === "literature_fiction";
    const sys = lit ? `You write one-sentence story premises for excerpts in a digital SAT Reading and Writing question bank. Output ONLY a JSON array of ${k} strings, in the SAME ORDER as the numbered constraints given. Each premise (20-40 words) names a protagonist with a distinctive, setting-appropriate name (NEVER use Marisol, Mara, Mira, Marguerite, Maren, Ines, Halvorsen, Okafor, Varga, Dana), the situation, and the quiet tension. Do NOT write workplace-wrongdoing, whistleblower, fraud, corruption, institutional-pressure or ethics-dilemma stories. Every premise must be clearly different in plot, not just in setting.` : `You propose passage topics for a digital SAT Reading and Writing question bank. Output ONLY a JSON array of ${k} strings. Each string is ONE specific, concrete, mutually distinct topic (a named phenomenon/person/event/study/work plus the angle, 8-20 words), not a broad theme. Cover a wide spread of sub-areas, regions and eras. Real, verifiable subject matter only (fiction: invented premises).`;
    const cons = lit ? Array.from({ length: k }, (_, i) => `${i + 1}. setting: ${pick(LIT_SETTINGS)}; mood: ${pick(LIT_MOODS)}; central situation: ${pick(LIT_SITUATIONS)}`).join("\n") : "";
    const user = lit ? `Constraints:\n${cons}\nAlready used premises (do not repeat or paraphrase): ${[...used, ...seeds].slice(-60).join(" | ")}` : `Subject: ${DESC[subject]}.\nDo NOT use or resemble these already-overused topics: ${avoid.slice(0, 220).join("; ")}.\nAlready chosen (avoid repeating or paraphrasing): ${[...used, ...seeds].slice(-120).join(" | ")}`;
    const r = await client.messages.create({ model: "claude-haiku-4-5", max_tokens: 3500, temperature: 1, system: sys, messages: [{ role: "user", content: user }] });
    usd += (r.usage.input_tokens * 1 + r.usage.output_tokens * 5) / 1e6;
    const t = r.content.map((b) => (b.type === "text" ? b.text : "")).join(""); const m = t.match(/\[[\s\S]*\]/); if (!m) continue;
    for (const x of JSON.parse(m[0]) as string[]) if (typeof x === "string" && x.length > 12 && !seeds.includes(x)) seeds.push(x);
  }
  return { seeds: seeds.slice(0, n), usd };
}

async function main() {
  const need = JSON.parse(readFileSync(arg("--need")!, "utf-8")) as { perCell: Cell[] };
  const subjects = (arg("--subjects") ?? SUBJECTS.join(",")).split(",");
  const out = arg("--out")!; mkdirSync(out, { recursive: true });
  const factor = Number(arg("--factor-scale") ?? 1);
  const classified = JSON.parse(readFileSync("data/mock-exam-generation/rw-topics-20261008/classified.json", "utf-8")) as Record<string, { subject: string; cluster: string }>;
  const bySubj = new Map<string, Map<string, number>>(); const allCl = new Map<string, number>();
  for (const v of Object.values(classified)) { const m = bySubj.get(v.subject) ?? bySubj.set(v.subject, new Map()).get(v.subject)!; m.set(v.cluster, (m.get(v.cluster) ?? 0) + 1); allCl.set(v.cluster, (allCl.get(v.cluster) ?? 0) + 1); }
  const topAvoid = [...allCl].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).map(([k]) => k.replace(/-/g, " "));
  const alloc: { skill: string; difficulty: "easy" | "medium" | "hard"; subject: string; need: number; cands: number }[] = [];
  for (const c of need.perCell) {
    const [skill, difficulty] = c.cell.split("|") as [string, "easy" | "medium" | "hard"];
    if (skill === "command_of_evidence_quant") continue; // 표·그래프 자료 문항 — 이 파이프라인(텍스트 전용)에 형식 규칙·그림이 없어 생성하지 않고 부족분으로 보고한다.
    for (const [subject, n] of Object.entries(allocate(c))) if (subjects.includes(subject)) alloc.push({ skill, difficulty, subject, need: n, cands: Math.ceil(n * FACTOR[difficulty] * factor) });
  }
  const prior = (arg("--exclude-seeds") ?? "").split(",").filter(Boolean).flatMap((f) => (JSON.parse(readFileSync(f, "utf-8")) as { seed: string }[]).map((x) => x.seed));
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const cands: { skill: string; difficulty: string; subject: string; seed: string }[] = []; let usd = 0;
  for (const subject of subjects) {
    const rows = alloc.filter((a) => a.subject === subject); const n = rows.reduce((a, r) => a + r.cands, 0); if (!n) continue;
    const exist = [...(bySubj.get(subject) ?? new Map()).keys()].map((k) => k.replace(/-/g, " "));
    const { seeds, usd: u } = await brainstorm(client, subject, n, [...RW_SATURATED_TOPICS, ...topAvoid.slice(0, 60), ...exist.slice(0, 120)], prior); usd += u;
    let i = 0; for (const r of rows) for (let k = 0; k < r.cands; k++) cands.push({ skill: r.skill, difficulty: r.difficulty, subject, seed: `${DESC[subject].split(":")[0]} — ${seeds[i++]}` });
    console.error(`${subject}: need ${rows.reduce((a, r) => a + r.need, 0)} -> cands ${n}`);
  }
  writeFileSync(path.join(out, "cands.json"), JSON.stringify(cands, null, 1));
  writeFileSync(path.join(out, "alloc.json"), JSON.stringify(alloc, null, 1));
  writeFileSync(path.join(out, "avoid.json"), JSON.stringify(topAvoid.slice(0, 60)));
  writeFileSync(path.join(out, "brainstorm-ledger.json"), JSON.stringify({ usd }));
  console.log(JSON.stringify({ cands: cands.length, need: alloc.reduce((a, r) => a + r.need, 0), brainstormUsd: +usd.toFixed(4) }));
}
main().catch((e) => { console.error(e); process.exit(1); });
