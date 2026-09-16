"use server";

import { requireUser } from "@/lib/auth";
import type { VocabQuizItem } from "./vocab-library-data";

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

/** 내 단어장 — 추가·수정·삭제. RLS 가 student_id = auth.uid() 만 허용한다(본인 세션 클라이언트로 충분). */
export async function addMyVocabWordAction(input: {
  word: string; definition?: string; example?: string; example2?: string; synonymWords?: string[]; antonymWords?: string[];
}): Promise<ActionResult<string>> {
  const { user, supabase } = await requireUser();
  const word = input.word.trim();
  if (!word) return { ok: false, error: "단어를 입력하세요." };
  const { data, error } = await supabase
    .from("vocab_words")
    .insert({
      student_id: user.id, word,
      definition: input.definition?.trim() || null, example: input.example?.trim() || null, example2: input.example2?.trim() || null,
      similar_words: input.synonymWords?.filter(Boolean) ?? null, antonym_words: input.antonymWords?.filter(Boolean) ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "단어를 추가하지 못했습니다." };
  return { ok: true, value: data.id as string };
}

export async function updateMyVocabWordAction(
  id: string,
  input: { word?: string; definition?: string; example?: string; example2?: string; synonymWords?: string[]; antonymWords?: string[] }
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const patch: Record<string, unknown> = {};
  if (input.word !== undefined) patch.word = input.word.trim();
  if (input.definition !== undefined) patch.definition = input.definition.trim() || null;
  if (input.example !== undefined) patch.example = input.example.trim() || null;
  if (input.example2 !== undefined) patch.example2 = input.example2.trim() || null;
  if (input.synonymWords !== undefined) patch.similar_words = input.synonymWords.filter(Boolean);
  if (input.antonymWords !== undefined) patch.antonym_words = input.antonymWords.filter(Boolean);
  const { error } = await supabase.from("vocab_words").update(patch).eq("id", id);
  if (error) return { ok: false, error: "단어를 수정하지 못했습니다." };
  return { ok: true, value: undefined };
}

export async function deleteMyVocabWordAction(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("vocab_words").delete().eq("id", id);
  if (error) return { ok: false, error: "단어를 삭제하지 못했습니다." };
  return { ok: true, value: undefined };
}

// --- 시험 만들기·채점·오답 복습 ---

type WordPoolEntry = {
  word: string; definition: string;
  example1: string | null; example2: string | null; synonymWords: string[] | null; antonymWords: string[] | null;
};

async function collectWordPool(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  studentId: string,
  source: { customWords: boolean; bookIds: string[]; difficultyMin?: number; difficultyMax?: number }
): Promise<WordPoolEntry[]> {
  const pool: WordPoolEntry[] = [];
  if (source.customWords) {
    const { data } = await supabase
      .from("vocab_words")
      .select("word, definition, example, example2, similar_words, antonym_words")
      .eq("student_id", studentId);
    for (const w of data ?? []) {
      if (!w.definition) continue;
      pool.push({
        word: w.word as string, definition: w.definition as string,
        example1: w.example as string | null, example2: w.example2 as string | null,
        synonymWords: w.similar_words as string[] | null, antonymWords: w.antonym_words as string[] | null,
      });
    }
  }
  if (source.bookIds.length) {
    let query = supabase
      .from("vocab_library_words")
      .select("word, definition_ko, example1, example2, synonym_words, antonym_words, difficulty")
      .in("book_id", source.bookIds);
    if (source.difficultyMin != null) query = query.gte("difficulty", source.difficultyMin);
    if (source.difficultyMax != null) query = query.lte("difficulty", source.difficultyMax);
    const { data } = await query;
    for (const w of data ?? []) {
      if (!w.definition_ko) continue;
      pool.push({
        word: w.word as string, definition: w.definition_ko as string,
        example1: w.example1 as string | null, example2: w.example2 as string | null,
        synonymWords: w.synonym_words as string[] | null, antonymWords: w.antonym_words as string[] | null,
      });
    }
  }
  return pool;
}

/** 오답 복습 큐에서 시험을 만들 때 쓰는 풀 — 스냅샷을 그대로 쓴다(원본이 바뀌었어도 그때 뜻 기준). */
async function collectReviewPool(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  studentId: string
): Promise<WordPoolEntry[]> {
  const { data } = await supabase
    .from("vocab_review_items")
    .select("word, definition, example1, example2, synonym_words, antonym_words")
    .eq("student_id", studentId)
    .is("cleared_at", null);
  return (data ?? [])
    .filter((r) => r.definition)
    .map((r) => ({
      word: r.word as string, definition: r.definition as string,
      example1: r.example1 as string | null, example2: r.example2 as string | null,
      synonymWords: r.synonym_words as string[] | null, antonymWords: r.antonym_words as string[] | null,
    }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Quizlet 식 4지선다 — 정답 뜻 하나 + 같은 단어장 풀에서 뽑은 서로 다른 뜻 3개(오답), 새 AI 호출 없이 결정적으로 만든다. */
function buildQuizItems(pool: WordPoolEntry[], count: number): VocabQuizItem[] {
  const usable = pool.filter((w) => w.definition.trim());
  if (usable.length < 4) return [];
  const picked = shuffle(usable).slice(0, Math.min(count, usable.length));
  return picked.map((target) => {
    const decoyPool = usable.filter((w) => w.word !== target.word && w.definition.trim() !== target.definition.trim());
    const decoys = shuffle(decoyPool).slice(0, 3).map((d) => d.definition);
    const options = shuffle([target.definition, ...decoys]);
    return {
      word: target.word, definitionShown: target.word, options, correctIndex: options.indexOf(target.definition),
      example1: target.example1, example2: target.example2, synonymWords: target.synonymWords, antonymWords: target.antonymWords,
    };
  });
}

export async function createVocabQuizAction(input: {
  customWords: boolean; bookIds: string[]; count: number; reviewOnly?: boolean;
}): Promise<ActionResult<{ id: string; items: VocabQuizItem[] }>> {
  const { user, supabase } = await requireUser();
  const pool = input.reviewOnly ? await collectReviewPool(supabase, user.id) : await collectWordPool(supabase, user.id, input);
  const items = buildQuizItems(pool, Math.max(1, Math.min(50, input.count)));
  if (items.length === 0) {
    return {
      ok: false,
      error: input.reviewOnly
        ? "복습 대상 단어가 4개 이상 있어야 복습 시험을 만들 수 있습니다."
        : "선택한 단어장에 뜻이 있는 단어가 4개 이상 있어야 시험을 만들 수 있습니다.",
    };
  }
  const { data, error } = await supabase
    .from("vocab_quizzes")
    .insert({
      owner_id: user.id, created_by: user.id,
      source: { customWords: input.customWords, bookIds: input.bookIds, reviewOnly: !!input.reviewOnly },
      items, status: "pending",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "시험을 만들지 못했습니다." };
  return { ok: true, value: { id: data.id as string, items } };
}

/** 채점 + 오답을 복습 큐에 적재, 이번에 맞춘 항목 중 열려 있던 복습 항목은 해소 처리한다. */
export async function submitVocabQuizAction(quizId: string, answers: number[]): Promise<ActionResult<{ score: number; total: number }>> {
  const { user, supabase } = await requireUser();
  const { data: quiz } = await supabase.from("vocab_quizzes").select("items, status, owner_id").eq("id", quizId).maybeSingle();
  if (!quiz) return { ok: false, error: "시험을 찾을 수 없습니다." };
  if (quiz.status === "completed") return { ok: false, error: "이미 채점된 시험입니다." };
  const items = quiz.items as VocabQuizItem[];
  const score = items.reduce((acc, item, i) => acc + (answers[i] === item.correctIndex ? 1 : 0), 0);
  const { error } = await supabase
    .from("vocab_quizzes")
    .update({ status: "completed", score, total: items.length, answers, submitted_at: new Date().toISOString() })
    .eq("id", quizId);
  if (error) return { ok: false, error: "채점 결과를 저장하지 못했습니다." };

  const studentId = quiz.owner_id as string;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const correct = answers[i] === item.correctIndex;
    if (!correct) {
      // "열린(cleared_at is null) 항목은 학생·단어당 하나" 제약이 부분 유니크 인덱스라 PostgREST의
      // upsert(onConflict)로는 추론되지 않는다(부분 인덱스는 조회 조건을 upsert 쪽에서 명시할 수
      // 없다) — 그래서 조회 후 있으면 update, 없으면 insert로 직접 나눈다.
      const { data: openRow } = await supabase
        .from("vocab_review_items").select("id")
        .eq("student_id", studentId).eq("word", item.word).is("cleared_at", null).maybeSingle();
      const patch = {
        definition: item.options[item.correctIndex],
        example1: item.example1 ?? null, example2: item.example2 ?? null,
        synonym_words: item.synonymWords ?? null, antonym_words: item.antonymWords ?? null,
        source_quiz_id: quizId, added_at: new Date().toISOString(),
      };
      if (openRow) {
        await supabase.from("vocab_review_items").update(patch).eq("id", openRow.id);
      } else {
        await supabase.from("vocab_review_items").insert({ student_id: studentId, word: item.word, ...patch });
      }
    } else {
      await supabase
        .from("vocab_review_items")
        .update({ cleared_at: new Date().toISOString() })
        .eq("student_id", studentId).eq("word", item.word).is("cleared_at", null);
    }
  }
  void user;
  return { ok: true, value: { score, total: items.length } };
}

/** 교사가 담당 학생의 수업 중 즉석으로 단어 시험을 낸다(2026-09-15: 실시간 push 는 범위 밖 — 학생이 단어장 화면에서 새로고침하면 보인다). */
export async function assignVocabQuizAction(input: {
  sessionId: string | null; studentId: string; customWords: boolean; bookIds: string[]; count: number;
  difficultyMin?: number; difficultyMax?: number; dueAt?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser();
  const pool = await collectWordPool(supabase, input.studentId, input);
  const items = buildQuizItems(pool, Math.max(1, Math.min(50, input.count)));
  if (items.length === 0) return { ok: false, error: "선택한 단어 범위에 뜻이 있는 단어가 4개 이상 있어야 시험을 낼 수 있습니다." };
  const { data, error } = await supabase.rpc("assign_vocab_quiz", {
    p_session_id: input.sessionId, p_owner_id: input.studentId,
    p_source: { customWords: input.customWords, bookIds: input.bookIds, difficultyMin: input.difficultyMin ?? null, difficultyMax: input.difficultyMax ?? null },
    p_items: items, p_due_at: input.dueAt ?? null,
  });
  if (error) return { ok: false, error: "담당하는 학생의 수업에만 단어 시험을 낼 수 있습니다." };
  return { ok: true, value: { id: data as string } };
}

/** 교사가 공용 단어장의 단어를 학생 개인 단어장에 배정 복사한다. */
export async function assignLibraryWordsToStudentAction(studentId: string, libraryWordIds: string[]): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("assign_library_words_to_student", {
    p_student_id: studentId, p_library_word_ids: libraryWordIds,
  });
  if (error) return { ok: false, error: "담당하는 학생에게만 단어를 배정할 수 있습니다." };
  return { ok: true, value: undefined };
}

/** 라이브러리 단어 검색(교사가 세션/포털에서 배정할 단어를 고를 때). */
export async function searchLibraryWordsAction(query: string, bookId?: string): Promise<
  { id: string; word: string; definitionKo: string | null; bookTitle: string; difficulty: number | null }[]
> {
  const { supabase } = await requireUser();
  let q = supabase
    .from("vocab_library_words")
    .select("id, word, definition_ko, difficulty, book:vocab_library_books(title)")
    .limit(30);
  if (bookId) q = q.eq("book_id", bookId);
  if (query.trim()) q = q.ilike("word", `${query.trim()}%`);
  const { data } = await q;
  return (data ?? []).map((w) => {
    const book = Array.isArray(w.book) ? w.book[0] : w.book;
    return {
      id: w.id as string, word: w.word as string, definitionKo: w.definition_ko as string | null,
      bookTitle: (book as { title?: string } | null)?.title ?? "", difficulty: w.difficulty as number | null,
    };
  });
}
