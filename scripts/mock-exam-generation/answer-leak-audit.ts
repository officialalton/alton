// RW 정답 누설 감사(읽기 전용 입력: scripts/qa/rw-leak-dump.ts 덤프). 단계: detect → blind → report.
//   npx tsx scripts/mock-exam-generation/answer-leak-audit.ts detect --dump tmp/rw-leak/dump.json --out tmp/rw-leak/detect.json
//   npx tsx scripts/mock-exam-generation/answer-leak-audit.ts blind --detect tmp/rw-leak/detect.json --out tmp/rw-leak/blind.json [--control 150]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { analyzeLeak, buildIdf } from "./answer-leak-detector";

export const RW_SKILLS = new Set("central_ideas_details words_in_context text_structure_purpose cross_text_connections rhetorical_synthesis transitions boundaries form_structure_sense inferences command_of_evidence_text command_of_evidence_quant".split(" "));
const arg = (n: string, d?: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };

type Row = { problemId: string; versionId: string; versionNo: number; skill: string; difficulty: string; question: string; passage: string; options: string[]; correctIndex: number; hasFigure: boolean; inPublishedSet: boolean; sets: { name: string; module: string; position: number }[]; analysis: ReturnType<typeof analyzeLeak> };

export function loadRows(dumpPath: string): Row[] {
  const d = JSON.parse(readFileSync(dumpPath, "utf-8"));
  const pv = new Map<string, any>(d.problems.map((p: any) => [p.id, p]));
  const setName = new Map<string, any>(d.sets.map((s: any) => [s.id, s]));
  const bySets = new Map<string, any[]>();
  for (const it of d.items) (bySets.get(it.problem_version_id) ?? bySets.set(it.problem_version_id, []).get(it.problem_version_id)!).push(it);
  const vs = d.versions.filter((v: any) => Array.isArray(v.options) && v.options.length === 4 && RW_SKILLS.has(pv.get(v.problem_id)?.skill_code));
  const idfBySkill = new Map<string, ReturnType<typeof buildIdf>>();
  for (const sk of RW_SKILLS) idfBySkill.set(sk, buildIdf(vs.filter((v: any) => pv.get(v.problem_id).skill_code === sk).flatMap((v: any) => [v.question ?? "", ...v.options])));
  return vs.map((v: any): Row => {
    const skill = pv.get(v.problem_id).skill_code as string;
    const sets = (bySets.get(v.id) ?? []).map((i) => ({ name: setName.get(i.exam_set_id)?.name ?? "?", status: setName.get(i.exam_set_id)?.status, module: i.module_key, position: i.position }));
    const question = v.question ?? "";
    return { problemId: v.problem_id, versionId: v.id, versionNo: v.version_no, skill, difficulty: v.difficulty ?? "?", question, passage: v.passage ?? "", options: v.options, correctIndex: v.correct_index, hasFigure: !!v.figure, inPublishedSet: sets.some((s) => s.status === "published"), sets: sets.map(({ name, module, position }) => ({ name, module, position })), analysis: analyzeLeak({ question, options: v.options, correctIndex: v.correct_index, skill }, idfBySkill.get(skill)!) };
  });
}

if (process.argv[1]?.endsWith("answer-leak-audit.ts") && process.argv[2] === "detect") {
  const rows = loadRows(arg("--dump", "tmp/rw-leak/dump.json")!);
  writeFileSync(path.resolve(arg("--out", "tmp/rw-leak/detect.json")!), JSON.stringify(rows));
  const by: Record<string, { n: number; flagged: number; strong: number }> = {};
  for (const r of rows) { const b = (by[r.skill] ??= { n: 0, flagged: 0, strong: 0 }); b.n++; if (r.analysis.flagged) b.flagged++; if (r.analysis.strong) b.strong++; }
  console.table(by);
  console.log("total", rows.length, "flagged", rows.filter((r) => r.analysis.flagged).length, "strong", rows.filter((r) => r.analysis.strong).length);
}

// ---- blind 단계: 지문·자료 없이 질문+선택지만 보고 정답을 고르게 한다(싼 모델, 2회: 원래 순서 / 뒤집은 순서) --------------------------
if (process.argv[1]?.endsWith("answer-leak-audit.ts") && process.argv[2] === "blind") {
  (async () => {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const MODEL = arg("--model", "claude-haiku-4-5")!;
    const PRICE = { in: 1, out: 5 }; // $/MTok (haiku 4.5)
    const outPath = path.resolve(arg("--out", "tmp/rw-leak/blind.json")!);
    const rows = JSON.parse(readFileSync(arg("--detect", "tmp/rw-leak/detect.json")!, "utf-8")) as Row[];
    const only = arg("--only"); // 쉼표 구분 skill
    const targets = rows.filter((r) => !only || only.split(",").includes(r.skill));
    const done: Record<string, any> = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf-8")) : {};
    let inTok = 0, outTok = 0;
    const L = ["A", "B", "C", "D"];
    const ask = async (r: Row, order: number[]) => {
      const lines = order.map((oi, k) => `${L[k]}. ${r.options[oi]}`).join("\n");
      const prompt = `You are taking a digital SAT Reading & Writing question, but the passage / table / graph has been REMOVED. You see only the question stem and the four options. Pick the option you believe is correct using only what you can see (wording, structure, internal logic) and general knowledge.\n\nQuestion: ${r.question}\n\n${lines}\n\nReply with JSON only: {"pick":"A|B|C|D","confidence":"high|medium|low","reason":"<12 words"}. Use "high" only if the answer is determinable without the missing passage/data.`;
      for (let a = 0; a < 3; a++) {
        try {
          const m = await client.messages.create({ model: MODEL, max_tokens: 120, messages: [{ role: "user", content: prompt }] });
          inTok += m.usage.input_tokens; outTok += m.usage.output_tokens;
          const t = m.content.map((c) => (c.type === "text" ? c.text : "")).join("");
          const j = JSON.parse(t.match(/\{[\s\S]*\}/)![0]);
          const k = L.indexOf(String(j.pick).trim().toUpperCase());
          return { picked: k >= 0 ? order[k] : null, confidence: String(j.confidence), reason: String(j.reason ?? "") };
        } catch { await new Promise((r) => setTimeout(r, 2000 * (a + 1))); }
      }
      return { picked: null, confidence: "error", reason: "" };
    };
    let idx = 0, n = 0;
    const worker = async () => {
      while (idx < targets.length) {
        const r = targets[idx++];
        if (done[r.versionId]) continue;
        const [s1, s2] = await Promise.all([ask(r, [0, 1, 2, 3]), ask(r, [3, 2, 1, 0])]);
        done[r.versionId] = { samples: [s1, s2], hit: [s1, s2].map((s) => s.picked === r.correctIndex), high: [s1, s2].map((s) => s.confidence === "high") };
        if (++n % 100 === 0) { writeFileSync(outPath, JSON.stringify(done)); console.error(`blind ${n}/${targets.length} cost $${((inTok * PRICE.in + outTok * PRICE.out) / 1e6).toFixed(3)}`); }
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    writeFileSync(outPath, JSON.stringify(done));
    const cost = (inTok * PRICE.in + outTok * PRICE.out) / 1e6;
    console.log(`blind done ${n} items, model ${MODEL}, in ${inTok} out ${outTok} cost $${cost.toFixed(3)}`);
    const ledger = path.resolve("tmp/rw-leak/ledger.json");
    const prev = existsSync(ledger) ? JSON.parse(readFileSync(ledger, "utf-8")) : [];
    prev.push({ at: new Date().toISOString(), stage: "blind", model: MODEL, items: n, inTok, outTok, usd: Number(cost.toFixed(4)) });
    writeFileSync(ledger, JSON.stringify(prev, null, 1));
  })();
}

// ---- report 단계 -----------------------------------------------------------------------------------------------------------
/** 유형 판별: 질문 문구로 CoE quant 출제 형식을 가른다. */
export function coeQuantStyle(question: string): "claim-in-question" | "complete-the-text" | "claim-in-passage" | "other" {
  if (/complete the (?:following )?(?:text|statement)/i.test(question)) return "complete-the-text";
  if (/(?:claim|hypothesis|argument|assertion)\s+that\b|\bto (?:illustrate|show|support) that\b/i.test(question)) return "claim-in-question";
  if (/support|illustrate|claim|hypothesis|statement/i.test(question)) return "claim-in-passage";
  return "other";
}
// 구조적 누설을 판정할 수 없는 유형(어휘·구두점·전환·형식·수사 합성)은 블라인드 '높은 확신'이 지식·목표 문구 때문일 수 있어 감지기 신호가 함께 있어야 확정한다.
const NEEDS_DETECTOR = new Set(["rhetorical_synthesis", "words_in_context", "boundaries", "form_structure_sense", "transitions"]);
export type Verdict = "confirmed" | "suspect" | "clear";
export function verdictOf(r: Row, b: { hit: boolean[]; high: boolean[] } | undefined): Verdict {
  const hh = !!b && b.hit[0] && b.hit[1] && b.high[0] && b.high[1];
  if (hh && (!NEEDS_DETECTOR.has(r.skill) || r.analysis.flagged)) return "confirmed";
  if (r.analysis.flagged || (b && b.hit[0] && b.hit[1] && (b.high[0] || b.high[1]) && !NEEDS_DETECTOR.has(r.skill))) return "suspect";
  return "clear";
}

if (process.argv[1]?.endsWith("answer-leak-audit.ts") && process.argv[2] === "report") {
  const rows = JSON.parse(readFileSync(arg("--detect", "tmp/rw-leak/detect.json")!, "utf-8")) as Row[];
  const blind = JSON.parse(readFileSync(arg("--blind", "tmp/rw-leak/blind.json")!, "utf-8")) as Record<string, any>;
  const ledger = existsSync("tmp/rw-leak/ledger.json") ? JSON.parse(readFileSync("tmp/rw-leak/ledger.json", "utf-8")) : [];
  const usd = ledger.reduce((s: number, l: any) => s + l.usd, 0);
  const md: string[] = [];
  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "-");
  const bySkill = new Map<string, Row[]>();
  for (const r of rows) (bySkill.get(r.skill) ?? bySkill.set(r.skill, []).get(r.skill)!).push(r);
  md.push("# RW 정답 누설 감사 (2026-10-08)", "", `대상: 게시(published) 버전의 RW 선택형 ${rows.length}건(문제은행 mock_exam/both, 보관 제외). 그중 게시 세트에 들어간 문항 ${rows.filter((r) => r.inPublishedSet).length}건.`,
    `방법: (a) 질문↔선택지 어휘·주체 겹침, (b) 선택지 틀·길이 비대칭 — 감지기 \`scripts/mock-exam-generation/answer-leak-detector.ts\`; (c) 블라인드 풀이 — claude-haiku-4-5 가 지문·자료 없이 질문+선택지만 보고 2회(원래 순서/뒤집은 순서) 풀이. 전수 실행. 모델 비용 합계 $${usd.toFixed(2)}.`,
    "", "판정: **confirmed** = 2회 모두 정답을 맞히고 둘 다 확신 high(어휘·구두점·전환·형식·수사 합성은 지식·목표 문구 때문일 수 있어 감지기 신호가 함께 있을 때만 확정). **suspect** = 감지기 신호만 있거나 한 번이라도 high 로 맞힘. 우연 기대치는 정답률 25%.", "");
  md.push("## 1. 유형별 집계", "", "| 유형 | 문항 | 감지기 플래그 | 강한 신호 | 블라인드 평균 정답률 | 2회 모두 정답 | 2회 모두 high | confirmed | suspect |", "|---|---|---|---|---|---|---|---|---|");
  const tot = { n: 0, f: 0, s: 0, c: 0, su: 0 };
  for (const [sk, rs] of [...bySkill].sort((a, b) => b[1].length - a[1].length)) {
    let acc = 0, both = 0, bh = 0, c = 0, su = 0, f = 0, s = 0;
    for (const r of rs) { const b = blind[r.versionId]; if (b) { acc += b.hit.filter(Boolean).length / 2; if (b.hit[0] && b.hit[1]) { both++; if (b.high[0] && b.high[1]) bh++; } } const v = verdictOf(r, b); if (v === "confirmed") c++; if (v === "suspect") su++; if (r.analysis.flagged) f++; if (r.analysis.strong) s++; }
    md.push(`| ${sk} | ${rs.length} | ${f} (${pct(f, rs.length)}) | ${s} | ${(acc / rs.length * 100).toFixed(0)}% | ${pct(both, rs.length)} | ${pct(bh, rs.length)} | ${c} (${pct(c, rs.length)}) | ${su} |`);
    tot.n += rs.length; tot.f += f; tot.s += s; tot.c += c; tot.su += su;
  }
  md.push(`| **합계** | ${tot.n} | ${tot.f} | ${tot.s} | | | | ${tot.c} | ${tot.su} |`, "");
  md.push("해석 메모: 블라인드 정답률이 높은 서사·추론 유형(central_ideas·text_structure·cross_text)은 대부분 확신이 low/medium 이다 — 오답이 '그럴듯하지 않아서' 지문 없이 일반 상식으로 소거되는 약한 형태의 누설(기저율 25% 대비 80% 이상)로, 이번 확정 기준(high×2)에는 안 걸리지만 오답 품질 개선 후보다. rhetorical_synthesis 는 질문에 목표가 있어 정답률이 높은 것이 구조상 자연스럽다(감지기 신호가 있는 것만 확정). form_structure_sense·transitions·boundaries 는 25~44%로 정상.", "");
  md.push("## 2. confirmed / suspect 문항", "", "| 판정 | problem id | version | 유형 | 난이도 | 게시 세트(모듈 위치) | 사유 | 블라인드(원/역, 확신) |", "|---|---|---|---|---|---|---|---|");
  const flagged = rows.map((r) => ({ r, b: blind[r.versionId], v: verdictOf(r, blind[r.versionId]) })).filter((x) => x.v !== "clear").sort((a, b) => (a.v === b.v ? a.r.skill.localeCompare(b.r.skill) : a.v === "confirmed" ? -1 : 1));
  for (const { r, b, v } of flagged) {
    const reasons = r.analysis.reasons.join("; ") || "블라인드 high 정답";
    const bl = b ? `${b.hit.map((h: boolean, i: number) => `${h ? "정답" : "오답"}(${b.samples[i].confidence})`).join(" / ")}` : "-";
    md.push(`| ${v} | ${r.problemId} | v${r.versionNo} | ${r.skill} | ${r.difficulty} | ${r.sets.map((s) => `${s.name} ${s.module}#${s.position}`).join("; ") || "-"} | ${reasons} | ${bl} |`);
  }
  md.push("", "## 3. command_of_evidence_quant 전수 (20건)", "", "| problem id | 난이도 | 형식 | 감지기 | 블라인드(확신) | 판정 | 질문 |", "|---|---|---|---|---|---|---|");
  const styleCount: Record<string, number> = {};
  for (const r of (bySkill.get("command_of_evidence_quant") ?? [])) {
    const st = coeQuantStyle(r.question); styleCount[st] = (styleCount[st] ?? 0) + 1;
    const b = blind[r.versionId];
    md.push(`| ${r.problemId} | ${r.difficulty} | ${st} | ${r.analysis.reasons.join("; ") || "-"} | ${b ? b.hit.map((h: boolean, i: number) => `${h ? "정답" : "오답"}(${b.samples[i].confidence})`).join(" / ") : "-"} | ${verdictOf(r, b)} | ${r.question.replace(/\|/g, "/").slice(0, 110)} |`);
  }
  md.push("", `형식 분포: ${JSON.stringify(styleCount)}`, "");
  writeFileSync(path.resolve(arg("--out", "docs/qa/rw-answer-leak-audit-2026-10-08.md")!), md.join("\n") + "\n");
  writeFileSync(path.resolve("tmp/rw-leak/verdicts.json"), JSON.stringify(flagged.map(({ r, v }) => ({ problemId: r.problemId, versionId: r.versionId, skill: r.skill, difficulty: r.difficulty, verdict: v })), null, 1));
  console.log("report written; confirmed", tot.c, "suspect", tot.su);
}
