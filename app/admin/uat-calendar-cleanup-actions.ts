"use server";

// 2026-09-18 — 일회성 UAT 정리 전용. R13 상담 마일스톤 Preview UAT 중 실제로
// 생성된 Calendar 이벤트 1건(official@alton.education, google_event_id=
// v7rjj2epr9g4csroidibopjm1c)을 지운다. 삭제 전에 지정된 메타데이터(요약·시간·
// 참석자 도메인)가 정확히 일치하는지 먼저 확인하고, 일치하지 않으면 삭제하지
// 않고 그 사실을 그대로 반환한다(다른 이벤트를 잘못 지우는 사고 방지). 이
// 파일은 정리가 끝나면 삭제한다 — 상시 기능이 아니다.

import { requireAdmin } from "@/lib/admin-auth";
import { getCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";

const EXPECTED_CALENDAR_OWNER = "official@alton.education";
const CONSULT_ORGANIZER_EMAIL = process.env.CONSULT_ORGANIZER_EMAIL ?? EXPECTED_CALENDAR_OWNER;
const EXPECTED_EVENT_ID = "v7rjj2epr9g4csroidibopjm1c";
const EXPECTED_SUMMARY = "[Alton] 상담 — UAT r13-0918c a 보호자";
const EXPECTED_START_UTC_MS = Date.parse("2026-09-25T05:00:00.000Z");
const EXPECTED_END_UTC_MS = Date.parse("2026-09-25T05:30:00.000Z");

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

// 2026-09-18(사용자 승인) — 문자열 그대로 비교하면 Google이 organizer 로컬
// 타임존(예: -07:00)으로 돌려준 시각과 우리가 기대하는 UTC 표기가 글자만
// 달라도 "불일치"로 잘못 판정한다(실제로 이 문제로 한 번 멈췄다). Date.parse로
// 실제 타임스탬프(ms)로 정규화해 비교한다. 5가지를 전부 확인한다: event id,
// 캘린더 소유자(호출에 쓴 organizer 이메일), summary, 참석자(@example.com만),
// UTC 기준 시작/종료 시각.
async function fetchAndCheck(eventId: string): Promise<UatCalendarCheckResult> {
  if (CONSULT_ORGANIZER_EMAIL !== EXPECTED_CALENDAR_OWNER) {
    return {
      found: false,
      matches: false,
      mismatchReasons: [`캘린더 소유자 불일치: CONSULT_ORGANIZER_EMAIL=${CONSULT_ORGANIZER_EMAIL}`],
    };
  }

  const event = await getCalendarEvent({ teacherWorkspaceEmail: CONSULT_ORGANIZER_EMAIL, googleEventId: eventId });
  if (!event) return { found: false, matches: false };

  const attendeeEmails = (event.attendees ?? []).map((a) => a.email);
  const startMs = event.start?.dateTime ? Date.parse(event.start.dateTime) : NaN;
  const endMs = event.end?.dateTime ? Date.parse(event.end.dateTime) : NaN;
  const reasons: string[] = [];

  if (event.id !== EXPECTED_EVENT_ID) {
    reasons.push(`event id 불일치: ${event.id}`);
  }
  if (event.summary !== EXPECTED_SUMMARY) {
    reasons.push(`summary 불일치: ${event.summary}`);
  }
  if (Number.isNaN(startMs) || startMs !== EXPECTED_START_UTC_MS) {
    reasons.push(`start(UTC 정규화) 불일치: ${event.start?.dateTime} → ${startMs}ms, 기대값 ${EXPECTED_START_UTC_MS}ms`);
  }
  if (Number.isNaN(endMs) || endMs !== EXPECTED_END_UTC_MS) {
    reasons.push(`end(UTC 정규화) 불일치: ${event.end?.dateTime} → ${endMs}ms, 기대값 ${EXPECTED_END_UTC_MS}ms`);
  }
  if (attendeeEmails.length === 0 || !attendeeEmails.every((e) => e.endsWith("@example.com"))) {
    reasons.push(`참석자가 전부 @example.com 가짜 주소가 아님: ${attendeeEmails.join(",")}`);
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
