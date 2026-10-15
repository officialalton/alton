"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EssayScoreCard from "@/app/components/EssayScoreCard";
import type { EssayScoreView } from "@/lib/essay-grading/view";
import { USH_RUBRIC_ID } from "@/lib/essay-grading/rubric";
import { enqueueEssayGradingAction } from "@/lib/essay-grading/actions";
import type { MockExamAttemptDetail, MockExamAttemptItem, MockExamAttemptSummary } from "@/lib/mock-exam/attempt-data";
import { AP_SUBJECT_NAME, apBadgeText, apCoverageLines, apGuidanceLines, apUnitsFromDomains } from "@/lib/ap-exam/layouts";
import { AccuracyBarList } from "@/app/components/AccuracyBars";
import AttemptSwitcher from "./AttemptSwitcher";
import LazyWhenVisible from "@/app/components/LazyWhenVisible";
import UpdatedVersionNote, { UpdatedVersionBadge } from "@/app/components/UpdatedVersionNote";
import { apPassageForDisplay } from "@/lib/ap-exam/stimulus-display";
import { autoMathExplanation } from "@/lib/ap-exam/explanation-math";
import { breakOptionAnalysis } from "@/lib/mock-exam/explanation-format";
import { parseFrqAnswer } from "@/lib/ap-exam/frq-answer";
import LearningText from "@/app/session/[id]/LearningText";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import ProblemErrorReportButton from "@/app/components/ProblemErrorReportButton";
import { problemText } from "@/lib/problem-figures/label-rule";
import { withBackground } from "@/lib/ap-exam/frq-background";
import { inkKey, svgDataUrl, type FrqInkRow } from "@/lib/ap-exam/frq-ink";

// AP 모의고사 결과(영어 UI). MC: 정답률·섹션별·토픽별. FRQ: 내 답 + "참고 답안/채점 노트(공식 채점 아님)".
// AP 1~5 환산 점수·FRQ 점수는 표시하지 않는다(검증 계획 승인 전). 학부모 읽기 전용 화면은 이번 범위 밖.
const LETTERS = ["A", "B", "C", "D", "E"];
const sectionOf = (i: MockExamAttemptItem) => i.section as string;
type Filter = "all" | "wrong" | "frq";

export function topicOf(i: MockExamAttemptItem): string {
  return (i.satDomain ?? "").replace(/^ap:/, "") || "—";
}

const EAGER_ITEMS = 4;

/** 문항 하나의 본문(지문·그림·질문·선택지/FRQ 답·해설·오류 신고). 같은 문항이 다시 그려질 일(필터 전환 등)에 수식을 다시 조판하지 않도록 memo. */
const ApReviewItem = memo(function ApReviewItem({ it, attemptId, inkByPart, essayByPart, readOnly, onRetry }: { it: MockExamAttemptItem; attemptId: string; inkByPart: Map<string, string>; essayByPart?: Map<string, EssayScoreView>; readOnly?: boolean; onRetry?: () => void }) {
  // U.S. History SAQ: A·B·C 를 한 건으로 채점해 첫 파트 라벨에 저장된다 → 카드는 문항 아래에 한 번만(a/b/c 행 점수).
  const groupedScore = it.format === "essay" && (it.parts?.length ?? 0) > 1 ? essayByPart?.get(inkKey(it.setItemId, it.parts![0].label)) : undefined;
  const grouped = groupedScore?.rubricVersion === USH_RUBRIC_ID;
  return (
    <>
              {apPassageForDisplay(it.passage, it.question) && <LearningText text={apPassageForDisplay(it.passage, it.question) as string} className="mb-2 text-[13.5px]" />}
              {it.figure ? <ProblemFigure spec={it.figure} text={problemText(it.passage, it.question, it.options)} className="mb-3" /> : null}
              {it.question && <LearningText text={autoMathExplanation(it.question)} className="mb-2 font-semibold text-[14px]" />}
              {it.format === "mc" && it.options ? (
                <ul className="flex flex-col gap-1.5">
                  {it.options.map((o, i) => {
                    const isKey = it.correctIndex === i, mine = it.response === String(i);
                    return (
                      <li key={i} className={`flex gap-2 rounded-lg border px-3 py-1.5 text-[13px] ${isKey ? "border-green bg-green/10" : mine ? "border-red bg-red/5" : "border-grey-200"}`}>
                        <span className="font-bold">{LETTERS[i]}</span><span className="min-w-0 break-words"><LearningText text={autoMathExplanation(o)} /></span>
                        {isKey && <span className="ml-auto text-[11px] font-bold text-green">Correct answer</span>}
                        {mine && !isKey && <span className="ml-auto text-[11px] font-bold text-red">Your answer</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col gap-2">
                  {(it.parts ?? []).map((p) => (
                    <div key={p.label}>
                      <div className="text-[12.5px] font-semibold"><span>({p.label}) [{p.points} pt]</span> <LearningText text={autoMathExplanation(p.prompt)} className="inline" /></div>
                      <p className={`mt-1 whitespace-pre-wrap rounded border border-grey-200 bg-grey-50 px-3 py-2 text-[13px] ${p.mode === "code" ? "overflow-x-auto font-mono text-[12.5px] [tab-size:4]" : ""}`} data-testid={`frq-answer-${p.label}`}>{parseFrqAnswer(it.response ?? "")[p.label] || "(no answer)"}</p>
                      {inkByPart.get(inkKey(it.setItemId, p.label)) && (
                        <figure className="mt-1.5" data-testid={`frq-handwriting-${p.label}`}>
                          <figcaption className="mb-1 text-[11.5px] font-bold text-grey-500">Your handwritten answer</figcaption>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={svgDataUrl(inkByPart.get(inkKey(it.setItemId, p.label)) as string)} alt={`Your handwritten answer for part (${p.label})`} className="w-full max-w-xl rounded border border-grey-200 bg-white" />
                        </figure>
                      )}
                      {essayByPart && !grouped && <EssayScoreCard score={essayByPart.get(inkKey(it.setItemId, p.label)) ?? null} readOnly={readOnly} onRetry={onRetry} />}
                    </div>
                  ))}
                  {essayByPart && grouped && <EssayScoreCard score={groupedScore ?? null} readOnly={readOnly} onRetry={onRetry} />}
                </div>
              )}
              {(it.explanationEn ?? it.explanation) && (
                <div className="mt-3 rounded-lg bg-grey-50 p-3" data-testid="ap-explanation">
                  <p className="mb-1 text-[11.5px] font-bold text-grey-500">{it.format === "essay" ? "Reference answer and scoring guide (reference feedback, not official scoring)" : "Explanation"}</p>
                  <LearningText text={breakOptionAnalysis(autoMathExplanation((it.explanationEn ?? it.explanation) as string))} className="whitespace-pre-wrap text-[13px]" />
                </div>
              )}
              <ProblemErrorReportButton className="mt-3" role="student" context={{ source: "mock_exam", attemptId: attemptId, setItemId: it.setItemId, problemId: it.problemId }} />
    </>
  );
});

export default function ApExamResultView({ attempt, attempts, topicNames, handwriting, essayScores, essayAiEnabled = false, readOnly = false }: { attempt: MockExamAttemptDetail; attempts?: MockExamAttemptSummary[]; topicNames?: Record<string, string>; handwriting?: FrqInkRow[]; essayScores?: EssayScoreView[]; essayAiEnabled?: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const essayByPart = useMemo(() => (essayAiEnabled ? new Map((essayScores ?? []).map((r) => [inkKey(r.setItemId, r.partLabel), r])) : undefined), [essayScores, essayAiEnabled]);
  const started = useRef(false);
  const startScoring = () => { void enqueueEssayGradingAction(attempt.id).then(() => router.refresh()); };
  // 플래그가 켜져 있고 에세이 파트 중 점수 행이 없는 것이 있으면 학생 화면에서 한 번 채점을 시작한다(멱등, 서버가 상한을 강제).
  useEffect(() => {
    if (readOnly || !essayByPart || started.current) return;
    const missing = attempt.items.some((i) => {
      if (i.format !== "essay") return false;
      const ps = i.parts ?? [];
      if (ps.length > 1 && essayByPart.get(inkKey(i.setItemId, ps[0].label))?.rubricVersion === USH_RUBRIC_ID) return false; // SAQ 묶음: 첫 파트 행 하나가 전체
      return ps.some((p) => !essayByPart.has(inkKey(i.setItemId, p.label)));
    });
    if (missing) { started.current = true; startScoring(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essayByPart, readOnly]);
  const inkByPart = useMemo(() => new Map((handwriting ?? []).filter((r) => r.previewSvg).map((r) => [inkKey(r.setItemId, r.partLabel), withBackground(r.previewSvg, r.background)])), [handwriting]);
  const [filter, setFilter] = useState<Filter>("all");
  const layout = attempt.sectionLayout ?? [];
  const mc = attempt.items.filter((i) => i.format === "mc");
  const frq = attempt.items.filter((i) => i.format === "essay");
  const correct = mc.filter((i) => i.correct === true).length;
  const bySection = layout.filter((s) => s.kind === "mc").map((s) => {
    const its = mc.filter((i) => sectionOf(i) === s.key);
    return { key: s.key, label: s.label, total: its.length, correct: its.filter((i) => i.correct === true).length };
  }).filter((s) => s.total > 0);
  const byTopic = useMemo(() => {
    const m = new Map<string, { total: number; correct: number }>();
    for (const i of mc) { const t = topicOf(i); const e = m.get(t) ?? { total: 0, correct: 0 }; e.total++; if (i.correct === true) e.correct++; m.set(t, e); }
    return [...m.entries()].map(([topic, v]) => ({ topic, ...v })).sort((a, b) => a.correct / a.total - b.correct / b.total || a.topic.localeCompare(b.topic));
  }, [mc]);
  const shown = attempt.items.filter((i) => (filter === "all" ? true : filter === "frq" ? i.format === "essay" : i.format === "mc" && i.correct !== true));
  const subject = AP_SUBJECT_NAME[attempt.apSubject ?? ""] ?? "AP";

  return (
    <div className="flex flex-col gap-4" data-testid="ap-exam-result">
      <section className="rounded-lg border border-grey-200 bg-white p-4">
        <AttemptSwitcher attempt={attempt} attempts={attempts} attemptHrefBase="/student/mock-exam/" />
        {attempt.versionNote && (
          <div className="mb-2" data-testid="result-updated-version">
            <UpdatedVersionBadge />
            <UpdatedVersionNote info={attempt.versionNote} />
          </div>
        )}
        <p className="text-[12px] font-bold text-grey-500">{subject} · <span data-testid="ap-badge">{apBadgeText({ subject: attempt.apSubject, label: attempt.apLabel, layout: attempt.sectionLayout, name: attempt.examSetName })}</span></p>
        {apGuidanceLines({ subject: attempt.apSubject, layout: attempt.sectionLayout, name: attempt.examSetName }).map((l) => <p key={l} className="mt-1 text-[11.5px] text-grey-500" data-testid="ap-set-guidance">{l}</p>)}
          {apCoverageLines({ subject: attempt.apSubject, units: apUnitsFromDomains(attempt.items.map((i) => i.satDomain)), layout: attempt.sectionLayout, name: attempt.examSetName, label: attempt.apLabel, result: true }).map((l, i) => <p key={l} className={`${i === 0 ? "font-semibold " : ""}mt-1 text-[11.5px] text-grey-600`} data-testid="ap-coverage">{l}</p>)}
        {mc.length > 0 && (
          <p className="mt-1 text-[20px] font-extrabold" data-testid="ap-mc-score">{correct} / {mc.length} <span className="text-[13px] font-semibold text-grey-500">multiple-choice correct ({Math.round((100 * correct) / mc.length)}%)</span></p>
        )}
        {bySection.length > 1 && (
          <ul className="mt-2 text-[12.5px] text-grey-600">{bySection.map((s) => <li key={s.key}>{s.label}: {s.correct}/{s.total}</li>)}</ul>
        )}
        {frq.length > 0 && <p className="mt-2 text-[12.5px] text-grey-600">Free-response answers are shown next to a reference answer and scoring guide for self-review. This is reference feedback, not official scoring.{essayAiEnabled ? " Where shown, an AI estimate is an internal estimate, not an official AP score." : " No score is given."}</p>}
        <p className="mt-2 text-[11.5px] text-grey-500">AP scores (1–5) are not estimated for practice tests.</p>
      </section>

      {byTopic.length > 0 && (
        <section className="rounded-lg border border-grey-200 bg-white p-4" aria-label="Topics to review">
          <h3 className="mb-2 text-[13px] font-bold">Topics to review</h3>
          <p className="mb-3 text-[11.5px] text-grey-500">Weakest first. Bars show accuracy on multiple-choice questions; topics with few questions are shown lighter.</p>
          <AccuracyBarList testId="ap-topic-bars" highlightFirst rows={byTopic.map((t) => ({ key: t.topic, label: `Topic ${t.topic}${topicNames?.[t.topic] ? ` · ${topicNames[t.topic]}` : ""}`, correct: t.correct, total: t.total }))} />
        </section>
      )}

      <div className="flex gap-2" role="tablist" aria-label="Question filter">
        {([["all", "All questions"], ["wrong", "Missed"], ["frq", "Free response"]] as const).filter(([k]) => (k === "frq" ? frq.length > 0 : k === "wrong" ? mc.length > 0 : true)).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${filter === k ? "bg-ink text-white" : "bg-grey-100 text-grey-600"}`}>{l}</button>
        ))}
      </div>

      <ol className="flex flex-col gap-3">
        {shown.map((it, idx) => {
          const n = attempt.items.indexOf(it) + 1;
          return (
            <li key={it.setItemId} className="rounded-lg border border-grey-200 bg-white p-4" data-testid="ap-review-item" data-set-item-id={it.setItemId}>
              <p className="mb-2 text-[12px] font-bold text-grey-500">Question {n}{it.format === "mc" ? (it.correct === true ? " · Correct" : it.response ? " · Incorrect" : " · Not answered") : " · Free response"}</p>
              {/* 2026-10-13(결과 화면 지연 점검): 문항 본문(지문·수식·그림·해설)은 앞 몇 개만 서버가 그리고 나머지는 화면 근처에 올 때 그린다 —
                  48~70문항의 수식 조판을 한꺼번에 하면 HTML 수 MB·DOM 십수만 개가 되어 열기가 매우 느렸다. 번호·정오 줄은 항상 보인다. */}
              <LazyWhenVisible eager={idx < EAGER_ITEMS} minHeight={420}>
                <ApReviewItem it={it} attemptId={attempt.id} inkByPart={inkByPart} essayByPart={essayByPart} readOnly={readOnly} onRetry={readOnly ? undefined : startScoring} />
              </LazyWhenVisible>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
