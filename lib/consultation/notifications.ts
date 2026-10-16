import { sendEmail } from "@/lib/email";

// M1 요구사항 2(2026-09-03 정책 전환) — Calendar 네이티브 초대가 확정 일정의 기본
// 전달 수단이 된 뒤, "Calendar가 담당하지 못하는" 알림(신청 접수 확인은 아직 미구현,
// 거절, Calendar 초대 실패 fallback)만 ALTON 커스텀 SMTP 경로로 보낸다. 확정 일정
// 안내는 lib/consultation/calendar-sync.ts의 Calendar 네이티브 초대가 전담한다.

export async function sendConsultationRejectionEmail(params: { contact_name: string; contact_email: string }): Promise<void> {
  await sendEmail({
    to: params.contact_email,
    subject: "[ALTON EDUCATION] About your consultation request",
    html: `
      <p>Hello ${params.contact_name},</p>
      <p>Unfortunately, we're unable to move forward with the consultation you requested at this time.
      If you have any questions, please reach out to our team.</p>
      <p>Thank you,<br/>ALTON EDUCATION</p>
    `,
  });
}

// 2026-09-22(컨설턴트 스펙 §Scheduling after Assignment 2단계) — 어드미션
// 컨설턴트 배정 후 고객에게 보내는 예약 링크 안내. 실제 발송은 관리자/컨설턴트가
// 명시적으로 "링크 보내기"를 누를 때만 일어난다(자동 발송 아님 — Phase 2b는
// 이 수동 확인 지점을 안전장치로 둔다).
export async function sendConsultationSchedulingLinkEmail(params: {
  contact_name: string;
  contact_email: string;
  consultant_name: string;
  scheduling_url: string;
}): Promise<void> {
  await sendEmail({
    to: params.contact_email,
    subject: "[ALTON EDUCATION] Pick a time for your consultation",
    html: `
      <p>Hello ${params.contact_name},</p>
      <p>${params.consultant_name} will be your admissions consultant. Use the button below to
      choose a consultation time that works for you.</p>
      <p style="margin: 24px 0;">
        <a href="${params.scheduling_url}"
           style="display:inline-block;background:#c81e34;color:#ffffff;text-decoration:none;
                  font-weight:bold;font-size:15px;padding:12px 28px;border-radius:8px;">
          Choose a consultation time
        </a>
      </p>
      <p>Thank you,<br/>ALTON EDUCATION</p>
    `,
  });
}
