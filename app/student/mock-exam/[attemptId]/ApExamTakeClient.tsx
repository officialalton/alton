"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";
import {
  saveMockExamAnswerAction,
  enterApSectionAction,
  startApSectionAction,
  settleApAttemptAction,
  submitMockExamAttemptAction,
  toggleMockExamFlagAction,
  toggleMockExamGuessedAction,
  toggleMockExamSavedToPracticeAction,
  recordMockExamEntryAction,
} from "@/lib/mock-exam/attempt-actions";
import { AP_SUBJECT_NAME, CALCULATOR_TEXT, apBadgeText, apCoverageLines, apGuidanceLines, apSectionDisplayLabel, apUnitsFromDomains } from "@/lib/ap-exam/layouts";
import { autoMathExplanation } from "@/lib/ap-exam/explanation-math";
import { apPassageForDisplay } from "@/lib/ap-exam/stimulus-display";
import { sharedSetRange } from "@/lib/ap-exam/shared-set";
import SharedStimulus from "./SharedStimulus";
import { frqAnswerToJson, parseFrqAnswer } from "@/lib/ap-exam/frq-answer";
import LearningText from "@/app/session/[id]/LearningText";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import MockExamMathTools, { MockExamToolButtons, type MathToolsOpen } from "@/app/session/[id]/MockExamMathTools";
import SubjectToolPanels from "@/app/components/exam-tools/SubjectToolPanels";
import { subjectToolsConfig } from "@/lib/exam-tools/subject-tools";
import ProblemErrorReportButton from "@/app/components/ProblemErrorReportButton";
import MockExamWhiteboard from "./MockExamWhiteboard";
import FrqHandwritingPad from "./FrqHandwritingPad";
import { useFrqInk } from "./useFrqInk";
import { apFrqIsPaper, PAPER_FRQ_NOTICE } from "@/lib/ap-exam/frq-delivery";
import { INK_H, inkKey, strokesToSvg, type FrqInkRow } from "@/lib/ap-exam/frq-ink";
import GuessButton from "./GuessButton";
import ExitExamButton from "./ExitExamButton";
import { NAV_BTN, ScrollPanes, ToolIconButton } from "./take-ui";
import { problemText } from "@/lib/problem-figures/label-rule";
import ApExamResultView from "./ApExamResultView";
import CodeAnswerField from "./CodeAnswerField";

// AP 모의고사 응시 화면(영어 UI). SAT 응시 화면(MockExamTakeClient)과 같은 엔진·RPC·재응시 모델을 쓰고, 다음만 AP 규칙이다:
//   · 섹션은 공식 레이아웃(attempt.sectionLayout)에서 온다: 섹션별 시간·계산기 규칙·문항 수, 일시정지 없음.
//   · MC 선택지는 4개 또는 5개(optionCount). FRQ 는 파트별 입력(타이핑) + 자동 저장 — 제출 전 정답·루브릭·해설은 응답에 없다(DB 마스킹).
//   · 제출하면 MC 는 자동 채점, FRQ 는 "참고용 답안/채점 노트(공식 채점 아님)"만 공개된다. AP 1~5 점수는 만들지 않는다.
const LETTERS = ["A", "B", "C", "D", "E"];
const AUTOSAVE_MS = 1200;
type SaveStatus = "idle" | "saving" | "saved" | "error";

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
const sectionOf = (i: MockExamAttemptItem) => i.section as string;

export default function ApExamTakeClient({ attempt }: { attempt: MockExamAttemptDetail }) {
  const router = useRouter();
  const layout = useMemo(() => (attempt.sectionLayout ?? []).filter((s) => attempt.items.some((i) => sectionOf(i) === s.key)), [attempt]);
  const [submittedAttempt, setSubmittedAttempt] = useState<MockExamAttemptDetail | null>(null);
  // 560: 섹션 탭을 눌러 보기만 해서는 시계가 시작되지 않는다. 시작 안 한 섹션은 문항 내용 없이 안내 패널만 보이고 "Start section" 을 눌러야 시작한다.
  // apSectionStarted 가 없는 구버전 응답은 전부 시작된 것으로 본다(기존 동작).
  const [allItems, setAllItems] = useState<MockExamAttemptItem[]>(attempt.items);
  const [started, setStarted] = useState<Record<string, boolean>>(() => Object.fromEntries((attempt.sectionLayout ?? []).map((s) => [s.key, attempt.apSectionStarted?.[s.key] ?? true])));
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [sectionKey, setSectionKey] = useState(layout[0]?.key ?? "");
  const section = layout.find((s) => s.key === sectionKey) ?? layout[0];
  const items = useMemo(() => allItems.filter((i) => sectionOf(i) === section?.key), [allItems, section]);
  const [index, setIndex] = useState(0);
  const current = items[index];
  const [responses, setResponses] = useState<Record<string, string>>(Object.fromEntries(attempt.items.map((i) => [i.setItemId, i.response ?? ""])));
  const [flags, setFlags] = useState<Record<string, boolean>>(Object.fromEntries(attempt.items.map((i) => [i.setItemId, i.flagged])));
  const [saved, setSaved] = useState<Record<string, boolean>>(Object.fromEntries(attempt.items.map((i) => [i.setItemId, i.savedToPractice])));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [eliminated, setEliminated] = useState<Record<string, Set<number>>>({});
  const [eliminateMode, setEliminateMode] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toolsOpen, setToolsOpen] = useState<MathToolsOpen>(null);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [guessedMap, setGuessedMap] = useState<Record<string, boolean>>(Object.fromEntries(attempt.items.map((i) => [i.setItemId, !!i.guessed])));
  const itemSecondsRef = useRef<Record<string, number>>(Object.fromEntries(attempt.items.map((i) => [i.setItemId, i.timeSpentSeconds ?? 0])));
  const isSubmitted = attempt.status === "submitted" || attempt.status === "graded";

  useEffect(() => { void recordMockExamEntryAction(attempt.id); }, [attempt.id]);

  // 섹션별 남은 시간(공식 시간). 일시정지 없음: 활성 섹션만 흐르고 15초마다 서버에 저장한다.
  const [remaining, setRemaining] = useState<Record<string, number>>(
    Object.fromEntries(layout.map((s) => [s.key, (attempt.timeRemainingSeconds as Record<string, number> | null)?.[s.key] ?? s.minutes * 60])),
  );
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const tickRef = useRef(remaining);
  const sectionRef = useRef(sectionKey);
  const finalKeyRef = useRef(layout[layout.length - 1]?.key);
  useEffect(() => { sectionRef.current = sectionKey; }, [sectionKey]);
  useEffect(() => { tickRef.current = remaining; }, [remaining]);
  const currentItemId = current?.setItemId;
  useEffect(() => {
    if (isSubmitted || !section || started[section.key] === false) return;
    const timer = setInterval(() => {
      setRemaining((prev) => {
        const left = Math.max(0, (prev[section.key] ?? 0) - 1);
        if (left === 0) setLocked((l) => (l[section.key] ? l : { ...l, [section.key]: true }));
        return { ...prev, [section.key]: left };
      });
      if (currentItemId) itemSecondsRef.current[currentItemId] = (itemSecondsRef.current[currentItemId] ?? 0) + 1;
    }, 1000);
    return () => clearInterval(timer);
  }, [section, isSubmitted, currentItemId, started]);
  // 서버 시계(마이그레이션 406): 섹션에 들어갈 때마다 서버에 알리고, 서버가 계산한 남은 시간으로 맞춘다. 클라이언트 값은 저장하지 않는다.
  const enterSection = useCallback(async (key: string) => {
    const r = await enterApSectionAction(attempt.id, key);
    if (r.ok) setRemaining((prev) => ({ ...prev, ...r.value.remaining }));
  }, [attempt.id]);
  // 이미 시작된 섹션(첫 섹션 포함)만 진입 호출로 시계를 다시 맞춘다. 시작 안 한 섹션은 아무것도 호출하지 않는다.
  const sectionStarted = started[sectionKey] !== false;
  useEffect(() => { if (!isSubmitted && sectionKey && sectionStarted) void enterSection(sectionKey); }, [isSubmitted, sectionKey, sectionStarted, enterSection]);
  async function startSection(key: string) {
    if (startingRef.current) return;
    startingRef.current = true; setStarting(true); setError(null);
    const r = await startApSectionAction(attempt.id, key);
    startingRef.current = false; setStarting(false);
    if (!r.ok) { setError(r.error); return; }
    setRemaining((prev) => ({ ...prev, ...r.value.remaining }));
    if (r.value.attempt) {
      const fresh = r.value.attempt.items.filter((i) => sectionOf(i) === key);
      setAllItems((prev) => prev.map((i) => fresh.find((f) => f.setItemId === i.setItemId) ?? i));
    }
    setStarted((st) => ({ ...st, [key]: true }));
  }

  // 마지막 섹션(단일 섹션 포함)의 시간이 끝나면 자동 제출한다 — 더 풀 문항이 없는데 제출 버튼까지 번호를 눌러 가게 하지 않는다.
  // 중간 섹션이 끝나면 잠금 안내와 함께 "다음 섹션" 버튼이 보인다(SAT 도 시간 소진 시 해당 섹션만 잠그고 직접 제출 또는 모든 섹션 잠금 시 마감).
  const submitRef = useRef<() => Promise<void>>(async () => {});
  const autoSubmitted = useRef(false);
  const finalKey = layout[layout.length - 1]?.key;
  const finalExpired = !!finalKey && !!locked[finalKey];
  useEffect(() => {
    if (isSubmitted || !finalExpired || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void submitRef.current();
  }, [finalExpired, isSubmitted]);

  // 답 저장(MC 는 즉시, FRQ 는 디바운스 자동 저장 + 문항 이동·제출 전 flush)
  const pending = useRef<{ setItemId: string; value: string; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const persist = useCallback(async (setItemId: string, value: string) => {
    setStatus("saving"); setError(null);
    const r = await saveMockExamAnswerAction(attempt.id, setItemId, value, itemSecondsRef.current[setItemId]);
    setStatus(r.ok ? "saved" : "error");
    if (!r.ok) {
      setError(r.error);
      if (/Time is up/i.test(r.error)) { // 서버 시계가 이미 만료 — 이 섹션을 잠그고, 마지막 섹션이면 서버가 마감했는지 확인한다.
        setLocked((l) => ({ ...l, [sectionRef.current]: true }));
        if (sectionRef.current === finalKeyRef.current) void settleApAttemptAction(attempt.id).then((x) => { if (x.ok && x.value.attempt) setSubmittedAttempt(x.value.attempt); });
      }
    }
  }, [attempt.id]);
  const flushText = useCallback(async () => {
    const p = pending.current;
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    pending.current = null;
    await persist(p.setItemId, p.value);
  }, [persist]);
  // 종이 FRQ 과목(2026-10-13): 파트별 손글씨. 저장 실패 처리(서버 시계 만료 → 섹션 잠금)는 타이핑 저장과 같다.
  const paperFrq = apFrqIsPaper(attempt.apSubject);
  const onInkStatus = useCallback((s: "saving" | "saved" | "error", err?: string) => {
    setStatus(s);
    if (s !== "error") { setError(null); return; }
    setError(err ?? "Could not save your handwriting.");
    if (err && /Time is up/i.test(err)) {
      setLocked((l) => ({ ...l, [sectionRef.current]: true }));
      if (sectionRef.current === finalKeyRef.current) void settleApAttemptAction(attempt.id).then((x) => { if (x.ok && x.value.attempt) setSubmittedAttempt(x.value.attempt); });
    }
  }, [attempt.id]);
  const { ink, heights: inkHeights, loadState: inkLoad, commit: commitInk, resize: resizeInk, flush: flushInk, hasInk } = useFrqInk(attempt.id, paperFrq && !isSubmitted, onInkStatus);
  const flush = useCallback(async () => { await flushText(); await flushInk(); }, [flushText, flushInk]);
  const [padOpen, setPadOpen] = useState<Record<string, boolean>>({});
  function scheduleSave(setItemId: string, value: string) {
    if (pending.current?.timer) clearTimeout(pending.current.timer);
    pending.current = { setItemId, value, timer: setTimeout(() => { void flush(); }, AUTOSAVE_MS) };
  }
  useEffect(() => () => { if (pending.current?.timer) clearTimeout(pending.current.timer); }, []);

  if (allItems.length === 0 || !section) return <p className="text-[13px] text-grey-500">This exam has no questions.</p>;
  if (submittedAttempt) {
    const rows: FrqInkRow[] = Object.entries(ink).filter(([, v]) => v.length > 0).map(([k, v]) => { const i = k.lastIndexOf(":"); return { setItemId: k.slice(0, i), partLabel: k.slice(i + 1), strokeCount: v.length, previewSvg: strokesToSvg(v, inkHeights[k] ?? INK_H), boardHeight: inkHeights[k] ?? INK_H }; });
    return <main className="mx-auto w-full max-w-4xl px-4 py-6"><h1 className="mb-4 text-[18px] font-extrabold">{submittedAttempt.examSetName}</h1><ApExamResultView attempt={submittedAttempt} handwriting={rows} /></main>;
  }
  if (isSubmitted) return <p className="text-[13px] text-grey-500">Submitted. Open the Practice Tests tab to see your results.</p>;

  const subjectName = AP_SUBJECT_NAME[attempt.apSubject ?? ""] ?? "AP";
  const sectionLocked = !!locked[section.key];
  const answered = (i: MockExamAttemptItem) => (i.format === "essay" ? Object.values(parseFrqAnswer(responses[i.setItemId] ?? "")).some((v) => v.trim() !== "") || hasInk(i.setItemId) : (responses[i.setItemId] ?? "") !== "");
  const answeredCount = allItems.filter(answered).length;
  const notStartedCount = layout.filter((s) => started[s.key] === false).length;
  const calcOk = section.calculator === "allowed" || section.calculator === "required";
  const toolsCfg = subjectToolsConfig(attempt.apSubject);
  const subjectPanels = toolsCfg.reference !== null || toolsCfg.calculatorTabs.length > 1;
  const refOk = toolsCfg.reference !== null;

  async function go(n: number) {
    await flush();
    setIndex(n);
  }
  async function switchSection(key: string) {
    await flush();
    setSectionKey(key); setIndex(0);
  }
  async function chooseMc(it: MockExamAttemptItem, i: number) {
    if (sectionLocked) return;
    setResponses((r) => ({ ...r, [it.setItemId]: String(i) }));
    await persist(it.setItemId, String(i));
  }
  function editPart(it: MockExamAttemptItem, label: string, text: string) {
    const parts = { ...parseFrqAnswer(responses[it.setItemId] ?? ""), [label]: text };
    const value = frqAnswerToJson(parts);
    setResponses((r) => ({ ...r, [it.setItemId]: value }));
    setStatus("saving");
    scheduleSave(it.setItemId, value);
  }
  async function toggleFlag(it: MockExamAttemptItem) {
    const next = !flags[it.setItemId];
    setFlags((f) => ({ ...f, [it.setItemId]: next }));
    await toggleMockExamFlagAction(attempt.id, it.setItemId, next);
  }
  async function toggleSaved(it: MockExamAttemptItem) {
    const next = !saved[it.setItemId];
    setSaved((m) => ({ ...m, [it.setItemId]: next }));
    await toggleMockExamSavedToPracticeAction(attempt.id, it.setItemId, next);
  }
  async function toggleGuessed(it: MockExamAttemptItem) {
    const next = !guessedMap[it.setItemId];
    setGuessedMap((m) => ({ ...m, [it.setItemId]: next }));
    await toggleMockExamGuessedAction(attempt.id, it.setItemId, next);
  }
  async function handleSubmit() {
    setSubmitting(true); setError(null);
    await flush();
    const r = await submitMockExamAttemptAction(attempt.id);
    setSubmitting(false);
    if (!r.ok) { setError(r.error); return; }
    setShowReview(false);
    if (r.value.attempt) setSubmittedAttempt(r.value.attempt);
    router.refresh();
  }

  submitRef.current = handleSubmit;
  const partsOf = current?.parts ?? [];
  const frqValues = current?.format === "essay" ? parseFrqAnswer(responses[current.setItemId] ?? "") : {};
  const nextSection = layout[layout.findIndex((s) => s.key === section.key) + 1];

  const guidance = apGuidanceLines({ subject: attempt.apSubject, layout: attempt.sectionLayout, name: attempt.examSetName });
  const coverage = apCoverageLines({ subject: attempt.apSubject, units: apUnitsFromDomains(allItems.map((i) => i.satDomain)), layout: attempt.sectionLayout, name: attempt.examSetName, label: attempt.apLabel });
  const secAnswered = items.filter(answered).length;
  const secLeft = remaining[section.key] ?? 0;
  const warning = secLeft > 0 && secLeft <= 300;
  const tab = "inline-flex min-h-[36px] shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold md:min-h-0";

  // SAT 응시 화면과 같은 구조(2026-10-09 통일): 위 막대(제목·가운데 큰 타이머·제출) / 왼쪽 번호판 / 번호 막대(도구·신고·저장) / 지문|선택지 두 칸 / 아래 막대.
  return (
    <div className="flex h-dvh flex-col bg-white" data-testid="ap-exam-take">
      <header className="flex items-center justify-between gap-2 border-b border-grey-200 px-3 py-2 md:px-6 md:py-3">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-bold text-ink" data-testid="ap-title">{attempt.examSetName}</p>
          <p className="truncate text-[11px] font-semibold text-grey-500">{subjectName} · <span data-testid="ap-badge">{apBadgeText({ subject: attempt.apSubject, label: attempt.apLabel, layout: attempt.sectionLayout, name: attempt.examSetName })}</span></p>
        </div>
        <div className={`text-[18px] font-extrabold tabular-nums ${warning ? "text-red" : "text-ink"}`} data-testid="ap-exam-timer" aria-label="Time remaining in this section" aria-live={warning ? "polite" : "off"}>
          {formatClock(secLeft)}{!sectionStarted && <span className="ml-2 text-[11px] font-semibold text-grey-500">Not started</span>}{warning && <span className="ml-2 text-[11px] font-semibold">5 min left</span>}
        </div>
        <div className="flex items-center gap-2">
          {(calcOk || refOk) && <MockExamToolButtons calculatorAllowed={calcOk} referenceSheetAllowed={refOk} referenceLabel="Reference" open={toolsOpen} onToggle={(w) => setToolsOpen((c) => (c === w ? null : w))} />}
          <ExitExamButton
            testIdPrefix="ap-exit"
            consequences={
              <>
                <p>Your answers are saved.</p>
                <p>The clock does not pause. A section you have started keeps counting down on the server while you are away, so you can resume from Practice Tests only until its time runs out. Sections you have not started yet are not timed.</p>
              </>
            }
            onBeforeExit={flush}
          />
          <button type="button" onClick={async () => { await flush(); setShowReview(true); }} disabled={submitting} data-testid="ap-header-submit"
            className="min-h-[44px] rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50 md:min-h-0 md:px-3.5">Submit</button>
        </div>
      </header>

      <div className="shrink-0 border-b border-grey-200 px-3 py-2 md:px-6">
        <div className="flex items-center gap-2 overflow-x-auto md:flex-wrap md:overflow-visible">
          {layout.map((s) => (
            <button key={s.key} type="button" onClick={() => void switchSection(s.key)} data-testid={`ap-section-${s.key}`}
              className={`${tab} ${section.key === s.key ? "bg-ink text-white" : "bg-grey-100 text-grey-600"}`}>
              {apSectionDisplayLabel(s, attempt.sectionLayout)}{locked[s.key] ? " (Time's up)" : started[s.key] === false ? " (Not started)" : ""}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11.5px] text-grey-500" data-testid="ap-section-rules">
          {section.count} questions · {section.minutes} min{CALCULATOR_TEXT[section.calculator] ? ` · ${CALCULATOR_TEXT[section.calculator]}` : ""} · The timer cannot be paused.
        </p>
        {(guidance.length > 0 || coverage.length > 0) && (
          <details className="mt-1 text-[12px] text-grey-600">
            <summary className="cursor-pointer text-[11.5px] font-semibold text-grey-500">About this set</summary>
            {guidance.map((l) => <p key={l} className="mt-1" data-testid="ap-set-guidance">{l}</p>)}
            {coverage.map((l, i) => <p key={l} className={`mt-1 ${i === 0 ? "font-semibold" : ""}`} data-testid="ap-coverage">{l}</p>)}
          </details>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Go to question" className="shrink-0 overflow-x-auto border-b border-grey-200 px-3 py-2 md:w-[96px] md:overflow-y-auto md:overflow-x-visible md:border-b-0 md:border-r">
          <div className="flex gap-1.5 md:grid md:grid-cols-3">
            {sectionStarted && items.map((it, i) => {
              const ans = answered(it), fl = flags[it.setItemId], gs = (guessedMap[it.setItemId] ?? false) && ans;
              return (
                <button key={it.setItemId} type="button" onClick={() => void go(i)} aria-current={i === index ? "true" : undefined}
                  aria-label={`Question ${i + 1}${ans ? ", answered" : ""}${fl ? ", marked for review" : ""}${gs ? ", guessed" : ""}`}
                  title={`Question ${i + 1}${ans ? " · Answered" : " · Unanswered"}${fl ? " · Marked for review" : ""}`}
                  className={`relative h-11 w-11 shrink-0 rounded border text-[13px] font-bold md:h-7 md:w-auto md:text-[11.5px] ${i === index ? "border-ink bg-ink text-white" : fl ? "border-yellow bg-yellow text-ink" : ans ? "border-green bg-green/10 text-green" : "border-grey-200 text-grey-500"}`}>
                  {i + 1}
                  {gs && <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#f97316]" />}
                </button>
              );
            })}
          </div>
          <div className="hidden text-[10.5px] text-grey-500 md:mt-3 md:block" data-testid="ap-answered-count">{sectionStarted ? `${secAnswered}/${items.length} answered` : "Not started"}</div>
        </nav>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {error && <p role="alert" className="px-4 pt-2 text-[12.5px] text-red">{error}</p>}
          {!sectionStarted ? (
            <div className="m-4 mx-auto flex max-w-lg flex-col items-center rounded-lg border border-grey-200 bg-grey-50 p-6 text-center" data-testid="ap-section-not-started">
              <h2 className="text-[16px] font-extrabold text-ink">{apSectionDisplayLabel(section, attempt.sectionLayout)}</h2>
              <p className="mt-2 text-[13px] text-grey-600">{section.count} questions · {section.minutes} min{CALCULATOR_TEXT[section.calculator] ? ` · ${CALCULATOR_TEXT[section.calculator]}` : ""}</p>
              <p className="mt-2 text-[13px] text-grey-600">The timer starts when you press Start section and cannot be paused.</p>
              <button type="button" autoFocus disabled={starting} onClick={() => void startSection(section.key)} data-testid="ap-start-section"
                className="mt-4 min-h-[44px] rounded-lg bg-ink px-5 py-2 text-[13.5px] font-bold text-white disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40">{starting ? "Starting…" : "Start section"}</button>
            </div>
          ) : sectionLocked ? (
            <div className="m-4 rounded-lg border border-red/40 bg-red/5 p-6 text-center text-[13.5px] text-red" data-testid="ap-section-expired">
              <p>Time is up for this section. Answers can no longer be changed.</p>
              {section.key === finalKey ? (
                <button type="button" disabled={submitting} onClick={() => void handleSubmit()} data-testid="ap-expired-submit" className="mt-3 rounded-lg bg-red px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">{submitting ? "Submitting…" : "Submit now"}</button>
              ) : nextSection ? (
                <button type="button" onClick={() => void switchSection(nextSection.key)} className="mt-3 rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white">Go to next section</button>
              ) : null}
            </div>
          ) : current ? (
            <>
              <div className="flex shrink-0 items-stretch bg-[#cfcfcf]" data-testid="ap-qbar">
                <div className="flex min-w-[38px] items-center justify-center bg-[#111] px-2.5 py-1 font-serif text-[17px] font-bold text-white" data-testid="ap-qnum">{index + 1}</div>
                <div className="flex flex-1 items-center gap-0.5 px-1 md:gap-1 md:px-2">
                  {current.format === "mc" && (
                    <ToolIconButton label="Eliminate" title="Strike out answer choices" pressed={eliminateMode} onClick={() => setEliminateMode((v) => !v)} testId="ap-eliminate-toggle">
                      <path d="M4 12h16" /><path d="M8 7.5c.8-1.6 2.4-2.5 4.2-2.5 2.2 0 3.8 1.1 3.8 2.8M8 16.2C8 18 9.8 19 12 19c2.3 0 4-1.2 4-3" />
                    </ToolIconButton>
                  )}
                  <ToolIconButton label="Whiteboard" title="Open the scratch whiteboard" pressed={whiteboardOpen} onClick={() => setWhiteboardOpen((v) => !v)} testId="ap-whiteboard-toggle">
                    <rect x="3.5" y="4.5" width="17" height="12" rx="1.5" /><path d="M8 20h8M12 16.5V20M8.5 13l5-5 1.8 1.8-5 5H8.5z" />
                  </ToolIconButton>
                  <span className="ml-1 text-[11px] font-semibold text-[#444]">{current.format === "essay" ? `${partsOf.reduce((a, p) => a + p.points, 0)} pts` : ""}</span>
                  <span className="ml-1 text-[11px] text-[#444]" data-testid="save-status" aria-live="polite">{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Save failed" : ""}</span>
                  <div className="flex-1" />
                  <ProblemErrorReportButton key={current.setItemId} variant="icon" lang="en" role="student" context={{ source: "mock_exam", attemptId: attempt.id, setItemId: current.setItemId, problemId: current.problemId }} />
                  <button type="button" onClick={() => void toggleSaved(current)} aria-pressed={saved[current.setItemId] ?? false} data-testid="toggle-saved-to-practice"
                    aria-label={saved[current.setItemId] ? "Remove from saved questions" : "Save question"} title={saved[current.setItemId] ? "Saved to My Notebook" : "Save to My Notebook"}
                    className="inline-flex h-11 w-11 items-center justify-center rounded text-ink hover:bg-black/10 md:h-7 md:w-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={saved[current.setItemId] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z" /></svg>
                  </button>
                </div>
              </div>

              <div className="contents" data-testid="ap-question-card">
                <ScrollPanes resetKey={current.setItemId}>
                  <section aria-label="Passage and question" className="min-w-0 shrink-0 overflow-x-auto overflow-y-hidden px-4 py-4 md:w-1/2 md:shrink md:overflow-y-auto md:px-8 md:py-6 md:border-r md:border-grey-200">
                    {(() => {
                      const shown = apPassageForDisplay(current.passage, current.question);
                      if (!shown) return null;
                      const text = <LearningText text={shown} className="text-[13.5px]" />;
                      const range = sharedSetRange(items, index);
                      return range ? <SharedStimulus range={range}>{text}</SharedStimulus> : <div className="mb-3">{text}</div>;
                    })()}
                    {current.figure ? <ProblemFigure spec={current.figure} text={problemText(current.passage, current.question, current.options)} className="mb-4" /> : null}
                    {current.question && <LearningText text={autoMathExplanation(current.question)} className="mb-3 text-[14px] font-semibold" />}
                  </section>
                  <section aria-label="Answer" className="shrink-0 px-4 py-4 md:w-1/2 md:shrink md:overflow-y-auto md:px-8 md:py-6">
                    {current.format === "mc" && current.options ? (
                      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Answer choices">
                        {current.options.map((opt, i) => {
                          const chosen = responses[current.setItemId] === String(i);
                          const out = eliminated[current.setItemId]?.has(i) ?? false;
                          return (
                            <button key={i} type="button" role="radio" aria-checked={chosen} data-testid={`ap-option-${i}`}
                              onClick={() => {
                                if (eliminateMode) setEliminated((p) => { const s = new Set(p[current.setItemId] ?? []); if (s.has(i)) s.delete(i); else s.add(i); return { ...p, [current.setItemId]: s }; });
                                else if (!out) void chooseMc(current, i);
                              }}
                              className={`flex min-w-0 min-h-[48px] items-start gap-2.5 rounded-lg border-2 px-3 py-2.5 text-left text-[15px] md:min-h-0 md:py-2 md:text-[13.5px] ${chosen ? "border-ink bg-ink/5 font-bold" : "border-grey-200"} ${out ? "opacity-50" : ""}`}>
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${chosen ? "border-ink bg-ink text-white" : "border-grey-400 text-grey-500"}`}>{LETTERS[i]}</span>
                              <span className={`min-w-0 break-words ${out ? "line-through" : ""}`}><LearningText text={autoMathExplanation(opt)} /></span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3" data-testid="ap-frq-parts">
                        {paperFrq
                          ? <p className="rounded-lg bg-grey-50 px-3 py-2 text-[12px] text-grey-600" data-testid="frq-paper-notice">{PAPER_FRQ_NOTICE} Your work is saved automatically.</p>
                          : <p className="text-[11.5px] text-grey-500">{partsOf.some((x) => x.mode === "code") ? "Type your Java code below. Your work is saved automatically." : "Type your answers below. For graphs or diagrams, describe the key features in words (you may sketch on paper). Your work is saved automatically."}</p>}
                        {partsOf.map((p) => (
                          <div key={p.label}>
                            <label htmlFor={`frq-${current.setItemId}-${p.label}`} className="mb-1 block text-[13px] font-semibold">
                              ({p.label}) <span className="font-normal text-grey-500">[{p.points} {p.points === 1 ? "point" : "points"}]</span>
                            </label>
                            <LearningText text={autoMathExplanation(p.prompt)} className="mb-1.5 text-[13.5px]" />
                            {p.mode === "code"
                              ? <CodeAnswerField id={`frq-${current.setItemId}-${p.label}`} testId={`frq-input-${p.label}`} label={`Code for part (${p.label})`} value={frqValues[p.label] ?? ""} onChange={(v) => editPart(current, p.label, v)} onBlur={() => void flush()} />
                              : <textarea id={`frq-${current.setItemId}-${p.label}`} data-testid={`frq-input-${p.label}`} rows={p.mode === "calculate" ? 4 : 6}
                                  value={frqValues[p.label] ?? ""} onChange={(e) => editPart(current, p.label, e.target.value)} onBlur={() => void flush()}
                                  className="w-full rounded-lg border-[1.5px] border-grey-200 px-3 py-2 text-[14px]" placeholder="Type your answer" />}
                            {paperFrq && (() => {
                              const k = inkKey(current.setItemId, p.label);
                              const has = (ink[k]?.length ?? 0) > 0;
                              const open = padOpen[k] ?? has;
                              return (
                                <div className="mt-1.5">
                                  <button type="button" onClick={() => setPadOpen((o) => ({ ...o, [k]: !open }))} aria-expanded={open} data-testid={`frq-handwrite-${p.label}`}
                                    className="min-h-[40px] rounded-lg border-[1.5px] border-grey-300 px-3 py-1.5 text-[12.5px] font-bold text-grey-600 md:min-h-0">
                                    {open ? "Hide handwriting" : has ? "Show handwriting" : "Handwrite"}{has && !open ? " ✓" : ""}
                                  </button>
                                  {open && (inkLoad === "loading" ? <p className="mt-2 text-[12px] text-grey-500" data-testid="frq-ink-loading">Loading your handwriting…</p>
                                    : <>
                                        {inkLoad === "error" && <p role="alert" className="mt-2 text-[12px] text-red">Could not load earlier handwriting. You can still write; new strokes are saved.</p>}
                                        <FrqHandwritingPad label={p.label} strokes={ink[k] ?? []} height={inkHeights[k] ?? INK_H} onChange={(next) => commitInk(current.setItemId, p.label, next)} onHeightChange={(h) => resizeInk(current.setItemId, p.label, h)} />
                                      </>)}
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </ScrollPanes>
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-grey-200 bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-8 md:py-3">
                <button type="button" onClick={() => void go(Math.max(0, index - 1))} disabled={index === 0} aria-label="Previous question" className={NAV_BTN}>←</button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void toggleFlag(current)} aria-pressed={flags[current.setItemId] ?? false} data-testid="mock-exam-solve-later-toggle"
                    aria-label={flags[current.setItemId] ? "Unmark for Review" : "Mark for Review"} title={flags[current.setItemId] ? "Unmark Solve Later" : "Mark Solve Later"}
                    className={`flex h-11 items-center justify-center rounded-lg border-[1.5px] px-3 text-[13px] font-semibold md:h-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${flags[current.setItemId] ? "border-ink bg-ink text-white" : "border-grey-200 text-grey-600 hover:border-ink hover:text-ink"}`}>Solve Later</button>
                  <GuessButton guessed={guessedMap[current.setItemId] ?? false} onToggle={() => void toggleGuessed(current)} />
                  {index < items.length - 1 ? (
                    <button type="button" onClick={() => void go(index + 1)} aria-label="Next question" className={NAV_BTN}>→</button>
                  ) : nextSection ? (
                    <button type="button" onClick={() => void switchSection(nextSection.key)} className="min-h-[44px] rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white">Next section</button>
                  ) : (
                    <button type="button" onClick={async () => { await flush(); setShowReview(true); }} className="min-h-[44px] rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white" data-testid="ap-review-submit">Review &amp; submit</button>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>

      {whiteboardOpen && current && <MockExamWhiteboard key={current.setItemId} attemptId={attempt.id} itemId={current.setItemId} onClose={() => setWhiteboardOpen(false)} />}
      {subjectPanels
        ? <SubjectToolPanels config={toolsCfg} calculatorAllowed={calcOk} open={toolsOpen} onClose={() => setToolsOpen(null)} />
        : <MockExamMathTools calculatorAllowed referenceSheetAllowed={false} open={toolsOpen} onClose={() => setToolsOpen(null)} />}

      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Before you submit">
          <div className="w-full max-w-md rounded-lg bg-white p-5">
            <h3 className="mb-2 text-[15px] font-bold">Before you submit</h3>
            <p className="mb-4 text-[13px] text-grey-600">
              You answered {answeredCount} of {allItems.length} questions.{answeredCount < allItems.length && " Some questions are unanswered."}{notStartedCount > 0 && <span data-testid="ap-not-started-warning"> {notStartedCount} section{notStartedCount > 1 ? "s were" : " was"} not started; {notStartedCount > 1 ? "their" : "its"} questions count as unanswered.</span>} Once submitted, answers cannot be changed.
              Multiple-choice questions are scored right away; free-response answers are kept, and a reference answer and scoring guide (reference feedback, not official scoring) is shown after you submit.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowReview(false)} className="rounded-lg border border-grey-300 px-4 py-2 text-[13px] font-bold">Keep working</button>
              <button type="button" disabled={submitting} onClick={() => void handleSubmit()} data-testid="ap-exam-submit" className="rounded-lg bg-red px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">{submitting ? "Submitting…" : "Submit"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
