import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const contractMaybeSingleMock = vi.fn();
const contractUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const studentUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const fromMock = vi.fn((table: string) => {
  if (table === "contracts") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: contractMaybeSingleMock }) }),
      update: () => ({ eq: contractUpdateEqMock }),
    };
  }
  if (table === "students") {
    return { update: () => ({ eq: studentUpdateEqMock }) };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

describe("POST /api/webhooks/docusign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contractMaybeSingleMock.mockResolvedValue({ data: { id: "ct1", student_id: "s1" } });
    contractUpdateEqMock.mockResolvedValue({ error: null });
    studentUpdateEqMock.mockResolvedValue({ error: null });
    process.env.DOCUSIGN_WEBHOOK_TOKEN = "test-token";
  });

  afterEach(() => {
    delete process.env.DOCUSIGN_WEBHOOK_TOKEN;
  });

  it("envelope-completed 이벤트를 받으면 계약과 학생 상태를 갱신한다", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign?token=test-token", {
      method: "POST",
      body: JSON.stringify({
        event: "envelope-completed",
        data: { envelopeId: "env-1" },
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractUpdateEqMock).toHaveBeenCalledWith("id", "ct1");
    expect(studentUpdateEqMock).toHaveBeenCalledWith("id", "s1");
  });

  it("envelope-completed가 아닌 이벤트는 무시한다", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign?token=test-token", {
      method: "POST",
      body: JSON.stringify({ event: "envelope-sent", data: {} }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractUpdateEqMock).not.toHaveBeenCalled();
  });

  it("모르는 envelopeId면 무시하고 200을 반환한다", async () => {
    contractMaybeSingleMock.mockResolvedValue({ data: null });
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign?token=test-token", {
      method: "POST",
      body: JSON.stringify({ event: "envelope-completed", data: { envelopeId: "unknown" } }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractUpdateEqMock).not.toHaveBeenCalled();
  });

  it("토큰이 설정돼 있는데 쿼리스트링 토큰이 틀리면 401을 반환한다", async () => {
    process.env.DOCUSIGN_WEBHOOK_TOKEN = "secret123";
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign?token=wrong", {
      method: "POST",
      body: JSON.stringify({ event: "envelope-completed", data: { envelopeId: "env-1" } }),
    });

    const res = await POST(request);
    expect(res.status).toBe(401);
    expect(contractUpdateEqMock).not.toHaveBeenCalled();
  });

  it("토큰이 설정돼 있고 쿼리스트링 토큰이 맞으면 통과한다", async () => {
    process.env.DOCUSIGN_WEBHOOK_TOKEN = "secret123";
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign?token=secret123", {
      method: "POST",
      body: JSON.stringify({ event: "envelope-completed", data: { envelopeId: "env-1" } }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractUpdateEqMock).toHaveBeenCalled();
  });

  it("토큰이 설정되어 있는데 쿼리스트링에 토큰이 없으면 401을 반환한다", async () => {
    process.env.DOCUSIGN_WEBHOOK_TOKEN = "secret123";
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign", {
      method: "POST",
      body: JSON.stringify({ event: "envelope-completed", data: { envelopeId: "env-1" } }),
    });

    const res = await POST(request);
    expect(res.status).toBe(401);
    expect(contractUpdateEqMock).not.toHaveBeenCalled();
  });

  it("환경변수가 설정되지 않았으면 토큰 없이 요청해도 401을 반환한다(fail-closed)", async () => {
    delete process.env.DOCUSIGN_WEBHOOK_TOKEN;
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/webhooks/docusign", {
      method: "POST",
      body: JSON.stringify({ event: "envelope-completed", data: { envelopeId: "env-1" } }),
    });

    const res = await POST(request);
    expect(res.status).toBe(401);
    expect(contractUpdateEqMock).not.toHaveBeenCalled();
  });
});
