import { queryFreeBusy, type FreeBusyInterval } from "@/lib/google-calendar";

// R6 12/N — 선생님 본인 캘린더의 Google 외부 개인 일정을 "바쁨 블록"으로만 노출한다.
// FreeBusy API는 구조적으로 시작/끝 시각만 반환하고 제목·설명·참석자를 절대 포함하지
// 않는다(공식 API 명세) — 그래서 이 경로는 "제목·내용·참석자 없이 바쁨 블록만 표시"라는
// 정책 요구를 API 선택 자체로 만족한다. 조회 실패/미승인 상태에서는 빈 배열을 반환해
// 화면이 깨지지 않게 한다(다른 R6 FreeBusy 사전 확인과 동일한 방어적 패턴).
//
// 노출 범위: 이 함수는 "그 선생님 본인"에게만 호출된다(app/teacher/*-actions.ts가
// requireUser()로 본인 확인 후 자기 자신의 workspace_email만 넘김) — 보호자·학생·다른
// 선생님에게는 이 경로 자체가 노출되지 않는다.

export type ExternalBusyBlock = { startsAt: string; endsAt: string };

export async function listTeacherExternalBusyBlocks(params: {
  teacherWorkspaceEmail: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<ExternalBusyBlock[]> {
  try {
    const busy: FreeBusyInterval[] = await queryFreeBusy({
      teacherWorkspaceEmail: params.teacherWorkspaceEmail,
      timeMin: params.rangeStart,
      timeMax: params.rangeEnd,
    });
    return busy.map((b) => ({ startsAt: b.start, endsAt: b.end }));
  } catch {
    // FreeBusy 미승인(CALENDAR_SYNC_ALLOW_REAL_CALLS=false)이거나 실제 호출 실패 —
    // 외부 일정 표시는 부가 정보이므로 화면 자체를 막지 않는다.
    return [];
  }
}
