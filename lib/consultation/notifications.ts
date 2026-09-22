import { sendEmail } from "@/lib/email";

// M1 요구사항 2(2026-09-03 정책 전환) — Calendar 네이티브 초대가 확정 일정의 기본
// 전달 수단이 된 뒤, "Calendar가 담당하지 못하는" 알림(신청 접수 확인은 아직 미구현,
// 거절, Calendar 초대 실패 fallback)만 ALTON 커스텀 SMTP 경로로 보낸다. 확정 일정
// 안내는 lib/consultation/calendar-sync.ts의 Calendar 네이티브 초대가 전담한다.

export async function sendConsultationRejectionEmail(params: { contact_name: string; contact_email: string }): Promise<void> {
  await sendEmail({
    to: params.contact_email,
    subject: "[Alton Education] 상담 신청 안내",
    html: `
      <p>${params.contact_name}님, 안녕하세요.</p>
      <p>신청해 주신 상담이 이번에는 진행이 어렵게 되었습니다. 자세한 사항은 담당자에게
      문의해 주세요.</p>
      <p>감사합니다.<br/>Alton Education</p>
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
    subject: "[Alton Education] 상담 시간을 선택해 주세요",
    html: `
      <p>${params.contact_name}님, 안녕하세요.</p>
      <p>담당 컨설턴트 ${params.consultant_name}님이 배정되었습니다. 아래 링크에서
      편한 상담 시간을 직접 골라 주세요.</p>
      <p><a href="${params.scheduling_url}">${params.scheduling_url}</a></p>
      <p>감사합니다.<br/>Alton Education</p>
    `,
  });
}
