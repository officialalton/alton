import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadMyVocabWords, loadLibraryBooks, loadVocabQuizzes, loadVocabFolders,
  type MyVocabWord, type LibraryBook, type VocabQuiz, type VocabFolder,
} from "@/app/student/vocab-library-data";

export type VocabEntry = {
  id: string;
  word: string;
  definition: string | null;
  example: string | null;
  similarWords: string[] | null;
  createdAt: string;
};

/**
 * 학생 단어장 — session_id로 필터링하지 않는다. functional-spec §5에
 * "학생 포털의 단어장과 데이터를 공유해야 한다"고 명시돼 있어서, 이 세션에서
 * 추가한 단어만이 아니라 이 학생이 지금까지 저장한 단어 전체를 보여준다.
 * (VocabClickLayer.tsx 의 지문 클릭 저장 흐름에서만 쓰인다.)
 */
export async function loadVocabWords(
  supabase: SupabaseClient,
  studentId: string
): Promise<VocabEntry[]> {
  const { data } = await supabase
    .from("vocab_words")
    .select("id, word, definition, example, similar_words, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((v) => ({
    id: v.id,
    word: v.word,
    definition: v.definition,
    example: v.example,
    similarWords: v.similar_words,
    createdAt: v.created_at,
  }));
}

export type SessionVocabData = {
  myWords: MyVocabWord[];
  books: LibraryBook[];
  quizzes: VocabQuiz[];
  folders: VocabFolder[];
};

/** 2026-09-15(제품 오너 정정) — 세션 화면 "단어장" 탭. 이 수업에 연결된 일부만
 * 보여주는 게 아니라 학생 단어장을 그대로 보여준다("단어장은 세션별 스냅샷이
 * 아니라 상시 누적 자산" — 여기서 별도로 복제·저장하지 않고 그대로 참조만 한다).
 * 교사는 여기서 바로 "즉석 시험"으로 시험보기를 선택할 수 있다(학생의 개별 폴더도 범위로 고를 수 있다). */
export async function loadSessionVocabData(supabase: SupabaseClient, studentId: string): Promise<SessionVocabData> {
  const [myWords, books, quizzes, folders] = await Promise.all([
    loadMyVocabWords(supabase, studentId),
    loadLibraryBooks(supabase),
    loadVocabQuizzes(supabase, studentId),
    loadVocabFolders(supabase, studentId),
  ]);
  return { myWords, books, quizzes, folders };
}
