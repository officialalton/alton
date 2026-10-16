"use server";

import { requireUser } from "@/lib/auth";

// 2026-10-05 무료 회원 S4 — 수락 후 예약 이탈 복귀: 보호자가 "상담 시간 선택" 배너에서 예약 링크를 (재)발급받는다.
// RPC가 household guardian·free_member 소스·미예약·배정됨을 검사한다(20262100000004).
export async function reissueFreeMemberSchedulingLinkAction(consultationId: string): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("reissue_consult_scheduling_link_for_parent", { p_consultation_id: consultationId });
  if (error) {
    const m = error.message;
    if (m.includes("not_assigned")) return { ok: false, error: "A consultant hasn't been assigned yet. We'll email you as soon as one is." };
    if (m.includes("already_scheduled")) return { ok: false, error: "This consultation is already scheduled." };
    return { ok: false, error: "We couldn't open the scheduling page. Please try again." };
  }
  if (typeof data !== "string" || !data) return { ok: false, error: "We couldn't open the scheduling page. Please try again." };
  return { ok: true, path: `/schedule/${data}` };
}

// 2026-10-05 무료 회원 S5 — 보호자가 학습 요약 공유(컨설턴트 열람)를 철회한다. RPC가 household guardian/관리자만 허용한다.
export async function revokeLearningSummarySharingAction(studentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("revoke_learning_summary_grant", { p_student_id: studentId });
  if (error) return { ok: false, error: "We couldn't stop sharing right now. Please try again." };
  return { ok: true };
}
