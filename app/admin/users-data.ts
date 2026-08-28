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
  const { data: links } = await supabase
    .from("guardian_students")
    .select("parent_id, student:students(id, profile:profiles(name))")
    .in("parent_id", parentIds);

  const childrenByParent = new Map<string, string[]>();
  for (const l of links ?? []) {
    const list = childrenByParent.get(l.parent_id) ?? [];
    list.push(extractName((Array.isArray(l.student) ? l.student[0] : l.student)?.profile));
    childrenByParent.set(l.parent_id, list);
  }

  const emailById = await loadEmailById(parentIds);

  return parents.map((p) => ({
    id: p.id,
    name: extractName(p.profile),
    email: emailById.get(p.id) ?? "",
    joinedAt: p.joined_at,
    childrenNames: childrenByParent.get(p.id) ?? [],
  }));
}

export async function loadStudents(supabase: SupabaseClient): Promise<StudentListItem[]> {
  const { data: students } = await supabase
    .from("students")
    .select("id, grade, status, credit_balance, profile:profiles(name)")
    .order("joined_at", { ascending: false });
  if (!students || students.length === 0) return [];

  const studentIds = students.map((s) => s.id);
  const { data: links } = await supabase
    .from("guardian_students")
    .select("student_id, parent:parents(profile:profiles(name))")
    .in("student_id", studentIds);
  const parentsByStudent = new Map<string, string[]>();
  for (const l of links ?? []) {
    const list = parentsByStudent.get(l.student_id) ?? [];
    list.push(extractName((Array.isArray(l.parent) ? l.parent[0] : l.parent)?.profile));
    parentsByStudent.set(l.student_id, list);
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
    .select("id, school, status, profile:profiles(name)")
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

  const emailById = await loadEmailById(teacherIds);

  return teachers.map((t) => ({
    id: t.id,
    name: extractName(t.profile),
    email: emailById.get(t.id) ?? "",
    school: t.school,
    status: t.status,
    qcWarningCount: warningCountByTeacher.get(t.id) ?? 0,
    subjectNames: subjectsByTeacher.get(t.id) ?? [],
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
