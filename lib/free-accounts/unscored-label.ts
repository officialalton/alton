// 관리자 AP 결과 패널: 점수 행이 모델 채점인지, 아니라면 어떤 사유로 표시할지. "use server" 파일은 비동기 함수만 내보낼 수 있어 별도 모듈로 둔다.
const SKIP_LABEL: Record<string, string> = {
  empty: "submitted blank response → 0 points (no model call)",
  too_short: "response too short → not scored (no model call)",
  too_long: "response too long → not scored (no model call)",
  daily_cap: "daily scoring limit reached → not scored",
  monthly_budget: "monthly scoring budget reached → not scored",
  no_reference_answers: "scoring unavailable (no reference answers)",
  bad_rubric: "scoring unavailable (unknown rubric)",
};
/** 점수 행 하나가 모델 채점인지, 아니라면 어떤 사유로 표시할지. done(또는 status 미기재 레거시 행)만 채점 구성에 센다. */
export function unscoredLabel(status: string | undefined, lastError: string | null | undefined): string | null {
  if (!status || status === "done") return null;
  if (status === "skipped") return SKIP_LABEL[lastError ?? ""] ?? `skipped (${lastError ?? "no reason recorded"}) → not scored (no model call)`;
  if (status === "pending" || status === "processing") return "waiting to be scored";
  if (status === "failed" && (lastError === "daily_cap" || lastError === "monthly_budget")) return "waiting for scoring limit reset";
  if (status === "failed") return "scoring failed, will retry";
  if (status === "dead") return "scoring failed (no more retries)";
  return `${status} → not scored`;
}

