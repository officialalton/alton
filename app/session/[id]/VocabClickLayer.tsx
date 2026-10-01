"use client";

import { useState } from "react";
import { addVocabWord } from "./vocab-actions";
import { VocabSaveToggleBar, type VocabSaveController } from "./vocab-save-controller";

const WORD_CHAR = /[A-Za-z0-9'\-가-힣ㄱ-ㆎ]/;

type Popup = { word: string; x: number; y: number };

/**
 * 교재 본문에서 단어를 클릭하면(functional-spec §5 — 드래그가 아니라 클릭) 팝업이
 * 뜨고, 확인하면 AI가 뜻/예문/비슷한 단어를 만들어 단어장(고른 폴더, 없으면 새로
 * 만들어)에 저장한다. 2026-09-21(사용자 지시) — 실수로 계속 팝업이 뜨지 않게
 * on/off 스위치를 두고, 기본은 꺼진 상태로 시작한다.
 * 2026-09-22(사용자 지시) — on/off·폴더 상태는 vocab-save-controller.tsx로 뽑아
 * 다른 컴포넌트(예: PDF 화면의 "필기 시작" 버튼 옆)에서도 같은 상태를 쓸 수 있다 —
 * showToggle=false면 이 컴포넌트는 토글 UI를 그리지 않고 클릭 감지만 한다.
 */
export default function VocabClickLayer({
  sessionId,
  studentId,
  enabled,
  controller,
  showToggle = true,
  children,
}: {
  sessionId: string;
  studentId: string;
  enabled: boolean;
  controller: VocabSaveController;
  /** false면 자체 토글 바를 그리지 않는다 — 다른 곳(예: PDF 툴바)에 이미 그려진 경우. */
  showToggle?: boolean;
  children: React.ReactNode;
}) {
  const [popup, setPopup] = useState<Popup | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!enabled || !controller.saveMode || busy) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, textarea, input, canvas, a, select, .prob-choice, .save-btn, .pick-btn"
      )
    ) {
      setPopup(null);
      return;
    }

    const docWithCaret = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (
        x: number,
        y: number
      ) => { offsetNode: Node; offset: number } | null;
    };

    let range: Range | null = null;
    if (docWithCaret.caretRangeFromPoint) {
      range = docWithCaret.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (docWithCaret.caretPositionFromPoint) {
      const pos = docWithCaret.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
      }
    }

    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
      setPopup(null);
      return;
    }

    const textNode = range.startContainer;
    const text = textNode.textContent ?? "";
    let start = range.startOffset;
    let end = range.startOffset;
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
    while (end < text.length && WORD_CHAR.test(text[end])) end++;
    const word = text.slice(start, end).trim();
    if (!word || word.length < 2) {
      setPopup(null);
      return;
    }

    const wordRange = document.createRange();
    wordRange.setStart(textNode, start);
    wordRange.setEnd(textNode, end);
    const rect = wordRange.getBoundingClientRect();
    setStatus(null);
    setPopup({ word, x: rect.left, y: rect.top });
  }

  async function confirmAdd() {
    if (!popup) return;
    const word = popup.word;
    setBusy(true);
    setPopup(null);
    setStatus(`"${word}" — AI가 뜻을 정리하는 중...`);
    try {
      const result = await addVocabWord(studentId, sessionId, word, controller.folderId);
      setStatus(
        result.alreadyExisted
          ? `"${word}"는 이미 단어장에 있어요.`
          : `✓ "${word}" 단어장에 추가됨`
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "저장 중 오류가 발생했어요.");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(null), 2500);
    }
  }

  return (
    <div onClick={handleClick} className="relative">
      {enabled && showToggle && (
        <div className="sticky top-0 z-[150] mb-2 rounded-lg border border-grey-200 bg-white px-3 py-1.5">
          <VocabSaveToggleBar controller={controller} />
        </div>
      )}

      {children}

      {popup && (
        <div
          className="fixed z-[200] bg-ink text-white text-[12.5px] font-bold px-3.5 py-2 rounded-lg cursor-pointer shadow-lg"
          style={{ top: Math.max(8, popup.y - 42), left: popup.x }}
          onClick={(e) => {
            e.stopPropagation();
            confirmAdd();
          }}
        >
          + &quot;{popup.word}&quot; 단어장에 추가
        </div>
      )}

      {status && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-ink text-white text-[12.5px] font-semibold px-4 py-2 rounded-full shadow-lg">
          {status}
        </div>
      )}
    </div>
  );
}
