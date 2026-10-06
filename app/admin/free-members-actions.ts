"use server";

// 2026-10-05 무료 회원 S5 — 관리자 "무료 회원" 탭 데이터. 읽기 전용(쓰기 없음).
// 학습 상세는 열지 않는다: 목록은 가입일·응시 횟수·관심 상태만 보여준다.

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadEmailById } from "./users-data";

export type FreeMemberRow = {
  id: string;
  name: string;
  email: string;
  signedUpAt: string | null;
  attempts: number;
  interestStatus: string | null;
};
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
  members: FreeMemberRow[];
  interests: FreeMemberInterestRow[];
  manualReview: GuardianLinkReviewRow[];
  events: GuardianLinkEventRow[];
};

const MEMBER_LIMIT = 200;

export async function loadFreeMembersOverviewAction(): Promise<FreeMembersOverview> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: students, error: sErr } = await admin
    .from("students")
    .select("id, joined_at")
    .eq("member_type", "free")
    .order("joined_at", { ascending: false })
    .limit(MEMBER_LIMIT);
  if (sErr) throw new Error(sErr.message);
  const ids = (students ?? []).map((s) => s.id as string);

  const [profilesRes, attemptsRes, interestsRes, invitesRes, emails] = await Promise.all([
    ids.length ? admin.from("profiles").select("id, name").in("id", ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? admin.from("mock_exam_attempts").select("student_id").in("student_id", ids) : Promise.resolve({ data: [], error: null }),
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
    loadEmailById(ids),
  ]);
  for (const r of [profilesRes, attemptsRes, interestsRes, invitesRes]) if (r.error) throw new Error(r.error.message);

  const nameById = new Map((profilesRes.data ?? []).map((p) => [p.id as string, (p.name as string) ?? ""]));
  const attemptsBy = new Map<string, number>();
  for (const a of attemptsRes.data ?? []) attemptsBy.set(a.student_id as string, (attemptsBy.get(a.student_id as string) ?? 0) + 1);

  const interests = interestsRes.data ?? [];
  const openInterestByStudent = new Map<string, string>();
  for (const i of interests) {
    if (!openInterestByStudent.has(i.student_id as string)) openInterestByStudent.set(i.student_id as string, i.status as string);
  }

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
    members: (students ?? []).map((s) => ({
      id: s.id as string,
      name: nameById.get(s.id as string) ?? "",
      email: emails.get(s.id as string) ?? "",
      signedUpAt: (s.joined_at as string) ?? null,
      attempts: attemptsBy.get(s.id as string) ?? 0,
      interestStatus: openInterestByStudent.get(s.id as string) ?? null,
    })),
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
