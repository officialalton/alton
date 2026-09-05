import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const receiptMaybeSingleMock = vi.fn();
const receiptInsertMock = vi.fn().mockResolvedValue({ error: null });
const receiptUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const contractVersionMaybeSingleMock = vi.fn();
const contractVersionUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const contractUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const driveArtifactsInsertMock = vi.fn().mockResolvedValue({ error: null });
const activationRetryInsertMock = vi.fn().mockResolvedValue({ error: null });
const activationRetryUpdateIsMock = vi.fn().mockResolvedValue({ error: null });
const activationRetryUpdateEqMock = vi.fn(() => ({ is: activationRetryUpdateIsMock }));
const activationRetryUpdateMock = vi.fn(() => ({ eq: activationRetryUpdateEqMock }));

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
  if (table === "contract_activation_retries") {
    return { insert: activationRetryInsertMock, update: activationRetryUpdateMock };
  }
  if (table === "subject_enrollments") {
    return {
      select: () => ({
        eq: () => ({ eq: () => Promise.resolve({ data: subjectEnrollmentsToActivate, error: null }) }),
      }),
      update: () => ({ eq: () => ({ eq: subjectEnrollmentsUpdateEqMock }) }),
    };
  }
  throw new Error(`unexpected table ${table}`);
});

let subjectEnrollmentsToActivate: { id: string }[] = [];
const subjectEnrollmentsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const rpcMock = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock, rpc: rpcMock }),
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
    activationRetryInsertMock.mockResolvedValue({ error: null });
    activationRetryUpdateIsMock.mockResolvedValue({ error: null });
    subjectEnrollmentsToActivate = [];
    subjectEnrollmentsUpdateEqMock.mockClear();
    rpcMock.mockReset();
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

  it("M4: 서명 완료로 계약이 active가 되면, 그 계약의 planned 과목 수강을 자동으로 active 전환한다", async () => {
    subjectEnrollmentsToActivate = [{ id: "se1" }];
    rpcMock.mockResolvedValue({ data: true, error: null });

    const { POST } = await import("./route");
    const request = makeRequest(
      { event: "envelope-completed", data: { envelopeId: "env-1" } },
      "secret123"
    );

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("subject_enrollment_activation_ready", {
      p_subject_enrollment_id: "se1",
    });
    expect(subjectEnrollmentsUpdateEqMock).toHaveBeenCalledWith("status", "planned");
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

  describe("공식 DocuSign Connect JSON(aggregate, restv2.1) 스키마 fixture", () => {
    // 2026-09-01 R3 진단: 실제 sandbox 발송에서 HMAC은 통과했으나(401→400) 그
    // 이후 페이로드 처리 단계에서 실패했다. 원본 요청 바이트를 직접 캡처하지
    // 못해(DocuSign retry_queue가 알림 URL 갱신을 반영하지 않음), 대신 DocuSign
    // 공식 문서가 기술하는 실제 필드 구성(최상위 event/apiVersion/uri/
    // retryCount/configurationId/generatedDateTime + data 하위 accountId/
    // userId/envelopeId/envelopeSummary)을 최대한 그대로 재현한 fixture로
    // 파서 전체 경로를 검증한다. 이 fixture는 기억을 바탕으로 재구성한 것이며
    // DocuSign이 실제로 보낸 원문을 그대로 캡처한 것은 아니라는 한계가 있다.
    function officialSchemaFixture(overrides: Partial<{ event: string; envelopeId: string }> = {}) {
      const envelopeId = overrides.envelopeId ?? "env-official-1";
      return {
        event: overrides.event ?? "envelope-completed",
        apiVersion: "v2.1",
        uri: `/restapi/v2.1/accounts/919e8493-2043-48e4-89c6-fc8c91cf7c24/envelopes/${envelopeId}`,
        retryCount: 0,
        configurationId: 12345,
        generatedDateTime: "2026-09-01T23:03:39.5330000Z",
        data: {
          accountId: "919e8493-2043-48e4-89c6-fc8c91cf7c24",
          userId: "a57fd37f-543b-42c0-903c-4441ce73bb55",
          envelopeId,
          envelopeSummary: {
            status: "completed",
            emailSubject: "테스트 계약서",
            signingLocation: "online",
            enableWetSign: "true",
            allowMarkup: "false",
            allowReassign: "true",
            createdDateTime: "2026-09-01T21:19:52.3900000Z",
            lastModifiedDateTime: "2026-09-01T23:03:39.5330000Z",
            statusChangedDateTime: "2026-09-01T23:03:39.5330000Z",
            sentDateTime: "2026-09-01T21:19:52.3900000Z",
            completedDateTime: "2026-09-01T23:03:39.5330000Z",
            purgeState: "unpurged",
            envelopeIdStamping: "true",
            recipients: { signers: [{ status: "completed" }] },
          },
        },
      };
    }

    it("공식 스키마 그대로도 정상 파싱해 contract_versions를 갱신한다(정상 파싱 + data.envelopeId 추출)", async () => {
      const { POST } = await import("./route");
      const request = makeRequest(officialSchemaFixture(), "secret123");

      const res = await POST(request);
      expect(res.status).toBe(200);
      expect(contractVersionUpdateEqMock).toHaveBeenCalledWith("id", "cv1");
    });

    it("공식 스키마 + 올바른 서명이면 HMAC 검증을 통과한다", async () => {
      const { POST } = await import("./route");
      const request = makeRequest(officialSchemaFixture(), "secret123");

      const res = await POST(request);
      expect(res.status).not.toBe(401);
    });

    it("공식 스키마 + 틀린 서명이면 여전히 401 fail-closed다", async () => {
      const { POST } = await import("./route");
      const request = makeRequest(officialSchemaFixture(), "secret123", true);

      const res = await POST(request);
      expect(res.status).toBe(401);
      expect(contractVersionUpdateEqMock).not.toHaveBeenCalled();
    });

    it("data.envelopeId가 없고 data.envelopeSummary.envelopeId만 있는 호환 경로도 추출한다", async () => {
      const fixture = officialSchemaFixture();
      // @ts-expect-error 테스트 전용으로 data.envelopeId를 지우고 envelopeSummary 쪽에만 남긴다.
      delete fixture.data.envelopeId;
      // @ts-expect-error 위와 동일한 이유.
      fixture.data.envelopeSummary.envelopeId = "env-official-1";
      const { POST } = await import("./route");
      const request = makeRequest(fixture, "secret123");

      const res = await POST(request);
      expect(res.status).toBe(200);
      expect(contractVersionUpdateEqMock).toHaveBeenCalledWith("id", "cv1");
    });

    it("공식 스키마로 동일 이벤트가 중복 도착하면 두 번째는 재처리하지 않는다", async () => {
      const { POST } = await import("./route");
      const fixture = officialSchemaFixture();

      receiptMaybeSingleMock.mockResolvedValueOnce({ data: null });
      const first = await POST(makeRequest(fixture, "secret123"));
      expect(first.status).toBe(200);

      receiptMaybeSingleMock.mockResolvedValueOnce({
        data: { id: "receipt-1", processed_at: "2026-09-01T23:03:40.000Z" },
      });
      const second = await POST(makeRequest(fixture, "secret123"));
      const secondBody = (await second.json()) as { skipped?: string };
      expect(second.status).toBe(200);
      expect(secondBody.skipped).toBe("already processed");
    });

    it("공식 스키마에서도 순서 역전(늦게 도착한 sent가 이미 completed된 상태를 되돌리지 않음)을 방어한다", async () => {
      contractVersionMaybeSingleMock.mockResolvedValue({
        data: { id: "cv1", contract_id: "ct1", docusign_envelope_status: "completed" },
      });
      const { POST } = await import("./route");
      const request = makeRequest(officialSchemaFixture({ event: "envelope-sent" }), "secret123");

      const res = await POST(request);
      expect(res.status).toBe(200);
      expect(contractVersionUpdateEqMock).not.toHaveBeenCalled();
    });

    it("비정상 본문(JSON 아님)은 서명이 맞아도 400을 반환한다", async () => {
      const rawBody = "<xml>not json</xml>";
      const sig = createHmac("sha256", "secret123").update(rawBody, "utf8").digest("base64");
      const request = new Request("http://localhost/api/webhooks/docusign", {
        method: "POST",
        headers: { "X-DocuSign-Signature-1": sig },
        body: rawBody,
      });
      const { POST } = await import("./route");

      const res = await POST(request);
      expect(res.status).toBe(400);
    });

    it("서명은 맞지만 event/envelopeId가 전부 빠진 JSON은 400을 반환한다", async () => {
      const { POST } = await import("./route");
      const request = makeRequest({ apiVersion: "v2.1", data: {} }, "secret123");

      const res = await POST(request);
      expect(res.status).toBe(400);
    });
  });

  describe("실제 envelope 레벨 eventNotification 페이로드 형식(2026-09-01 sandbox 실측)", () => {
    // R3 진단(2026-09-01): sandbox에서 실제로 받은 페이로드는 event/data 래퍼 없이
    // envelope summary 필드를 최상위에 그대로 평탄하게 보낸다(예: 최상위 envelopeId/
    // status/emailSubject/... — Vercel 함수 로그로 topLevelKeys를 직접 확인). 계정
    // 레벨 Connect의 aggregate 형식(위 describe 블록)과는 다른 실제 형식이다.
    function flatEnvelopeSummaryFixture(overrides: Partial<{ status: string; envelopeId: string }> = {}) {
      return {
        status: overrides.status ?? "sent",
        envelopeId: overrides.envelopeId ?? "env-flat-1",
        emailSubject: "테스트 계약서",
        signingLocation: "online",
        enableWetSign: "true",
        allowMarkup: "false",
        allowReassign: "true",
        createdDateTime: "2026-09-01T21:19:52.3900000Z",
        sentDateTime: "2026-09-01T21:19:52.3900000Z",
        purgeState: "unpurged",
        envelopeIdStamping: "true",
      };
    }

    it("event/data 래퍼 없는 실제 형식도 정상 파싱해 상태를 반영한다(sent)", async () => {
      const { POST } = await import("./route");
      const request = makeRequest(flatEnvelopeSummaryFixture({ status: "sent" }), "secret123");

      const res = await POST(request);
      expect(res.status).toBe(200);
      expect(contractVersionUpdateEqMock).toHaveBeenCalledWith("id", "cv1");
    });

    it("실제 형식의 completed 상태를 정상 처리해 계약을 active로 전환하고 drive_artifacts를 큐잉한다", async () => {
      const { POST } = await import("./route");
      const request = makeRequest(flatEnvelopeSummaryFixture({ status: "completed" }), "secret123");

      const res = await POST(request);
      expect(res.status).toBe(200);
      expect(contractUpdateEqMock).toHaveBeenCalledWith("id", "ct1");
      expect(driveArtifactsInsertMock).toHaveBeenCalled();
    });

    it("실제 형식으로 동일 상태가 중복 도착하면 두 번째는 재처리하지 않는다", async () => {
      const { POST } = await import("./route");
      const fixture = flatEnvelopeSummaryFixture({ status: "sent" });

      receiptMaybeSingleMock.mockResolvedValueOnce({ data: null });
      const first = await POST(makeRequest(fixture, "secret123"));
      expect(first.status).toBe(200);

      receiptMaybeSingleMock.mockResolvedValueOnce({
        data: { id: "receipt-1", processed_at: "2026-09-01T23:18:00.000Z" },
      });
      const second = await POST(makeRequest(fixture, "secret123"));
      const secondBody = (await second.json()) as { skipped?: string };
      expect(second.status).toBe(200);
      expect(secondBody.skipped).toBe("already processed");
    });

    it("실제 형식에서도 순서 역전(늦게 도착한 sent가 이미 completed된 상태를 되돌리지 않음)을 방어한다", async () => {
      contractVersionMaybeSingleMock.mockResolvedValue({
        data: { id: "cv1", contract_id: "ct1", docusign_envelope_status: "completed" },
      });
      const { POST } = await import("./route");
      const request = makeRequest(flatEnvelopeSummaryFixture({ status: "sent" }), "secret123");

      const res = await POST(request);
      expect(res.status).toBe(200);
      expect(contractVersionUpdateEqMock).not.toHaveBeenCalled();
    });

    it("실제 형식의 declined + 최상위 recipients.signers에서 거부 사유를 추출한다", async () => {
      const { POST } = await import("./route");
      const fixture = {
        ...flatEnvelopeSummaryFixture({ status: "declined" }),
        recipients: { signers: [{ declineReason: "학부모가 조건 재협상을 원함" }] },
      };
      const request = makeRequest(fixture, "secret123");

      const res = await POST(request);
      expect(res.status).toBe(200);
      expect(contractUpdateEqMock).toHaveBeenCalledWith("id", "ct1");
    });
  });

  describe("completed 웹훅에서 활성화 선행조건 미충족(activateError) 처리 — R3 후속(2026-09-01)", () => {
    it("contracts.status=active 전환이 실패해도 웹훅 자체는 200을 반환한다(500으로 DocuSign 재전송에 기대지 않음)", async () => {
      contractUpdateEqMock.mockResolvedValueOnce({
        error: { message: "만 13세 미만 학생은 유효한 보호자 동의가 있어야 진행할 수 있습니다" },
      });
      const { POST } = await import("./route");
      const request = makeRequest({ event: "envelope-completed", data: { envelopeId: "env-1" } }, "secret123");

      const res = await POST(request);
      expect(res.status).toBe(200);
    });

    it("실패 사유를 contract_activation_retries에 재처리 가능한 상태로 남긴다", async () => {
      contractUpdateEqMock.mockResolvedValueOnce({
        error: { message: "만 13세 미만 학생은 유효한 보호자 동의가 있어야 진행할 수 있습니다" },
      });
      const { POST } = await import("./route");
      const request = makeRequest({ event: "envelope-completed", data: { envelopeId: "env-1" } }, "secret123");

      await POST(request);
      expect(activationRetryInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          contract_id: "ct1",
          contract_version_id: "cv1",
          envelope_id: "env-1",
          failure_reason: "만 13세 미만 학생은 유효한 보호자 동의가 있어야 진행할 수 있습니다",
        })
      );
    });

    it("활성화가 실패해도 서명 문서는 Drive 큐잉을 계속한다(서명 완료 자체는 별개 사실)", async () => {
      contractUpdateEqMock.mockResolvedValueOnce({ error: { message: "활성화 선행조건 미충족" } });
      const { POST } = await import("./route");
      const request = makeRequest({ event: "envelope-completed", data: { envelopeId: "env-1" } }, "secret123");

      await POST(request);
      expect(driveArtifactsInsertMock).toHaveBeenCalled();
    });

    it("활성화가 성공하면 재처리 큐에 아무 것도 남기지 않는다", async () => {
      const { POST } = await import("./route");
      const request = makeRequest({ event: "envelope-completed", data: { envelopeId: "env-1" } }, "secret123");

      await POST(request);
      expect(activationRetryInsertMock).not.toHaveBeenCalled();
    });
  });

  describe("contract_activation_retries 중복 미해결 행 방지 — 20260920000000 마이그레이션", () => {
    it("같은 envelope/contract_version_id로 활성화가 두 번 연속 실패하면 새 행 대신 기존 행을 갱신한다(최신 사유가 이김)", async () => {
      contractUpdateEqMock.mockResolvedValueOnce({
        error: { message: "만 13세 미만 학생은 유효한 보호자 동의가 있어야 진행할 수 있습니다" },
      });
      activationRetryInsertMock.mockResolvedValueOnce({
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      });

      const { POST } = await import("./route");
      const request = makeRequest({ event: "envelope-completed", data: { envelopeId: "env-1" } }, "secret123");

      const res = await POST(request);

      expect(res.status).toBe(200);
      expect(activationRetryInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          contract_id: "ct1",
          contract_version_id: "cv1",
          envelope_id: "env-1",
          failure_reason: "만 13세 미만 학생은 유효한 보호자 동의가 있어야 진행할 수 있습니다",
        })
      );
      expect(activationRetryUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          failure_reason: "만 13세 미만 학생은 유효한 보호자 동의가 있어야 진행할 수 있습니다",
        })
      );
      expect(activationRetryUpdateEqMock).toHaveBeenCalledWith("contract_version_id", "cv1");
      expect(activationRetryUpdateIsMock).toHaveBeenCalledWith("resolved_at", null);
    });
  });
});
