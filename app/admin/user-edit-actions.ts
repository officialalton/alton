"use server";

// 2026-09-07(M4 UAT 후속) — "이메일 주소가 잘못됐어가 여러 이슈가 발생할 수
// 있는데 수기로 수정할 수 있는 구조는 있어야지" (제품 오너). 관리자가 보호자/
// 학생의 이름·이메일(학생은 학년도)을 직접 고칠 수 있게 한다. 이름은
// profiles.name, 이메일은 auth.users(admin.auth.admin.updateUserById)에 있어
// 두 곳을 함께 갱신해야 한다 — profiles에는 email 컬럼이 없다(app/admin/users-data.ts
// 참고, 항상 auth.users에서 조인해온다). 재확인 이메일 발송 등 Supabase Auth의
// 표준 이메일 변경 정책은 이번 범위 밖이다 — 관리자가 즉시 강제로 바꾼다
// (updateUserById는 email_confirm을 별도로 지정하지 않으면 기존 확인 상태를
// 유지한다 — 여기서는 관리자가 대신 입력한 값이므로 손대지 않는다).

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EditableUserRole = "parent" | "student";

export async function updateUserBasicInfo(params: {
  profileId: string;
  role: EditableUserRole;
  name: string;
  email: string;
  grade?: string;
}): Promise<{ name: string; email: string; grade?: string | null }> {
  const { adminUserId } = await requireAdmin();

  const name = params.name.trim();
  const email = params.email.trim();
  if (!name) throw new Error("이름을 입력해주세요.");
  if (!email || !SIMPLE_EMAIL_RE.test(email)) throw new Error("이메일 형식이 올바르지 않습니다.");

  const admin = createAdminClient();

  const { data: existingProfile, error: profileFetchError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", params.profileId)
    .maybeSingle();
  if (profileFetchError) throw new Error(profileFetchError.message);
  if (!existingProfile) throw new Error("존재하지 않는 사용자입니다.");
  if (existingProfile.role !== params.role) {
    throw new Error("역할이 일치하지 않습니다.");
  }

  const { data: authUser, error: authFetchError } = await admin.auth.admin.getUserById(params.profileId);
  if (authFetchError || !authUser?.user) throw new Error("Auth 계정을 찾을 수 없습니다.");
  const currentEmail = authUser.user.email ?? "";

  if (email.toLowerCase() !== currentEmail.toLowerCase()) {
    const { error: emailError } = await admin.auth.admin.updateUserById(params.profileId, { email });
    if (emailError) throw new Error(`이메일 변경 실패: ${emailError.message}`);
  }

  const nowIso = new Date().toISOString();
  const profileUpdate: Record<string, unknown> = {
    name,
    admin_edited_by: adminUserId,
    admin_edited_at: nowIso,
  };
  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update(profileUpdate)
    .eq("id", params.profileId);
  if (profileUpdateError) throw new Error(profileUpdateError.message);

  let grade: string | null | undefined = undefined;
  if (params.role === "student" && params.grade !== undefined) {
    const trimmedGrade = params.grade.trim() || null;
    const { error: studentUpdateError } = await admin
      .from("students")
      .update({ grade: trimmedGrade })
      .eq("id", params.profileId);
    if (studentUpdateError) throw new Error(studentUpdateError.message);
    grade = trimmedGrade;
  }

  return { name, email, grade };
}
