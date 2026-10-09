import type { LibrarySubjectTree } from "@/lib/subject-material-library";
import MaterialLibraryTree from "@/app/materials/MaterialLibraryTree";

export default function MaterialsLibraryTab({ tree, isFreeMember = false }: { tree: LibrarySubjectTree[]; isFreeMember?: boolean }) {
  // 2026-10-05 무료 회원 S3 — 무료 회원은 관리자가 무료 공개한 자료만 본다(수강 과목 없음). 문구·빈 상태를 나눈다.
  return (
    <MaterialLibraryTree
      subjects={tree}
      description={
        isFreeMember
          ? "Free study materials shared by ALTON EDUCATION, organized by unit and keyword."
          : "Materials for the subjects you're taking, organized by unit and keyword."
      }
      emptyMessage={
        isFreeMember
          ? "No free materials have been published yet. They'll show up here as soon as they're ready."
          : "No materials have been assigned yet. Your teacher will have them ready soon."
      }
      docHref={(docId) => `/materials/${docId}`}
    />
  );
}
