import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadMockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import MockExamResultView from "@/app/student/mock-exam/[attemptId]/MockExamResultView";

/** 학부모 읽기 전용 상세 결과(사양 3절 "요약 결과와 학습 진단을 읽기 전용으로", 2026-09-18 제품
 * 오너 지시로 1급 요구사항으로 격상). 답안 입력·시험 시작/제출·배정 변경은 이 화면에 없다 —
 * MockExamResultView 는 읽기 전용 마크업만 그린다(버튼·입력 없음). */
export default async function ParentMockExamResultPage({ params }: { params: Promise<{ studentId: string; attemptId: string }> }) {
  const { studentId, attemptId } = await params;
  const { supabase } = await requireUser();
  const attempt = await loadMockExamAttemptDetail(supabase, attemptId);
  if (!attempt || attempt.studentId !== studentId || attempt.status !== "graded") notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-[18px] font-extrabold">{attempt.examSetName}</h1>
      <p className="mb-4 text-[12.5px] text-grey-500">{attempt.studentName} 학생 결과</p>
      <MockExamResultView attempt={attempt} readOnly />
    </main>
  );
}
