import type { LibrarySubjectTree } from "@/lib/subject-material-library";
import MaterialLibraryTree from "@/app/materials/MaterialLibraryTree";

// 2026-09-09(UAT 지적, 제품 오너 승인) — 교사 포털 "교재" 탭. 2026-09-15부터 학생 쪽과 같은
// 과목 → 단원 → 키워드 트리를 공유 컴포넌트로 그린다.
export default function TeacherMaterialsLibraryTab({ tree }: { tree: LibrarySubjectTree[] }) {
  return (
    <MaterialLibraryTree
      subjects={tree}
      title="교재"
      description="내가 담당하는 과목의 공개된 교재를 단원·키워드 순서로 모아봅니다."
      emptyMessage="아직 공개된 교재가 없어요. 관리자가 교재를 공개하면 여기 보여드릴게요."
      docHref={(docId) => `/materials/${docId}`}
    />
  );
}
