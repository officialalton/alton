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

/** 학습 이용 이벤트(오답노트·단어·자료 열람). 10분 디듀프는 DB가 보장, 실패는 무시. */
export async function logLearningEventAction(kind: "mistake_review_opened" | "vocab_study_opened", refId?: string): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_learning_event", { p_kind: kind, p_ref_id: refId ?? null });
  } catch {
    /* 추적 실패는 무시 */
  }
}
