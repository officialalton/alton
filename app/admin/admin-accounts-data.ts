import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";

export type AdminAccountTier = "master" | "full" | "supervisor";

export type AdminAccount = {
  id: string;
  name: string | null;
  email: string | null;
  tier: AdminAccountTier;
  capabilities: string[];
};

// 2026-09-22(관리자 계정 구조) — 마스터 전용 "관리자 계정" 화면의 목록 데이터.
// profiles에 이메일이 없어(auth.users에만 있음) service-role 클라이언트로
// 계정별 이메일을 따로 붙인다(관리자는 수가 적어 N+1이어도 문제 없음 — 기존
// user-edit-actions.ts 등과 같은 패턴).
export async function loadAdminAccounts(supabase: SupabaseClient): Promise<AdminAccount[]> {
  const [{ data: profiles }, { data: capRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, admin_tier")
      .eq("role", "admin")
      .order("admin_tier", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("supervisor_capabilities").select("profile_id, capability"),
  ]);

  const capsByProfile = new Map<string, string[]>();
  for (const row of capRows ?? []) {
    const list = capsByProfile.get(row.profile_id as string) ?? [];
    list.push(row.capability as string);
    capsByProfile.set(row.profile_id as string, list);
  }

  const admin = createAdminClient();
  const rows = profiles ?? [];
  const emails = await Promise.all(
    rows.map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id as string);
      return data.user?.email ?? null;
    })
  );

  return rows.map((p, i) => ({
    id: p.id as string,
    name: p.name as string | null,
    email: emails[i],
    tier: (p.admin_tier as AdminAccountTier | null) ?? "full",
    capabilities: capsByProfile.get(p.id as string) ?? [],
  }));
}
