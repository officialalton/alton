"use client";

import { useRef, useState } from "react";
import type { SessionProblem } from "./session-problem-data";
import type { ProblemWorkBoard as Board } from "./problem-work-actions";
import { openProblemWork, submitProblemWork, loadProblemWorkBoard, listProblemAttempts } from "./problem-work-actions";
import ProblemWorkBoardCanvas, { type ProblemBoardHandle } from "./ProblemWorkBoard";
import LearningText from "./LearningText";
import { stripInlineOptions } from "@/lib/problem-text";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

/**
 * 이 수업에 고정된 문제들을 읽고 푸는 화면. 문제를 보면서 바로 풀이판을 열 수
 * 있고, 문제를 옮겨 다녀도 각 문제의 풀이가 그대로 남는다.
 *
 * 내부 ID·기술 상태값은 화면에 내보내지 않는다 — 사람이 읽는 번호·난이도·
 * 풀이 상태만 보여준다.
 */
export default function ProblemsPanel({
  sessionId,
  studentId,
  problems,
  viewerRole,
  viewerUserId,
}: {
  sessionId: string;
  studentId: string;
  problems: SessionProblem[];
  viewerRole: "student" | "teacher" | "parent" | "admin";
  /** 지금 보고 있는 사람 — 미저장 필기를 계정별로 갈라 두는 데 쓴다. */
  viewerUserId?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [attempts, setAttempts] = useState<{ workId: string; attemptNo: number; submitted: boolean }[]>([]);
  const [answerChoice, setAnswerChoice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boardRef = useRef<ProblemBoardHandle | null>(null);

  const isStudent = viewerRole === "student";
  const isTeacher = viewerRole === "teacher";
  const canDraw = isStudent || isTeacher;
  // 2026-09-14 UAT — 교사·관리자의 정답·해설은 기본 **접힘**. 화면을 학생과 함께 보며 풀 때
  // 답이 먼저 보이면 안 된다. 문제마다 펼친다. 학생은 서버가 정한 대로(제출 뒤에만 옴).
  const isTeacherLike = viewerRole === "teacher" || viewerRole === "admin";
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const answerShown = (p: SessionProblem) => !isTeacherLike || revealed.has(p.problemId);
  // 2026-09-14 UAT — 문제는 한 번에 하나(슬라이드). 왼쪽 목차와 이전/다음으로 오간다.
  const [current, setCurrent] = useState(0);
  const safeCurrent = Math.min(current, Math.max(0, problems.length - 1));
  const visibleProblems = problems.length ? [problems[safeCurrent]] : [];

  async function openBoard(problemId: string, newAttempt = false) {
    setBusy(true);
    setError(null);
    try {
      const next = await openProblemWork({ sessionId, studentId, problemId, newAttempt });
      setBoard(next);
      setAnswerChoice(next.submittedChoiceIndex);
      setOpenId(problemId);
      setAttempts(await listProblemAttempts({ sessionId, studentId, problemId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "풀이판을 열지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function showAttempt(workId: string) {
    setBusy(true);
    try {
      const next = await loadProblemWorkBoard(workId);
      if (next) {
        setBoard(next);
        setAnswerChoice(next.submittedChoiceIndex);
      }
    } finally {
      setBusy(false);
    }
  }

  if (problems.length === 0) {
    return (
      <div className="max-w-[760px] mx-auto px-6 py-12 text-center">
        <p className="text-[14px] font-bold text-ink mb-1">이 수업에는 문제가 없습니다</p>
        <p className="text-[12.5px] text-grey-500">
          선생님이 준비한 문제가 수업 시작 시점에 여기에 담깁니다.
        </p>
      </div>
    );
  }

  return (
    <div className="md:grid md:grid-cols-[200px_1fr]">
      <nav
        aria-label="문제 목차"
        className="border-b md:border-b-0 md:border-r border-grey-200 p-4 md:sticky md:top-0 md:self-start md:h-[calc(100vh-56px)] md:overflow-y-auto flex md:block gap-1.5 overflow-x-auto"
      >
        <div className="hidden md:block text-[10.5px] font-extrabold text-grey-300 uppercase tracking-wider px-2 mb-1">
          문제 목차
        </div>
        {problems.map((p, idx) => (
          <button
            key={p.problemId}
            onClick={() => {
              setCurrent(idx);
              setOpenId(null);
            }}
            aria-current={idx === safeCurrent ? "true" : undefined}
            className={
              "md:w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] mb-0.5 whitespace-nowrap md:whitespace-normal flex-shrink-0 flex items-center gap-2 " +
              (idx === safeCurrent ? "bg-red-bg text-red font-bold" : "text-ink hover:bg-grey-100")
            }
          >
            <span>문제 {p.number}</span>
            {p.solved && <span className="text-[10.5px] font-bold text-green">제출</span>}
            {!p.solved && p.attempts > 0 && <span className="text-[10.5px] font-bold text-grey-500">푸는 중</span>}
          </button>
        ))}
      </nav>

    <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-7 md:col-start-2">
      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}

      <div className="flex items-center justify-between mb-3">
        <span className="text-[12.5px] text-grey-500">
          {safeCurrent + 1} / {problems.length}
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={safeCurrent === 0}
            onClick={() => {
              setCurrent((c) => Math.max(0, c - 1));
              setOpenId(null);
            }}
            className="text-[12px] font-bold px-3 py-1 rounded border border-grey-200 disabled:opacity-40"
          >
            ← 이전 문제
          </button>
          <button
            type="button"
            disabled={safeCurrent >= problems.length - 1}
            onClick={() => {
              setCurrent((c) => Math.min(problems.length - 1, c + 1));
              setOpenId(null);
            }}
            className="text-[12px] font-bold px-3 py-1 rounded border border-grey-200 disabled:opacity-40"
          >
            다음 문제 →
          </button>
        </div>
      </div>

      {visibleProblems.map((p) => {
        const isOpen = openId === p.problemId;
        const pickedChoice = isOpen ? (board?.submitted ? board.submittedChoiceIndex : answerChoice) : null;
        return (
          <article
            key={p.problemId}
            id={`problem-${p.problemId}`}
            className="border-[1.5px] border-grey-200 rounded-2xl px-5 sm:px-7 py-6 mb-5 scroll-mt-[72px]"
          >
            <header className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-[14px] font-extrabold text-ink">문제 {p.number}</span>
              {p.difficulty && (
                <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-2 py-0.5">
                  {DIFFICULTY_LABEL[p.difficulty] ?? p.difficulty}
                </span>
              )}
              <span
                className={
                  "text-[10.5px] font-bold rounded-full px-2 py-0.5 " +
                  (p.solved ? "bg-green/10 text-green" : "bg-grey-100 text-grey-500")
                }
              >
                {p.planned
                  ? "수업 전 미리보기"
                  : p.solved
                    ? "제출함"
                    : p.attempts > 0
                      ? "푸는 중"
                      : "아직 풀지 않음"}
              </span>
              {p.attempts > 1 && (
                <span className="text-[10.5px] font-semibold text-grey-500">{p.attempts}번 풀어봄</span>
              )}
            </header>

            {p.passage ? (
              <LearningText
                text={stripInlineOptions(p.passage, p.options)}
                className="learning-body text-[15px] sm:text-[16px] leading-[1.8] text-ink mb-5"
              />
            ) : (
              <p className="text-[13px] text-grey-500 mb-4">지문이 없는 문제입니다.</p>
            )}

            {p.options.length > 0 && (
              <ol className="mb-4">
                {p.options.map((opt, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={!isStudent || !isOpen || Boolean(board?.submitted)}
                      onClick={() => setAnswerChoice(i)}
                      aria-pressed={pickedChoice === i}
                      className={
                        "w-full text-left text-[14.5px] leading-[1.75] py-2 px-3.5 rounded-lg mb-1.5 border-[1.5px] " +
                        (answerShown(p) && p.correctIndex === i
                          ? "bg-green/10 font-bold text-ink border-green/30"
                          : pickedChoice === i
                            ? "border-ink text-ink"
                            : "border-transparent text-ink")
                      }
                    >
                      <span className="text-grey-500 mr-2">{i + 1}</span>
                      <LearningText text={opt} className="learning-body inline" />
                      {answerShown(p) && p.correctIndex === i && (
                        <span className="ml-2 text-[11px] font-bold text-green">정답</span>
                      )}
                      {pickedChoice === i && board?.submitted && (
                        <span className="ml-2 text-[11px] font-bold text-grey-500">제출한 답</span>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {isTeacherLike && !p.planned && p.correctIndex !== null && (
              <button
                type="button"
                onClick={() => toggleReveal(p.problemId)}
                aria-pressed={revealed.has(p.problemId)}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink mb-4"
              >
                {revealed.has(p.problemId) ? "정답·해설 숨기기" : "정답·해설 보기"}
              </button>
            )}

            {answerShown(p) && p.explanation && (
              <div className="bg-grey-100 rounded-xl px-4 py-3 mb-4">
                <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-1">
                  해설
                </div>
                <LearningText
                  text={p.explanation}
                  className="learning-body text-[13.5px] leading-[1.75] text-ink"
                />
              </div>
            )}

            {p.planned ? (
              // 2026-09-14 — 시작 전에는 읽기만 한다. 풀이판·제출은 수업에서 열린다.
              <p className="text-[12px] text-grey-500">
                수업 시작 전 미리보기입니다. 풀이와 제출은 수업에서 합니다.
              </p>
            ) : (
              <>
            {!p.solved && p.correctIndex === null && isStudent && (
              <p className="text-[12px] text-grey-500 mb-4">
                풀이를 제출하면 정답과 해설이 열립니다.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={busy}
                onClick={() => (isOpen ? setOpenId(null) : void openBoard(p.problemId))}
                className="text-[12.5px] font-bold px-4 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
              >
                {isOpen ? "풀이판 닫기" : "✏️ 풀이판 열기"}
              </button>
              {isOpen && isStudent && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void openBoard(p.problemId, true)}
                    className="text-[12.5px] font-bold px-4 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                  >
                    다시 풀기
                  </button>
                  {board && !board.submitted && (
                    <button
                      disabled={busy || (p.options.length > 0 && answerChoice === null)}
                      title={
                        p.options.length > 0 && answerChoice === null ? "답을 먼저 고르세요" : undefined
                      }
                      onClick={async () => {
                        setBusy(true);
                        setError(null);
                        try {
                          // 제출 전에 아직 저장되지 않은 획을 먼저 저장한다.
                          // 저장에 실패하면 제출하지 않는다 — 저장 안 된 풀이가
                          // "제출 완료"로 보이면 안 된다.
                          const saved = await boardRef.current?.flush();
                          if (saved === false) {
                            setError("필기를 저장하지 못해 제출하지 않았습니다. 연결을 확인한 뒤 다시 제출하세요.");
                            return;
                          }
                          await submitProblemWork(board.workId, { choiceIndex: answerChoice });
                          const refreshed = await loadProblemWorkBoard(board.workId);
                          if (refreshed) setBoard(refreshed);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "제출하지 못했습니다.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="text-[12.5px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
                    >
                      풀이 제출
                    </button>
                  )}
                </>
              )}
            </div>

            {isOpen && board && board.workId === "" && (
              <p className="mt-4 text-[12.5px] text-grey-500">
                학생이 아직 이 문제를 풀기 시작하지 않았습니다. 학생이 풀이판을 열면
                여기에서 볼 수 있고, 그때 피드백을 남길 수 있습니다.
              </p>
            )}

            {isOpen && board && board.workId !== "" && (
              <div className="mt-4">
                {attempts.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {/* "회차"는 커리큘럼 회차를 가리키는 말이라 여기서는 쓰지
                        않는다 — 여기 숫자는 같은 문제를 몇 번째로 푸는지다. */}
                    <span className="text-[11px] font-bold text-grey-300 uppercase tracking-wide">
                      이전 풀이
                    </span>
                    {attempts.map((a) => (
                      <button
                        key={a.workId}
                        onClick={() => void showAttempt(a.workId)}
                        aria-pressed={board.workId === a.workId}
                        className={
                          "text-[11.5px] font-bold px-2.5 py-1 rounded-full border-[1.5px] " +
                          (board.workId === a.workId
                            ? "bg-ink text-white border-ink"
                            : "border-grey-200 text-grey-500")
                        }
                      >
                        {a.attemptNo}번째
                      </button>
                    ))}
                  </div>
                )}
                <ProblemWorkBoardCanvas
                  ref={boardRef}
                  key={board.workId}
                  sessionId={sessionId}
                  problemId={p.problemId}
                  workId={board.workId}
                  attemptNo={board.attemptNo}
                  studentStrokes={board.studentStrokes}
                  strokesAfterSubmit={board.strokesAfterSubmit}
                  feedbackStrokes={board.feedbackStrokes}
                  canDraw={canDraw && !(isStudent && board.submitted)}
                  drawAsFeedback={isTeacher}
                  viewerUserId={viewerUserId}
                  readOnlyReason={
                    viewerRole === "parent"
                      ? "보호자는 읽기 전용입니다"
                      : isStudent && board.submitted
                        ? "제출한 풀이는 고칠 수 없습니다 — 다시 풀기로 새 풀이를 시작하세요"
                        : undefined
                  }
                />
              </div>
            )}
              </>
            )}
          </article>
        );
      })}
    </div>
    </div>
  );
}
