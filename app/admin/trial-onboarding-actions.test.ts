import { describe, expect, it, vi, beforeEach } from "vitest";

const { adminRpcMock, adminFromMock, companySignOffMock, sendContractMock, sendEmailMock, recordOrGetCompanyApprovalMock } = vi.hoisted(() => ({
  adminRpcMock: vi.fn(),
  adminFromMock: vi.fn(),
  companySignOffMock: vi.fn(),
  sendContractMock: vi.fn(),
  sendEmailMock: vi.fn(),
  recordOrGetCompanyApprovalMock: vi.fn().mockResolvedValue({
    companyEntityName: "Alton Education Inc.",
    approverName: "테스트 관리자",
    approverTitle: "CEO",
    approvedAtLabel: "2026. 9. 5. 오전 9:00",
    documentIdentifier: "version1",
  }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: adminRpcMock, from: adminFromMock }),
}));
vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn().mockResolvedValue({ actorUserId: "admin1" }),
}));
vi.mock("./subject-enrollment-actions", () => ({
  planSubjectEnrollment: vi.fn(),
  assignTeacherToSubjectEnrollment: vi.fn(),
}));
vi.mock("@/lib/contract-send-internal", () => ({
  companySignOffContractVersionInternal: companySignOffMock,
  sendContractForSignatureInternal: sendContractMock,
}));
vi.mock("@/lib/contract-company-approval", () => ({
  recordOrGetCompanyApproval: recordOrGetCompanyApprovalMock,
}));
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock, escapeHtml: (v: string) => v }));
vi.mock("@/lib/request-origin", () => ({ currentRequestOrigin: () => Promise.resolve("http://localhost:3010") }));

import {
  confirmTrialIntentAction,
  createTrialOnboardingLinkAction,
  sendRegularContractOneClickAction,
  sendTrialOnboardingNoticeAction,
} from "./trial-onboarding-actions";

describe("confirmTrialIntentAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirm_trial_intent RPC를 호출한다", async () => {
    adminRpcMock.mockResolvedValue({ error: null });
    await confirmTrialIntentAction("c1");
    expect(adminRpcMock).toHaveBeenCalledWith("confirm_trial_intent", {
      p_consultation_id: "c1",
      p_admin_id: "admin1",
    });
  });

  it("RPC 에러를 그대로 던진다(예: 관리자 추천 없이 확정 시도)", async () => {
    adminRpcMock.mockResolvedValue({ error: { message: "관리자 추천(trial_recommended) 결과가 기록된 상담만 체험 진행을 확정할 수 있습니다." } });
    await expect(confirmTrialIntentAction("c1")).rejects.toThrow("관리자 추천");
  });
});

describe("createTrialOnboardingLinkAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("student_email 등 전체 파라미터를 RPC에 그대로 전달한다", async () => {
    adminRpcMock.mockResolvedValue({ data: [{ link_id: "l1", raw_token: "tok" }], error: null });
    const result = await createTrialOnboardingLinkAction({
      consultationId: "c1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      studentName: "학생",
      studentEmail: "s@example.com",
      studentGrade: "9학년",
    });
    expect(result).toEqual({ linkId: "l1", rawToken: "tok" });
    expect(adminRpcMock).toHaveBeenCalledWith("create_trial_onboarding_link", {
      p_consultation_id: "c1",
      p_guardian_email: "g@example.com",
      p_guardian_name: "학부모",
      p_student_name: "학생",
      p_student_email: "s@example.com",
      p_admin_id: "admin1",
      p_student_grade: "9학년",
    });
  });
});

// M4 인수 기준 13번 — "계약 발송 실패 후 재처리→성공"을 명시적으로 못박는다.
// 새 기능이 아니라 sendRegularContractOneClickAction()의 기존 재처리 설계
// (실패해도 draft 상태로 남아 같은 계약 버전으로 재시도 가능, 새 버전/새
// 선서명을 중복 생성하지 않음)를 테스트로 고정한다.
describe("sendRegularContractOneClickAction — 실패 후 재처리→성공", () => {
  beforeEach(() => vi.clearAllMocks());

  function mockSelectionExists() {
    return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "selection1" }, error: null }) }) }) };
  }

  // 2026-09-06 — sendRegularContractOneClickAction()이 이제 childId로 학생
  // 카드의 outcome을 먼저 조회한다(regular_recommended 경로 bypass 판단).
  // 기존(trial_recommended) 테스트는 outcome을 trial_recommended로 응답해
  // 기존 selection 필수 체크 경로를 그대로 탄다 — 회귀 없음을 고정.
  function mockConsultationOutcome(outcome: string) {
    return {
      select: () => ({
        eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { outcome }, error: null }) }) }) }),
      }),
    };
  }

  it("1차 발송 실패는 draft 상태로 남고, 2차 재처리는 같은 계약 버전을 재사용해 회사 재선서명·새 버전 생성 없이 성공한다", async () => {
    let versionQueryCallCount = 0;
    adminFromMock.mockImplementation((table: string) => {
      if (table === "trial_regular_progress_selections") return mockSelectionExists();
      if (table === "consultations") return mockConsultationOutcome("trial_recommended");
      if (table === "contract_versions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => {
                    versionQueryCallCount += 1;
                    if (versionQueryCallCount === 1) {
                      // 1차 호출: 아직 계약 버전이 없음 — 새로 만든다.
                      return Promise.resolve({ data: [], error: null });
                    }
                    // 2차 호출(재처리): 1차에서 만든 버전이 이미 있고 회사
                    // 선서명도 이미 완료된 상태(company_signed_at 있음),
                    // docusign_envelope_id는 여전히 null(1차 발송 실패).
                    return Promise.resolve({
                      data: [{ id: "version1", docusign_envelope_id: null, docusign_envelope_status: null, company_signed_at: "2026-09-03T00:00:00Z" }],
                      error: null,
                    });
                  },
                }),
              }),
            }),
          }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "version1" }, error: null }) }) }),
        };
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { name: "테스트 관리자" }, error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    });
    adminRpcMock.mockResolvedValue({ data: "contract1", error: null });
    companySignOffMock.mockResolvedValue(undefined);

    // 1차: DocuSign 발송 실패(예: DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS 비활성).
    sendContractMock.mockRejectedValueOnce(new Error("DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS=true가 아니면 실제 DocuSign API를 호출하지 않습니다."));
    const firstResult = await sendRegularContractOneClickAction({
      childId: "child1",
      subjectEnrollmentId: "se1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      childName: "학생",
      approverTitle: "CEO",
    });
    expect(firstResult).toEqual({
      status: "failed",
      contractVersionId: "version1",
      error: "DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS=true가 아니면 실제 DocuSign API를 호출하지 않습니다.",
    });
    expect(companySignOffMock).toHaveBeenCalledTimes(1); // 1차에서 딱 1번만 선서명.

    // 2차(재처리): 이번엔 발송 성공.
    sendContractMock.mockResolvedValueOnce({ envelopeId: "env-retry-1" });
    const secondResult = await sendRegularContractOneClickAction({
      childId: "child1",
      subjectEnrollmentId: "se1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      childName: "학생",
      approverTitle: "CEO",
    });
    expect(secondResult).toEqual({ status: "sent", contractVersionId: "version1", envelopeId: "env-retry-1" });

    // 재처리 때도 같은 계약 버전(version1)을 재사용했고, 회사 선서명은 여전히
    // 1번만 호출됐다(재서명 없음) — 중복 생성/중복 선서명이 없음을 확인.
    expect(companySignOffMock).toHaveBeenCalledTimes(1);
    expect(sendContractMock).toHaveBeenCalledTimes(2);
    expect(sendContractMock).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ contractVersionId: "version1" }));
  });

  it("이미 발송 완료(envelope 있음)된 계약 버전에 재클릭하면 중복 발송하지 않고 그대로 반환한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "trial_regular_progress_selections") return mockSelectionExists();
      if (table === "consultations") return mockConsultationOutcome("trial_recommended");
      if (table === "contract_versions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [{ id: "version1", docusign_envelope_id: "env-already-sent", docusign_envelope_status: "sent", company_signed_at: "2026-09-03T00:00:00Z" }],
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { name: "테스트 관리자" }, error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    });
    adminRpcMock.mockResolvedValue({ data: "contract1", error: null });

    const result = await sendRegularContractOneClickAction({
      childId: "child1",
      subjectEnrollmentId: "se1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      childName: "학생",
      approverTitle: "CEO",
    });
    expect(result).toEqual({ status: "already_sent", contractVersionId: "version1", envelopeId: "env-already-sent" });
    expect(sendContractMock).not.toHaveBeenCalled();
    expect(companySignOffMock).not.toHaveBeenCalled();
  });

  // 2026-09-06(정규 진행 권장 경로 완결) — outcome='regular_recommended'인
  // 학생은 체험을 거치지 않아 trial_regular_progress_selections 행이 존재할
  // 수 없다. 이 경로에서는 selection 조회 자체를 하지 않고(트랜잭션 절약,
  // "unexpected table" throw로 호출 여부를 검증) 바로 발송을 진행해야 한다.
  it("outcome=regular_recommended이면 정규 진행 희망 선택 존재 체크를 건너뛰고 바로 발송한다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockConsultationOutcome("regular_recommended");
      if (table === "trial_regular_progress_selections") {
        throw new Error("regular_recommended 경로는 trial_regular_progress_selections를 조회하면 안 된다");
      }
      if (table === "contract_versions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
              }),
            }),
          }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "version1" }, error: null }) }) }),
        };
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { name: "테스트 관리자" }, error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    });
    adminRpcMock.mockResolvedValue({ data: "contract1", error: null });
    companySignOffMock.mockResolvedValue(undefined);
    sendContractMock.mockResolvedValueOnce({ envelopeId: "env-regular-1" });

    const result = await sendRegularContractOneClickAction({
      childId: "child1",
      subjectEnrollmentId: "se1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      childName: "학생",
      approverTitle: "CEO",
    });
    expect(result).toEqual({ status: "sent", contractVersionId: "version1", envelopeId: "env-regular-1" });
  });

  it("outcome=regular_recommended가 아니고 정규 진행 희망 선택도 없으면 여전히 거부한다(회귀 방지)", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultations") return mockConsultationOutcome("trial_recommended");
      if (table === "trial_regular_progress_selections") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    });

    await expect(
      sendRegularContractOneClickAction({
        childId: "child1",
        subjectEnrollmentId: "se1",
        guardianEmail: "g@example.com",
        guardianName: "학부모",
        childName: "학생",
        approverTitle: "CEO",
      })
    ).rejects.toThrow("보호자의 정규 진행 희망 표시가 아직 없습니다.");
  });
});

// M4 (6/N) — "체험 온보딩 안내 발송": 중복 클릭으로 같은 내용 이메일이 두 번
// 나가지 않는지, 발송 실패가 계정 생성과 무관하게(그 자체로만) 남는지 고정.
describe("sendTrialOnboardingNoticeAction", () => {
  const baseParams = {
    consultationId: "c1",
    guardianEmail: "g@example.com",
    guardianName: "학부모",
    students: [{ name: "학생", email: "s@example.com" }],
  };

  beforeEach(() => vi.clearAllMocks());

  function mockNoExistingLink() {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "trial_onboarding_links") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        };
      }
      if (table === "trial_onboarding_link_events") {
        return { insert: () => Promise.resolve({ data: null, error: null }) };
      }
      throw new Error(`unexpected table ${table}`);
    });
  }

  it("처음 발송하면 이메일을 보내고 발송 완료 상태로 기록한다", async () => {
    mockNoExistingLink();
    adminRpcMock.mockImplementation((fn: string) =>
      fn === "find_auth_user_id_by_email"
        ? Promise.resolve({ data: null, error: null })
        : Promise.resolve({ data: [{ link_id: "l1", raw_token: "tok1" }], error: null })
    );
    sendEmailMock.mockResolvedValue(undefined);

    const result = await sendTrialOnboardingNoticeAction(baseParams);

    expect(result.status).toBe("sent");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "g@example.com", subject: expect.stringContaining("온보딩") })
    );
  });

  it("이미 발송 완료된 상담에 다시 요청하면(중복 클릭) 이메일을 다시 보내지 않는다", async () => {
    adminFromMock.mockImplementation((table: string) => {
      if (table === "trial_onboarding_links") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: { id: "l1", notice_delivery_status: "sent", notice_sent_at: "2026-09-03T00:00:00Z" },
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await sendTrialOnboardingNoticeAction(baseParams);

    expect(result).toEqual({ status: "already_sent", linkId: "l1", sentAt: "2026-09-03T00:00:00Z" });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(adminRpcMock).not.toHaveBeenCalled(); // 새 링크도 만들지 않음(진짜 멱등).
  });

  it("발송이 실패하면 계정 생성과 무관하게 실패 상태로만 남는다", async () => {
    mockNoExistingLink();
    adminRpcMock.mockImplementation((fn: string) =>
      fn === "find_auth_user_id_by_email"
        ? Promise.resolve({ data: null, error: null })
        : Promise.resolve({ data: [{ link_id: "l1", raw_token: "tok1" }], error: null })
    );
    sendEmailMock.mockRejectedValue(new Error("SMTP 연결 실패"));

    const result = await sendTrialOnboardingNoticeAction(baseParams);

    expect(result).toEqual({ status: "failed", linkId: "l1", error: "SMTP 연결 실패" });
  });

  // 2026-09-11(제품 오너 확정 정책) — 자녀 이메일이 기존 auth.users와 이미
  // 겹치면 링크 생성·발송 자체를 막는다(재결정 대상 아님). 새로 발생한
  // 실패이므로 성공 문구(sent/already_sent)가 나오면 안 된다.
  it("자녀 이메일이 기존 Auth 계정과 겹치면 링크를 발급·발송하지 않고 duplicate_emails를 반환한다", async () => {
    mockNoExistingLink();
    adminRpcMock.mockImplementation((fn: string, args: { p_email?: string }) => {
      if (fn === "find_auth_user_id_by_email") {
        return Promise.resolve({
          data: args.p_email === "s@example.com" ? "existing-user-id" : null,
          error: null,
        });
      }
      throw new Error(`이 테스트에서는 ${fn} RPC가 호출되면 안 됩니다(발급 전 차단 실패).`);
    });

    const result = await sendTrialOnboardingNoticeAction(baseParams);

    expect(result).toEqual({
      status: "duplicate_emails",
      collisions: [{ name: "학생", email: "s@example.com" }],
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(adminRpcMock).not.toHaveBeenCalledWith("create_trial_onboarding_link_multi", expect.anything());
  });

  // 2026-09-05 보완 — 클라이언트 검증(빈 값이면 버튼 비활성화)을 우회해 서버
  // 액션을 직접 호출해도 빈 문자열·잘못된 이메일 형식은 거부돼야 한다. 이
  // 검증은 링크 조회/발급 이전에 일어나야 하므로 DB 모킹 없이도 통과해야 한다.
  // 2026-09-06(#441 마스킹 버그 수정) — 검증 실패는 더 이상 throw하지 않고
  // { status: "failed", error } 결과로 반환한다. Server Action이 예외를
  // 던지면 Next.js가 production에서 이를 "Minified React error #441"라는
  // 일반화된 메시지로 마스킹해 실제 원인(관리자가 입력한 값 중 무엇이
  // 잘못됐는지)이 화면에서 사라지는 실사용 버그가 있었다(Preview 재현
  // 확인). workspace-actions.ts의 기존 규칙(예외를 던지지 않고 결과값으로
  // 모델링)과 동일하게 맞춘다.
  it("보호자 이메일이 빈 문자열이면 거부하고 어떤 DB/이메일 호출도 하지 않는다", async () => {
    const result = await sendTrialOnboardingNoticeAction({ ...baseParams, guardianEmail: "" });
    expect(result.status).toBe("failed");
    expect(adminFromMock).not.toHaveBeenCalled();
    expect(adminRpcMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("학생 이메일 형식이 올바르지 않으면(@ 없음) 거부한다", async () => {
    const result = await sendTrialOnboardingNoticeAction({
      ...baseParams,
      students: [{ name: "학생", email: "not-an-email" }],
    });
    expect(result.status).toBe("failed");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("보호자 이름이 빈 문자열(공백만)이면 거부한다", async () => {
    const result = await sendTrialOnboardingNoticeAction({ ...baseParams, guardianName: "   " });
    expect(result.status).toBe("failed");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("학생 이름이 빈 문자열이면 거부한다", async () => {
    const result = await sendTrialOnboardingNoticeAction({
      ...baseParams,
      students: [{ name: "", email: "s@example.com" }],
    });
    expect(result.status).toBe("failed");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("학생을 1명도 입력하지 않으면 거부한다", async () => {
    const result = await sendTrialOnboardingNoticeAction({ ...baseParams, students: [] });
    expect(result.status).toBe("failed");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("같은 이메일을 두 학생에게 중복 입력하면 거부한다", async () => {
    const result = await sendTrialOnboardingNoticeAction({
      ...baseParams,
      students: [
        { name: "학생1", email: "dup@example.com" },
        { name: "학생2", email: "dup@example.com" },
      ],
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("dup@example.com");
    }
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("학생 N명을 create_trial_onboarding_link_multi에 배열로 전달한다", async () => {
    mockNoExistingLink();
    adminRpcMock.mockImplementation((fn: string) =>
      fn === "find_auth_user_id_by_email"
        ? Promise.resolve({ data: null, error: null })
        : Promise.resolve({ data: [{ link_id: "l1", raw_token: "tok1" }], error: null })
    );
    sendEmailMock.mockResolvedValue(undefined);

    await sendTrialOnboardingNoticeAction({
      consultationId: "c1",
      guardianEmail: "g@example.com",
      guardianName: "학부모",
      students: [
        { name: "학생1", email: "s1@example.com", grade: "9학년" },
        { name: "학생2", email: "s2@example.com" },
      ],
    });

    expect(adminRpcMock).toHaveBeenCalledWith("create_trial_onboarding_link_multi", {
      p_consultation_id: "c1",
      p_guardian_email: "g@example.com",
      p_guardian_name: "학부모",
      p_students: [
        { name: "학생1", email: "s1@example.com", grade: "9학년", subject: null },
        { name: "학생2", email: "s2@example.com", grade: null, subject: null },
      ],
      // 2026-09-06(실제 버그 수정) — 이 RPC는 service_role 호출이라
      // auth.uid()가 항상 null이라 SQL 안에서 is_admin()/auth.uid()를 다시
      // 확인하면 정상 관리자 세션에서도 매번 "관리자만 온보딩 링크를 발급할
      // 수 있습니다."로 실패한다(제품 오너가 Preview에서 실측 재현). 앱
      // 레이어가 이미 requireAdminOrCapability()로 검증한 실제 관리자 id를
      // p_admin_id로 명시적으로 넘겨야 한다.
      p_admin_id: "admin1",
    });
  });

  // 2026-09-06(실제 버그 수정) — 제품 오너가 Preview에서 재현: 관리자가 발송한
  // 안내 이메일 자체는 나갔는데, 보호자가 링크를 눌러 /login으로 리다이렉트되며
  // "보호자 계정 생성에 실패했습니다"가 떴다. 원인: assertTrialOnboardingNoticeParamsValid()는
  // guardianEmail.trim()으로 형식만 검증하고 저장/RPC 전달은 trim되지 않은
  // 원본 값을 그대로 썼다 — 관리자가 이메일을 복사·붙여넣기하며 앞뒤 공백이
  // 섞이면 검증은 통과하지만, 보호자가 링크를 연 뒤 lib/trial-onboarding-finalize.ts가
  // 그 공백 섞인 이메일 그대로 admin.auth.admin.createUser()를 호출해 GoTrue가
  // "Unable to validate email address: invalid format"로 거부한다(node repro
  // 스크립트로 로컬 GoTrue에서 직접 재현·확인). RPC에 전달되는 guardianEmail은
  // trim된 값이어야 한다.
  it("보호자 이메일 앞뒤에 공백이 섞여도 trim된 값으로 RPC에 전달한다(GoTrue 이메일 형식 거부 방지)", async () => {
    mockNoExistingLink();
    adminRpcMock.mockImplementation((fn: string) =>
      fn === "find_auth_user_id_by_email"
        ? Promise.resolve({ data: null, error: null })
        : Promise.resolve({ data: [{ link_id: "l1", raw_token: "tok1" }], error: null })
    );
    sendEmailMock.mockResolvedValue(undefined);

    await sendTrialOnboardingNoticeAction({
      ...baseParams,
      guardianEmail: "  g@example.com  ",
    });

    expect(adminRpcMock).toHaveBeenCalledWith(
      "create_trial_onboarding_link_multi",
      expect.objectContaining({ p_guardian_email: "g@example.com" })
    );
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "g@example.com" }));
  });
});
