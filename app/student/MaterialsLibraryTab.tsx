import type { LibrarySubjectTree } from "@/lib/subject-material-library";
import MaterialLibraryTree from "@/app/materials/MaterialLibraryTree";

export default function MaterialsLibraryTab({ tree }: { tree: LibrarySubjectTree[] }) {
  return (
    <MaterialLibraryTree
      subjects={tree}
      title="교재"
      description="내가 듣고 있는 과목의 교재를 단원·키워드 순서로 모아봅니다."
      emptyMessage="아직 배정된 교재가 없어요. 담당 선생님이 곧 준비해드릴 예정이에요."
      docHref={(docId) => `/materials/${docId}`}
    />
  );
}
