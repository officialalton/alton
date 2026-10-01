"use server";

import { requireUser } from "@/lib/auth";

/** 2026-09-15 — 과목별 전체 교재 보기: 마지막으로 읽던 섹션을 저장한다(본인 것만, HTML 교재). */
export async function saveReadingPosition(docId: string, sectionId: string | null): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("save_material_reading_position", {
    p_doc_id: docId,
    p_section_id: sectionId,
  });
  if (error) console.error("[materials] 읽던 위치 저장 실패:", error.message);
}
