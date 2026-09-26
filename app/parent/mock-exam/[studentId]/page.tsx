import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadGuardianMockExamAttempts } from "@/lib/mock-exam/attempt-data";

const STATUS_LABEL: Record<string, string> = {
  assigned: "시작 전",
  in_progress: "진행 중",
  submitted: "제출됨 — 채점 대기",
  graded: "채점 완료",
};

/** 학부모 읽기 전용 — 자녀의 모의고사 목록(사양 3절 학부모 흐름). RLS(guardian_students)가
 * 본인 자녀가 아닌 학생 id 를 넘기면 빈 목록을 돌려준다. */
export default async function ParentMockExamListPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { supabase } = await requireUser();
  const attempts = await loadGuardianMockExamAttempts(supabase, studentId);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-[18px] font-extrabold">모의고사</h1>
      {attempts.length === 0 ? (
        <p className="text-[13px] text-grey-500">배정된 모의고사가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {attempts.map((a) => (
            <li key={a.id} className="rounded-lg border border-grey-200 bg-white p-4">
              <p className="text-[14px] font-bold">{a.examSetName}</p>
              <p className="mt-1 text-[12.5px] text-grey-500">
                {STATUS_LABEL[a.status] ?? a.status}
                {a.status === "graded" && a.correctCount !== null && ` · ${a.correctCount}/${a.totalCount} 정답`}
              </p>
              {a.status === "graded" && (
                <Link href={`/parent/mock-exam/${studentId}/${a.id}`} className="mt-2 inline-block text-[12.5px] font-bold text-ink underline">
                  상세 결과 보기
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
