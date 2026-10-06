import { escapeHtml, sendEmail } from "@/lib/email";

// 2026-10-05 무료 회원 S4 — 보호자 연결 메일 3종(브리프 §5.2). 오너 결정(2026-10-05): 신규 학생·보호자
// 대면 문구는 영어. 발송은 lib/email sendEmail 하나로만(실제 수신자 발송은 호출부 책임 — 테스트는 모킹).
// 학생 정보는 이름(first name)만 담는다(수락 전 상세 비공개, §3.4).

const BUTTON_STYLE =
  "display:inline-block;background:#c81e34;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px;";

function layout(body: string): string {
  return `
      ${body}
      <p style="color:#777;font-size:12px;margin-top:28px;">If you weren't expecting this email, you can safely ignore it.</p>
      <p>ALTON EDUCATION</p>
  `;
}

/** ① 학생이 보호자 이메일을 입력했을 때 보내는 초대. 링크는 /guardian-link/[token]. */
export async function sendGuardianLinkInviteEmail(params: { to: string; studentFirstName: string; inviteUrl: string; expiresInDays?: number }): Promise<void> {
  const name = escapeHtml(params.studentFirstName || "Your student");
  await sendEmail({
    to: params.to,
    subject: `[ALTON EDUCATION] ${name} would like to connect you as their parent`,
    html: layout(`
      <p>Hello,</p>
      <p><strong>${name}</strong> has been studying with ALTON EDUCATION's free SAT practice and would like to talk
      with a tutor. To continue, ${name} asked us to connect you as their parent or guardian.</p>
      <p>After you connect, you'll be able to see ${name}'s practice-test results and schedule a free consultation
      with one of our admissions consultants.</p>
      <p style="margin: 24px 0;">
        <a href="${params.inviteUrl}" style="${BUTTON_STYLE}">Review and connect</a>
      </p>
      <p>This link expires in ${params.expiresInDays ?? 7} days. If it has expired, ask ${name} to send a new invitation.</p>
    `),
  });
}

/** ② 학생이 이미 연결된 보호자가 있을 때 — 초대 대신 보호자에게 "상담을 예약해 주세요" 안내(1회). */
export async function sendLinkedGuardianBookingNoticeEmail(params: { to: string; guardianName: string | null; studentFirstName: string; portalUrl: string }): Promise<void> {
  const name = escapeHtml(params.studentFirstName || "Your student");
  const greeting = params.guardianName ? `Hello ${escapeHtml(params.guardianName)},` : "Hello,";
  await sendEmail({
    to: params.to,
    subject: `[ALTON EDUCATION] ${name} would like to talk with a tutor`,
    html: layout(`
      <p>${greeting}</p>
      <p><strong>${name}</strong> has been using ALTON EDUCATION's free SAT practice and would like to talk with a tutor.
      You're already connected as ${name}'s parent, so you can book a free consultation from your parent portal.</p>
      <p style="margin: 24px 0;">
        <a href="${params.portalUrl}" style="${BUTTON_STYLE}">Open the parent portal</a>
      </p>
    `),
  });
}

/** ③ 수락 후 예약 미완료 리마인더(일일 크론, 최대 1회) / 초대 미수락 리마인더(최대 1회). */
export async function sendGuardianLinkReminderEmail(params: { to: string; kind: "unaccepted" | "unbooked"; studentFirstName: string; url: string }): Promise<void> {
  const name = escapeHtml(params.studentFirstName || "Your student");
  const isUnbooked = params.kind === "unbooked";
  await sendEmail({
    to: params.to,
    subject: isUnbooked
      ? `[ALTON EDUCATION] Reminder: pick a time for ${name}'s consultation`
      : `[ALTON EDUCATION] Reminder: ${name} is waiting for you to connect`,
    html: layout(
      isUnbooked
        ? `
      <p>Hello,</p>
      <p>You're connected as ${name}'s parent, but a consultation time hasn't been chosen yet.
      Pick a time that works for you below — it only takes a minute.</p>
      <p style="margin: 24px 0;"><a href="${params.url}" style="${BUTTON_STYLE}">Choose a consultation time</a></p>
    `
        : `
      <p>Hello,</p>
      <p>${name} invited you to connect as their parent on ALTON EDUCATION a few days ago. The invitation is still open.</p>
      <p style="margin: 24px 0;"><a href="${params.url}" style="${BUTTON_STYLE}">Review and connect</a></p>
    `,
    ),
  });
}
