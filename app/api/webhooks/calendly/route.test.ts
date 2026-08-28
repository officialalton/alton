import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

describe("POST /api/webhooks/calendly", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    insertMock.mockClear();
    fromMock.mockClear();
    process.env = { ...originalEnv };
    delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("서명 키가 없으면(로컬 개발) 검증을 생략하고 invitee.created를 처리한다", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/calendly", {
      method: "POST",
      body: JSON.stringify({
        event: "invitee.created",
        payload: {
          email: "parent@example.com",
          name: "김민지",
          questions_and_answers: [{ question: "고민", answer: "SAT Math 점수" }],
          scheduled_event: {
            uri: "https://api.calendly.com/scheduled_events/abc",
            start_time: "2026-09-01T10:00:00.000Z",
          },
        },
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("consult_requests");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        person_name: "김민지",
        email: "parent@example.com",
        status: "confirmed",
        scheduled_at: "2026-09-01T10:00:00.000Z",
        calendly_event_uri: "https://api.calendly.com/scheduled_events/abc",
      })
    );
  });

  it("학년/연락처 질문은 각 컬럼에, 나머지는 concerns에 담는다", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/calendly", {
      method: "POST",
      body: JSON.stringify({
        event: "invitee.created",
        payload: {
          email: "parent3@example.com",
          name: "최유진",
          questions_and_answers: [
            { question: "학생 학년이 어떻게 되나요?", answer: "10학년" },
            { question: "연락처를 남겨주세요", answer: "010-1234-5678" },
            { question: "고민이 있다면 알려주세요", answer: "AP Chemistry 튜터링" },
          ],
          scheduled_event: {
            uri: "https://api.calendly.com/scheduled_events/xyz",
            start_time: "2026-09-03T10:00:00.000Z",
          },
        },
      }),
    });

    await POST(request);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        student_grade: "10학년",
        phone: "010-1234-5678",
        concerns: "고민이 있다면 알려주세요: AP Chemistry 튜터링",
      })
    );
  });

  it("invitee.created가 아닌 이벤트는 무시한다", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/calendly", {
      method: "POST",
      body: JSON.stringify({ event: "invitee.canceled", payload: {} }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("서명 키가 설정돼 있는데 서명이 없으면 401을 반환한다", async () => {
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = "test-signing-key";
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/calendly", {
      method: "POST",
      body: JSON.stringify({ event: "invitee.created", payload: {} }),
    });

    const res = await POST(request);
    expect(res.status).toBe(401);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("서명 키가 설정돼 있고 서명이 올바르면 통과한다", async () => {
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = "test-signing-key";
    const { createHmac } = await import("crypto");
    const { POST } = await import("./route");

    const body = JSON.stringify({
      event: "invitee.created",
      payload: {
        email: "parent2@example.com",
        name: "이도현",
        scheduled_event: { uri: "https://api.calendly.com/scheduled_events/def", start_time: "2026-09-02T10:00:00.000Z" },
      },
    });
    const t = "1700000000";
    const signature = createHmac("sha256", "test-signing-key").update(`${t}.${body}`).digest("hex");

    const request = new Request("http://localhost/api/webhooks/calendly", {
      method: "POST",
      headers: { "Calendly-Webhook-Signature": `t=${t},v1=${signature}` },
      body,
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(insertMock).toHaveBeenCalled();
  });
});
