import type { SupabaseClient } from "@supabase/supabase-js";

/** 2026-09-16(제품 오너 정정) — 정규 수업(v3 sessions)에 한해 학생·보호자가 Smart Notes
 * 회의록 원본을 열람(view-only)할 수 있다(RLS: 20261388). 원본 링크는 session_smart_notes에서
 * 온다 — RLS가 이미 "이 학생/보호자 본인" 또는 "담당 교사/관리자"로 걸러주므로 여기서는
 * 그대로 조회만 한다. 첫 상담(consultations)은 이 범위 밖이라 여기서 다루지 않는다. */
export async function loadSmartNotesViewUrl(supabase: SupabaseClient, sessionId: string): Promise<string | null> {
  const { data } = await supabase.from("session_smart_notes").select("drive_file_id").eq("session_id", sessionId).maybeSingle();
  const fileId = data?.drive_file_id as string | undefined;
  return fileId ? `https://docs.google.com/document/d/${fileId}/view` : null;
}
