"use server";

import { requireUser } from "@/lib/auth";
import type { StrokePayload, AnnotationEvent } from "./annotation-events-types";

// R8 follow-up (2026-09-07) — session_annotation_events(append-only 이벤트 로그,
// supabase/migrations/20261223000000_r8_session_annotation_events.sql)에 대한
// 서버 액션 계층. 이 파일은 새 이벤트 테이블만 다룬다 — 레거시
// legacy_sessions.whiteboard_strokes(scratchpad-actions.ts의 saveWhiteboardStrokes)는
// 별도 트랙으로 그대로 둔다(docs/CURRENT.md "세션 주석 이벤트 로그 — 2-트랙 상태").
//
// R9 — WhiteboardCanvas.tsx가 이 액션에 연결됨(app/session/[id]/WhiteboardCanvas.tsx).
// "use server" 파일은 async 함수만 export할 수 있어(Next.js 제약), 타입과 순수 함수
// reconstructVisibleStrokes()는 ./annotation-events-types.ts로 분리했다.

// R9 corrective(최종 라운드, 2026-09-07) — 한 스트로크를 이루는 세그먼트 전부를
// 단일 RPC 호출(append_stroke_events, supabase/migrations/
// 20261227000000_r9_atomic_append_stroke_events.sql)로 보낸다. 이전에는
// 세그먼트마다 별도 insert를 순차 호출했는데(appendStrokeEvent 루프), 이는
// (1) 세그먼트 수만큼 순차 왕복이 생겨 느리고 (2) 중간 호출이 실패하면 앞쪽
// 세그먼트는 이미 커밋되고 뒤쪽은 안 돼 "반쪽 스트로크"가 영구 남는 원자성
// 결함이 있었다. DB 함수가 하나의 트랜잭션 안에서 전부 append하거나 전부
// 실패시키므로, 이 함수 호출은 성공/실패 둘 중 하나만 있고 부분 성공이 없다.
// author_id는 함수 내부에서 auth.uid()로 고정한다(클라이언트가 넘기지 않음) —
// RLS도 author_id = auth.uid()를 강제하므로 다른 사용자 명의로 기록을 시도하면
// DB에서 한 번 더 막힌다(belt-and-suspenders).
export async function appendStrokeEvents(sessionId: string, segments: StrokePayload[]): Promise<void> {
  if (segments.length === 0) return;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("append_stroke_events", {
    p_session_id: sessionId,
    p_segments: segments,
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
