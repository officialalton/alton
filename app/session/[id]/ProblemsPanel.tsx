"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import type { ProblemGrade, ProblemSource, SessionProblem } from "./session-problem-data";
import type { ProblemWorkBoard as Board } from "./problem-work-actions";
import {
  answerMcChoice,
  answerSprText,
  answerEssayText,
  gradeProblemAttempt,
  listProblemAttempts,
  loadProblemWorkBoard,
  openProblemWork,
  refreshSessionProblems,
  submitProblemWork,
} from "./problem-work-actions";
import ProblemWorkBoardCanvas, { type ProblemBoardHandle } from "./ProblemWorkBoard";
import LearningText from "./LearningText";
import { stripInlineOptions } from "@/lib/problem-text";
import PdfPageAnnotationLayer from "./PdfPageAnnotationLayer";
import { renderFigureSvg } from "@/lib/problem-figures/render";
import type { FigureSpec } from "@/lib/problem-figures/spec";
import ProblemFigure from "./ProblemFigure";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

const FORMAT_LABEL: Record<SessionProblem["format"], string> = {
  mc: "객관식",
  spr: "숫자 입력",
  essay: "서술형",
  math: "풀이형",
};

const GRADE_LABEL: Record<ProblemGrade, string> = {
  correct: "정답",
  partial: "부분 정답",
  incorrect: "오답",
};

/**
 * 이 수업에 고정된 문제들을 읽고 푸는 화면.
 *
 * 2026-09-14 UAT(학생 포털) — 유형마다 푸는 방식이 다르다.
 *   - 객관식: 선택지 **클릭이 곧 답**(즉시 저장, 채점 전엔 바꿀 수 있다). 풀이판·제출 없음.
 *     아래 연습장은 선택.
 *   - 서술형: 아래 연습장에 쓴다(자동 저장). 제출 없음.
 *   - 풀이형: 풀이판을 열어 풀고 `풀이 제출`.
 * 정답·해설은 **교사가 채점을 끝낸 문제만** 학생에게 열린다(서버가 정한다). 교사는 문제마다
 * `채점` 구역에서 정답/부분/오답을 정한다 — 객관식은 자동 채점 결과를 그대로 확정할 수 있다.
 *
 * 내부 ID·기술 상태값은 화면에 내보내지 않는다.
 */
export default function ProblemsPanel({
  sessionId,
  studentId,
  problems: initialProblems,
  viewerRole,
  viewerUserId,
  source = "lesson",
}: {
  sessionId: string;
  studentId: string;
  problems: SessionProblem[];
  viewerRole: "student" | "teacher" | "parent" | "admin";
  /** 지금 보고 있는 사람 — 미저장 필기를 계정별로 갈라 두는 데 쓴다. */
  viewerUserId?: string;
  /** 수업 문제 / 과제 문제(2026-09-14 과제 v3 통일) — 풀이·채점 흐름은 같고 말과 출처만 다르다. */
  source?: ProblemSource;
}) {
  const noun = source === "homework" ? "과제" : "문제";

  // 2026-09-14 UAT — 문제 화면 전체(여백 포함)에 교사·학생 공유 필기를 얹는다. PDF 페이지 필기와 같은 레이어이며
  // 대상만 (수업, 문제)다. 수업 문제와 과제 문제가 같은 패널이라 과제 탭에서도 그대로 된다.
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [sheetSize, setSheetSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setSheetSize({ width: Math.floor(el.clientWidth), height: Math.floor(el.clientHeight) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const layerRole: "teacher" | "student" | "reader" =
    viewerRole === "teacher" ? "teacher" : viewerRole === "student" ? "student" : "reader";
  const [problems, setProblems] = useState(initialProblems);
  // 서버가 새 목록을 내려주면(페이지 재렌더) 그것을 따른다 — 렌더 중 상태 맞추기.
  const [seenInitial, setSeenInitial] = useState(initialProblems);
  if (seenInitial !== initialProblems) {
    setSeenInitial(initialProblems);
    setProblems(initialProblems);
  }

  const [openId, setOpenId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [attempts, setAttempts] = useState<{ workId: string; attemptNo: number; submitted: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  /** 연습장·풀이판 여닫기만 잠근다 — 채점·답 저장과 얽히지 않는다(2026-09-14 UAT: 버튼이 잠긴 채 남았다). */
  const [boardBusy, setBoardBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedChoiceId, setSavedChoiceId] = useState<string | null>(null);
  // 숫자 입력(SPR) 초안 — 문제마다. 저장은 버튼/Enter.
  const [sprDraft, setSprDraft] = useState<Record<string, string>>({});
  const boardRef = useRef<ProblemBoardHandle | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const isStudent = viewerRole === "student";
  const isTeacher = viewerRole === "teacher";
  const canDraw = isStudent || isTeacher;
  // 교사·관리자의 정답·해설은 기본 **접힘** — 화면을 학생과 함께 보며 풀 때 답이 먼저 보이면 안 된다.
  const isTeacherLike = viewerRole === "teacher" || viewerRole === "admin";
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // 채점이 끝난 문제는 누구에게나 정답이 초록으로 표시된다(2026-09-14 UAT). 교사는 채점 전에도 펼쳐 볼 수 있다.
  const answerShown = (p: SessionProblem) => p.graded || (isTeacherLike && revealed.has(p.problemId));

  // 채점 초안(교사) — 문제마다.
  const [gradeDraft, setGradeDraft] = useState<Record<string, { grade: ProblemGrade | null; comment: string }>>({});
  const [regrading, setRegrading] = useState<Set<string>>(new Set());

  // 문제는 한 번에 하나(슬라이드). 왼쪽 목차와 이전/다음으로 오간다.
  const [current, setCurrent] = useState(0);
  const safeCurrent = Math.min(current, Math.max(0, problems.length - 1));
  const visibleProblems = problems.length ? [problems[safeCurrent]] : [];
  const anyPlanned = problems.some((p) => p.planned);

  // 상대 화면의 변화(학생이 답함 / 교사가 채점함)를 받아 목록을 다시 읽는다.
  const refresh = useCallback(async () => {
    try {
      const next = await refreshSessionProblems(sessionId, source);
      // 문제가 있던 수업이 비어서 돌아오면(권한·일시 오류) 지금 화면을 지우지 않는다.
      if (next.length > 0) setProblems(next);
    } catch {
      // 다시 읽기 실패 — 지금 화면을 그대로 둔다. 다음 알림에서 또 시도한다.
    }
  }, [sessionId, source]);

  useEffect(() => {
    if (anyPlanned || problems.length === 0) return;
    const supabase = createClient();
    const channel = supabase.channel(`session-problems:${sessionId}:${source}`);
    channel.on("broadcast", { event: "changed" }, () => void refresh()).subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [sessionId, source, anyPlanned, problems.length, refresh]);

  const notifyChanged = () =>
    channelRef.current?.send({ type: "broadcast", event: "changed", payload: {} });

  async function openBoard(problemId: string, newAttempt = false) {
    setBoardBusy(true);
    setError(null);
    try {
      const next = await openProblemWork({ sessionId, studentId, problemId, newAttempt, source });
      setBoard(next);
      setOpenId(problemId);
      setAttempts(await listProblemAttempts({ sessionId, studentId, problemId, source }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "풀이판을 열지 못했습니다.");
    } finally {
      setBoardBusy(false);
    }
  }

  const currentProblem = visibleProblems[0];

  // 서술형 답 — 글 상자에 타이핑, 쓰는 대로 저장(잠깐 멈추면). 2026-09-14 UAT: 화이트보드가 아니다.
  const [essayDraft, setEssayDraft] = useState<Record<string, string>>({});
  const [essaySaved, setEssaySaved] = useState<Record<string, "saving" | "saved" | "error">>({});
  const essayTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function editEssay(p: SessionProblem, text: string) {
    if (!isStudent || p.planned || p.graded) return;
    setEssayDraft((d) => ({ ...d, [p.problemId]: text }));
    const timers = essayTimerRef.current;
    if (timers[p.problemId]) clearTimeout(timers[p.problemId]);
    timers[p.problemId] = setTimeout(() => void saveEssay(p, text), 700);
  }
  async function saveEssay(p: SessionProblem, text: string) {
    setEssaySaved((m) => ({ ...m, [p.problemId]: "saving" }));
    const res = await answerEssayText({ sessionId, studentId, problemId: p.problemId, text, source });
    if (!res.ok) {
      setEssaySaved((m) => ({ ...m, [p.problemId]: "error" }));
      setError(res.error);
      return;
    }
    setEssaySaved((m) => ({ ...m, [p.problemId]: "saved" }));
    setProblems((ps) =>
      ps.map((x) => (x.problemId === p.problemId ? { ...x, myText: text, attempts: Math.max(1, x.attempts) } : x))
    );
    notifyChanged();
  }
  useEffect(() => {
    const timers = essayTimerRef.current;
    return () => {
      for (const t of Object.values(timers)) clearTimeout(t);
    };
  }, []);

  async function showAttempt(workId: string) {
    setBoardBusy(true);
    try {
      const next = await loadProblemWorkBoard(workId);
      if (next) setBoard(next);
    } finally {
      setBoardBusy(false);
    }
  }

  async function pickChoice(p: SessionProblem, index: number) {
    if (!isStudent || p.planned || p.graded || busy) return;
    if (p.myChoice === index) return;
    const before = problems;
    // 먼저 표시하고 저장한다 — 실패하면 되돌리고 사유를 보여준다.
    setProblems((ps) =>
      ps.map((x) =>
        x.problemId === p.problemId ? { ...x, myChoice: index, solved: true, attempts: Math.max(1, x.attempts) } : x
      )
    );
    setError(null);
    setSavedChoiceId(null);
    const res = await answerMcChoice({ sessionId, studentId, problemId: p.problemId, choiceIndex: index, source });
    if (!res.ok) {
      setProblems(before);
      setError(res.error);
      return;
    }
    setSavedChoiceId(p.problemId);
    notifyChanged();
    void refresh();
  }

  async function saveSpr(p: SessionProblem) {
    if (!isStudent || p.planned || p.graded || busy) return;
    const text = (sprDraft[p.problemId] ?? p.myText ?? "").trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    setSavedChoiceId(null);
    const res = await answerSprText({ sessionId, studentId, problemId: p.problemId, text, source });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setProblems((ps) =>
      ps.map((x) => (x.problemId === p.problemId ? { ...x, myText: text, solved: true, attempts: Math.max(1, x.attempts) } : x))
    );
    setSavedChoiceId(p.problemId);
    notifyChanged();
    void refresh();
  }

  async function grade(p: SessionProblem) {
    if (!p.latestWorkId) return;
    const draft = gradeDraft[p.problemId] ?? { grade: null, comment: "" };
    setBusy(true);
    setError(null);
    try {
      const res = await gradeProblemAttempt({
        workId: p.latestWorkId,
        grade: draft.grade,
        comment: draft.comment,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRegrading((prev) => {
        const next = new Set(prev);
        next.delete(p.problemId);
        return next;
      });
      notifyChanged();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function statusLabel(p: SessionProblem): string {
    if (p.planned) return "수업 전 미리보기";
    if (p.graded) return `채점 완료 · ${p.grade ? GRADE_LABEL[p.grade] : ""}`.trim();
    if (p.format === "mc") return p.myChoice !== null ? "답 저장됨 · 채점 대기" : "아직 풀지 않음";
    if (p.format === "spr") return p.myText ? "답 저장됨 · 채점 대기" : "아직 풀지 않음";
    if (p.format === "essay") return p.myText?.trim() ? "쓰는 중 · 채점 대기" : "아직 풀지 않음";
    return p.solved ? "제출함 · 채점 대기" : p.attempts > 0 ? "푸는 중" : "아직 풀지 않음";
  }

  function tocBadge(p: SessionProblem): { text: string; className: string } | null {
    if (p.planned) return null;
    // 2026-09-14 UAT: '채점됨'이 아니라 결과(정답/부분/오답)를 바로 보여준다.
    if (p.graded && p.grade) {
      return {
        text: GRADE_LABEL[p.grade],
        className: p.grade === "correct" ? "text-green" : p.grade === "partial" ? "text-amber-600" : "text-red",
      };
    }
    if (p.graded) return { text: "채점됨", className: "text-green" };
    const answered =
      p.format === "mc" ? p.myChoice !== null : p.format === "spr" || p.format === "essay" ? Boolean(p.myText?.trim()) : p.solved;
    if (answered) return { text: "제출", className: "text-ink" };
    if (p.attempts > 0) return { text: "푸는 중", className: "text-grey-500" };
    return null;
  }

  if (problems.length === 0) {
    return (
      <div className="max-w-[760px] mx-auto px-6 py-12 text-center">
        <p className="text-[14px] font-bold text-ink mb-1">
          {source === "homework" ? "아직 발급된 과제가 없습니다" : "이 수업에는 문제가 없습니다"}
        </p>
        <p className="text-[12.5px] text-grey-500">
          {source === "homework"
            ? "선생님이 발급하면 여기에 나타납니다."
            : "선생님이 준비한 문제가 수업 시작 시점에 여기에 담깁니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="md:grid md:grid-cols-[200px_1fr]">
      <nav
        aria-label={`${noun} 목차`}
        className="border-b md:border-b-0 md:border-r border-grey-200 p-4 md:sticky md:top-0 md:self-start md:h-[calc(100vh-56px)] md:overflow-y-auto flex md:block gap-1.5 overflow-x-auto"
      >
        <div className="hidden md:block text-[10.5px] font-extrabold text-grey-300 uppercase tracking-wider px-2 mb-1">
          {noun} 목차
        </div>
        {!anyPlanned && (
          // 점수 — 정답만 센다(부분 정답은 세지 않는다). 2026-09-14 UAT.
          <div
            data-testid="problem-score"
            className="hidden md:block text-[12px] font-bold text-ink px-2.5 py-2 mb-2 border-b border-grey-200"
          >
            맞은 {noun} <span className="text-green">{problems.filter((p) => p.graded && p.grade === "correct").length}</span> / {problems.length}
            <span className="text-grey-500 font-semibold"> · 채점 {problems.filter((p) => p.graded).length}</span>
          </div>
        )}
        {problems.map((p, idx) => {
          const badge = tocBadge(p);
          return (
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
              <span>{noun} {p.number}</span>
              {badge && <span className={"text-[10.5px] font-bold " + badge.className}>{badge.text}</span>}
            </button>
          );
        })}
      </nav>

      <div ref={sheetRef} className="relative md:col-start-2 w-full" data-testid="problem-sheet">
      {currentProblem && !currentProblem.planned && (
        <PdfPageAnnotationLayer
          key={`${sessionId}:${source}:${currentProblem.problemId}`}
          target={{ sessionId, problemId: currentProblem.problemId, context: source }}
          role={layerRole}
          viewerUserId={viewerUserId}
          width={sheetSize.width}
          height={sheetSize.height}
        />
      )}
      <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-7 w-full">
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
              ← 이전 {noun}
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
              다음 {noun} →
            </button>
          </div>
        </div>

        {visibleProblems.map((p) => {
          const isOpen = openId === p.problemId;
          const isMc = p.format === "mc";
          const isSpr = p.format === "spr";
          const isEssay = p.format === "essay";
          const isMath = p.format === "math";
          const canPick = isStudent && !p.planned && !p.graded && isMc;
          const draft = gradeDraft[p.problemId] ?? { grade: null, comment: "" };
          const showGradeForm = isTeacher && !p.planned && p.latestWorkId && (!p.graded || regrading.has(p.problemId));

          return (
            <article
              key={p.problemId}
              id={`problem-${p.problemId}`}
              className="border-[1.5px] border-grey-200 rounded-2xl px-5 sm:px-7 py-6 mb-5 scroll-mt-[72px]"
            >
              <header className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-[14px] font-extrabold text-ink">{noun} {p.number}</span>
                <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-2 py-0.5">
                  {FORMAT_LABEL[p.format]}
                </span>
                {p.difficulty && (
                  <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-2 py-0.5">
                    {DIFFICULTY_LABEL[p.difficulty] ?? p.difficulty}
                  </span>
                )}
                <span
                  className={
                    "text-[10.5px] font-bold rounded-full px-2 py-0.5 " +
                    (p.graded
                      ? p.grade === "incorrect"
                        ? "bg-red-bg text-red"
                        : "bg-green/10 text-green"
                      : "bg-grey-100 text-grey-500")
                  }
                >
                  {statusLabel(p)}
                </span>
                {p.attempts > 1 && (
                  <span className="text-[10.5px] font-semibold text-grey-500">{p.attempts}번 풀어봄</span>
                )}
              </header>

              {/* 그래프/도형 선택지(figure_choice)는 선택지 칸 안에 그림을 그린다 — 위에 따로 그리지 않는다. */}
              {p.figure != null && (p.figure as { type?: string }).type !== "figure_choice" && <ProblemFigure spec={p.figure} className="mb-4" />}

              {p.passage ? (
                <LearningText
                  text={stripInlineOptions(p.passage, p.options)}
                  className="learning-body text-[15px] sm:text-[16px] leading-[1.8] text-ink mb-5"
                />
              ) : (
                <p className="text-[13px] text-grey-500 mb-4">지문이 없는 문제입니다.</p>
              )}

              {p.options.length > 0 && (
                <ol className="mb-3">
                  {p.options.map((opt, i) => {
                    const mine = p.myChoice === i;
                    const correct = answerShown(p) && p.correctIndex === i;
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          disabled={!canPick || busy}
                          onClick={() => void pickChoice(p, i)}
                          aria-pressed={mine}
                          className={
                            "w-full text-left text-[14.5px] leading-[1.75] py-2 px-3.5 rounded-lg mb-1.5 border-[1.5px] " +
                            (correct
                              ? "bg-green/10 font-bold text-ink border-green/30"
                              : mine
                                ? "border-ink text-ink"
                                : "border-transparent text-ink") +
                            (canPick ? " hover:bg-grey-100" : "")
                          }
                        >
                          <span className="text-grey-500 mr-2">{i + 1}</span>
                          {(p.figure as { type?: string } | null)?.type === "figure_choice" && Array.isArray((p.figure as { choices?: unknown[] }).choices) && (p.figure as { choices: unknown[] }).choices[i] ? (
                            <span
                              className="block max-w-[320px] mt-1 [&_svg]:w-full [&_svg]:h-auto"
                              data-testid={`choice-figure-${i}`}
                              dangerouslySetInnerHTML={{ __html: renderFigureSvg((p.figure as { choices: FigureSpec[] }).choices[i]) }}
                            />
                          ) : (
                            <LearningText text={opt} className="learning-body inline" />
                          )}
                          {correct && <span className="ml-2 text-[11px] font-bold text-green">정답</span>}
                          {mine && (
                            <span className="ml-2 text-[11px] font-bold text-grey-500">
                              {isStudent ? "내 답" : "학생 답"}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}

              {isSpr && !p.planned && (
                <div className="mb-4" data-testid="spr-answer">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-[12.5px] font-bold text-ink" htmlFor={`spr-${p.problemId}`}>답</label>
                    <input
                      id={`spr-${p.problemId}`}
                      aria-label="숫자 답"
                      value={sprDraft[p.problemId] ?? p.myText ?? ""}
                      disabled={!isStudent || p.graded || busy}
                      onChange={(e) => setSprDraft((d) => ({ ...d, [p.problemId]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveSpr(p);
                      }}
                      placeholder="예: 7/2 또는 3.5"
                      inputMode="decimal"
                      className="text-[14px] border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 w-[160px] disabled:bg-grey-100"
                    />
                    {isStudent && !p.graded && (
                      <button
                        type="button"
                        disabled={busy || !(sprDraft[p.problemId] ?? p.myText ?? "").trim()}
                        onClick={() => void saveSpr(p)}
                        className="text-[12.5px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
                      >
                        답 저장
                      </button>
                    )}
                    {p.myText && !isStudent && <span className="text-[12px] text-grey-500">학생 답</span>}
                    {answerShown(p) && p.acceptedAnswers && p.acceptedAnswers.length > 0 && (
                      <span className="text-[12.5px] font-bold text-green">정답: {p.acceptedAnswers.join(" 또는 ")}</span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-grey-500 mt-1.5">
                    정수·소수·분수(7/2) 가능. 양수 5자, 음수 6자 안. 기호($, %, 쉼표)는 빼고. 대분수는 가분수나 소수로.
                  </p>
                </div>
              )}

              {isSpr && isStudent && !p.planned && !p.graded && (
                <p className="text-[12px] text-grey-500 mb-4">
                  {savedChoiceId === p.problemId
                    ? "답이 저장되었습니다. 채점 전까지는 바꿀 수 있습니다."
                    : "답을 적고 저장하세요."}{" "}
                  선생님이 채점하면 정답과 해설이 열립니다.
                </p>
              )}

              {isMc && isStudent && !p.planned && !p.graded && (
                <p className="text-[12px] text-grey-500 mb-4">
                  {savedChoiceId === p.problemId
                    ? "답이 저장되었습니다. 채점 전까지는 다른 선택지로 바꿀 수 있습니다."
                    : "선택지를 고르면 답이 저장됩니다."}{" "}
                  선생님이 채점하면 정답과 해설이 열립니다.
                </p>
              )}
              {isEssay && !p.planned && (
                <div className="mb-4" data-testid="essay-answer">
                  <label className="text-[12.5px] font-bold text-ink block mb-1" htmlFor={`essay-${p.problemId}`}>
                    답안
                    {isStudent && !p.graded && (
                      <span className="ml-2 text-[11.5px] font-normal text-grey-500">
                        {essaySaved[p.problemId] === "saving"
                          ? "저장 중…"
                          : essaySaved[p.problemId] === "error"
                            ? "저장 실패 — 다시 입력하면 다시 저장합니다"
                            : essaySaved[p.problemId] === "saved"
                              ? "저장됨"
                              : "쓰는 대로 저장됩니다"}
                      </span>
                    )}
                    {!isStudent && <span className="ml-2 text-[11.5px] font-normal text-grey-500">학생이 쓴 답</span>}
                  </label>
                  <textarea
                    id={`essay-${p.problemId}`}
                    aria-label="서술형 답"
                    value={essayDraft[p.problemId] ?? p.myText ?? ""}
                    readOnly={!isStudent || p.graded}
                    onChange={(e) => editEssay(p, e.target.value)}
                    placeholder={isStudent ? "여기에 답을 쓰세요." : "학생이 아직 답을 쓰지 않았습니다."}
                    rows={Math.min(24, Math.max(6, (essayDraft[p.problemId] ?? p.myText ?? "").split("\n").length + 2))}
                    className="w-full text-[14px] leading-[1.7] border-[1.5px] border-grey-200 rounded-xl px-4 py-3 read-only:bg-grey-100 disabled:bg-grey-100"
                  />
                  {isStudent && !p.graded && (
                    <p className="text-[12px] text-grey-500 mt-1.5">선생님이 채점하면 정답과 해설이 열립니다.</p>
                  )}
                </div>
              )}
              {isMath && isStudent && !p.planned && !p.graded && (
                <p className="text-[12px] text-grey-500 mb-4">
                  풀이판에 풀고 제출하세요. 선생님이 채점하면 정답과 해설이 열립니다.
                </p>
              )}

              {p.graded && !isTeacherLike && (
                <div className="bg-grey-100 rounded-xl px-4 py-3 mb-4">
                  <div className="text-[12.5px] font-bold text-ink">
                    선생님 채점: {p.grade ? GRADE_LABEL[p.grade] : ""}
                  </div>
                  {p.gradeComment && <p className="text-[13px] text-ink mt-1 whitespace-pre-wrap">{p.gradeComment}</p>}
                </div>
              )}

              {/* 2026-09-14 UAT: 서술형·SPR·풀이형도 교사는 해설을 볼 수 있어야 한다 — 객관식 정답 유무로 막지 않는다. */}
              {isTeacherLike &&
                !p.planned &&
                !p.graded &&
                (p.correctIndex !== null || Boolean(p.explanation) || (p.acceptedAnswers?.length ?? 0) > 0) && (
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
                  <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-1">해설</div>
                  <LearningText text={p.explanation} className="learning-body text-[13.5px] leading-[1.75] text-ink" />
                </div>
              )}

              {p.planned ? (
                <p className="text-[12px] text-grey-500">
                  수업 시작 전 미리보기입니다. 풀이와 제출은 수업에서 합니다.
                </p>
              ) : (
                <>
                  {/* 풀이판 — 풀이형만. 연습장은 없다(2026-09-14 UAT: 문제 화면 필기가 그 자리를 대신한다). */}
                  <div className="flex flex-wrap gap-2">
                    {isMath && (
                      <button
                        disabled={boardBusy}
                        onClick={() => (isOpen ? setOpenId(null) : void openBoard(p.problemId))}
                        className="text-[12.5px] font-bold px-4 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                      >
                        {isOpen ? "풀이판 닫기" : "✏️ 풀이판 열기"}
                      </button>
                    )}
                    {isMath && isOpen && isStudent && (
                      <>
                        <button
                          disabled={boardBusy}
                          onClick={() => void openBoard(p.problemId, true)}
                          className="text-[12.5px] font-bold px-4 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                        >
                          다시 풀기
                        </button>
                        {board && !board.submitted && (
                          <button
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              setError(null);
                              try {
                                // 제출 전에 아직 저장되지 않은 획을 먼저 저장한다. 저장에 실패하면
                                // 제출하지 않는다 — 저장 안 된 풀이가 "제출 완료"로 보이면 안 된다.
                                const saved = await boardRef.current?.flush();
                                if (saved === false) {
                                  setError("필기를 저장하지 못해 제출하지 않았습니다. 연결을 확인한 뒤 다시 제출하세요.");
                                  return;
                                }
                                await submitProblemWork(board.workId, {});
                                const refreshed = await loadProblemWorkBoard(board.workId);
                                if (refreshed) setBoard(refreshed);
                                notifyChanged();
                                void refresh();
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

                  {isMath && isOpen && board && board.workId === "" && (
                    <p className="mt-4 text-[12.5px] text-grey-500">
                      학생이 아직 이 문제를 풀기 시작하지 않았습니다. 학생이 풀이판을 열면 여기에서 볼 수 있고, 그때 피드백을 남길 수 있습니다.
                    </p>
                  )}

                  {isMath && isOpen && board && board.workId !== "" && (
                    <div className="mt-4">
                      {isMath && attempts.length > 1 && (
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          {/* "회차"는 커리큘럼 회차를 가리키는 말이라 여기서는 쓰지 않는다 — 같은 문제를 몇 번째로 푸는지다. */}
                          <span className="text-[11px] font-bold text-grey-300 uppercase tracking-wide">이전 풀이</span>
                          {attempts.map((a) => (
                            <button
                              key={a.workId}
                              onClick={() => void showAttempt(a.workId)}
                              aria-pressed={board.workId === a.workId}
                              className={
                                "text-[11.5px] font-bold px-2.5 py-1 rounded-full border-[1.5px] " +
                                (board.workId === a.workId ? "bg-ink text-white border-ink" : "border-grey-200 text-grey-500")
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
                        mode="work"
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
                              : isStudent && p.graded
                                ? "채점이 끝난 문제입니다"
                                : undefined
                        }
                      />
                    </div>
                  )}

                  {/* 교사 채점 */}
                  {isTeacher && (
                    <section aria-label="채점" className="mt-6 border-t border-grey-200 pt-4">
                      <div className="text-[10.5px] font-extrabold text-grey-300 uppercase tracking-wider mb-2">채점</div>
                      {!p.latestWorkId ? (
                        <p className="text-[12.5px] text-grey-500">학생이 아직 이 문제를 풀지 않았습니다.</p>
                      ) : (
                        <>
                          {isSpr && (
                            <p className="text-[13px] text-ink mb-2">
                              학생 답: <b>{p.myText ?? "없음"}</b>
                              {p.autoCorrect !== null && (
                                <>
                                  {" "}
                                  · 자동 채점:{" "}
                                  <b className={p.autoCorrect ? "text-green" : "text-red"}>{p.autoCorrect ? "정답" : "오답"}</b>
                                </>
                              )}
                            </p>
                          )}
                          {isMc && (
                            <p className="text-[13px] text-ink mb-2">
                              학생 답: <b>{p.myChoice !== null ? p.myChoice + 1 : "없음"}</b>
                              {p.autoCorrect !== null && (
                                <>
                                  {" "}
                                  · 자동 채점:{" "}
                                  <b className={p.autoCorrect ? "text-green" : "text-red"}>{p.autoCorrect ? "정답" : "오답"}</b>
                                </>
                              )}
                            </p>
                          )}
                          {isEssay && (
                            <p className="text-[12px] text-grey-500 mb-2">학생 답은 위 답안 칸에 있습니다.</p>
                          )}
                          {isMath && !isOpen && (
                            <p className="text-[12px] text-grey-500 mb-2">풀이는 위 &apos;풀이판 열기&apos;로 볼 수 있습니다.</p>
                          )}

                          {p.graded && !regrading.has(p.problemId) ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[12.5px] font-bold text-ink">
                                채점 완료 · {p.grade ? GRADE_LABEL[p.grade] : ""}
                              </span>
                              {p.gradeComment && <span className="text-[12.5px] text-grey-500">“{p.gradeComment}”</span>}
                              <button
                                type="button"
                                onClick={() => {
                                  setGradeDraft((d) => ({
                                    ...d,
                                    [p.problemId]: { grade: p.grade, comment: p.gradeComment ?? "" },
                                  }));
                                  setRegrading((prev) => new Set(prev).add(p.problemId));
                                }}
                                className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
                              >
                                다시 채점
                              </button>
                            </div>
                          ) : showGradeForm ? (
                            <div>
                              <div className="flex flex-wrap gap-1.5 mb-2" role="group" aria-label="채점 결과">
                                {(["correct", "partial", "incorrect"] as ProblemGrade[]).map((g) => {
                                  const selected = draft.grade === g;
                                  return (
                                    <button
                                      key={g}
                                      type="button"
                                      aria-pressed={selected}
                                      onClick={() =>
                                        setGradeDraft((d) => ({ ...d, [p.problemId]: { ...draft, grade: g } }))
                                      }
                                      className={
                                        "text-[12px] font-bold px-3 py-1.5 rounded-full border-[1.5px] " +
                                        (selected ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
                                      }
                                    >
                                      {GRADE_LABEL[g]}
                                    </button>
                                  );
                                })}
                                {(isMc || isSpr) && draft.grade === null && p.autoCorrect !== null && (
                                  <span className="text-[11.5px] text-grey-500 self-center">
                                    고르지 않으면 자동 채점({p.autoCorrect ? "정답" : "오답"})대로 확정합니다.
                                  </span>
                                )}
                              </div>
                              <textarea
                                aria-label="선생님 한마디"
                                placeholder="학생에게 남길 한마디(선택)"
                                value={draft.comment}
                                onChange={(e) =>
                                  setGradeDraft((d) => ({ ...d, [p.problemId]: { ...draft, comment: e.target.value } }))
                                }
                                rows={2}
                                className="w-full text-[13px] border-[1.5px] border-grey-200 rounded-lg px-3 py-2 mb-2"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={
                                    busy ||
                                    (!(isMc || isSpr) && draft.grade === null) ||
                                    ((isMc || isSpr) && draft.grade === null && p.autoCorrect === null)
                                  }
                                  onClick={() => void grade(p)}
                                  className="text-[12.5px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
                                >
                                  채점 완료
                                </button>
                                {regrading.has(p.problemId) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRegrading((prev) => {
                                        const next = new Set(prev);
                                        next.delete(p.problemId);
                                        return next;
                                      })
                                    }
                                    className="text-[12.5px] font-bold px-4 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
                                  >
                                    취소
                                  </button>
                                )}
                              </div>
                              <p className="text-[11.5px] text-grey-500 mt-2">채점을 끝내면 학생에게 정답과 해설이 열립니다.</p>
                            </div>
                          ) : null}
                        </>
                      )}
                    </section>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
      </div>
    </div>
  );
}
