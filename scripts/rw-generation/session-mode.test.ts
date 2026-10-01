import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepare, ingest, reviewPrepare, reviewIngest, rewritePrepare, writeAdoptionReport, status, recordCost, summarizeCost, chunkEven, dirs, loadIngested, type GenTask, type ReviewTask } from "./session-mode";
import type { PlanBatch } from "./batch-plan";
import { APP_SKILL_OVERRIDE } from "./batch-plan";
import { mulberry32 } from "./seed-compose";

const roots: string[] = [];
const tmp = () => { const r = mkdtempSync(path.join(tmpdir(), "rwsess-")); roots.push(r); return r; };
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });

// ---- 모의 에이전트: 작업 파일을 읽어 결정론적 결과 파일을 쓴다 ----
const C = "bdfgklmnprstvz", V = "aeiou";
const BANK = Array.from({ length: 900 }, (_, i) => `${C[i % 14]}${V[(i >> 2) % 5]}${C[(i * 7 + 3) % 14]}${V[(i >> 5) % 5]}${C[(i * 11 + 5) % 14]}${i % 3 ? V[(i >> 3) % 5] : ""}`);
const seedNum = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
const words = (rnd: () => number, n: number) => Array.from({ length: n }, () => BANK[Math.floor(rnd() * BANK.length)]);
const sentence = (rnd: () => number, n: number) => { const w = words(rnd, n); return w[0][0].toUpperCase() + w[0].slice(1) + " " + w.slice(1).join(" ") + "."; };
const passageOf = (id: string, n = 120) => { const rnd = mulberry32(seedNum(id)); const out: string[] = []; let left = n; while (left > 0) { const k = Math.min(left, 12); out.push(sentence(rnd, k)); left -= k; } return out.join(" "); };
const optionsOf = (id: string) => { const rnd = mulberry32(seedNum(id + "o")); return [0, 1, 2, 3].map(() => words(rnd, 7).join(" ")); };
type Item = Record<string, unknown>;
const goodItem = (c: GenTask["candidates"][number]): Item => ({
  candidateId: c.candidateId, passage: c.route === "excerpt" ? c.excerpt!.text : passageOf(c.candidateId), question: "Which choice best states the main purpose of the text?", options: optionsOf(c.candidateId),
  correct_letter: c.targetLetter, explanation: `정답은 ${c.targetLetter} 이다. 근거는 지문의 두 곳에 있다.`, tone: ["wry"], devices: ["irony"], declaration: { original: true, noRealWorkQuoted: true, noCopyrightedSource: true },
});
const agentWrite = (taskPath: string, mutate?: (items: Item[], task: GenTask) => Item[]) => {
  const task = JSON.parse(readFileSync(taskPath, "utf-8")) as GenTask;
  let items = task.candidates.map(goodItem);
  if (mutate) items = mutate(items, task);
  writeFileSync(task.resultPath, JSON.stringify({ chunkId: task.chunkId, model: "opus", items }));
};
const agentReview = (taskPath: string, f: (id: string, role: string, it: ReviewTask["items"][number]) => Item) => {
  const t = JSON.parse(readFileSync(taskPath, "utf-8")) as ReviewTask;
  writeFileSync(t.resultPath, JSON.stringify({ chunkId: t.chunkId, model: t.suggestedModel, items: t.items.map((it) => f(it.candidateId, t.role, it)) }));
};
const okJudge = (letter: (id: string) => string) => (id: string, role: string): Item => role === "fable_judge"
  ? { candidateId: id, picked_letter: letter(id), other_defensible: false, est_difficulty: "hard", hard_fit: true, plausible_distractors: true, length_balanced: true, multi_answer_risk: false, issues: "" }
  : role === "second_solver" ? { candidateId: id, picked_letter: letter(id), other_defensible: false, confidence: "high", note: "" }
  : { candidateId: id, answer_correct: true, explanation_consistent: true, explanation_factual: true, issues: "" };

const batch = (difficulty: "easy" | "medium" | "hard" = "hard", route: "excerpt" | "ai_passage" = "ai_passage"): PlanBatch => ({
  batchId: `t-${difficulty}-01`, route, difficulty, candidates: 12, estCostSyncUsd: 1, estCostBatchUsd: 0.5,
  cells: [{ skill: "inferences", questionType: "character_motivation", genre: "short_story", count: 6 }, { skill: "central_ideas_details", questionType: "main_idea_or_purpose", genre: "personal_essay", count: 6 }],
});
const taskFiles = (root: string) => readdirSync(dirs(root).tasks).filter((f) => f.endsWith(".task.json")).sort().map((f) => path.join(dirs(root).tasks, f));

describe("세션 모드: prepare", () => {
  it("청크는 10~25문항으로 균등 분할", () => {
    expect(chunkEven(Array.from({ length: 100 }, (_, i) => i), 20).map((c) => c.length)).toEqual([20, 20, 20, 20, 20]);
    expect(chunkEven(Array.from({ length: 57 }, (_, i) => i), 20).map((c) => c.length)).toEqual([19, 19, 19]);
    expect(chunkEven([1, 2, 3], 20)).toEqual([[1, 2, 3]]);
    expect(chunkEven(Array.from({ length: 30 }, (_, i) => i), 3).map((c) => c.length)).toEqual([10, 10, 10]); // 하한 10
    expect(chunkEven(Array.from({ length: 80 }, (_, i) => i), 99).every((c) => c.length <= 25)).toBe(true);
  });
  it("작업 파일: 프롬프트·출력 스키마·허용 값·금지 사항·결과 저장 경로·후보별 씨앗·목표 위치·단어 범위", () => {
    const root = tmp();
    const tasks = prepare({ root, runId: "t", batch: batch(), chunkSize: 10 });
    expect(tasks).toHaveLength(2);
    const t = JSON.parse(readFileSync(tasks[0].path, "utf-8")) as GenTask;
    expect(t.resultPath).toContain("results/");
    expect(t.instructions).toContain(t.resultPath);
    for (const k of ["출력 JSON 스키마", "허용 값", "금지:", "targetLetter", "Tobias", "declaration"]) expect(t.instructions).toContain(k);
    expect(t.candidates).toHaveLength(6);
    for (const c of t.candidates) { expect("ABCD").toContain(c.targetLetter); expect(c.words.min).toBeGreaterThanOrEqual(60); expect(c.spec.seed.names.length).toBeGreaterThan(0); expect(c.promptBlock).toContain(c.spec.seed.topicSeed); expect(t.instructions).toContain(c.candidateId); }
    const letters = tasks.flatMap((x) => (JSON.parse(readFileSync(x.path, "utf-8")) as GenTask).candidates.filter((c) => c.skill === "inferences").map((c) => c.targetLetter));
    expect(Math.max(...["A", "B", "C", "D"].map((L) => letters.filter((x) => x === L).length)) - Math.min(...["A", "B", "C", "D"].map((L) => letters.filter((x) => x === L).length))).toBeLessThanOrEqual(1);
  });
  it("같은 배치 재 prepare 는 거부(장부 이중 집계 방지), 발췌 부족도 거부", () => {
    const root = tmp();
    prepare({ root, runId: "t", batch: batch() });
    expect(() => prepare({ root, runId: "t", batch: batch() })).toThrow(/이미 prepare/);
    expect(() => prepare({ root: tmp(), runId: "t", batch: batch("easy", "excerpt"), excerpts: [] })).toThrow(/발췌 지문이 부족/);
  });
});

describe("세션 모드: ingest(검증 게이트)", () => {
  it("정상 항목은 통과하고, 위반 항목은 stage 와 사유와 함께 탈락·재요청으로 기록된다", () => {
    const root = tmp();
    const tasks = prepare({ root, runId: "t", batch: batch(), chunkSize: 10 });
    agentWrite(tasks[0].path, (items) => {
      items[1] = { ...items[1], passage: passageOf("short", 30) }; // 단어 수 미달 -> 재요청
      items[2] = { ...items[2], options: ["Short one", "Short two", "Short three", "A very long correct answer that runs well past the others in words"], correct_letter: "D" }; // 정답 최장
      items[3] = { ...items[3], passage: `${passageOf("kr", 100)} 한글이 섞였다` }; // 한글
      items[4] = { ...items[4], declaration: { original: true, noRealWorkQuoted: false, noCopyrightedSource: true } };
      return items.slice(0, 5).concat(items.slice(6)); // 6번째 항목 누락 -> missing
    });
    const r = ingest(root, tasks[0].taskId);
    const stages = Object.fromEntries(r.rejected.map((x) => [x.stage, x.reasons.join(" ")]));
    expect(r.passed.length).toBe(1);
    expect(r.retryWords).toHaveLength(1);
    expect(stages.distractor).toMatch(/가장 긴/);
    expect(stages.format).toMatch(/한글/);
    expect(stages.declaration).toBeTruthy();
    expect(stages.missing).toBeTruthy();
    expect(existsSync(path.join(dirs(root).ingested, `${tasks[0].taskId}.json`))).toBe(true);
  });
  it("어긋난 정답 위치는 보정되어 통과하고 notes 에 남는다", () => {
    const root = tmp();
    const tasks = prepare({ root, runId: "t", batch: batch(), chunkSize: 10 });
    agentWrite(tasks[0].path, (items, task) => items.map((it, i) => { if (i !== 0) return it; const want = task.candidates[0].targetLetter; const other = "ABCD".replace(want, "")[0]; const opts = [...(it.options as string[])]; const a = "ABCD".indexOf(want), b = "ABCD".indexOf(other); [opts[a], opts[b]] = [opts[b], opts[a]]; return { ...it, options: opts, correct_letter: other, explanation: `정답은 ${other} 이다.` }; }));
    const r = ingest(root, tasks[0].taskId);
    const p = r.passed.find((x) => x.candidateId.endsWith("-001"))!;
    expect(p.g.correct_letter).toBe(p.spec.targetLetter);
    expect(p.notes.join()).toMatch(/보정/);
  });
  it("발췌(easy) 지문은 원문과 같아야 통과하고, 다르면 탈락", () => {
    const root = tmp();
    const excerpts = Array.from({ length: 12 }, (_, i) => ({ text: passageOf(`ex${i}`, 90), source: { author: "pd", work: `w${i}`, license: "PD" } }));
    const tasks = prepare({ root, runId: "t", batch: batch("easy", "excerpt"), excerpts, chunkSize: 10 });
    agentWrite(tasks[0].path, (items) => items.map((it, i) => (i === 0 ? { ...it, passage: `${it.passage} extra` } : it)));
    const r = ingest(root, tasks[0].taskId);
    expect(r.rejected.some((x) => /원문과 다름/.test(x.reasons.join()))).toBe(true);
    expect(r.passed.length).toBe(5);
  });
  it("결과 파일이 없거나 손상되면 fileProblem/탈락으로 기록하고 중복 ingest 는 거부", () => {
    const root = tmp();
    const tasks = prepare({ root, runId: "t", batch: batch(), chunkSize: 10 });
    expect(ingest(root, tasks[0].taskId).fileProblem).toMatch(/없음/);
    writeFileSync((JSON.parse(readFileSync(tasks[1].path, "utf-8")) as GenTask).resultPath, "{not json");
    const r = ingest(root, tasks[1].taskId);
    expect(r.rejected).toHaveLength(6);
    expect(() => ingest(root, tasks[1].taskId)).toThrow(/이미 ingest/);
  });
});

describe("세션 모드: prepare -> ingest -> review 집계 -> 재작성 (결정론 전체 흐름)", () => {
  const run = (root: string) => {
    const tasks = prepare({ root, runId: "flow", batch: batch(), chunkSize: 10 });
    agentWrite(tasks[0].path, (items) => items.map((it, i) => (i === 1 ? { ...it, passage: passageOf("short", 30) } : it)));
    agentWrite(tasks[1].path);
    tasks.forEach((t) => ingest(root, t.taskId));
    const rev = reviewPrepare({ root, runId: "flow", chunkSize: 10 });
    const passedIds = loadIngested(root).flatMap((r) => r.passed.map((p) => p.candidateId)).sort();
    const letterOf = (id: string) => loadIngested(root).flatMap((r) => r.passed).find((p) => p.candidateId === id)!.g.correct_letter;
    const tooEasy = passedIds[0], wrong = passedIds[1];
    for (const t of rev) agentReview(t.path, (id, role, it) => {
      const base = okJudge(letterOf)(id, role);
      if (id === tooEasy && role === "fable_judge") return { ...base, est_difficulty: "medium", hard_fit: false };
      if (id === wrong && role === "second_solver") return { ...base, picked_letter: "ABCD".replace(letterOf(id), "")[0] };
      void it; return base;
    });
    return { tasks, rev, passedIds, tooEasy, wrong };
  };
  it("판정 작업 파일: 3역할, 블라인드 역할에는 정답·해설이 없고 감사 역할에만 있다", () => {
    const root = tmp();
    const tasks = prepare({ root, runId: "flow", batch: batch(), chunkSize: 10 });
    tasks.forEach((t) => { agentWrite(t.path); ingest(root, t.taskId); });
    const rev = reviewPrepare({ root, runId: "flow", chunkSize: 10 });
    expect(rev.map((t) => t.role).sort()).toEqual(["explanation_audit", "explanation_audit", "fable_judge", "fable_judge", "second_solver", "second_solver"]);
    for (const t of rev) {
      const task = JSON.parse(readFileSync(t.path, "utf-8")) as ReviewTask;
      const blind = task.role !== "explanation_audit";
      for (const it of task.items) { expect("correct_letter" in it).toBe(!blind); expect("explanation" in it).toBe(!blind); }
      expect(task.instructions).toContain(task.resultPath);
      expect(t.suggestedModel).toBe(task.role === "fable_judge" ? "fable" : task.role === "second_solver" ? "opus" : "sonnet");
    }
    expect(reviewPrepare({ root, runId: "flow" })).toHaveLength(0); // 이미 큐에 넣은 통과분은 다시 만들지 않는다
  });
  it("집계: 채택·탈락·'쉬움' 한정 재작성 후보를 가르고, 판정이 덜 온 후보는 pending", () => {
    const root = tmp();
    const { tooEasy, wrong, passedIds } = run(root);
    const { decisions, summary } = reviewIngest(root);
    const by = Object.fromEntries(decisions.map((d) => [d.candidateId, d]));
    expect(by[tooEasy]).toMatchObject({ status: "rejected", tooEasy: true, rewriteEligible: true });
    expect(by[tooEasy].reasons).toEqual(["difficulty_too_easy"]);
    expect(by[wrong].status).toBe("rejected");
    expect(by[wrong].reasons).toContain("second_answer_mismatch");
    expect(by[wrong].rewriteEligible).toBe(false); // 쉬움이 아닌 사유는 재작성하지 않는다
    expect(summary.adopted).toBe(passedIds.length - 2);
    expect(summary.rewriteEligible).toBe(1);
    // 판정 파일 하나를 지우면 해당 청크 후보는 pending
    const fableTask = readdirSync(dirs(root).results).find((f) => f.includes("fable_judge"))!;
    rmSync(path.join(dirs(root).results, fableTask));
    expect(reviewIngest(root).summary.pending).toBeGreaterThan(0);
  });
  it("hard 채택 규칙: 정답 검증 통과여도 Fable 이 hard 로 보지 않으면(hard_fit 거짓) 탈락", () => {
    const root = tmp();
    const tasks = prepare({ root, runId: "flow", batch: batch(), chunkSize: 10 });
    tasks.forEach((t) => { agentWrite(t.path); ingest(root, t.taskId); });
    const rev = reviewPrepare({ root, runId: "flow", chunkSize: 10 });
    const letterOf = (id: string) => loadIngested(root).flatMap((r) => r.passed).find((p) => p.candidateId === id)!.g.correct_letter;
    for (const t of rev) agentReview(t.path, (id, role) => { const b = okJudge(letterOf)(id, role); return role === "fable_judge" ? { ...b, hard_fit: false } : b; });
    const { decisions } = reviewIngest(root);
    expect(decisions.every((d) => d.status === "rejected" && d.reasons.includes("hard_fit_failed"))).toBe(true);
    expect(decisions.some((d) => d.rewriteEligible)).toBe(false);
  });
  it("재작성 루프: 쉬움 사유 1회 + 단어 수 재요청 1회, 재작성본은 다시 판정하며 두 번째 '쉬움'은 재작성하지 않는다", () => {
    const root = tmp();
    const { tooEasy } = run(root);
    const rw = rewritePrepare({ root, runId: "flow", chunkSize: 10 });
    expect(rw.length).toBe(1);
    const rtask = JSON.parse(readFileSync(rw[0].path, "utf-8")) as GenTask;
    expect(rtask.attempt).toBe(1);
    expect(rtask.candidates.map((c) => c.candidateId)).toContain(tooEasy);
    const reasons = rtask.candidates.map((c) => c.previous!.reason).sort();
    expect(reasons).toEqual(["too_easy", "words"]);
    expect(rtask.instructions).toContain("난이도가 쉽다고 판정됨");
    agentWrite(rw[0].path, (items, t) => items.map((it) => ({ ...it, passage: passageOf(`${t.chunkId}-${it.candidateId}`, 140) })));
    const r = ingest(root, rw[0].taskId);
    expect(r.passed.length).toBe(2);
    expect(r.passed.every((p) => p.attempt === 1)).toBe(true);
    // 재작성본만 다시 판정 큐로
    const rev2 = reviewPrepare({ root, runId: "flow", chunkSize: 10 });
    expect(rev2.length).toBe(3);
    expect(rev2.map((t) => (JSON.parse(readFileSync(t.path, "utf-8")) as ReviewTask).items.length)).toEqual([2, 2, 2]);
    const letterOf = (id: string) => loadIngested(root).flatMap((x) => x.passed).filter((p) => p.candidateId === id).sort((a, b) => b.attempt - a.attempt)[0].g.correct_letter;
    for (const t of rev2) agentReview(t.path, (id, role) => { const b = okJudge(letterOf)(id, role); return id === tooEasy && role === "fable_judge" ? { ...b, est_difficulty: "medium", hard_fit: false } : b; });
    const { decisions } = reviewIngest(root);
    const d = decisions.find((x) => x.candidateId === tooEasy)!;
    expect(d).toMatchObject({ status: "rejected", tooEasy: true, rewriteEligible: false });
    expect(rewritePrepare({ root, runId: "flow" })).toHaveLength(0);
  });
  it("전체 흐름은 결정론적이다(다른 임시 폴더에서 같은 결과 파일·집계)", () => {
    const a = tmp(), b = tmp();
    run(a); run(b);
    const norm = (root: string, s: string) => s.split(root).join("<ROOT>");
    for (const sub of ["ingested", "tasks"]) for (const f of readdirSync(path.join(a, sub))) expect(norm(b, readFileSync(path.join(b, sub, f), "utf-8"))).toBe(norm(a, readFileSync(path.join(a, sub, f), "utf-8")));
    expect(reviewIngest(a).summary).toEqual(reviewIngest(b).summary);
    expect(readFileSync(path.join(a, "state.json"), "utf-8")).toBe(readFileSync(path.join(b, "state.json"), "utf-8"));
  });
  it("채택 보고: adopted 레코드(앱 skill 매핑·hard 는 provisional_ai)·탈락 사유 집계·비용 장부(세션/API 구분)", () => {
    const root = tmp();
    run(root);
    recordCost(root, { step: "judge", model: "fable", mode: "api", items: 5, tasks: 1, usd: 0.25 });
    const { report, adopted } = writeAdoptionReport(root, "flow");
    expect(report.adopted).toBe(adopted.length);
    expect(adopted.length).toBeGreaterThan(0);
    for (const a of adopted) {
      expect(a.difficultyStatus).toBe("provisional_ai");
      expect(a.problem.correctIndex).toBeGreaterThanOrEqual(0);
      expect(a.quality.generatedBy).toBe("session:opus");
    }
    const motivation = adopted.find((a) => a.quality.questionType === "character_motivation")!;
    expect(motivation.planSkill).toBe("inferences");
    expect(motivation.skill).toBe(APP_SKILL_OVERRIDE.character_motivation);
    expect(Object.keys(report.rejectedByReason).some((k) => k.startsWith("review:"))).toBe(true);
    const cost = summarizeCost(root);
    expect(cost.session.usd).toBe(0);
    expect(cost.session.tasks).toBe(2);
    expect(cost.api).toMatchObject({ calls: 1, items: 5, usd: 0.25 });
    expect(existsSync(path.join(dirs(root).reports, "adopted-items.json"))).toBe(true);
  });
  it("status: 에이전트 대기·ingest 가능 작업을 구분", () => {
    const root = tmp();
    const tasks = prepare({ root, runId: "s", batch: batch(), chunkSize: 10 });
    expect(status(root).dispatch).toHaveLength(2);
    agentWrite(tasks[0].path);
    const s = status(root);
    expect(s.dispatch).toHaveLength(1);
    expect(s.ingestable.map((t) => t.taskId)).toEqual([tasks[0].taskId]);
  });
  it("앱 skill 매핑: 인물 동기 등 4유형은 앱 렌더 규칙(inferences 빈칸 강제)을 피해 central_ideas_details 로 검사한다", () => {
    expect(Object.keys(APP_SKILL_OVERRIDE).sort()).toEqual(["character_motivation", "relationship_between_characters", "symbolism", "tone_or_mood"]);
  });
});
