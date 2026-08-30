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
  calendlySchedulingUrl: string | null;
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

async function loadEmailById(userIds: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  const emailById = new Map<string, string>();
  for (const u of data?.users ?? []) {
    if (userIds.includes(u.id)) emailById.set(u.id, u.email ?? "");
  }
  return emailById;
}

export async function loadParents(supabase: SupabaseClient): Promise<ParentListItem[]> {
  const { data: parents } = await supabase
    .from("parents")
    .select("id, joined_at, profile:profiles(name)")
    .order("joined_at", { ascending: false });
  if (!parents || parents.length === 0) return [];

  const parentIds = parents.map((p) => p.id);

  // (2026-08-30 R2 Task 3) 가족 관계는 households/household_members가 원본이다
  // (guardian_students는 동결). 계정 정보(parents)는 그대로 두고 관계 조인만 교체.
  const { data: guardianLinks } = await supabase
    .from("household_members")
    .select("profile_id, household_id")
    .eq("role", "guardian")
    .in("profile_id", parentIds);

  const householdIdsByParent = new Map<string, string[]>();
  for (const l of guardianLinks ?? []) {
    const list = householdIdsByParent.get(l.profile_id) ?? [];
    list.push(l.household_id);
    householdIdsByParent.set(l.profile_id, list);
  }

  const householdIds = Array.from(new Set((guardianLinks ?? []).map((l) => l.household_id)));
  const { data: childLinks } = await supabase
    .from("household_members")
    .select("household_id, child:profiles(name)")
    .eq("role", "child")
    .in("household_id", householdIds.length > 0 ? householdIds : [""]);

  const childrenByHousehold = new Map<string, string[]>();
  for (const l of childLinks ?? []) {
    const list = childrenByHousehold.get(l.household_id) ?? [];
    list.push(extractName(l.child));
    childrenByHousehold.set(l.household_id, list);
  }

  const emailById = await loadEmailById(parentIds);

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
    .select("id, grade, status, credit_balance, profile:profiles(name)")
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

  return students.map((s) => ({
    id: s.id,
    name: extractName(s.profile),
    email: emailById.get(s.id) ?? "",
    grade: s.grade,
    status: s.status,
    creditBalance: s.credit_balance,
    parentNames: parentsByStudent.get(s.id) ?? [],
    subjectNames: subjectsByStudent.get(s.id) ?? [],
  }));
}

export async function loadTeachers(supabase: SupabaseClient): Promise<TeacherListItem[]> {
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, school, status, calendly_scheduling_url, hourly_rate_krw, profile:profiles(name)")
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
    calendlySchedulingUrl: t.calendly_scheduling_url,
    hourlyRateKrw: t.hourly_rate_krw,
  }));
}

export async function loadStudentCreditHistory(
  supabase: SupabaseClient,
  studentId: string
): Promise<CreditTransaction[]> {
  const { data } = await supabase
    .from("credit_transactions")
    .select("id, type, amount, reason, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    reason: t.reason,
    createdAt: t.created_at,
  }));
}

export async function loadTeacherQcWarnings(
  supabase: SupabaseClient,
  teacherId: string
): Promise<QcWarning[]> {
  const { data } = await supabase
    .from("teacher_qc_warnings")
    .select("id, type, detail, occurred_at, student:students(profile:profiles(name))")
    .eq("teacher_id", teacherId)
    .order("occurred_at", { ascending: false });

  return (data ?? []).map((w) => ({
    id: w.id,
    type: w.type,
    detail: w.detail,
    occurredAt: w.occurred_at,
    studentName:
      extractName((Array.isArray(w.student) ? w.student[0] : w.student)?.profile) || null,
  }));
}
