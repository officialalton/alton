"use server";

import { requireUser } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/invite-email";

// (2026-08-30 R2 Task 4) 보호자가 자기 household에 자녀를 직접 초대한다. 어느
// household인지는 클라이언트 입력을 받지 않고 항상 호출자 본인의 guardian
// 멤버십에서 조회한다 — create_account_invite() DB 함수도 household_id가
// 본인 소유인지 다시 검증하지만(서버+DB 이중 방어), 애초에 잘못된 household_id를
// 만들 방법 자체를 없앤다.
export async function inviteChild(params: { name: string; email: string; grade?: string }): Promise<string> {
  const { supabase, user, profile } = await requireUser();
  if (profile?.role !== "parent") {
    throw new Error("보호자만 자녀를 초대할 수 있습니다.");
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .eq("role", "guardian")
    .limit(1)
    .maybeSingle();
  if (!membership) {
    throw new Error("소속된 household가 없습니다. 관리자에게 문의해주세요.");
  }

  const { data, error } = await supabase.rpc("create_account_invite", {
    p_email: params.email,
    p_name: params.name,
    p_role: "student",
    p_household_id: membership.household_id,
    p_grade: params.grade ?? null,
  });
  if (error) throw new Error(error.message);

  const row = data![0];
  await sendInviteEmail({ to: params.email, name: params.name, token: row.raw_token, role: "student" });
  return row.invite_id;
}
