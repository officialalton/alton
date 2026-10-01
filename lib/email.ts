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
    // SMTP 미설정 시 조용히 성공 반환하면 호출부의 try/catch가 "발송 성공"으로
    // 착각해 notice_delivery_status를 'sent'로 기록하는 실제 버그로 이어졌다
    // (2026-09-05 코드 점검 발견) — 반드시 실패로 처리되도록 throw한다.
    throw new Error("SMTP_HOST가 설정되지 않아 이메일을 보낼 수 없습니다.");
  }

  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? "Alton Education <notify@alton.education>",
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

/** 이메일 HTML 본문에 사용자 입력값을 넣기 전 escape한다(XSS/헤더 인젝션 방지). */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
