"use server";

// M4 (6/N) — 온보딩 확인 화면(비로그인)에서 보호자가 로그인 이메일을 prospect
// 이메일과 다른 주소로 바꾸고 싶을 때만 쓰는 액션. 로그인 전이라 requireUser()
// 를 쓰지 않는다 — 링크 자체를 소유(=토큰을 안다)하는 것이 이 시점의 유일한
// 인가 근거이고, DB 함수가 링크 상태(pending인지)를 다시 검증한다.

import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import { currentRequestOrigin } from "@/lib/request-origin";

export type RequestLoginEmailChangeResult =
  | { status: "sent" }
  | { status: "conflict" }
  | { status: "error"; error: string };

export async function requestLoginEmailChangeAction(
  linkId: string,
  newEmail: string
): Promise<RequestLoginEmailChangeResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("request_trial_login_email_change", {
    p_link_id: linkId,
    p_new_email: newEmail,
  });
  if (error) return { status: "error", error: error.message };
  const row = data?.[0];
  if (!row) return { status: "error", error: "요청을 처리하지 못했습니다." };
  if (row.conflict) return { status: "conflict" };

  const origin = await currentRequestOrigin();
  const confirmUrl = `${origin}/api/trial-onboarding/confirm-email-change?token=${encodeURIComponent(row.raw_token)}`;

  await sendEmail({
    to: newEmail,
    subject: "[Alton Education] 로그인 이메일 확인",
    html: `
      <p>안녕하세요,</p>
      <p>이 주소를 Alton Education 로그인 이메일로 사용하려면 아래 링크를 클릭해 확인해주세요.</p>
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
      <p>본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>
    `,
  });

  return { status: "sent" };
}
