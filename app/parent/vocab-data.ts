import type { SupabaseClient } from "@supabase/supabase-js";
import { loadChildren } from "./children-data";
import { loadMyVocabWords, loadVocabQuizzes, loadVocabFolders, type MyVocabWord, type VocabQuiz, type VocabFolder } from "@/app/student/vocab-library-data";

export type ParentChildVocab = {
  childId: string;
  childName: string;
  myWords: MyVocabWord[];
  quizzes: VocabQuiz[];
  folders: VocabFolder[];
};

/** 보호자 — 자녀별 단어장·시험 이력 읽기 전용(응시·CRUD 버튼 없음). RLS의
 * is_guardian_of() 가 이미 조회 범위를 이 보호자의 자녀로만 제한한다. */
export async function loadParentVocabData(supabase: SupabaseClient, parentId: string): Promise<ParentChildVocab[]> {
  const children = await loadChildren(supabase, parentId);
  if (children.length === 0) return [];
  return Promise.all(
    children.map(async (child) => {
      const [myWords, quizzes, folders] = await Promise.all([
        loadMyVocabWords(supabase, child.studentId),
        loadVocabQuizzes(supabase, child.studentId),
        loadVocabFolders(supabase, child.studentId),
      ]);
      return { childId: child.studentId, childName: child.name, myWords, quizzes, folders };
    })
  );
}
