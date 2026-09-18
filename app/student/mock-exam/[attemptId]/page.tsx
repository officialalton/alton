import { notFound } from "next/navigation";
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

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-[18px] font-extrabold">{attempt.examSetName}</h1>
      {attempt.status === "graded" ? <MockExamResultView attempt={attempt} readOnly={false} /> : <MockExamTakeClient attempt={attempt} />}
    </main>
  );
}
