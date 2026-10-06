import { requireUser } from "@/lib/auth";
import { loadMockExamOverview } from "@/lib/mock-exam/attempt-data";
import { buildMockExamListRows } from "@/lib/mock-exam/open-list";
import MockExamOpenList from "@/app/components/MockExamOpenList";

/** 학부모 읽기 전용 — 공개 모의고사 목록과 자녀의 시작·완료 상태(시작 불가). 자녀가 아닌 학생 id 면 RPC 가 거절한다. */
export default async function ParentMockExamListPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { supabase } = await requireUser();
  const { catalog, attempts } = await loadMockExamOverview(supabase, studentId);
  const rows = buildMockExamListRows(catalog, attempts);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-[18px] font-extrabold">Mock Exams</h1>
      <MockExamOpenList rows={rows} readOnly resultHref={(attemptId) => `/parent/mock-exam/${studentId}/${attemptId}`} />
    </main>
  );
}
