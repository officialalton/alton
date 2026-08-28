"use client";

import { useEffect, useRef, useState } from "react";
import type { LibraryDocDetail, LibraryProblem } from "@/app/student/materials-data";

const DIFF_LABEL: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

export default function LibraryDocView({ doc }: { doc: LibraryDocDetail }) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    doc.sections[0]?.id ?? null
  );
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    observerRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id.replace("sec-", ""));
          }
        });
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    doc.sections.forEach((s) => {
      const el = document.getElementById(`sec-${s.id}`);
      if (el) observer.observe(el);
    });
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [doc]);

  function scrollToSection(id: string) {
    document
      .getElementById(`sec-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-grey-200 px-6 py-3">
        <div className="text-[11px] font-bold text-grey-500 mb-0.5">
          📖 교재 라이브러리
        </div>
        <div className="text-[15px] font-bold text-ink">{doc.title}</div>
      </div>

      <div className="grid grid-cols-[220px_1fr]">
        <nav className="border-r border-grey-200 p-4 sticky top-0 self-start h-[calc(100vh-56px)] overflow-y-auto">
          <div className="text-[10.5px] font-extrabold text-grey-300 uppercase tracking-wider px-2 mb-1">
            목차
          </div>
          {doc.sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={
                "w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] mb-0.5 " +
                (activeSectionId === s.id
                  ? "bg-red-bg text-red font-bold"
                  : "text-grey-500 hover:bg-grey-100")
              }
            >
              <span
                className={
                  "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 " +
                  (activeSectionId === s.id ? "bg-red" : "bg-grey-300")
                }
              />
              {s.title}
            </button>
          ))}
        </nav>

        <div className="max-w-[720px] px-8 py-8">
          {doc.sections.map((s) => (
            <div key={s.id} id={`sec-${s.id}`} className="mb-11 scroll-mt-[72px]">
              <h2 className="text-[18px] font-extrabold text-ink mb-3">
                {s.title}
              </h2>
              <div
                className="text-[14px] leading-[1.75] text-ink [&_b]:font-bold"
                dangerouslySetInnerHTML={{ __html: s.body }}
              />
              {s.problems.map((p) => (
                <ProblemPreview key={p.id} problem={p} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProblemPreview({ problem }: { problem: LibraryProblem }) {
  const tags = [
    problem.skillType,
    problem.difficulty ? DIFF_LABEL[problem.difficulty] : null,
  ].filter(Boolean);

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 my-4">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <span
            key={t}
            className="text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-grey-100 text-grey-500"
          >
            {t}
          </span>
        ))}
      </div>

      <p className="text-[14px] leading-[1.75] text-ink mb-3.5 whitespace-pre-wrap">
        {problem.passage}
      </p>

      {problem.format === "mc" && problem.options && (
        <div className="flex flex-col gap-2 mb-1.5">
          {problem.options.map((opt, i) => {
            const isCorrect = i === problem.correctIndex;
            return (
              <div
                key={i}
                className={
                  "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] border-[1.5px] text-[13.5px] " +
                  (isCorrect
                    ? "border-green bg-green-bg text-green"
                    : "border-grey-200")
                }
              >
                <span className="w-[22px] h-[22px] rounded-full border-[1.5px] border-grey-300 flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-grey-100 rounded-lg px-3.5 py-3 text-[13px] text-grey-700 leading-[1.6] mt-3">
        <b className="text-ink">해설</b>
        <br />
        {problem.explanation}
      </div>
    </div>
  );
}
