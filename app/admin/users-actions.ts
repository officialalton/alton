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
  hourlyRateKrw: number;
}): Promise<string> {
  await requireAdmin();
  if (!Number.isFinite(params.hourlyRateKrw) || params.hourlyRateKrw <= 0) {
    throw new Error("시급은 1원 이상의 숫자로 입력해주세요.");
  }
  const admin = createAdminClient();
  const userId = await inviteAndCreateProfile({
    name: params.name,
    email: params.email,
    role: "teacher",
  });
  const { error } = await admin
    .from("teachers")
    .insert({
      id: userId,
      school: params.school,
      status: "pending",
    });
  if (error) throw new Error(error.message);

  // teacher_rate_history의 최초 이력 생성(정상 경로는 set_teacher_rate()뿐 —
  // teachers.hourly_rate_krw만 채우면 R1의 active 전환 트리거가 이 선생님을
  // 영구히 막는다). 계정 자체는 이미 만들어졌으므로 실패해도 롤백하지 않고,
  // 관리자가 시급 화면에서 재시도할 수 있도록 원인을 명확히 알린다.
  const { error: rateError } = await admin.rpc("set_teacher_rate", {
    p_teacher_id: userId,
    p_amount_minor: params.hourlyRateKrw,
    p_currency: "KRW",
  });
  if (rateError) {
    throw new Error(
      `선생님 계정은 생성됐지만 시급 이력 생성에 실패했습니다(${rateError.message}). 시급 설정 화면에서 다시 시도해주세요.`
    );
  }

  return userId;
}

// transition_account_status()가 유일한 정상 경로다(R2 §5.7) — 허용된 전이만
// 통과시키고(예: pending→active, active↔suspended) 감사 이력을 남긴다.
// students/teachers/parents.status 직접 UPDATE는 DB 트리거가 전부 차단한다.
async function transitionAccountStatus(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  profileId: string,
  status: "active" | "pending" | "suspended",
  reason?: string
): Promise<void> {
  const { error } = await supabase.rpc("transition_account_status", {
    p_profile_id: profileId,
    p_new_status: status,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function setStudentStatus(
  studentId: string,
  status: "active" | "pending" | "suspended"
): Promise<void> {
  const { supabase } = await requireAdmin();
  await transitionAccountStatus(supabase, studentId, status);
}

export async function setParentStatus(
  parentId: string,
  status: "active" | "pending" | "suspended"
): Promise<void> {
  const { supabase } = await requireAdmin();
  await transitionAccountStatus(supabase, parentId, status);
}

export async function setTeacherStatus(
  teacherId: string,
  status: "active" | "pending" | "suspended"
): Promise<void> {
  const { supabase } = await requireAdmin();
  if (status === "active") {
    // DB 트리거(teachers_enforce_active_requires_rate)가 최종 방어선이지만,
    // 그 원시 오류를 그대로 보여주지 않고 미리 확인해 사용자 친화적으로 안내한다.
    const admin = createAdminClient();
    const { data: hasRate, error: checkError } = await admin.rpc(
      "has_valid_current_teacher_rate",
      { p_teacher_id: teacherId }
    );
    if (checkError) throw new Error(checkError.message);
    if (!hasRate) {
      throw new Error(
        "이 선생님은 아직 시급이 설정되지 않아 active로 전환할 수 없습니다. 먼저 시급을 설정해주세요."
      );
    }
  }
  await transitionAccountStatus(supabase, teacherId, status);
}

export async function setTeacherHourlyRate(
  teacherId: string,
  rateKrw: number
): Promise<void> {
  await requireAdmin();
  if (!Number.isFinite(rateKrw) || rateKrw <= 0) {
    throw new Error("시급은 1원 이상의 숫자로 입력해주세요.");
  }
  // set_teacher_rate()만이 시급 변경의 정상 경로다(기존 이력 종료 + 새 이력
  // 생성을 원자적으로 수행) — teachers.hourly_rate_krw 직접 UPDATE는 이 함수가
  // teacher_rate_history와 함께 동기화해주므로 더 이상 직접 하지 않는다.
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_teacher_rate", {
    p_teacher_id: teacherId,
    p_amount_minor: rateKrw,
    p_currency: "KRW",
  });
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
