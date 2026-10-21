import { buildPrompt, checkEssayLength, type Anchor } from "./prompt";
import { resolveRubric } from "./rubric";
import { checkCaps, costUsd, flagEnabled, limits, worstCaseUsd, type Usage } from "./costs";
import { combineRuns, totalOf, validateGraderOutput, type Disagreement, type GraderOutput } from "./schema";
import { GraderRefusal, type GraderClient } from "./client";

export const MAX_ATTEMPTS = 3;
/** 기준 답안(보정 앵커) 최소 개수 — 미만이면 점수 신뢰도를 보증할 수 없어 채점하지 않는다(임시 기준 답안을 자동 생성하지 않는다). */
export const MIN_ANCHORS = 3;
/** 한도 초과로 기다리는 사유(재시도 가능). 한도 초기화 시점은 저장소의 사용량 집계와 같은 UTC 기준이다. */
export const WAIT_REASONS = ["daily_cap", "monthly_budget"] as const;
export const NO_ANCHOR_REASON = "no_reference_answers";
/** 한도 초기화 시점: 일일 = 다음 UTC 자정, 월간 = 다음 UTC 월 1일 0시. 예산은 자동 증액하지 않는다(초기화를 기다릴 뿐). */
export function limitResetAt(reason: "daily_cap" | "monthly_budget", d: Date): Date {
  return reason === "daily_cap" ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)) : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
export const backoffMs = (attemptsMade: number): number => Math.min(60 * 60_000, 2 ** attemptsMade * 60_000); // 2,4,8분…

export type EssayKey = { attemptId: string; setItemId: string; partLabel: string; studentId: string; /** 생략 = englang-v2 */ rubricVersion?: string };
export type Status = "pending" | "processing" | "done" | "failed" | "dead" | "skipped";
export type Row = { status: Status; attemptsMade: number; nextRetryAt: string | null };
export type Finish = {
  status: Status; model?: string | null; scores?: Record<string, unknown> | null; rationale?: Record<string, unknown> | null;
  attemptsMade?: number; nextRetryAt?: string | null; lastError?: string | null; /** 토큰·비용은 이번 실행의 증분 — 저장소가 이전 값에 합산한다 */ inputTokens?: number; outputTokens?: number; costUsd?: number;
  /** reserveBudget 이 돌려준 예약 id — 있으면 실비로 정산(비용 0 이면 해제) */ reservationId?: string;
};
/** 저장소 경계(실제 구현은 store.ts, service_role). claim 은 원자적이어야 한다: pending 이거나 재시도 시각이 지난 failed 일 때만 processing 으로 바꾸고 true. */
export interface EssayStore {
  claim(key: EssayKey): Promise<{ claimed: boolean; row: Row }>;
  usage(key: EssayKey): Promise<Usage>;
  finish(key: EssayKey, f: Finish): Promise<void>;
  /** 월 예산 원자적 예약(선택 구현): 월 지출(확정+유효 예약)+amountUsd 가 budgetUsd 이하일 때만 예약 id 를 돌려준다. 동시 요청이 같은 잔여 예산을 보고 함께 실행하는 것을 막는다. */
  reserveBudget?(key: EssayKey, amountUsd: number, budgetUsd: number): Promise<{ ok: true; reservationId: string } | { ok: false }>;
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
  // 기준 답안 부족: 명시적 이용 불가 상태와 사유를 남긴다(모델 호출 없음, 시도 횟수 소모 없음). 기준 답안이 보강된 뒤 다시 누르면 이 답안만 다시 처리된다(바로 claim 가능).
  if (!refusal && job.anchors.length < MIN_ANCHORS) {
    await store.finish(key, { status: "failed", lastError: NO_ANCHOR_REASON, attemptsMade: row.attemptsMade, nextRetryAt: now().toISOString() });
    return { status: "failed", error: NO_ANCHOR_REASON };
  }
  const attemptsMade = row.attemptsMade + 1;
  if (refusal) { await store.finish(key, { status: "skipped", lastError: refusal, attemptsMade }); return { status: "skipped", reason: refusal }; }

  const prompt = buildPrompt({ taskPrompt: job.taskPrompt, sources: job.sources, essay: job.essay, anchors: job.anchors, rubricId: def.id, taskType: def.taskType, scoringNotes: job.scoringNotes });
  const cap = checkCaps(await store.usage(key), prompt.system.length + prompt.user.length, l);
  if (!cap.ok && (cap.reason === "daily_cap" || cap.reason === "monthly_budget")) {
    // 일시적 한도 초과는 최종 skipped 가 아니다: 초기화 시점까지 대기(failed + next_retry_at). 시도 횟수는 쓰지 않고 모델 호출도 없으며 예산·한도는 건드리지 않는다.
    await store.finish(key, { status: "failed", lastError: cap.reason, attemptsMade: row.attemptsMade, nextRetryAt: limitResetAt(cap.reason, now()).toISOString() });
    return { status: "failed", error: cap.reason };
  }
  if (!cap.ok) { await store.finish(key, { status: "skipped", lastError: cap.reason, attemptsMade: row.attemptsMade }); return { status: "skipped", reason: cap.reason }; }

  // 호출 전 예산 예약(최악 4호출 금액을 원장에 선기록). 실패하면 월 예산 대기 — 모델 호출 없음.
  let reservationId: string | undefined;
  if (store.reserveBudget) {
    const r = await store.reserveBudget(key, worstCaseUsd(l), l.monthlyBudgetUsd);
    if (!r.ok) {
      await store.finish(key, { status: "failed", lastError: "monthly_budget", attemptsMade: row.attemptsMade, nextRetryAt: limitResetAt("monthly_budget", now()).toISOString() });
      return { status: "failed", error: "monthly_budget" };
    }
    reservationId = r.reservationId;
  }
  let inTok = 0, outTok = 0, model: string | null = null;
  try {
    const runs: GraderOutput[] = [];
    for (let i = 0; i < 2; i++) {
      // 모델이 도구 입력의 필드(주로 마지막 행)를 가끔 빠뜨린다(실측: englit 18건 중 2건) — 한 번만 다시 호출한다(비용은 합산).
      let v: ReturnType<typeof validateGraderOutput> = { ok: false, reason: "not_run" };
      for (let a = 0; a < 2 && !v.ok; a++) {
        const r = await client.grade({ system: prompt.system, user: prompt.user, maxOutputTokens: l.maxOutputTokensPerEssay, rubricRows: def.rows });
        inTok += r.inputTokens; outTok += r.outputTokens; model = r.model;
        v = validateGraderOutput(r.output, def.rows);
      }
      if (!v.ok) throw new Error("invalid_output");
      runs.push(v.value);
    }
    const { result, disagreement } = combineRuns(runs[0], runs[1], def.rows);
    const total = totalOf(result.scores, def.rows);
    await store.finish(key, {
      status: "done", model, attemptsMade, nextRetryAt: null, lastError: null, inputTokens: inTok, outputTokens: outTok, costUsd: costUsd(inTok, outTok, l), reservationId,
      scores: { ...result.scores, total, disagreement: disagreement !== null, rubricVersion: def.id, ...(def.taskType ? { taskType: def.taskType } : {}) },
      rationale: { ...result.rationale, improve: result.improve },
    });
    return { status: "done", total, disagreement };
  } catch (e) {
    const code = errCode(e);
    const terminal = code === "flag_off" || code === "no_key" ? false : attemptsMade >= MAX_ATTEMPTS;
    const status: Status = terminal ? "dead" : "failed";
    await store.finish(key, {
      status, model, attemptsMade, lastError: code, inputTokens: inTok, outputTokens: outTok, costUsd: costUsd(inTok, outTok, l), reservationId,
      nextRetryAt: terminal ? null : new Date(now().getTime() + backoffMs(attemptsMade)).toISOString(),
    });
    return { status, error: code };
  }
}
