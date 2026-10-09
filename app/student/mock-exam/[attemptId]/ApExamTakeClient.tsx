"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";
import {
  saveMockExamAnswerAction,
  enterApSectionAction,
  settleApAttemptAction,
  submitMockExamAttemptAction,
  toggleMockExamFlagAction,
  toggleMockExamSavedToPracticeAction,
  recordMockExamEntryAction,
} from "@/lib/mock-exam/attempt-actions";
import { AP_SUBJECT_NAME, CALCULATOR_TEXT, apBadgeText, apCoverageLines, apGuidanceLines, apUnitsFromDomains } from "@/lib/ap-exam/layouts";
import { apPassageForDisplay } from "@/lib/ap-exam/stimulus-display";
import { frqAnswerToJson, parseFrqAnswer } from "@/lib/ap-exam/frq-answer";
import LearningText from "@/app/session/[id]/LearningText";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import MockExamMathTools, { MockExamToolButtons, type MathToolsOpen } from "@/app/session/[id]/MockExamMathTools";
import ProblemErrorReportButton from "@/app/components/ProblemErrorReportButton";
import ProblemNoteCanvas from "@/app/components/ProblemNoteCanvas";
import { problemText } from "@/lib/problem-figures/label-rule";
import ApExamResultView from "./ApExamResultView";

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
  const [sectionKey, setSectionKey] = useState(layout[0]?.key ?? "");
  const section = layout.find((s) => s.key === sectionKey) ?? layout[0];
  const items = useMemo(() => attempt.items.filter((i) => sectionOf(i) === section?.key), [attempt.items, section]);
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
    if (isSubmitted || !section) return;
    const timer = setInterval(() => {
      setRemaining((prev) => {
        const left = Math.max(0, (prev[section.key] ?? 0) - 1);
        if (left === 0) setLocked((l) => (l[section.key] ? l : { ...l, [section.key]: true }));
        return { ...prev, [section.key]: left };
      });
      if (currentItemId) itemSecondsRef.current[currentItemId] = (itemSecondsRef.current[currentItemId] ?? 0) + 1;
    }, 1000);
    return () => clearInterval(timer);
  }, [section, isSubmitted, currentItemId]);
  // 서버 시계(마이그레이션 406): 섹션에 들어갈 때마다 서버에 알리고, 서버가 계산한 남은 시간으로 맞춘다. 클라이언트 값은 저장하지 않는다.
  const enterSection = useCallback(async (key: string) => {
    const r = await enterApSectionAction(attempt.id, key);
    if (r.ok) setRemaining((prev) => ({ ...prev, ...r.value.remaining }));
  }, [attempt.id]);
  useEffect(() => { if (!isSubmitted && sectionKey) void enterSection(sectionKey); }, [isSubmitted, sectionKey, enterSection]);

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
  const flush = useCallback(async () => {
    const p = pending.current;
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    pending.current = null;
    await persist(p.setItemId, p.value);
  }, [persist]);
  function scheduleSave(setItemId: string, value: string) {
    if (pending.current?.timer) clearTimeout(pending.current.timer);
    pending.current = { setItemId, value, timer: setTimeout(() => { void flush(); }, AUTOSAVE_MS) };
  }
  useEffect(() => () => { if (pending.current?.timer) clearTimeout(pending.current.timer); }, []);

  if (attempt.items.length === 0 || !section) return <p className="text-[13px] text-grey-500">This exam has no questions.</p>;
  if (submittedAttempt) return <ApExamResultView attempt={submittedAttempt} />;
  if (isSubmitted) return <p className="text-[13px] text-grey-500">Submitted. Open the Practice Tests tab to see your results.</p>;

  const subjectName = AP_SUBJECT_NAME[attempt.apSubject ?? ""] ?? "AP";
  const sectionLocked = !!locked[section.key];
  const answered = (i: MockExamAttemptItem) => (i.format === "essay" ? Object.values(parseFrqAnswer(responses[i.setItemId] ?? "")).some((v) => v.trim() !== "") : (responses[i.setItemId] ?? "") !== "");
  const answeredCount = attempt.items.filter(answered).length;
  const calcOk = section.calculator === "allowed" || section.calculator === "required";

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

  return (
    <div className="flex flex-col gap-4 lg:flex-row" data-testid="ap-exam-take">
      <nav aria-label="Go to question" className="flex gap-1 overflow-x-auto lg:w-[72px] lg:flex-shrink-0 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:max-h-[70vh]">
        {items.map((it, i) => (
          <button key={it.setItemId} type="button" onClick={() => void go(i)} aria-current={i === index}
            title={`Question ${i + 1}${answered(it) ? " · Answered" : " · Unanswered"}${flags[it.setItemId] ? " · Marked for review" : ""}`}
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded text-[12px] font-bold lg:w-full ${i === index ? "bg-ink text-white" : answered(it) ? "bg-green/20 text-ink" : "bg-grey-100 text-grey-500"}`}>
            {i + 1}
            {flags[it.setItemId] && <span className="absolute -right-1 -top-1 text-[9px] leading-none text-yellow-600" aria-hidden="true">★</span>}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <div className="mb-3 rounded-lg border border-grey-200 bg-white px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-extrabold">{subjectName} · <span data-testid="ap-badge">{apBadgeText({ subject: attempt.apSubject, label: attempt.apLabel, layout: attempt.sectionLayout, name: attempt.examSetName })}</span></p>
            <div className="flex items-center gap-3">
              {calcOk && <MockExamToolButtons calculatorAllowed referenceSheetAllowed={false} open={toolsOpen} onToggle={(w) => setToolsOpen((c) => (c === w ? null : w))} />}
              <div className="font-mono text-[15px] font-bold" data-testid="ap-exam-timer" aria-label="Time remaining in this section">{formatClock(remaining[section.key] ?? 0)}</div>
            </div>
          </div>
          {apGuidanceLines({ subject: attempt.apSubject, layout: attempt.sectionLayout, name: attempt.examSetName }).map((l) => <p key={l} className="mb-2 text-[12px] text-grey-600" data-testid="ap-set-guidance">{l}</p>)}
          {apCoverageLines({ subject: attempt.apSubject, units: apUnitsFromDomains(attempt.items.map((i) => i.satDomain)), layout: attempt.sectionLayout, name: attempt.examSetName, label: attempt.apLabel }).map((l, i) => <p key={l} className={`${i === 0 ? "font-semibold " : ""}mb-2 text-[12px] text-grey-600`} data-testid="ap-coverage">{l}</p>)}
          <div className="flex flex-wrap gap-2">
            {layout.map((s) => (
              <button key={s.key} type="button" onClick={() => void switchSection(s.key)} data-testid={`ap-section-${s.key}`}
                className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${section.key === s.key ? "bg-ink text-white" : "bg-grey-100 text-grey-600"}`}>
                {s.label}{locked[s.key] ? " (Time's up)" : ""}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-grey-500" data-testid="ap-section-rules">
            {section.count} questions · {section.minutes} min{CALCULATOR_TEXT[section.calculator] ? ` · ${CALCULATOR_TEXT[section.calculator]}` : ""} · The timer cannot be paused.
          </p>
        </div>

        {error && <p role="alert" className="mb-2 text-[12.5px] text-red">{error}</p>}

        {sectionLocked ? (
          <div className="rounded-lg border border-red/40 bg-red/5 p-6 text-center text-[13.5px] text-red" data-testid="ap-section-expired">
            <p>Time is up for this section. Answers can no longer be changed.</p>
            {section.key === finalKey ? (
              <button type="button" disabled={submitting} onClick={() => void handleSubmit()} data-testid="ap-expired-submit" className="mt-3 rounded-lg bg-red px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">{submitting ? "Submitting…" : "Submit now"}</button>
            ) : nextSection ? (
              <button type="button" onClick={() => void switchSection(nextSection.key)} className="mt-3 rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white">Go to next section</button>
            ) : null}
          </div>
        ) : current ? (
          <div className="min-w-0 rounded-lg border border-grey-200 bg-white p-4 lg:max-w-[720px]" data-testid="ap-question-card">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-bold text-grey-500">Question {index + 1} / {items.length}{current.format === "essay" ? ` · ${partsOf.reduce((a, p) => a + p.points, 0)} pts` : ""}</p>
                <button type="button" onClick={() => void toggleFlag(current)} aria-pressed={flags[current.setItemId]} title="Mark for review" data-testid="toggle-flag"
                  className={`text-[14px] leading-none ${flags[current.setItemId] ? "text-yellow-600" : "text-grey-300"}`}>🔖</button>
                <button type="button" onClick={() => void toggleSaved(current)} aria-pressed={saved[current.setItemId]} data-testid="toggle-saved-to-practice"
                  className={`text-[11px] font-bold rounded-full border px-2 py-0.5 ${saved[current.setItemId] ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-500"}`}>
                  {saved[current.setItemId] ? "Saved" : "+ Save to My Notebook"}
                </button>
                <span className="text-[11px] text-grey-400" data-testid="save-status" aria-live="polite">{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Save failed" : ""}</span>
              </div>
              {current.format === "mc" && (
                <button type="button" onClick={() => setEliminateMode((v) => !v)} aria-pressed={eliminateMode} title="Cross out answer choices"
                  className={`rounded border px-2 py-1 text-[11px] font-bold ${eliminateMode ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-500"}`}>Eliminator</button>
              )}
            </div>
            {apPassageForDisplay(current.passage, current.question) && <LearningText text={apPassageForDisplay(current.passage, current.question) as string} className="mb-3 text-[13.5px]" />}
            {current.figure ? <ProblemFigure spec={current.figure} text={problemText(current.passage, current.question, current.options)} className="mb-4" /> : null}
            {current.question && <LearningText text={current.question} className="mb-3 font-semibold text-[14px]" />}

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
                      className={`flex min-w-0 items-start gap-2.5 rounded-lg border-2 px-3 py-2 text-left text-[13.5px] ${chosen ? "border-ink bg-ink/5 font-bold" : "border-grey-200"} ${out ? "opacity-50" : ""}`}>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${chosen ? "border-ink bg-ink text-white" : "border-grey-400 text-grey-500"}`}>{chosen ? "✓" : LETTERS[i]}</span>
                      <span className={`min-w-0 break-words ${out ? "line-through" : ""}`}><LearningText text={opt} /></span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-3" data-testid="ap-frq-parts">
                <p className="text-[11.5px] text-grey-500">Type your answers below. For graphs or diagrams, describe the key features in words (you may sketch on paper). Your work is saved automatically.</p>
                {partsOf.map((p) => (
                  <div key={p.label}>
                    <label htmlFor={`frq-${current.setItemId}-${p.label}`} className="mb-1 block text-[13px] font-semibold">
                      ({p.label}) <span className="font-normal text-grey-500">[{p.points} {p.points === 1 ? "point" : "points"}]</span>
                    </label>
                    <LearningText text={p.prompt} className="mb-1.5 text-[13.5px]" />
                    <textarea id={`frq-${current.setItemId}-${p.label}`} data-testid={`frq-input-${p.label}`} rows={p.mode === "calculate" ? 4 : 6}
                      value={frqValues[p.label] ?? ""} onChange={(e) => editPart(current, p.label, e.target.value)} onBlur={() => void flush()}
                      className={`w-full rounded-lg border border-grey-300 px-3 py-2 text-[13.5px] ${p.mode === "code" ? "font-mono" : ""}`} placeholder="Type your answer" />
                  </div>
                ))}
              </div>
            )}
            <ProblemErrorReportButton key={current.setItemId} className="mt-3" role="student" context={{ source: "mock_exam", attemptId: attempt.id, setItemId: current.setItemId, problemId: current.problemId }} />
            <ProblemNoteCanvas context="mock_exam" targetId={attempt.id} itemId={current.setItemId} />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" disabled={index === 0} onClick={() => void go(Math.max(0, index - 1))} className="shrink-0 rounded-lg border border-grey-300 px-4 py-2 text-[13px] font-bold disabled:opacity-40">Previous</button>
          {index < items.length - 1 ? (
            <button type="button" onClick={() => void go(index + 1)} className="shrink-0 rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white">Next</button>
          ) : nextSection ? (
            <button type="button" onClick={() => void switchSection(nextSection.key)} className="shrink-0 rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white">Next section</button>
          ) : (
            <button type="button" onClick={async () => { await flush(); setShowReview(true); }} className="shrink-0 rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white" data-testid="ap-review-submit">Review &amp; submit</button>
          )}
        </div>
      </div>

      <MockExamMathTools calculatorAllowed referenceSheetAllowed={false} open={toolsOpen} onClose={() => setToolsOpen(null)} />

      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Before you submit">
          <div className="w-full max-w-md rounded-lg bg-white p-5">
            <h3 className="mb-2 text-[15px] font-bold">Before you submit</h3>
            <p className="mb-4 text-[13px] text-grey-600">
              You answered {answeredCount} of {attempt.items.length} questions.{answeredCount < attempt.items.length && " Some questions are unanswered."} Once submitted, answers cannot be changed.
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
