import type { SupabaseClient } from "@supabase/supabase-js";

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
