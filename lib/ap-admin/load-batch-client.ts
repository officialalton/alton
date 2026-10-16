// 배치 전체 적재의 클라이언트 안전 부분(node 모듈 없음): 타입·단계 라벨·배치 순차 실행·현황 계산. 오케스트레이션 본체는 load-batch.ts.
import type { ReviewStatusRow } from "./load-check";

export type LoadStep = "import" | "render" | "screen" | "convert";
export type LoadStepInput = { step: LoadStep; batchId: string; execute: boolean; planHash?: string | null; allowSkips?: boolean };
/** StepResult 의 필요한 부분(서비스의 StepResult 와 구조적으로 호환). */
export type LoadStepResult = { mode: "dry_run" | "execute"; executed: boolean; counts: Record<string, number>; lines: string[]; planHash: string | null; blocked: string | null; ok: boolean; auditWarning?: string; skips?: { key: string; reason: string }[]; notReady?: string[] };
export type LoadStepFn = (i: LoadStepInput) => Promise<LoadStepResult>;

export type ProgressEntry = { step: LoadStep; round: number; phase: "preview" | "execute"; ok: boolean; summary: string; counts: Record<string, number>; lines: string[] };
/** 건너뜀 허용 모드에서 허용되는 건너뜀 종류. 이 밖의 건너뜀(결함 플래그·렌더 게이트 실패·증거 검증 실패 등)은 그대로 멈춘다. */
export type SkipKind = "no_evidence" | "hash_mismatch" | "render_report_missing" | "render_prereq" | "not_review_ready";
export const SKIP_KIND_LABEL: Record<SkipKind, string> = { no_evidence: "화면 증거 없음", hash_mismatch: "해시 불일치", render_report_missing: "렌더 보고서 없음", render_prereq: "렌더 검증 건너뜀의 연쇄", not_review_ready: "검증 미완료(변환 안 함)" };
export type SkippedRow = { step: LoadStep; key: string; reason: string; kind: SkipKind };
export type BatchRun = {
  batchId: string; mode: "preview" | "execute"; ok: boolean; completed: boolean;
  /** 건너뜀 허용 모드로 돌렸는지(기본 false = 엄격). */
  allowSkips?: boolean;
  /** 건너뛴 후보(단계별). 건너뛴 행은 기록·변환·검증 표시되지 않는다. 엄격 모드에서는 항상 비어 있다. */
  skipped?: SkippedRow[];
  /** 실행 후 '남은 것': 통과했지만 변환되지 않은 후보와 사유(키 기준 중복 제거). */
  remaining?: { key: string; reason: string }[];
  /** 미리보기 계획 해시. 실행은 같은 해시일 때만 시작한다. */
  previewHash: string | null;
  stoppedAt: { step: LoadStep | "guard" | "preview"; reason: string } | null;
  entries: ProgressEntry[];
};

/** 허용 대상 건너뜀 사유 분류(없으면 null = 허용 안 됨). prior: 앞 단계에서 이미 허용 건너뜀된 키(연쇄 허용용). */
export function classifySkip(reason: string, key: string, prior: Set<string>): SkipKind | null {
  if (reason.includes("화면 증거 항목 없음")) return "no_evidence";
  if (reason.includes("해시 불일치") || reason.includes("content_hash 가 현재 DB 후보 내용과 다름")) return "hash_mismatch";
  if (reason.includes("렌더 보고서(report.json)에 없는 후보") || reason.includes("보고서에 contentHash 가 없음")) return "render_report_missing";
  if (reason.includes("렌더 검증이 먼저입니다") && prior.has(key)) return "render_prereq";
  return null;
}

export const stepsFor = (hasLoadStep: boolean): LoadStep[] => (hasLoadStep ? ["import", "render", "screen", "convert"] : ["render", "screen", "convert"]);
export const LABEL: Record<LoadStep, string> = { import: "① 후보 적재", render: "② 렌더 검증 기록", screen: "③ 화면 검증 기록", convert: "④ 문제은행 변환" };
export const loadStepLabel = (s: LoadStep) => LABEL[s];

/** 여러 배치를 순서대로. 첫 중단에서 멈춘다(다음 배치는 시작하지 않는다). onProgress 로 배치 단위 결과를 즉시 전달. */
export async function runBatchSequence(batchIds: string[], runOne: (batchId: string) => Promise<BatchRun>, onProgress?: (r: BatchRun) => void): Promise<{ runs: BatchRun[]; stoppedAt: { batchId: string; step: string; reason: string } | null; completed: number }> {
  const runs: BatchRun[] = [];
  for (const id of batchIds) {
    let r: BatchRun;
    try { r = await runOne(id); }
    catch (e) { r = { batchId: id, mode: "execute", ok: false, completed: false, previewHash: null, stoppedAt: { step: "guard", reason: msg(e) }, entries: [] }; }
    runs.push(r); onProgress?.(r);
    if (!r.ok) return { runs, stoppedAt: { batchId: id, step: r.stoppedAt?.step ?? "guard", reason: r.stoppedAt?.reason ?? "중단" }, completed: runs.filter((x) => x.ok).length };
  }
  return { runs, stoppedAt: null, completed: runs.length };
}

// ── 배치별 적재 현황(기존 load-check 계산과 같은 정의 + 변환 수) ─────────
export type BatchStatus = { id: string; keys: number; loaded: number; render: number; screen: number; ready: number; converted: number; done: boolean };
export function computeBatchStatus(batches: { id: string; keys: string[] }[], rows: ReviewStatusRow[], convertedKeys: Set<string>): BatchStatus[] {
  const byKey = new Map(rows.map((r) => [r.candidate_key, r]));
  return batches.map((b) => {
    const got = b.keys.map((k) => byKey.get(k)).filter((r): r is ReviewStatusRow => !!r);
    const converted = b.keys.filter((k) => convertedKeys.has(k)).length;
    return { id: b.id, keys: b.keys.length, loaded: got.length, render: got.filter((r) => r.render_verified).length, screen: got.filter((r) => r.screen_verified).length, ready: got.filter((r) => r.review_env_ready).length, converted, done: b.keys.length > 0 && converted === b.keys.length };
  });
}

export const msg = (e: unknown) => (e instanceof Error ? e.message : "실패했습니다.");

