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
