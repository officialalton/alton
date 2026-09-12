"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionViewViewer } from "@/lib/session-view";
import type { MaterialData, MaterialProblem, CanvasStroke } from "./material-data";
import {
  submitEssayAttempt,
  submitMathAttempt,
  submitMcAttempt,
} from "./actions";
import {
  markMaterialUsedInLesson,
  markProblemUsedInLesson,
} from "./session-content-use-actions";
import MathCanvas from "./MathCanvas";
import CanvasOverlay, { type CanvasScope } from "./CanvasOverlay";
import VocabClickLayer from "./VocabClickLayer";
import AutoGrowTextarea from "./AutoGrowTextarea";

const DIFF_LABEL: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

export default function MaterialTab({
  sessionId,
  studentId,
  material,
  viewerRole,
  tipsVisible,
  privateStrokes = [],
}: {
  sessionId: string;
  studentId: string;
  material: MaterialData;
  viewerRole: SessionViewViewer;
  tipsVisible: boolean;
  /** 학생 본인만 보는 교재 필기. 다른 역할에는 서버가 아예 내려주지 않는다. */
  privateStrokes?: CanvasStroke[];
}) {
  // P3 3단계 — 원본 교재는 그대로 두고 필기 레이어만 바꿔 끼운다. 학생은
  // "함께 보는 필기"와 "나만 보는 필기"를 오갈 수 있고, 교사에게는 공용
  // 필기 하나뿐이다(학생 개인 필기는 교사에게 존재 자체가 보이지 않는다).
  const [scope, setScope] = useState<CanvasScope>("teacher_shared");
  const canUsePrivate = viewerRole === "student";
  const activeScope: CanvasScope = canUsePrivate ? scope : "teacher_shared";
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    material?.sections[0]?.id ?? null
  );
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!material) return;
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
    material.sections.forEach((s) => {
      const el = document.getElementById(`sec-${s.id}`);
      if (el) observer.observe(el);
    });
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [material]);

  if (!material) {
    return (
      <div className="p-8 text-[14px] text-grey-500">
        이 세션에는 아직 배정된 교재가 없습니다.
      </div>
    );
  }

  function scrollToSection(id: string) {
    document
      .getElementById(`sec-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    // 좁은 화면에서는 목차를 본문 위로 접어 올린다. 예전에는 220px 고정
    // 사이드바가 그대로 남아 본문이 화면 밖으로 밀려 읽을 수 없었다.
    <div className="md:grid md:grid-cols-[220px_1fr]">
      <nav className="border-b md:border-b-0 md:border-r border-grey-200 p-4 md:sticky md:top-0 md:self-start md:h-[calc(100vh-56px)] md:overflow-y-auto flex md:block gap-1.5 overflow-x-auto">
        <div className="hidden md:block text-[10.5px] font-extrabold text-grey-300 uppercase tracking-wider px-2 mb-1">
          교재 목차
        </div>
        {material.sections.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollToSection(s.id)}
            className={
              "md:w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] mb-0.5 whitespace-nowrap md:whitespace-normal flex-shrink-0 " +
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
            {s.problems.length > 0 && (
              <span className="ml-auto text-[10px] opacity-70" title="확인 문제 포함">
                ✏️
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-8">
        {canUsePrivate && (
          <div className="flex items-center gap-1.5 mb-3">
            {(
              [
                ["teacher_shared", "함께 보는 필기"],
                ["student_private", "나만 보는 필기"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setScope(value)}
                aria-pressed={activeScope === value}
                className={
                  "text-[11.5px] font-bold px-3 py-1.5 rounded-full border-[1.5px] " +
                  (activeScope === value ? "bg-ink text-white border-ink" : "border-grey-200 text-grey-500")
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <CanvasOverlay
          key={activeScope}
          sessionId={sessionId}
          curriculumDocId={material.docId}
          initialStrokes={activeScope === "student_private" ? privateStrokes : material.canvasStrokes}
          canDraw={viewerRole === "student" || viewerRole === "teacher"}
          scope={activeScope}
        >
          <VocabClickLayer
            sessionId={sessionId}
            studentId={studentId}
            enabled={viewerRole === "student" || viewerRole === "teacher"}
          >
            {material.sections.map((s) => (
              <div key={s.id} id={`sec-${s.id}`} className="mb-11 scroll-mt-[72px]">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="text-[21px] sm:text-[23px] font-extrabold text-[#0b2545] leading-tight">
                    {s.title}
                  </h2>
                  {viewerRole === "teacher" && (
                    <MarkUsedButton
                      sessionId={sessionId}
                      contentType="material_section"
                      contentId={s.id}
                    />
                  )}
                </div>
                {/* P2/P3 5단계 — 읽기 영역. learning-body가 그림·표·수식이
                    잘리거나 겹치지 않도록 처리한다(app/globals.css). 본문 HTML은
                    저장 시점에 이미 sanitize된 것이다(lib/sanitize-doc-html.ts). */}
                <div
                  className="learning-body text-[15px] sm:text-[16px] leading-[1.85] text-ink [&_b]:font-bold"
                  dangerouslySetInnerHTML={{ __html: s.body }}
                />
                {s.teachingTip && tipsVisible && viewerRole === "teacher" && (
                  <div className="mt-3 text-[12px] leading-[1.6] bg-yellow-bg border border-[#F2D98A] rounded-[10px] px-3.5 py-3 text-[#6B5300]">
                    <b className="block text-[11px] uppercase tracking-wide text-[#4A3900] mb-1">
                      티칭 팁
                    </b>
                    {s.teachingTip}
                  </div>
                )}
                {s.problems.map((p) => (
                  <ProblemCard
                    key={p.id}
                    sessionId={sessionId}
                    problem={p}
                    viewerRole={viewerRole}
                  />
                ))}
              </div>
            ))}
            <div className="h-[60vh]" aria-hidden />
          </VocabClickLayer>
        </CanvasOverlay>
      </div>
    </div>
  );
}

// R9(레슨 준비 Task 3) — 명시적 "사용 처리" 버튼. 선생님이 실제로 클릭했을 때만
// session_content_use_events에 한 행을 남긴다(session-content-use-actions.ts).
// 탭을 열거나 스크롤하는 것만으로는 절대 호출되지 않는다 — onClick 핸들러 밖에서는
// 이 액션들을 부르지 않는다.
function MarkUsedButton({
  sessionId,
  contentType,
  contentId,
}: {
  sessionId: string;
  contentType: "material_section" | "problem";
  contentId: string;
}) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function handleClick() {
    if (state === "saving" || state === "done") return;
    setState("saving");
    try {
      if (contentType === "material_section") {
        await markMaterialUsedInLesson(sessionId, contentId);
      } else {
        await markProblemUsedInLesson(sessionId, contentId);
      }
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "saving" || state === "done"}
      className={
        "flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " +
        (state === "done"
          ? "border-green bg-green-bg text-green"
          : "border-grey-200 text-grey-500 hover:bg-grey-100")
      }
    >
      {state === "done" ? "사용 처리됨" : state === "saving" ? "처리 중…" : "사용 처리"}
    </button>
  );
}

function ProblemCard({
  sessionId,
  problem,
  viewerRole,
}: {
  sessionId: string;
  problem: MaterialProblem;
  viewerRole: SessionViewViewer;
}) {
  const isStudent = viewerRole === "student";
  const isTeacher = viewerRole === "teacher";

  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(problem.done);
  const [wrongCount, setWrongCount] = useState(problem.priorWrongCount);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [essayText, setEssayText] = useState("");
  const [submittedResponse, setSubmittedResponse] = useState(
    problem.submittedResponse
  );

  const tags = [
    problem.skillType,
    problem.difficulty ? DIFF_LABEL[problem.difficulty] : null,
  ].filter(Boolean);

  async function handleGradeMc() {
    if (selected === null || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitMcAttempt(sessionId, problem.id, selected);
      if (!result.done) {
        setWrongCount((n) => n + 1);
        setMessage(`오답입니다. 다시 선택해보세요. (${3 - result.attemptNumber}번 남음)`);
        setTimeout(() => {
          setSelected(null);
          setMessage(null);
        }, 1200);
      } else {
        setDone(true);
        setMessage(
          result.correct
            ? `정답입니다! (${result.attemptNumber}번째 시도)`
            : `정답은 ${String.fromCharCode(65 + (result.correctIndex ?? 0))}번입니다. (${result.attemptNumber}번 시도)`
        );
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
      await submitEssayAttempt(sessionId, problem.id, essayText);
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
      await submitMathAttempt(sessionId, problem.id, dataUrl);
      setSubmittedResponse(dataUrl);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "제출 중 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  const showExplanation = isTeacher || done || !!submittedResponse;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 my-4">
      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-grey-100 text-grey-500"
            >
              {t}
            </span>
          ))}
        </div>
        {isTeacher && (
          <MarkUsedButton sessionId={sessionId} contentType="problem" contentId={problem.id} />
        )}
      </div>

      {isTeacher && problem.format === "mc" && problem.correctIndex !== null && (
        <div className="inline-block mb-2 text-[11px] font-bold px-2.5 py-1 rounded-md bg-ink text-white">
          정답: {String.fromCharCode(65 + problem.correctIndex)}
        </div>
      )}

      <p className="text-[14px] leading-[1.75] text-ink mb-3.5 whitespace-pre-wrap">
        {problem.passage}
      </p>

      {problem.format === "mc" && problem.options && (
        <>
          <div className="flex flex-col gap-2 mb-1.5">
            {problem.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrectChoice = done && i === problem.correctIndex;
              const isWrongChoice = done && isSelected && !isCorrectChoice;
              return (
                <button
                  key={i}
                  disabled={!isStudent || done}
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
                    (!isStudent || done ? " cursor-default opacity-90" : " cursor-pointer")
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
          {isStudent && (
            <div className="flex items-center gap-2.5 mt-3">
              {!done && (
                <button
                  disabled={selected === null || submitting}
                  onClick={handleGradeMc}
                  className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
                >
                  채점하기
                </button>
              )}
              {message && (
                <span className="text-[12.5px] text-grey-500">{message}</span>
              )}
            </div>
          )}
          {!isStudent && wrongCount > 0 && !done && (
            <p className="text-[12px] text-grey-500 mt-2">
              학생이 {wrongCount}번 시도했습니다.
            </p>
          )}
        </>
      )}

      {problem.format === "essay" && (
        <>
          {isStudent && !submittedResponse && (
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

      {problem.format === "math" && (
        <>
          {isStudent && !submittedResponse && (
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

      {showExplanation && (
        <div className="bg-grey-100 rounded-lg px-3.5 py-3 text-[13px] text-grey-700 leading-[1.6] mt-3">
          <b className="text-ink">해설</b>
          <br />
          {problem.explanation}
        </div>
      )}
    </div>
  );
}
