"use server";

import { requireUser } from "@/lib/auth";

export async function saveHomeworkAnswer(itemId: string, answer: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("homework_items")
    .update({ student_answer: answer })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function addHomeworkItem(
  sessionId: string,
  title: string,
  description: string
) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("homework_items")
    .insert({ session_id: sessionId, title, description: description || null })
    .select("id, title, description, student_answer")
    .single();
  if (error) throw new Error(error.message);

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    studentAnswer: data.student_answer,
  };
}
