"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadGuardianConsultContext, loadGuardianConsultRequests, type RequestedChild } from "./consult-request-data";
import type { OpenConsultSlot } from "@/app/consult-actions";

// 2026-09-06 — 보호자 포털 "새 자녀 상담 신청". 랜딩 상담 신청(app/consult-actions.ts)과
// 완전히 동일한 단일 슬롯 원본(list_open_consult_slots() RPC)을 그대로 재사용하되,
// 신청 자체는 신규 RPC submit_guardian_portal_consult_request()를 호출한다(보호자
// 정보는 세션에서만 가져오고 클라이언트 입력을 받지 않는다 — household_id 위조 방지).
//
// 이 서버 액션은 자녀 Auth 계정이나 초대 이메일을 전혀 생성하지 않는다 — 신청
// 접수만 하고, 계정 생성은 여전히 관리자가 발송하는 기존 온보딩 흐름
// (app/admin/TrialOnboardingStudentsForm.tsx)의 몫이다.

export async function listOpenGuardianConsultSlots(fromIso: string, toIso: string): Promise<OpenConsultSlot[]> {
  await requireUser();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_open_consult_slots", { p_from: fromIso, p_to: toIso });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ slot_starts_at: string }>).map((r) => ({ startsAt: r.slot_starts_at }));
}

export async function getGuardianConsultContext() {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "parent") {
    throw new Error("보호자만 접근할 수 있습니다.");
  }
  const ctx = await loadGuardianConsultContext(supabase, user.id, user.email ?? "", profile.name ?? "학부모");
  if (!ctx) throw new Error("소속된 household가 없습니다. 관리자에게 문의해주세요.");
  return ctx;
}

export async function listGuardianConsultRequestsAction() {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "parent") {
    throw new Error("보호자만 접근할 수 있습니다.");
  }
  const ctx = await loadGuardianConsultContext(supabase, user.id, user.email ?? "", profile.name ?? "학부모");
  if (!ctx) return [];
  return loadGuardianConsultRequests(supabase, ctx.householdId);
}

export type SubmitGuardianConsultResult =
  | { ok: true; consultationId: string; status: string }
  | { ok: false; error: string };

function assertChildrenValid(children: RequestedChild[]): string | null {
  if (children.length === 0) return "자녀를 1명 이상 입력해주세요.";
  for (const c of children) {
    if (!c.name?.trim()) return "모든 자녀의 이름을 입력해주세요.";
  }
  return null;
}

/** 예외를 던지지 않고 { ok, error } 결과값으로 반환한다 — Next.js는 production
 * 환경에서 Server Action이 던진 에러를 마스킹한다(app/admin/workspace-actions.ts,
 * app/parent/invite-actions.ts와 동일 규칙 — "Minified React error #441" 재발 방지). */
export async function submitGuardianConsultRequest(params: {
  slotStartsAtIso: string;
  children: RequestedChild[];
}): Promise<SubmitGuardianConsultResult> {
  try {
    const { user, profile, supabase } = await requireUser();
    if (profile?.role !== "parent") {
      throw new Error("보호자만 상담을 신청할 수 있습니다.");
    }
    if (!params.slotStartsAtIso) {
      throw new Error("상담 희망 시간을 선택해주세요.");
    }
    const childrenError = assertChildrenValid(params.children);
    if (childrenError) throw new Error(childrenError);

    const ctx = await loadGuardianConsultContext(supabase, user.id, user.email ?? "", profile.name ?? "학부모");
    if (!ctx) throw new Error("소속된 household가 없습니다. 관리자에게 문의해주세요.");

    const admin = createAdminClient();
    const idempotencyKey = `guardian-portal-${ctx.householdId}-${params.slotStartsAtIso}`;
    const { data, error } = await admin.rpc("submit_guardian_portal_consult_request", {
      p_household_id: ctx.householdId,
      p_guardian_id: ctx.guardianId,
      p_guardian_name: ctx.guardianName,
      p_guardian_email: ctx.guardianEmail,
      p_starts_at: params.slotStartsAtIso,
      p_children: params.children.map((c) => ({
        name: c.name.trim(),
        grade: c.grade?.trim() || null,
        subjectInterest: c.subjectInterest?.trim() || null,
        concerns: c.concerns?.trim() || null,
      })),
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw new Error(error.message);
    const row = data as { id: string; status: string };
    return { ok: true, consultationId: row.id, status: row.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "상담 신청에 실패했습니다." };
  }
}
