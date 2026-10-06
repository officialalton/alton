"use server";

import { createClient } from "@/utils/supabase/server";

/** 학생 포털 진입 하트비트 — students.last_active_at(10분 쓰로틀은 DB가 보장)·활동 일 테이블 갱신. 실패해도 화면에 영향 없음. */
export async function touchActivityAction(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("touch_student_activity");
  } catch {
    /* 하트비트 실패는 무시 */
  }
}
