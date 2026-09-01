import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const receiptMaybeSingleMock = vi.fn();
const receiptInsertMock = vi.fn().mockResolvedValue({ error: null });
const receiptUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const contractVersionMaybeSingleMock = vi.fn();
const contractVersionUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const contractUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const driveArtifactsInsertMock = vi.fn().mockResolvedValue({ error: null });

const fromMock = vi.fn((table: string) => {
  if (table === "external_event_receipts") {
    return {
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: receiptMaybeSingleMock }) }),
      }),
      insert: receiptInsertMock,
      update: () => ({ eq: () => ({ eq: receiptUpdateEqMock }) }),
    };
  }
  if (table === "contract_versions") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: contractVersionMaybeSingleMock }) }),
      update: () => ({ eq: contractVersionUpdateEqMock }),
    };
  }
  if (table === "contracts") {
    return {
      update: () => ({ eq: contractUpdateEqMock }),
    };
  }
  if (table === "drive_artifacts") {
    return { insert: driveArtifactsInsertMock };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

function makeRequest(body: unknown, secret: string | null, useWrongSignature = false) {
  const rawBody = JSON.stringify(body);
  const headers: Record<string, string> = {};
  if (secret !== null) {
    headers["X-DocuSign-Signature-1"] = useWrongSignature ? "wrong" : sign(rawBody, secret);
  }
  return new Request("http://localhost/api/webhooks/docusign", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/webhooks/docusign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DOCUSIGN_WEBHOOK_TOKEN = "secret123";
    receiptMaybeSingleMock.mockResolvedValue({ data: null });
    receiptInsertMock.mockResolvedValue({ error: null });
    receiptUpdateEqMock.mockResolvedValue({ error: null });
    contractVersionMaybeSingleMock.mockResolvedValue({ data: { id: "cv1", contract_id: "ct1" } });
    contractVersionUpdateEqMock.mockResolvedValue({ error: null });
    contractUpdateEqMock.mockResolvedValue({ error: null });
    driveArtifactsInsertMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    delete process.env.DOCUSIGN_WEBHOOK_TOKEN;
  });

  it("서명이 없으면 401을 반환한다(fail-closed)", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({ event: "envelope-completed", data: { envelopeId: "env-1" } }, null);

    const res = await POST(request);
    expect(res.status).toBe(401);
    expect(contractVersionUpdateEqMock).not.toHaveBeenCalled();
  });

  it("서명이 틀리면 401을 반환한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest(
      { event: "envelope-completed", data: { envelopeId: "env-1" } },
      "secret123",
      true
    );

    const res = await POST(request);
    expect(res.status).toBe(401);
  });

  it("DOCUSIGN_WEBHOOK_TOKEN이 설정되지 않았으면 어떤 서명이 와도 401을 반환한다(fail-closed)", async () => {
    delete process.env.DOCUSIGN_WEBHOOK_TOKEN;
    const { POST } = await import("./route");
    const request = makeRequest(
      { event: "envelope-completed", data: { envelopeId: "env-1" } },
      "secret123" // 공격자가 어떤 secret으로 서명을 만들어도 서버는 검증할 secret이 없다
    );

    const res = await POST(request);
    expect(res.status).toBe(401);
    expect(contractVersionUpdateEqMock).not.toHaveBeenCalled();
  });

  it("올바른 서명 + envelope-completed면 contract_versions를 갱신하고 drive_artifacts를 큐잉한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest(
      { event: "envelope-completed", data: { envelopeId: "env-1" } },
      "secret123"
    );

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractVersionUpdateEqMock).toHaveBeenCalledWith("id", "cv1");
    expect(driveArtifactsInsertMock).toHaveBeenCalled();
    expect(receiptInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "docusign", event_id: "env-1:envelope-completed" })
    );
  });

  it("이미 처리된 이벤트(processed_at 존재)면 재처리하지 않고 200을 반환한다", async () => {
    receiptMaybeSingleMock.mockResolvedValue({
      data: { id: "r1", processed_at: "2026-09-01T00:00:00Z" },
    });
    const { POST } = await import("./route");
    const request = makeRequest(
      { event: "envelope-completed", data: { envelopeId: "env-1" } },
      "secret123"
    );

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractVersionUpdateEqMock).not.toHaveBeenCalled();
    expect(driveArtifactsInsertMock).not.toHaveBeenCalled();
  });

  it("모르는 envelopeId면 무시하고 200을 반환한다", async () => {
    contractVersionMaybeSingleMock.mockResolvedValue({ data: null });
    const { POST } = await import("./route");
    const request = makeRequest(
      { event: "envelope-completed", data: { envelopeId: "unknown" } },
      "secret123"
    );

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractVersionUpdateEqMock).not.toHaveBeenCalled();
  });

  it("envelopeId가 없으면 400을 반환한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({ event: "envelope-completed", data: {} }, "secret123");

    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("envelope-sent 이벤트는 contract_versions.docusign_envelope_status를 sent로 갱신한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({ event: "envelope-sent", data: { envelopeId: "env-1" } }, "secret123");

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractVersionUpdateEqMock).toHaveBeenCalledWith("id", "cv1");
    expect(driveArtifactsInsertMock).not.toHaveBeenCalled();
  });

  it("envelope-declined 이벤트는 contract_versions를 declined로 남기고 contracts를 void로 종료한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({ event: "envelope-declined", data: { envelopeId: "env-1" } }, "secret123");

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractVersionUpdateEqMock).toHaveBeenCalledWith("id", "cv1");
    expect(contractUpdateEqMock).toHaveBeenCalledWith("id", "ct1");
  });

  it("envelope-completed 이벤트는 계약을 결제 가능 상태(active)로 전환한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest({ event: "envelope-completed", data: { envelopeId: "env-1" } }, "secret123");

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractUpdateEqMock).toHaveBeenCalledWith("id", "ct1");
  });

  it("declineReason이 payload에 있으면 contracts.void_reason에 저장한다", async () => {
    const { POST } = await import("./route");
    const request = makeRequest(
      {
        event: "envelope-declined",
        data: {
          envelopeId: "env-1",
          envelopeSummary: { recipients: { signers: [{ declineReason: "학부모가 조건 재협상을 원함" }] } },
        },
      },
      "secret123"
    );

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractUpdateEqMock).toHaveBeenCalledWith("id", "ct1");
  });

  it("이미 completed로 최종 처리된 뒤 뒤늦게 도착한 sent 이벤트는 상태를 되돌리지 않는다(순서 역전 방어)", async () => {
    contractVersionMaybeSingleMock.mockResolvedValue({
      data: { id: "cv1", contract_id: "ct1", docusign_envelope_status: "completed" },
    });
    const { POST } = await import("./route");
    const request = makeRequest({ event: "envelope-sent", data: { envelopeId: "env-1" } }, "secret123");

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractVersionUpdateEqMock).not.toHaveBeenCalled();
    expect(contractUpdateEqMock).not.toHaveBeenCalled();
  });

  it("이미 declined로 최종 처리된 뒤 뒤늦게 도착한 delivered 이벤트는 무시한다", async () => {
    contractVersionMaybeSingleMock.mockResolvedValue({
      data: { id: "cv1", contract_id: "ct1", docusign_envelope_status: "declined" },
    });
    const { POST } = await import("./route");
    const request = makeRequest({ event: "envelope-delivered", data: { envelopeId: "env-1" } }, "secret123");

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(contractVersionUpdateEqMock).not.toHaveBeenCalled();
  });
});
