"use client";

// R2 잔여 항목(Task 4에서 서버 액션만 만들고 화면이 없었던 부분) — 보호자가
// 이미 연결된 자녀 외에 추가로 자녀를 초대하는 화면. §4.19: "가입한 보호자는
// 자기 화면에서 자녀를 추가로 초대·연결할 수 있다."
//
// 2026-09-06(이번 라운드) — 정책 변경: 상담 전에 보호자가 직접 학생 Auth 초대를
// 발송할 수 없다. 자녀 추가는 이제 "새 자녀 상담 신청"(app/parent/ConsultRequestTab.tsx)을
// 거쳐야 하고, 계정 초대는 상담 후 관리자가 발송하는 기존 온보딩 흐름
// (app/admin/TrialOnboardingStudentsForm.tsx)의 몫이다. 아래 기존 발송 폼/버튼은
// 화면에서 뺐다. 2026-09-29(6단계 정리) — 호출부가 없던 inviteChild() 서버 액션
// (app/parent/invite-actions.ts)도 삭제했다.

export default function FamilyTab({ onGoToConsultRequest }: { onGoToConsultRequest?: () => void }) {
  return (
    <div className="max-w-[520px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-4">Add a Child</h2>

      <div className="border-[1.5px] border-grey-200 rounded-xl p-5 mb-5">
        <p className="text-[13px] text-ink font-semibold mb-2">
          To add a new child, please request a consultation first.
        </p>
        <p className="text-[12px] text-grey-500 mb-3">
          You cannot invite a child account without a consultation. After you request one and an admin
          reviews it, we will email you the account invitation instructions.
        </p>
        {onGoToConsultRequest && (
          <button
            type="button"
            onClick={onGoToConsultRequest}
            className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2"
          >
            Request a consultation for a new child →
          </button>
        )}
      </div>

      <div className="border-[1.5px] border-grey-100 rounded-xl p-5 opacity-50 pointer-events-none select-none">
        <h3 className="text-[13px] font-bold text-ink mb-2">Add a child (disabled before consultation)</h3>
        <p className="text-[12px] text-grey-500 mb-3">
          Inviting a child account directly from this screen is no longer supported.
          Please use &quot;Request a consultation for a new child&quot; above.
        </p>
        <div className="space-y-2 mb-3">
          <input placeholder="Name" disabled aria-label="Name (disabled)" className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]" />
          <input placeholder="Email" disabled aria-label="Email (disabled)" className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]" />
          <input placeholder="Grade (optional)" disabled aria-label="Grade (disabled)" className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]" />
        </div>
        <button disabled className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2 disabled:opacity-50">
          Send invite
        </button>
      </div>
    </div>
  );
}
