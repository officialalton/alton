export type TeacherAgreementStatus = "not_sent" | "sent" | "signed" | "declined" | "voided";

/** Status of one agreement row (the latest one per teacher). No row = not_sent. */
export function deriveAgreementStatus(row: { status?: string | null; docusign_envelope_status?: string | null } | null | undefined): TeacherAgreementStatus {
  if (!row) return "not_sent";
  if (row.status === "signed") return "signed";
  if (row.docusign_envelope_status === "declined") return "declined";
  if (row.docusign_envelope_status === "voided") return "voided";
  return "sent";
}
