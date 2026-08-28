import nodemailer from "nodemailer";

// 073(이메일 알림): Kakao Alimtalk은 스펙에서 제외됐고 알림은 이메일로만 나간다.
// 특정 벤더에 묶이지 않도록 표준 SMTP만 쓴다 — 로컬 개발은 supabase local_smtp(Mailpit,
// 인증 없음)로 그대로 전송되고, 운영에서는 SMTP_* 값만 실제 제공자 것으로 바꾸면 된다.
function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("SMTP_HOST가 설정되지 않아 이메일을 보내지 않았습니다:", params.subject);
    return;
  }

  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? "Alton Education <notify@alton.education>",
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}
