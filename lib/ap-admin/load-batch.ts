// '배치 전체 적재' 오케스트레이션(2026-10-13): ①적재 → ②렌더 기록 → ③화면 기록 → ④문제은행 변환을 한 번에 돌린다.
// 새 정책은 없다. 각 단계는 기존 서비스 함수(runImport/runVerify/runConvert)를 같은 "미리보기 → 같은 계획 해시로 실행" 규칙으로 그대로 호출하며,
// 환경 가드(AP_STOCK_ADMIN_ALLOWED_REFS)와 감사 로그(ap_stock_admin_runs)는 주입된 step 함수(= guarded 래퍼)가 단계마다 기존처럼 남긴다.
// 더 엄격한 점: 어느 단계든 건너뜀·충돌·오류가 하나라도 있으면 그 자리에서 멈추고 다음 단계로 넘어가지 않는다(단일 단계 흐름은 건너뜀을 보고 사람이 판단).
import { planHash } from "./plan-hash";
import { LABEL, msg, stepsFor, type BatchRun, type LoadStep, type LoadStepFn, type LoadStepResult, type ProgressEntry } from "./load-batch-client";
export * from "./load-batch-client";

/** 단계별 반복 상한(변환은 ⌈n/20⌉ 회). 상한을 넘으면 오류로 멈춘다. */
export const HARD_ROUND_CAP = 60;

/**
 * 한 단계의 dry-run 결과가 "그대로 실행해도 되는" 결과인지 판정한다. 문제 있으면 사유 문자열, 없으면 null.
 * strictReady: 실행 시점(앞 단계가 끝난 뒤)에만 켠다 — 미리보기 때는 아직 적재·검증 전이라 준비 안 됨이 정상이다.
 */
export function violation(step: LoadStep, r: LoadStepResult, strictReady: boolean): string | null {
  if (r.blocked) return r.blocked;
  if (!r.ok) return "단계가 실패로 끝났습니다.";
  const n = (k: string) => r.counts[k] ?? 0;
  if (step === "import") {
    if (n("payloadSkipped") > 0) return `내용이 바뀐 검증된 행이 있어 건너뛴 후보 ${n("payloadSkipped")}건 — 단일 단계 화면에서 확인하세요.`;
    if (n("stateConflictsKept") > 0) return `상태 충돌로 유지된 후보 ${n("stateConflictsKept")}건 — 단일 단계 화면에서 확인하세요.`;
    if (n("upgradesOnVerifiedOrConverted") > 0) return `검증·변환된 행에 대한 상태 승급 ${n("upgradesOnVerifiedOrConverted")}건 — 단일 단계 화면에서 확인하세요.`;
  } else if (step === "render" || step === "screen") {
    if (n("skipped") > 0) return `건너뜀 ${n("skipped")}건(증거 없음·해시 불일치 등) — 상세: ${r.lines.slice(0, 3).join(" / ")}`;
  } else {
    if (n("skipped") > 0) return `변환 불가 후보 ${n("skipped")}건 — 상세: ${r.lines.slice(0, 3).join(" / ")}`;
    if (strictReady) {
      if (n("notReviewReady") > 0) return `렌더·화면 검증이 끝나지 않은 후보 ${n("notReviewReady")}건이 남아 변환을 시작하지 않습니다.`;
      const missing = n("passKeys") - n("alreadyConverted") - n("notReviewReady") - n("skipped") - n("convertible");
      if (missing > 0) return `DB 에 없는 통과 키 ${missing}건(적재 누락).`;
    }
  }
  return null;
}

const entryOf = (step: LoadStep, round: number, phase: "preview" | "execute", r: LoadStepResult, ok: boolean): ProgressEntry => ({
  step, round, phase, ok, counts: r.counts, lines: r.lines.slice(0, 8),
  summary: `${LABEL[step]}${round > 1 ? ` (${round}회차)` : ""} — ${phase === "preview" ? "미리보기" : r.executed ? "실행 완료" : "실행 안 됨"}${r.blocked ? `: ${r.blocked}` : ""}`,
});

/** 한 배치의 모든 단계를 dry-run 만으로 계산한다(쓰기 0). 해시는 단계별 dry-run 해시의 합. */
async function previewBatch(step: LoadStepFn, batchId: string, hasLoadStep: boolean): Promise<BatchRun> {
  const run: BatchRun = { batchId, mode: "preview", ok: true, completed: false, previewHash: null, stoppedAt: null, entries: [] };
  const hashes: [LoadStep, string | null][] = [];
  for (const s of stepsFor(hasLoadStep)) {
    let r: LoadStepResult;
    try { r = await step({ step: s, batchId, execute: false }); }
    catch (e) { run.ok = false; run.stoppedAt = { step: s, reason: msg(e) }; run.entries.push({ step: s, round: 1, phase: "preview", ok: false, summary: `${LABEL[s]} — 미리보기 오류: ${msg(e)}`, counts: {}, lines: [] }); return run; }
    const v = violation(s, r, false);
    run.entries.push(entryOf(s, 1, "preview", r, !v));
    hashes.push([s, r.planHash]);
    if (v) { run.ok = false; run.stoppedAt = { step: s, reason: v }; return run; }
  }
  run.previewHash = planHash("load_batch", { batchId }, hashes);
  return run;
}

export type RunDeps = { step: LoadStepFn; canWrite: boolean; hasLoadStep: (batchId: string) => boolean; maxRounds?: number };

function nothingToDo(s: LoadStep, r: LoadStepResult): boolean {
  const n = (k: string) => r.counts[k] ?? 0;
  if (s === "import") return n("insert") + n("update") === 0;
  if (s === "convert") return n("thisRun") === 0;
  return n("toRecord") === 0;
}
function afterExecuteProblem(s: LoadStep, ex: LoadStepResult): string | null {
  const n = (k: string) => ex.counts[k] ?? 0;
  return s === "convert" && n("skippedNow") > 0 ? `변환 중 건너뜀 ${n("skippedNow")}건.` : null;
}

/**
 * 한 배치를 미리보기(execute=false) 또는 실행(execute=true)한다.
 * 실행: ① 쓰기 허용 대상·미리보기 해시 확인 → ② 단계마다 dry-run 을 다시 계산해 검증하고 그 해시로 execute → ③ 반복(변환 ≤20건씩, 검증 시간 제한 잔여분) 상한 내에서 남은 0 까지.
 */
export async function loadBatch(deps: RunDeps, batchId: string, execute: boolean, expectedPreviewHash?: string | null): Promise<BatchRun> {
  const hasLoad = deps.hasLoadStep(batchId);
  if (!execute) return previewBatch(deps.step, batchId, hasLoad);

  const run: BatchRun = { batchId, mode: "execute", ok: false, completed: false, previewHash: null, stoppedAt: null, entries: [] };
  const stop = (step: LoadStep | "guard" | "preview", reason: string) => { run.stoppedAt = { step, reason }; return run; };
  // 가드: 단계 함수들도 각자 다시 거부하지만, 아무것도 호출하기 전에 먼저 멈춘다.
  if (!deps.canWrite) return stop("guard", "쓰기 허용 목록 밖의 대상입니다(AP_STOCK_ADMIN_ALLOWED_REFS). 쓰기를 시작하지 않습니다.");
  if (!expectedPreviewHash) return stop("preview", "미리보기를 먼저 실행하고 같은 계획을 확인한 뒤 실행하세요.");
  const pv = await previewBatch(deps.step, batchId, hasLoad);
  run.entries.push(...pv.entries.map((e) => ({ ...e, summary: `(사전 확인) ${e.summary}` })));
  if (!pv.ok) return stop(pv.stoppedAt!.step, pv.stoppedAt!.reason);
  if (pv.previewHash !== expectedPreviewHash) return stop("preview", "미리보기 이후 계획이 달라졌습니다(DB 상태 변경). 미리보기를 다시 실행하세요.");
  run.previewHash = pv.previewHash;

  const cap = Math.min(deps.maxRounds ?? HARD_ROUND_CAP, HARD_ROUND_CAP);
  for (const s of stepsFor(hasLoad)) {
    let round = 0;
    for (;;) {
      round++;
      if (round > cap) return stop(s, `반복 상한(${cap}회)을 넘어 중단했습니다. 상태를 확인한 뒤 다시 실행하세요.`);
      let dry: LoadStepResult;
      try { dry = await deps.step({ step: s, batchId, execute: false }); }
      catch (e) { run.entries.push({ step: s, round, phase: "preview", ok: false, summary: `${LABEL[s]} — 확인 오류: ${msg(e)}`, counts: {}, lines: [] }); return stop(s, msg(e)); }
      const v = violation(s, dry, true);
      run.entries.push(entryOf(s, round, "preview", dry, !v));
      if (v) return stop(s, v);
      if (nothingToDo(s, dry)) break; // 멱등 재실행: 할 일이 없으면 실행 없이 통과
      let ex: LoadStepResult;
      try { ex = await deps.step({ step: s, batchId, execute: true, planHash: dry.planHash }); }
      catch (e) { run.entries.push({ step: s, round, phase: "execute", ok: false, summary: `${LABEL[s]} — 실행 오류: ${msg(e)}`, counts: {}, lines: [] }); return stop(s, msg(e)); }
      const bad = ex.blocked ?? (!ex.executed || !ex.ok ? "실행되지 않았습니다." : null) ?? afterExecuteProblem(s, ex) ?? ex.auditWarning ?? null;
      run.entries.push(entryOf(s, round, "execute", ex, !bad));
      if (bad) return stop(s, bad);
      if (s === "import") break; // 적재는 한 번이면 끝
      if (s !== "convert" && (ex.counts.remaining ?? 0) === 0) break;
      // 변환은 다음 회차 dry-run 이 남은 것을 판단하고, 검증은 시간 제한 잔여분이 있을 때만 다음 회차.
    }
  }
  run.ok = true; run.completed = true;
  return run;
}

