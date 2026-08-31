/**
 * R2 Task 4 — 초대 이메일이 이미 가입된 계정과 같을 때 도착하는 화면. 이
 * 시점엔 세션이 전혀 없다(claim_account_invite가 계정을 만들지 않고
 * manual_review로 멈췄다) — 로그아웃 버튼이나 auth.getUser() 체크가 필요 없다.
 */
export default function InviteManualReviewPage() {
  return (
    <main className="min-h-screen bg-grey-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-[14px] bg-white p-11 shadow-[0_1px_3px_rgba(0,0,0,0.06)] text-center">
        <div className="font-extrabold text-lg tracking-[0.02em] text-ink mb-1.5">
          ALTON <span className="text-red">EDUCATION</span>
        </div>
        <h1 className="text-[21px] font-extrabold text-ink mb-3">
          관리자 확인이 필요합니다
        </h1>
        <p className="text-[13.5px] text-grey-500 leading-[1.6]">
          입력하신 이메일로 이미 계정이 존재합니다.
          <br />
          안전한 연결을 위해 관리자가 직접 확인한 뒤 처리해드립니다.
          <br />
          잠시만 기다려주세요.
        </p>
      </div>
    </main>
  );
}
