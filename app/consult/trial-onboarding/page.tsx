import { loadChildren } from "@/app/parent/children-data";
import { loadChildrenSubjectEnrollments } from "@/app/parent/enrollment-data";
import { requireUser } from "@/lib/auth";
import TrialConsentButton from "./TrialConsentButton";

// M4 — 신규/기존 보호자가 로그인한 뒤 도착하는 체험 온보딩 마무리 화면.
// 계정 연결 자체(신규 경로는 /api/trial-onboarding/redeem, 기존 경로는 로그인
// 세션에서 linkExistingGuardianToTrialOnboarding 호출)는 이 페이지 이전에
// 끝나 있어야 한다 — 여기서는 학생별 최초 1회 체험 Smart Notes 동의와, 동의
// 직후 자동 지급되는 체험수업권 조건 안내만 다룬다. 과목 수강 관계·선생님
// 배정은 관리자가 이미 만들어둔 상태를 전제한다(요구사항 3: 체험 예약 전에 완료).
export default async function TrialOnboardingConsentPage() {
  const { user, supabase } = await requireUser();
  const children = await loadChildren(supabase, user.id);
  const childrenEnrollments = await loadChildrenSubjectEnrollments(supabase, children);

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <div className="text-[11.5px] font-bold text-grey-500 mb-2">온보딩 · 마지막 단계</div>
      <h1 className="text-[18px] font-extrabold text-ink mb-2">체험 수업 준비</h1>
      <p className="text-[13px] text-grey-500 mb-4">
        학생별로 최초 1회만 Smart Notes(AI 수업 기록) 이용에 동의해주시면 됩니다.
        동의 즉시 체험수업권이 자동으로 지급되고, 이후 회차부터는 다시 확인하지 않습니다.
      </p>

      <div className="text-[12px] text-grey-600 bg-grey-100 rounded-lg px-4 py-3 mb-6 space-y-1">
        <div className="font-bold text-ink text-[12.5px] mb-1">체험수업권 안내</div>
        <div>· 60분 체험 수업 1회 — 지급일로부터 90일 이내 예약하실 수 있습니다.</div>
        <div>· 구매·환불·양도가 불가능한 전용 수업권입니다(정규 수업권과 별개).</div>
        <div>· 확정된 체험 리뷰는 배정된 선생님이 검토한 내용만 보여드립니다 — AI 회의록
          원본은 공개되지 않습니다.</div>
      </div>

      {childrenEnrollments.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          아직 배정된 과목·선생님이 없습니다 — 관리자가 배정을 완료하면 이 화면에
          동의 버튼이 나타납니다. 잠시 후 다시 확인해주세요.
        </div>
      ) : (
        childrenEnrollments.map((c) => (
          <div key={c.childId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="text-[14px] font-bold text-ink mb-2">{c.childName}</div>
            <TrialConsentButton childId={c.childId} />
          </div>
        ))
      )}

      <p className="text-[11px] text-grey-400 mt-6">
        본 화면의 Smart Notes 이용 안내 문구는 확정 전 초안이며, 실제 서비스 약관과
        다를 수 있습니다.
      </p>
    </main>
  );
}
