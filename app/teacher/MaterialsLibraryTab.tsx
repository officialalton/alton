import type { LibrarySubjectTree } from "@/lib/subject-material-library";
import MaterialLibraryTree from "@/app/materials/MaterialLibraryTree";

// 2026-09-09(UAT 지적, 제품 오너 승인) — 교사 포털 "교재" 탭. 2026-09-15부터 학생 쪽과 같은
// 과목 → 단원 → 키워드 트리를 공유 컴포넌트로 그린다.
export default function TeacherMaterialsLibraryTab({ tree }: { tree: LibrarySubjectTree[] }) {
  return (
    <MaterialLibraryTree
      subjects={tree}
      description="Published materials for the subjects you teach, organized by unit and keyword."
      emptyMessage="No published materials yet. They will appear here once an admin publishes them."
      docHref={(docId) => `/materials/${docId}`}
    />
  );
}
