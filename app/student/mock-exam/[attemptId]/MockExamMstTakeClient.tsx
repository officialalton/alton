"use client";

// Digital SAT 4모듈 MST 응시 화면(Bluebook 참고). 타이머는 표시용이며 만료·잠금·자동 제출은 서버
// RPC가 결정한다 — 0초가 되면 모듈 제출을 호출하고, 어떤 경로로든 서버 상태를 다시 받아 갱신한다.
// 새로고침·재접속 시에도 page.tsx가 같은 상태 RPC로 복구한다. 적응형 경로명은 절대 표시하지 않는다.

import ProblemErrorReportButton from "@/app/components/ProblemErrorReportButton";
import { dedupeStem } from "@/lib/problem-text-guards";
import GuessButton from "./GuessButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LearningText from "@/app/session/[id]/LearningText";
import RwStimulusView from "@/app/session/[id]/RwStimulusView";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import MockExamMathTools, { MockExamToolButtons, SprDirections, type MathToolsOpen } from "@/app/session/[id]/MockExamMathTools";
import AnnotationLayer from "./AnnotationLayer";
import MockExamWhiteboard from "./MockExamWhiteboard";
import { saveMockExamAnswerAction, toggleMockExamFlagAction, toggleMockExamGuessedAction, toggleMockExamSavedToPracticeAction, loadMockExamAnnotationsAction, saveMockExamAnnotationsAction } from "@/lib/mock-exam/attempt-actions";
import type { MockExamAnnotations } from "@/lib/mock-exam/annotation-anchor";
import { useHighlightSupported } from "@/lib/use-highlight-supported";
import { loadMstAttemptStateAction, startMstAttemptAction, submitMstModuleAction, type MstAttemptState } from "@/lib/mock-exam/mst-actions";
import {
  MST_BLUEPRINT,
  MST_MODULE_LABELS,
  MST_MODULE_ORDER,
  MST_TIME_WARNING_SECONDS,
  formatMstClock,
  mstMathToolsAllowed,
  mstRemainingSecondsAt,
} from "@/lib/mock-exam/mst";
import { problemText } from "@/lib/problem-figures/label-rule";

const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

// 이전·다음 화살표: 똑같은 중립 윤곽 버튼. 마우스 클릭 뒤에는 포커스 링을 남기지 않는다(focus-visible 만).
const NAV_BTN =
  "flex h-11 w-14 items-center md:h-10 md:w-12 justify-center rounded-lg border-[1.5px] border-grey-300 bg-white text-[20px] font-semibold text-ink hover:bg-grey-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:opacity-40 disabled:hover:bg-white";

// 좁은 화면: 지문+선택지가 한 세로 흐름으로 스크롤된다. iOS 는 스크롤바가 사라지므로 아래에 더 있으면 페이드+화살표를 보여 준다.
function ScrollPanes({ resetKey, children }: { resetKey: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);
  const update = useCallback(() => {
    const el = ref.current;
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = 0;
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    Array.from(el.children).forEach((c) => ro?.observe(c));
    return () => ro?.disconnect();
  }, [resetKey, update]);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} onScroll={update} className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden" data-testid="mst-panes">
        {children}
      </div>
      {more && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-center bg-gradient-to-t from-white via-white/80 to-transparent pb-1 md:hidden" data-testid="mst-scroll-cue" aria-hidden="true">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-grey-500">
            Scroll for more
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </span>
        </div>
      )}
    </div>
  );
}

function ToolIconButton({
  label,
  title,
  pressed,
  onClick,
  testId,
  children,
}: {
  label: string;
  title: string;
  pressed: boolean;
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={title}
      data-testid={testId}
      className={`inline-flex h-11 w-11 items-center justify-center rounded md:h-7 md:w-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
        pressed ? "bg-ink text-white" : "text-ink hover:bg-black/10"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}
export default function MockExamMstTakeClient({
  initialState,
  examSetName,
  mathCalculatorAllowed,
  mathReferenceSheetAllowed,
}: {
  initialState: MstAttemptState;
  examSetName: string;
  mathCalculatorAllowed: boolean;
  mathReferenceSheetAllowed: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [cursor, setCursor] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialState.items.map((i) => [i.setItemId, i.response ?? ""])),
  );
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialState.items.map((i) => [i.setItemId, i.flagged])),
  );
  // 2026-10-02(사용자 지시) — 4모듈 응시에도 "문제 저장"(Practice 탭). 고정형 응시와 같은 RPC·컬럼을 쓴다.
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialState.items.map((i) => [i.setItemId, i.savedToPractice])),
  );
  // 2026-10-02(오너 UAT A8) — 답을 모르고 찍었을 때 학생이 스스로 누르는 표시. 결과 화면에 Guessed 로 보인다.
  const [guessedMap, setGuessedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialState.items.map((i) => [i.setItemId, i.guessed ?? false])),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mathToolsOpen, setMathToolsOpen] = useState<MathToolsOpen>(null);
  // 2026-10-02(오너 요청) — Bluebook 식 도구: 하이라이트(+한 줄 메모)·답 소거·풀이용 화이트보드.
  // 하이라이트·메모·소거는 문항별로 서버에 저장되어 이동·새로고침 뒤에도 복원된다(제출 후 잠김).
  const highlightSupported = useHighlightSupported();
  const [highlightMode, setHighlightMode] = useState(false);
  const [eliminateMode, setEliminateMode] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [annotations, setAnnotations] = useState<Record<string, MockExamAnnotations>>({});
  const annotationsLoadedRef = useRef<Set<string>>(new Set());
  const busyRef = useRef(false);
  const sprTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyState = useCallback((next: MstAttemptState) => {
    setState(next);
    setFetchedAt(Date.now());
    setNow(Date.now());
    setCursor(0);
    setHighlightMode(false);
    setEliminateMode(false);
    setWhiteboardOpen(false);
    setConfirmOpen(false);
    setMathToolsOpen(null);
    setResponses(Object.fromEntries(next.items.map((i) => [i.setItemId, i.response ?? ""])));
    setFlags(Object.fromEntries(next.items.map((i) => [i.setItemId, i.flagged])));
    setGuessedMap(Object.fromEntries(next.items.map((i) => [i.setItemId, i.guessed ?? false])));
  }, []);

  // 문항이 바뀌면 도구 모드(하이라이트·소거·화이트보드 열림)는 꺼진다 — 저장된 필기 자체는 문항별로 남는다.
  const goTo = useCallback((i: number) => {
    setCursor(i);
    setHighlightMode(false);
    setEliminateMode(false);
    setWhiteboardOpen(false);
  }, []);

  const current = state.modules.find((m) => m.moduleKey === state.currentModule) ?? null;
  const secondsLeft =
    current?.remainingSeconds === null || current?.remainingSeconds === undefined
      ? null
      : mstRemainingSecondsAt(current.remainingSeconds, fetchedAt, now);

  const submitModule = useCallback(async () => {
    if (busyRef.current || !state.currentModule || state.status !== "in_progress") return;
    busyRef.current = true;
    setBusy(true);
    const r = await submitMstModuleAction(state.attemptId, state.currentModule);
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    if (r.value.status === "graded") router.refresh();
    else applyState(r.value);
  }, [applyState, router, state.attemptId, state.currentModule, state.status]);

  // 1초 틱. 서버 기준 남은 시간이 0이 되면 틱 콜백 안에서(effect 본문이 아니라) 자동 제출한다 —
  // 실제 잠금은 서버가 이미 했을 수 있고, submit RPC는 현재 모듈이 아니면 no-op이라 안전하다.
  const submitRef = useRef(submitModule);
  useEffect(() => {
    submitRef.current = submitModule;
  }, [submitModule]);
  // 같은 모듈에 대해 자동 제출은 한 번만(제출 응답이 오기 전 다음 틱이 또 0을 보는 경우 방지).
  const autoSubmittedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.status !== "in_progress" || !current || current.remainingSeconds === null) return;
    const remaining = current.remainingSeconds;
    const moduleKey = current.moduleKey;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (mstRemainingSecondsAt(remaining, fetchedAt, t) === 0 && autoSubmittedForRef.current !== moduleKey) {
        autoSubmittedForRef.current = moduleKey;
        void submitRef.current();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [state.status, current, fetchedAt]);

  async function recoverIfLocked(message: string) {
    if (!/already been submitted/i.test(message)) return;
    const r = await loadMstAttemptStateAction(state.attemptId);
    if (r.ok) {
      if (r.value.status === "graded") router.refresh();
      else applyState(r.value);
    }
  }

  // 답 없이 Guessed 만 눌러 둔 채 다른 문항으로 넘어가면 그 표시는 자동 해제한다.
  const prevItemRef = useRef<string | null>(null);
  useEffect(() => {
    const cur = state.items[cursor]?.setItemId ?? null;
    const prev = prevItemRef.current;
    prevItemRef.current = cur;
    if (prev && prev !== cur && guessedMap[prev] && (responses[prev] ?? "") === "") {
      setGuessedMap((p) => ({ ...p, [prev]: false }));
      void toggleMockExamGuessedAction(state.attemptId, prev, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const currentItemId = state.items[cursor]?.setItemId ?? null;
  useEffect(() => {
    if (!currentItemId || annotationsLoadedRef.current.has(currentItemId)) return;
    annotationsLoadedRef.current.add(currentItemId);
    let alive = true;
    void loadMockExamAnnotationsAction(state.attemptId, currentItemId).then((a) => {
      if (alive) setAnnotations((p) => (p[currentItemId] ? p : { ...p, [currentItemId]: a }));
    });
    return () => {
      alive = false;
    };
  }, [currentItemId, state.attemptId]);

  async function updateAnnotations(setItemId: string, next: MockExamAnnotations) {
    setAnnotations((p) => ({ ...p, [setItemId]: next }));
    const r = await saveMockExamAnnotationsAction(state.attemptId, setItemId, next);
    if (!r.ok) {
      setError(r.error);
      await recoverIfLocked(r.error);
    }
  }

  async function saveAnswer(setItemId: string, value: string) {
    setResponses((p) => ({ ...p, [setItemId]: value }));
    const r = await saveMockExamAnswerAction(state.attemptId, setItemId, value);
    if (!r.ok) {
      setError(r.error);
      await recoverIfLocked(r.error);
    } else {
      setError(null);
      // 답을 지우면 "찍음" 표시도 함께 해제한다(답 없는 Guessed 는 의미가 없다).
      if (value === "" && guessedMap[setItemId]) {
        setGuessedMap((p) => ({ ...p, [setItemId]: false }));
        void toggleMockExamGuessedAction(state.attemptId, setItemId, false);
      }
    }
  }

  function saveSprDebounced(setItemId: string, value: string) {
    setResponses((p) => ({ ...p, [setItemId]: value }));
    if (sprTimer.current) clearTimeout(sprTimer.current);
    sprTimer.current = setTimeout(() => void saveAnswer(setItemId, value), 400);
  }

  async function toggleFlag(setItemId: string) {
    const next = !flags[setItemId];
    setFlags((p) => ({ ...p, [setItemId]: next }));
    const r = await toggleMockExamFlagAction(state.attemptId, setItemId, next);
    if (!r.ok) {
      setError(r.error);
      await recoverIfLocked(r.error);
    }
  }

  async function toggleSaved(setItemId: string) {
    const next = !savedMap[setItemId];
    setSavedMap((p) => ({ ...p, [setItemId]: next }));
    const r = await toggleMockExamSavedToPracticeAction(state.attemptId, setItemId, next);
    if (!r.ok) {
      setSavedMap((p) => ({ ...p, [setItemId]: !next }));
      setError(r.error);
      await recoverIfLocked(r.error);
    }
  }

  async function toggleGuessed(setItemId: string) {
    const next = !guessedMap[setItemId];
    setGuessedMap((p) => ({ ...p, [setItemId]: next }));
    const r = await toggleMockExamGuessedAction(state.attemptId, setItemId, next);
    if (!r.ok) {
      setGuessedMap((p) => ({ ...p, [setItemId]: !next }));
      setError(r.error);
      await recoverIfLocked(r.error);
    }
  }

  async function start() {
    setBusy(true);
    const r = await startMstAttemptAction(state.attemptId);
    setBusy(false);
    if (!r.ok) setError(r.error);
    else applyState(r.value);
  }

  const answeredCount = useMemo(() => state.items.filter((i) => (responses[i.setItemId] ?? "") !== "").length, [state.items, responses]);

  if (state.status === "assigned") {
    return (
      <div className="mx-auto max-w-[640px] px-6 py-12">
        <h1 className="text-[20px] font-extrabold text-ink">{examSetName}</h1>
        <ul className="mt-4 space-y-1.5 text-[13.5px] text-grey-700">
          {MST_MODULE_ORDER.map((k) => (
            <li key={k}>
              {MST_MODULE_LABELS[k]} — {MST_BLUEPRINT[k].itemCount ? `${MST_BLUEPRINT[k].itemCount} questions · ` : ""}
              {Math.round(MST_BLUEPRINT[k].timeLimitSeconds / 60)} min
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] leading-relaxed text-grey-500">
          Within a module you can move freely between questions and change your answers, but once you submit a module or time runs out,
          you cannot return to it. The timer runs on the server and keeps going even if you close this page. The calculator and reference
          sheet are available in the Math modules only.
        </p>
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy}
          className="mt-6 rounded-lg bg-red px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
          data-testid="mst-start"
        >
          Start Test
        </button>
        {error && <p className="mt-3 text-[12.5px] text-red">{error}</p>}
      </div>
    );
  }

  if (state.status !== "in_progress" || !state.currentModule) {
    return (
      <div className="mx-auto max-w-[640px] px-6 py-16 text-center">
        <h1 className="text-[20px] font-extrabold text-ink">You have completed the practice test</h1>
        <p className="mt-3 text-[13.5px] text-grey-500">Loading your results…</p>
      </div>
    );
  }

  if (state.currentModule === "break") {
    return (
      <div className="mx-auto max-w-[640px] px-6 py-16 text-center">
        <div className="text-[13px] font-semibold text-grey-500">Break</div>
        <div className="mt-2 text-[56px] font-extrabold tabular-nums text-ink" data-testid="mst-timer">
          {secondsLeft === null ? "--:--" : formatMstClock(secondsLeft)}
        </div>
        <p className="mt-3 text-[13.5px] text-grey-500">
          The Reading and Writing section is complete. The Math section will start automatically when the break ends.
        </p>
        <button
          type="button"
          onClick={() => void submitModule()}
          disabled={busy}
          className="mt-8 rounded-lg bg-red px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
          data-testid="mst-resume"
        >
          Resume Testing
        </button>
        {error && <p className="mt-4 text-[12.5px] text-red">{error}</p>}
      </div>
    );
  }

  const item = state.items[cursor];
  const warning = secondsLeft !== null && secondsLeft <= MST_TIME_WARNING_SECONDS;
  const mathTools = mstMathToolsAllowed(state.currentModule);

  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-grey-200 px-3 py-2 md:px-6 md:py-3">
        <div className="text-[13.5px] font-bold text-ink" data-testid="mst-module-label">
          {MST_MODULE_LABELS[state.currentModule]}
        </div>
        <div
          data-testid="mst-timer"
          className={`text-[18px] font-extrabold tabular-nums ${warning ? "text-red" : "text-ink"}`}
          aria-live={warning ? "polite" : "off"}
        >
          {secondsLeft === null ? "--:--" : formatMstClock(secondsLeft)}
          {warning && <span className="ml-2 text-[11px] font-semibold">5 min left</span>}
        </div>
        <div className="flex items-center gap-2">
          {mathTools && (
            <MockExamToolButtons
              calculatorAllowed={mathCalculatorAllowed}
              referenceSheetAllowed={mathReferenceSheetAllowed}
              open={mathToolsOpen}
              onToggle={(which) => setMathToolsOpen((cur) => (cur === which ? null : which))}
            />
          )}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
            className="min-h-[44px] rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50 md:min-h-0 md:px-3.5"
            data-testid="mst-submit-module"
          >
            Submit Module
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Question navigator" className="shrink-0 overflow-x-auto border-b border-grey-200 px-3 py-2 md:w-[96px] md:overflow-y-auto md:overflow-x-visible md:border-b-0 md:border-r md:p-3">
          <div className="flex gap-1.5 md:grid md:grid-cols-3">
            {state.items.map((it, i) => {
              const answered = (responses[it.setItemId] ?? "") !== "";
              const flagged = flags[it.setItemId] ?? false;
              const guessed = (guessedMap[it.setItemId] ?? false) && answered;
              return (
                <button
                  key={it.setItemId}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={i === cursor ? "true" : undefined}
                  aria-label={`Question ${it.moduleSeq}${answered ? ", answered" : ""}${flagged ? ", marked for review" : ""}${guessed ? ", guessed" : ""}`}
                  className={`relative h-11 w-11 shrink-0 rounded border text-[13px] font-bold md:h-7 md:w-auto md:text-[11.5px] ${
                    i === cursor
                      ? "border-ink bg-ink text-white"
                      : flagged
                        ? "border-yellow bg-yellow text-ink"
                        : answered
                          ? "border-green bg-green/10 text-green"
                          : "border-grey-200 text-grey-500"
                  }`}
                >
                  {it.moduleSeq}
                  {guessed && <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#f97316]" data-testid={`mst-guessed-dot-${it.setItemId}`} />}
                </button>
              );
            })}
          </div>
          <div className="hidden text-[10.5px] text-grey-500 md:mt-3 md:block">
            {answeredCount}/{state.items.length} answered
          </div>
        </nav>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {item ? (
            <>
              {/* 번호 막대: 검은 번호 칸 + 도구(하이라이트·소거·화이트보드) | 오른쪽 끝에 오류 신고·문제 저장(별). */}
              <div className="flex shrink-0 items-stretch bg-[#cfcfcf]" data-testid="mst-qbar">
                <div
                  className="flex min-w-[38px] items-center justify-center bg-[#111] px-2.5 py-1 font-serif text-[17px] font-bold text-white"
                  data-testid="mst-qnum"
                >
                  {item.moduleSeq}
                </div>
                <div className="flex flex-1 items-center gap-0.5 px-1 md:gap-1 md:px-2" data-testid="mst-tools">
                  {highlightSupported && (
                    <ToolIconButton
                      label="Highlight"
                      title="Highlight text, then click a highlight to add a note"
                      pressed={highlightMode}
                      onClick={() => setHighlightMode((v) => !v)}
                      testId="mst-highlight-toggle"
                    >
                      <path d="M4 20h6M14.5 4.5l5 5-8.5 8.5H6v-5z" />
                      <path d="M12 7l5 5" />
                    </ToolIconButton>
                  )}
                  {item.format === "mc" && item.options && (
                    <ToolIconButton
                      label="Eliminate"
                      title="Strike out answer choices"
                      pressed={eliminateMode}
                      onClick={() => setEliminateMode((v) => !v)}
                      testId="mst-eliminate-toggle"
                    >
                      <path d="M4 12h16" />
                      <path d="M8 7.5c.8-1.6 2.4-2.5 4.2-2.5 2.2 0 3.8 1.1 3.8 2.8M8 16.2C8 18 9.8 19 12 19c2.3 0 4-1.2 4-3" />
                    </ToolIconButton>
                  )}
                  <ToolIconButton
                    label="Whiteboard"
                    title="Open the scratch whiteboard"
                    pressed={whiteboardOpen}
                    onClick={() => setWhiteboardOpen((v) => !v)}
                    testId="mst-whiteboard-toggle"
                  >
                    <rect x="3.5" y="4.5" width="17" height="12" rx="1.5" />
                    <path d="M8 20h8M12 16.5V20M8.5 13l5-5 1.8 1.8-5 5H8.5z" />
                  </ToolIconButton>
                  <div className="flex-1" />
                  <ProblemErrorReportButton
                    key={item.setItemId}
                    variant="icon"
                    lang="en"
                    role="student"
                    context={{ source: "mock_exam", attemptId: state.attemptId, setItemId: item.setItemId, problemId: item.problemId }}
                  />
                  <button
                    type="button"
                    onClick={() => void toggleSaved(item.setItemId)}
                    aria-pressed={savedMap[item.setItemId] ?? false}
                    aria-label={savedMap[item.setItemId] ? "Remove from saved questions" : "Save question"}
                    title={savedMap[item.setItemId] ? "Saved to Practice" : "Save to Practice"}
                    className="inline-flex h-11 w-11 items-center justify-center rounded text-ink hover:bg-black/10 md:h-7 md:w-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={savedMap[item.setItemId] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 두 칸: 왼쪽 지문·문제·그림 / 오른쪽 선택지(또는 답 입력). 각 칸이 따로 스크롤, 좁은 화면에서는 위아래로 쌓인다. */}
              <ScrollPanes resetKey={item.setItemId}>
                <section aria-label="Passage and question" className="min-w-0 shrink-0 overflow-x-auto overflow-y-hidden px-4 py-4 md:shrink md:w-1/2 md:px-8 md:py-6 md:overflow-y-auto md:border-r md:border-grey-200" data-testid="mst-pane-left">
                  <AnnotationLayer
                    key={item.setItemId}
                    highlightMode={highlightMode}
                    highlights={annotations[item.setItemId]?.highlights ?? []}
                    onChange={(h) => void updateAnnotations(item.setItemId, { highlights: h, eliminated: annotations[item.setItemId]?.eliminated ?? [] })}
                  >
                    {dedupeStem(item.passage, item.question) && <RwStimulusView passage={dedupeStem(item.passage, item.question)} className="mb-4 text-[13.5px]" />}
                    {item.question && <LearningText text={item.question} className="mb-3 text-[14px] font-semibold" />}
                  </AnnotationLayer>
                  {item.figure ? <ProblemFigure spec={item.figure} text={problemText(item.passage, item.question, item.options)} className="mb-4" /> : null}
                </section>

                <section aria-label="Answer" className="shrink-0 px-4 py-4 md:shrink md:px-8 md:py-6 md:w-1/2 md:overflow-y-auto" data-testid="mst-pane-right">
                  {item.format === "mc" && item.options ? (
                    <div role="radiogroup" aria-label="Answer choices" className="flex flex-col gap-2">
                      {item.options.map((opt, idx) => {
                        const chosen = responses[item.setItemId] === String(idx);
                        const struck = (annotations[item.setItemId]?.eliminated ?? []).includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            role="radio"
                            aria-checked={chosen}
                            data-eliminated={struck ? "true" : undefined}
                            onClick={() => {
                              // 소거 모드: 선택지를 눌러도 답이 되지 않고 줄이 그어진다(다시 누르면 해제). 줄 그은 선택지는
                              // 소거를 풀기 전에는 답으로 고를 수 없다(고정형 응시 화면과 같은 규칙).
                              const cur = annotations[item.setItemId] ?? { highlights: [], eliminated: [] };
                              if (eliminateMode) {
                                const eliminated = struck ? cur.eliminated.filter((n) => n !== idx) : [...cur.eliminated, idx].sort((a, b) => a - b);
                                void updateAnnotations(item.setItemId, { ...cur, eliminated });
                              } else if (!struck) {
                                void saveAnswer(item.setItemId, String(idx));
                              }
                            }}
                            className={`flex min-w-0 items-start gap-2.5 min-h-[48px] rounded-lg border-2 px-3 py-2.5 text-left text-[15px] md:min-h-0 md:py-2 md:text-[13.5px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
                              chosen ? "border-ink bg-ink/5 font-bold" : "border-grey-200"
                            } ${struck ? "opacity-50" : ""}`}
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                                chosen ? "border-ink bg-ink text-white" : "border-grey-400 text-grey-500"
                              }`}
                            >
                              {OPTION_LETTERS[idx] ?? idx + 1}
                            </span>
                            <span className={`min-w-0 break-words ${struck ? "line-through" : ""}`}>
                              <LearningText text={opt} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-grey-500" htmlFor={`spr-${item.setItemId}`}>
                        Enter your answer (number, decimal, or fraction)
                      </label>
                      <input
                        id={`spr-${item.setItemId}`}
                        type="text"
                        inputMode="decimal"
                        value={responses[item.setItemId] ?? ""}
                        onChange={(e) => saveSprDebounced(item.setItemId, e.target.value)}
                        className="w-48 rounded-lg border-[1.5px] border-grey-200 px-3 py-2.5 text-[16px] text-ink"
                        data-testid="mst-spr-input"
                      />
                      <details className="mt-4 max-w-xl rounded-lg border border-grey-200 p-3" data-testid="mst-spr-help">
                        <summary className="cursor-pointer text-[12px] font-bold text-grey-600">Answer directions</summary>
                        <SprDirections className="mt-2" />
                      </details>
                    </div>
                  )}
                  {error && <p className="mt-4 text-[12.5px] text-red">{error}</p>}
                </section>
              </ScrollPanes>

              {/* 하단 액션 막대 — 문항 크기와 무관하게 같은 자리에 고정. */}
              <div className="flex shrink-0 items-center justify-between border-t border-grey-200 bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-8 md:py-3" data-testid="mst-footer">
                <button type="button" onClick={() => goTo(Math.max(0, cursor - 1))} disabled={cursor === 0} aria-label="Previous question" className={NAV_BTN}>
                  ←
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleFlag(item.setItemId)}
                    aria-pressed={flags[item.setItemId] ?? false}
                    aria-label={flags[item.setItemId] ? "Unmark for Review" : "Mark for Review"}
                    title={flags[item.setItemId] ? "Unmark Solve Later" : "Mark Solve Later"}
                    data-testid="mock-exam-solve-later-toggle"
                    className={`flex h-11 items-center justify-center rounded-lg border-[1.5px] px-3 text-[13px] font-semibold md:h-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
                      flags[item.setItemId] ? "border-ink bg-ink text-white" : "border-grey-200 text-grey-600 hover:border-ink hover:text-ink"
                    }`}
                  >
                    Solve Later
                  </button>
                  <GuessButton guessed={guessedMap[item.setItemId] ?? false} onToggle={() => void toggleGuessed(item.setItemId)} />
                  {cursor >= state.items.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      disabled={busy}
                      className="min-h-[44px] rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                      data-testid="mst-submit-last"
                    >
                      Submit Module
                    </button>
                  ) : (
                    <button type="button" onClick={() => goTo(Math.min(state.items.length - 1, cursor + 1))} aria-label="Next question" className={NAV_BTN}>
                      →
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="p-8 text-[13px] text-grey-500">This module has no questions. Submit the module to continue.</p>
          )}
        </main>
      </div>

      {/* 화이트보드는 떠 있는 패널(오버레이): 왼쪽 지문 칸을 줄이지 않는다(표·그림 잘림 방지). */}
      {whiteboardOpen && item && <MockExamWhiteboard key={item.setItemId} attemptId={state.attemptId} itemId={item.setItemId} onClose={() => setWhiteboardOpen(false)} />}

      {mathTools && (
        <MockExamMathTools
          calculatorAllowed={mathCalculatorAllowed}
          referenceSheetAllowed={mathReferenceSheetAllowed}
          open={mathToolsOpen}
          onClose={() => setMathToolsOpen(null)}
        />
      )}

      {confirmOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="mst-submit-title" className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-[420px] rounded-xl bg-white p-6 shadow-lg">
            <h2 id="mst-submit-title" className="text-[16px] font-extrabold text-ink">Submit this module?</h2>
            <p className="mt-2 text-[13px] text-grey-500">
              {answeredCount} of {state.items.length} questions answered. Once you submit, you cannot return to this module.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-lg border-[1.5px] border-grey-200 px-4 py-2 text-[13px] font-semibold">
                Keep Working
              </button>
              <button
                type="button"
                onClick={() => void submitModule()}
                disabled={busy}
                className="rounded-lg bg-red px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                data-testid="mst-submit-confirm"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
