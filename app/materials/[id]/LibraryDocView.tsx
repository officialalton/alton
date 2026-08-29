"use client";

import { useEffect, useRef, useState } from "react";
import type { LibraryDocDetail, LibraryProblem } from "@/app/student/materials-data";
import type { SessionViewViewer } from "@/lib/session-view";
import {
  retryEssayAttempt,
  retryMathAttempt,
  retryMcAttempt,
} from "@/app/session/[id]/problemlog-actions";
import MathCanvas from "@/app/session/[id]/MathCanvas";
import AutoGrowTextarea from "@/app/session/[id]/AutoGrowTextarea";

const DIFF_LABEL: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

export default function LibraryDocView({
  doc,
  viewerRole,
  studentId,
}: {
  doc: LibraryDocDetail;
  viewerRole: SessionViewViewer;
  studentId: string | null;
}) {
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
              <h2 className="text-[22px] font-extrabold text-[#0b2545] mb-3">
                {s.title}
              </h2>
              <div
                className="text-[14px] leading-[1.75] text-ink [&_b]:font-bold"
                dangerouslySetInnerHTML={{ __html: s.body }}
              />
              {s.problems.map((p) => (
                <LibraryProblemCard
                  key={p.id}
                  problem={p}
                  viewerRole={viewerRole}
                  studentId={studentId}
                />
              ))}
            </div>
          ))}
          <div className="h-[60vh]" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function LibraryProblemCard({
  problem,
  viewerRole,
}: {
  problem: LibraryProblem;
  viewerRole: SessionViewViewer;
  studentId: string | null;
}) {
  const isStudent = viewerRole === "student";
  const isTeacherLike = viewerRole === "teacher" || viewerRole === "admin";

  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(problem.done);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [essayText, setEssayText] = useState("");
  const [submittedResponse, setSubmittedResponse] = useState(
    problem.submittedResponse
  );

  const tags = [
    problem.skillType,
    problem.difficulty ? DIFF_LABEL[problem.difficulty] : null,
  ].filter((v): v is string => !!v);

  async function handleGradeMc() {
    if (selected === null || submitting) return;
    setSubmitting(true);
    try {
      const result = await retryMcAttempt(problem.id, selected);
      if (!result.done) {
        setMessage("오답입니다. 다시 선택해보세요.");
        setTimeout(() => {
          setSelected(null);
          setMessage(null);
        }, 1200);
      } else {
        setDone(true);
        setMessage(result.correct ? "정답입니다!" : "정답을 확인하세요.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "채점 중 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitEssay() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await retryEssayAttempt(problem.id, essayText);
      setSubmittedResponse(essayText.trim());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "제출 중 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitMath(dataUrl: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await retryMathAttempt(problem.id, dataUrl);
      setSubmittedResponse(dataUrl);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "제출 중 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  const showAnswer = isTeacherLike || done || !!submittedResponse;

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

      {isTeacherLike && problem.format === "mc" && problem.correctIndex !== null && (
        <div className="inline-block mb-2 text-[11px] font-bold px-2.5 py-1 rounded-md bg-ink text-white">
          정답: {String.fromCharCode(65 + problem.correctIndex)}
        </div>
      )}

      <p className="text-[14px] leading-[1.75] text-ink mb-3.5 whitespace-pre-wrap">
        {problem.passage}
      </p>

      {!isStudent && !isTeacherLike && (
        <p className="text-[12.5px] text-grey-500">
          이 문제는 학생 계정으로 로그인해야 풀 수 있습니다.
        </p>
      )}

      {isStudent && problem.format === "mc" && problem.options && (
        <>
          <div className="flex flex-col gap-2 mb-1.5">
            {problem.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrectChoice = done && i === problem.correctIndex;
              const isWrongChoice = done && isSelected && !isCorrectChoice;
              return (
                <button
                  key={i}
                  disabled={done}
                  onClick={() => setSelected(i)}
                  className={
                    "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] border-[1.5px] text-[13.5px] text-left " +
                    (isCorrectChoice
                      ? "border-green bg-green-bg text-green"
                      : isWrongChoice
                        ? "border-red bg-red-bg text-red"
                        : isSelected
                          ? "border-ink bg-grey-100"
                          : "border-grey-200") +
                    (done ? " cursor-default opacity-90" : " cursor-pointer")
                  }
                >
                  <span className="w-[22px] h-[22px] rounded-full border-[1.5px] border-grey-300 flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
          {!done && (
            <div className="flex items-center gap-2.5 mt-3">
              <button
                disabled={selected === null || submitting}
                onClick={handleGradeMc}
                className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
              >
                채점하기
              </button>
              {message && (
                <span className="text-[12.5px] text-grey-500">{message}</span>
              )}
            </div>
          )}
        </>
      )}

      {isTeacherLike && problem.format === "mc" && problem.options && (
        <div className="flex flex-col gap-2 mb-1.5">
          {problem.options.map((opt, i) => (
            <div
              key={i}
              className={
                "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] border-[1.5px] text-[13.5px] " +
                (i === problem.correctIndex
                  ? "border-green bg-green-bg text-green"
                  : "border-grey-200")
              }
            >
              <span className="w-[22px] h-[22px] rounded-full border-[1.5px] border-grey-300 flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </div>
          ))}
        </div>
      )}

      {isStudent && problem.format === "essay" && (
        <>
          {!submittedResponse && (
            <>
              <AutoGrowTextarea
                value={essayText}
                onChange={setEssayText}
                placeholder="답안을 입력하세요"
              />
              <div className="mt-3">
                <button
                  disabled={submitting}
                  onClick={handleSubmitEssay}
                  className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
                >
                  제출하기
                </button>
              </div>
            </>
          )}
          {submittedResponse && (
            <div className="bg-grey-100 rounded-lg px-3.5 py-3 text-[13px] text-ink whitespace-pre-wrap">
              {submittedResponse}
            </div>
          )}
        </>
      )}

      {isStudent && problem.format === "math" && (
        <>
          {!submittedResponse && (
            <MathCanvas onSubmit={handleSubmitMath} submitting={submitting} />
          )}
          {submittedResponse && submittedResponse.startsWith("data:") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={submittedResponse}
              alt="제출한 풀이"
              className="border border-grey-200 rounded-lg max-w-full"
            />
          )}
        </>
      )}

      {showAnswer && (
        <div className="bg-grey-100 rounded-lg px-3.5 py-3 text-[13px] text-grey-700 leading-[1.6] mt-3">
          <b className="text-ink">해설</b>
          <br />
          {problem.explanation}
        </div>
      )}
    </div>
  );
}
