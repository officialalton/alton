import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadCompletedDocument } from "@/lib/docusign";
import { uploadArtifactToDrive } from "@/lib/drive-artifacts";

const MAX_RETRIES = 5;

type ArchiveRow = { id: string; teacher_id: string; docusign_envelope_id: string; drive_retry_count: number };

export type ArchiveResult = { attempted: number; succeeded: number; failed: number; manualReview: number };

/**
 * Stores signed teacher agreements in the company Shared Drive (same upload machinery and folder convention as the
 * family contract) and records the Drive reference in document_url. A failure only changes the drive_* bookkeeping
 * columns: the signed state and the envelope reference are kept, and the row stays retryable/visible to admins.
 */
export async function archiveSignedTeacherAgreements(admin: SupabaseClient, opts?: { teacherId?: string }): Promise<ArchiveResult> {
  let q = admin
    .from("teacher_contracts")
    .select("id, teacher_id, docusign_envelope_id, drive_retry_count")
    .eq("status", "signed")
    .in("drive_sync_status", ["queued", "retryable_failed"])
    .not("docusign_envelope_id", "is", null);
  if (opts?.teacherId) q = q.eq("teacher_id", opts.teacherId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const result: ArchiveResult = { attempted: 0, succeeded: 0, failed: 0, manualReview: 0 };
  for (const row of (data ?? []) as ArchiveRow[]) {
    const { data: claimed, error: claimError } = await admin
      .from("teacher_contracts")
      .update({ drive_sync_status: "processing" })
      .eq("id", row.id)
      .in("drive_sync_status", ["queued", "retryable_failed"])
      .select("id");
    if (claimError) throw new Error(claimError.message);
    if (!claimed || claimed.length === 0) continue; // another worker owns it
    result.attempted += 1;
    try {
      const fileBuffer = await downloadCompletedDocument(row.docusign_envelope_id);
      const { driveFileId } = await uploadArtifactToDrive({
        contractId: row.id,
        artifactType: "signed_document",
        fileBuffer,
        fileName: `teacher-agreement-${row.teacher_id}-${row.id}.pdf`,
      });
      await admin
        .from("teacher_contracts")
        .update({
          drive_sync_status: "succeeded",
          drive_file_id: driveFileId,
          drive_synced_at: new Date().toISOString(),
          drive_last_error: null,
          document_url: `https://drive.google.com/file/d/${driveFileId}/view`,
        })
        .eq("id", row.id);
      result.succeeded += 1;
    } catch (e) {
      const next = (row.drive_retry_count ?? 0) + 1;
      const exceeded = next > MAX_RETRIES;
      await admin
        .from("teacher_contracts")
        .update({
          drive_sync_status: exceeded ? "manual_review" : "retryable_failed",
          drive_retry_count: next,
          drive_last_error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
        })
        .eq("id", row.id);
      if (exceeded) result.manualReview += 1;
      else result.failed += 1;
      console.error(JSON.stringify({ type: "teacher_agreement_archive_failed", teacherContractId: row.id, retryCount: next, exceeded }));
    }
  }
  return result;
}

/** Admin retry: put every non-succeeded signed agreement of a teacher back in the queue, then process it. */
export async function retryTeacherAgreementArchive(admin: SupabaseClient, teacherId: string): Promise<ArchiveResult> {
  const { error } = await admin
    .from("teacher_contracts")
    .update({ drive_sync_status: "queued" })
    .eq("teacher_id", teacherId)
    .eq("status", "signed")
    .in("drive_sync_status", ["retryable_failed", "manual_review", "processing"]);
  if (error) throw new Error(error.message);
  return archiveSignedTeacherAgreements(admin, { teacherId });
}
