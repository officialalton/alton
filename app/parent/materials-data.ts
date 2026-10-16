import type { SupabaseClient } from "@supabase/supabase-js";
import { loadChildren } from "./children-data";
import { studentEnrolledSubjectIds } from "@/app/student/materials-data";
import { buildSubjectMaterialTree, type LibrarySubjectTree } from "@/lib/subject-material-library";

export type ParentChildLibrary = {
  childId: string;
  childName: string;
  tree: LibrarySubjectTree[];
};

// 2026-09-15 — 과목별 전체 교재 보기(보호자). 지금까지 보호자 포털에는 "교재" 진입점이
// 없었다. 자녀별로 그 자녀가 수강 중인 과목만(학생 쪽과 같은 원본 — subjectEnrolledSubjectIds)
// 보여준다. 보호자 본인 기준이 아니라 **자녀 기준**으로 접근 범위를 정한다.
export async function loadParentMaterialsLibrary(
  supabase: SupabaseClient,
  parentId: string
): Promise<ParentChildLibrary[]> {
  const children = await loadChildren(supabase, parentId);
  if (children.length === 0) return [];

  const result = await Promise.all(
    children.map(async (child) => {
      const subjects = await studentEnrolledSubjectIds(supabase, child.studentId);
      const tree = await buildSubjectMaterialTree(supabase, Array.from(subjects.keys()));
      return { childId: child.studentId, childName: child.name, tree };
    })
  );
  return result;
}
