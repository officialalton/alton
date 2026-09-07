"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { sendInviteEmail } from "@/lib/invite-email";
import { currentRequestOrigin } from "@/lib/request-origin";
import { assertTeacherHasValidRate } from "@/lib/enrollment/teacher-rate-check";

async function inviteAndCreateProfile(params: {
  email: string;
  name: string;
  role: "parent" | "student" | "teacher";
}): Promise<string> {
  const admin = createAdminClient();
  const siteUrl = await currentRequestOrigin();
  const redirectTo =
    params.role === "parent" ? `${siteUrl}/set-password?role=parent` : `${siteUrl}/set-password`;
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

// (2026-09-07) 레거시 "학부모 초대"(inviteParent, account_invites 기반 — 자녀
// 없이 보호자만 먼저 만들고 나중에 자녀를 추가하는 경로)는 제거했다. 지인/추천
// 경로(app/admin/direct-account-actions.ts의 sendDirectOnboardingNoticeAction,
// trial_onboarding_links 기반)가 보호자+학생을 한 번에 만드는 완전한 상위
// 호환이라 UsersTab에서 두 폼이 중복 노출됐고, 레거시 쪽은 production에서
// React 미니파이 오류(#441)로 크래시가 났다(원인: 이 함수가 예외를 그대로
// throw해 Next.js Server Action 오류 마스킹에 걸림 — sendTrialOnboardingNoticeAction/
// sendDirectOnboardingNoticeAction에서 이미 고친 것과 동일한 클래스의 버그).
// 다른 호출부가 없음을 확인하고 함수 자체를 삭제했다(더 이상 UI가 없어
// 예외 마스킹 버그를 별도로 고칠 필요도 없어졌다).

// (2026-08-30 R2 Task 3) 가족 관계 원본은 households/household_members다 —
// guardian_students는 동결됐고 DB 트리거가 쓰기를 거부한다. 부모가 이미 속한
// household가 있으면 재사용하고, 없으면 그 부모를 주 보호자로 하는 새 household를
// 만든다(다중 보호자 초대 UX는 Task 4에서 별도로 설계 — 이번엔 기존 시그니처를
// 유지한 최소 수정).
async function findOrCreateHouseholdForGuardian(
  admin: ReturnType<typeof createAdminClient>,
  parentId: string
): Promise<string> {
  const { data: existing } = await admin
    .from("household_members")
    .select("household_id")
    .eq("profile_id", parentId)
    .eq("role", "guardian")
    .limit(1)
    .maybeSingle();
  if (existing) return existing.household_id;

  const { data: household, error } = await admin
    .from("households")
    .insert({ primary_guardian_id: parentId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: memberError } = await admin.from("household_members").insert({
    household_id: household.id,
    profile_id: parentId,
    role: "guardian",
    is_primary: true,
  });
  if (memberError) throw new Error(memberError.message);

  return household.id;
}

export async function inviteStudent(params: {
  name: string;
  email: string;
  parentId: string;
  grade: string;
}): Promise<string> {
  const { supabase } = await requireAdmin();
  const admin = createAdminClient();
  const householdId = await findOrCreateHouseholdForGuardian(admin, params.parentId);

  const { data, error } = await supabase.rpc("create_account_invite", {
    p_email: params.email,
    p_name: params.name,
    p_role: "student",
    p_household_id: householdId,
    p_grade: params.grade,
  });
  if (error) throw new Error(error.message);
  const row = data![0];
  await sendInviteEmail({ to: params.email, name: params.name, token: row.raw_token, role: "student" });
  return row.invite_id;
}

// (2026-08-30 R2 Task 4) 개인 이메일 기반 선생님 초대는 비활성화한다 — 선생님은
// 관리자가 @alton.education Google Workspace 계정을 발급한 뒤 최초 Google
// 로그인으로 사전 등록된 레코드와 연결하는 방식으로 확정됐다(R2 Task 7). 실제
// 대체 구현과 이 함수 제거는 Task 7에서 진행하고, 지금은 명확한 오류로 막기만
// 한다 — 관리자 권한 확인은 그대로 거쳐서 익명/비관리자에게는 그보다 먼저
// "로그인이 필요합니다"/"관리자만 사용할 수 있습니다"가 나가도록 한다.
export async function inviteTeacher(params: {
  name: string;
  email: string;
  school: string;
  hourlyRateKrw: number;
}): Promise<string> {
  await requireAdmin();
  throw new Error(
    "개인 이메일 기반 선생님 초대는 현재 비활성화되어 있습니다. 선생님 계정은 Google Workspace 프로비저닝(R2 Task 7) 완료 후 그 절차로만 생성할 수 있습니다."
  );
}

// (2026-08-30 R2 Task 4) 위 inviteTeacher()가 호출을 막기 전까지 실제로 쓰이던
// 구현 — Task 7에서 Workspace 프로비저닝으로 교체·제거될 때까지 참고용으로
// 남겨둔다(호출부 없음, 삭제하지 않음).
async function legacyInviteTeacherByEmail(params: {
  name: string;
  email: string;
  school: string;
  hourlyRateKrw: number;
}): Promise<string> {
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

// M4 UAT #2 후속(2026-09-05): 관리자 "생년월일 확인 완료" 버튼 — 신원확인 서류
// 등 별도 절차 없이 확인자·확인시각만 기록한다(verify_student_date_of_birth()).
// 체험수업권 자동 지급 게이트(grant_trial_entitlement_for_consultation())가
// 이 값을 검사하므로, 체험수업 시작 전 관리자가 이 버튼을 눌러야 한다.
export async function verifyStudentDateOfBirth(studentId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("verify_student_date_of_birth", {
    p_student_id: studentId,
  });
  if (error) throw new Error(error.message);
}

export async function setTeacherStatus(
  teacherId: string,
  status: "active" | "pending" | "suspended"
): Promise<void> {
  const { supabase } = await requireAdmin();
  if (status === "active") {
    // DB 트리거(teachers_enforce_active_requires_rate)가 최종 방어선이지만,
    // 그 원시 오류를 그대로 보여주지 않고 미리 확인해 사용자 친화적으로 안내한다.
    // R5 선생님 배정(app/admin/subject-enrollment-actions.ts)과 같은 공유
    // 함수(lib/enrollment/teacher-rate-check.ts)를 사용한다.
    const admin = createAdminClient();
    await assertTeacherHasValidRate(
      admin,
      teacherId,
      "이 선생님은 아직 시급이 설정되지 않아 active로 전환할 수 없습니다. 먼저 시급을 설정해주세요."
    );
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
