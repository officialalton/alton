import ScheduleForm from "./ScheduleForm";
import SchedulingLinkInvalid from "./SchedulingLinkInvalid";
import { checkSchedulingLink, schedulingLinkNeedsAiNotesConsent } from "@/lib/consultation/scheduling-link";

// 컨설턴트 스펙 §Scheduling after Assignment — 배정 이메일에 담기는 서명된
// 예약 링크의 목적지. 로그인 없이 접근한다(토큰 자체가 인증 역할). 토큰 유효성
// 검증은 RPC 안에서만 한다(이 페이지는 얇은 셸). 무효·만료 토큰은 폼 대신 안내를 바로 그린다.
export default async function ScheduleTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const linkStatus = await checkSchedulingLink(token);
  const needsAiNotesConsent = linkStatus === "invalid" ? false : await schedulingLinkNeedsAiNotesConsent(token);
  return (
    <div className="min-h-screen bg-grey-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[480px]">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-8 h-8 rounded-full bg-red text-white font-extrabold text-[14px] flex items-center justify-center shrink-0">
            A
          </div>
          <span className="text-[15px] font-extrabold text-ink">ALTON EDUCATION</span>
        </div>
        {linkStatus === "invalid" ? <SchedulingLinkInvalid /> : <ScheduleForm token={token} needsAiNotesConsent={needsAiNotesConsent} />}
      </div>
    </div>
  );
}
