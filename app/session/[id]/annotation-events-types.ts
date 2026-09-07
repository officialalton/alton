// R9 — session_annotation_events(R8 Task D, b4fd788)의 타입 + 순수 함수만 모아둔
// 파일. annotation-events-actions.ts는 "use server"라 async 함수만 export할 수
// 있어(Next.js server actions 제약), 클라이언트 컴포넌트(WhiteboardCanvas.tsx)와
// 서버 컴포넌트(page.tsx) 양쪽에서 쓰는 타입·순수 함수는 별도 파일로 뺀다.

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

// replayAnnotationEvents()가 돌려준 전체 이벤트 로그에서 "현재 그려야 할 stroke만"을
// 재구성한다 — 마지막 clear_all 이전의 stroke는 버리고, 그 이후 stroke만 순서대로 남긴다.
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
