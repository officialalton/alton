import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

// 공유 비프로덕션 테스트 데이터 정리 — **실행 전 집계 전용**.
//
// 아무것도 바꾸지 않는다. 비활성화·아카이브·삭제를 하지 않고 건수만 센다.
// 정리 실행은 별도 승인과 별도 경로로 한다(2026-09-12 확정: 실행 전 대상
// 건수·제외 대상·보존 계정 영향·복구 방법을 먼저 보고한다).
//
// DB 비밀번호를 주고받지 않기 위해 앱의 기존 서버 조회 경로를 쓴다. 관리자가
// 로그인한 상태로 이 주소를 열면 결과가 나온다 — company-documents-preflight와
// 같은 방식이다.
//
// 보존 대상 두 계정은 id를 코드에 박지 않고 이메일로 찾아 확인만 한다.
const PRESERVED_EMAILS = ["official@alton.education", "teacher1@alton.education"];

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function countOf(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  apply?: (q: any) => any
): Promise<number | null> {
  let query: any = admin.from(table).select("*", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  // 집계에 실패한 항목은 0으로 속이지 않고 null로 남긴다 — 미집계를 추측으로
  // 메우면 그 수치를 근거로 데이터를 지우게 된다.
  if (error) return null;
  return count ?? 0;
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "관리자만 확인할 수 있습니다." }, { status: 403 });
  }

  const admin = createAdminClient();

  // 보존 계정 — 실제 사용자 id를 확인해 두어야 정리 대상에서 확실히 뺄 수 있다.
  const preserved: Array<{ email: string; found: boolean; userId?: string; role?: string }> = [];
  const { data: userPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const email of PRESERVED_EMAILS) {
    const user = (userPage?.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      preserved.push({ email, found: false });
      continue;
    }
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    preserved.push({ email, found: true, userId: user.id, role: (profile?.role as string) ?? "(프로필 없음)" });
  }

  const preservedIds = preserved.filter((p) => p.userId).map((p) => p.userId as string);
  const nowIso = new Date().toISOString();

  const [
    profilesTotal,
    households,
    householdsArchived,
    subjects,
    subjectsArchived,
    docs,
    docsArchived,
    docsPublished,
    problems,
    keywords,
    overlays,
    overlaysActive,
    teacherAssignmentsActive,
    enrollmentsActive,
    subjectEnrollments,
    reservationsFutureConfirmed,
    sessionsTotal,
    contracts,
  ] = await Promise.all([
    countOf(admin, "profiles"),
    countOf(admin, "households"),
    countOf(admin, "households", (q) => q.not("archived_at", "is", null)),
    countOf(admin, "subjects"),
    countOf(admin, "subjects", (q) => q.not("archived_at", "is", null)),
    countOf(admin, "curriculum_docs"),
    countOf(admin, "curriculum_docs", (q) => q.not("archived_at", "is", null)),
    countOf(admin, "curriculum_docs", (q) => q.eq("status", "published")),
    countOf(admin, "problems"),
    countOf(admin, "subject_keywords"),
    countOf(admin, "student_curriculum_overlays"),
    countOf(admin, "student_curriculum_overlays", (q) => q.eq("status", "active")),
    countOf(admin, "teacher_assignments", (q) => q.eq("status", "active")),
    countOf(admin, "enrollments", (q) => q.eq("status", "active")),
    countOf(admin, "subject_enrollments"),
    countOf(admin, "reservations", (q) => q.eq("status", "confirmed").gt("starts_at", nowIso)),
    countOf(admin, "sessions"),
    countOf(admin, "contracts"),
  ]);

  // 역할별 사용자 — 정리 대상은 "보존 2계정을 뺀 나머지"다.
  const { data: roleRows } = await admin.from("profiles").select("id, role");
  const byRole: Record<string, { total: number; toDeactivate: number }> = {};
  for (const r of roleRows ?? []) {
    const role = (r.role as string) ?? "(없음)";
    byRole[role] = byRole[role] ?? { total: 0, toDeactivate: 0 };
    byRole[role].total += 1;
    if (!preservedIds.includes(r.id as string)) byRole[role].toDeactivate += 1;
  }

  // 보존 계정에 걸린 오래된 테스트 연결 — 계정을 남긴다고 이것들까지 활성으로
  // 두지 않는다(2026-09-12 확정).
  const preservedImpact: Record<string, number | null> = {};
  if (preservedIds.length) {
    preservedImpact.teacherAssignmentsActive = await countOf(admin, "teacher_assignments", (q) =>
      q.eq("status", "active").in("teacher_id", preservedIds)
    );
    preservedImpact.enrollmentsActive = await countOf(admin, "enrollments", (q) =>
      q.eq("status", "active").in("teacher_id", preservedIds)
    );
    preservedImpact.curriculumTemplates = await countOf(admin, "teacher_curriculum_templates", (q) =>
      q.in("teacher_id", preservedIds)
    );
  }

  // 진행 중 수업은 강제 종료하지 않는다 — 따로 세어 보고한다.
  const { data: liveSessions } = await admin
    .from("sessions")
    .select("id, final_status, started_at")
    .is("final_status", null)
    .not("started_at", "is", null);

  return NextResponse.json({
    generatedAt: nowIso,
    note: "읽기 전용 집계입니다. 이 경로는 아무것도 바꾸지 않습니다.",
    preserved,
    users: { total: profilesTotal, byRole },
    households: { total: households, alreadyArchived: householdsArchived },
    subjects: { total: subjects, alreadyArchived: subjectsArchived },
    curriculumDocs: { total: docs, alreadyArchived: docsArchived, published: docsPublished },
    problems: { total: problems },
    keywords: { total: keywords },
    curriculumOverlays: { total: overlays, active: overlaysActive },
    matching: {
      teacherAssignmentsActive,
      legacyEnrollmentsActive: enrollmentsActive,
      subjectEnrollments,
    },
    reservations: { futureConfirmed: reservationsFutureConfirmed },
    sessions: { total: sessionsTotal, inProgress: liveSessions?.length ?? 0 },
    contracts: { total: contracts },
    preservedAccountImpact: preservedImpact,
  });
}
