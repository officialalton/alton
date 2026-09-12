"use client";

import { useState } from "react";
import type { SessionProblem } from "./session-problem-data";
import type { ProblemWorkBoard as Board } from "./problem-work-actions";
import { openProblemWork, submitProblemWork, loadProblemWorkBoard, listProblemAttempts } from "./problem-work-actions";
import ProblemWorkBoardCanvas from "./ProblemWorkBoard";

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
}: {
  sessionId: string;
  studentId: string;
  problems: SessionProblem[];
  viewerRole: "student" | "teacher" | "parent" | "admin";
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [attempts, setAttempts] = useState<{ workId: string; attemptNo: number; submitted: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStudent = viewerRole === "student";
  const isTeacher = viewerRole === "teacher";
  const canDraw = isStudent || isTeacher;

  async function openBoard(problemId: string, newAttempt = false) {
    setBusy(true);
    setError(null);
    try {
      const next = await openProblemWork({ sessionId, studentId, problemId, newAttempt });
      setBoard(next);
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
      if (next) setBoard(next);
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
    <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-6">
      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}

      {problems.map((p) => {
        const isOpen = openId === p.problemId;
        return (
          <article
            key={p.problemId}
            className="border-[1.5px] border-grey-200 rounded-2xl px-5 sm:px-6 py-5 mb-4"
          >
            <header className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[13px] font-extrabold text-ink">문제 {p.number}</span>
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
                {p.solved ? "제출함" : p.attempts > 0 ? "푸는 중" : "아직 풀지 않음"}
              </span>
              {p.attempts > 1 && (
                <span className="text-[10.5px] font-semibold text-grey-500">{p.attempts}번 풀었음</span>
              )}
            </header>

            {p.passage ? (
              <div className="text-[15px] leading-[1.75] text-ink whitespace-pre-wrap mb-4">
                {p.passage}
              </div>
            ) : (
              <p className="text-[13px] text-grey-500 mb-4">지문이 없는 문제입니다.</p>
            )}

            {p.options.length > 0 && (
              <ol className="mb-4">
                {p.options.map((opt, i) => (
                  <li
                    key={i}
                    className={
                      "text-[14px] leading-[1.7] py-1.5 px-3 rounded-lg mb-1 " +
                      (p.correctIndex === i ? "bg-green/10 font-bold text-ink" : "text-ink")
                    }
                  >
                    <span className="text-grey-500 mr-2">{i + 1}</span>
                    {opt}
                    {p.correctIndex === i && (
                      <span className="ml-2 text-[11px] font-bold text-green">정답</span>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {p.explanation && (
              <div className="bg-grey-100 rounded-xl px-4 py-3 mb-4">
                <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-1">
                  해설
                </div>
                <p className="text-[13.5px] leading-[1.7] text-ink whitespace-pre-wrap">{p.explanation}</p>
              </div>
            )}

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
                      disabled={busy}
                      onClick={async () => {
                        await submitProblemWork(board.workId);
                        setBoard({ ...board, submitted: true });
                      }}
                      className="text-[12.5px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
                    >
                      풀이 제출
                    </button>
                  )}
                </>
              )}
            </div>

            {isOpen && board && (
              <div className="mt-4">
                {attempts.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className="text-[11px] font-bold text-grey-300 uppercase tracking-wide">
                      지난 풀이
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
                        {a.attemptNo}회
                      </button>
                    ))}
                  </div>
                )}
                <ProblemWorkBoardCanvas
                  key={board.workId}
                  sessionId={sessionId}
                  problemId={p.problemId}
                  workId={board.workId}
                  attemptNo={board.attemptNo}
                  studentStrokes={board.studentStrokes}
                  feedbackStrokes={board.feedbackStrokes}
                  canDraw={canDraw && !(isStudent && board.submitted)}
                  drawAsFeedback={isTeacher}
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
          </article>
        );
      })}
    </div>
  );
}
