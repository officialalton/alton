// 모의고사용 생성 문항 AI 검수 패스 (2026-09-29). DB 접근 없음, 문항을 고치지 않는다 — 통과 / 보관 후보만 가른다.
// 실행: npx tsx scripts/mock-exam-generation/review.ts --run <run-id> [--concurrency 6] [--force]
//   입력 data/mock-exam-generation/<run>/raw/*.json  →  출력 <run>/review/<gid>.json (재실행 시 이미 검수한 gid 는 건너뜀)
//   1단계(블라인드 풀이): 정답·해설을 보지 않고 독립적으로 풀어 정답 일치·정답 유일성·추정 난이도·오답 제거 용이성을 본다.
//   2단계(감사): 정답·해설을 보여 주고 해설 정합성·형식·사실 오류·기존 시험 문항 재현(저작권) 여부를 본다.
//   3단계(결정론): 원시 LaTeX, 해설 $…$, 금칙어, 생성분 간 유사도.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const MODEL = "claude-sonnet-5";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type Raw = {
  gid: string; generatedAt?: string; runId: string; skill: string; domain: string; examSystem: string; difficulty: "easy" | "medium" | "hard"; format: "mc" | "spr";
  problem: { passage?: string | null; stimulus?: string | null; question?: string | null; options?: string[] | null; correctIndex?: number | null; answers?: string[] | null; explanation: string; figure?: unknown; statements?: string[] | null };
};
export type ReviewResult = {
  gid: string; verdict: "pass" | "archive"; reasons: string[]; notes: string[];
  blind?: { pickedIndex: number | null; pickedAnswer: string | null; agrees: boolean; otherDefensible: boolean; confidence: string; estimatedDifficulty: string; easilyEliminated: number[] };
  audit?: { explanationConsistent: boolean; formatOk: boolean; factualError: boolean; copyright: string; copyrightNote: string; issues: string[] };
  reviewedAt: string;
};

const ask = async (name: string, description: string, schema: Record<string, unknown>, prompt: string): Promise<Record<string, unknown>> => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const msg = await client.messages.create({
        model: MODEL, max_tokens: 2000,
        tools: [{ name, description, input_schema: { type: "object", properties: schema, required: Object.keys(schema) } as never }],
        tool_choice: { type: "tool", name },
        messages: [{ role: "user", content: prompt }],
      });
      const tu = msg.content.find((c) => c.type === "tool_use");
      if (tu && tu.type === "tool_use") return tu.input as Record<string, unknown>;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      if (attempt === 3) throw e;
    }
  }
  throw new Error("검수 응답 없음");
};

const figureText = async (figure: unknown): Promise<string> => {
  if (!figure) return "";
  try {
    const { figureAlt } = await import("../../lib/problem-figures/alt");
    return `\n[자료(표준 렌더러 대체 설명)]\n${figureAlt(figure as never) ?? JSON.stringify(figure)}`;
  } catch { return `\n[자료 JSON]\n${JSON.stringify(figure)}`; }
};

const normSpr = (s: string) => { const t = s.trim().replace(/,/g, "").replace(/\s+/g, ""); const f = t.match(/^(-?\d+)\/(\d+)$/); const n = f ? Number(f[1]) / Number(f[2]) : Number(t); return Number.isFinite(n) ? String(Math.round(n * 10000) / 10000) : t; };

// ---- 결정론 검사 -------------------------------------------------------
const BANNED = /\b(evidence_span|answer_rationale|distractor_error_types|evidenceTarget|evidenceSpan|answerRationale)\b/;
export function deterministicIssues(r: Raw): string[] {
  const p = r.problem;
  const issues: string[] = [];
  const body = `${p.stimulus ?? p.passage ?? ""}\n${p.question ?? ""}\n${(p.options ?? []).join("\n")}`;
  // 지문·선택지의 $…$ 는 KaTeX 정식 표기. 그 밖의 원시 LaTeX 명령·\( \) 는 결함.
  const stripped = body.replace(/\$[^$]+\$/g, "");
  if (/\\(frac|sqrt|cdot|times|leq?|geq?|pi|theta|left|right|begin|end|text|over)\b|\\\(|\\\)|\\\[|\\\]/.test(stripped)) issues.push("raw_latex_in_body");
  if ((body.match(/\$/g) ?? []).length % 2 === 1) issues.push("unbalanced_dollar_in_body");
  // 해설에는 $…$ 를 쓰지 않는다(2026-09-29 오너 분류 기준과 동일 — 해설 원시 LaTeX 보관).
  if (/\$|\\(frac|sqrt|cdot|times|leq?|geq?|pi|theta)\b/.test(p.explanation)) issues.push("raw_latex_in_explanation");
  if (BANNED.test(body) || BANNED.test(p.explanation)) issues.push("internal_field_name_exposed");
  if (!(p.explanation ?? "").trim()) issues.push("empty_explanation");
  return issues;
}

// ---- 생성분 간 유사도 ----------------------------------------------------
const tokens = (r: Raw, maskNumbers: boolean) => {
  const p = r.problem;
  let t = `${p.stimulus ?? p.passage ?? ""} ${p.question ?? ""} ${(p.options ?? []).join(" ")}`.toLowerCase();
  if (maskNumbers) t = t.replace(/[0-9]+([.,][0-9]+)*/g, "#");
  return t.replace(/[^a-z#\s]+/g, " ").split(/\s+/).filter(Boolean);
};
const shingles = (w: string[], n = 3) => { const s = new Set<string>(); for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(" ")); return s; };
const jaccard = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let x = 0; for (const v of a) if (b.has(v)) x++; return x / (a.size + b.size - x); };
/** 같은 세부 기술 안에서만 비교(문항 수가 많아 전수 비교는 불필요). 반환: gid → 더 먼저 만들어진 유사 문항 gid. */
export function findDuplicates(all: Raw[], threshold = 0.6): Map<string, { of: string; score: number }> {
  const out = new Map<string, { of: string; score: number }>();
  const bySkill = new Map<string, Raw[]>();
  for (const r of all) (bySkill.get(r.skill) ?? bySkill.set(r.skill, []).get(r.skill)!).push(r);
  for (const group of bySkill.values()) {
    const sorted = [...group].sort((a, b) => (a.generatedAt ?? "").localeCompare(b.generatedAt ?? "") || a.gid.localeCompare(b.gid));
    const sh = sorted.map((r) => shingles(tokens(r, true)));
    for (let i = 0; i < sorted.length; i++) for (let j = 0; j < i; j++) {
      if (out.has(sorted[j].gid)) continue; // 이미 중복으로 빠진 문항과는 비교하지 않는다
      const s = jaccard(sh[i], sh[j]);
      if (s >= threshold) { out.set(sorted[i].gid, { of: sorted[j].gid, score: Math.round(s * 100) / 100 }); break; }
    }
  }
  return out;
}

// ---- AI 검수 -------------------------------------------------------------
export async function reviewOne(r: Raw): Promise<ReviewResult> {
  const p = r.problem;
  const stim = p.stimulus ?? p.passage ?? "";
  const isMc = r.format === "mc";
  const fig = await figureText(p.figure);
  const optsBlock = isMc ? `\n[선택지]\n${(p.options ?? []).map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")}` : "";
  const stmts = p.statements?.length ? `\n[진술]\n${p.statements.map((s, i) => `${["I", "II", "III"][i]}. ${s}`).join("\n")}` : "";

  // 1단계: 블라인드 풀이 — 정답·해설 없음.
  const blindRaw = await ask("blind_solve", "정답 표시 없이 문제를 풀고 품질을 평가한다.", {
    picked_index: { type: ["number", "null"], description: "객관식이면 0-based 정답 자리, SPR 이면 null" },
    picked_answer: { type: ["string", "null"], description: "SPR 이면 계산한 답, 객관식이면 null" },
    other_defensible: { type: "boolean", description: "고른 답 외에 다른 선택지(또는 다른 값)도 문제 조건상 정답으로 방어 가능하면 true" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    estimated_difficulty: { type: "string", enum: ["easy", "medium", "hard"], description: "디지털 SAT 기준 실제 체감 난이도(지문 길이·어휘가 아니라 추론 단계·함정·계산량 기준)" },
    easily_eliminated: { type: "array", items: { type: "number" }, description: "정답이 아닌 선택지 중, 지문을 대충만 읽어도 근거 없이 바로 지울 수 있는 것(정반대·무관·과장어만)의 0-based 자리. 꼼꼼히 읽어야 틀림을 아는 오답은 넣지 않는다." },
    note: { type: "string", description: "풀이 요약 한두 문장(한국어)" },
  }, `당신은 디지털 SAT 전문 채점 위원입니다. 정답 표시는 없습니다. 이 문제를 처음 보는 사람으로서 직접 풀고 평가하세요.
유형: ${r.skill} · 형식: ${r.format}

[지문/자료]
${stim || "(지문 없음)"}${fig}${stmts}

[질문]
${p.question ?? ""}${optsBlock}

SPR 이면 picked_answer 에 최종 값만 적으세요. 문제 조건(질문·지문·자료)이 정답을 하나로 확정하지 못하면 other_defensible=true 로 표시하세요.`);

  const pickedIndex = typeof blindRaw.picked_index === "number" ? blindRaw.picked_index : null;
  const pickedAnswer = typeof blindRaw.picked_answer === "string" ? blindRaw.picked_answer : null;
  const agrees = isMc ? pickedIndex !== null && pickedIndex === p.correctIndex : pickedAnswer !== null && (p.answers ?? []).some((a) => normSpr(a) === normSpr(pickedAnswer));
  const blind = {
    pickedIndex, pickedAnswer, agrees, otherDefensible: Boolean(blindRaw.other_defensible), confidence: String(blindRaw.confidence),
    estimatedDifficulty: String(blindRaw.estimated_difficulty), easilyEliminated: Array.isArray(blindRaw.easily_eliminated) ? (blindRaw.easily_eliminated as number[]) : [],
  };

  // 2단계: 감사 — 정답·해설 공개.
  const keyText = isMc ? `${String.fromCharCode(65 + (p.correctIndex ?? 0))}) ${(p.options ?? [])[p.correctIndex ?? 0] ?? ""}` : (p.answers ?? []).join(" / ");
  const auditRaw = await ask("audit_problem", "정답·해설을 포함해 문항의 정합성·형식·원저작물 재현 여부를 감사한다.", {
    explanation_consistent: { type: "boolean", description: "해설이 지정 정답을 논리적·수치적으로 정확히 뒷받침하고, 해설 안에 모순·오계산·다른 선택지를 정답으로 주장하는 부분이 없으면 true" },
    format_ok: { type: "boolean", description: "지문·질문·선택지가 디지털 SAT 형식에 맞고(빈칸 표기, Text 1/2, 메모 등), 오탈자·깨진 수식·원시 LaTeX 명령 노출·한글 혼입(해설 제외)이 없으면 true" },
    factual_error: { type: "boolean", description: "지문이 현실 세계의 사실을 틀리게 서술하거나(실존 인물·연구·수치 날조 포함) 수학적으로 불가능한 설정이면 true. 명백히 허구로 제시된 가상 사례는 false" },
    copyright: { type: "string", enum: ["original", "suspect"], description: "College Board(SAT·PSAT·Bluebook)·Khan Academy·기타 출판 교재의 실제 문항 지문·질문·선택지를 재현하거나 거의 그대로 바꿔 쓴 것으로 보이면 suspect. 스타일만 비슷하면 original" },
    copyright_note: { type: "string", description: "suspect 이면 어떤 출처와 닮았는지, original 이면 빈 문자열" },
    issues: { type: "array", items: { type: "string" }, description: "발견한 구체적 결함(한국어). 없으면 빈 배열" },
  }, `당신은 디지털 SAT 문항 감사관입니다. 아래 문항의 정합성을 점검하세요. 문항을 고치지 말고 판단만 하세요.
유형: ${r.skill} · 난이도 라벨: ${r.difficulty} · 형식: ${r.format}

[지문/자료]
${stim || "(지문 없음)"}${fig}${stmts}

[질문]
${p.question ?? ""}${optsBlock}

[지정 정답]
${keyText}

[해설]
${p.explanation}`);
  const audit = {
    explanationConsistent: Boolean(auditRaw.explanation_consistent), formatOk: Boolean(auditRaw.format_ok), factualError: Boolean(auditRaw.factual_error),
    copyright: String(auditRaw.copyright), copyrightNote: String(auditRaw.copyright_note ?? ""), issues: Array.isArray(auditRaw.issues) ? (auditRaw.issues as string[]) : [],
  };

  const reasons: string[] = [];
  const notes: string[] = [];
  if (!blind.agrees) reasons.push("answer_mismatch");
  if (blind.otherDefensible) reasons.push("ambiguous_answer");
  if (!audit.explanationConsistent) reasons.push("explanation_inconsistent");
  if (!audit.formatOk) reasons.push("format_defect");
  if (audit.factualError) reasons.push("factual_error");
  if (audit.copyright === "suspect") reasons.push("copyright_suspect");
  // 오답 제거 용이성은 여기서 판정하지 않는다 — blind.easilyEliminated 를 저장해 두고 aggregate.ts 가 임계값으로 판정한다
  // (임계값을 바꿔도 AI 를 다시 부르지 않게).
  const order = { easy: 0, medium: 1, hard: 2 } as const;
  const gap = Math.abs(order[r.difficulty] - order[blind.estimatedDifficulty as "easy"]);
  if (gap >= 2) reasons.push("difficulty_label_mismatch");
  else if (gap === 1) notes.push(`difficulty_gap:${r.difficulty}->${blind.estimatedDifficulty}`);
  reasons.push(...deterministicIssues(r));
  return { gid: r.gid, verdict: reasons.length ? "archive" : "pass", reasons, notes, blind, audit, reviewedAt: new Date().toISOString() };
}

async function main() {
  const runId = arg("--run");
  if (!runId) throw new Error("--run 필요");
  const concurrency = Number(arg("--concurrency") ?? 6);
  const force = process.argv.includes("--force");
  const base = path.resolve("data/mock-exam-generation", runId);
  const rawDir = path.join(base, "raw");
  const revDir = path.join(base, "review");
  mkdirSync(revDir, { recursive: true });
  const all = readdirSync(rawDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(rawDir, f), "utf-8")) as Raw);
  const dups = findDuplicates(all);
  const todo = all.filter((r) => force || !existsSync(path.join(revDir, `${r.gid}.json`)));
  process.stderr.write(`검수 대상 ${todo.length}/${all.length}\n`);
  let done = 0;
  const queue = [...todo];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const r = queue.shift()!;
      try {
        // 이미 중복으로 판정된 문항은 AI 호출 없이 바로 보관 후보.
        const d = dups.get(r.gid);
        const res: ReviewResult = d ? { gid: r.gid, verdict: "archive", reasons: [`near_duplicate_of:${d.of}@${d.score}`], notes: [], reviewedAt: new Date().toISOString() } : await reviewOne(r);
        writeFileSync(path.join(revDir, `${r.gid}.json`), JSON.stringify(res));
      } catch (e) {
        process.stderr.write(`검수 오류 ${r.gid}: ${e instanceof Error ? e.message : e}\n`);
      }
      done += 1;
      if (done % 10 === 0) process.stderr.write(`검수 ${done}/${todo.length}\n`);
    }
  }));
  process.stderr.write("검수 완료\n");
}
if (process.argv[1]?.endsWith("review.ts")) main().catch((e) => { console.error(e); process.exit(1); });
