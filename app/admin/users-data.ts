import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";

export type ParentListItem = {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  childrenNames: string[];
};

export type StudentListItem = {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  status: string;
  creditBalance: number;
  parentNames: string[];
  subjectNames: string[];
  // M4 UAT #2(2026-09-05): 학생 프로필 완성 단계에서 수집한 정보(관리자 열람용).
  dateOfBirth: string | null;
  dateOfBirthVerifiedAt: string | null;
  schoolName: string | null;
  satScore: number | null;
  gpa: number | null;
  gpaScale: string | null;
  targetColleges: string[];
  intendedMajors: string[];
  profileCompletedAt: string | null;
  apCourseCount: number;
  extracurricularCount: number;
};

export type TeacherListItem = {
  id: string;
  name: string;
  email: string;
  school: string | null;
  status: string;
  qcWarningCount: number;
  subjectNames: string[];
  assignedSubjectIds: string[];
  hourlyRateKrw: number | null;
};

export type CreditTransaction = {
  id: string;
  type: string;
  amount: number;
  reason: string | null;
  createdAt: string;
};

export type QcWarning = {
  id: string;
  type: string;
  detail: string | null;
  occurredAt: string;
  studentName: string | null;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

// 2026-09-10(P1 — 사용자 탭 이메일 조회 성능 배치) — 처음에는 Admin API
// 첫 페이지(perPage: 200)만 읽어 200명 넘으면 이메일이 누락되는 버그가
// 있었고, 그 다음엔 정확성을 위해 대상을 다 찾을 때까지 페이지를 전부
// 순회하도록 고쳤지만 Auth 사용자 수가 많은 환경(Preview처럼 몇 주간
// UAT가 누적된 곳)에서 대상이 뒷페이지에 있으면 왕복이 계속 늘어났다.
// 이제 auth.users를 id로 직접 조회하는 SECURITY DEFINER 함수
// get_emails_by_user_ids(migration 20261271000000, service_role 전용)를
// RPC로 호출한다 — 대상이 몇 명이든, 전체 Auth 사용자 수와 무관하게 항상
// 왕복 1회로 끝나고, 페이지 제한이 없어 정확성도 그대로 유지된다.
export async function loadEmailById(userIds: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const emailById = new Map<string, string>();
  if (userIds.length === 0) return emailById;

  const { data, error } = await admin.rpc("get_emails_by_user_ids", { p_user_ids: userIds });
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as { user_id: string; email: string | null }[]) {
    emailById.set(row.user_id, row.email ?? "");
  }
  return emailById;
}

// 2026-09-10(P1 — 학부모 SSR 회귀 조사 후속) — 이 함수는 이제 SSR
// Promise.all에서 호출되지 않고(admin/page.tsx), listParentsForUsersTabAction()을
// 통해서만 호출된다. 어느 단계가 느리거나 실패하는지 구분할 수 있도록 각
// 쿼리 단계마다 소요 시간·건수·오류 코드를 구조화된 로그로 남긴다 — 이름·
// 이메일 등 개인정보는 기록하지 않는다(건수·id 개수만).
function logUsersTabStage(stage: string, startedAt: number, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event: "server_timing", stage, ms: Date.now() - startedAt, ...extra }));
}

export async function loadParents(supabase: SupabaseClient): Promise<ParentListItem[]> {
  const totalStart = Date.now();

  let t = Date.now();
  const { data: parents, error: parentsError } = await supabase
    .from("parents")
    .select("id, joined_at, profile:profiles(name)")
    .order("joined_at", { ascending: false });
  logUsersTabStage("users_tab.parents.query", t, { count: parents?.length ?? 0, errorCode: parentsError?.code ?? null });
  if (parentsError) throw new Error(`parents_query_failed:${parentsError.code ?? "unknown"}`);
  if (!parents || parents.length === 0) return [];

  const parentIds = parents.map((p) => p.id);

  // (2026-08-30 R2 Task 3) 가족 관계는 households/household_members가 원본이다
  // (guardian_students는 동결). 계정 정보(parents)는 그대로 두고 관계 조인만 교체.
  t = Date.now();
  const { data: guardianLinks, error: guardianError } = await supabase
    .from("household_members")
    .select("profile_id, household_id")
    .eq("role", "guardian")
    .in("profile_id", parentIds);
  logUsersTabStage("users_tab.parents.guardian_links", t, {
    count: guardianLinks?.length ?? 0,
    errorCode: guardianError?.code ?? null,
  });
  if (guardianError) throw new Error(`guardian_links_query_failed:${guardianError.code ?? "unknown"}`);

  const householdIdsByParent = new Map<string, string[]>();
  for (const l of guardianLinks ?? []) {
    const list = householdIdsByParent.get(l.profile_id) ?? [];
    list.push(l.household_id);
    householdIdsByParent.set(l.profile_id, list);
  }

  const householdIds = Array.from(new Set((guardianLinks ?? []).map((l) => l.household_id)));
  t = Date.now();
  const { data: childLinks, error: childError } = await supabase
    .from("household_members")
    .select("household_id, child:profiles(name)")
    .eq("role", "child")
    .in("household_id", householdIds.length > 0 ? householdIds : [""]);
  logUsersTabStage("users_tab.parents.child_links", t, {
    count: childLinks?.length ?? 0,
    errorCode: childError?.code ?? null,
  });
  if (childError) throw new Error(`child_links_query_failed:${childError.code ?? "unknown"}`);

  const childrenByHousehold = new Map<string, string[]>();
  for (const l of childLinks ?? []) {
    const list = childrenByHousehold.get(l.household_id) ?? [];
    list.push(extractName(l.child));
    childrenByHousehold.set(l.household_id, list);
  }

  t = Date.now();
  let emailById: Map<string, string>;
  try {
    emailById = await loadEmailById(parentIds);
    logUsersTabStage("users_tab.parents.email_rpc", t, { requested: parentIds.length, found: emailById.size });
  } catch (e) {
    logUsersTabStage("users_tab.parents.email_rpc", t, {
      requested: parentIds.length,
      errorCode: e instanceof Error ? e.message : "unknown",
    });
    throw new Error(`email_rpc_failed:${e instanceof Error ? e.message : "unknown"}`);
  }

  logUsersTabStage("users_tab.parents.total", totalStart, { count: parents.length });

  return parents.map((p) => ({
    id: p.id,
    name: extractName(p.profile),
    email: emailById.get(p.id) ?? "",
    joinedAt: p.joined_at,
    childrenNames: (householdIdsByParent.get(p.id) ?? []).flatMap(
      (householdId) => childrenByHousehold.get(householdId) ?? []
    ),
  }));
}

export async function loadStudents(supabase: SupabaseClient): Promise<StudentListItem[]> {
  const { data: students } = await supabase
    .from("students")
    .select(
      "id, grade, status, credit_balance, school_name, sat_score, gpa, gpa_scale, target_colleges, intended_majors, profile_completed_at, profile:profiles(name, date_of_birth, date_of_birth_verified_at)"
    )
    .order("joined_at", { ascending: false });
  if (!students || students.length === 0) return [];

  const studentIds = students.map((s) => s.id);

  // (2026-08-30 R2 Task 3) household_members가 관계 원본이다(guardian_students는 동결).
  const { data: childLinks } = await supabase
    .from("household_members")
    .select("profile_id, household_id")
    .eq("role", "child")
    .in("profile_id", studentIds);

  const householdIdByStudent = new Map<string, string>();
  for (const l of childLinks ?? []) {
    householdIdByStudent.set(l.profile_id, l.household_id);
  }

  const householdIds = Array.from(new Set(Array.from(householdIdByStudent.values())));
  const { data: guardianLinks } = await supabase
    .from("household_members")
    .select("household_id, guardian:profiles(name)")
    .eq("role", "guardian")
    .in("household_id", householdIds.length > 0 ? householdIds : [""]);

  const guardianNamesByHousehold = new Map<string, string[]>();
  for (const l of guardianLinks ?? []) {
    const list = guardianNamesByHousehold.get(l.household_id) ?? [];
    list.push(extractName(l.guardian));
    guardianNamesByHousehold.set(l.household_id, list);
  }

  const parentsByStudent = new Map<string, string[]>();
  for (const s of students) {
    const householdId = householdIdByStudent.get(s.id);
    parentsByStudent.set(
      s.id,
      householdId ? guardianNamesByHousehold.get(householdId) ?? [] : []
    );
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, subject:subjects(name)")
    .in("student_id", studentIds)
    .eq("status", "active");
  const subjectsByStudent = new Map<string, string[]>();
  for (const e of enrollments ?? []) {
    const list = subjectsByStudent.get(e.student_id) ?? [];
    list.push(extractName(e.subject));
    subjectsByStudent.set(e.student_id, list);
  }

  const emailById = await loadEmailById(studentIds);

  const { data: apCourses } = await supabase
    .from("student_ap_courses")
    .select("student_id")
    .in("student_id", studentIds);
  const apCourseCountByStudent = new Map<string, number>();
  for (const row of apCourses ?? []) {
    apCourseCountByStudent.set(row.student_id, (apCourseCountByStudent.get(row.student_id) ?? 0) + 1);
  }

  const { data: activities } = await supabase
    .from("student_extracurricular_activities")
    .select("student_id")
    .in("student_id", studentIds);
  const extracurricularCountByStudent = new Map<string, number>();
  for (const row of activities ?? []) {
    extracurricularCountByStudent.set(
      row.student_id,
      (extracurricularCountByStudent.get(row.student_id) ?? 0) + 1
    );
  }

  return students.map((s) => {
    const profile = (Array.isArray(s.profile) ? s.profile[0] : s.profile) as
      | { name?: string; date_of_birth?: string | null; date_of_birth_verified_at?: string | null }
      | null;
    return {
      id: s.id,
      name: extractName(s.profile),
      email: emailById.get(s.id) ?? "",
      grade: s.grade,
      status: s.status,
      creditBalance: s.credit_balance,
      parentNames: parentsByStudent.get(s.id) ?? [],
      subjectNames: subjectsByStudent.get(s.id) ?? [],
      dateOfBirth: profile?.date_of_birth ?? null,
      dateOfBirthVerifiedAt: profile?.date_of_birth_verified_at ?? null,
      schoolName: s.school_name,
      satScore: s.sat_score,
      gpa: s.gpa,
      gpaScale: s.gpa_scale,
      targetColleges: s.target_colleges ?? [],
      intendedMajors: s.intended_majors ?? [],
      profileCompletedAt: s.profile_completed_at,
      apCourseCount: apCourseCountByStudent.get(s.id) ?? 0,
      extracurricularCount: extracurricularCountByStudent.get(s.id) ?? 0,
    };
  });
}

export async function loadTeachers(supabase: SupabaseClient): Promise<TeacherListItem[]> {
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, school, status, hourly_rate_krw, profile:profiles(name)")
    .order("joined_at", { ascending: false });
  if (!teachers || teachers.length === 0) return [];

  const teacherIds = teachers.map((t) => t.id);
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("teacher_id, subject:subjects(name)")
    .in("teacher_id", teacherIds)
    .eq("status", "active");
  const subjectsByTeacher = new Map<string, string[]>();
  for (const e of enrollments ?? []) {
    const list = subjectsByTeacher.get(e.teacher_id) ?? [];
    const name = extractName(e.subject);
    if (!list.includes(name)) list.push(name);
    subjectsByTeacher.set(e.teacher_id, list);
  }

  const { data: warnings } = await supabase
    .from("teacher_qc_warnings")
    .select("teacher_id")
    .in("teacher_id", teacherIds);
  const warningCountByTeacher = new Map<string, number>();
  for (const w of warnings ?? []) {
    warningCountByTeacher.set(w.teacher_id, (warningCountByTeacher.get(w.teacher_id) ?? 0) + 1);
  }

  const { data: templates } = await supabase
    .from("teacher_curriculum_templates")
    .select("teacher_id, subject_id")
    .in("teacher_id", teacherIds);
  const assignedSubjectIdsByTeacher = new Map<string, string[]>();
  for (const t of templates ?? []) {
    const list = assignedSubjectIdsByTeacher.get(t.teacher_id) ?? [];
    list.push(t.subject_id);
    assignedSubjectIdsByTeacher.set(t.teacher_id, list);
  }

  const emailById = await loadEmailById(teacherIds);

  return teachers.map((t) => ({
    id: t.id,
    name: extractName(t.profile),
    email: emailById.get(t.id) ?? "",
    school: t.school,
    status: t.status,
    qcWarningCount: warningCountByTeacher.get(t.id) ?? 0,
    subjectNames: subjectsByTeacher.get(t.id) ?? [],
    assignedSubjectIds: assignedSubjectIdsByTeacher.get(t.id) ?? [],
    hourlyRateKrw: t.hourly_rate_krw,
  }));
}

// 성능 corrective(2026-09-09, 성능 측정 라운드) — 기존 loadStudentCreditHistory(studentId)/
// loadTeacherQcWarnings(teacherId) 단건 버전은 app/admin/page.tsx가 학생/교사 전원에 대해
// 각각 개별 호출(N+1)해 admin 페이지 로드마다 학생 수만큼 DB 왕복이 발생했다(실측:
// admin이 웜 상태에서도 가장 느린 페이지, seed 학생 99명 기준). 학생 ID/교사 ID 전체를
// 각각 .in() 한 번으로 읽어 클라이언트에서 그룹핑하는 배치 버전으로 교체한다 — 반환
// 데이터 모양·정렬·빈 배열 처리는 기존 단건 버전과 완전히 동일하게 유지한다(각 id별
// 배열은 여전히 created_at/occurred_at 내림차순, 매칭되는 행이 없는 id는 빈 배열).

export async function loadStudentCreditHistoryBatch(
  supabase: SupabaseClient,
  studentIds: string[]
): Promise<Record<string, CreditTransaction[]>> {
  const result: Record<string, CreditTransaction[]> = {};
  for (const id of studentIds) result[id] = [];
  if (studentIds.length === 0) return result;

  const { data } = await supabase
    .from("credit_transactions")
    .select("id, student_id, type, amount, reason, created_at")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });

  for (const t of data ?? []) {
    (result[t.student_id] ??= []).push({
      id: t.id,
      type: t.type,
      amount: t.amount,
      reason: t.reason,
      createdAt: t.created_at,
    });
  }
  return result;
}

export async function loadTeacherQcWarningsBatch(
  supabase: SupabaseClient,
  teacherIds: string[]
): Promise<Record<string, QcWarning[]>> {
  const result: Record<string, QcWarning[]> = {};
  for (const id of teacherIds) result[id] = [];
  if (teacherIds.length === 0) return result;

  const { data } = await supabase
    .from("teacher_qc_warnings")
    .select("id, teacher_id, type, detail, occurred_at, student:students(profile:profiles(name))")
    .in("teacher_id", teacherIds)
    .order("occurred_at", { ascending: false });

  for (const w of data ?? []) {
    (result[w.teacher_id] ??= []).push({
      id: w.id,
      type: w.type,
      detail: w.detail,
      occurredAt: w.occurred_at,
      studentName:
        extractName((Array.isArray(w.student) ? w.student[0] : w.student)?.profile) || null,
    });
  }
  return result;
}
