import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return { ...actual, sendEmail: sendEmailMock };
});

import { sendGuardianLinkInviteEmail, sendGuardianLinkReminderEmail, sendLinkedGuardianBookingNoticeEmail } from "./emails";

// 메일 3종(브리프 §5.2) — 실제 발송은 없고 sendEmail 모킹. 학생 상세는 first name만, 영어 문구, HTML escape.
beforeEach(() => {
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue(undefined);
});

describe("guardian link emails", () => {
  it("초대 메일: 수신자·링크·만료 안내·학생 이름(escape)만 담는다", async () => {
    await sendGuardianLinkInviteEmail({ to: "parent@example.com", studentFirstName: "<Min>", inviteUrl: "https://alton.test/guardian-link/tok123" });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const { to, subject, html } = sendEmailMock.mock.calls[0][0];
    expect(to).toBe("parent@example.com");
    expect(subject).toMatch(/would like to connect you as their parent/);
    expect(html).toContain("https://alton.test/guardian-link/tok123");
    expect(html).toContain("&lt;Min&gt;");
    expect(html).not.toContain("<Min>");
    expect(html).toMatch(/expires in 7 days/);
    expect(html).not.toMatch(/[ㄱ-힝]/);
  });

  it("연결된 보호자 예약 안내 메일: 포털 링크, 보호자 이름 선택", async () => {
    await sendLinkedGuardianBookingNoticeEmail({ to: "p@example.com", guardianName: null, studentFirstName: "Min", portalUrl: "https://alton.test/parent?tab=consult" });
    const { html, subject } = sendEmailMock.mock.calls[0][0];
    expect(subject).toMatch(/Min would like to talk with a tutor/);
    expect(html).toContain("https://alton.test/parent?tab=consult");
    expect(html).toMatch(/^\s*<p>Hello,<\/p>/m);
  });

  it("리마인더: unbooked는 예약 링크, unaccepted는 초대 링크 문구", async () => {
    await sendGuardianLinkReminderEmail({ to: "p@example.com", kind: "unbooked", studentFirstName: "Min", url: "https://alton.test/schedule/s1" });
    await sendGuardianLinkReminderEmail({ to: "p@example.com", kind: "unaccepted", studentFirstName: "Min", url: "https://alton.test/guardian-link/g2" });
    expect(sendEmailMock.mock.calls[0][0].subject).toMatch(/pick a time/);
    expect(sendEmailMock.mock.calls[0][0].html).toContain("https://alton.test/schedule/s1");
    expect(sendEmailMock.mock.calls[1][0].subject).toMatch(/waiting for you to connect/);
    expect(sendEmailMock.mock.calls[1][0].html).toContain("https://alton.test/guardian-link/g2");
  });
});
