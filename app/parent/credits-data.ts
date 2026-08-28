import type { SupabaseClient } from "@supabase/supabase-js";

export type CreditPackage = {
  id: string;
  name: string;
  creditCount: number;
  priceUsd: number;
};

export type ParentCreditsData = {
  balance: number;
  referralCode: string | null;
  packages: CreditPackage[];
};

export async function loadParentCreditsData(
  supabase: SupabaseClient,
  parentId: string,
  studentId: string
): Promise<ParentCreditsData> {
  const { data: student } = await supabase
    .from("students")
    .select("credit_balance")
    .eq("id", studentId)
    .single();

  const { data: parent } = await supabase
    .from("parents")
    .select("referral_code")
    .eq("id", parentId)
    .maybeSingle();

  const { data: packages } = await supabase
    .from("credit_packages")
    .select("id, name, credit_count, price_usd")
    .eq("active", true)
    .order("credit_count", { ascending: true });

  return {
    balance: student?.credit_balance ?? 0,
    referralCode: parent?.referral_code ?? null,
    packages: (packages ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      creditCount: p.credit_count,
      priceUsd: Number(p.price_usd),
    })),
  };
}
