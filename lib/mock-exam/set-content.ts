import type { SupabaseClient } from "@supabase/supabase-js";

// 고정형 SAT 모의고사 V1 — 관리자·교사용 세트 문항 내용 미리보기(2026-09-21 UAT 지적).
// 학생 응시 데이터가 아니라 이미 공개된 문제은행 콘텐츠를 스태프가 확인하는 용도라
// mock_exam_set_content_for_staff RPC(SECURITY DEFINER, is_admin() or role='teacher')로 읽는다.

export type MockExamSetContentItem = {
  setItemId: string;
  section: "rw" | "math";
  position: number;
  problemId: string;
  satDomain: string;
  skillCode: string | null;
  difficulty: string;
  format: "mc" | "essay" | "math" | "spr";
  passage: string | null;
  question: string | null;
  options: string[] | null;
  figure: unknown;
  correctIndex: number | null;
  answers: string[] | null;
  explanation: string | null;
};

export async function loadMockExamSetContentForStaff(
  supabase: SupabaseClient,
  examSetId: string,
): Promise<MockExamSetContentItem[]> {
  const { data, error } = await supabase.rpc("mock_exam_set_content_for_staff", { p_exam_set_id: examSetId });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as MockExamSetContentItem[]) : [];
}
