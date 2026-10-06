// Google Drive root folders for signed agreements. Each root holds ONE SUBFOLDER PER PERSON, created on demand.
// Defaults are the owner-provided folder IDs; an environment variable overrides each one.
// Real writes stay gated by DRIVE_ARTIFACTS_ALLOW_REAL_WRITES (see lib/drive-artifacts.ts).
export const DEFAULT_TEACHER_AGREEMENTS_ROOT_FOLDER_ID = "1e8Tk9ZLSWr3mXR6azIn_hU3mw1NkZOlL";
export const DEFAULT_FAMILY_CONTRACTS_ROOT_FOLDER_ID = "1q0PbjWndFGIF_-GoXaFdMICwI8woxz3f";

export type ArchiveKind = "teacher" | "family";

export function archiveRootFolderId(kind: ArchiveKind): string {
  const fromEnv =
    kind === "teacher" ? process.env.DRIVE_TEACHER_AGREEMENTS_ROOT_FOLDER_ID : process.env.DRIVE_FAMILY_CONTRACTS_ROOT_FOLDER_ID;
  const value = fromEnv?.trim();
  return value ? value : kind === "teacher" ? DEFAULT_TEACHER_AGREEMENTS_ROOT_FOLDER_ID : DEFAULT_FAMILY_CONTRACTS_ROOT_FOLDER_ID;
}

/** Removes characters Drive/filesystems dislike and keeps names short. Only names and short ids ever appear in Drive names. */
export function sanitizeDriveName(raw: string, fallback = "Unnamed"): string {
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|#%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

export function personFolderName(fullName: string, personId: string): string {
  return `${sanitizeDriveName(fullName)} (${personId.replace(/-/g, "").slice(0, 8)})`;
}

export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

export function isoDate(d: string | Date): string {
  return (typeof d === "string" ? new Date(d) : d).toISOString().slice(0, 10);
}

export type ArchiveContractType = "family_agreement" | "teacher_agreement" | "family_amendment" | "teacher_amendment";

/**
 * `{contract_type}_{contract_id}_{version}_{signed_date}.pdf` (certificate: `..._{signed_date}_certificate.pdf`).
 * Deliberately contains no names, emails, birth dates or account numbers — only our own ids, the template version and the date.
 */
export function archiveFileName(p: {
  contractType: ArchiveContractType;
  contractId: string;
  version: string;
  signedAt: string | Date;
  certificate?: boolean;
}): string {
  const safe = (v: string) => v.replace(/[^A-Za-z0-9._-]/g, "-");
  return `${p.contractType}_${safe(p.contractId)}_${safe(p.version)}_${isoDate(p.signedAt)}${p.certificate ? "_certificate" : ""}.pdf`;
}
