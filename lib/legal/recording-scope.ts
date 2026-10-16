// Which signed-agreement text versions carry the four recording-related consent items (video recording, audio recording,
// transcription, AI lesson notes, each with retention), the execution exclusions and the retention rule. The registry is the
// single place the capture gate and the admin "amended agreement / re-consent required" flag read. Existing signatures are
// never rewritten: an agreement signed on a version that is not listed here simply fails the gate until it is amended.
// When the shared clause changes, bump the template version and add the new version here (see
// docs/2026-10-06-teacher-contract-change-procedure.md).
export type AgreementKind = "family" | "teacher" | "consultant";

const FOUR_ITEM_VERSIONS: Record<AgreementKind, readonly string[]> = {
  // FAMILY_CONTRACT_TEMPLATE_VERSION
  family: ["0.3-EN-CA"],
  // California employment, non-U.S. services, U.S. contractor
  teacher: ["0.2-EN-CA", "0.2-EN", "0.1-EN"],
  // CONSULTANT_TEMPLATE_VERSION
  consultant: ["0.1-EN-CONSULTANT"],
};

export function agreementCoversFourItems(kind: AgreementKind, templateVersion: string | null | undefined): boolean {
  return !!templateVersion && FOUR_ITEM_VERSIONS[kind].includes(templateVersion.trim());
}

export function agreementKindForForm(form: string | null | undefined): AgreementKind | null {
  if (form === "consultant_services") return "consultant";
  if (form === "california_employment" || form === "non_us_services" || form === "us_contractor_services") return "teacher";
  return null;
}
