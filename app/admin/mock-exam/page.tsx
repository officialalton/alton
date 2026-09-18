import { requireAdmin } from "@/lib/admin-auth";
import { listMockExamSets } from "../mock-exam-actions";
import MockExamSetsPanel from "./MockExamSetsPanel";

// 고정형 SAT 모의고사 V1 — 관리자 조립·공개 화면(독립 라우트).
//
// 2026-09-18: AdminShell의 탭 내비게이션(app/admin/admin-tabs.ts, AdminShell.tsx)에는
// 아직 편입하지 않았다 — 그 파일들은 여러 탭이 공유하는 대형 컴포넌트라 이번 마일스톤
// 범위(조립 레이어)만으로 건드리면 회귀 위험이 크고, CLAUDE.md 정책상 탭 구조 정리는
// 마일스톤 종료 때 한 번에 폴리싱한다. 이번 라운드에서는 /admin/mock-exam 독립 경로로
// 관리자가 바로 접근해 세트를 조립·검토·공개할 수 있게만 만든다.
export default async function MockExamAdminPage() {
  await requireAdmin();
  const sets = await listMockExamSets();
  return (
    <div className="min-h-screen bg-grey-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-semibold text-ink">고정형 모의고사 V1 — 세트 관리</h1>
        <p className="mt-1 text-sm text-grey-500">
          문제은행의 공개 문항만으로 영역·난이도 비중에 맞춘 고정형 세트를 조립·검토·공개합니다.
        </p>
        <MockExamSetsPanel initialSets={sets} />
      </div>
    </div>
  );
}
