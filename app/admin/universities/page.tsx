import { requireAdmin } from "@/lib/admin-auth";
import { listUniversities } from "@/lib/universities/actions";
import UniversitiesPanel from "./UniversitiesPanel";

// 대학 진학 정보 DB Part 2 — 관리자 마스터 데이터 관리 화면(독립 라우트).
//
// 2026-09-19: /admin/mock-exam과 같은 패턴 — AdminShell 탭 내비게이션에는 아직 편입하지
// 않는다(탭 구조 정리는 마일스톤 종료 때 한 번에 폴리싱). 이번 라운드는 관리자가
// /admin/universities로 직접 접근해 200개교 마스터 데이터를 검색하고, 대학별 입시
// 사이클(연도별)·업데이트 타임라인을 입력하는 CRUD 화면만 만든다. AI 리서치 초안
// 자동화는 다음 단계(이 화면이 그 초안을 받아 검수하는 대상이 된다).
export default async function AdminUniversitiesPage() {
  await requireAdmin();
  const universities = await listUniversities();
  return (
    <div className="min-h-screen bg-grey-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-xl font-semibold text-ink">대학 진학 정보 DB — 마스터 관리</h1>
        <p className="mt-1 text-sm text-grey-500">
          상위 200개교 마스터 데이터를 검색하고, 대학별 입시 사이클(연도별)과 업데이트 타임라인을
          입력·검수합니다. 합격 확률/가능성 예측 기능은 정책상 포함하지 않습니다.
        </p>
        <UniversitiesPanel initialUniversities={universities} />
      </div>
    </div>
  );
}
