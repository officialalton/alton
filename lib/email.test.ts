import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { escapeHtml } from "./email";

vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn() },
}));

describe("sendEmail", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("SMTP_HOST가 없으면 실패로 던진다(조용히 성공 처리해 notice_delivery_status를 'sent'로 잘못 기록하던 버그, 2026-09-05 수정)", async () => {
    delete process.env.SMTP_HOST;
    const { sendEmail } = await import("./email");
    await expect(
      sendEmail({ to: "a@example.com", subject: "제목", html: "<p>내용</p>" })
    ).rejects.toThrow("SMTP_HOST");
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it("SMTP_HOST가 있으면 sendMail을 호출한다", async () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "54325";
    process.env.EMAIL_FROM = "Alton <notify@alton.education>";
    const sendMail = vi.fn().mockResolvedValue(undefined);
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);

    const { sendEmail } = await import("./email");
    await sendEmail({ to: "a@example.com", subject: "제목", html: "<p>내용</p>" });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Alton <notify@alton.education>",
        to: "a@example.com",
        subject: "제목",
        html: "<p>내용</p>",
      })
    );
  });
});

describe("escapeHtml", () => {
  it("사용자 입력값에 포함될 수 있는 HTML 특수문자를 escape한다(이메일 본문 인젝션 방지)", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">&\'')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;"
    );
  });
});
