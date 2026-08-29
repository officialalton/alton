"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";

async function inviteAndCreateProfile(params: {
  email: string;
  name: string;
  role: "parent" | "student" | "teacher";
}): Promise<string> {
  const admin = createAdminClient();
  const redirectTo =
    params.role === "parent"
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/set-password?role=parent`
      : `${process.env.NEXT_PUBLIC_SITE_URL}/set-password`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(params.email, {
    redirectTo,
  });
  if (error) throw new Error(error.message);

  const userId = data.user.id;
  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: userId, role: params.role, name: params.name });
  if (profileError) throw new Error(profileError.message);

  return userId;
}

export async function inviteParent(params: { name: string; email: string }): Promise<string> {
  await requireAdmin();
  const admin = createAdminClient();
  const userId = await inviteAndCreateProfile({ ...params, role: "parent" });
  const { error } = await admin.from("parents").insert({ id: userId });
  if (error) throw new Error(error.message);
  return userId;
}

export async function inviteStudent(params: {
  name: string;
  email: string;
  parentId: string;
  grade: string;
}): Promise<string> {
  await requireAdmin();
  const admin = createAdminClient();
  const userId = await inviteAndCreateProfile({
    name: params.name,
    email: params.email,
    role: "student",
  });
  const { error } = await admin
    .from("students")
    .insert({ id: userId, grade: params.grade, status: "pending" });
  if (error) throw new Error(error.message);

  const { error: linkError } = await admin
    .from("guardian_students")
    .insert({ parent_id: params.parentId, student_id: userId, relation_type: "보호자", is_primary: true });
  if (linkError) throw new Error(linkError.message);

  return userId;
}

export async function inviteTeacher(params: {
  name: string;
  email: string;
  school: string;
}): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const userId = await inviteAndCreateProfile({
    name: params.name,
    email: params.email,
    role: "teacher",
  });
  const { error } = await admin
    .from("teachers")
    .insert({ id: userId, school: params.school, status: "pending" });
  if (error) throw new Error(error.message);
}

export async function setStudentStatus(
  studentId: string,
  status: "active" | "pending" | "inactive"
): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("students").update({ status }).eq("id", studentId);
  if (error) throw new Error(error.message);
}

export async function setTeacherStatus(
  teacherId: string,
  status: "active" | "pending"
): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("teachers").update({ status }).eq("id", teacherId);
  if (error) throw new Error(error.message);
}

export async function setTeacherCalendlyUrl(
  teacherId: string,
  url: string
): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("teachers")
    .update({ calendly_scheduling_url: url.trim() || null })
    .eq("id", teacherId);
  if (error) throw new Error(error.message);
}

export async function adjustStudentCredit(params: {
  studentId: string;
  amount: number;
  type: "refund" | "adjustment";
  reason: string;
}): Promise<{ newBalance: number; transactionId: string }> {
  const { supabase, adminUserId } = await requireAdmin();
  if (params.amount === 0) throw new Error("조정 수량은 0이 될 수 없습니다.");
  if (!params.reason.trim()) throw new Error("조정 사유를 입력해주세요.");

  const { data: student, error: fetchError } = await supabase
    .from("students")
    .select("credit_balance")
    .eq("id", params.studentId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const newBalance = student.credit_balance + params.amount;
  if (newBalance < 0) throw new Error("수업권 잔액은 0 미만이 될 수 없습니다.");

  const { error: updateError } = await supabase
    .from("students")
    .update({ credit_balance: newBalance })
    .eq("id", params.studentId);
  if (updateError) throw new Error(updateError.message);

  const { data: tx, error: txError } = await supabase
    .from("credit_transactions")
    .insert({
      student_id: params.studentId,
      type: params.type,
      amount: params.amount,
      reason: params.reason.trim(),
      admin_id: adminUserId,
    })
    .select("id")
    .single();
  if (txError) throw new Error(txError.message);

  return { newBalance, transactionId: tx.id };
}
