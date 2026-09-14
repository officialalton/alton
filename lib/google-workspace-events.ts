// R6 10/N·13/N — Google Workspace Events API 알림 페이로드 파싱(순수 함수, 부수효과 없음).
//
// **(2026-09-03 정정, R6 Sandbox 실측으로 확정)** 이전 구현은 이벤트 타입이 JSON 본문 안의
// `eventType` 필드에 있다고 가정했다 — 실제로는 CloudEvents 봉투의 `ce-type` 속성(Pub/Sub
// 메시지의 attributes, 본문이 아님)에 있다. 실측된 실제 타입 문자열은
// `google.workspace.meet.smartNote.v2.fileGenerated`이고, 본문은
// `{"smartNote":{"name":"conferenceRecords/{id}/smartNotes/{noteId}"}}` 형태뿐이다 —
// Drive 파일 ID나 meetingCode는 본문에 전혀 실려오지 않는다(호출부가 이 리소스 이름으로
// Meet API를 추가 조회해야 채울 수 있다, `lib/google-meet.ts`의
// `fetchSmartNoteDriveFileId()`/`resolveMeetingCodeFromConferenceRecord()` 참고).

export type ParsedSmartNotesEvent = {
  kind: "smart_notes_generation";
  /** "conferenceRecords/{id}" 형태 — smartNote.name에서 "/smartNotes/..." 이전 부분을 뗀 것. */
  conferenceRecordName: string | null;
  /** "conferenceRecords/{id}/smartNotes/{noteId}" 전체 — 호출부가 이 이름으로 Meet API를 추가 조회해 driveFileId를 채운다. */
  smartNoteResourceName: string | null;
  /** 실제 페이로드에는 없다 — 호출부가 conferenceRecord→space 조회로 채워야 한다. */
  meetingCode: string | null;
  eventType: "smart_notes_document_generated" | "unrecognized";
  /** 실제 페이로드에는 없다 — 호출부가 smartNote 리소스를 추가 조회해 채워야 한다. */
  driveFileId: string | null;
};

export type ParsedParticipantEvent = {
  kind: "participant_session";
  conferenceRecordName: string | null;
  meetingCode: string | null;
  profileEmail: string | null;
  eventType: "joined" | "left";
  occurredAt: string;
};

export type ParsedWorkspaceEvent = ParsedSmartNotesEvent | ParsedParticipantEvent | null;

/** "conferenceRecords/{id}/smartNotes/{noteId}" → "conferenceRecords/{id}" */
function conferenceRecordFromSmartNoteName(name: string | null): string | null {
  if (!name) return null;
  const idx = name.indexOf("/smartNotes/");
  return idx === -1 ? null : name.slice(0, idx);
}

/**
 * Pub/Sub push 메시지를 파싱한다. `ceType`은 Pub/Sub 메시지 attributes의 `ce-type` 값을
 * 호출부(push route)가 그대로 넘겨야 한다 — 이벤트 타입이 JSON 본문에는 없기 때문이다.
 */
export function parseWorkspaceEventPayload(raw: unknown, ceType: string): ParsedWorkspaceEvent {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (ceType.includes("smartNote")) {
    const smartNote = (obj.smartNote ?? {}) as Record<string, unknown>;
    const name = typeof smartNote.name === "string" ? smartNote.name : null;
    return {
      kind: "smart_notes_generation",
      conferenceRecordName: conferenceRecordFromSmartNoteName(name),
      smartNoteResourceName: name,
      meetingCode: null,
      eventType: ceType.includes("fileGenerated") ? "smart_notes_document_generated" : "unrecognized",
      driveFileId: null,
    };
  }

  if (ceType.includes("participant")) {
    const participant = (obj.participant ?? {}) as Record<string, unknown>;
    const signedinUser = (participant.signedinUser ?? {}) as Record<string, unknown>;
    const joined = ceType.toLowerCase().includes("joined") || ceType.toLowerCase().includes("created");
    const left = ceType.toLowerCase().includes("left") || ceType.toLowerCase().includes("deleted");
    if (!joined && !left) return null;
    const occurredAt =
      (typeof obj.eventTime === "string" ? obj.eventTime : null) ??
      (typeof participant.earliestStartTime === "string" ? participant.earliestStartTime : null) ??
      new Date().toISOString();
    return {
      kind: "participant_session",
      conferenceRecordName: typeof participant.name === "string" ? participant.name.split("/participants/")[0] : null,
      meetingCode: null,
      profileEmail: typeof signedinUser.user === "string" ? signedinUser.user : null,
      eventType: joined ? "joined" : "left",
      occurredAt,
    };
  }

  return null;
}
