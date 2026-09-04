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
  documentUrl: string | null;
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

export type TrialSmartNotesConsentStatus = {
  studentId: string;
  name: string;
  hasConsented: boolean;
};

/**
 * M4 체험 온보딩의 "체험 Smart Notes 동의" 단계 — 13세 미만 개인정보
 * 동의(guardian_consents)와는 별개 테이블(trial_smart_notes_consents)이다.
 * 자녀에게 과목 수강(subject_enrollments)이 하나라도 있어야만(= 체험/정규
 * 파이프라인에 실제로 들어와 있는 자녀만) 목록에 보여준다.
 */
export async function loadTrialSmartNotesConsentStatus(
  supabase: SupabaseClient,
  guardianId: string
): Promise<TrialSmartNotesConsentStatus[]> {
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
  if (children.length === 0) return [];

  const { data: enrollments } = await supabase
    .from("subject_enrollments")
    .select("child_id")
    .in(
      "child_id",
      children.map((c) => c.studentId)
    );
  const enrolledChildIds = new Set((enrollments ?? []).map((e) => e.child_id as string));

  const results: TrialSmartNotesConsentStatus[] = [];
  for (const child of children) {
    if (!enrolledChildIds.has(child.studentId)) continue;
    const { data: consent } = await supabase
      .from("trial_smart_notes_consents")
      .select("id")
      .eq("child_id", child.studentId)
      .maybeSingle();
    results.push({ studentId: child.studentId, name: child.name, hasConsented: !!consent });
  }
  return results;
}

export async function loadActiveConsentPolicy(
  supabase: SupabaseClient
): Promise<ConsentPolicyOption | null> {
  const { data } = await supabase
    .from("consent_policy_versions")
    .select("id, version, title, document_url")
    .is("retired_at", null)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    version: data.version,
    title: data.title,
    documentUrl: data.document_url ?? null,
  };
}

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

function extractTitle(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { title?: string } | null)?.title ?? "";
}
