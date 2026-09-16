"use server";

import { requireUser } from "@/lib/auth";
import type { VocabQuizItem } from "./vocab-library-data";

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

/** 내 단어장 — 추가·수정·삭제. RLS 가 student_id = auth.uid() 만 허용한다(본인 세션 클라이언트로 충분). */
export async function addMyVocabWordAction(input: {
  word: string; definition?: string; example?: string; example2?: string; synonymWords?: string[]; antonymWords?: string[]; folderId?: string | null;
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
      folder_id: input.folderId ?? null,
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

// --- 폴더 ---

export async function createVocabFolderAction(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  const { user, supabase } = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "폴더 이름을 입력하세요." };
  const { data, error } = await supabase
    .from("vocab_word_folders")
    .insert({ student_id: user.id, name: trimmed })
    .select("id, name")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? "이미 있는 폴더 이름입니다." : "폴더를 만들지 못했습니다." };
  return { ok: true, value: { id: data.id as string, name: data.name as string } };
}

/** 내 단어장의 커스텀 단어를 다른 폴더로 옮긴다(폴더 없음은 null). */
export async function setMyVocabWordFolderAction(wordId: string, folderId: string | null): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("vocab_words").update({ folder_id: folderId }).eq("id", wordId);
  if (error) return { ok: false, error: "폴더를 옮기지 못했습니다." };
  return { ok: true, value: undefined };
}

/** 공용 단어장의 단어를 "내 단어장"의 한 폴더에 저장한다(별표) — folderId가 null이면 저장을 취소(삭제)한다. */
export async function toggleLibraryWordInMyVocabAction(libraryWordId: string, folderId: string | null): Promise<ActionResult> {
  const { user, supabase } = await requireUser();
  if (folderId === null) {
    const { data: lw } = await supabase.from("vocab_library_words").select("word").eq("id", libraryWordId).maybeSingle();
    if (!lw) return { ok: false, error: "단어를 찾을 수 없습니다." };
    const { error } = await supabase.from("vocab_words").delete().eq("student_id", user.id).eq("word", lw.word as string);
    if (error) return { ok: false, error: "저장을 취소하지 못했습니다." };
    return { ok: true, value: undefined };
  }
  const { error } = await supabase.rpc("assign_library_words_to_student", {
    p_student_id: user.id, p_library_word_ids: [libraryWordId], p_folder_id: folderId,
  });
  if (error) return { ok: false, error: "단어장에 저장하지 못했습니다." };
  return { ok: true, value: undefined };
}

// --- 시험 만들기·채점·오답 노트 ---

type WordPoolEntry = {
  word: string; synonymWords: string[] | null;
  example1: string | null; example2: string | null; antonymWords: string[] | null;
};

async function collectWordPool(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  studentId: string,
  source: { customWords: boolean; bookIds: string[]; folderIds?: string[]; difficultyMin?: number; difficultyMax?: number }
): Promise<WordPoolEntry[]> {
  const pool: WordPoolEntry[] = [];
  if (source.customWords || (source.folderIds && source.folderIds.length)) {
    let query = supabase
      .from("vocab_words")
      .select("word, example, example2, similar_words, antonym_words, folder_id")
      .eq("student_id", studentId);
    if (source.folderIds && source.folderIds.length) query = query.in("folder_id", source.folderIds);
    const { data } = await query;
    for (const w of data ?? []) {
      const synonyms = w.similar_words as string[] | null;
      if (!synonyms || synonyms.length === 0) continue;
      pool.push({
        word: w.word as string, synonymWords: synonyms,
        example1: w.example as string | null, example2: w.example2 as string | null,
        antonymWords: w.antonym_words as string[] | null,
      });
    }
  }
  if (source.bookIds.length) {
    let query = supabase
      .from("vocab_library_words")
      .select("word, example1, example2, synonym_words, antonym_words, difficulty")
      .in("book_id", source.bookIds);
    if (source.difficultyMin != null) query = query.gte("difficulty", source.difficultyMin);
    if (source.difficultyMax != null) query = query.lte("difficulty", source.difficultyMax);
    const { data } = await query;
    for (const w of data ?? []) {
      const synonyms = w.synonym_words as string[] | null;
      if (!synonyms || synonyms.length === 0) continue;
      pool.push({
        word: w.word as string, synonymWords: synonyms,
        example1: w.example1 as string | null, example2: w.example2 as string | null,
        antonymWords: w.antonym_words as string[] | null,
      });
    }
  }
  return pool;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Quizlet 식 4지선다 — 선택지는 전부 영어(유의어 기반)다. 정답 유의어 하나 + 같은 풀에서 뽑은
 * 서로 다른 유의어 3개(오답), 새 AI 호출 없이 결정적으로 만든다. */
function buildQuizItems(pool: WordPoolEntry[], count: number): VocabQuizItem[] {
  const usable = pool.filter((w) => w.synonymWords && w.synonymWords[0]?.trim());
  if (usable.length < 4) return [];
  const picked = shuffle(usable).slice(0, Math.min(count, usable.length));
  return picked.map((target) => {
    const answer = target.synonymWords![0].trim();
    const decoyPool = usable.filter((w) => w.word !== target.word && w.synonymWords![0].trim().toLowerCase() !== answer.toLowerCase());
    const decoys = shuffle(decoyPool).slice(0, 3).map((d) => d.synonymWords![0].trim());
    const options = shuffle([answer, ...decoys]);
    return {
      word: target.word, definitionShown: target.word, options, correctIndex: options.indexOf(answer),
      example1: target.example1, example2: target.example2, synonymWords: target.synonymWords, antonymWords: target.antonymWords,
    };
  });
}

export async function createVocabQuizAction(input: {
  customWords: boolean; bookIds: string[]; count: number; folderIds?: string[];
}): Promise<ActionResult<{ id: string; items: VocabQuizItem[] }>> {
  const { user, supabase } = await requireUser();
  const pool = await collectWordPool(supabase, user.id, input);
  const items = buildQuizItems(pool, Math.max(1, Math.min(50, input.count)));
  if (items.length === 0) {
    return { ok: false, error: "영어 유의어가 있는 단어가 4개 이상 있어야 시험을 만들 수 있습니다(선택지가 영어라 유의어가 없는 단어는 낼 수 없습니다)." };
  }
  const { data, error } = await supabase
    .from("vocab_quizzes")
    .insert({
      owner_id: user.id, created_by: user.id,
      source: { customWords: input.customWords, bookIds: input.bookIds, folderIds: input.folderIds ?? [] },
      items, status: "pending",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "시험을 만들지 못했습니다." };
  return { ok: true, value: { id: data.id as string, items } };
}

/** 채점 + 오답을 "오답 노트" 폴더에 자동 저장, 맞힌 단어는(오답 노트에 있었다면) 거기서 뺀다. */
export async function submitVocabQuizAction(quizId: string, answers: number[]): Promise<ActionResult<{ score: number; total: number }>> {
  const { supabase } = await requireUser();
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
  const wrongItems = items.filter((it, idx) => answers[idx] !== it.correctIndex);
  const correctItems = items.filter((it, idx) => answers[idx] === it.correctIndex);

  if (wrongItems.length > 0) {
    const { data: folderId } = await supabase.rpc("ensure_default_vocab_folder", { p_student_id: studentId });
    for (const item of wrongItems) {
      const { data: existing } = await supabase.from("vocab_words").select("id").eq("student_id", studentId).eq("word", item.word).maybeSingle();
      const patch = {
        definition: item.options[item.correctIndex], example: item.example1 ?? null, example2: item.example2 ?? null,
        similar_words: item.synonymWords ?? null, antonym_words: item.antonymWords ?? null, folder_id: folderId as string,
      };
      if (existing) {
        await supabase.from("vocab_words").update(patch).eq("id", existing.id);
      } else {
        await supabase.from("vocab_words").insert({ student_id: studentId, word: item.word, ...patch });
      }
    }
  }
  if (correctItems.length > 0) {
    const { data: defaultFolder } = await supabase.from("vocab_word_folders").select("id").eq("student_id", studentId).eq("is_default", true).maybeSingle();
    if (defaultFolder) {
      await supabase
        .from("vocab_words")
        .update({ folder_id: null })
        .eq("student_id", studentId)
        .eq("folder_id", defaultFolder.id)
        .in("word", correctItems.map((it) => it.word));
    }
  }
  return { ok: true, value: { score, total: items.length } };
}

/** 교사가 담당 학생의 수업 중 즉석으로 단어 시험을 낸다(2026-09-15: 실시간 push 는 범위 밖 — 학생이 단어장 화면에서 새로고침하면 보인다). */
export async function assignVocabQuizAction(input: {
  sessionId: string | null; studentId: string; customWords: boolean; bookIds: string[]; count: number;
  folderIds?: string[]; difficultyMin?: number; difficultyMax?: number; dueAt?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser();
  const pool = await collectWordPool(supabase, input.studentId, input);
  const items = buildQuizItems(pool, Math.max(1, Math.min(50, input.count)));
  if (items.length === 0) return { ok: false, error: "선택한 단어 범위에 영어 유의어가 있는 단어가 4개 이상 있어야 시험을 낼 수 있습니다." };
  const { data, error } = await supabase.rpc("assign_vocab_quiz", {
    p_session_id: input.sessionId, p_owner_id: input.studentId,
    p_source: { customWords: input.customWords, bookIds: input.bookIds, folderIds: input.folderIds ?? [], difficultyMin: input.difficultyMin ?? null, difficultyMax: input.difficultyMax ?? null },
    p_items: items, p_due_at: input.dueAt ?? null,
  });
  if (error) return { ok: false, error: "담당하는 학생의 수업에만 단어 시험을 낼 수 있습니다." };
  return { ok: true, value: { id: data as string } };
}

/** 교사가 공용 단어장의 단어를 학생 개인 단어장에 배정 복사한다(폴더 지정). */
export async function assignLibraryWordsToStudentAction(studentId: string, libraryWordIds: string[], folderId: string | null = null): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("assign_library_words_to_student", {
    p_student_id: studentId, p_library_word_ids: libraryWordIds, p_folder_id: folderId,
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
