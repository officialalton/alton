"use client";

// R2 잔여 항목(Task 4에서 서버 액션만 만들고 화면이 없었던 부분) — 보호자가
// 이미 연결된 자녀 외에 추가로 자녀를 초대하는 화면. §4.19: "가입한 보호자는
// 자기 화면에서 자녀를 추가로 초대·연결할 수 있다."
//
// 2026-09-06(이번 라운드) — 정책 변경: 상담 전에 보호자가 직접 학생 Auth 초대를
// 발송할 수 없다. 자녀 추가는 이제 "새 자녀 상담 신청"(app/parent/ConsultRequestTab.tsx)을
// 거쳐야 하고, 계정 초대는 상담 후 관리자가 발송하는 기존 온보딩 흐름
// (app/admin/TrialOnboardingStudentsForm.tsx)의 몫이다. 아래 기존 발송 폼/버튼은
// 비활성화만 하고 삭제하지 않는다 — inviteChild()/invite-actions.ts 서버 액션 자체는
// 다른 곳(관리자 발송 온보딩 흐름)에서 재사용하지 않는 것으로 확인했지만, 향후
// 필요할 수 있어 코드는 그대로 남겨둔다.

export default function FamilyTab({ onGoToConsultRequest }: { onGoToConsultRequest?: () => void }) {
  return (
    <div className="max-w-[520px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-4">자녀 추가</h2>

      <div className="border-[1.5px] border-grey-200 rounded-xl p-5 mb-5">
        <p className="text-[13px] text-ink font-semibold mb-2">
          새 자녀를 추가하려면 먼저 상담을 신청해주세요.
        </p>
        <p className="text-[12px] text-grey-500 mb-3">
          상담 없이 바로 자녀 계정을 초대할 수 없습니다. 상담 신청 후 관리자가
          확인하면 계정 초대 안내를 이메일로 보내드립니다.
        </p>
        {onGoToConsultRequest && (
          <button
            type="button"
            onClick={onGoToConsultRequest}
            className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2"
          >
            새 자녀 상담 신청하러 가기 →
          </button>
        )}
      </div>

      <div className="border-[1.5px] border-grey-100 rounded-xl p-5 opacity-50 pointer-events-none select-none">
        <h3 className="text-[13px] font-bold text-ink mb-2">자녀 추가 초대(상담 전 비활성화됨)</h3>
        <p className="text-[12px] text-grey-500 mb-3">
          이 화면에서 바로 자녀 계정을 초대하는 기능은 더 이상 지원하지 않습니다.
          위의 &quot;새 자녀 상담 신청&quot;을 이용해주세요.
        </p>
        <div className="space-y-2 mb-3">
          <input placeholder="이름" disabled aria-label="이름(비활성화됨)" className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]" />
          <input placeholder="이메일" disabled aria-label="이메일(비활성화됨)" className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]" />
          <input placeholder="학년(선택)" disabled aria-label="학년(비활성화됨)" className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]" />
        </div>
        <button disabled className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2 disabled:opacity-50">
          초대 보내기
        </button>
      </div>
    </div>
  );
}
