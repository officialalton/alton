import { redirect } from "next/navigation";
import { claimGuardianLinkAction } from "./actions";
import GuardianLinkClient from "./GuardianLinkClient";

// 2026-10-05 무료 회원 S4 — 보호자 연결 공개 페이지(브리프 §3.3 ③④, §3.6). 이 페이지(GET)는 상태 조회만 한다:
// 토큰 소비·계정 생성·수락은 전부 명시적 버튼 → 서버 액션. 문구는 영어(오너 결정).
export default async function GuardianLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claim = await claimGuardianLinkAction(token);

  // 이미 수락한 보호자가 다시 열면 예약 화면/포털로 바로 보낸다(멱등).
  if (claim.status === "accepted" && claim.viewer.loggedIn && claim.viewer.emailMatches) {
    redirect(claim.schedulingToken ? `/schedule/${claim.schedulingToken}` : "/parent?tab=consult");
  }

  return (
    <div className="min-h-screen bg-grey-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[520px]">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-8 h-8 rounded-full bg-red text-white font-extrabold text-[14px] flex items-center justify-center shrink-0">A</div>
          <span className="text-[15px] font-extrabold text-ink">ALTON EDUCATION</span>
        </div>
        <GuardianLinkClient token={token} claim={claim} />
      </div>
    </div>
  );
}
