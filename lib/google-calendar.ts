import { getCalendarApiAccessToken, getFreeBusyApiAccessToken } from "@/lib/google-workspace-auth";
import {
  isM4PreviewVerificationFlagEnabled,
  getM4PreviewCalendarAccessToken,
} from "@/lib/google-workspace-preview-verify-auth";

// M4 외부 검증 임시 조치 — Preview에서는 Production WIF 체인(assertNotPreview()로 원천
// 차단됨)을 절대 쓰지 않고, 별도 최소권한 Preview 전용 서비스 계정을 쓴다. 플래그가
// 없으면 기존 경로 그대로이므로 Production/로컬 동작은 전혀 바뀌지 않는다 — 검증 완료
// 후 별도 승인으로 제거 예정.
async function resolveCalendarAccessToken(subjectEmail: string): Promise<string> {
  return isM4PreviewVerificationFlagEnabled()
    ? getM4PreviewCalendarAccessToken(subjectEmail)
    : getCalendarApiAccessToken(subjectEmail);
}

// R6 2/N — Google Calendar 이벤트 + 고유 Meet 링크 생성, FreeBusy 조회.
//
// 안전 게이트: DRIVE_ARTIFACTS_ALLOW_REAL_WRITES/WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS와
// 동일한 패턴 — CALENDAR_SYNC_ALLOW_REAL_CALLS가 정확히 "true"가 아니면 실제 Calendar API를
// 절대 호출하지 않고 명시적으로 실패한다(스텁이 성공한 것처럼 보이지 않게).
//
// 설계: Supabase(reservations/sessions)가 원본이고 Google Calendar 이벤트는 "실행용
// 사본"이다(스펙 원문). 이 파일의 함수들은 순수 API 클라이언트 — 실패 시 예외를 던질 뿐
// DB 상태를 직접 갱신하지 않는다. 호출부(lib/booking/*)가 성공/실패에 따라
// reservations.google_sync_status를 갱신하고, 실패해도 예약·세션·수업권 hold 자체는
// 되돌리지 않는다(어중간한 상태 방지 — DB가 원본이므로 Calendar 쪽만 재시도 대상).

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

function assertRealCallsAllowed(): void {
  if (process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS !== "true") {
    throw new Error(
      "not implemented: CALENDAR_SYNC_ALLOW_REAL_CALLS=true가 아니면 실제 Calendar API를 호출하지 않습니다."
    );
  }
}

async function calendarFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar API 요청 실패 (status ${res.status}): ${text.slice(0, 300)}`);
  }
  return res;
}

type CalendarEventResult = {
  googleEventId: string;
  meetLink: string;
};

/**
 * 확정된 예약 하나에 대해 organizer(선생님 또는 상담 관리자) 캘린더에 이벤트 + 고유
 * Meet 링크를 생성한다. `conferenceData.createRequest.requestId`에 reservationId를
 * 그대로 써서, 같은 예약으로 재시도해도 Google 쪽에서 새 Meet 링크가 중복 발급되지
 * 않게 한다(Google API가 requestId 기준으로 자체 멱등 처리 — 공식 문서 명시 동작).
 *
 * **(2026-09-03 정책 전환)** 확정된 상담·체험·정규수업은 Google Calendar 네이티브
 * 초대를 기본 전달 수단으로 쓴다(제품 정책 확정) — 이전 R6의 "attendees 없음 +
 * sendUpdates=none" 정책은 폐기됐다. `attendeeEmail`이 있으면 유일한 외부 참석자로
 * 추가하고 `sendUpdates`를 호출부가 명시적으로 지정한다(기본값 없음 — 정책이 달라진
 * 이유를 호출부가 항상 의식하도록 강제). 참석자는 항상 초대 재전송·수정·다른 참석자
 * 열람이 불가능하다(`guestsCanInviteOthers`/`guestsCanModify`/`guestsCanSeeOtherGuests`
 * 전부 false — attendeeEmail이 없어도 무해하므로 항상 적용).
 */
export async function createCalendarEventWithMeet(params: {
  teacherWorkspaceEmail: string;
  reservationId: string;
  startsAt: Date;
  endsAt: Date;
  summary: string;
  timezone: string;
  attendeeEmail?: string;
  description?: string;
  sendUpdates: "all" | "none";
}): Promise<CalendarEventResult> {
  assertRealCallsAllowed();
  const token = await resolveCalendarAccessToken(params.teacherWorkspaceEmail);

  const res = await calendarFetch(
    `${CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=${params.sendUpdates}`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        summary: params.summary,
        description: params.description,
        start: { dateTime: params.startsAt.toISOString(), timeZone: params.timezone },
        end: { dateTime: params.endsAt.toISOString(), timeZone: params.timezone },
        attendees: params.attendeeEmail ? [{ email: params.attendeeEmail }] : undefined,
        guestsCanInviteOthers: false,
        guestsCanModify: false,
        guestsCanSeeOtherGuests: false,
        conferenceData: {
          createRequest: {
            requestId: params.reservationId,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        extendedProperties: {
          private: { altonReservationId: params.reservationId },
        },
      }),
    }
  );
  const data = (await res.json()) as {
    id: string;
    conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> };
  };
  const meetEntry = data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  if (!meetEntry) {
    throw new Error("Calendar 이벤트는 생성됐지만 Meet 링크를 받지 못했습니다.");
  }
  return { googleEventId: data.id, meetLink: meetEntry.uri };
}

/** 재예약·선생님 변경 시 기존 이벤트 시간을 갱신한다(같은 googleEventId 유지).
 * `sendUpdates`는 호출부가 명시한다(2026-09-03 정책 전환 — 참석자가 있는 이벤트는
 * "all"로 Google 네이티브 변경 알림을 보낸다). */
export async function patchCalendarEventTime(params: {
  teacherWorkspaceEmail: string;
  googleEventId: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  sendUpdates: "all" | "none";
}): Promise<void> {
  assertRealCallsAllowed();
  const token = await resolveCalendarAccessToken(params.teacherWorkspaceEmail);
  await calendarFetch(
    `${CALENDAR_API}/calendars/primary/events/${params.googleEventId}?sendUpdates=${params.sendUpdates}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({
        start: { dateTime: params.startsAt.toISOString(), timeZone: params.timezone },
        end: { dateTime: params.endsAt.toISOString(), timeZone: params.timezone },
      }),
    }
  );
}

/** 취소 시 기존 이벤트를 삭제한다. 이미 삭제된 이벤트(404/410)는 성공으로 취급한다(멱등).
 * `sendUpdates`는 호출부가 명시한다(2026-09-03 정책 전환). */
export async function deleteCalendarEvent(params: {
  teacherWorkspaceEmail: string;
  googleEventId: string;
  sendUpdates: "all" | "none";
}): Promise<void> {
  assertRealCallsAllowed();
  const token = await resolveCalendarAccessToken(params.teacherWorkspaceEmail);
  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events/${params.googleEventId}?sendUpdates=${params.sendUpdates}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    throw new Error(`Calendar 이벤트 삭제 실패 (status ${res.status}): ${text.slice(0, 300)}`);
  }
}

export type IncrementalCalendarEvent = {
  googleEventId: string;
  status: "confirmed" | "cancelled";
  altonReservationId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  meetLink: string | null;
};

export type IncrementalCalendarSyncResult = {
  events: IncrementalCalendarEvent[];
  nextSyncToken: string;
  syncTokenExpired: boolean;
};

/**
 * R6 11/N — "Google 직접 변경의 사이트 역반영"용 증분 조회. sync token이 있으면 마지막
 * 조회 이후 바뀐/삭제된 이벤트만 받는다(Google 권장 패턴, 알림 누락에 대비한 정기
 * 대조 용도 — Calendar push 알림만으로 마지막 편집자를 신뢰하지 않는다는 원칙).
 * sync token이 만료(410 GONE)되면 `syncTokenExpired: true`로 알리고, 호출부가 전체
 * 재동기화(syncToken 없이 재호출)로 폴백해야 한다.
 *
 * `extendedProperties.private.altonReservationId`(createCalendarEventWithMeet가 쓰는 값)로
 * ALTON이 만든 이벤트만 골라내 반환한다 — 선생님의 다른 개인 일정은 포함되지 않는다.
 */
export async function listCalendarEventsIncremental(params: {
  teacherWorkspaceEmail: string;
  syncToken?: string;
}): Promise<IncrementalCalendarSyncResult> {
  assertRealCallsAllowed();
  const token = await resolveCalendarAccessToken(params.teacherWorkspaceEmail);

  // (2026-09-03 정정, Sandbox 실측으로 발견) Google Calendar API의 `privateExtendedProperty`
  // 쿼리 파라미터는 정확한 key=value만 지원하고 와일드카드(`key=*`)를 지원하지 않는다 —
  // 이전 구현은 `altonReservationId=*`로 필터링을 시도해 실제로는 항상 0건이 매칭됐다
  // (서버가 조용히 빈 결과를 반환할 뿐 에러도 나지 않아 mock 테스트로는 드러나지 않았다).
  // ALTON이 만든 이벤트만 골라내는 필터는 서버 쿼리가 아니라 아래에서 클라이언트 측으로
  // 옮겼다(선생님 캘린더의 다른 개인 일정도 함께 내려오지만, 이 함수 호출부는 어차피
  // `altonReservationId`가 있는 것만 사용한다).
  const query = new URLSearchParams();
  if (params.syncToken) {
    query.set("syncToken", params.syncToken);
  } else {
    query.set("showDeleted", "true");
  }

  const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 410) {
    return { events: [], nextSyncToken: "", syncTokenExpired: true };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar 증분 조회 실패 (status ${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    nextSyncToken?: string;
    items?: Array<{
      id: string;
      status: "confirmed" | "cancelled" | "tentative";
      start?: { dateTime?: string };
      end?: { dateTime?: string };
      extendedProperties?: { private?: { altonReservationId?: string } };
      conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> };
    }>;
  };

  // (2026-09-03 정정) Google이 삭제된(cancelled) 이벤트는 증분 동기화 응답에서 id/status
  // 외의 필드(extendedProperties 포함)를 거의 항상 비운다 — 그래서 confirmed 이벤트만
  // `altonReservationId` 존재로 걸러내고, cancelled 이벤트는 `altonReservationId: null`인
  // 채로 그대로 반환한다(걸러내지 않음). 호출부(external-change-detection.ts)가 cancelled
  // 이벤트는 googleEventId로 우리 DB의 예약과 직접 대조해 식별한다.
  const events: IncrementalCalendarEvent[] = (data.items ?? [])
    .filter((item) => item.status === "cancelled" || !!item.extendedProperties?.private?.altonReservationId)
    .map((item) => ({
      googleEventId: item.id,
      status: item.status === "cancelled" ? "cancelled" : "confirmed",
      altonReservationId: item.extendedProperties?.private?.altonReservationId ?? null,
      startsAt: item.start?.dateTime ?? null,
      endsAt: item.end?.dateTime ?? null,
      meetLink: item.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? null,
    }));

  if (!data.nextSyncToken) {
    throw new Error("Calendar 증분 조회 응답에 nextSyncToken이 없습니다(페이지네이션 미구현 — 현재 범위 밖).");
  }
  return { events, nextSyncToken: data.nextSyncToken, syncTokenExpired: false };
}

export type FreeBusyInterval = { start: string; end: string };

/**
 * 선생님 캘린더 기준 FreeBusy 조회 — 내부 DB 잠금(reservations_no_overlap exclusion +
 * confirm_lesson_booking의 버퍼/가용성 재검증)과 "함께" 쓰는 이중 방어다(스펙 원문).
 * 여기서 busy로 나와도 DB 잠금이 이미 주된 방어선이므로, 호출부는 이 결과를 예약을
 * 하드 차단하는 용도(Google 쪽 일정과의 명백한 충돌 사전 경고)로만 쓴다.
 */
export async function queryFreeBusy(params: {
  teacherWorkspaceEmail: string;
  timeMin: Date;
  timeMax: Date;
}): Promise<FreeBusyInterval[]> {
  assertRealCallsAllowed();
  const token = await getFreeBusyApiAccessToken(params.teacherWorkspaceEmail);
  const res = await calendarFetch(`${CALENDAR_API}/freeBusy`, token, {
    method: "POST",
    body: JSON.stringify({
      timeMin: params.timeMin.toISOString(),
      timeMax: params.timeMax.toISOString(),
      items: [{ id: "primary" }],
    }),
  });
  const data = (await res.json()) as {
    calendars: Record<string, { busy: FreeBusyInterval[] }>;
  };
  return data.calendars.primary?.busy ?? [];
}
