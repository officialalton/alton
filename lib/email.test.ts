import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";

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

  it("SMTP_HOST가 없으면 조용히 건너뛴다 (에러를 던지지 않음)", async () => {
    delete process.env.SMTP_HOST;
    const { sendEmail } = await import("./email");
    await expect(
      sendEmail({ to: "a@example.com", subject: "제목", html: "<p>내용</p>" })
    ).resolves.toBeUndefined();
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
