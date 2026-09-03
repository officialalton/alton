import { getMeetReadonlyApiAccessToken } from "@/lib/google-workspace-auth";

// M1/R6 공통 blocker(2026-09-03) — Workspace Events API `subscriptions` 리소스 클라이언트.
// 기존 웹훅 수신 코드(app/api/webhooks/workspace-events/route.ts)만 있고 구독을 실제로
// 만드는 코드가 없던 공백을 메운다.
//
// **최선 추정으로 표시**: Workspace Events API 공개 문서 기준 subscriptions는 사용자
// 단위(사용자의 특정 리소스 이벤트를 구독)로만 생성 가능하고 도메인 전체를 한 번에
// 구독하는 옵션은 없다 — 이 파일의 요청 형태(targetResource에 Meet space를 지정)는
// 그 문서 이해를 코드로 옮긴 것이며, 실제 Sandbox 검증 전까지는 정확한 스키마가 다를
// 수 있다(R6 lib/google-meet.ts의 canonical name PATCH 사례처럼 실측에서 조정될 수 있음
// — 이번 세션은 mock 검증까지만, 실제 호출은 하지 않는다).
//
// 안전 게이트: 기존 CALENDAR_SYNC_ALLOW_REAL_CALLS를 그대로 재사용한다(이 프로젝트의
// "실제 Google API 호출 허용" 단일 게이트 관례 — Directory/Drive/Calendar/Meet가 이미
// 각자 이 값을 참조).

const WORKSPACE_EVENTS_API = "https://workspaceevents.googleapis.com/v1";
const MEET_EVENT_TYPES = [
  "google.workspace.meet.conference.v2.started",
  "google.workspace.meet.conference.v2.ended",
  "google.workspace.meet.transcript.v2.fileGenerated",
  "google.workspace.meet.smartNote.v2.fileGenerated",
];

function assertRealCallsAllowed(): void {
  if (process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS !== "true") {
    throw new Error(
      "not implemented: CALENDAR_SYNC_ALLOW_REAL_CALLS=true가 아니면 실제 Workspace Events API를 호출하지 않습니다."
    );
  }
}

async function workspaceEventsFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Workspace Events API 요청 실패 (status ${res.status}): ${text.slice(0, 300)}`);
  }
  return res;
}

export type WorkspaceEventsSubscriptionResource = {
  name: string;
  targetResource: string;
  state: string;
  expireTime?: string;
};

/**
 * organizer(상담 관리자 또는 선생님) 명의로 Meet 이벤트 구독을 생성한다. `targetResource`는
 * 조직 위임 subject 계정의 Meet space 전체를 가리키는 형태로 추정했다(`//meet.googleapis.
 * com/workspaces/{organizer}/spaces/-` — 실제 구조는 Sandbox 검증에서 확인 필요, 다르면
 * 이 함수만 수정하면 되도록 다른 lifecycle 로직과 분리했다). resource data는 구독에
 * 포함하지 않는다(요구사항: "resource data는 제외, 현재 Meet API 재조회 방식 유지").
 */
export async function createWorkspaceEventsSubscription(params: {
  organizerEmail: string;
  webhookUrl: string;
  ttlSeconds?: number;
}): Promise<WorkspaceEventsSubscriptionResource> {
  assertRealCallsAllowed();
  const token = await getMeetReadonlyApiAccessToken(params.organizerEmail);
  const res = await workspaceEventsFetch(`${WORKSPACE_EVENTS_API}/subscriptions`, token, {
    method: "POST",
    body: JSON.stringify({
      targetResource: `//meet.googleapis.com/workspaces/${params.organizerEmail}/spaces/-`,
      eventTypes: MEET_EVENT_TYPES,
      notificationEndpoint: { pubsubTopic: params.webhookUrl },
      payloadOptions: { includeResource: false }, // resource data 제외 — 현재 Meet API 재조회 방식 유지
      ttl: params.ttlSeconds ? `${params.ttlSeconds}s` : undefined,
    }),
  });
  return (await res.json()) as WorkspaceEventsSubscriptionResource;
}

export async function getWorkspaceEventsSubscription(params: {
  organizerEmail: string;
  subscriptionName: string;
}): Promise<WorkspaceEventsSubscriptionResource | null> {
  assertRealCallsAllowed();
  const token = await getMeetReadonlyApiAccessToken(params.organizerEmail);
  const res = await fetch(`${WORKSPACE_EVENTS_API}/${params.subscriptionName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Workspace Events 구독 조회 실패 (status ${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as WorkspaceEventsSubscriptionResource;
}

/** 만료 임박 구독을 갱신한다(ttl 연장). Workspace Events API는 patch로 ttl을 다시
 * 지정하는 방식을 지원한다고 추정 — 실측 전까지 최선 추정. */
export async function renewWorkspaceEventsSubscription(params: {
  organizerEmail: string;
  subscriptionName: string;
  ttlSeconds: number;
}): Promise<WorkspaceEventsSubscriptionResource> {
  assertRealCallsAllowed();
  const token = await getMeetReadonlyApiAccessToken(params.organizerEmail);
  const res = await workspaceEventsFetch(
    `${WORKSPACE_EVENTS_API}/${params.subscriptionName}?updateMask=ttl`,
    token,
    { method: "PATCH", body: JSON.stringify({ ttl: `${params.ttlSeconds}s` }) }
  );
  return (await res.json()) as WorkspaceEventsSubscriptionResource;
}

/** 삭제는 멱등 — 이미 없어진(404) 구독도 성공으로 취급한다(R6 deleteCalendarEvent와 동일 원칙). */
export async function deleteWorkspaceEventsSubscription(params: {
  organizerEmail: string;
  subscriptionName: string;
}): Promise<void> {
  assertRealCallsAllowed();
  const token = await getMeetReadonlyApiAccessToken(params.organizerEmail);
  const res = await fetch(`${WORKSPACE_EVENTS_API}/${params.subscriptionName}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Workspace Events 구독 삭제 실패 (status ${res.status}): ${text.slice(0, 300)}`);
  }
}
