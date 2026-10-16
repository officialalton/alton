import { beforeEach, describe, expect, it, vi } from "vitest";

// 회귀 테스트: Preview 배포에서 초대 이메일 링크가 고정된 NEXT_PUBLIC_SITE_URL
// (로컬 개발 기본값 http://localhost:3010)을 가리켜 "사이트에 연결할 수 없음"
// 에러가 났던 버그(제품 오너가 Preview에서 실측 재현) — 근본 원인은
// lib/invite-email.ts가 lib/request-origin.ts의 currentRequestOrigin()을 쓰지
// 않고 process.env.NEXT_PUBLIC_SITE_URL을 직접 읽던 것. 이제 실제 요청 origin
// (x-forwarded-host/x-forwarded-proto)을 반영하는지 고정한다.

const sendEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("./email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["x-forwarded-proto", "https"],
      ["x-forwarded-host", "alton-preview-test.vercel.app"],
    ]),
}));

describe("sendInviteEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("고정된 NEXT_PUBLIC_SITE_URL이 아니라 실제 요청 origin으로 수락 링크를 만든다", async () => {
    const { sendInviteEmail } = await import("./invite-email");
    await sendInviteEmail({ to: "parent@example.com", name: "김학부모", token: "raw-token-abc", role: "parent" });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0] as { html: string };
    expect(call.html).toContain(
      "https://alton-preview-test.vercel.app/api/invite/accept?token=raw-token-abc"
    );
    expect(call.html).not.toContain("localhost:3010");
    expect(call.html).not.toContain("localhost:3000");
  });
});

describe("sendWorkspaceProvisioningEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("고정된 NEXT_PUBLIC_SITE_URL이 아니라 실제 요청 origin으로 로그인 링크를 만든다", async () => {
    const { sendWorkspaceProvisioningEmail } = await import("./invite-email");
    await sendWorkspaceProvisioningEmail({ to: "teacher@example.com", workspaceEmail: "teacher@alton.education" });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0] as { html: string };
    expect(call.html).toContain("https://alton-preview-test.vercel.app/login?role=teacher");
    expect(call.html).not.toContain("localhost:3010");
  });
});
