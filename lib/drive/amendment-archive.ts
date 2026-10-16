import { downloadCompletedDocument } from "@/lib/docusign";
import { uploadArtifactToDrive } from "@/lib/drive-artifacts";
import { archiveFileName, type ArchiveKind } from "./archive-config";

/**
 * Archives a signed amendment agreement as a NEW file in the person's folder (never touching the original contract PDF).
 * Deduplicated by amendment id; calling it again for the same amendment returns the existing file.
 * No amendment workflow/UI exists yet — this is the minimal hook such a flow will call after DocuSign completion.
 */
export async function archiveSignedAmendment(p: {
  kind: ArchiveKind;
  personId: string;
  personName: string;
  amendmentId: string;
  parentContractId: string;
  version: string;
  signedAt: string;
  envelopeId: string;
}): Promise<{ driveFileId: string; personFolderId?: string }> {
  const contractType = p.kind === "teacher" ? "teacher_amendment" : "family_amendment";
  return uploadArtifactToDrive({
    contractId: p.amendmentId,
    artifactType: "signed_document",
    fileBuffer: await downloadCompletedDocument(p.envelopeId),
    fileName: archiveFileName({ contractType, contractId: p.amendmentId, version: p.version, signedAt: p.signedAt }),
    destination: {
      kind: p.kind,
      personId: p.personId,
      personName: p.personName,
      identity: { contractId: p.amendmentId, docKind: "amendment", contractType, parentContractId: p.parentContractId },
    },
  });
}
