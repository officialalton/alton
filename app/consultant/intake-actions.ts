"use server";

import { requireUser } from "@/lib/auth";
import { loadMyAssignedConsultations, type IntakeConsultation } from "./intake-data";

// 컨설턴트 Phase 1 — 배정 자체는 관리자(또는 assign_admissions_consultant
// capability 보유자, MVP에서는 관리자뿐)만 한다(스펙 §Assignment and Handoff
// Rules — 자동배정/셀프클레임은 Phase 2). 여기서는 이미 배정된 요청의 연락
// 완료 기록만 컨설턴트가 직접 한다.
export async function markConsultationContactedAction(consultationId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_consultation_contacted", { p_consultation_id: consultationId });
  if (error) throw new Error(error.message);
}

export async function loadMyAssignedConsultationsAction(): Promise<IntakeConsultation[]> {
  const { user, supabase } = await requireUser();
  return loadMyAssignedConsultations(supabase, user.id);
}
