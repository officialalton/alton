// 모의고사 하이라이트·한 줄 메모 앵커링 — 순수 함수. 위치는 "지문+질문을 감싼 루트 요소의 textContent 글자
// 오프셋"으로 저장한다(DOM 노드 참조 아님) → 리렌더·새로고침에도 같은 텍스트면 같은 자리에 복원된다.

export const NOTE_MAX = 120;
export const MAX_HIGHLIGHTS = 60;
export type TextHighlight = { id: string; start: number; end: number; text: string; note?: string };

function textNodes(root: Node): Text[] {
  const out: Text[] = [];
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

/** (container, offset) 경계점 → 루트 텍스트 기준 글자 오프셋. */
export function boundaryOffset(root: Node, container: Node, offset: number): number {
  const r = root.ownerDocument!.createRange();
  r.selectNodeContents(root);
  r.setEnd(container, offset);
  return r.toString().length;
}

export function rangeToOffsets(root: Node, range: Range): { start: number; end: number } | null {
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = boundaryOffset(root, range.startContainer, range.startOffset);
  const end = boundaryOffset(root, range.endContainer, range.endOffset);
  return end > start ? { start, end } : null;
}

export function offsetsToRange(root: Node, start: number, end: number): Range | null {
  if (end <= start) return null;
  let pos = 0;
  let sNode: Text | null = null;
  let sOff = 0;
  let eNode: Text | null = null;
  let eOff = 0;
  for (const t of textNodes(root)) {
    const len = t.data.length;
    if (!sNode && start < pos + len) {
      sNode = t;
      sOff = start - pos;
    }
    if (sNode && end <= pos + len) {
      eNode = t;
      eOff = end - pos;
      break;
    }
    pos += len;
  }
  if (!sNode || !eNode) return null;
  const r = root.ownerDocument!.createRange();
  r.setStart(sNode, sOff);
  r.setEnd(eNode, eOff);
  return r;
}

/** 저장된 텍스트가 지금 렌더 텍스트와 같은 자리인지(렌더가 달라졌으면 잘못된 곳에 칠하지 않는다). */
export function highlightMatches(rootText: string, h: TextHighlight): boolean {
  return rootText.slice(h.start, h.end) === h.text;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `h${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

/** 새 하이라이트 추가 — 겹치거나 맞닿는 기존 것과는 하나로 합친다(메모는 먼저 있던 것을 유지). */
export function addHighlight(list: TextHighlight[], rootText: string, start: number, end: number): TextHighlight[] {
  const overlapping = list.filter((h) => h.start <= end && h.end >= start);
  const rest = list.filter((h) => !overlapping.includes(h));
  const s = Math.min(start, ...overlapping.map((h) => h.start));
  const e = Math.max(end, ...overlapping.map((h) => h.end));
  const note = overlapping.find((h) => h.note)?.note;
  const merged: TextHighlight = { id: overlapping[0]?.id ?? newId(), start: s, end: e, text: rootText.slice(s, e), ...(note ? { note } : {}) };
  return [...rest, merged].sort((a, b) => a.start - b.start).slice(0, MAX_HIGHLIGHTS);
}

export function findHighlightAt(list: TextHighlight[], offset: number): TextHighlight | null {
  return list.find((h) => offset >= h.start && offset < h.end) ?? null;
}

export function setNote(list: TextHighlight[], id: string, note: string): TextHighlight[] {
  const clean = note.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
  return list.map((h) => {
    if (h.id !== id) return h;
    const { note: _old, ...rest } = h;
    void _old;
    return clean ? { ...rest, note: clean } : rest;
  });
}

export function removeHighlight(list: TextHighlight[], id: string): TextHighlight[] {
  return list.filter((h) => h.id !== id);
}

/** 서버에서 온 값 방어 파싱. */
export function parseHighlights(raw: unknown): TextHighlight[] {
  if (!Array.isArray(raw)) return [];
  const out: TextHighlight[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.start !== "number" || typeof o.end !== "number" || o.end <= o.start) continue;
    out.push({
      id: o.id,
      start: o.start,
      end: o.end,
      text: typeof o.text === "string" ? o.text : "",
      ...(typeof o.note === "string" && o.note ? { note: o.note.slice(0, NOTE_MAX) } : {}),
    });
  }
  return out;
}

export type MockExamAnnotations = { highlights: TextHighlight[]; eliminated: number[] };

export function parseAnnotations(raw: unknown): MockExamAnnotations {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const eliminated = Array.isArray(o.eliminated)
    ? [...new Set(o.eliminated.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 7))].sort((a, b) => a - b)
    : [];
  return { highlights: parseHighlights(o.highlights), eliminated };
}
