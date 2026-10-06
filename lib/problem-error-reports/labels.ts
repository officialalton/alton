// 문제 오류 신고 — 화면 공용 라벨·규칙(클라이언트·서버 공용, DB 제약과 같은 규칙).
// 신고 유형: 해설 오류는 선생님만 고를 수 있다(학생 UI 에는 나타나지 않는다). 기타는 메모 필수.

export type ReportType = "wrong_key" | "flawed_problem" | "bad_explanation" | "other";
export type ReporterRole = "student" | "teacher";
export type Verdict = "not_error" | "key_wrong_confirmed" | "flawed_confirmed" | "explanation_confirmed";

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  wrong_key: "정답 오류",
  flawed_problem: "문제 자체 오류",
  bad_explanation: "해설 오류",
  other: "기타",
};

export const REPORT_TYPE_HINT: Record<ReportType, string> = {
  wrong_key: "정답으로 표시된 선지가 잘못됐어요.",
  flawed_problem: "정답이 없거나 여러 개이거나, 지문·문항이 모호하거나 깨져 보여요.",
  bad_explanation: "정답은 맞는데 해설이 틀렸어요.",
  other: "위에 없는 문제예요. 내용을 적어 주세요.",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  not_error: "오류 아님",
  key_wrong_confirmed: "정답 오류 확정",
  flawed_confirmed: "문제 자체 오류 확정",
  explanation_confirmed: "해설 오류 확정",
};

export const VERDICT_EFFECT: Record<Verdict, string> = {
  not_error: "문항 복귀(오류 확정으로 보관됐다면) · 대체 문항 필요 기록 닫기 · 이전 조정 원복. 이미 교체된 세트는 그대로입니다. 신고자에게는 '오류 아님'으로 안내됩니다.",
  key_wrong_confirmed: "문항 보관 + 이미 나간 응시·과제 전원 정답 처리(미응답 포함). 대체 문항 필요 기록·여분 자동 교체.",
  flawed_confirmed: "문항 보관 + 이미 나간 응시·과제 전원 정답 처리(미응답 포함). 대체 문항 필요 기록·여분 자동 교체.",
  explanation_confirmed: "문항 보관, 채점·점수 변경 없음. 대체 문항 필요 기록·여분 자동 교체.",
};

export const SOURCE_LABEL: Record<string, string> = { session_assignment: "수업·과제", mock_exam: "모의고사", homework_batch: "과제 묶음" };

export const MEMO_MAX = 1000;

/** 이 역할이 고를 수 있는 신고 유형(해설 오류는 선생님만). */
export function reportTypesFor(role: ReporterRole): ReportType[] {
  return role === "teacher" ? ["wrong_key", "flawed_problem", "bad_explanation", "other"] : ["wrong_key", "flawed_problem", "other"];
}

export type ReportContext =
  | { source: "session_assignment"; sessionId: string; sessionSource: "lesson" | "homework"; problemId: string }
  | { source: "homework_batch"; batchId: string; problemId: string }
  | { source: "mock_exam"; attemptId: string; setItemId: string; problemId?: string };

export type MyReportStatus = "reviewing" | "confirmed" | "not_error";
export const MY_STATUS_TEXT: Record<MyReportStatus, string> = {
  reviewing: "신고함 · 검토 중",
  confirmed: "신고하신 오류가 확인되어 문항이 보관됐어요",
  not_error: "검토 결과 오류가 아닌 것으로 판단했어요",
};

// 영어 UI(모의고사 응시 화면 — 2026-10-02 사용자 지시). 기본 화면 문구는 위 한국어 그대로다.
export type ReportLang = "ko" | "en";

export const REPORT_TYPE_LABEL_EN: Record<ReportType, string> = {
  wrong_key: "Wrong answer key",
  flawed_problem: "Problem itself is flawed",
  bad_explanation: "Explanation error",
  other: "Other",
};

export const REPORT_TYPE_HINT_EN: Record<ReportType, string> = {
  wrong_key: "The choice marked as correct is wrong.",
  flawed_problem: "There is no correct answer, more than one, or the passage/question is unclear or looks broken.",
  bad_explanation: "The answer is right but the explanation is wrong.",
  other: "Something not listed above. Please describe it.",
};

export const MY_STATUS_TEXT_EN: Record<MyReportStatus, string> = {
  reviewing: "Reported · Under review",
  confirmed: "Your report was confirmed and the question has been retired",
  not_error: "Reviewed: this was not found to be an error",
};

export const REPORT_UI_TEXT: Record<ReportLang, {
  trigger: string; legend: string; memo: string; required: string; optional: string; placeholder: string;
  cancel: string; close: string; submit: string; sending: string; accepted: string; duplicate: string;
}> = {
  ko: {
    trigger: "문제 오류 신고", legend: "어떤 문제인가요? (필수)", memo: "메모", required: " (필수)", optional: " (선택)",
    placeholder: "어떤 부분이 이상한지 적어 주세요.", cancel: "취소", close: "닫기", submit: "신고하기", sending: "보내는 중…",
    accepted: "신고가 접수됐어요. 확인 후 결과를 안내해 드릴게요.", duplicate: "이미 신고한 문항이에요. 검토 중입니다.",
  },
  en: {
    trigger: "Report a problem", legend: "What is wrong? (required)", memo: "Note", required: " (required)", optional: " (optional)",
    placeholder: "Tell us what looks wrong.", cancel: "Cancel", close: "Close", submit: "Submit report", sending: "Sending…",
    accepted: "Your report was received. We will review it and let you know the result.", duplicate: "You already reported this question. It is under review.",
  },
};
