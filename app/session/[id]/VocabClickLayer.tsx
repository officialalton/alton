"use client";

import { useState } from "react";
import { addVocabWord } from "./vocab-actions";

const WORD_CHAR = /[A-Za-z0-9'\-가-힣ㄱ-ㆎ]/;

type Popup = { word: string; x: number; y: number };

/**
 * 교재 본문에서 단어를 클릭하면(functional-spec §5 — 드래그가 아니라 클릭) 팝업이
 * 뜨고, 확인하면 AI가 뜻/예문/비슷한 단어를 만들어 단어장에 저장한다.
 */
export default function VocabClickLayer({
  sessionId,
  studentId,
  enabled,
  children,
}: {
  sessionId: string;
  studentId: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [popup, setPopup] = useState<Popup | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!enabled || busy) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "button, textarea, input, canvas, a, .prob-choice, .save-btn, .pick-btn"
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
      const result = await addVocabWord(studentId, sessionId, word);
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
