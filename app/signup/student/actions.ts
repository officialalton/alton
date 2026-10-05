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
    return { ok: false, message: "세션이 없습니다. 이메일의 링크를 다시 열어 주세요." };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile) {
    // 이미 프로비저닝됐거나 다른 경로로 만들어진 계정 — 일반 진입 경로로 보낸다.
    return { ok: true, redirectTo: "/post-auth" };
  }

  const meta = readSignupMetadata(user);
  if (!meta) {
    await supabase.auth.signOut();
    return { ok: false, message: "셀프 가입 정보를 확인할 수 없습니다. 처음부터 다시 가입해 주세요." };
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
    return { ok: false, message: "계정이 만들어졌지만 권한을 확인하지 못했습니다. 다시 로그인해 주세요." };
  }
  return { ok: true, redirectTo: "/student" };
}

/** 서버 페이지(/signup/student/complete)용 — 결과에 따라 바로 이동한다. */
export async function provisionFreeMemberAndRedirect(): Promise<never> {
  const result = await provisionFreeMemberAction();
  if (result.ok) redirect(result.redirectTo);
  redirect("/signup/student?error=" + encodeURIComponent(result.message));
}
