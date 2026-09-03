import { loadChildren } from "@/app/parent/children-data";
import { loadChildrenSubjectEnrollments } from "@/app/parent/enrollment-data";
import { requireUser } from "@/lib/auth";
import TrialConsentButton from "./TrialConsentButton";

// M4 (2/N) — 신규/기존 보호자가 로그인한 뒤 도착하는 체험 온보딩 마무리 화면.
// 계정 연결 자체(신규 경로는 /api/trial-onboarding/redeem, 기존 경로는 로그인
// 세션에서 linkExistingGuardianToTrialOnboarding 호출)는 이 페이지 이전에
// 끝나 있어야 한다 — 여기서는 학생별 최초 1회 체험 Smart Notes 동의만 다룬다.
// 과목 수강 관계·선생님 배정은 관리자가 이미 만들어둔 상태를 전제한다(요구사항
// 3: 체험 예약 전에 완료).
export default async function TrialOnboardingConsentPage() {
  const { user, supabase } = await requireUser();
  const children = await loadChildren(supabase, user.id);
  const childrenEnrollments = await loadChildrenSubjectEnrollments(supabase, children);

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <h1 className="text-[18px] font-extrabold text-ink mb-2">체험 수업 준비</h1>
      <p className="text-[13px] text-grey-500 mb-6">
        체험 수업 진행을 위해 Smart Notes(AI 수업 기록) 이용에 대한 최초 1회 동의가
        필요합니다. 이후 회차부터는 다시 확인하지 않습니다.
      </p>

      {childrenEnrollments.length === 0 ? (
        <p className="text-[13px] text-grey-500">아직 배정된 과목이 없습니다. 관리자에게 문의해주세요.</p>
      ) : (
        childrenEnrollments.map((c) => (
          <div key={c.childId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="text-[14px] font-bold text-ink mb-2">{c.childName}</div>
            <TrialConsentButton childId={c.childId} />
          </div>
        ))
      )}
    </main>
  );
}
