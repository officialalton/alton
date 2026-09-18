import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadStudentMockExamAttempts } from "@/lib/mock-exam/attempt-data";

const STATUS_LABEL: Record<string, string> = {
  assigned: "시작 전",
  in_progress: "진행 중",
  submitted: "제출됨 — 채점 대기",
  graded: "채점 완료",
};

// 고정형 SAT 모의고사 V1 — 학생 포털 독립 `모의고사` 탭(사양 4절). StudentShell 전체 네비게이션
// 배선은 이번 패스 범위 밖(다른 브랜치가 app/student/StudentShell.tsx 를 동시에 만지고 있어
// 표면적을 최소화했다 — 최종 보고 참고). 지금은 이 경로로 직접 접근한다.
export default async function StudentMockExamListPage() {
  const { user, supabase } = await requireUser();
  const attempts = await loadStudentMockExamAttempts(supabase, user.id);

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
              {a.status !== "graded" && (
                <Link href={`/student/mock-exam/${a.id}`} className="mt-2 inline-block text-[12.5px] font-bold text-ink underline">
                  {a.status === "assigned" ? "시험 시작" : "이어서 풀기"}
                </Link>
              )}
              {a.status === "graded" && (
                <Link href={`/student/mock-exam/${a.id}`} className="mt-2 inline-block text-[12.5px] font-bold text-ink underline">
                  결과 보기
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
