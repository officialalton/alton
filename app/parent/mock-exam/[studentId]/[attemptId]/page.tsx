import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadGuardianMockExamAttempts, loadMockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import MockExamResultView from "@/app/student/mock-exam/[attemptId]/MockExamResultView";
import ApExamResultView from "@/app/student/mock-exam/[attemptId]/ApExamResultView";
import { loadEssayScores } from "@/lib/essay-grading/view";
import { flagEnabled as essayAiEnabledFlag } from "@/lib/essay-grading/costs";
import { essayGradingSubject } from "@/lib/essay-grading/subject";

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

  // AP 응시는 SAT 결과 화면이 아니라 AP 결과 화면(읽기 전용, 영어 UI)으로 보여 준다 — 학생 화면과 같은 점수·채점 중 표시 정책.
  if (attempt.examProgram === "ap") {
    const essaySupported = essayGradingSubject(attempt.apSubject);
    const essayAi = essaySupported && essayAiEnabledFlag();
    const essayScores = essaySupported ? await loadEssayScores(supabase, attemptId) : [];
    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-1 text-[18px] font-extrabold">{attempt.examSetName}</h1>
        <p className="mb-4 text-[12.5px] text-grey-500">{attempt.studentName}&apos;s results</p>
        <ApExamResultView attempt={attempt} readOnly attempts={attempts} essayScores={essayScores} essayAiEnabled={essayAi} essayScoringSupported={essaySupported} attemptHrefBase={`/parent/mock-exam/${studentId}/`} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-[18px] font-extrabold">{attempt.examSetName}</h1>
      <p className="mb-4 text-[12.5px] text-grey-500">{attempt.studentName}&apos;s results</p>
      <MockExamResultView attempt={attempt} readOnly attempts={attempts} attemptHrefBase={`/parent/mock-exam/${studentId}/`} />
    </main>
  );
}
