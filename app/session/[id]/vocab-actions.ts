"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/utils/supabase/server";

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
  word: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: existing } = await supabase
    .from("vocab_words")
    .select("id, word, definition, example, similar_words, created_at")
    .eq("student_id", studentId)
    .ilike("word", word)
    .maybeSingle();

  if (existing) {
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

  const { data: inserted, error } = await supabase
    .from("vocab_words")
    .insert({
      student_id: studentId,
      word,
      definition: entry.definition,
      example: entry.example,
      similar_words: entry.similar,
      source_session_id: sourceSessionId,
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

export async function removeVocabWord(vocabId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vocab_words")
    .delete()
    .eq("id", vocabId);
  if (error) throw new Error(error.message);
}
