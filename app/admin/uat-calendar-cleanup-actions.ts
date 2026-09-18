"use server";

// 2026-09-18 — 일회성 UAT 정리 전용. R13 상담 마일스톤 Preview UAT 중 실제로
// 생성된 Calendar 이벤트 1건(official@alton.education, google_event_id=
// v7rjj2epr9g4csroidibopjm1c)을 지운다. 삭제 전에 지정된 메타데이터(요약·시간·
// 참석자 도메인)가 정확히 일치하는지 먼저 확인하고, 일치하지 않으면 삭제하지
// 않고 그 사실을 그대로 반환한다(다른 이벤트를 잘못 지우는 사고 방지). 이
// 파일은 정리가 끝나면 삭제한다 — 상시 기능이 아니다.

import { requireAdmin } from "@/lib/admin-auth";
import { getCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";

const CONSULT_ORGANIZER_EMAIL = process.env.CONSULT_ORGANIZER_EMAIL ?? "official@alton.education";

export type UatCalendarCheckResult = {
  found: boolean;
  matches: boolean;
  raw?: {
    id: string;
    summary?: string;
    start?: string;
    end?: string;
    attendeeEmails: string[];
    status: string;
  };
  mismatchReasons?: string[];
};

async function fetchAndCheck(eventId: string): Promise<UatCalendarCheckResult> {
  const event = await getCalendarEvent({ teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL, googleEventId: eventId });
  if (!event) return { found: false, matches: false };

  const attendeeEmails = (event.attendees ?? []).map((a) => a.email);
  const reasons: string[] = [];

  if (event.summary !== "[Alton] 상담 — UAT r13-0918c a 보호자") {
    reasons.push(`summary 불일치: ${event.summary}`);
  }
  if (event.start?.dateTime !== "2026-09-25T05:00:00.000Z") {
    reasons.push(`start 불일치: ${event.start?.dateTime}`);
  }
  if (event.end?.dateTime !== "2026-09-25T05:30:00.000Z") {
    reasons.push(`end 불일치: ${event.end?.dateTime}`);
  }
  if (!attendeeEmails.every((e) => e.endsWith("@example.com"))) {
    reasons.push(`참석자에 @example.com이 아닌 주소 있음: ${attendeeEmails.join(",")}`);
  }

  return {
    found: true,
    matches: reasons.length === 0,
    raw: {
      id: event.id,
      summary: event.summary,
      start: event.start?.dateTime,
      end: event.end?.dateTime,
      attendeeEmails,
      status: event.status,
    },
    mismatchReasons: reasons.length > 0 ? reasons : undefined,
  };
}

export async function checkUatCalendarEvent(eventId: string): Promise<UatCalendarCheckResult> {
  await requireAdmin();
  return fetchAndCheck(eventId);
}

/** 조회→확인→삭제를 한 서버 액션 안에서 원자적으로 한다 — 확인과 삭제 사이에
 * 다른 이벤트로 바뀔 여지를 없앤다. 불일치면 삭제하지 않고 그대로 반환. */
export async function deleteUatCalendarEventIfMatches(eventId: string): Promise<
  UatCalendarCheckResult & { deleted: boolean }
> {
  await requireAdmin();
  const check = await fetchAndCheck(eventId);
  if (!check.found) return { ...check, deleted: false };
  if (!check.matches) return { ...check, deleted: false };

  await deleteCalendarEvent({ teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL, googleEventId: eventId, sendUpdates: "none" });
  return { ...check, deleted: true };
}
