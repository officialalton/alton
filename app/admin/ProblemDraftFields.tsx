"use client";

import { useRef } from "react";
import type { DocProblem } from "./curriculum-doc-data";

type Draft = Omit<DocProblem, "id">;

const LATEX_SNIPPETS: { label: string; snippet: string }[] = [
  { label: "위첨자", snippet: "x^2" },
  { label: "분수", snippet: "\\frac{a}{b}" },
  { label: "근호", snippet: "\\sqrt{x}" },
];

export default function ProblemDraftFields({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const passageRef = useRef<HTMLTextAreaElement | null>(null);
  const explanationRef = useRef<HTMLTextAreaElement | null>(null);

  function insertSnippet(
    ref: React.MutableRefObject<HTMLTextAreaElement | null>,
    field: "passage" | "explanation",
    snippet: string
  ) {
    const el = ref.current;
    const current = draft[field] ?? "";
    if (!el) {
      onChange({ [field]: current + snippet } as Partial<Draft>);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + snippet + current.slice(end);
    onChange({ [field]: next } as Partial<Draft>);
  }

  return (
    <div>
      <textarea
        ref={passageRef}
        value={draft.passage}
        onChange={(e) => onChange({ passage: e.target.value })}
        placeholder="문제 지문"
        className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
        rows={3}
      />

      {draft.format === "mc" && (
        <div className="mb-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <input
                type="radio"
                name="correctIndex"
                checked={draft.correctIndex === i}
                onChange={() => onChange({ correctIndex: i })}
              />
              <input
                value={draft.options?.[i] ?? ""}
                onChange={(e) => {
                  const next = [...(draft.options ?? ["", "", "", "", ""])];
                  next[i] = e.target.value;
                  onChange({ options: next });
                }}
                placeholder={`선택지 ${i + 1}`}
                className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
              />
            </div>
          ))}
        </div>
      )}

      {draft.format === "math" && (
        <p className="text-[11.5px] text-grey-500 mb-2">
          <span>학생은 세션뷰의 화이트보드에서 직접 풀이를 작성합니다.</span>{" "}
          <span>여기서는 문제와 모범풀이만 입력하세요.</span>
        </p>
      )}

      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
        {draft.format === "mc" ? "해설" : draft.format === "essay" ? "모범답안" : "모범풀이"}
      </div>
      <textarea
        ref={explanationRef}
        value={draft.explanation}
        onChange={(e) => onChange({ explanation: e.target.value })}
        placeholder={
          draft.format === "mc" ? "정답 해설" : draft.format === "essay" ? "모범답안" : "모범풀이"
        }
        className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
        rows={3}
      />
      {draft.format === "math" && (
        <div className="flex gap-2 mt-2">
          {LATEX_SNIPPETS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => insertSnippet(explanationRef, "explanation", s.snippet)}
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded border-[1.5px] border-grey-200 text-ink"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
