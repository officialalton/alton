import { getMeetSettingsApiAccessToken, getMeetReadonlyApiAccessToken } from "@/lib/google-workspace-auth";

// R6 10/N·11/N — Google Meet REST API(v2) 클라이언트. Calendar API(이벤트+Meet 링크 생성)와는
// 별개 API 표면 — Meet Space의 Smart Notes 설정(자동 생성 ON/OFF)은 Calendar API가 아니라
// Meet API v2 Space 리소스(`spaces/{meetingCode}`, `config.artifactConfig.smartNotesConfig`)
// 에서만 다룰 수 있다(공개 문서 기준 필드 구조 — 실제 Sandbox 검증 전까지는 "최선 추정"으로
// 표시한다, 아래 각 함수 주석 참고). **(2026-09-02 정정, R6 11/N)** 이전에는 Calendar API용
// 토큰(getCalendarApiAccessToken)을 그대로 재사용했는데, Meet API는 별개 scope
// (meetings.space.settings/meetings.space.readonly, Gate C §1.3에 이미 등록됨)가 필요해
// Calendar용 scope로는 인가되지 않았을 것이다 — 전용 토큰 함수로 분리했다.

const MEET_API = "https://meet.googleapis.com/v2";

function assertRealCallsAllowed(): void {
  if (process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS !== "true") {
    throw new Error(
      "not implemented: CALENDAR_SYNC_ALLOW_REAL_CALLS=true가 아니면 실제 Meet API를 호출하지 않습니다."
    );
  }
}

async function meetFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meet API 요청 실패 (status ${res.status}): ${text.slice(0, 300)}`);
  }
  return res;
}

/**
 * Google Meet 링크(예: https://meet.google.com/abc-defg-hij)에서 회의 코드만 뽑아낸다.
 * Meet API v2는 이 코드를 spaces 리소스의 별칭으로 그대로 쓸 수 있다(공식 문서: meeting
 * code를 spaceId 자리에 사용 가능).
 */
export function extractMeetingCodeFromLink(meetLink: string): string | null {
  const match = meetLink.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match ? match[1] : null;
}

const SMART_NOTES_UPDATE_MASK = "config.artifactConfig.smartNotesConfig.autoSmartNotesGeneration";

type SpaceResource = { name: string; config?: { artifactConfig?: { smartNotesConfig?: { autoSmartNotesGeneration?: string } } } };

/**
 * 가족계약 필수 조항으로 바뀐 뒤 Smart Notes는 정규수업이면 항상 ON이다(회차별 OFF 없음) —
 * 이 함수는 "그 세션의 Meet Space에서 Smart Notes가 실제로 ON인지 확정"하는 것만 한다.
 *
 * **(2026-09-03 정정, 실제 spaces.patch 403 재현 후 구현 확인)** 이전 구현은 meeting code
 * 별칭(`spaces/{meetingCode}`)으로 곧장 PATCH를 보냈는데, Sandbox 실측에서 이 별칭에 대한
 * PATCH가 일관되게 403(Permission denied)이었다 — GET은 성공하는데 PATCH만 실패하는 패턴은
 * Google 쪽이 쓰기 작업에는 별칭이 아니라 canonical resource name(`spaces/{spaceId}`, GET
 * 응답의 `name` 필드)을 요구할 가능성을 시사한다. 그래서 (1) meeting code로 GET해
 * canonical `space.name`을 얻고, (2) 그 canonical name으로 PATCH하고, (3) 다시 GET해서
 * 실제로 "ON"이 됐는지 재확인하는 3단계로 바꿨다. 이 함수는 이번 작업에서는 실제 호출하지
 * 않는다(mock/로컬 검증만, `CALENDAR_SYNC_ALLOW_REAL_CALLS` 기본 false 유지) — 실제 Google
 * Sandbox로 이 경로 자체가 403을 우회하는지는 다음 실제 검증 세션에서 확인한다.
 */
export async function enableMeetSpaceSmartNotes(params: {
  teacherWorkspaceEmail: string;
  meetingCode: string;
}): Promise<void> {
  assertRealCallsAllowed();
  const settingsToken = await getMeetSettingsApiAccessToken(params.teacherWorkspaceEmail);
  const readonlyToken = await getMeetReadonlyApiAccessToken(params.teacherWorkspaceEmail);

  const initialRes = await meetFetch(`${MEET_API}/spaces/${params.meetingCode}`, readonlyToken, { method: "GET" });
  const initialSpace = (await initialRes.json()) as SpaceResource;
  const canonicalName = initialSpace.name;
  if (!canonicalName) {
    throw new Error(`spaces.get 응답에 canonical name이 없습니다(meetingCode: ${params.meetingCode}).`);
  }

  await meetFetch(`${MEET_API}/${canonicalName}?updateMask=${SMART_NOTES_UPDATE_MASK}`, settingsToken, {
    method: "PATCH",
    body: JSON.stringify({
      config: { artifactConfig: { smartNotesConfig: { autoSmartNotesGeneration: "ON" } } },
    }),
  });

  const confirmRes = await meetFetch(`${MEET_API}/${canonicalName}`, readonlyToken, { method: "GET" });
  const confirmedSpace = (await confirmRes.json()) as SpaceResource;
  const finalState = confirmedSpace.config?.artifactConfig?.smartNotesConfig?.autoSmartNotesGeneration;
  if (finalState !== "ON") {
    throw new Error(`PATCH 이후 재확인 결과 Smart Notes가 ON이 아닙니다(canonical: ${canonicalName}, 실제 상태: ${finalState ?? "unknown"}).`);
  }
}

/**
 * M1(2026-09-03 추가) — `official@alton.education` 조직에 Smart Notes 자동 생성 org 정책이
 * 이미 켜져 있으면 그것으로 충분하다(제품 오너 지시) — 이 함수는 PATCH부터 시도하지 않고
 * 먼저 GET으로 현재 상태를 읽어, 이미 "ON"이면 아무 쓰기도 하지 않고 그대로 true를 반환한다.
 * "ON"이 아닐 때만 기존 enableMeetSpaceSmartNotes()(canonical name PATCH+재확인)로 보정을
 * 시도한다. 반환값은 "이 호출이 끝난 시점에 실제로 ON임을 확인했는지"이며, 확인 자체가
 * 실패(API 오류 등)하면 예외를 던진다(호출부가 상태 컬럼에 기록).
 */
export async function ensureMeetSpaceSmartNotesOn(params: {
  teacherWorkspaceEmail: string;
  meetingCode: string;
}): Promise<boolean> {
  assertRealCallsAllowed();
  const readonlyToken = await getMeetReadonlyApiAccessToken(params.teacherWorkspaceEmail);
  const res = await meetFetch(`${MEET_API}/spaces/${params.meetingCode}`, readonlyToken, { method: "GET" });
  const space = (await res.json()) as SpaceResource;
  const currentState = space.config?.artifactConfig?.smartNotesConfig?.autoSmartNotesGeneration;
  if (currentState === "ON") {
    return true; // org 정책 또는 이전 보정으로 이미 ON — 추가 쓰기 없음.
  }
  await enableMeetSpaceSmartNotes(params);
  return true;
}

/**
 * **(2026-09-03 추가, R6 Sandbox 실측으로 확정)** Workspace Events가 push로 보내는 Smart
 * Notes 알림 본문에는 `smartNote.name`(리소스 이름)만 있고 실제 Drive 파일 ID는 없다 —
 * `GET /v2/{smartNoteResourceName}`을 추가로 호출해 `docsDestination.document`를 읽어야
 * 한다. 문서가 아직 생성 중이면 `state`가 `FILE_GENERATED`가 아닐 수 있다 — 이 경우 null.
 */
export async function fetchSmartNoteDriveFileId(params: {
  teacherWorkspaceEmail: string;
  smartNoteResourceName: string;
}): Promise<string | null> {
  assertRealCallsAllowed();
  const token = await getMeetReadonlyApiAccessToken(params.teacherWorkspaceEmail);
  const res = await meetFetch(`${MEET_API}/${params.smartNoteResourceName}`, token, { method: "GET" });
  const data = (await res.json()) as { state?: string; docsDestination?: { document?: string } };
  if (data.state !== "FILE_GENERATED") return null;
  return data.docsDestination?.document ?? null;
}

/**
 * **(2026-09-03 추가, R6 Sandbox 실측으로 확정)** Smart Notes push 알림에는 `meetingCode`가
 * 전혀 실려오지 않는다 — `conferenceRecords/{id}` → `space` 필드로 Space 리소스 이름을 얻고,
 * 다시 `GET /v2/spaces/{id}`로 실제 회의 코드(`meetingCode`)를 조회해야
 * `reservations.google_meeting_code`와 매칭할 수 있다.
 */
export async function resolveMeetingCodeFromConferenceRecord(params: {
  teacherWorkspaceEmail: string;
  conferenceRecordName: string;
}): Promise<string | null> {
  assertRealCallsAllowed();
  const token = await getMeetReadonlyApiAccessToken(params.teacherWorkspaceEmail);
  const recordRes = await meetFetch(`${MEET_API}/${params.conferenceRecordName}`, token, { method: "GET" });
  const record = (await recordRes.json()) as { space?: string };
  if (!record.space) return null;
  const spaceRes = await meetFetch(`${MEET_API}/${record.space}`, token, { method: "GET" });
  const space = (await spaceRes.json()) as { meetingCode?: string };
  return space.meetingCode ?? null;
}

export type MeetParticipantEvent = {
  participantId: string;
  profileId: string | null;
  eventType: "joined" | "left";
  occurredAt: string;
};

/**
 * 특정 conferenceRecord의 참가 기록을 조회한다(폴링 경로 — 이벤트 수신이 누락된 경우의
 * 보정용, 주 경로는 app/api/webhooks/workspace-events/route.ts의 push 이벤트). **Sandbox
 * 미검증 가정**: `GET /v2/conferenceRecords/{id}/participants` + 각 참가자의
 * `participantSessions`에서 join/leave 시각을 뽑는 형태 — 정확한 응답 스키마는 Sandbox
 * 검증 단계에서 확정한다.
 */
export async function listConferenceParticipantEvents(params: {
  teacherWorkspaceEmail: string;
  conferenceRecordName: string;
}): Promise<MeetParticipantEvent[]> {
  assertRealCallsAllowed();
  const token = await getMeetReadonlyApiAccessToken(params.teacherWorkspaceEmail);
  const res = await meetFetch(`${MEET_API}/${params.conferenceRecordName}/participants`, token, { method: "GET" });
  const data = (await res.json()) as {
    participants?: Array<{
      name: string;
      signedinUser?: { user?: string };
      earliestStartTime?: string;
      latestEndTime?: string;
    }>;
  };
  const events: MeetParticipantEvent[] = [];
  for (const p of data.participants ?? []) {
    if (p.earliestStartTime) {
      events.push({ participantId: p.name, profileId: p.signedinUser?.user ?? null, eventType: "joined", occurredAt: p.earliestStartTime });
    }
    if (p.latestEndTime) {
      events.push({ participantId: p.name, profileId: p.signedinUser?.user ?? null, eventType: "left", occurredAt: p.latestEndTime });
    }
  }
  return events;
}

/**
 * M1/R6 공통(2026-09-03) — Workspace Events 구독 장애·이벤트 유실 대비 사후 대조.
 * meetingCode의 최근 conference record를 조회해 그 record에 연결된 Smart Notes
 * 문서의 Drive file ID를 찾는다. 구독이 끊긴 동안 웹훅으로 못 받은 Smart Notes를
 * 관리자 재처리(reconcileMissedSmartNotesEvents)가 이 함수로 다시 찾아낼 수 있게
 * 한다. **최선 추정**: `conferenceRecords.list`가 space 이름으로 필터링 가능하고,
 * 각 record 아래 `smartNotes` 서브 리소스가 있다고 가정했다(기존
 * fetchSmartNoteDriveFileId가 이미 전제하는 스키마와 동일 계열) — 실제 Sandbox
 * 검증 전까지는 정확한 응답 구조가 다를 수 있다.
 */
export async function findRecentSmartNoteForMeetingCode(params: {
  teacherWorkspaceEmail: string;
  meetingCode: string;
}): Promise<{ smartNoteResourceName: string; driveFileId: string | null } | null> {
  assertRealCallsAllowed();
  const readonlyToken = await getMeetReadonlyApiAccessToken(params.teacherWorkspaceEmail);

  const spaceRes = await meetFetch(`${MEET_API}/spaces/${params.meetingCode}`, readonlyToken, { method: "GET" });
  const space = (await spaceRes.json()) as SpaceResource;
  if (!space.name) return null;

  const listRes = await meetFetch(
    `${MEET_API}/conferenceRecords?filter=${encodeURIComponent(`space.name="${space.name}"`)}`,
    readonlyToken,
    { method: "GET" }
  );
  const listData = (await listRes.json()) as { conferenceRecords?: Array<{ name: string; startTime?: string }> };
  const records = (listData.conferenceRecords ?? []).sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? ""));
  const mostRecent = records[0];
  if (!mostRecent) return null;

  const smartNotesRes = await meetFetch(`${MEET_API}/${mostRecent.name}/smartNotes`, readonlyToken, { method: "GET" });
  const smartNotesData = (await smartNotesRes.json()) as { smartNotes?: Array<{ name: string }> };
  const smartNote = smartNotesData.smartNotes?.[0];
  if (!smartNote) return null;

  let driveFileId: string | null = null;
  try {
    driveFileId = await fetchSmartNoteDriveFileId({
      teacherWorkspaceEmail: params.teacherWorkspaceEmail,
      smartNoteResourceName: smartNote.name,
    });
  } catch {
    driveFileId = null; // 원본이 아직 생성 중일 수 있음 — 식별자만이라도 반환해 다음 재처리에서 재시도
  }
  return { smartNoteResourceName: smartNote.name, driveFileId };
}
