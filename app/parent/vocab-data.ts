import type { SupabaseClient } from "@supabase/supabase-js";
import { loadChildren } from "./children-data";
import {
  loadMyVocabWords, loadVocabQuizzes, loadVocabFolders, loadLibraryBooks,
  type MyVocabWord, type VocabQuiz, type VocabFolder, type LibraryBook,
} from "@/app/student/vocab-library-data";

export type ParentChildVocab = {
  childId: string;
  childName: string;
  myWords: MyVocabWord[];
  quizzes: VocabQuiz[];
  folders: VocabFolder[];
};

export type ParentVocabData = {
  children: ParentChildVocab[];
  /** 공용 단어장 목록 — 자녀와 무관하게 하나만 불러온다(학생 포털과 동일한 라이브러리). */
  books: LibraryBook[];
};

/** 보호자 — 자녀별 단어장·시험 이력 읽기 전용(응시·CRUD 버튼 없음). RLS의
 * is_guardian_of() 가 이미 조회 범위를 이 보호자의 자녀로만 제한한다. */
export async function loadParentVocabData(supabase: SupabaseClient, parentId: string): Promise<ParentVocabData> {
  const children = await loadChildren(supabase, parentId);
  const [childrenVocab, books] = await Promise.all([
    children.length === 0
      ? Promise.resolve<ParentChildVocab[]>([])
      : Promise.all(
          children.map(async (child) => {
            const [myWords, quizzes, folders] = await Promise.all([
              loadMyVocabWords(supabase, child.studentId),
              loadVocabQuizzes(supabase, child.studentId),
              loadVocabFolders(supabase, child.studentId),
            ]);
            return { childId: child.studentId, childName: child.name, myWords, quizzes, folders };
          })
        ),
    loadLibraryBooks(supabase),
  ]);
  return { children: childrenVocab, books };
}
