import type { PageStrokePayload } from "./annotation-events-actions";

// PDF 페이지 필기의 미저장 획 보관.
//
// 2026-09-14 조사 문서(docs/2026-09-14-pdf-page-annotation-check.md) 재현 1·2 를 막는다:
//   재현 1  대상(자료·페이지)을 바꾸는 사이에 이전 대상의 미저장 획이 다음 대상 저장에 섞였다.
//           → 보관함은 **대상마다 따로**다(키에 버전·페이지·범위가 들어간다). 컴포넌트를
//             대상마다 다시 마운트하고, 각 보관함은 자기 대상으로만 저장한다.
//   재현 2  서버 응답을 기다리는 사이 새 획이 들어오면 임시 기록에 첫 획이 빠졌다.
//           → 대기 중(pending)과 전송 중(inFlight)을 둘 다 기록한다. 서버가 확인한 eventId
//             만 지운다. 먼저 보낸 저장이 끝나도 그 뒤 새로 그린 획은 지우지 않는다.
//
// 각 획에 eventId(uuid)를 붙인다. 재시도·재접속 때 같은 획이 두 번 저장되지 않는 근거는
// 서버의 unique (session_id, client_event_id) 다 — 여기서는 그 id 를 잃지 않는 것이 일이다.

export type PageStrokeScope = "teacher_shared" | "student_shared";

/** 마지막 전체 지우기(tool:'clear') 이후의 조각만 남긴다 — 저장 순서(seq)대로 들어온다고 본다. */
export function reconstructPageStrokes(items: PageStrokePayload[]): PageStrokePayload[] {
  let visible: PageStrokePayload[] = [];
  for (const item of items) {
    if (item.tool === "clear") visible = [];
    else visible.push(item);
  }
  return visible;
}

export type PageStoreKey = {
  viewerUserId: string;
  sessionId: string;
  curriculumDocVersionId: string;
  pageNumber: number;
  scope: PageStrokeScope;
};

export function pageStoreKey(k: PageStoreKey): string {
  return `alton:unsaved-page-strokes:${k.viewerUserId}:${k.sessionId}:${k.curriculumDocVersionId}:${k.pageNumber}:${k.scope}`;
}

export type StrokeWithId = PageStrokePayload & { eventId: string };

export type PageStrokeStore = {
  /** 아직 보내지 않은 획. */
  pending: StrokeWithId[];
  /** 보냈지만 서버 확인을 받지 못한 획. 실패하면 pending 으로 되돌린다. */
  inFlight: StrokeWithId[];
};

export function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // 아주 오래된 브라우저 — 형식만 uuid 처럼 맞춘다.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function emptyStore(): PageStrokeStore {
  return { pending: [], inFlight: [] };
}

export function addStroke(store: PageStrokeStore, seg: PageStrokePayload): StrokeWithId {
  const withId: StrokeWithId = { ...seg, eventId: seg.eventId ?? newEventId() };
  store.pending.push(withId);
  return withId;
}

/** 지금 대기 중인 획을 전송 중으로 옮기고 그 묶음을 돌려준다. 비어 있으면 []. */
export function takeBatch(store: PageStrokeStore): StrokeWithId[] {
  const batch = store.pending;
  store.pending = [];
  store.inFlight = [...store.inFlight, ...batch];
  return batch;
}

/** 서버가 확인한 것만 지운다. 확인되지 않은 전송 중 획은 그대로 남는다. */
export function ackSaved(store: PageStrokeStore, savedEventIds: Iterable<string>, sentBatch: StrokeWithId[]): void {
  const saved = new Set(savedEventIds);
  // 서버는 이미 저장돼 있던(재시도) 획을 돌려주지 않는다 — 보낸 묶음의 획은 응답이
  // 성공이면 저장된 것으로 본다(중복은 서버가 조용히 넘겼다).
  const sent = new Set(sentBatch.map((s) => s.eventId));
  store.inFlight = store.inFlight.filter((s) => !saved.has(s.eventId) && !sent.has(s.eventId));
}

/** 저장이 실패했다 — 보낸 묶음을 다시 대기 목록 앞에 둔다(순서 유지). */
export function failBatch(store: PageStrokeStore, sentBatch: StrokeWithId[]): void {
  const sent = new Set(sentBatch.map((s) => s.eventId));
  store.inFlight = store.inFlight.filter((s) => !sent.has(s.eventId));
  store.pending = [...sentBatch, ...store.pending];
}

export function hasUnsaved(store: PageStrokeStore): boolean {
  return store.pending.length > 0 || store.inFlight.length > 0;
}

/** 대기 중과 전송 중을 **모두** 남긴다 — 닫히거나 끊겨도 복구할 수 있게. */
export function persist(key: string, store: PageStrokeStore, storage: Storage | null = safeStorage()): void {
  if (!storage) return;
  try {
    const all = [...store.inFlight, ...store.pending];
    if (all.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(all));
  } catch {
    // 저장 공간 문제 — 화면은 계속 동작한다.
  }
}

/** 남겨 둔 획을 대기 목록으로 되살린다. 서버에 이미 있으면 eventId 로 중복이 막힌다. */
export function recover(key: string, storage: Storage | null = safeStorage()): StrokeWithId[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    storage.removeItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is StrokeWithId =>
        typeof s === "object" && s !== null && typeof (s as StrokeWithId).eventId === "string"
    );
  } catch {
    return [];
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
