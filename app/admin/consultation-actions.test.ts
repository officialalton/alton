import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: {}, actorUserId: "admin1" }),
  requireAdminOrCapability: vi.fn().mockResolvedValue({ supabase: {}, actorUserId: "admin1" }),
}));

const createEnvelopeMock = vi.fn().mockResolvedValue({ envelopeId: "env-1" });
const assertDocusignSandboxBaseUriMock = vi.fn();
const getEnvelopeStatusMock = vi.fn();
vi.mock("@/lib/docusign", () => ({
  createEnvelope: createEnvelopeMock,
  assertDocusignSandboxBaseUri: assertDocusignSandboxBaseUriMock,
  getEnvelopeStatus: getEnvelopeStatusMock,
}));

const uploadArtifactToDriveMock = vi.fn();
const processOneDriveArtifactMock = vi.fn();
vi.mock("@/lib/drive-artifacts", () => ({
  uploadArtifactToDrive: uploadArtifactToDriveMock,
  processOneDriveArtifact: processOneDriveArtifactMock,
  MAX_RETRY_COUNT: 5,
}));

const trialSessionsMaybeSingleMock = vi.fn();
const trialSessionsInsertSingleMock = vi.fn();
const trialSessionsInsertMock = vi.fn();
const consultationsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const householdMembersMaybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
const contractsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const contractVersionsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const contractVersionsSingleMock = vi.fn().mockResolvedValue({
  data: { id: "cv1", contract_id: "ct1", company_signed_at: "2026-09-13T00:00:00Z" },
  error: null,
});

const proposalsInsertSingleMock = vi.fn();
const proposalsSelectSingleMock = vi.fn();
const proposalsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const proposalSubjectsInsertMock = vi.fn().mockResolvedValue({ error: null });

const contractsInsertSingleMock = vi.fn();
const contractsSelectSingleMock = vi.fn();
const contractVersionsInsertSingleMock = vi.fn();
const contractsSelectInMock = vi.fn().mockResolvedValue({ data: [], error: null });
const profilesSelectInMock = vi.fn().mockResolvedValue({ data: [], error: null });

const activationRetriesSingleMock = vi.fn();
const activationRetriesUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const activationRetriesOrderMock = vi.fn();

const contractVersionsSupersedeMock = vi.fn().mockResolvedValue({ error: null });
const contractVersionsLatestMaybeSingleMock = vi.fn();

const driveArtifactsSelectInMock = vi.fn();
const driveArtifactsSelectEqMock = vi.fn().mockResolvedValue({ data: [], error: null });
const driveArtifactsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });

const rpcMock = vi.fn();

const classificationTagsInsertSingleMock = vi.fn();
const classificationTagsUpdateEqMock = vi.fn();
const classificationTagsQueryResultMock = vi.fn();
const consultationTagsInsertMock = vi.fn();
const consultationTagsDeleteEqEqMock = vi.fn();

function classificationTagsQueryBuilder(): PromiseLike<{ data: unknown; error: unknown }> & {
  eq: (...args: unknown[]) => ReturnType<typeof classificationTagsQueryBuilder>;
} {
  const builder = {
    eq: vi.fn(() => builder),
    then: (
      resolve: (v: { data: unknown; error: unknown }) => unknown,
      reject?: (e: unknown) => unknown
    ) => Promise.resolve(classificationTagsQueryResultMock()).then(resolve, reject),
  };
  return builder as unknown as PromiseLike<{ data: unknown; error: unknown }> & {
    eq: (...args: unknown[]) => ReturnType<typeof classificationTagsQueryBuilder>;
  };
}

const fromMock = vi.fn((table: string) => {
  if (table === "trial_sessions") {
    return {
      select: () => ({
        eq: () => ({
          in: () => ({ is: () => ({ maybeSingle: trialSessionsMaybeSingleMock }) }),
        }),
      }),
      insert: (payload: Record<string, unknown>) => {
        trialSessionsInsertMock(payload);
        return { select: () => ({ single: trialSessionsInsertSingleMock }) };
      },
    };
  }
  if (table === "consultations") {
    return { update: () => ({ eq: consultationsUpdateEqMock }) };
  }
  if (table === "household_members") {
    return {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: householdMembersMaybeSingleMock }) }) }),
    };
  }
  if (table === "contracts") {
    return {
      update: () => ({ eq: contractsUpdateEqMock }),
      insert: () => ({ select: () => ({ single: contractsInsertSingleMock }) }),
      select: () => ({ eq: () => ({ single: contractsSelectSingleMock }), in: contractsSelectInMock }),
    };
  }
  if (table === "profiles") {
    return {
      select: () => ({ in: profilesSelectInMock }),
    };
  }
  if (table === "contract_activation_retries") {
    return {
      select: () => ({
        eq: () => ({ single: activationRetriesSingleMock }),
        is: () => ({ order: activationRetriesOrderMock }),
      }),
      update: () => ({ eq: activationRetriesUpdateEqMock }),
    };
  }
  if (table === "contract_versions") {
    return {
      select: () => ({
        eq: () => ({
          single: contractVersionsSingleMock,
          order: () => ({ limit: () => ({ maybeSingle: contractVersionsLatestMaybeSingleMock }) }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        if (payload && "version_status" in payload) {
          return { eq: () => ({ eq: () => ({ neq: contractVersionsSupersedeMock }) }) };
        }
        return { eq: contractVersionsUpdateEqMock };
      },
      insert: () => ({ select: () => ({ single: contractVersionsInsertSingleMock }) }),
    };
  }
  if (table === "drive_artifacts") {
    return {
      select: () => ({ in: driveArtifactsSelectInMock, eq: driveArtifactsSelectEqMock }),
      update: () => ({ eq: driveArtifactsUpdateEqMock }),
    };
  }
  if (table === "proposals") {
    return {
      select: () => ({ eq: () => ({ single: proposalsSelectSingleMock }) }),
      insert: () => ({ select: () => ({ single: proposalsInsertSingleMock }) }),
      update: () => ({ eq: proposalsUpdateEqMock }),
    };
  }
  if (table === "proposal_subjects") {
    return { insert: proposalSubjectsInsertMock };
  }
  if (table === "classification_tags") {
    return {
      insert: () => ({ select: () => ({ single: classificationTagsInsertSingleMock }) }),
      update: () => ({ eq: classificationTagsUpdateEqMock }),
      select: () => ({ order: () => classificationTagsQueryBuilder() }),
    };
  }
  if (table === "consultation_classification_tags") {
    return {
      insert: consultationTagsInsertMock,
      delete: () => ({ eq: () => ({ eq: consultationTagsDeleteEqEqMock }) }),
    };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

describe("createTrialSessionFromConsultation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trialSessionsMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    trialSessionsInsertSingleMock.mockResolvedValue({ data: { id: "trial1" }, error: null });
    consultationsUpdateEqMock.mockResolvedValue({ error: null });
    householdMembersMaybeSingleMock.mockResolvedValue({ data: null, error: null });
  });

  it("이미 진행 중/완료된 체험이 있으면 사용자 친화적 에러로 막는다(예외 승인 없을 때)", async () => {
    trialSessionsMaybeSingleMock.mockResolvedValue({ data: { id: "existing-trial" }, error: null });
    const { createTrialSessionFromConsultation } = await import("./consultation-actions");

    await expect(
      createTrialSessionFromConsultation({
        consultationId: "c1",
        childId: "child1",
        subjectId: "sub1",
        teacherId: "t1",
        scheduledAt: "2026-09-10T10:00:00Z",
      })
    ).rejects.toThrow("이미 진행 중이거나 완료된 체험 세션이 있습니다");

    expect(trialSessionsInsertSingleMock).not.toHaveBeenCalled();
  });

  it("기존 체험이 없으면 정상 생성되고 상담 상태를 trial_planned로 갱신한다", async () => {
    const { createTrialSessionFromConsultation } = await import("./consultation-actions");

    const result = await createTrialSessionFromConsultation({
      consultationId: "c1",
      childId: "child1",
      subjectId: "sub1",
      teacherId: "t1",
      scheduledAt: "2026-09-10T10:00:00Z",
    });

    expect(result.id).toBe("trial1");
    expect(consultationsUpdateEqMock).toHaveBeenCalledWith("id", "c1");
  });

  it("goal(사전 계획)이 주어지면 그대로 저장한다 — result_notes/recommendation(사후 평가)과는 별개 필드", async () => {
    const { createTrialSessionFromConsultation } = await import("./consultation-actions");

    await createTrialSessionFromConsultation({
      consultationId: "c1",
      childId: "child1",
      subjectId: "sub1",
      teacherId: "t1",
      scheduledAt: "2026-09-10T10:00:00Z",
      goal: "영어 독해 수준 진단",
    });

    expect(trialSessionsInsertMock).toHaveBeenCalledWith(expect.objectContaining({ goal: "영어 독해 수준 진단" }));
  });

  it("예외 승인(exceptionApprovedBy)이 있으면 사전 중복 체크를 건너뛰고, 사유가 없으면 막는다", async () => {
    const { createTrialSessionFromConsultation } = await import("./consultation-actions");

    await expect(
      createTrialSessionFromConsultation({
        consultationId: "c1",
        childId: "child1",
        subjectId: "sub1",
        teacherId: "t1",
        scheduledAt: "2026-09-10T10:00:00Z",
        exceptionApprovedBy: "admin1",
      })
    ).rejects.toThrow("사유(exceptionReason)를 함께 입력");

    expect(trialSessionsMaybeSingleMock).not.toHaveBeenCalled();
  });

  it("사전 확인은 통과했지만 DB unique 제약을 위반하면(동시성 경쟁) 같은 친화적 메시지로 감싼다", async () => {
    trialSessionsInsertSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "trial_sessions_one_active_per_child"' },
    });
    const { createTrialSessionFromConsultation } = await import("./consultation-actions");

    await expect(
      createTrialSessionFromConsultation({
        consultationId: "c1",
        childId: "child1",
        subjectId: "sub1",
        teacherId: "t1",
        scheduledAt: "2026-09-10T10:00:00Z",
      })
    ).rejects.toThrow("이미 진행 중이거나 완료된 체험 세션이 있습니다");
  });
});

describe("sendContractForSignature — production base URI guardrail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contractsUpdateEqMock.mockResolvedValue({ error: null });
    contractVersionsUpdateEqMock.mockResolvedValue({ error: null });
    contractVersionsSingleMock.mockResolvedValue({
      data: { id: "cv1", contract_id: "ct1", company_signed_at: "2026-09-13T00:00:00Z" },
      error: null,
    });
  });

  it("assertDocusignSandboxBaseUri가 throw하면 createEnvelope를 호출하지 않고 그대로 전파한다", async () => {
    assertDocusignSandboxBaseUriMock.mockImplementation(() => {
      throw new Error("production으로 보이는 base URI");
    });
    const { sendContractForSignature } = await import("./consultation-actions");

    await expect(
      sendContractForSignature({
        contractVersionId: "cv1",
        recipientEmail: "parent@example.com",
        recipientName: "김민지",
        childName: "지훈",
        webhookUrl: "https://example.com/webhook",
      })
    ).rejects.toThrow("production으로 보이는 base URI");

    expect(createEnvelopeMock).not.toHaveBeenCalled();
    expect(contractVersionsUpdateEqMock).not.toHaveBeenCalled();
  });

  it("sandbox면 정상적으로 봉투를 발송하고 contract_versions를 갱신한다", async () => {
    assertDocusignSandboxBaseUriMock.mockImplementation(() => {});
    const { sendContractForSignature } = await import("./consultation-actions");

    const result = await sendContractForSignature({
      contractVersionId: "cv1",
      recipientEmail: "parent@example.com",
      recipientName: "김민지",
      childName: "지훈",
      webhookUrl: "https://example.com/webhook",
    });

    expect(result.envelopeId).toBe("env-1");
    expect(createEnvelopeMock).toHaveBeenCalled();
    expect(contractVersionsUpdateEqMock).toHaveBeenCalledWith("id", "cv1");
    expect(contractsUpdateEqMock).toHaveBeenCalledWith("id", "ct1");
  });

  it("회사 선서명이 없는 계약 버전은 발송을 거부한다", async () => {
    assertDocusignSandboxBaseUriMock.mockImplementation(() => {});
    contractVersionsSingleMock.mockResolvedValueOnce({
      data: { id: "cv1", contract_id: "ct1", company_signed_at: null },
      error: null,
    });
    const { sendContractForSignature } = await import("./consultation-actions");

    await expect(
      sendContractForSignature({
        contractVersionId: "cv1",
        recipientEmail: "parent@example.com",
        recipientName: "김민지",
        childName: "지훈",
        webhookUrl: "https://example.com/webhook",
      })
    ).rejects.toThrow("회사 선서명");

    expect(createEnvelopeMock).not.toHaveBeenCalled();
  });

  it("발송 성공 시 같은 계약의 다른 active 버전을 superseded로 전이한다(재발송 지원)", async () => {
    assertDocusignSandboxBaseUriMock.mockImplementation(() => {});
    const { sendContractForSignature } = await import("./consultation-actions");

    await sendContractForSignature({
      contractVersionId: "cv1",
      recipientEmail: "parent@example.com",
      recipientName: "김민지",
      childName: "지훈",
      webhookUrl: "https://example.com/webhook",
    });

    expect(contractVersionsSupersedeMock).toHaveBeenCalled();
  });
});

describe("createNewContractVersionForResend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contractVersionsLatestMaybeSingleMock.mockResolvedValue({
      data: { id: "cv1", version_number: 1, price_policy_snapshot: { total: 100 }, proposal_id: "prop1" },
      error: null,
    });
    contractVersionsInsertSingleMock.mockResolvedValue({ data: { id: "cv2" }, error: null });
  });

  it("새 계약 버전을 만들고 company_signed_at을 채우지 않는다(재서명 게이트 유지)", async () => {
    const { createNewContractVersionForResend } = await import("./consultation-actions");

    const result = await createNewContractVersionForResend({ contractId: "ct1" });

    expect(result.contractVersionId).toBe("cv2");
    expect(contractVersionsInsertSingleMock).toHaveBeenCalled();
  });

  it("기존 버전이 없으면 에러를 던진다", async () => {
    contractVersionsLatestMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { createNewContractVersionForResend } = await import("./consultation-actions");

    await expect(createNewContractVersionForResend({ contractId: "ct1" })).rejects.toThrow(
      "재발송할 기존 계약 버전이 없습니다"
    );
  });
});

describe("voidContractVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contractVersionsSingleMock.mockResolvedValue({ data: { id: "cv1", contract_id: "ct1" }, error: null });
    contractsUpdateEqMock.mockResolvedValue({ error: null });
  });

  it("사유 없이 호출하면 막는다", async () => {
    const { voidContractVersion } = await import("./consultation-actions");
    await expect(voidContractVersion("cv1", "")).rejects.toThrow("무효화 사유");
  });

  it("계약을 void로 전이하고 사유를 저장한다(DocuSign 웹훅과 독립적)", async () => {
    const { voidContractVersion } = await import("./consultation-actions");
    await voidContractVersion("cv1", "가족이 서명 전 철회");
    expect(contractsUpdateEqMock).toHaveBeenCalledWith("id", "ct1");
  });
});

describe("retryFailedDriveArtifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driveArtifactsSelectInMock.mockResolvedValue({
      data: [{ id: "da1", contract_id: "ct1", artifact_type: "signed_document", drive_file_id: null, retry_count: 0 }],
      error: null,
    });
    processOneDriveArtifactMock.mockRejectedValue(new Error("DocuSign 다운로드 실패"));
  });

  it("실패하면 크래시하지 않고 retry_count를 증가시키며 sync_status를 retryable_failed로 유지한다", async () => {
    const { retryFailedDriveArtifacts } = await import("./consultation-actions");

    const result = await retryFailedDriveArtifacts();

    expect(result).toEqual({ attempted: 1, stillFailing: 1, manualReview: 0 });
    expect(driveArtifactsUpdateEqMock).toHaveBeenCalledWith("id", "da1");
  });

  it("retry_count가 한도(5)를 넘으면 manual_review로 전이한다", async () => {
    driveArtifactsSelectInMock.mockResolvedValue({
      data: [{ id: "da1", contract_id: "ct1", artifact_type: "signed_document", drive_file_id: null, retry_count: 5 }],
      error: null,
    });
    const { retryFailedDriveArtifacts } = await import("./consultation-actions");

    const result = await retryFailedDriveArtifacts();

    expect(result).toEqual({ attempted: 1, stillFailing: 0, manualReview: 1 });
  });

  it("실제 DocuSign 다운로드 후 업로드가 성공하면 succeeded로 갱신한다(Buffer.alloc(0) 아닌 실 버퍼 사용은 processOneDriveArtifact 내부에서 보장)", async () => {
    processOneDriveArtifactMock.mockResolvedValue({ driveFileId: "drive1" });
    const { retryFailedDriveArtifacts } = await import("./consultation-actions");

    const result = await retryFailedDriveArtifacts();

    expect(result).toEqual({ attempted: 1, stillFailing: 0, manualReview: 0 });
  });
});

describe("reconcileDocusignStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contractVersionsSingleMock.mockResolvedValue({
      data: { id: "cv1", contract_id: "ct1", docusign_envelope_id: "env-1", docusign_envelope_status: "sent" },
      error: null,
    });
    getEnvelopeStatusMock.mockResolvedValue({ status: "completed" });
    contractVersionsUpdateEqMock.mockResolvedValue({ error: null });
  });

  it("getEnvelopeStatus를 모킹해 실제 외부 호출 없이 상태를 대조·반영한다", async () => {
    const { reconcileDocusignStatus } = await import("./consultation-actions");

    const result = await reconcileDocusignStatus("cv1");

    expect(result.status).toBe("completed");
    expect(getEnvelopeStatusMock).toHaveBeenCalledWith("env-1");
    expect(contractVersionsUpdateEqMock).toHaveBeenCalledWith("id", "cv1");
  });

  it("envelope가 아직 없으면 에러를 던진다", async () => {
    contractVersionsSingleMock.mockResolvedValue({
      data: { id: "cv1", docusign_envelope_id: null },
      error: null,
    });
    const { reconcileDocusignStatus } = await import("./consultation-actions");

    await expect(reconcileDocusignStatus("cv1")).rejects.toThrow("발송되지 않았습니다");
  });

  it("DB에 이미 최종 상태(completed)가 기록돼 있는데 DocuSign이 비최종 상태(sent)를 돌려주면 되돌리지 않는다(순서 역전 방어, 웹훅 라우트와 동일 규칙)", async () => {
    contractVersionsSingleMock.mockResolvedValue({
      data: { id: "cv1", contract_id: "ct1", docusign_envelope_id: "env-1", docusign_envelope_status: "completed" },
      error: null,
    });
    getEnvelopeStatusMock.mockResolvedValue({ status: "sent" });
    const { reconcileDocusignStatus } = await import("./consultation-actions");

    const result = await reconcileDocusignStatus("cv1");

    expect(result.status).toBe("completed");
    expect(contractVersionsUpdateEqMock).not.toHaveBeenCalled();
  });

  it("DB가 sent인데 DocuSign이 completed면 드리프트를 교정한다", async () => {
    const { reconcileDocusignStatus } = await import("./consultation-actions");

    const result = await reconcileDocusignStatus("cv1");

    expect(result.status).toBe("completed");
    expect(contractVersionsUpdateEqMock).toHaveBeenCalledWith("id", "cv1");
  });
});

describe("reconcileContractVersionFully", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contractVersionsSingleMock.mockResolvedValue({
      data: { id: "cv1", contract_id: "ct1", docusign_envelope_id: "env-1", docusign_envelope_status: "sent" },
      error: null,
    });
    getEnvelopeStatusMock.mockResolvedValue({ status: "completed" });
    contractVersionsUpdateEqMock.mockResolvedValue({ error: null });
    driveArtifactsSelectEqMock.mockResolvedValue({ data: [], error: null });
  });

  it("DocuSign이 completed인데 drive_artifacts 행이 없으면 missing_drive_artifacts_row로 보고한다", async () => {
    const { reconcileContractVersionFully } = await import("./consultation-actions");

    const result = await reconcileContractVersionFully("cv1");

    expect(result.status).toBe("completed");
    expect(result.driveMismatches).toContainEqual({
      type: "missing_drive_artifacts_row",
      contractId: "ct1",
    });
  });

  it("processing 상태가 10분 넘게 정체돼 있으면 retryable_failed로 리셋하고 보고한다", async () => {
    driveArtifactsSelectEqMock.mockResolvedValue({
      data: [{ id: "da1", sync_status: "processing", updated_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() }],
      error: null,
    });
    const { reconcileContractVersionFully } = await import("./consultation-actions");

    const result = await reconcileContractVersionFully("cv1");

    expect(result.driveMismatches).toContainEqual({
      type: "stale_processing_reset",
      driveArtifactId: "da1",
      contractId: "ct1",
    });
    expect(driveArtifactsUpdateEqMock).toHaveBeenCalledWith("id", "da1");
  });

  it("정상적으로 최근 processing이거나 succeeded면 mismatch를 보고하지 않는다", async () => {
    driveArtifactsSelectEqMock.mockResolvedValue({
      data: [{ id: "da1", sync_status: "succeeded", updated_at: new Date().toISOString() }],
      error: null,
    });
    const { reconcileContractVersionFully } = await import("./consultation-actions");

    const result = await reconcileContractVersionFully("cv1");

    expect(result.driveMismatches).toEqual([]);
  });
});

describe("findDuplicateConsultationCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("find_possible_duplicate_consultations RPC를 정규화 인자로 호출하고 결과를 그대로 반환한다", async () => {
    rpcMock.mockResolvedValue({
      data: [{ id: "dup1", contact_name: "김민지", contact_email: "a@b.com", status: "requested", created_at: "2026-09-01T00:00:00Z" }],
      error: null,
    });
    const { findDuplicateConsultationCandidates } = await import("./consultation-actions");

    const result = await findDuplicateConsultationCandidates({
      email: "A@B.com",
      phone: "010-1234-5678",
      excludeConsultationId: "c1",
    });

    expect(rpcMock).toHaveBeenCalledWith("find_possible_duplicate_consultations", {
      p_email: "A@B.com",
      p_phone: "010-1234-5678",
      p_exclude_id: "c1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("dup1");
  });

  it("RPC 에러는 그대로 전파한다", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "rpc failed" } });
    const { findDuplicateConsultationCandidates } = await import("./consultation-actions");

    await expect(findDuplicateConsultationCandidates({ email: "a@b.com" })).rejects.toThrow("rpc failed");
  });
});

describe("proposal → contract handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consultationsUpdateEqMock.mockResolvedValue({ error: null });
  });

  it("createProposal은 proposals와 proposal_subjects를 함께 생성하고 상담 상태를 proposed로 갱신한다", async () => {
    proposalsInsertSingleMock.mockResolvedValue({ data: { id: "prop1" }, error: null });
    const { createProposal } = await import("./consultation-actions");

    const result = await createProposal({
      consultationId: "c1",
      trialSessionId: "trial1",
      subjects: [{ subjectId: "sub1", recommendedSessionCount: 10, priceMinor: 1000000 }],
      recommendedTeacherId: "t1",
    });

    expect(result.id).toBe("prop1");
    expect(proposalSubjectsInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({ proposal_id: "prop1", subject_id: "sub1", recommended_session_count: 10, price_minor: 1000000, currency: "KRW" }),
    ]);
    expect(consultationsUpdateEqMock).toHaveBeenCalledWith("id", "c1");
  });

  it("accepted 제안서에서 계약+첫 계약 버전을 생성하고 proposal_id가 계약 버전에 정확히 채워진다(과목은 계약에 고정하지 않는다)", async () => {
    proposalsSelectSingleMock.mockResolvedValue({
      data: {
        id: "prop1",
        consultation_id: "c1",
        status: "accepted",
        recommended_subjects: [{ subjectId: "sub1" }],
        price_summary: { total: 1000000 },
      },
      error: null,
    });
    contractsInsertSingleMock.mockResolvedValue({ data: { id: "ct1" }, error: null });
    contractVersionsInsertSingleMock.mockResolvedValue({ data: { id: "cv1" }, error: null });

    const { createContractFromProposal } = await import("./consultation-actions");

    const result = await createContractFromProposal({
      householdId: "h1",
      childId: "child1",
      proposalId: "prop1",
    });

    expect(result).toEqual({ contractId: "ct1", contractVersionId: "cv1" });
    expect(consultationsUpdateEqMock).toHaveBeenCalledWith("id", "c1");
  });

  it("draft/sent 상태의 제안서로는 계약을 생성할 수 없다", async () => {
    proposalsSelectSingleMock.mockResolvedValue({
      data: { id: "prop1", consultation_id: "c1", status: "sent", recommended_subjects: [], price_summary: null },
      error: null,
    });
    const { createContractFromProposal } = await import("./consultation-actions");

    await expect(
      createContractFromProposal({ householdId: "h1", childId: "child1", proposalId: "prop1" })
    ).rejects.toThrow("수락된(accepted)");
  });
});

describe("classification tags — 고정 enum 대신 관리자 관리형 태그", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createClassificationTag는 태그를 생성한다", async () => {
    classificationTagsInsertSingleMock.mockResolvedValue({ data: { id: "tag1" }, error: null });
    const { createClassificationTag } = await import("./consultation-actions");

    const result = await createClassificationTag({ label: "재외국민 특례", description: "특례 전형 대상" });

    expect(result.id).toBe("tag1");
  });

  it("retireClassificationTag는 active=false로 은퇴시킨다(하드 삭제 아님)", async () => {
    classificationTagsUpdateEqMock.mockResolvedValue({ error: null });
    const { retireClassificationTag } = await import("./consultation-actions");

    await retireClassificationTag("tag1");

    expect(classificationTagsUpdateEqMock).toHaveBeenCalledWith("id", "tag1");
  });

  it("listClassificationTags는 기본적으로 active인 태그만 반환한다", async () => {
    classificationTagsQueryResultMock.mockResolvedValue({
      data: [{ id: "tag1", label: "재외국민 특례", description: null, active: true }],
      error: null,
    });
    const { listClassificationTags } = await import("./consultation-actions");

    const result = await listClassificationTags();

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("재외국민 특례");
  });

  it("listClassificationTags({ includeInactive: true })는 은퇴된 태그도 포함한다", async () => {
    classificationTagsQueryResultMock.mockResolvedValue({
      data: [
        { id: "tag1", label: "재외국민 특례", description: null, active: true },
        { id: "tag2", label: "폐기된 분류", description: null, active: false },
      ],
      error: null,
    });
    const { listClassificationTags } = await import("./consultation-actions");

    const result = await listClassificationTags({ includeInactive: true });

    expect(result).toHaveLength(2);
  });

  it("tagConsultation은 상담에 태그를 부여한다", async () => {
    consultationTagsInsertMock.mockResolvedValue({ error: null });
    const { tagConsultation } = await import("./consultation-actions");

    await tagConsultation({ consultationId: "c1", tagId: "tag1" });

    expect(consultationTagsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ consultation_id: "c1", tag_id: "tag1", tagged_by: "admin1" })
    );
  });

  it("untagConsultation은 부여된 태그를 제거한다", async () => {
    consultationTagsDeleteEqEqMock.mockResolvedValue({ error: null });
    const { untagConsultation } = await import("./consultation-actions");

    await untagConsultation({ consultationId: "c1", tagId: "tag1" });

    expect(consultationTagsDeleteEqEqMock).toHaveBeenCalledWith("tag_id", "tag1");
  });
});

describe("retryContractActivation / listOpenContractActivationRetries — R3 후속(2026-09-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activationRetriesSingleMock.mockResolvedValue({
      data: { id: "retry1", contract_id: "ct1", resolved_at: null },
      error: null,
    });
    contractsSelectSingleMock.mockResolvedValue({ data: { id: "ct1", status: "sent" }, error: null });
    contractsUpdateEqMock.mockResolvedValue({ error: null });
    activationRetriesUpdateEqMock.mockResolvedValue({ error: null });
    activationRetriesOrderMock.mockResolvedValue({ data: [], error: null });
    contractsSelectInMock.mockResolvedValue({ data: [], error: null });
    profilesSelectInMock.mockResolvedValue({ data: [], error: null });
  });

  it("이미 resolved된 재처리 항목은 already_active로 아무 것도 바꾸지 않는다(멱등)", async () => {
    activationRetriesSingleMock.mockResolvedValue({
      data: { id: "retry1", contract_id: "ct1", resolved_at: "2026-09-01T00:00:00Z" },
      error: null,
    });
    const { retryContractActivation } = await import("./consultation-actions");

    const result = await retryContractActivation("retry1");

    expect(result).toEqual({ status: "already_active" });
    expect(contractsUpdateEqMock).not.toHaveBeenCalled();
  });

  it("계약이 이미 active면 activation을 다시 실행하지 않고 재처리 항목만 해결 처리한다(정확히 한 번 전환 보장)", async () => {
    contractsSelectSingleMock.mockResolvedValue({ data: { id: "ct1", status: "active" }, error: null });
    const { retryContractActivation } = await import("./consultation-actions");

    const result = await retryContractActivation("retry1");

    expect(result).toEqual({ status: "already_active" });
    expect(contractsUpdateEqMock).not.toHaveBeenCalled();
    expect(activationRetriesUpdateEqMock).toHaveBeenCalledWith("id", "retry1");
  });

  it("DOB·동의 보완 후 재실행하면 새 envelope·재서명 없이 active로 전환하고 재처리 항목을 해결 처리한다", async () => {
    const { retryContractActivation } = await import("./consultation-actions");

    const result = await retryContractActivation("retry1");

    expect(result).toEqual({ status: "activated" });
    expect(contractsUpdateEqMock).toHaveBeenCalledWith("id", "ct1");
    expect(activationRetriesUpdateEqMock).toHaveBeenCalledWith("id", "retry1");
  });

  it("여전히 실패하면 실패 사유를 갱신하고 재처리 대기 상태로 남긴다", async () => {
    contractsUpdateEqMock.mockResolvedValue({ error: { message: "여전히 동의 없음" } });
    const { retryContractActivation } = await import("./consultation-actions");

    const result = await retryContractActivation("retry1");

    expect(result).toEqual({ status: "still_failing", failureReason: "여전히 동의 없음" });
    // 실패 시에는 resolved_at을 세팅하는 update가 아니라 failure_reason만 갱신해야 한다.
    expect(activationRetriesUpdateEqMock).toHaveBeenCalledWith("id", "retry1");
  });

  it("존재하지 않는 재처리 항목이면 에러를 던진다", async () => {
    activationRetriesSingleMock.mockResolvedValue({ data: null, error: null });
    const { retryContractActivation } = await import("./consultation-actions");

    await expect(retryContractActivation("nope")).rejects.toThrow("존재하지 않는");
  });

  it("listOpenContractActivationRetries는 resolved되지 않은 항목만 조회하고 child 이름을 조인한다", async () => {
    activationRetriesOrderMock.mockResolvedValue({
      data: [
        {
          id: "retry1",
          contract_id: "ct1",
          contract_version_id: "cv1",
          envelope_id: "env-1",
          failure_reason: "보호자 동의 없음",
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
      error: null,
    });
    contractsSelectInMock.mockResolvedValue({ data: [{ id: "ct1", child_id: "child1" }], error: null });
    profilesSelectInMock.mockResolvedValue({ data: [{ id: "child1", name: "김학생" }], error: null });
    const { listOpenContractActivationRetries } = await import("./consultation-actions");

    const result = await listOpenContractActivationRetries();

    expect(result).toEqual([
      {
        id: "retry1",
        contractId: "ct1",
        contractVersionId: "cv1",
        envelopeId: "env-1",
        failureReason: "보호자 동의 없음",
        createdAt: "2026-09-01T00:00:00Z",
        childId: "child1",
        childName: "김학생",
      },
    ]);
  });
});
