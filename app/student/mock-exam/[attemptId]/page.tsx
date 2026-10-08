import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadMockExamAttemptDetail, loadStudentMockExamAttempts } from "@/lib/mock-exam/attempt-data";
import { loadMstAttemptStateAction } from "@/lib/mock-exam/mst-actions";
import { hasFeature, loadStudentFeatureAccess } from "@/lib/feature-access";
import MockExamTakeClient from "./MockExamTakeClient";
import MockExamMstTakeClient from "./MockExamMstTakeClient";
import MockExamResultView from "./MockExamResultView";
import ApExamTakeClient from "./ApExamTakeClient";
import ApExamResultView from "./ApExamResultView";

// 고정형 SAT 모의고사 V1 — 독립 진입점(사양 4절 "학생 포털의 독립 모의고사 탭에서도 재개").
// 수업 화면 안 진입(세션 탭)은 이번 패스에서 배선하지 않았다(최종 보고 "미완료" 참고) — 이
// 라우트가 사양 4절이 말하는 "같은 응시 기록"의 유일한 진입점 역할을 한다.
//
// MST(4모듈) 세트는 별도 응시 클라이언트로 분기한다 — 상태(모듈·서버 기준 남은 시간·현재 모듈 문항)는
// mock_exam_mst_state RPC가 복구해 준다(새로고침·재접속 포함). 채점 완료 후 결과 화면은 공용.
export default async function StudentMockExamAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const { user, supabase } = await requireUser();
  // RPC 가 권한 없음·잘못된 id 로 오류를 던지면 500 대신 404 (남의 응시 URL 을 직접 열 때).
  const attempt = await loadMockExamAttemptDetail(supabase, attemptId).catch(() => null);
  if (!attempt || attempt.studentId !== user.id) notFound();

  // 2026-09-21(UAT 지적) — 이 라우트는 AdminShell/StudentShell 밖 독립 진입점이라 왼쪽
  // 네비게이션이 없다. 응시 중(MockExamTakeClient)은 원래 사양대로 집중이 필요한 화면이라
  // 그대로 두지만, 채점 완료된 결과 화면은 다 본 뒤 나갈 방법이 없어 학생이 갇힌 것처럼
  // 보였다 — 결과 화면에만 명시적 뒤로가기를 붙인다.
  const isGraded = attempt.status === "graded";
  // 2026-10-05 무료 회원 S4 — 채점된 결과 상단에만 "Talk with a tutor" 링크(무료 회원 한정, +1 RPC). UI 본문은 건드리지 않는다.
  const showTutoringCta = isGraded && !hasFeature(await loadStudentFeatureAccess(supabase, user.id).catch(() => []), "class");

  // 재응시: 회차가 둘 이상일 때만 요약 목록을 한 번 더 읽어 Attempt 1 | Attempt 2 전환을 만든다.
  const attempts = isGraded && (attempt.attemptTotal ?? 1) > 1
    ? (await loadStudentMockExamAttempts(supabase, user.id).catch(() => [])).filter((a) => a.setGroupId === attempt.setGroupId)
    : undefined;

  // AP 모의고사: 같은 엔진, AP 전용 응시·결과 화면(영어 UI).
  if (attempt.examProgram === "ap") {
    // w-full: body 가 flex-col 이라 mx-auto 만 있으면 main 이 내용 최소폭(문항 번호 줄 796px)까지 늘어나 모바일에서 가로 스크롤·번호 버튼 클릭 불가가 됐다(2026-10-09 화면 점검에서 발견). *
    return (
      <main className={`mx-auto w-full px-4 py-6 ${isGraded ? "max-w-4xl" : "max-w-5xl"}`}>
        {isGraded && (
          <Link href="/student?tab=mock-exam" className="mb-4 inline-block text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100">← Back</Link>
        )}
        <h1 className="mb-4 text-[18px] font-extrabold">
          {attempt.examSetName}
          {attempt.attemptNo && (attempt.attemptTotal ?? 1) > 1 ? <span className="ml-2 text-[13px] font-semibold text-grey-500">Attempt {attempt.attemptNo}</span> : null}
        </h1>
        {isGraded ? <ApExamResultView attempt={attempt} /> : <ApExamTakeClient attempt={attempt} />}
      </main>
    );
  }

  if (!isGraded && attempt.format === "mst") {
    const state = await loadMstAttemptStateAction(attemptId);
    if (!state.ok) throw new Error(state.error);
    return (
      <MockExamMstTakeClient
        initialState={state.value}
        examSetName={attempt.examSetName}
        mathCalculatorAllowed={attempt.mathCalculatorAllowed}
        mathReferenceSheetAllowed={attempt.mathReferenceSheetAllowed}
      />
    );
  }

  return (
    <main className={`mx-auto px-4 py-6 ${isGraded ? "max-w-6xl" : "max-w-4xl"}`}>
      {isGraded && (
        <Link
          href="/student?tab=mock-exam"
          className="mb-4 inline-block text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
        >
          ← Back
        </Link>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[18px] font-extrabold">
          {attempt.examSetName}
          {attempt.attemptNo && (attempt.attemptTotal ?? 1) > 1 ? <span className="ml-2 text-[13px] font-semibold text-grey-500">Attempt {attempt.attemptNo}</span> : null}
        </h1>
        {showTutoringCta && (
          <Link href="/student/tutoring?from=result" data-testid="result-tutoring-cta" className="text-[13px] font-bold text-white bg-brand-red rounded-lg px-3 py-1.5">
            Learn 1:1 with ALTON <span aria-hidden>↗</span>
          </Link>
        )}
      </div>
      {isGraded ? <MockExamResultView attempt={attempt} readOnly={false} attempts={attempts} attemptHref={(id) => `/student/mock-exam/${id}`} /> : <MockExamTakeClient attempt={attempt} />}
    </main>
  );
}
