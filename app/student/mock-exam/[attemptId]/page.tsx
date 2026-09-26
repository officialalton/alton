import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadMockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import MockExamTakeClient from "./MockExamTakeClient";
import MockExamResultView from "./MockExamResultView";

// 고정형 SAT 모의고사 V1 — 독립 진입점(사양 4절 "학생 포털의 독립 모의고사 탭에서도 재개").
// 수업 화면 안 진입(세션 탭)은 이번 패스에서 배선하지 않았다(최종 보고 "미완료" 참고) — 이
// 라우트가 사양 4절이 말하는 "같은 응시 기록"의 유일한 진입점 역할을 한다.
export default async function StudentMockExamAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const { user, supabase } = await requireUser();
  const attempt = await loadMockExamAttemptDetail(supabase, attemptId);
  if (!attempt || attempt.studentId !== user.id) notFound();

  // 2026-09-21(UAT 지적) — 이 라우트는 AdminShell/StudentShell 밖 독립 진입점이라 왼쪽
  // 네비게이션이 없다. 응시 중(MockExamTakeClient)은 원래 사양대로 집중이 필요한 화면이라
  // 그대로 두지만, 채점 완료된 결과 화면은 다 본 뒤 나갈 방법이 없어 학생이 갇힌 것처럼
  // 보였다 — 결과 화면에만 명시적 뒤로가기를 붙인다.
  const isGraded = attempt.status === "graded";
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      {isGraded && (
        <Link
          href="/student?tab=mock-exam"
          className="mb-4 inline-block text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
        >
          ← 뒤로
        </Link>
      )}
      <h1 className="mb-4 text-[18px] font-extrabold">{attempt.examSetName}</h1>
      {isGraded ? <MockExamResultView attempt={attempt} readOnly={false} /> : <MockExamTakeClient attempt={attempt} />}
    </main>
  );
}
