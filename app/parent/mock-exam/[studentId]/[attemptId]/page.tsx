import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadGuardianMockExamAttempts, loadMockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import MockExamResultView from "@/app/student/mock-exam/[attemptId]/MockExamResultView";

/** 학부모 읽기 전용 상세 결과(사양 3절 "요약 결과와 학습 진단을 읽기 전용으로", 2026-09-18 제품
 * 오너 지시로 1급 요구사항으로 격상). 답안 입력·시험 시작/제출·배정 변경은 이 화면에 없다 —
 * MockExamResultView 는 읽기 전용 마크업만 그린다(버튼·입력 없음). */
export default async function ParentMockExamResultPage({ params }: { params: Promise<{ studentId: string; attemptId: string }> }) {
  const { studentId, attemptId } = await params;
  const { supabase } = await requireUser();
  // RPC 가 권한 없음·잘못된 id 로 오류를 던지면 500 대신 404 (남의 응시 URL 을 직접 열 때).
  const attempt = await loadMockExamAttemptDetail(supabase, attemptId).catch(() => null);
  if (!attempt || attempt.studentId !== studentId || attempt.status !== "graded") notFound();

  // 재응시: 회차가 둘 이상일 때만 요약 목록을 한 번 더 읽어 회차 전환을 만든다(1회차뿐이면 추가 조회 없음).
  const attempts = (attempt.attemptTotal ?? 1) > 1
    ? (await loadGuardianMockExamAttempts(supabase, studentId).catch(() => [])).filter((a) => a.setGroupId === attempt.setGroupId)
    : undefined;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-[18px] font-extrabold">{attempt.examSetName}</h1>
      <p className="mb-4 text-[12.5px] text-grey-500">{attempt.studentName}&apos;s results</p>
      <MockExamResultView attempt={attempt} readOnly attempts={attempts} attemptHref={(id) => `/parent/mock-exam/${studentId}/${id}`} />
    </main>
  );
}
