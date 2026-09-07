import { describe, expect, it, vi, beforeEach } from "vitest";

// 2026-09-07 — sendConsentRequestEmailAction() 검증. 이 액션은 관리자가 카드
// 상세에서 "동의 요청 메일 발송" 버튼을 눌렀을 때, 상담 확정 Calendar 초대
// description에만 있던 동의 확인 링크(app/consult/consent)를 별도 이메일
// 채널로 다시 보낸다. 확인해야 할 것: (1) 이미 동의 완료된 상담이면 발송하지
// 않고 already_confirmed를 돌려준다, (2) 미확인 상담이면 토큰 발급 + 이메일
// 발송 + 감사 로그(consultation_status_events) 기록까지 한 번에 일어난다,
// (3) 링크 URL이 currentRequestOrigin()의 실제 요청 origin을 반영한다
// (localhost 하드코딩 회귀 방지 — 최근 라운드에서 반복된 버그 클래스).

const { rpcMock, insertMock, fromMock, sendEmailMock, headersMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  insertMock: vi.fn().mockResolvedValue({ data: null, error: null }),
  fromMock: vi.fn(),
  sendEmailMock: vi.fn().mockResolvedValue(undefined),
  headersMock: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn().mockResolvedValue({ supabase: {}, actorUserId: "admin1" }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: sendEmailMock,
  escapeHtml: (s: string) => s,
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

// 이 파일이 필요로 하는 다른 서버 액션 모듈에서 next/headers를 또 가져오지 않도록
// 이 테스트 파일은 sendConsentRequestEmailAction만 import한다(consultation-kanban-actions.ts
// 안의 다른 export들은 이 액션과 무관).
import { sendConsentRequestEmailAction } from "./consultation-kanban-actions";

function mockConsultationRow(row: Record<string, unknown> | null) {
  fromMock.mockImplementation((table: string) => {
    if (table === "consultations") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: row, error: null }),
          }),
        }),
      };
    }
    if (table === "consultation_status_events") {
      return { insert: insertMock };
    }
    throw new Error(`unexpected table: ${table}`);
  });
}

function mockHeaders(map: Record<string, string>) {
  headersMock.mockResolvedValue({
    get: (key: string) => map[key] ?? null,
  });
}

describe("sendConsentRequestEmailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockResolvedValue({ data: null, error: null });
    rpcMock.mockResolvedValue({ data: null, error: null });
    mockHeaders({ "x-forwarded-proto": "https", "x-forwarded-host": "alton-git-preview-m4-integration-verification-alton7.vercel.app" });
  });

  it("이미 동의가 완료된 상담이면 발송하지 않고 already_confirmed를 반환한다", async () => {
    mockConsultationRow({
      id: "c1",
      contact_name: "김민지",
      contact_email: "minji@example.com",
      consent_confirmed_at: "2026-09-01T00:00:00.000Z",
      status: "scheduled",
    });

    const result = await sendConsentRequestEmailAction("c1");

    expect(result).toEqual({ status: "already_confirmed", confirmedAt: "2026-09-01T00:00:00.000Z" });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("동의 미확인 상담이면 토큰을 발급하고, 실제 요청 origin이 반영된 링크로 이메일을 보내고, 감사 로그를 남긴다", async () => {
    mockConsultationRow({
      id: "c2",
      contact_name: "박서준",
      contact_email: "seojun@example.com",
      consent_confirmed_at: null,
      status: "scheduled",
    });

    const result = await sendConsentRequestEmailAction("c2");

    expect(result).toEqual({ status: "sent" });

    expect(rpcMock).toHaveBeenCalledWith(
      "issue_consult_consent_token",
      expect.objectContaining({ p_consultation_id: "c2" })
    );

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const emailArgs = sendEmailMock.mock.calls[0][0] as { to: string; subject: string; html: string };
    expect(emailArgs.to).toBe("seojun@example.com");
    expect(emailArgs.html).toContain(
      "https://alton-git-preview-m4-integration-verification-alton7.vercel.app/consult/consent?token="
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        consultation_id: "c2",
        previous_status: "scheduled",
        new_status: "scheduled",
        actor_profile_id: "admin1",
      })
    );
  });

  it("sendEmail이 실패하면(SMTP 미설정 등) failed를 반환하고 감사 로그를 남기지 않는다", async () => {
    mockConsultationRow({
      id: "c3",
      contact_name: "이하은",
      contact_email: "haeun@example.com",
      consent_confirmed_at: null,
      status: "scheduled",
    });
    sendEmailMock.mockRejectedValueOnce(new Error("SMTP_HOST가 설정되지 않아 이메일을 보낼 수 없습니다."));

    const result = await sendConsentRequestEmailAction("c3");

    expect(result).toEqual({ status: "failed", error: "SMTP_HOST가 설정되지 않아 이메일을 보낼 수 없습니다." });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("상담을 찾을 수 없으면 failed를 반환한다", async () => {
    mockConsultationRow(null);
    const result = await sendConsentRequestEmailAction("missing");
    expect(result.status).toBe("failed");
  });
});
