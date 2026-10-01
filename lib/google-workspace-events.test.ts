import { describe, expect, it } from "vitest";
import { parseWorkspaceEventPayload } from "./google-workspace-events";

const SMART_NOTE_TYPE = "google.workspace.meet.smartNote.v2.fileGenerated";
const PARTICIPANT_JOINED_TYPE = "google.workspace.meet.participant.v2.joined";
const PARTICIPANT_LEFT_TYPE = "google.workspace.meet.participant.v2.left";

describe("parseWorkspaceEventPayload", () => {
  it("null/비객체 입력은 null을 반환한다", () => {
    expect(parseWorkspaceEventPayload(null, SMART_NOTE_TYPE)).toBeNull();
    expect(parseWorkspaceEventPayload("string", SMART_NOTE_TYPE)).toBeNull();
    expect(parseWorkspaceEventPayload(42, SMART_NOTE_TYPE)).toBeNull();
  });

  it("모르는 ce-type은 null(무시)로 처리하되 예외를 던지지 않는다", () => {
    expect(parseWorkspaceEventPayload({}, "google.workspace.calendar.event.v3.updated")).toBeNull();
  });

  // 실측(2026-09-03) 실제 Pub/Sub 페이로드: {"smartNote":{"name":"conferenceRecords/{id}/smartNotes/{noteId}"}}
  // — driveFileId/meetingCode는 페이로드에 없다(호출부가 Meet API로 추가 조회).
  it("Smart Notes 문서 생성 이벤트를 실제 페이로드 형태로 파싱한다", () => {
    const result = parseWorkspaceEventPayload(
      { smartNote: { name: "conferenceRecords/V0Jqx.../smartNotes/d8fc18c4-7d3f-45cc-a67d-19ce57d2b4fd" } },
      SMART_NOTE_TYPE
    );
    expect(result).toEqual({
      kind: "smart_notes_generation",
      conferenceRecordName: "conferenceRecords/V0Jqx...",
      smartNoteResourceName: "conferenceRecords/V0Jqx.../smartNotes/d8fc18c4-7d3f-45cc-a67d-19ce57d2b4fd",
      meetingCode: null,
      eventType: "smart_notes_document_generated",
      driveFileId: null,
    });
  });

  it("smartNote.name이 없으면 conferenceRecordName/smartNoteResourceName을 null로 채운다", () => {
    const result = parseWorkspaceEventPayload({ smartNote: {} }, SMART_NOTE_TYPE);
    expect(result).toMatchObject({ kind: "smart_notes_generation", conferenceRecordName: null, smartNoteResourceName: null });
  });

  it("참가자 입장 이벤트를 participant_session/joined로 파싱한다", () => {
    const result = parseWorkspaceEventPayload(
      {
        participant: { name: "conferenceRecords/abc123/participants/p1", signedinUser: { user: "users/teacher-profile-id" } },
        eventTime: "2026-10-10T19:05:00Z",
      },
      PARTICIPANT_JOINED_TYPE
    );
    expect(result).toEqual({
      kind: "participant_session",
      conferenceRecordName: "conferenceRecords/abc123",
      meetingCode: null,
      profileEmail: "users/teacher-profile-id",
      eventType: "joined",
      occurredAt: "2026-10-10T19:05:00Z",
    });
  });

  it("참가자 퇴장 이벤트를 participant_session/left로 파싱한다", () => {
    const result = parseWorkspaceEventPayload(
      { participant: { name: "conferenceRecords/abc123/participants/p1" }, eventTime: "2026-10-10T21:00:00Z" },
      PARTICIPANT_LEFT_TYPE
    );
    expect(result).toMatchObject({ kind: "participant_session", eventType: "left" });
  });
});
