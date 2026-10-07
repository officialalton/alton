// 2026-09-29 — 시간 겹침 DB 거절(선생님·학생·컨설턴트)을 한 곳에서 친절한 한국어로 바꾼다.
// DB가 무엇을 거절하는지는 바꾸지 않는다. 메시지/구조화 사유만 통일한다.
// 서버 액션·lib 어디서든 Supabase 에러 객체, Error, 문자열을 그대로 넘기면 된다.

export type OverlapReason = "teacher_overlap" | "student_overlap" | "consultant_overlap";

export type OverlapError = { reason: OverlapReason; message: string };

export const OVERLAP_MESSAGES: Record<OverlapReason, string> = {
  teacher_overlap: "That time overlaps another lesson with your teacher. Please choose a different time.",
  student_overlap: "You already have another lesson at that time. Please choose a different time.",
  consultant_overlap: "That time overlaps another consultation or meeting with the same consultant. Please choose a different time.",
};

function rawOf(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; details?: unknown };
    const parts = [o.message, o.details].filter((v): v is string => typeof v === "string");
    if (parts.length) return parts.join(" ");
  }
  return e === undefined || e === null ? "" : String(e);
}

/** 겹침 에러면 {reason, message}, 아니면 null(호출자가 원래 처리를 이어간다). */
export function parseOverlapError(e: unknown): OverlapError | null {
  const raw = rawOf(e);
  if (!raw) return null;
  if (raw.includes("student_time_overlap") || raw.includes("이미 같은 시간에 다른 수업") || raw.includes("already have another lesson at the same time")) {
    return { reason: "student_overlap", message: OVERLAP_MESSAGES.student_overlap };
  }
  if (raw.includes("teacher_buffer_violation") || raw.includes("reservations_no_overlap")) {
    return { reason: "teacher_overlap", message: OVERLAP_MESSAGES.teacher_overlap };
  }
  if ((raw.includes("컨설턴트") && raw.includes("겹칩니다")) || /overlaps (another meeting|a consultation)/i.test(raw)) {
    return { reason: "consultant_overlap", message: OVERLAP_MESSAGES.consultant_overlap };
  }
  return null;
}

/** 던지거나 화면에 보일 문구: 겹침이면 친절한 문구, 아니면 원문 그대로. */
export function friendlyDbMessage(e: unknown): string {
  return parseOverlapError(e)?.message ?? rawOf(e);
}
