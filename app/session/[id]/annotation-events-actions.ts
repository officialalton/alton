"use server";

import { requireUser } from "@/lib/auth";

// R8 follow-up (2026-09-07) — session_annotation_events(append-only 이벤트 로그,
// supabase/migrations/20261223000000_r8_session_annotation_events.sql)에 대한
// 서버 액션 계층. 이 파일은 새 이벤트 테이블만 다룬다 — 레거시
// legacy_sessions.whiteboard_strokes(scratchpad-actions.ts의 saveWhiteboardStrokes)는
// 별도 트랙으로 그대로 둔다(docs/CURRENT.md "세션 주석 이벤트 로그 — 2-트랙 상태").
//
// WhiteboardCanvas.tsx를 이 액션에 연결하는 프론트엔드 리와이어링은 이번 라운드
// 범위가 아니다 — RLS/트리거(append-only, clear_all 선생님 전용)는 DB 레이어
// 통합 테스트(session-annotation-events.integration.test.ts)로 이미 검증됨.

export type StrokePayload = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  tool: "pen" | "eraser";
};

export type AnnotationEvent = {
  seq: string;
  id: string;
  authorId: string;
  eventType: "stroke" | "clear_all";
  payload: Record<string, unknown>;
  createdAt: string;
};

// 정규화 좌표(0.0~1.0)로 받은 stroke를 이벤트로 append한다. author_id는 항상
// 현재 로그인 사용자로 고정한다 — RLS도 author_id = auth.uid()를 강제하므로
// 다른 사용자 명의로 기록을 시도하면 DB에서 한 번 더 막힌다(belt-and-suspenders).
export async function appendStrokeEvent(sessionId: string, stroke: StrokePayload): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("session_annotation_events").insert({
    session_id: sessionId,
    author_id: user.id,
    event_type: "stroke",
    payload: stroke,
  });
  if (error) throw new Error(error.message);
}

// "전체 지우기"는 삭제가 아니라 이벤트로 기록된다 — 이전 stroke 행은 영구 보존되고,
// replayAnnotationEvents()를 호출하는 쪽이 clear_all 이후의 stroke만 다시 그리면 된다.
// 선생님이 아닌 사용자가 호출하면 RLS의 clear_all 전용 정책에서 거부된다
// (session_annotation_events_no_update/no_delete 트리거와는 별개의 INSERT 정책).
export async function appendClearAllEvent(sessionId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("session_annotation_events").insert({
    session_id: sessionId,
    author_id: user.id,
    event_type: "clear_all",
    payload: {},
  });
  if (error) throw new Error(error.message);
}

// 재접속 복구(replay): seq 오름차순으로 전체 이벤트를 읽어 그대로 재생하면 마지막
// clear_all 이후의 stroke만 남기고 다시 그릴 수 있다. seq는 DB가 부여하는 전역
// 단조 증가 값이라 클라이언트 시계와 무관하게 항상 기록된 순서를 그대로 복원한다.
export async function replayAnnotationEvents(sessionId: string): Promise<AnnotationEvent[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("session_annotation_events")
    .select("seq, id, author_id, event_type, payload, created_at")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    seq: String(row.seq),
    id: row.id,
    authorId: row.author_id,
    eventType: row.event_type,
    payload: row.payload,
    createdAt: row.created_at,
  }));
}

// replayAnnotationEvents()가 돌려준 전체 이벤트 로그에서 "현재 그려야 할 stroke만"을
// 재구성한다 — 마지막 clear_all 이전의 stroke는 버리고, 그 이후 stroke만 순서대로 남긴다.
// 순수 함수라 프론트엔드(WhiteboardCanvas)와 테스트 양쪽에서 그대로 재사용 가능하다.
export function reconstructVisibleStrokes(events: AnnotationEvent[]): StrokePayload[] {
  let visible: AnnotationEvent[] = [];
  for (const ev of events) {
    if (ev.eventType === "clear_all") {
      visible = [];
    } else {
      visible.push(ev);
    }
  }
  return visible.map((ev) => ev.payload as StrokePayload);
}
