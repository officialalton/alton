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
export type VocabQuiz = {
  id: string;
  status: "pending" | "completed";
  wordCount: number;
  items: VocabQuizItem[];
  score: number | null;
  total: number | null;
  answers: number[] | null;
  createdAt: string;
  dueAt: string | null;
  sessionId: string | null;
  assignedByTeacher: boolean;
};

export async function loadVocabQuizzes(supabase: SupabaseClient, studentId: string, sessionId?: string): Promise<VocabQuiz[]> {
  let query = supabase
    .from("vocab_quizzes")
    .select("id, status, items, score, total, answers, created_at, created_by, owner_id, due_at, session_id")
    .eq("owner_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (sessionId) query = query.eq("session_id", sessionId);
  const { data } = await query;
  return (data ?? []).map((q) => ({
    id: q.id as string,
    status: q.status as "pending" | "completed",
    wordCount: Array.isArray(q.items) ? q.items.length : 0,
    items: (q.items as VocabQuizItem[]) ?? [],
    score: q.score as number | null,
    total: q.total as number | null,
    answers: q.answers as number[] | null,
    createdAt: q.created_at as string,
    dueAt: q.due_at as string | null,
    sessionId: q.session_id as string | null,
    assignedByTeacher: q.created_by !== q.owner_id,
  }));
}

export type VocabReviewItem = {
  id: string;
  word: string;
  definition: string | null;
  example1: string | null;
  example2: string | null;
  synonymWords: string[] | null;
  antonymWords: string[] | null;
  addedAt: string;
};

/** 학생별 오답 복습 큐(상시 누적 — 세션과 무관, 클리어될 때까지 유지). */
export async function loadVocabReviewItems(supabase: SupabaseClient, studentId: string): Promise<VocabReviewItem[]> {
  const { data } = await supabase
    .from("vocab_review_items")
    .select("id, word, definition, example1, example2, synonym_words, antonym_words, added_at")
    .eq("student_id", studentId)
    .is("cleared_at", null)
    .order("added_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    word: r.word as string,
    definition: r.definition as string | null,
    example1: r.example1 as string | null,
    example2: r.example2 as string | null,
    synonymWords: r.synonym_words as string[] | null,
    antonymWords: r.antonym_words as string[] | null,
    addedAt: r.added_at as string,
  }));
}

export type SessionVocabWord = {
  linkId: string;
  word: string;
  definition: string | null;
  example1: string | null;
  example2: string | null;
  synonymWords: string[] | null;
  antonymWords: string[] | null;
  isCustom: boolean;
};

/** 세션 화면 전용 — 단어장 전체가 아니라 이 수업에서 교사가 연결(배정)했거나
 * 학생이 이 수업 중 지문에서 클릭 저장한 단어만 반환한다. */
export async function loadSessionVocab(supabase: SupabaseClient, sessionId: string, studentId: string): Promise<SessionVocabWord[]> {
  const { data: links } = await supabase
    .from("vocab_session_links")
    .select("id, library_word_id, custom_word_id")
    .eq("session_id", sessionId)
    .eq("student_id", studentId);

  const libraryIds = (links ?? []).filter((l) => l.library_word_id).map((l) => l.library_word_id as string);
  const linkedCustomIds = (links ?? []).filter((l) => l.custom_word_id).map((l) => l.custom_word_id as string);
  const linkIdByWordId = new Map((links ?? []).map((l) => [(l.library_word_id ?? l.custom_word_id) as string, l.id as string]));

  const result: SessionVocabWord[] = [];

  if (libraryIds.length) {
    const { data: libWords } = await supabase
      .from("vocab_library_words")
      .select("id, word, definition_ko, example1, example2, synonym_words, antonym_words")
      .in("id", libraryIds);
    for (const w of libWords ?? []) {
      result.push({
        linkId: linkIdByWordId.get(w.id as string) ?? (w.id as string),
        word: w.word as string, definition: w.definition_ko as string | null,
        example1: w.example1 as string | null, example2: w.example2 as string | null,
        synonymWords: w.synonym_words as string[] | null, antonymWords: w.antonym_words as string[] | null,
        isCustom: false,
      });
    }
  }

  // 이 수업 중 지문에서 클릭 저장한 단어(source_session_id) + 교사가 이 세션에 명시적으로 연결한 커스텀 단어.
  const { data: sourcedWords } = await supabase
    .from("vocab_words")
    .select("id, word, definition, example, example2, similar_words, antonym_words")
    .eq("student_id", studentId)
    .eq("source_session_id", sessionId);
  const customIds = new Set([...linkedCustomIds, ...((sourcedWords ?? []).map((w) => w.id as string))]);
  let extraCustom: typeof sourcedWords = [];
  const missingIds = linkedCustomIds.filter((id) => !(sourcedWords ?? []).some((w) => w.id === id));
  if (missingIds.length) {
    const { data } = await supabase
      .from("vocab_words")
      .select("id, word, definition, example, example2, similar_words, antonym_words")
      .in("id", missingIds);
    extraCustom = data ?? [];
  }
  for (const w of [...(sourcedWords ?? []), ...extraCustom]) {
    if (!customIds.has(w.id as string)) continue;
    result.push({
      linkId: linkIdByWordId.get(w.id as string) ?? (w.id as string),
      word: w.word as string, definition: w.definition as string | null,
      example1: w.example as string | null, example2: w.example2 as string | null,
      synonymWords: w.similar_words as string[] | null, antonymWords: w.antonym_words as string[] | null,
      isCustom: true,
    });
  }

  return result;
}
