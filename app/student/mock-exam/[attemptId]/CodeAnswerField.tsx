"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { applyCodeKey, CODE_FIELD_ATTRS, CODE_FIELD_HINT } from "@/lib/ap-exam/code-entry";

/**
 * 코드 답안 칸(AP Computer Science A FRQ). 고정폭·줄 바꿈 없음(가로 스크롤)·맞춤법/자동 고침 끔, Tab 들여쓰기·Enter 자동 들여쓰기,
 * Escape 후 Tab 으로 포커스 이동(키보드 함정 없음). 값 저장은 부모(ApExamTakeClient)의 editPart/flush 를 그대로 쓴다.
 */
export default function CodeAnswerField({ id, testId, value, onChange, onBlur, label }: { id: string; testId: string; value: string; onChange: (v: string) => void; onBlur: () => void; label?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<{ a: number; b: number } | null>(null);
  const [armed, setArmed] = useState(false);
  useLayoutEffect(() => {
    if (pending.current && ref.current) { ref.current.setSelectionRange(pending.current.a, pending.current.b); pending.current = null; }
  });
  return (
    <div>
      <textarea
        ref={ref} id={id} data-testid={testId} aria-label={label} aria-describedby={`${id}-hint`} rows={12} value={value} placeholder="Type your code"
        {...CODE_FIELD_ATTRS}
        onChange={(e) => onChange(e.target.value)} onBlur={() => { setArmed(false); onBlur(); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setArmed(true); return; }
          if (e.nativeEvent.isComposing) return;
          const el = e.currentTarget;
          const edit = applyCodeKey({ value: el.value, selStart: el.selectionStart, selEnd: el.selectionEnd, key: e.key, shiftKey: e.shiftKey, escapeArmed: armed });
          if (e.key === "Tab" && armed) { setArmed(false); return; }
          if (!edit) return;
          e.preventDefault();
          pending.current = { a: edit.selStart, b: edit.selEnd };
          onChange(edit.value);
        }}
        className="block w-full resize-y overflow-x-auto whitespace-pre rounded-lg border-[1.5px] border-grey-200 bg-grey-50 px-3 py-2 font-mono text-[13px] leading-[1.5] text-ink [tab-size:4]"
      />
      <p id={`${id}-hint`} className="mt-1 text-[11px] text-grey-500" data-testid={`${testId}-hint`}>{CODE_FIELD_HINT}</p>
    </div>
  );
}
