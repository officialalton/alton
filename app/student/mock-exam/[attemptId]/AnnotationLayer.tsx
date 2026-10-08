"use client";

// 하이라이트 + 한 줄 메모(응시 화면: 편집 / 결과 화면: 읽기 전용). 위치는 루트 텍스트 오프셋으로 저장하고
// CSS Custom Highlight API 로 칠한다(DOM 변경 없음 → React 리렌더와 충돌하지 않음). 메모가 있는 구간은 아래 목록에도
// 인용으로 보여서 브라우저 지원과 무관하게 읽을 수 있다.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useHighlightSupported } from "@/lib/use-highlight-supported";
import {
  NOTE_MAX,
  addHighlight,
  boundaryOffset,
  findHighlightAt,
  highlightMatches,
  offsetsToRange,
  rangeToOffsets,
  removeHighlight,
  setNote,
  type TextHighlight,
} from "@/lib/mock-exam/annotation-anchor";

// 여러 레이어(결과 화면은 문항 여러 개)가 같은 하이라이트 이름을 공유하므로 레이어별 Range 를 모아 합쳐 등록한다.
const registry = new Map<string, { hl: Range[]; note: Range[] }>();
function publish() {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  const all = { hl: [] as Range[], note: [] as Range[] };
  registry.forEach((v) => {
    all.hl.push(...v.hl);
    all.note.push(...v.note);
  });
  CSS.highlights.set("exam-annot", new Highlight(...all.hl));
  CSS.highlights.set("exam-annot-note", new Highlight(...all.note));
}

type Pop = { id: string; x: number; y: number };

export default function AnnotationLayer({
  highlights,
  onChange,
  readOnly = false,
  highlightMode = false,
  children,
  className,
}: {
  highlights: TextHighlight[];
  onChange?: (next: TextHighlight[]) => void;
  readOnly?: boolean;
  /** 켜져 있으면 텍스트를 드래그하는 즉시 하이라이트가 칠해진다(선택 후 팝업 단계 없음). */
  highlightMode?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const supported = useHighlightSupported();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(`al${Math.random().toString(36).slice(2)}`);
  const [pop, setPop] = useState<Pop | null>(null);
  const [draft, setDraft] = useState("");

  const paint = useCallback(() => {
    const root = rootRef.current;
    if (!root || !supported) return;
    const text = root.textContent ?? "";
    const hl: Range[] = [];
    const note: Range[] = [];
    for (const h of highlights) {
      if (!highlightMatches(text, h)) continue;
      const r = offsetsToRange(root, h.start, h.end);
      if (!r) continue;
      hl.push(r);
      if (h.note) note.push(r.cloneRange());
    }
    registry.set(idRef.current, { hl, note });
    publish();
  }, [highlights, supported]);

  useEffect(() => {
    paint();
    const root = rootRef.current;
    const id = idRef.current;
    // 수식·그림 등이 늦게 그려져 텍스트가 바뀌면 다시 칠한다.
    const mo = root && typeof MutationObserver !== "undefined" ? new MutationObserver(() => paint()) : null;
    if (root && mo) mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      mo?.disconnect();
      registry.delete(id);
      publish();
    };
  }, [paint]);

  function anchorPos(range: Range | null, fallback: { x: number; y: number }) {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const rect = range && typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : null;
    if (!wrap || !rect || (rect.width === 0 && rect.height === 0)) return fallback;
    return { x: Math.min(Math.max(0, rect.left - wrap.left), Math.max(0, wrap.width - 268)), y: rect.bottom - wrap.top + 6 };
  }

  function handleMouseUp() {
    const root = rootRef.current;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!root || !sel || sel.rangeCount === 0) return;
    if (!sel.isCollapsed) {
      if (readOnly || !highlightMode) return;
      const off = rangeToOffsets(root, sel.getRangeAt(0));
      if (!off) return;
      commit(addHighlight(highlights, root.textContent ?? "", off.start, off.end));
      return;
    }
    if (!root.contains(sel.anchorNode)) return;
    const offset = boundaryOffset(root, sel.anchorNode!, sel.anchorOffset);
    const h = findHighlightAt(highlights, offset);
    if (!h) {
      setPop(null);
      return;
    }
    if (readOnly && !h.note) return;
    setDraft(h.note ?? "");
    setPop({ id: h.id, ...anchorPos(sel.getRangeAt(0), { x: 0, y: 0 }) });
  }

  // 터치: 길게 눌러 핸들로 선택 범위를 잡으면 mouseup 이 오지 않는다. selectionchange 가 잠잠해지면(핸들을 놓으면) 칠한다.
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (readOnly || !highlightMode || typeof document === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = () => {
      const root = rootRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
      const off = rangeToOffsets(root, range);
      if (!off) return;
      onChangeRef.current?.(addHighlight(highlightsRef.current, root.textContent ?? "", off.start, off.end));
      sel.removeAllRanges();
    };
    const onSel = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(settle, 450);
    };
    document.addEventListener("selectionchange", onSel);
    return () => {
      document.removeEventListener("selectionchange", onSel);
      if (timer) clearTimeout(timer);
    };
  }, [highlightMode, readOnly]);

  function commit(next: TextHighlight[]) {
    onChange?.(next);
    setPop(null);
    window.getSelection()?.removeAllRanges();
  }

  const noted = highlights.filter((h) => h.note);
  const popTarget = pop ? highlights.find((h) => h.id === pop.id) : null;

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <div
        ref={rootRef}
        onMouseUp={handleMouseUp}
        onPointerUp={(e) => {
          // 터치/펜 탭으로 기존 하이라이트를 눌렀을 때도 메모·삭제 팝업을 연다(mouseup 이 늦거나 오지 않는 브라우저 대비).
          if (e.pointerType !== "mouse") setTimeout(handleMouseUp, 0);
        }}
        style={highlightMode ? { WebkitTouchCallout: "none" } : undefined}
        data-testid="annotation-root"
      >
        {children}
      </div>

      {noted.length > 0 && (
        <ul className="mt-2 space-y-1 border-l-2 border-yellow pl-2.5 text-[11.5px] text-grey-600" data-testid="annotation-notes">
          {noted.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  setDraft(h.note ?? "");
                  setPop({ id: h.id, x: 0, y: 0 });
                }}
                className="text-left disabled:cursor-default"
              >
                <span className="text-grey-400">“{h.text.length > 40 ? `${h.text.slice(0, 40)}…` : h.text}”</span> <span className="font-semibold text-ink">{h.note}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pop && !readOnly && (
        <div
          role="dialog"
          aria-label="Highlight note"
          style={{ left: pop.x, top: pop.y }}
          className="absolute z-30 w-[260px] max-w-[calc(100vw-32px)] rounded-lg border border-grey-300 bg-white p-2 shadow-lg"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
          }}
          data-testid="annotation-popover"
        >
          {popTarget ? (
            <div className="flex flex-col gap-1.5">
              <input
                autoFocus
                value={draft}
                maxLength={NOTE_MAX}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit(setNote(highlights, popTarget.id, draft));
                  if (e.key === "Escape") setPop(null);
                }}
                placeholder="Add a short note"
                aria-label="Note"
                className="w-full rounded border border-grey-300 px-2 py-2 text-[16px] md:py-1 md:text-[12px]"
              />
              <div className="flex items-center justify-between gap-1 text-[11.5px] font-semibold">
                <button type="button" onClick={() => commit(setNote(highlights, popTarget.id, draft))} className="min-h-[44px] rounded bg-ink px-3 py-1 text-white md:min-h-0 md:px-2">
                  {popTarget.note ? "Save note" : "Add note"}
                </button>
                {popTarget.note && (
                  <button type="button" onClick={() => commit(setNote(highlights, popTarget.id, ""))} className="min-h-[44px] px-1 text-grey-500 underline md:min-h-0">
                    Delete note
                  </button>
                )}
                <button type="button" onClick={() => commit(removeHighlight(highlights, popTarget.id))} className="min-h-[44px] px-1 text-grey-500 underline md:min-h-0">
                  Remove highlight
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {pop && readOnly && popTarget?.note && (
        <div role="note" style={{ left: pop.x, top: pop.y }} className="absolute z-30 max-w-[260px] rounded-lg border border-grey-300 bg-white px-3 py-2 text-[12px] shadow-lg" onClick={() => setPop(null)} data-testid="annotation-readonly-note">
          {popTarget.note}
        </div>
      )}
    </div>
  );
}
