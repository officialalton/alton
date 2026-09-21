"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import {
  saveMockExamAnswerAction,
  saveMockExamSectionTimeAction,
  submitMockExamAttemptAction,
  toggleMockExamFlagAction,
} from "@/lib/mock-exam/attempt-actions";
import LearningText from "@/app/session/[id]/LearningText";
import RwStimulusView from "@/app/session/[id]/RwStimulusView";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import MockExamMathTools, { MockExamToolButtons, type MathToolsOpen } from "@/app/session/[id]/MockExamMathTools";
import MockExamResultView from "./MockExamResultView";

// 고정형 SAT 모의고사 V1 — 학생 응시 화면(사양 3절 학생 흐름, 4절 수업 탭/독립 진입 공용).
// 적응형이 아니므로 문항 순서는 고정(mock_exam_set_items.position). 시간 제한은 섹션(R&W/Math)
// 단위(사양 6절) — 실제 디지털 SAT 은 모듈(R&W 모듈1·2, Math 모듈1·2)이 있지만, 현재 데이터
// 모델(mock_exam_sets)은 섹션 하나당 시간 제한 하나만 가진다. 모듈 분리는 스키마 확장이 필요해
// 이번 패스 범위 밖으로 남기고, "섹션당 한 번의 타이머"로 구현했다(제품 오너에게 보고 필요 사항).
// 시간 소진 시 그 섹션은 자동 잠금 처리하고 다음 섹션으로 넘어가게 안내한다(자동 제출은 두 섹션
// 다 잠기거나 학생이 직접 제출할 때).

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E"];
type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function MockExamTakeClient({ attempt: initial }: { attempt: MockExamAttemptDetail }) {
  const router = useRouter();
  const [attempt] = useState(initial);
  // 제출 성공 직후 서버가 돌려준 채점 완료 상세 — 이 값이 있으면 그대로 결과 화면을 그린다.
  // (2026-09-21 UAT 지적: router.refresh()만 호출하면 이 클라이언트 컴포넌트는 마운트를 유지한 채
  // useState(initial) 값을 그대로 들고 있어 제출 후 화면이 멈춘 것처럼 보였다 — 서버 재조회 결과를
  // 로컬 상태로 직접 반영해야 즉시 반응한다.)
  const [submittedAttempt, setSubmittedAttempt] = useState<MockExamAttemptDetail | null>(null);
  const sectionsOrder = useMemo(
    () => (["rw", "math"] as const).filter((s) => attempt.items.some((i) => i.section === s)),
    [attempt.items],
  );
  const [section, setSection] = useState<"rw" | "math">(attempt.items[0]?.section ?? "rw");
  const isLastSection = sectionsOrder[sectionsOrder.length - 1] === section;
  const sectionItems = useMemo(() => attempt.items.filter((i) => i.section === section), [attempt.items, section]);
  const [index, setIndex] = useState(0);
  const current = sectionItems[index];
  const [mathToolsOpen, setMathToolsOpen] = useState<MathToolsOpen>(null);
  const toggleMathTools = (which: "calculator" | "reference") => setMathToolsOpen((cur) => (cur === which ? null : which));

  const [responses, setResponses] = useState<Record<string, string>>(
    Object.fromEntries(attempt.items.map((i) => [i.setItemId, i.response ?? ""])),
  );
  const [flags, setFlags] = useState<Record<string, boolean>>(Object.fromEntries(attempt.items.map((i) => [i.setItemId, i.flagged])));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSave, setLastSave] = useState<{ setItemId: string; response: string } | null>(null);
  const [locked, setLocked] = useState<Record<"rw" | "math", boolean>>({ rw: false, math: false });
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const isSubmitted = attempt.status === "submitted" || attempt.status === "graded";

  const limitSeconds = { rw: attempt.rwTimeLimitMinutes * 60, math: attempt.mathTimeLimitMinutes * 60 };
  const [remaining, setRemaining] = useState<Record<"rw" | "math", number>>({
    rw: attempt.timeRemainingSeconds?.rw ?? limitSeconds.rw,
    math: attempt.timeRemainingSeconds?.math ?? limitSeconds.math,
  });
  const tickRef = useRef(remaining);
  tickRef.current = remaining;

  useEffect(() => {
    if (isSubmitted) return;
    const timer = setInterval(() => {
      setRemaining((prev) => {
        const next = { ...prev, [section]: Math.max(0, prev[section] - 1) };
        if (next[section] === 0 && !locked[section]) setLocked((l) => ({ ...l, [section]: true }));
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [section, isSubmitted, locked]);

  useEffect(() => {
    if (isSubmitted) return;
    const persist = setInterval(() => {
      void saveMockExamSectionTimeAction(attempt.id, "rw", tickRef.current.rw);
      void saveMockExamSectionTimeAction(attempt.id, "math", tickRef.current.math);
    }, 15000);
    return () => clearInterval(persist);
  }, [attempt.id, isSubmitted]);

  if (attempt.items.length === 0) return <p className="text-[13px] text-grey-500">시험 문항이 없습니다.</p>;
  // 제출 직후(자동 채점 완료) 서버가 돌려준 최신 상세가 있으면 곧바로 결과 화면을 보여준다.
  if (submittedAttempt) {
    return <MockExamResultView attempt={submittedAttempt} readOnly={false} />;
  }
  if (isSubmitted) {
    return (
      <div className="rounded-lg border border-grey-200 bg-white p-6 text-center">
        <p className="text-[15px] font-bold">
          {attempt.status === "graded" ? "채점이 완료됐습니다." : "제출됐습니다. 채점 결과를 확인해 주세요."}
        </p>
        <button type="button" className="mt-3 text-[13px] text-grey-500 underline" onClick={() => router.push("/student?tab=mock-exam")}>
          모의고사 목록으로
        </button>
      </div>
    );
  }

  const sectionLocked = locked[section];

  async function saveCurrent(response: string) {
    if (!current) return;
    const setItemId = current.setItemId;
    setResponses((r) => ({ ...r, [setItemId]: response }));
    setLastSave({ setItemId, response });
    setSaveStatus("saving");
    setError(null);
    const result = await saveMockExamAnswerAction(attempt.id, setItemId, response);
    setSaveStatus(result.ok ? "saved" : "error");
    if (!result.ok) setError(result.error);
  }

  async function retrySave() {
    if (!lastSave) return;
    setSaveStatus("saving");
    setError(null);
    const result = await saveMockExamAnswerAction(attempt.id, lastSave.setItemId, lastSave.response);
    setSaveStatus(result.ok ? "saved" : "error");
    if (!result.ok) setError(result.error);
  }

  async function toggleFlag() {
    if (!current) return;
    const next = !flags[current.setItemId];
    setFlags((f) => ({ ...f, [current.setItemId]: next }));
    await toggleMockExamFlagAction(attempt.id, current.setItemId, next);
  }

  const answeredCount = attempt.items.filter((i) => (responses[i.setItemId] ?? "").trim() !== "").length;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    await saveMockExamSectionTimeAction(attempt.id, "rw", tickRef.current.rw);
    await saveMockExamSectionTimeAction(attempt.id, "math", tickRef.current.math);
    const result = await submitMockExamAttemptAction(attempt.id);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setShowReview(false);
    if (result.value.attempt) setSubmittedAttempt(result.value.attempt);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* 2026-09-21(UAT 지적) — 문항 번호가 하단 가로 점 목록이 아니라 과제 화면처럼 왼쪽에
          세로로 늘어서야 한다. */}
      <nav
        aria-label="문항 이동"
        className="flex gap-1 overflow-x-auto lg:w-[72px] lg:flex-shrink-0 lg:flex-col lg:flex-nowrap lg:gap-1.5 lg:overflow-y-auto lg:max-h-[70vh]"
      >
        {sectionItems.map((it, i) => {
          const isAnswered = (responses[it.setItemId] ?? "").trim() !== "";
          const isFlagged = flags[it.setItemId];
          return (
            <button
              key={it.setItemId}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index}
              title={`${i + 1}번${isAnswered ? " · 응답 완료" : " · 미응답"}${isFlagged ? " · 다시 보기 표시" : ""}`}
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded text-[12px] font-bold lg:w-full ${
                i === index ? "bg-ink text-white" : isAnswered ? "bg-green/20 text-ink" : "bg-grey-100 text-grey-500"
              }`}
            >
              {i + 1}
              {isFlagged && (
                <span className="absolute -right-1 -top-1 text-[9px] leading-none text-yellow-600" aria-hidden="true">
                  ★
                </span>
              )}
              {isAnswered && i !== index && (
                <span className="absolute -bottom-0.5 -right-0.5 text-[8px] leading-none text-green" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-grey-200 bg-white px-4 py-3">
          <div className="flex gap-2">
            {(["rw", "math"] as const)
              .filter((s) => attempt.items.some((i) => i.section === s))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSection(s);
                    setIndex(0);
                  }}
                  className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold ${section === s ? "bg-ink text-white" : "bg-grey-100 text-grey-600"}`}
                  data-testid={`mock-exam-section-${s}`}
                >
                  {s === "rw" ? "R&W" : "Math"}
                  {locked[s] && " (시간 종료)"}
                </button>
              ))}
          </div>
          <div className="flex items-center gap-3">
            {section === "math" && (
              <MockExamToolButtons
                calculatorAllowed={attempt.mathCalculatorAllowed}
                referenceSheetAllowed={attempt.mathReferenceSheetAllowed}
                open={mathToolsOpen}
                onToggle={toggleMathTools}
              />
            )}
            <div className="font-mono text-[15px] font-bold" data-testid="mock-exam-timer">
              {formatClock(remaining[section])}
            </div>
          </div>
        </div>

        {error && <p className="mb-2 text-[12.5px] text-red">{error}</p>}

        {sectionLocked ? (
          <div className="rounded-lg border border-red/40 bg-red/5 p-6 text-center text-[13.5px] text-red">
            이 섹션의 제한 시간이 끝났습니다. 답은 더 바꿀 수 없습니다.
          </div>
        ) : current ? (
          <div className="rounded-lg border border-grey-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold text-grey-500">
                {section === "rw" ? "R&W" : "Math"} {index + 1} / {sectionItems.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleFlag}
                  aria-pressed={flags[current.setItemId]}
                  className={`rounded px-2 py-1 text-[12px] font-bold ${flags[current.setItemId] ? "bg-yellow-100 text-yellow-700" : "text-grey-400"}`}
                  data-testid="toggle-flag"
                  title="나중에 다시 보기"
                >
                  {flags[current.setItemId] ? "★ 표시됨" : "☆ 표시"}
                </button>
                <span className="text-[11px] text-grey-400" data-testid="save-status">
                  {saveStatus === "saving" && "저장 중…"}
                  {saveStatus === "saved" && "저장됨"}
                  {saveStatus === "error" && (
                    <span className="text-red">
                      저장 실패{" "}
                      <button type="button" onClick={retrySave} className="underline">
                        재시도
                      </button>
                    </span>
                  )}
                </span>
              </div>
            </div>
            {current.passage && <RwStimulusView passage={current.passage} className="mb-4 text-[13.5px]" />}
            {current.question && <LearningText text={current.question} className="mb-3 font-semibold text-[14px]" />}
            {current.figure ? <ProblemFigure spec={current.figure} className="mb-4" /> : null}

            {current.format === "mc" && current.options ? (
              <div className="flex flex-col gap-2">
                {current.options.map((opt, i) => {
                  const isChosen = responses[current.setItemId] === String(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => saveCurrent(String(i))}
                      aria-pressed={isChosen}
                      className={`flex items-start gap-2.5 rounded-lg border-2 px-3 py-2 text-left text-[13.5px] ${
                        isChosen ? "border-ink bg-ink/5 font-bold" : "border-grey-200"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                          isChosen ? "border-ink bg-ink text-white" : "border-grey-400 text-grey-500"
                        }`}
                      >
                        {isChosen ? "✓" : OPTION_LETTERS[i] ?? i + 1}
                      </span>
                      <LearningText text={opt} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                inputMode="decimal"
                value={responses[current.setItemId] ?? ""}
                onChange={(e) => saveCurrent(e.target.value)}
                placeholder="답을 입력하세요"
                className="w-full rounded-lg border border-grey-300 px-3 py-2 text-[13.5px]"
                data-testid="mock-exam-spr-input"
              />
            )}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="shrink-0 whitespace-nowrap rounded-lg border border-grey-300 px-4 py-2 text-[13px] font-bold disabled:opacity-40"
          >
            이전 문항
          </button>
          {index < sectionItems.length - 1 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(sectionItems.length - 1, i + 1))}
              className="shrink-0 whitespace-nowrap rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white"
            >
              다음 문항
            </button>
          ) : !isLastSection ? (
            // 2026-09-21 버그 수정 — 이전엔 "현재 섹션의 마지막 문항"에서 곧바로 제출 모달이 떴다
            // (다른 섹션을 아직 안 풀었어도). 마지막 섹션의 마지막 문항일 때만 제출로 넘어가야 한다.
            <button
              type="button"
              onClick={() => {
                const next = sectionsOrder[sectionsOrder.indexOf(section) + 1];
                if (next) {
                  setSection(next);
                  setIndex(0);
                }
              }}
              className="shrink-0 whitespace-nowrap rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white"
            >
              다음 영역
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowReview(true)}
              className="shrink-0 whitespace-nowrap rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-white"
            >
              검토·제출
            </button>
          )}
        </div>
      </div>

      <MockExamMathTools
        calculatorAllowed={attempt.mathCalculatorAllowed}
        referenceSheetAllowed={attempt.mathReferenceSheetAllowed}
        open={mathToolsOpen}
        onClose={() => setMathToolsOpen(null)}
        docked
      />

      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5">
            <h3 className="mb-2 text-[15px] font-bold">제출 전 확인</h3>
            <p className="mb-4 text-[13px] text-grey-600">
              전체 {attempt.items.length}문항 중 {answeredCount}문항에 답했습니다.
              {answeredCount < attempt.items.length && " 답하지 않은 문항이 있습니다."} 제출하면 답을 바꿀 수 없습니다.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowReview(false)} className="rounded-lg border border-grey-300 px-4 py-2 text-[13px] font-bold">
                계속 풀기
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="rounded-lg bg-red px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                data-testid="mock-exam-submit"
              >
                {submitting ? "제출 중…" : "제출하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
