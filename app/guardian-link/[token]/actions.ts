"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { setReturnTo } from "@/lib/guardian-link/return-to";

// 2026-10-05 무료 회원 S4 — 보호자 수락 화면 서버 액션(브리프 §3.3 ③~⑥, §5.2).
// 토큰 소비(accept)는 GET이 아니라 명시적 버튼의 서버 액션에서만 일어난다(trial-onboarding-finalize 원칙).

export type ClaimResult = {
  status: "invalid" | "expired" | "pending" | "accepted" | "revoked" | "superseded" | "manual_review";
  inviteId: string | null;
  studentFirstName: string;
  studentGrade: string | null;
  inviteEmail: string | null;
  accountExists: boolean;
  viewer: { loggedIn: boolean; emailMatches: boolean; isParent: boolean };
  consultationId: string | null;
  schedulingToken: string | null;
};

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export async function claimGuardianLinkAction(token: string): Promise<ClaimResult> {
  const invalid: ClaimResult = {
    status: "invalid",
    inviteId: null,
    studentFirstName: "",
    studentGrade: null,
    inviteEmail: null,
    accountExists: false,
    viewer: { loggedIn: false, emailMatches: false, isParent: false },
    consultationId: null,
    schedulingToken: null,
  };
  if (!TOKEN_RE.test(token)) return invalid;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc("claim_guardian_link_invite", { p_token: token });
  if (error) {
    console.error(JSON.stringify({ type: "guardian_link_claim_failed", error: error.message }));
    return invalid;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return invalid;
  return {
    status: row.status,
    inviteId: row.invite_id ?? null,
    studentFirstName: row.student_first_name ?? "",
    studentGrade: row.student_grade ?? null,
    inviteEmail: row.email_normalized ?? null,
    accountExists: !!row.account_exists,
    viewer: { loggedIn: !!user, emailMatches: !!row.viewer_email_matches, isParent: !!row.viewer_is_parent },
    consultationId: row.consultation_id ?? null,
    schedulingToken: row.scheduling_token ?? null,
  };
}

export type AcceptResult =
  | { ok: true; outcome: "accepted"; schedulingToken: string | null; booked: boolean }
  | { ok: true; outcome: "manual_review"; reason: string | null }
  | { ok: false; error: string };

/** ⑤ 명시적 "Connect" 버튼 → accept RPC(보호자 세션). 성공 시 호출부가 /schedule/[token] 또는 /parent로 이동. */
export async function acceptGuardianLinkAction(token: string, consentChecked: boolean): Promise<AcceptResult> {
  if (!TOKEN_RE.test(token)) return { ok: false, error: "This link is not valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_guardian_link_invite", { p_token: token, p_consent_version: "summary_v1" });
  if (error) return { ok: false, error: mapAcceptError(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "Something went wrong. Please try again." };
  if (row.outcome === "manual_review") return { ok: true, outcome: "manual_review", reason: row.manual_review_reason ?? null };
  return { ok: true, outcome: "accepted", schedulingToken: row.scheduling_token ?? null, booked: !!row.booked };
}

/** 로그인 화면으로 보내기 전에 돌아올 경로를 기록한다(쿠키, 허용 접두사만). */
export async function rememberGuardianLinkReturnAction(token: string): Promise<void> {
  if (!TOKEN_RE.test(token)) return;
  await setReturnTo(`/guardian-link/${token}`);
  redirect("/login");
}

/**
 * ③ 계정 없음: 토큰으로 메일 소유를 입증한 사용자가 "Create my account" 버튼을 누르면 Auth 계정(email_confirm)
 * + profiles(parent)+parents를 만들고 /set-password(recovery token_hash)로 보낸다. 비밀번호 설정 뒤 /post-auth가
 * 쿠키의 return_to로 이 화면에 되돌려 보낸다. 토큰은 여기서 소비되지 않는다(수락은 ⑤).
 */
export async function createGuardianAccountFromLinkAction(token: string, name: string): Promise<{ ok: false; error: string } | never> {
  if (!TOKEN_RE.test(token)) return { ok: false, error: "This link is not valid." };
  const trimmed = (name ?? "").trim();
  if (trimmed.length < 1 || trimmed.length > 80) return { ok: false, error: "Please enter your name." };

  const admin = createAdminClient();
  const { data: claimData, error: claimError } = await admin.rpc("claim_guardian_link_invite", { p_token: token });
  const claim = Array.isArray(claimData) ? claimData[0] : claimData;
  if (claimError || !claim || claim.status !== "pending" || !claim.email_normalized) {
    return { ok: false, error: "This invitation is no longer valid. Ask your student to send a new one." };
  }
  if (claim.account_exists) {
    // 이미 계정이 있으면 자동 연결하지 않는다 — 로그인으로 유도(§3.3 ③).
    return { ok: false, error: "An account with this email already exists. Please sign in instead." };
  }

  await admin.rpc("cleanup_orphaned_auth_identities", { p_email: claim.email_normalized }).then((r) => {
    if (r.error) console.error("orphaned identity cleanup failed (continuing):", r.error.message);
  });
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: claim.email_normalized,
    email_confirm: true, // 이 토큰이 그 메일함에 도착했다는 사실이 소유 입증(기존 account_invites 수락과 동일 원칙)
    user_metadata: { name: trimmed },
  });
  if (createError || !created?.user) {
    console.error(JSON.stringify({ type: "guardian_link_create_user_failed", error: createError?.message }));
    return { ok: false, error: "We couldn't create your account. Please try again or contact support." };
  }
  const { error: provisionError } = await admin.rpc("provision_guardian_from_link_invite", { p_token: token, p_auth_user_id: created.user.id, p_name: trimmed });
  if (provisionError) {
    console.error(JSON.stringify({ type: "guardian_link_provision_failed", error: provisionError.message }));
    return { ok: false, error: "We couldn't set up your account. Please contact support." };
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "recovery", email: claim.email_normalized });
  if (linkError || !linkData?.properties?.hashed_token) {
    return { ok: false, error: "We couldn't start the sign-in step. Please use \"Forgot password\" on the login page." };
  }
  await setReturnTo(`/guardian-link/${token}`);
  redirect(`/set-password?role=parent&token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=recovery`);
}

function mapAcceptError(message: string): string {
  const m = message.trim();
  const table: Record<string, string> = {
    login_required: "Please sign in to continue.",
    invalid_token: "This link is not valid.",
    expired: "This invitation has expired. Ask your student to send a new one.",
    revoked: "This invitation was cancelled by your student.",
    superseded: "A newer invitation was sent. Please use the latest email.",
    email_mismatch: "This invitation was sent to a different email address. Sign in with that address, or ask your student to re-send it to this one.",
    parent_account_required: "This account isn't a parent account. Please sign in with a parent account.",
    parent_account_inactive: "This parent account isn't active. Please contact support.",
    accepted_by_other: "This invitation was already accepted by another account.",
  };
  for (const key of Object.keys(table)) if (m === key || m.includes(key)) return table[key];
  return "Something went wrong. Please try again.";
}
