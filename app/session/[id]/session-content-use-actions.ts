"use server";

import { requireUser } from "@/lib/auth";

// R9(레슨 준비 Task 3) — session_content_use_events(append-only 이벤트 로그,
// supabase/migrations/20261234000000_r9_session_content_use_events.sql)에 대한
// 서버 액션 계층. 이 파일이 유일한 쓰기 경로다. "뷰/스크롤/탭 열기" 같은 수동적
// 신호로는 절대 이 액션이 호출되지 않는다 — session-view 탭 컴포넌트의 명시적
// "사용 처리" 버튼 클릭만 이 함수를 호출한다.
//
// 인가는 앱 레벨에서 다시 검사하지 않는다(session_annotation_events의
// appendClearAllEvent와 동일한 패턴) — 실제 방어선은 RLS(담당 선생님/관리자만
// INSERT 가능)와 복합 FK(이 세션의 session_content_manifest에 실제로 존재하는
// (content_type, content_id)만 참조 가능)다. 로그인 여부만 확인하고 나머지는
// DB 에러 메시지를 그대로 전달한다.

async function insertUseEvent(
  sessionId: string,
  contentType: "material_section" | "problem",
  contentId: string
): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("session_content_use_events").insert({
    session_id: sessionId,
    content_type: contentType,
    content_id: contentId,
    recorded_by: user.id,
  });
  if (error) throw new Error(error.message);
}

export async function markMaterialUsedInLesson(
  sessionId: string,
  sectionId: string
): Promise<void> {
  await insertUseEvent(sessionId, "material_section", sectionId);
}

export async function markProblemUsedInLesson(
  sessionId: string,
  problemId: string
): Promise<void> {
  await insertUseEvent(sessionId, "problem", problemId);
}
