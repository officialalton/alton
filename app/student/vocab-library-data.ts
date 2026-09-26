import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-09-15 — 단어장 재구성(docs/2026-09-15-vocab-library-plan.md). "내 단어장"(학생별, vocab_words)과
// "College Board 권별 단어장"(전 학생 공용, vocab_library_books/words)을 같은 화면에서 다룬다.

export type MyVocabWord = {
  id: string;
  word: string;
  definition: string | null;
  example: string | null;
  example2: string | null;
  synonymWords: string[] | null;
  antonymWords: string[] | null;
  createdAt: string;
  folderId: string | null;
};

export type LibraryBook = { id: string; volumeNo: number; title: string; wordCount: number };

export type LibraryWord = {
  id: string;
  word: string;
  definitionKo: string | null;
  synonymWords: string[] | null;
  antonymWords: string[] | null;
  example1: string | null;
  example2: string | null;
};

export async function loadMyVocabWords(supabase: SupabaseClient, studentId: string): Promise<MyVocabWord[]> {
  const { data } = await supabase
    .from("vocab_words")
    .select("id, word, definition, example, example2, similar_words, antonym_words, created_at, folder_id")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((v) => ({
    id: v.id as string,
    word: v.word as string,
    definition: v.definition as string | null,
    example: v.example as string | null,
    example2: v.example2 as string | null,
    synonymWords: v.similar_words as string[] | null,
    antonymWords: v.antonym_words as string[] | null,
    createdAt: v.created_at as string,
    folderId: v.folder_id as string | null,
  }));
}

export async function loadLibraryBooks(supabase: SupabaseClient): Promise<LibraryBook[]> {
  const { data: books } = await supabase.from("vocab_library_books").select("id, volume_no, title").order("volume_no", { ascending: true });
  if (!books?.length) return [];
  // 권당 정확한 개수를 head:true count로 따로 받는다 — 전체 단어를 한 번에 select하면
  // PostgREST 기본 응답 상한(1,000행)에 걸려 늦게 추가된 권(7·8권 등)의 개수가 0으로
  // 잘못 표시된다(실제 단어 목록은 별도 페이지네이션 쿼리라 영향 없음).
  const counts = await Promise.all(
    books.map((b) => supabase.from("vocab_library_words").select("id", { count: "exact", head: true }).eq("book_id", b.id as string))
  );
  return books.map((b, i) => ({ id: b.id as string, volumeNo: b.volume_no as number, title: b.title as string, wordCount: counts[i].count ?? 0 }));
}

export async function loadLibraryBookWords(supabase: SupabaseClient, bookId: string): Promise<LibraryWord[]> {
  const { data } = await supabase
    .from("vocab_library_words")
    .select("id, word, definition_ko, synonym_words, antonym_words, example1, example2")
    .eq("book_id", bookId)
    .order("position", { ascending: true });
  return (data ?? []).map((w) => ({
    id: w.id as string,
    word: w.word as string,
    definitionKo: w.definition_ko as string | null,
    synonymWords: w.synonym_words as string[] | null,
    antonymWords: w.antonym_words as string[] | null,
    example1: w.example1 as string | null,
    example2: w.example2 as string | null,
  }));
}

export type VocabQuizItem = {
  word: string;
  definitionShown: string;
  options: string[];
  correctIndex: number;
  example1?: string | null;
  example2?: string | null;
  synonymWords?: string[] | null;
  antonymWords?: string[] | null;
};
export type VocabQuizSource = { customWords: boolean; bookIds: string[]; folderIds: string[] };
export type VocabQuiz = {
  id: string;
  status: "pending" | "in_progress" | "completed";
  wordCount: number;
  items: VocabQuizItem[];
  score: number | null;
  total: number | null;
  answers: (number | null)[] | null;
  source: VocabQuizSource;
  createdAt: string;
  dueAt: string | null;
  sessionId: string | null;
  assignedByTeacher: boolean;
};

export async function loadVocabQuizzes(supabase: SupabaseClient, studentId: string, sessionId?: string): Promise<VocabQuiz[]> {
  let query = supabase
    .from("vocab_quizzes")
    .select("id, status, items, score, total, answers, source, created_at, created_by, owner_id, due_at, session_id")
    .eq("owner_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (sessionId) query = query.eq("session_id", sessionId);
  const { data } = await query;
  return (data ?? []).map((q) => ({
    id: q.id as string,
    status: q.status as "pending" | "in_progress" | "completed",
    wordCount: Array.isArray(q.items) ? q.items.length : 0,
    items: (q.items as VocabQuizItem[]) ?? [],
    score: q.score as number | null,
    total: q.total as number | null,
    answers: q.answers as (number | null)[] | null,
    source: (q.source as VocabQuizSource) ?? { customWords: false, bookIds: [], folderIds: [] },
    createdAt: q.created_at as string,
    dueAt: q.due_at as string | null,
    sessionId: q.session_id as string | null,
    assignedByTeacher: q.created_by !== q.owner_id,
  }));
}

export type VocabFolder = { id: string; name: string; isDefault: boolean };

/** 학생별 "내 단어장" 폴더 목록. 처음 호출이면 기본 폴더("오답 노트")를 만들어 함께 반환한다. */
export async function loadVocabFolders(supabase: SupabaseClient, studentId: string): Promise<VocabFolder[]> {
  await supabase.rpc("ensure_default_vocab_folder", { p_student_id: studentId });
  const { data } = await supabase
    .from("vocab_word_folders")
    .select("id, name, is_default")
    .eq("student_id", studentId)
    .order("is_default", { ascending: false })
    .order("position", { ascending: true });
  return (data ?? []).map((f) => ({ id: f.id as string, name: f.name as string, isDefault: f.is_default as boolean }));
}
