import { beforeEach, describe, expect, it, vi } from "vitest";

// M1/R6 공통 blocker 정정(2026-09-03) — pubsubTopic 형식 검증(fail-closed)과 targetResource
// 구성을 클라이언트 계층에서 직접 검증한다(lifecycle 오케스트레이션과 별개로 이 파일 자체의
// 계약을 고정).

const getMeetReadonlyApiAccessTokenMock = vi.fn().mockResolvedValue("token");
vi.mock("@/lib/google-workspace-auth", () => ({
  getMeetReadonlyApiAccessToken: (email: string) => getMeetReadonlyApiAccessTokenMock(email),
}));

const VALID_TOPIC = "projects/alton-integration-sandbox/topics/workspace-events";

function allowRealCalls() {
  process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS = "true";
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  delete process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS;
});

describe("createWorkspaceEventsSubscription — pubsubTopic 검증(fail-closed)", () => {
  it("웹훅 HTTP URL을 pubsubTopic으로 넘기면 실제 API를 호출하기 전에 거부한다", async () => {
    allowRealCalls();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { createWorkspaceEventsSubscription } = await import("./google-workspace-events-subscriptions");

    await expect(
      createWorkspaceEventsSubscription({
        organizerEmail: "official@alton.education",
        organizerWorkspaceUserId: "108123456789012345678",
        pubsubTopic: "http://localhost:3010/api/webhooks/workspace-events",
      })
    ).rejects.toThrow(/projects\/\{project\}\/topics\/\{topic\}/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pubsubTopic이 없으면(빈 값) 실제 API를 호출하기 전에 거부한다", async () => {
    allowRealCalls();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { createWorkspaceEventsSubscription } = await import("./google-workspace-events-subscriptions");

    await expect(
      createWorkspaceEventsSubscription({
        organizerEmail: "official@alton.education",
        organizerWorkspaceUserId: "108123456789012345678",
        // @ts-expect-error 의도적으로 누락 테스트
        pubsubTopic: undefined,
      })
    ).rejects.toThrow("WORKSPACE_EVENTS_PUBSUB_TOPIC");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("유효한 projects/{project}/topics/{topic} 형식이면 targetResource에 cloudidentity 사용자 ID를 쓰고 실제 호출을 진행한다", async () => {
    allowRealCalls();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: "subscriptions/sub-1", targetResource: "//cloudidentity.googleapis.com/users/108123456789012345678", state: "ACTIVE", expireTime: "2026-10-08T00:00:00Z" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { createWorkspaceEventsSubscription } = await import("./google-workspace-events-subscriptions");

    const result = await createWorkspaceEventsSubscription({
      organizerEmail: "official@alton.education",
      organizerWorkspaceUserId: "108123456789012345678",
      pubsubTopic: VALID_TOPIC,
    });

    expect(result.name).toBe("subscriptions/sub-1");
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.targetResource).toBe("//cloudidentity.googleapis.com/users/108123456789012345678");
    expect(body.targetResource).not.toContain("official@alton.education"); // 이메일을 리소스 이름에 쓰지 않음
    expect(body.notificationEndpoint.pubsubTopic).toBe(VALID_TOPIC);
    expect(body.payloadOptions).toEqual({ includeResource: false });
  });

  it("CALENDAR_SYNC_ALLOW_REAL_CALLS가 true가 아니면(토픽이 유효해도) 실제 호출 없이 실패한다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { createWorkspaceEventsSubscription } = await import("./google-workspace-events-subscriptions");

    await expect(
      createWorkspaceEventsSubscription({
        organizerEmail: "official@alton.education",
        organizerWorkspaceUserId: "108123456789012345678",
        pubsubTopic: VALID_TOPIC,
      })
    ).rejects.toThrow("not implemented");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
