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

// --- 시험 만들기·채점 ---

type WordPoolEntry = { word: string; definition: string };

async function collectWordPool(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  studentId: string,
  source: { customWords: boolean; bookIds: string[] }
): Promise<WordPoolEntry[]> {
  const pool: WordPoolEntry[] = [];
  if (source.customWords) {
    const { data } = await supabase.from("vocab_words").select("word, definition").eq("student_id", studentId);
    for (const w of data ?? []) if (w.definition) pool.push({ word: w.word as string, definition: w.definition as string });
  }
  if (source.bookIds.length) {
    const { data } = await supabase.from("vocab_library_words").select("word, definition_ko").in("book_id", source.bookIds);
    for (const w of data ?? []) if (w.definition_ko) pool.push({ word: w.word as string, definition: w.definition_ko as string });
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

/** Quizlet 식 4지선다 — 정답 뜻 하나 + 같은 단어장 풀에서 뽑은 서로 다른 뜻 3개(오답), 새 AI 호출 없이 결정적으로 만든다. */
function buildQuizItems(pool: WordPoolEntry[], count: number): VocabQuizItem[] {
  const usable = pool.filter((w) => w.definition.trim());
  if (usable.length < 4) return [];
  const picked = shuffle(usable).slice(0, Math.min(count, usable.length));
  return picked.map((target) => {
    const decoyPool = usable.filter((w) => w.word !== target.word && w.definition.trim() !== target.definition.trim());
    const decoys = shuffle(decoyPool).slice(0, 3).map((d) => d.definition);
    const options = shuffle([target.definition, ...decoys]);
    return { word: target.word, definitionShown: target.word, options, correctIndex: options.indexOf(target.definition) };
  });
}

export async function createVocabQuizAction(input: {
  customWords: boolean; bookIds: string[]; count: number;
}): Promise<ActionResult<{ id: string; items: VocabQuizItem[] }>> {
  const { user, supabase } = await requireUser();
  const pool = await collectWordPool(supabase, user.id, input);
  const items = buildQuizItems(pool, Math.max(1, Math.min(50, input.count)));
  if (items.length === 0) return { ok: false, error: "선택한 단어장에 뜻이 있는 단어가 4개 이상 있어야 시험을 만들 수 있습니다." };
  const { data, error } = await supabase
    .from("vocab_quizzes")
    .insert({ owner_id: user.id, created_by: user.id, source: { customWords: input.customWords, bookIds: input.bookIds }, items, status: "pending" })
    .select("id")
    .single();
  if (error) return { ok: false, error: "시험을 만들지 못했습니다." };
  return { ok: true, value: { id: data.id as string, items } };
}

export async function submitVocabQuizAction(quizId: string, answers: number[]): Promise<ActionResult<{ score: number; total: number }>> {
  const { supabase } = await requireUser();
  const { data: quiz } = await supabase.from("vocab_quizzes").select("items, status").eq("id", quizId).maybeSingle();
  if (!quiz) return { ok: false, error: "시험을 찾을 수 없습니다." };
  if (quiz.status === "completed") return { ok: false, error: "이미 채점된 시험입니다." };
  const items = quiz.items as VocabQuizItem[];
  const score = items.reduce((acc, item, i) => acc + (answers[i] === item.correctIndex ? 1 : 0), 0);
  const { error } = await supabase
    .from("vocab_quizzes")
    .update({ status: "completed", score, total: items.length, answers, submitted_at: new Date().toISOString() })
    .eq("id", quizId);
  if (error) return { ok: false, error: "채점 결과를 저장하지 못했습니다." };
  return { ok: true, value: { score, total: items.length } };
}

/** 교사가 담당 학생의 수업 중 즉석으로 단어 시험을 낸다(2026-09-15: 실시간 push 는 범위 밖 — 학생이 단어장 화면에서 새로고침하면 보인다). */
export async function assignVocabQuizAction(input: {
  sessionId: string; studentId: string; customWords: boolean; bookIds: string[]; count: number;
}): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser();
  const pool = await collectWordPool(supabase, input.studentId, input);
  const items = buildQuizItems(pool, Math.max(1, Math.min(50, input.count)));
  if (items.length === 0) return { ok: false, error: "선택한 단어장에 뜻이 있는 단어가 4개 이상 있어야 시험을 낼 수 있습니다." };
  const { data, error } = await supabase.rpc("assign_vocab_quiz", {
    p_session_id: input.sessionId, p_owner_id: input.studentId,
    p_source: { customWords: input.customWords, bookIds: input.bookIds }, p_items: items,
  });
  if (error) return { ok: false, error: "담당하는 학생의 수업에만 단어 시험을 낼 수 있습니다." };
  return { ok: true, value: { id: data as string } };
}
