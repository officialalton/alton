import { getMeetReadonlyApiAccessToken } from "@/lib/google-workspace-auth";
import {
  isM4PreviewVerificationFlagEnabled,
  getM4PreviewMeetReadonlyAccessToken,
} from "@/lib/google-workspace-preview-verify-auth";

// M4 외부 검증 임시 조치 — google-calendar.ts/google-meet.ts와 동일한 패턴. 플래그가
// 없으면 기존 경로 그대로이므로 Production/로컬 동작은 전혀 바뀌지 않는다.
async function resolveMeetReadonlyAccessToken(organizerEmail: string): Promise<string> {
  return isM4PreviewVerificationFlagEnabled()
    ? getM4PreviewMeetReadonlyAccessToken(organizerEmail)
    : getMeetReadonlyApiAccessToken(organizerEmail);
}

// M1/R6 공통 blocker(2026-09-03, 같은 날 네 번째 후속에서 모델 정정) — Workspace Events
// API `subscriptions` 리소스 클라이언트. 기존 웹훅 수신 코드(app/api/webhooks/workspace-
// events/route.ts)만 있고 구독을 실제로 만드는 코드가 없던 공백을 메운다.
//
// **정정 이력**: 최초 구현은 `//meet.googleapis.com/workspaces/{email}/spaces/-`라는
// 존재하지 않는 리소스 형식과, `notificationEndpoint.pubsubTopic`에 HTTP 웹훅 URL을
// 그대로 넣는 잘못을 저질렀다. 이번 정정:
//   1. target resource는 `//cloudidentity.googleapis.com/users/{USER}` 형식이고
//      `{USER}`는 이메일이 아니라 Directory API가 반환하는 불변 사용자 ID다(호출부가
//      lib/workspace-events/subscription-lifecycle.ts에서 미리 resolve해 넘긴다 —
//      이 파일은 이미 resolve된 ID만 받는다, 이메일을 리소스 이름에 쓰지 않는다).
//   2. `notificationEndpoint.pubsubTopic`은 `projects/{project}/topics/{topic}` 형식의
//      실제 Pub/Sub 토픽 리소스 이름만 허용한다 — 이 함수는 그 형식을 실제 API 호출
//      *전에* 검증하고, 형식이 틀리거나 없으면 즉시 fail-closed로 예외를 던진다. 실제
//      알림이 도착하는 HTTP 엔드포인트(app/api/webhooks/workspace-events)는 그 토픽에
//      별도로 연결하는 Pub/Sub push subscription의 endpoint이지, 이 API 호출과는 다른
//      개념·다른 GCP 리소스다(코드에서도 개념을 분리 — 이 파일은 Pub/Sub 토픽만 다룬다).
//
// 사용자 단위 구독이 실제로 안 되는 것으로 밝혀지면(Sandbox 재검증에서만 확정 가능)
// canonical Meet space 단위 구독으로 전환해야 하는데, 그 판단은 mock으로는 내릴 수
// 없다 — 이 파일은 문서상 최선 추정(사용자 단위)만 구현하고, 실제 여부는 별도 Sandbox
// 재검증(docs/2026-09-03-m1-google-sandbox-verification-request-v2.md)에서 확정한다.
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

// projects/{project}/topics/{topic} — GCP 리소스 이름 형식(공개 문서 기준 고정 패턴).
const PUBSUB_TOPIC_PATTERN = /^projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/topics\/[A-Za-z0-9_.~+%-]{3,255}$/;

function assertRealCallsAllowed(): void {
  if (process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS !== "true") {
    throw new Error(
      "not implemented: CALENDAR_SYNC_ALLOW_REAL_CALLS=true가 아니면 실제 Workspace Events API를 호출하지 않습니다."
    );
  }
}

/**
 * pubsubTopic이 `projects/{project}/topics/{topic}` 형식의 실제 Pub/Sub 토픽 리소스
 * 이름인지 검증한다. 웹훅 HTTP URL이나 빈 값은 여기서 즉시 거부한다(fail-closed) —
 * 형식이 틀린 채로 실제 API를 호출해 애매한 400 에러를 받는 것을 방지한다.
 */
function assertValidPubsubTopic(pubsubTopic: string | undefined): asserts pubsubTopic is string {
  if (!pubsubTopic) {
    throw new Error(
      "WORKSPACE_EVENTS_PUBSUB_TOPIC이 설정되지 않았습니다 — 'projects/{project}/topics/{topic}' 형식의 실제 Pub/Sub 토픽 리소스 이름이 필요합니다."
    );
  }
  if (!PUBSUB_TOPIC_PATTERN.test(pubsubTopic)) {
    throw new Error(
      `WORKSPACE_EVENTS_PUBSUB_TOPIC 형식이 올바르지 않습니다(받은 값: "${pubsubTopic.slice(0, 100)}") — 'projects/{project}/topics/{topic}' 형식이어야 합니다(웹훅 HTTP URL이 아님).`
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
 * organizer(상담 관리자 또는 선생님) 명의로 Meet 이벤트 구독을 생성한다.
 * `organizerWorkspaceUserId`는 이메일이 아니라 Directory API의 불변 사용자 ID여야
 * 한다(호출부가 lib/workspace-events/subscription-lifecycle.ts에서 resolve). resource
 * data는 구독에 포함하지 않는다(요구사항: "resource data는 제외, 현재 Meet API
 * 재조회 방식 유지").
 */
export async function createWorkspaceEventsSubscription(params: {
  organizerEmail: string;
  organizerWorkspaceUserId: string;
  pubsubTopic: string;
  ttlSeconds?: number;
}): Promise<WorkspaceEventsSubscriptionResource> {
  assertValidPubsubTopic(params.pubsubTopic);
  assertRealCallsAllowed();
  const token = await resolveMeetReadonlyAccessToken(params.organizerEmail);
  const res = await workspaceEventsFetch(`${WORKSPACE_EVENTS_API}/subscriptions`, token, {
    method: "POST",
    body: JSON.stringify({
      targetResource: `//cloudidentity.googleapis.com/users/${params.organizerWorkspaceUserId}`,
      eventTypes: MEET_EVENT_TYPES,
      notificationEndpoint: { pubsubTopic: params.pubsubTopic },
      payloadOptions: { includeResource: false }, // resource data 제외 — 현재 Meet API 재조회 방식 유지
      ttl: params.ttlSeconds ? `${params.ttlSeconds}s` : undefined,
    }),
  });
  const operation = (await res.json()) as WorkspaceEventsOperation;
  return awaitOperation(token, operation);
}

type WorkspaceEventsOperation = {
  name: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: WorkspaceEventsSubscriptionResource;
};

/**
 * (2026-09-03 정정, M4 Sandbox 실측으로 발견) `subscriptions.create`는 즉시 최종
 * Subscription을 반환하지 않고 비동기 Operation을 반환한다 — `name`이
 * `operations/{id}` 형식이고, 실제 구독 리소스 이름(`subscriptions/{id}`)은
 * `response.name`에만 있다. 이전 구현은 Operation의 `name`을 그대로 구독
 * 리소스 이름으로 저장해, 이후 조회·갱신·삭제가 전부 존재하지 않는(또는 엉뚱한)
 * 리소스를 대상으로 했다 — 실제로는 항상 조용히 실패하거나 아무 효과가 없었다.
 * 최대 10회(약 10초)까지 짧게 폴링한다 — 문서상 이 생성 오퍼레이션은 보통 즉시
 * 또는 수 초 내 완료된다.
 */
async function awaitOperation(
  token: string,
  operation: WorkspaceEventsOperation,
): Promise<WorkspaceEventsSubscriptionResource> {
  let current = operation;
  for (let attempt = 0; attempt < 10 && !current.done; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const res = await workspaceEventsFetch(`${WORKSPACE_EVENTS_API}/${current.name}`, token, { method: "GET" });
    current = (await res.json()) as WorkspaceEventsOperation;
  }
  if (!current.done) {
    throw new Error("Workspace Events 구독 생성 오퍼레이션이 시간 내에 완료되지 않았습니다.");
  }
  if (current.error) {
    throw new Error(`Workspace Events 구독 생성 오퍼레이션이 실패했습니다: ${current.error.message.slice(0, 300)}`);
  }
  if (!current.response) {
    throw new Error("Workspace Events 구독 생성 오퍼레이션에 결과가 없습니다.");
  }
  return current.response;
}

/** targetResource(예: `//cloudidentity.googleapis.com/users/{id}`) 기준으로 기존
 * 구독을 찾는다 — Google Workspace Events는 사용자당 구독을 최대 1개만 허용해서,
 * 생성 전에 이미 있는 구독을 찾아 정리(삭제 후 재생성)해야 할 때 쓴다. */
export async function listWorkspaceEventsSubscriptionsForTarget(params: {
  organizerEmail: string;
  targetResource: string;
}): Promise<WorkspaceEventsSubscriptionResource[]> {
  assertRealCallsAllowed();
  const token = await resolveMeetReadonlyAccessToken(params.organizerEmail);
  const filter = encodeURIComponent(
    `target_resource="${params.targetResource}" AND event_types:"google.workspace.meet.conference.v2.started"`
  );
  const res = await workspaceEventsFetch(`${WORKSPACE_EVENTS_API}/subscriptions?filter=${filter}`, token, {
    method: "GET",
  });
  const data = (await res.json()) as { subscriptions?: WorkspaceEventsSubscriptionResource[] };
  return data.subscriptions ?? [];
}

export async function getWorkspaceEventsSubscription(params: {
  organizerEmail: string;
  subscriptionName: string;
}): Promise<WorkspaceEventsSubscriptionResource | null> {
  assertRealCallsAllowed();
  const token = await resolveMeetReadonlyAccessToken(params.organizerEmail);
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
  const token = await resolveMeetReadonlyAccessToken(params.organizerEmail);
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
  const token = await resolveMeetReadonlyAccessToken(params.organizerEmail);
  const res = await fetch(`${WORKSPACE_EVENTS_API}/${params.subscriptionName}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Workspace Events 구독 삭제 실패 (status ${res.status}): ${text.slice(0, 300)}`);
  }
}
