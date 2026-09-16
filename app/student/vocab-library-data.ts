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
    .select("id, word, definition, example, example2, similar_words, antonym_words, created_at")
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
  }));
}

export async function loadLibraryBooks(supabase: SupabaseClient): Promise<LibraryBook[]> {
  const { data: books } = await supabase.from("vocab_library_books").select("id, volume_no, title").order("volume_no", { ascending: true });
  if (!books?.length) return [];
  const { data: counts } = await supabase.from("vocab_library_words").select("book_id");
  const countByBook = new Map<string, number>();
  for (const c of counts ?? []) countByBook.set(c.book_id as string, (countByBook.get(c.book_id as string) ?? 0) + 1);
  return books.map((b) => ({ id: b.id as string, volumeNo: b.volume_no as number, title: b.title as string, wordCount: countByBook.get(b.id as string) ?? 0 }));
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

export type VocabQuizItem = { word: string; definitionShown: string; options: string[]; correctIndex: number };
export type VocabQuiz = {
  id: string;
  status: "pending" | "completed";
  wordCount: number;
  items: VocabQuizItem[];
  score: number | null;
  total: number | null;
  answers: number[] | null;
  createdAt: string;
  assignedByTeacher: boolean;
};

export async function loadVocabQuizzes(supabase: SupabaseClient, studentId: string): Promise<VocabQuiz[]> {
  const { data } = await supabase
    .from("vocab_quizzes")
    .select("id, status, items, score, total, answers, created_at, created_by, owner_id")
    .eq("owner_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((q) => ({
    id: q.id as string,
    status: q.status as "pending" | "completed",
    wordCount: Array.isArray(q.items) ? q.items.length : 0,
    items: (q.items as VocabQuizItem[]) ?? [],
    score: q.score as number | null,
    total: q.total as number | null,
    answers: q.answers as number[] | null,
    createdAt: q.created_at as string,
    assignedByTeacher: q.created_by !== q.owner_id,
  }));
}
