"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { syncOneConsultationCalendarEvent } from "@/lib/consultation/calendar-sync";
import { sanitizeTimezone } from "@/lib/schedule-timezone";
import { toSchedulingLinkFailure, type SchedulingLinkFailure } from "@/lib/consultation/scheduling-link";

// 컨설턴트 스펙 §Scheduling after Assignment — 배정된 컨설턴트 전용 예약 링크
// (비로그인). 토큰 검증은 DB의 SECURITY DEFINER RPC 안에서만 한다 — 이 서버
// 액션은 얇은 호출부일 뿐이다(submit_homepage_consult_request 패턴과 동일).

export type OpenScheduleSlot = { startsAt: string };

// 2026-09-29 — 무효·만료 토큰은 throw 가 아니라 결과값으로 돌려준다(프로덕션 빌드는 서버 액션이
// throw 한 문구를 가리고 일반 오류만 보였다 — QA #8). 성공 경로의 값은 그대로다.
export async function listOpenSlotsForTokenAction(
  token: string,
  fromIso: string,
  toIso: string
): Promise<{ ok: true; slots: OpenScheduleSlot[] } | SchedulingLinkFailure> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_consultant_open_slots", { p_token: token, p_from: fromIso, p_to: toIso });
  if (error) return toSchedulingLinkFailure(error, "list_open_slots");
  return {
    ok: true,
    slots: ((data ?? []) as Array<{ slot_starts_at: string }>).map((r) => ({ startsAt: r.slot_starts_at })),
  };
}

export async function redeemSchedulingLinkAction(
  token: string,
  startsAtIso: string,
  timezone?: string
): Promise<{ ok: true } | SchedulingLinkFailure> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_consultation_scheduling_link", {
    p_token: token,
    p_starts_at: startsAtIso,
  });
  if (error) return toSchedulingLinkFailure(error, "redeem");

  const consultationId = (data as { id: string }).id;
  // 요구사항: Calendar/Meet 생성 — 실패해도 일정 확정(DB) 자체는 이미 커밋됐다
  // (google_sync_status만 재처리 대상으로 남는 graceful degradation 원칙,
  // lib/consultation/calendar-sync.ts와 동일).
  try {
    await syncOneConsultationCalendarEvent(consultationId, { timezone: sanitizeTimezone(timezone) });
  } catch (e) {
    console.error(
      JSON.stringify({ type: "consultant_scheduling_link_calendar_sync_failed", consultationId, error: e instanceof Error ? e.message : String(e) })
    );
  }
  return { ok: true };
}
