"use server";

import { requireUser } from "@/lib/auth";

// (2026-08-30 R2 정정) 예전엔 이 함수가 Calendly 링크 저장과 동시에
// status를 'active'로 직접 바꿨다. R2 §5.7부터는 계정 상태 전환이
// transition_account_status()(관리자 전용)를 통해서만 가능해 이 직접
// UPDATE는 DB 트리거가 차단한다 — 그리고 애초에 "선생님이 자기 스스로
// active로 전환"하는 것은 시급 설정 여부를 관리자가 확인하기 전에
// 활성화될 수 있다는 의미라 R2의 상태 관리 원칙과도 맞지 않는다. 이제 이
// 함수는 Calendly 링크만 저장하고, active 전환은 관리자가
// setTeacherStatus()(시급 이력 확인 포함)로 별도 승인한다.
export async function submitCalendlyOnboarding(url: string): Promise<void> {
  const { supabase, user } = await requireUser();

  const trimmed = url.trim();
  if (!trimmed) throw new Error("Calendly 예약 링크를 입력해주세요.");

  const { error } = await supabase
    .from("teachers")
    .update({ calendly_scheduling_url: trimmed })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
}
