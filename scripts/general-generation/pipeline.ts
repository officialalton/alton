// 일반용 문항 검수 → 보수 → 집계 (2026-09-30). DB 접근 없음. 기존 mock-exam-generation 의 reviewOne·evaluateAll 을 그대로 재사용한다.
// 실행: npx tsx scripts/general-generation/pipeline.ts <review|repair|aggregate> --run <run-id> --stage <stage> [--concurrency 6]
//   review    : raw/*.json → review/<gid>.json (재실행 시 건너뜀). 같은 stage 안 + 기존 모의고사용 통과 문항과 본문 유사도 0.6 이상이면 AI 호출 없이 보관.
//   repair    : 보관 사유가 weak_distractors 하나뿐인 객관식만 오답 보수 1회 → review-repaired/.
//   aggregate : final/passed.json(임포트 입력)·archive-candidates.json·summary.md(skill×난이도 표).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { reviewOne, findDuplicates, type Raw, type ReviewResult } from "../mock-exam-generation/review";
import { loadRun, evaluateAll } from "../mock-exam-generation/aggregate-lib";
import { repairOne } from "./repair-one";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const cmd = process.argv[2];
const runId = arg("--run"); const stage = arg("--stage") ?? "stage1";
if (!runId) throw new Error("--run 필요");
const base = path.resolve("data/general-generation", runId, stage);
const concurrency = Number(arg("--concurrency") ?? 6);

/** 기존 모의고사용 통과 문항(본문 유사도 비교용). 메인 체크아웃 data/ 까지 훑는다. */
function mockRefs(): Raw[] {
  const out: Raw[] = [];
  for (const root of [path.resolve("data/mock-exam-generation"), path.join(process.env.HOME ?? "", "Developer/ALTON/data/mock-exam-generation")]) {
    if (!existsSync(root)) continue;
    for (const d of readdirSync(root)) {
      const f = path.join(root, d, "final/passed.json");
      if (existsSync(f)) for (const r of JSON.parse(readFileSync(f, "utf-8")) as Raw[]) out.push({ ...r, generatedAt: "0000" });
    }
  }
  // 같은 run 의 다른 stage 통과분도 비교 대상(stage 간 중복 방지).
  const gg = path.resolve("data/general-generation", runId!);
  if (existsSync(gg)) for (const st of readdirSync(gg)) { const f = path.join(gg, st, "final/passed.json"); if (st !== stage && existsSync(f)) for (const r of JSON.parse(readFileSync(f, "utf-8")) as Raw[]) out.push({ ...r, generatedAt: "0000" }); }
  return [...new Map(out.map((r) => [r.gid, r])).values()];
}
const pool = async <T>(items: T[], fn: (t: T) => Promise<void>) => { const q = [...items]; await Promise.all(Array.from({ length: concurrency }, async () => { while (q.length) await fn(q.shift()!); })); };

async function review() {
  const revDir = path.join(base, "review"); mkdirSync(revDir, { recursive: true });
  const all = readdirSync(path.join(base, "raw")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(base, "raw", f), "utf-8")) as Raw);
  const refs = mockRefs();
  const mine = new Set(all.map((r) => r.gid));
  const dups = findDuplicates([...refs, ...all]);
  const todo = all.filter((r) => !existsSync(path.join(revDir, `${r.gid}.json`)));
  process.stderr.write(`검수 대상 ${todo.length}/${all.length} (모의고사용 비교 ${refs.length}건)\n`);
  let n = 0;
  await pool(todo, async (r) => {
    try {
      const d = mine.has(r.gid) ? dups.get(r.gid) : undefined;
      const res: ReviewResult = d ? { gid: r.gid, verdict: "archive", reasons: [`near_duplicate_of:${d.of}@${d.score}`], notes: [], reviewedAt: new Date().toISOString() } : await reviewOne(r);
      writeFileSync(path.join(revDir, `${r.gid}.json`), JSON.stringify(res));
    } catch (e) { process.stderr.write(`검수 오류 ${r.gid}: ${e instanceof Error ? e.message : e}\n`); }
    if (++n % 10 === 0) process.stderr.write(`검수 ${n}/${todo.length}\n`);
  });
}

async function repair() {
  mkdirSync(path.join(base, "repair"), { recursive: true }); mkdirSync(path.join(base, "review-repaired"), { recursive: true });
  const evals = evaluateAll(loadRun(base));
  const todo = evals.filter((e) => e.verdict === "archive" && e.reasons.length === 1 && e.reasons[0] === "weak_distractors" && e.raw.format === "mc" && !existsSync(path.join(base, "repair", `${e.raw.gid}.json`)));
  process.stderr.write(`보수 대상 ${todo.length}\n`);
  await pool(todo, async (e) => {
    const r = e.raw;
    const flagged = (e.review?.blind?.easilyEliminated ?? []).filter((i) => i !== r.problem.correctIndex);
    const rep = flagged.length ? await repairOne(r, flagged) : null;
    writeFileSync(path.join(base, "repair", `${r.gid}.json`), JSON.stringify({ gid: r.gid, skill: r.skill, difficulty: r.difficulty, flagged, ok: Boolean(rep), before: { options: r.problem.options, explanation: r.problem.explanation }, after: rep ? { options: rep.options, explanation: rep.explanation, misconceptions: rep.note } : null }));
    if (rep) {
      try { writeFileSync(path.join(base, "review-repaired", `${r.gid}.json`), JSON.stringify(await reviewOne({ ...r, problem: { ...r.problem, options: rep.options, explanation: rep.explanation } }))); }
      catch (err) { process.stderr.write(`재검수 오류 ${r.gid}: ${err instanceof Error ? err.message : err}\n`); }
    }
  });
}

function aggregate() {
  const final = evaluateAll(loadRun(base));
  // 모의고사용과의 유사도 재확인(통과분만)
  const refs = mockRefs();
  const passedE = final.filter((f) => f.verdict === "pass");
  const dups = findDuplicates([...refs, ...passedE.map((f) => f.raw)]);
  const mine = new Set(passedE.map((f) => f.raw.gid));
  const ev = final.map((e) => { const d = mine.has(e.raw.gid) ? dups.get(e.raw.gid) : undefined; return e.verdict === "pass" && d ? { ...e, verdict: "archive" as const, reasons: [`near_duplicate_of:${d.of}@${d.score}`] } : e; });
  // 일반용은 easy/medium 만 — 최종 라벨이 hard 로 재라벨된 문항은 제외(보관 후보).
  const fin = ev.map((e) => (e.verdict === "pass" && e.finalDifficulty === "hard" ? { ...e, verdict: "archive" as const, reasons: ["relabeled_hard_excluded"] } : e));
  const passed = fin.filter((f) => f.verdict === "pass"), archived = fin.filter((f) => f.verdict === "archive");
  mkdirSync(path.join(base, "final"), { recursive: true });
  writeFileSync(path.join(base, "final/passed.json"), JSON.stringify(passed.map((f) => ({ ...f.raw, requestedDifficulty: f.raw.difficulty, difficulty: f.finalDifficulty, relabeled: f.relabeled, repaired: f.repaired, hardTier: null, problem: { ...f.raw.problem, difficulty: f.finalDifficulty, ...(f.repaired ? (() => { const rp = JSON.parse(readFileSync(path.join(base, "repair", `${f.raw.gid}.json`), "utf-8")) as { after: { options: string[]; explanation: string } }; return { options: rp.after.options, explanation: rp.after.explanation }; })() : {}) }, review: f.review })), null, 1));
  writeFileSync(path.join(base, "final/archive-candidates.json"), JSON.stringify(archived.map((f) => ({ ...f.raw, archiveReasons: f.reasons })), null, 1));
  const key = (s: string, d: string) => `${s}|${d}`;
  const c = (arr: typeof fin) => { const m = new Map<string, number>(); for (const f of arr) m.set(key(f.raw.skill, f.finalDifficulty), (m.get(key(f.raw.skill, f.finalDifficulty)) ?? 0) + 1); return m; };
  const g = c(fin), p = c(passed);
  const skills = [...new Set(fin.map((f) => f.raw.skill))].sort();
  const md = ["| skill | easy 통과 | medium 통과 | 합계 통과 | 생성 |", "|---|---|---|---|---|"];
  for (const s of skills) { const e = p.get(key(s, "easy")) ?? 0, m = p.get(key(s, "medium")) ?? 0; md.push(`| ${s} | ${e} | ${m} | ${e + m} | ${(g.get(key(s, "easy")) ?? 0) + (g.get(key(s, "medium")) ?? 0) + (g.get(key(s, "hard")) ?? 0)} |`); }
  const rc = new Map<string, number>(); for (const f of archived) for (const r of f.reasons) rc.set(r.replace(/[:@].*/, ""), (rc.get(r.replace(/[:@].*/, "")) ?? 0) + 1);
  writeFileSync(path.join(base, "final/summary.md"), md.join("\n") + `\n\n생성 ${fin.length} / 통과 ${passed.length} / 보관 ${archived.length}\n보관 사유: ${JSON.stringify(Object.fromEntries(rc))}\n`);
  console.log(md.join("\n")); console.log({ generated: fin.length, passed: passed.length, archived: archived.length, reasons: Object.fromEntries(rc) });
}

(async () => { if (cmd === "review") await review(); else if (cmd === "repair") await repair(); else if (cmd === "aggregate") aggregate(); else throw new Error("review|repair|aggregate"); })().catch((e) => { console.error(e); process.exit(1); });
