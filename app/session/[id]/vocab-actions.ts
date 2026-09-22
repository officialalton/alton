"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateVocabEntry(word: string) {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    tools: [
      {
        name: "vocab_entry",
        description: "학생 단어장에 저장할 단어 뜻풀이를 만든다.",
        input_schema: {
          type: "object",
          properties: {
            definition: {
              type: "string",
              description: "이 단어의 뜻 — 간결한 한국어 설명",
            },
            example: {
              type: "string",
              description: "이 단어를 사용한 새로운 예문 (영단어면 영어 문장)",
            },
            similar: {
              type: "array",
              items: { type: "string" },
              description: "비슷한 뜻의 단어 3개",
            },
          },
          required: ["definition", "example", "similar"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "vocab_entry" },
    messages: [
      {
        role: "user",
        content: `SAT/AP 수업 교재를 읽던 학생이 모르는 단어 "${word}"를 단어장에 저장하려고 합니다. 이 단어의 뜻, 예문, 비슷한 단어 3개를 정리해주세요.`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI 응답을 처리할 수 없습니다.");
  }
  return toolUse.input as {
    definition: string;
    example: string;
    similar: string[];
  };
}

export async function addVocabWord(
  studentId: string,
  sourceSessionId: string,
  word: string,
  folderId?: string | null,
) {
  const { supabase } = await requireUser();

  const { data: existing } = await supabase
    .from("vocab_words")
    .select("id, word, definition, example, similar_words, created_at, folder_id")
    .eq("student_id", studentId)
    .ilike("word", word)
    .maybeSingle();

  if (existing) {
    // 2026-09-21(사용자 지시) — 이미 있는 단어를 다른 폴더에 저장하려 한 것이면 폴더만 옮긴다.
    if (folderId !== undefined && folderId !== existing.folder_id) {
      await supabase.from("vocab_words").update({ folder_id: folderId }).eq("id", existing.id);
    }
    return {
      id: existing.id,
      word: existing.word,
      definition: existing.definition,
      example: existing.example,
      similarWords: existing.similar_words,
      createdAt: existing.created_at,
      alreadyExisted: true,
    };
  }

  const entry = await generateVocabEntry(word);

  // 2026-09-22(버그 수정) — `/session/[id]`는 legacy_sessions 도 같은 화면으로 보여준다
  // (loadNormalizedSession). legacy_sessions 의 id 는 `sessions` 테이블엔 없어
  // source_session_id FK(= sessions(id))를 위반해 저장 자체가 실패했다(Vercel 로그로
  // 확인: "vocab_words_source_session_id_fkey"). 실제 sessions 에 있는 id 만 연결하고,
  // 레거시 세션에서 저장하면 세션 연결 없이(= null) 저장한다 — 단어 저장은 계속 된다.
  const { data: realSession } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sourceSessionId)
    .maybeSingle();

  const { data: inserted, error } = await supabase
    .from("vocab_words")
    .insert({
      student_id: studentId,
      word,
      definition: entry.definition,
      example: entry.example,
      similar_words: entry.similar,
      source_session_id: realSession ? sourceSessionId : null,
      folder_id: folderId ?? null,
    })
    .select("id, word, definition, example, similar_words, created_at")
    .single();
  if (error) throw new Error(error.message);

  return {
    id: inserted.id,
    word: inserted.word,
    definition: inserted.definition,
    example: inserted.example,
    similarWords: inserted.similar_words,
    createdAt: inserted.created_at,
    alreadyExisted: false,
  };
}

export type SessionVocabFolder = { id: string; name: string; isDefault: boolean };

/** 단어 클릭 저장 팝업의 폴더 선택지 — 학생 본인/담당 선생님 둘 다 부를 수 있다
 * (vocab_word_folders SELECT 정책이 이미 담당 선생님을 허용한다). */
export async function loadSessionVocabFolders(studentId: string): Promise<SessionVocabFolder[]> {
  const { supabase } = await requireUser();
  await supabase.rpc("ensure_default_vocab_folder", { p_student_id: studentId });
  const { data } = await supabase
    .from("vocab_word_folders")
    .select("id, name, is_default")
    .eq("student_id", studentId)
    .order("is_default", { ascending: false })
    .order("position", { ascending: true });
  return (data ?? []).map((f) => ({ id: f.id as string, name: f.name as string, isDefault: f.is_default as boolean }));
}

/** 새 폴더를 만든다(학생 본인 또는 담당 선생님) — create_named_vocab_folder RPC 사용
 * (vocab_word_folders는 본인 학생 insert 정책만 있어 선생님은 직접 insert할 수 없다). */
export async function createSessionVocabFolder(studentId: string, name: string): Promise<SessionVocabFolder> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_named_vocab_folder", { p_student_id: studentId, p_name: name });
  if (error) throw new Error(error.message);
  const row = data as { id: string; name: string; is_default: boolean };
  return { id: row.id, name: row.name, isDefault: row.is_default };
}

export async function removeVocabWord(vocabId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("vocab_words")
    .delete()
    .eq("id", vocabId);
  if (error) throw new Error(error.message);
}
