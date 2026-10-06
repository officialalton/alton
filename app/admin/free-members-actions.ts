"use server";

// 2026-10-05 무료 회원 S5 → 2026-10-06 Free Accounts "Review queue"(상담 관심·보호자 연결 수동 검토·초대 이벤트). 읽기 전용.
// 회원 목록은 admin_free_accounts_list RPC(free-accounts-actions.ts)로 이관 — 전 회원 응시 행을 읽던 경로는 삭제했다.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export type FreeMemberInterestRow = {
  id: string;
  studentId: string;
  studentName: string;
  status: string;
  entryPoint: string | null;
  consultationId: string | null;
  createdAt: string;
};
export type GuardianLinkReviewRow = {
  id: string;
  studentId: string;
  studentName: string;
  emailNormalized: string;
  reason: string | null;
  createdAt: string;
};
export type GuardianLinkEventRow = {
  id: string;
  inviteId: string;
  eventType: string;
  studentName: string;
  createdAt: string;
};
export type FreeMembersOverview = {
  interests: FreeMemberInterestRow[];
  manualReview: GuardianLinkReviewRow[];
  events: GuardianLinkEventRow[];
};

const MEMBER_LIMIT = 200;

export async function loadFreeMembersOverviewAction(): Promise<FreeMembersOverview> {
  await requireAdminOrCapability("학생관리");
  const admin = createAdminClient();

  const [interestsRes, invitesRes] = await Promise.all([
    admin
      .from("student_consult_interests")
      .select("id, student_id, status, entry_point, consultation_id, created_at")
      .order("created_at", { ascending: false })
      .limit(MEMBER_LIMIT),
    admin
      .from("guardian_link_invites")
      .select("id, student_id, email_normalized, status, manual_review_reason, created_at")
      .order("created_at", { ascending: false })
      .limit(MEMBER_LIMIT),
  ]);
  for (const r of [interestsRes, invitesRes]) if (r.error) throw new Error(r.error.message);
  const nameById = new Map<string, string>();

  const interests = interestsRes.data ?? [];
  // 관심·초대 행의 학생 이름(무료 회원 목록 밖 학생 — 이미 전환된 학생 — 도 이름은 필요).
  const otherIds = Array.from(
    new Set([...interests.map((i) => i.student_id as string), ...(invitesRes.data ?? []).map((i) => i.student_id as string)])
  ).filter((id) => !nameById.has(id));
  if (otherIds.length) {
    const { data: more } = await admin.from("profiles").select("id, name").in("id", otherIds);
    for (const p of more ?? []) nameById.set(p.id as string, (p.name as string) ?? "");
  }

  const reviewInvites = (invitesRes.data ?? []).filter((i) => i.status === "manual_review");
  const inviteIds = (invitesRes.data ?? []).map((i) => i.id as string);
  const inviteStudent = new Map((invitesRes.data ?? []).map((i) => [i.id as string, i.student_id as string]));
  const { data: events, error: eErr } = inviteIds.length
    ? await admin
        .from("guardian_link_invite_events")
        .select("id, invite_id, event_type, created_at")
        .in("invite_id", inviteIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };
  if (eErr) throw new Error(eErr.message);

  return {
    interests: interests
      .filter((i) => !["cancelled", "expired"].includes(i.status as string))
      .map((i) => ({
        id: i.id as string,
        studentId: i.student_id as string,
        studentName: nameById.get(i.student_id as string) ?? "",
        status: i.status as string,
        entryPoint: (i.entry_point as string) ?? null,
        consultationId: (i.consultation_id as string) ?? null,
        createdAt: i.created_at as string,
      })),
    manualReview: reviewInvites.map((i) => ({
      id: i.id as string,
      studentId: i.student_id as string,
      studentName: nameById.get(i.student_id as string) ?? "",
      emailNormalized: i.email_normalized as string,
      reason: (i.manual_review_reason as string) ?? null,
      createdAt: i.created_at as string,
    })),
    events: (events ?? []).map((e) => ({
      id: e.id as string,
      inviteId: e.invite_id as string,
      eventType: e.event_type as string,
      studentName: nameById.get(inviteStudent.get(e.invite_id as string) ?? "") ?? "",
      createdAt: e.created_at as string,
    })),
  };
}
