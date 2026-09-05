import { NextResponse } from "next/server";
import { resolveMeetingCodeFromConferenceRecord, fetchSmartNoteDriveFileId } from "@/lib/google-meet";

export async function GET() {
  const adminSubject = process.env.GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL;
  const conferenceRecordName = "conferenceRecords/HFZ8NSfyB1XwqravCv78DxITOBEBMgUIigIgABgBCA";
  const smartNoteResourceName =
    "conferenceRecords/HFZ8NSfyB1XwqravCv78DxITOBEBMgUIigIgABgBCA/smartNotes/2bff0e0d-e625-4746-9d2c-e3bd297419e1";
  const out: Record<string, unknown> = { adminSubject };
  try {
    out.meetingCode = await resolveMeetingCodeFromConferenceRecord({
      teacherWorkspaceEmail: adminSubject!,
      conferenceRecordName,
    });
  } catch (e) {
    out.meetingCodeError = e instanceof Error ? e.message : String(e);
  }
  try {
    out.driveFileId = await fetchSmartNoteDriveFileId({
      teacherWorkspaceEmail: adminSubject!,
      smartNoteResourceName,
    });
  } catch (e) {
    out.driveFileIdError = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json(out);
}
