import type { LibrarySubjectTree } from "@/lib/subject-material-library";
import MaterialLibraryTree from "@/app/materials/MaterialLibraryTree";

export default function MaterialsLibraryTab({ tree, isFreeMember = false }: { tree: LibrarySubjectTree[]; isFreeMember?: boolean }) {
  // 2026-10-05 무료 회원 S3 — 무료 회원은 관리자가 무료 공개한 자료만 본다(수강 과목 없음). 문구·빈 상태를 나눈다.
  return (
    <MaterialLibraryTree
      subjects={tree}
      description={
        isFreeMember
          ? "ALTON이 무료로 공개한 학습 자료를 단원·키워드 순서로 모아봅니다."
          : "내가 듣고 있는 과목의 교재를 단원·키워드 순서로 모아봅니다."
      }
      emptyMessage={
        isFreeMember
          ? "아직 공개된 무료 자료가 없어요. 자료가 준비되면 여기에서 바로 볼 수 있어요."
          : "아직 배정된 교재가 없어요. 담당 선생님이 곧 준비해드릴 예정이에요."
      }
      docHref={(docId) => `/materials/${docId}`}
    />
  );
}
