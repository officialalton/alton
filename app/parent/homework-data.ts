import type { SupabaseClient } from "@supabase/supabase-js";
import { loadChildren } from "./children-data";
import { loadStudentHomeworkBatches, type HomeworkBatch } from "@/lib/homework-batch-data";

export type ParentChildHomework = {
  childId: string;
  childName: string;
  batches: HomeworkBatch[];
};

/** 보호자 — 자녀별 과제 배치 읽기 전용(제출·채점 버튼 없음). RLS의 is_guardian_of()가
 * 이미 조회 범위를 이 보호자의 자녀로만 제한한다. */
export async function loadParentHomeworkData(supabase: SupabaseClient, parentId: string): Promise<ParentChildHomework[]> {
  const children = await loadChildren(supabase, parentId);
  if (children.length === 0) return [];
  return Promise.all(
    children.map(async (child) => {
      const batches = await loadStudentHomeworkBatches(supabase, child.studentId);
      return { childId: child.studentId, childName: child.name, batches };
    })
  );
}
