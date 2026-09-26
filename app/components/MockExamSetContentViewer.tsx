"use client";

import { useState } from "react";
import type { MockExamSetContentItem } from "@/lib/mock-exam/set-content";
import LearningText from "@/app/session/[id]/LearningText";
import RwStimulusView from "@/app/session/[id]/RwStimulusView";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";

const SECTION_LABEL: Record<string, string> = { rw: "R&W", math: "Math" };
const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

/** 관리자·교사가 모의고사 세트의 실제 문항(지문·질문·선택지·정답·해설·그림)을 확인하는 화면
 * (2026-09-21 UAT 지적 — 기존 "검토" 화면은 영역·난이도 메타데이터뿐이라 문제 내용 자체를
 * 볼 방법이 없었다). 정답·해설은 스태프라 항상 보여준다(학생 응시 마스킹과 무관). */
export default function MockExamSetContentViewer({ items }: { items: MockExamSetContentItem[] }) {
  const [index, setIndex] = useState(0);
  const current = items[index];

  if (items.length === 0) {
    return <p className="text-[13px] text-grey-500">이 세트에는 문항이 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <div className="flex flex-wrap gap-1 md:w-[200px] md:flex-shrink-0 md:flex-col md:flex-nowrap md:overflow-y-auto md:max-h-[70vh]">
        {items.map((it, i) => (
          <button
            key={it.setItemId}
            type="button"
            onClick={() => setIndex(i)}
            className={`rounded px-2 py-1.5 text-left text-[12px] font-semibold ${
              i === index ? "bg-ink text-white" : "bg-grey-100 text-grey-600 hover:bg-grey-200"
            }`}
          >
            {SECTION_LABEL[it.section] ?? it.section} {it.position} · {it.satDomain}
          </button>
        ))}
      </div>

      {current && (
        <div className="min-w-0 flex-1 rounded-lg border border-grey-200 bg-white p-4">
          <p className="mb-2 text-[12px] font-bold text-grey-500">
            {SECTION_LABEL[current.section] ?? current.section} {current.position} · {current.satDomain}
            {current.skillCode ? ` · ${current.skillCode}` : ""} · {current.difficulty}
          </p>
          {current.passage && <RwStimulusView passage={current.passage} className="mb-3 text-[13px]" />}
          {current.question && <LearningText text={current.question} className="mb-3 font-semibold text-[13.5px]" />}
          {current.figure ? <ProblemFigure spec={current.figure} className="mb-3" /> : null}

          {current.options && current.options.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {current.options.map((opt, i) => {
                const isCorrect = current.correctIndex === i;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                      isCorrect ? "border-green bg-green/10 font-bold" : "border-grey-200"
                    }`}
                  >
                    <span>{OPTION_LETTERS[i] ?? i + 1}.</span>
                    <LearningText text={opt} />
                    {isCorrect && <span className="ml-auto shrink-0 text-[11px] font-bold text-green">정답</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px]">
              <span className="font-bold text-grey-500">정답: </span>
              {current.answers?.join(" 또는 ") ?? "-"}
            </p>
          )}

          {current.explanation && (
            <div className="mt-3 rounded-lg bg-grey-50 p-3 text-[12.5px] leading-relaxed">
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-grey-400">해설</p>
              <LearningText text={current.explanation} />
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="rounded-lg border border-grey-300 px-3 py-1.5 text-[12px] font-bold disabled:opacity-40"
            >
              이전
            </button>
            <span className="text-[12px] text-grey-500">
              {index + 1} / {items.length}
            </span>
            <button
              type="button"
              disabled={index === items.length - 1}
              onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
              className="rounded-lg border border-grey-300 px-3 py-1.5 text-[12px] font-bold disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
