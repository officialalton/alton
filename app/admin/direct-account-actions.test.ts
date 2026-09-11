import { describe, expect, it, vi, beforeEach } from "vitest";

// 계획 문서(2026-09-09-codebase-review-and-performance-diagnosis.md) 4절 P1:
// sendDirectOnboardingNoticeAction — 지인/추천 계정 생성 안내 발송. 권한 게이트
// (requireAdminOrCapability)는 이미 있고(4단계 감사에서 확인), 실제 상태 변경은
// trial_onboarding_links.notice_delivery_status 갱신 + 이벤트 로그 기록이다.
// 정상/권한 거부/잘못된 입력(중복 이메일 등) 경로를 검증한다.

const { adminRpcMock, adminFromMock, sendEmailMock, requireAdminOrCapabilityMock } = vi.hoisted(() => ({
  adminRpcMock: vi.fn(),
  adminFromMock: vi.fn(),
  sendEmailMock: vi.fn(),
  requireAdminOrCapabilityMock: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: adminRpcMock, from: adminFromMock }),
}));
vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: requireAdminOrCapabilityMock,
}));
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock, escapeHtml: (v: string) => v }));
vi.mock("@/lib/request-origin", () => ({ currentRequestOrigin: () => Promise.resolve("http://localhost:3010") }));

import { sendDirectOnboardingNoticeAction } from "./direct-account-actions";

const updateEqMock = vi.fn();
const insertMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminOrCapabilityMock.mockResolvedValue({ actorUserId: "admin1" });
  adminRpcMock.mockImplementation((fn: string) =>
    fn === "find_auth_user_id_by_email"
      ? Promise.resolve({ data: null, error: null })
      : Promise.resolve({ data: [{ link_id: "link1", raw_token: "raw-token-abc" }], error: null })
  );
  updateEqMock.mockResolvedValue({ error: null });
  insertMock.mockResolvedValue({ error: null });
  adminFromMock.mockImplementation((table: string) => {
    if (table === "trial_onboarding_links") {
      return { update: () => ({ eq: updateEqMock }) };
    }
    if (table === "trial_onboarding_link_events") {
      return { insert: insertMock };
    }
    throw new Error(`unexpected admin table ${table}`);
  });
  sendEmailMock.mockResolvedValue(undefined);
});

const VALID_PARAMS = {
  guardianEmail: "guardian@example.com",
  guardianName: "김보호자",
  students: [{ name: "김학생", email: "student@example.com" }],
};

describe("sendDirectOnboardingNoticeAction", () => {
  it("정상 입력이면 링크를 발급하고 메일을 보낸 뒤 notice_delivery_status를 sent로 갱신한다(정상 경로)", async () => {
    const result = await sendDirectOnboardingNoticeAction(VALID_PARAMS);
    expect(result.status).toBe("sent");
    expect(adminRpcMock).toHaveBeenCalledWith(
      "create_direct_onboarding_link_multi",
      expect.objectContaining({ p_guardian_email: "guardian@example.com", p_admin_id: "admin1" })
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "guardian@example.com" })
    );
    expect(updateEqMock).toHaveBeenCalledWith("id", "link1");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ link_id: "link1", event_type: "notice_sent" })
    );
  });

  it("권한(admin/capability)이 없으면 RPC·메일 발송 없이 예외가 전파된다(권한 거부)", async () => {
    requireAdminOrCapabilityMock.mockRejectedValue(new Error("이 작업을 수행할 권한이 없습니다."));
    await expect(sendDirectOnboardingNoticeAction(VALID_PARAMS)).resolves.toEqual({
      status: "failed",
      linkId: "",
      error: "이 작업을 수행할 권한이 없습니다.",
    });
    expect(adminRpcMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("학생 이메일이 중복되면 RPC 호출 없이 실패를 반환한다(잘못된 입력)", async () => {
    const result = await sendDirectOnboardingNoticeAction({
      ...VALID_PARAMS,
      students: [
        { name: "학생1", email: "dup@example.com" },
        { name: "학생2", email: "dup@example.com" },
      ],
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toMatch(/같은 이메일이 중복 입력됐습니다/);
    }
    expect(adminRpcMock).not.toHaveBeenCalled();
  });

  it("보호자 이메일 형식이 잘못되면 RPC 호출 없이 실패를 반환한다(잘못된 입력)", async () => {
    const result = await sendDirectOnboardingNoticeAction({
      ...VALID_PARAMS,
      guardianEmail: "not-an-email",
    });
    expect(result.status).toBe("failed");
    expect(adminRpcMock).not.toHaveBeenCalled();
  });

  it("메일 발송이 실패하면 notice_delivery_status를 failed로 기록하고 failed를 반환한다(잘못된 상태로의 전이 방지)", async () => {
    sendEmailMock.mockRejectedValue(new Error("SMTP 오류"));
    const result = await sendDirectOnboardingNoticeAction(VALID_PARAMS);
    expect(result).toEqual({ status: "failed", linkId: "link1", error: "SMTP 오류" });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ link_id: "link1", event_type: "notice_failed" })
    );
  });

  // 2026-09-11(제품 오너 확정 정책) — 지인/추천(직접 생성) 경로도 상담 경로와
  // 동일하게 자녀 이메일이 기존 auth.users와 겹치면 링크 생성·발송 전에 막는다.
  it("자녀 이메일이 기존 Auth 계정과 겹치면 링크를 발급·발송하지 않고 duplicate_emails를 반환한다", async () => {
    adminRpcMock.mockImplementation((fn: string, args: { p_email?: string }) => {
      if (fn === "find_auth_user_id_by_email") {
        return Promise.resolve({
          data: args.p_email === "student@example.com" ? "existing-user-id" : null,
          error: null,
        });
      }
      throw new Error(`이 테스트에서는 ${fn} RPC가 호출되면 안 됩니다(발급 전 차단 실패).`);
    });

    const result = await sendDirectOnboardingNoticeAction(VALID_PARAMS);

    expect(result).toEqual({
      status: "duplicate_emails",
      collisions: [{ name: "김학생", email: "student@example.com" }],
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
