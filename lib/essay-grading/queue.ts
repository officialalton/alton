import { buildPrompt, checkEssayLength, type Anchor } from "./prompt";
import { resolveRubric } from "./rubric";
import { checkCaps, costUsd, flagEnabled, limits, type Usage } from "./costs";
import { combineRuns, totalOf, validateGraderOutput, type Disagreement, type GraderOutput } from "./schema";
import { GraderRefusal, type GraderClient } from "./client";

export const MAX_ATTEMPTS = 3;
export const backoffMs = (attemptsMade: number): number => Math.min(60 * 60_000, 2 ** attemptsMade * 60_000); // 2,4,8분…

export type EssayKey = { attemptId: string; setItemId: string; partLabel: string; studentId: string; /** 생략 = englang-v2 */ rubricVersion?: string };
export type Status = "pending" | "processing" | "done" | "failed" | "dead" | "skipped";
export type Row = { status: Status; attemptsMade: number; nextRetryAt: string | null };
export type Finish = {
  status: Status; model?: string | null; scores?: Record<string, unknown> | null; rationale?: Record<string, unknown> | null;
  attemptsMade?: number; nextRetryAt?: string | null; lastError?: string | null; inputTokens?: number; outputTokens?: number; costUsd?: number;
};
/** 저장소 경계(실제 구현은 store.ts, service_role). claim 은 원자적이어야 한다: pending 이거나 재시도 시각이 지난 failed 일 때만 processing 으로 바꾸고 true. */
export interface EssayStore {
  claim(key: EssayKey): Promise<{ claimed: boolean; row: Row }>;
  usage(key: EssayKey): Promise<Usage>;
  finish(key: EssayKey, f: Finish): Promise<void>;
}
export type Deps = { store: EssayStore; client: GraderClient; now?: () => Date };
export type Job = EssayKey & { taskPrompt: string; sources: { id: string; title?: string; body: string }[]; essay: string; anchors: Anchor[]; /** 생략 = englang-v2 */ rubricId?: string; taskType?: "saq" | "dbq" | "leq" | string; scoringNotes?: string };
export type Outcome =
  | { status: "disabled" }
  | { status: "skipped"; reason: string }
  | { status: "already"; row: Row }
  | { status: "done"; total: number; disagreement: Disagreement | null }
  | { status: "failed" | "dead"; error: string };

const errCode = (e: unknown): string => (e instanceof GraderRefusal ? e.code : e instanceof Error && /^[a-z_]{3,40}$/.test(e.message) ? e.message : "grader_error"); // 본문·메시지 원문은 저장하지 않는다.

/** 에세이 하나를 채점한다(멱등). 플래그 꺼짐이면 아무 것도 쓰지 않고 호출도 하지 않는다. */
export async function processEssay(deps: Deps, job: Job): Promise<Outcome> {
  if (!flagEnabled()) return { status: "disabled" };
  const { store, client } = deps; const now = deps.now ?? (() => new Date());
  const def = resolveRubric(job.rubricId, job.taskType);
  if (!def) return { status: "skipped", reason: "bad_rubric" }; // 알 수 없는 루브릭/과제 유형: 행을 만들지 않고 건너뜀
  const l = limits(def.id);
  const key: EssayKey = { attemptId: job.attemptId, setItemId: job.setItemId, partLabel: job.partLabel, studentId: job.studentId, rubricVersion: def.id };

  const refusal = checkEssayLength(job.essay, def);
  const { claimed, row } = await store.claim(key);
  if (!claimed) return { status: "already", row };
  const attemptsMade = row.attemptsMade + 1;
  if (refusal) { await store.finish(key, { status: "skipped", lastError: refusal, attemptsMade }); return { status: "skipped", reason: refusal }; }

  const prompt = buildPrompt({ taskPrompt: job.taskPrompt, sources: job.sources, essay: job.essay, anchors: job.anchors, rubricId: def.id, taskType: def.taskType, scoringNotes: job.scoringNotes });
  const cap = checkCaps(await store.usage(key), prompt.system.length + prompt.user.length, l);
  if (!cap.ok) { await store.finish(key, { status: "skipped", lastError: cap.reason, attemptsMade: row.attemptsMade }); return { status: "skipped", reason: cap.reason }; }

  let inTok = 0, outTok = 0, model: string | null = null;
  try {
    const runs: GraderOutput[] = [];
    for (let i = 0; i < 2; i++) {
      const r = await client.grade({ system: prompt.system, user: prompt.user, maxOutputTokens: l.maxOutputTokensPerEssay, rubricRows: def.rows });
      inTok += r.inputTokens; outTok += r.outputTokens; model = r.model;
      const v = validateGraderOutput(r.output, def.rows);
      if (!v.ok) throw new Error("invalid_output");
      runs.push(v.value);
    }
    const { result, disagreement } = combineRuns(runs[0], runs[1], def.rows);
    const total = totalOf(result.scores, def.rows);
    await store.finish(key, {
      status: "done", model, attemptsMade, nextRetryAt: null, lastError: null, inputTokens: inTok, outputTokens: outTok, costUsd: costUsd(inTok, outTok, l),
      scores: { ...result.scores, total, disagreement: disagreement !== null, rubricVersion: def.id, ...(def.taskType ? { taskType: def.taskType } : {}) },
      rationale: { ...result.rationale, improve: result.improve },
    });
    return { status: "done", total, disagreement };
  } catch (e) {
    const code = errCode(e);
    const terminal = code === "flag_off" || code === "no_key" ? false : attemptsMade >= MAX_ATTEMPTS;
    const status: Status = terminal ? "dead" : "failed";
    await store.finish(key, {
      status, model, attemptsMade, lastError: code, inputTokens: inTok, outputTokens: outTok, costUsd: costUsd(inTok, outTok, l),
      nextRetryAt: terminal ? null : new Date(now().getTime() + backoffMs(attemptsMade)).toISOString(),
    });
    return { status, error: code };
  }
}
