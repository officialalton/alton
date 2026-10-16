// 2026-10-07 — 관리자 '보존' 화면(legal hold·삭제 대기열)의 공용 타입·표시 규칙.
// 서버 액션 파일("use server")은 async 함수만 export 할 수 있어 순수 값은 여기 둔다.

export const HOLD_SUBJECT_TYPES = [
  "global",
  "profile",
  "student",
  "household",
  "consultation",
  "enrollment",
  "session",
  "prospect_contact",
  "consult_request",
] as const;
export type HoldSubjectType = (typeof HOLD_SUBJECT_TYPES)[number];

export const HOLD_SUBJECT_LABEL: Record<HoldSubjectType, string> = {
  global: "전체(모든 데이터)",
  profile: "계정(프로필)",
  student: "학생",
  household: "가족(household)",
  consultation: "상담",
  enrollment: "수강(과목 등록)",
  session: "수업 세션",
  prospect_contact: "잠재고객",
  consult_request: "상담 요청",
};

/** 이름 검색이 가능한 대상 종류(나머지는 ID 직접 입력 후 서버가 존재를 확인). */
export const NAME_SEARCHABLE_TYPES: readonly HoldSubjectType[] = ["profile", "student"];

export const HOLD_SCOPE_OPTIONS = ["all"] as const;

export type HoldEventRow = {
  id: string;
  eventType: "placed" | "extended" | "released" | "review_notice";
  actorName: string | null;
  reviewBy: string | null;
  note: string | null;
  createdAt: string;
};

export type HoldRow = {
  id: string;
  subjectType: HoldSubjectType;
  subjectId: string | null;
  subjectLabel: string | null;
  scope: string[];
  reason: string;
  setByName: string | null;
  setAt: string;
  reviewBy: string;
  releasedAt: string | null;
  releasedByName: string | null;
  releaseNote: string | null;
  events: HoldEventRow[];
};

export type HoldRequestRow = {
  id: string;
  subjectType: HoldSubjectType;
  subjectId: string | null;
  subjectLabel: string | null;
  scope: string[];
  reason: string;
  requestedByName: string | null;
  requestedByMe: boolean;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type LegalHoldsView = {
  isHolder: boolean;
  holds: HoldRow[];
  requests: HoldRequestRow[];
};

export type DeletionTargetRow = {
  id: string;
  category: string;
  sourceTable: string;
  driveFileId: string;
  status: "pending" | "deleted" | "failed";
  attempts: number;
  lastError: string | null;
  firstFailedAt: string | null;
  escalatedAt: string | null;
  dueAt: string;
  nextAttemptAt: string;
  deletedAt: string | null;
};

export type DeletionQueueView = {
  /** 재시도 가능 여부(지정자 또는 마스터). 화면 버튼 노출용 — 서버·DB가 최종 방어선. */
  canRetry: boolean;
  rows: DeletionTargetRow[];
  truncated: boolean;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

export const DELETION_STATUS_LABEL: Record<DeletionTargetRow["status"], string> = {
  pending: "대기",
  failed: "실패",
  deleted: "삭제됨",
};

/** review_by(YYYY-MM-DD)가 오늘(포함) 이전이면 재검토 기한 경과. 자동 해제는 없다. */
export function isReviewOverdue(reviewBy: string, today: Date = new Date()): boolean {
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return reviewBy <= t;
}

/** DB 규칙과 동일: 내일부터 최대 366일 이내(DB가 최종 판정). */
export function reviewByError(reviewBy: string, today: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewBy)) return "재검토일을 입력해 주세요.";
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${reviewBy}T00:00:00`);
  const diff = Math.round((target.getTime() - base.getTime()) / 86400000);
  if (Number.isNaN(diff) || diff < 1 || diff > 366) return "재검토일은 내일부터 최대 12개월 이내여야 합니다.";
  return null;
}

export function reasonError(reason: string, label = "사유"): string | null {
  return reason.trim().length < 10 ? `${label}는 10자 이상 입력해 주세요.` : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID_RE.test(v.trim());
