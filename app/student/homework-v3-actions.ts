"use server";

// R9 corrective — v3 과제 답안 저장/제출 서버 액션. 인가는 전부
// session_homework_attempts의 RLS(20261240000000)에 위임한다(로그인만 확인) —
// session-prep-actions.ts의 pinSessionSelection과 동일한 얇은 액션 관례.

import { requireUser } from "@/lib/auth";

export async function saveHomeworkV3Draft(homeworkItemId: string, response: unknown) {
  const { user, supabase } = await requireUser();

  const { error } = await supabase.from("session_homework_attempts").upsert(
    {
      homework_item_id: homeworkItemId,
      student_id: user.id,
      response,
      submitted: false,
    },
    { onConflict: "homework_item_id,student_id" }
  );
  if (error) throw new Error(error.message);
}

export async function submitHomeworkV3(homeworkItemId: string, response: unknown) {
  const { user, supabase } = await requireUser();

  const { error } = await supabase.from("session_homework_attempts").upsert(
    {
      homework_item_id: homeworkItemId,
      student_id: user.id,
      response,
      submitted: true,
    },
    { onConflict: "homework_item_id,student_id" }
  );
  if (error) throw new Error(error.message);
}
