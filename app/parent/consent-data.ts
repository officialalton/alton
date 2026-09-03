import type { SupabaseClient } from "@supabase/supabase-js";

export type ChildConsentStatus = {
  studentId: string;
  name: string;
  isUnder13: boolean;
  hasValidConsent: boolean;
  latestConsent: {
    id: string;
    policyVersionTitle: string;
    consentedAt: string;
    revokedAt: string | null;
  } | null;
};

export type ConsentPolicyOption = {
  id: string;
  version: string;
  title: string;
};

export async function loadChildrenConsentStatus(
  supabase: SupabaseClient,
  guardianId: string
): Promise<ChildConsentStatus[]> {
  const { data: guardianLinks } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", guardianId)
    .eq("role", "guardian");
  const householdIds = (guardianLinks ?? []).map((l) => l.household_id);
  if (householdIds.length === 0) return [];

  const { data: childLinks } = await supabase
    .from("household_members")
    .select("profile_id, profile:profiles(name)")
    .in("household_id", householdIds)
    .eq("role", "child");

  const children = (childLinks ?? []).map((c) => ({
    studentId: c.profile_id as string,
    name: extractName(c.profile),
  }));

  const results: ChildConsentStatus[] = [];
  for (const child of children) {
    const [{ data: isUnder13 }, { data: hasValidConsent }, { data: latest }] = await Promise.all([
      supabase.rpc("is_under_13", { p_student_id: child.studentId }),
      supabase.rpc("has_valid_guardian_consent", { p_student_id: child.studentId }),
      supabase
        .from("guardian_consents")
        .select("id, consented_at, revoked_at, consent_policy_versions(title)")
        .eq("student_id", child.studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    results.push({
      studentId: child.studentId,
      name: child.name,
      isUnder13: Boolean(isUnder13),
      hasValidConsent: Boolean(hasValidConsent),
      latestConsent: latest
        ? {
            id: latest.id as string,
            policyVersionTitle: extractTitle(latest.consent_policy_versions),
            consentedAt: latest.consented_at as string,
            revokedAt: (latest.revoked_at as string | null) ?? null,
          }
        : null,
    });
  }
  return results;
}

export async function loadActiveConsentPolicy(
  supabase: SupabaseClient
): Promise<ConsentPolicyOption | null> {
  const { data } = await supabase
    .from("consent_policy_versions")
    .select("id, version, title")
    .is("retired_at", null)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

function extractTitle(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { title?: string } | null)?.title ?? "";
}
