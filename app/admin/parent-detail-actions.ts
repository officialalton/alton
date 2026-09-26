"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { setStudentConsultantAction } from "./consultant-assignment-actions";

// 관리자 Users > 학부모 상세(2026-09-24, R12 후속). 연결 자녀·담당 컨설턴트·
// 계약 현황·연락 이력을 한 화면에서 보고, 자녀별 컨설턴트 배정을 바꿀 수
// 있게 한다. 매칭 변경은 ConsultantDetailPanel과 같은
// setStudentConsultantAction()을 그대로 재사용한다 — 두 화면의 변경 결과가
// 항상 일치해야 하기 때문.

export type ParentDetailChild = {
  id: string;
  name: string | null;
  status: string;
  consultantId: string | null;
  consultantName: string | null;
};

export type ParentDetailContract = {
  id: string;
  childName: string | null;
  status: string;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export type ParentDetailMessage = {
  id: string;
  senderRole: string;
  senderName: string | null;
  body: string;
  createdAt: string;
};

export type ParentDetail = {
  id: string;
  name: string | null;
  status: string;
  joinedAt: string;
  location: string | null;
  referralCode: string | null;
  householdId: string | null;
  children: ParentDetailChild[];
  contracts: ParentDetailContract[];
  messages: ParentDetailMessage[];
};

const MESSAGE_HISTORY_LIMIT = 20;

export async function getParentDetailAction(parentId: string): Promise<ParentDetail> {
  const { supabase } = await requireAdmin();

  const [{ data: parentRow, error: parentError }, { data: guardianLinks, error: guardianError }] = await Promise.all([
    supabase.from("parents").select("id, joined_at, location, referral_code, status, profile:profiles(name)").eq("id", parentId).single(),
    supabase.from("household_members").select("household_id").eq("profile_id", parentId).eq("role", "guardian"),
  ]);
  if (parentError) throw new Error(parentError.message);

  const householdIds = (guardianLinks ?? []).map((l) => l.household_id as string);
  const householdId = householdIds[0] ?? null;

  const [{ data: childLinks }, { data: contractRows }, { data: messageRows }] = await Promise.all([
    householdId
      ? supabase.from("household_members").select("profile_id").eq("household_id", householdId).eq("role", "child")
      : Promise.resolve({ data: [] as { profile_id: string }[] }),
    householdIds.length > 0
      ? supabase
          .from("contracts")
          .select("id, status, created_at, voided_at, void_reason, child:profiles!contracts_child_id_fkey(name)")
          .in("household_id", householdIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    householdId
      ? supabase
          .from("household_messages")
          .select("id, sender_id, sender_role, body, created_at, sender:profiles(name)")
          .eq("household_id", householdId)
          .order("created_at", { ascending: false })
          .limit(MESSAGE_HISTORY_LIMIT)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const childIds = (childLinks ?? []).map((l) => (l as { profile_id: string }).profile_id);

  const [{ data: childProfiles }, { data: consultantLinks }] = await Promise.all([
    childIds.length > 0
      ? supabase.from("students").select("id, status, profile:profiles(name)").in("id", childIds)
      : Promise.resolve({ data: [] as never[] }),
    childIds.length > 0
      ? supabase
          .from("consultant_assignments")
          .select("student_id, consultant_id, consultant:profiles!consultant_assignments_consultant_id_fkey(name)")
          .in("student_id", childIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const consultantByChild = new Map<string, { id: string; name: string | null }>();
  for (const row of consultantLinks ?? []) {
    const r = row as { student_id: string; consultant_id: string; consultant: { name: string | null } | { name: string | null }[] | null };
    const consultant = Array.isArray(r.consultant) ? r.consultant[0] : r.consultant;
    consultantByChild.set(r.student_id, { id: r.consultant_id, name: consultant?.name ?? null });
  }

  const children: ParentDetailChild[] = (childProfiles ?? []).map((c) => {
    const row = c as { id: string; status: string; profile: { name: string | null } | { name: string | null }[] | null };
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const consultant = consultantByChild.get(row.id);
    return {
      id: row.id,
      name: profile?.name ?? null,
      status: row.status,
      consultantId: consultant?.id ?? null,
      consultantName: consultant?.name ?? null,
    };
  });

  const contracts: ParentDetailContract[] = (contractRows ?? []).map((row) => {
    const r = row as {
      id: string;
      status: string;
      created_at: string;
      voided_at: string | null;
      void_reason: string | null;
      child: { name: string | null } | { name: string | null }[] | null;
    };
    const child = Array.isArray(r.child) ? r.child[0] : r.child;
    return {
      id: r.id,
      childName: child?.name ?? null,
      status: r.status,
      createdAt: r.created_at,
      voidedAt: r.voided_at,
      voidReason: r.void_reason,
    };
  });

  const messages: ParentDetailMessage[] = (messageRows ?? []).map((row) => {
    const r = row as {
      id: string;
      sender_role: string;
      body: string;
      created_at: string;
      sender: { name: string | null } | { name: string | null }[] | null;
    };
    const sender = Array.isArray(r.sender) ? r.sender[0] : r.sender;
    return {
      id: r.id,
      senderRole: r.sender_role,
      senderName: sender?.name ?? null,
      body: r.body,
      createdAt: r.created_at,
    };
  });

  const parentProfile = Array.isArray(parentRow?.profile) ? parentRow?.profile[0] : parentRow?.profile;
  return {
    id: parentId,
    name: (parentProfile as { name: string | null } | null)?.name ?? null,
    status: (parentRow?.status as string) ?? "active",
    joinedAt: (parentRow?.joined_at as string) ?? "",
    location: (parentRow?.location as string | null) ?? null,
    referralCode: (parentRow?.referral_code as string | null) ?? null,
    householdId,
    children,
    contracts,
    messages,
  };
}

export async function setChildConsultantFromParentPanelAction(studentId: string, consultantEmail: string | null): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!consultantEmail) {
    await setStudentConsultantAction(studentId, null, "관리자 배정 해제(Users > 학부모)");
    return;
  }
  const { data: consultantId, error } = await supabase.rpc("find_profile_id_by_email", { p_email: consultantEmail.trim() });
  if (error) throw new Error(error.message);
  if (!consultantId) throw new Error("해당 이메일의 컨설턴트 계정을 찾을 수 없습니다.");
  await setStudentConsultantAction(studentId, consultantId as string, "관리자 배정 변경(Users > 학부모)");
}
