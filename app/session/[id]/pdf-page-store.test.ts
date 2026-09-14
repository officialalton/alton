import { beforeEach, describe, expect, it } from "vitest";
import {
  ackSaved,
  addStroke,
  emptyStore,
  failBatch,
  hasUnsaved,
  pageStoreKey,
  persist,
  recover,
  takeBatch,
} from "./pdf-page-store";

const seg = (x: number) => ({ x0: x, y0: 0, x1: x + 1, y1: 1, color: "#000", tool: "pen" as const });

// 테스트 환경의 localStorage 는 일부만 구현돼 있다 — 실제 Storage 와 같은 표면의 메모리 저장소.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => { map.delete(k); },
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}
let storage: Storage;

describe("PDF 페이지 필기 보관함", () => {
  beforeEach(() => { storage = memoryStorage(); });

  it("보관함 키에 버전·페이지·범위가 들어간다 — 대상이 다르면 섞이지 않는다", () => {
    const a = pageStoreKey({ viewerUserId: "u", sessionId: "s", curriculumDocVersionId: "v1", pageNumber: 1, scope: "teacher_shared" });
    const b = pageStoreKey({ viewerUserId: "u", sessionId: "s", curriculumDocVersionId: "v1", pageNumber: 2, scope: "teacher_shared" });
    const c = pageStoreKey({ viewerUserId: "u", sessionId: "s", curriculumDocVersionId: "v2", pageNumber: 1, scope: "teacher_shared" });
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("재현 2 — 전송 중에 새로 그린 획도 임시 기록에 함께 남는다", () => {
    const store = emptyStore();
    const first = addStroke(store, seg(1));
    const batch = takeBatch(store); // 서버로 보냈다. 응답은 아직.
    expect(batch).toEqual([first]);
    const second = addStroke(store, seg(2));

    persist("k", store, storage);
    const kept = JSON.parse(storage.getItem("k")!) as { eventId: string }[];
    expect(kept.map((s) => s.eventId)).toEqual([first.eventId, second.eventId]);
    expect(hasUnsaved(store)).toBe(true);
  });

  it("먼저 보낸 저장이 끝나도 그 뒤 새로 그린 획은 지우지 않는다", () => {
    const store = emptyStore();
    const first = addStroke(store, seg(1));
    const batch = takeBatch(store);
    const second = addStroke(store, seg(2));

    ackSaved(store, [first.eventId], batch);
    expect(store.inFlight).toEqual([]);
    expect(store.pending).toEqual([second]);
  });

  it("저장 실패는 보낸 묶음을 대기 목록 앞에 되돌린다(순서 유지)", () => {
    const store = emptyStore();
    const first = addStroke(store, seg(1));
    const batch = takeBatch(store);
    const second = addStroke(store, seg(2));
    failBatch(store, batch);
    expect(store.inFlight).toEqual([]);
    expect(store.pending.map((s) => s.eventId)).toEqual([first.eventId, second.eventId]);
  });

  it("남겨 둔 획은 eventId 그대로 되살아나고, 기록은 한 번만 쓰인다", () => {
    const store = emptyStore();
    const s1 = addStroke(store, seg(1));
    persist("k", store, storage);
    const recovered = recover("k", storage);
    expect(recovered.map((s) => s.eventId)).toEqual([s1.eventId]);
    expect(recover("k", storage)).toEqual([]);
  });

  it("깨진 기록은 무시한다", () => {
    storage.setItem("k", "{not json");
    expect(recover("k", storage)).toEqual([]);
    storage.setItem("k", JSON.stringify([{ x0: 1 }]));
    expect(recover("k", storage)).toEqual([]);
  });
});

// 2026-09-14 UAT — 전체 지우기(tool:'clear')는 그 앞의 조각을 모두 무효로 한다.
describe("reconstructPageStrokes", () => {
  it("마지막 clear 이후의 조각만 남기고, clear 자체는 남기지 않는다", async () => {
    const { reconstructPageStrokes } = await import("./pdf-page-store");
    const seg = (x: number, tool: "pen" | "text" | "clear" = "pen") => ({ x0: x, y0: 0, x1: x, y1: 0, color: "#000", tool });
    expect(reconstructPageStrokes([seg(1), seg(2), seg(0, "clear"), seg(3), seg(4, "text")])).toEqual([seg(3), seg(4, "text")]);
    expect(reconstructPageStrokes([seg(1), seg(0, "clear")])).toEqual([]);
    expect(reconstructPageStrokes([seg(1), seg(2)])).toEqual([seg(1), seg(2)]);
  });
});
