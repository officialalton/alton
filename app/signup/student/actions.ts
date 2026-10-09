"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { readSignupMetadata } from "@/lib/free-member-signup";
import { loadStudentFeatureAccess, hasFeature } from "@/lib/feature-access";

export type ProvisionResult = { ok: true; redirectTo: string } | { ok: false; message: string };

/**
 * 2026-10-05 무료 학습 회원(S1) — 이메일 확인 뒤 첫 세션에서 호출. Auth 서버가 검증한 사용자(getUser)의
 * metadata에 셀프 가입 표식이 있을 때만 provision_free_member RPC를 부른다(설계: lib/free-member-signup.ts 머리말).
 * 표식이 없는 프로필 없는 계정은 여기서도 거절 → 기존 fail-closed(로그인 시 unknown→로그아웃) 유지.
 */
export async function provisionFreeMemberAction(): Promise<ProvisionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "No active session. Please open the link from your email again." };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile) {
    // 이미 프로비저닝됐거나 다른 경로로 만들어진 계정 — 일반 진입 경로로 보낸다.
    return { ok: true, redirectTo: "/post-auth" };
  }

  const meta = readSignupMetadata(user);
  if (!meta) {
    await supabase.auth.signOut();
    return { ok: false, message: "We couldn't verify your sign-up details. Please sign up again from the start." };
  }

  const { error } = await supabase.rpc("provision_free_member", {
    p_name: meta.name,
    p_birthdate: meta.birthdate,
    p_grade: meta.grade,
    p_school: meta.school,
    p_terms_version: meta.terms_version,
  });
  if (error) {
    return { ok: false, message: error.message };
  }

  // 프로비저닝 직후 권한 근거가 실제로 서 있는지 확인(무료 집합의 대표 키). 실패하면 홈 진입 전에 드러난다.
  const access = await loadStudentFeatureAccess(supabase, user.id);
  if (!hasFeature(access, "mock_exam")) {
    return { ok: false, message: "Your account was created, but we couldn't confirm its access. Please log in again." };
  }
  return { ok: true, redirectTo: "/student" };
}

/** 서버 페이지(/signup/student/complete)용 — 결과에 따라 바로 이동한다. */
export async function provisionFreeMemberAndRedirect(): Promise<never> {
  const result = await provisionFreeMemberAction();
  if (result.ok) redirect(result.redirectTo);
  redirect("/signup/student?error=" + encodeURIComponent(result.message));
}
