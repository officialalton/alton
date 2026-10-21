"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ESSAY_DISCLAIMER, ESSAY_SCORE_LABEL, englishRubric, resolveRubric } from "@/lib/essay-grading/rubric";
import type { EssayScoreView } from "@/lib/essay-grading/view";

// AI 에세이 추정 점수 카드(영어 UI). 학생 결과 화면과 보호자 읽기 전용 화면이 같이 쓴다. 공식 AP 점수가 아님을 항상 함께 표시한다.
const SKIP_TEXT: Record<string, string> = {
  empty: "No essay was submitted, so there is nothing to score.",
  too_short: "This response is too short for an AI estimate.",
  too_long: "This response is too long for an AI estimate.",
  attempt_cap: "The AI estimate limit for this test has been reached.",
  daily_cap: "The AI estimate limit was reached for this essay.",
  monthly_budget: "AI estimates are temporarily unavailable.",
  input_too_large: "This response and its sources are too long for an AI estimate.",
};
const POLL_MS = 6000, MAX_POLLS = 10;

export default function EssayScoreCard({ score, readOnly = false, onRetry }: { score: EssayScoreView | null; readOnly?: boolean; onRetry?: () => void }) {
  const router = useRouter();
  const polls = useRef(0);
  const waiting = !score || score.status === "pending" || score.status === "processing";
  useEffect(() => {
    if (!score || !waiting || polls.current >= MAX_POLLS) return;
    const t = setTimeout(() => { polls.current += 1; router.refresh(); }, POLL_MS);
    return () => clearTimeout(t);
  }, [score, waiting, router]);

  const box = "mt-3 rounded-lg border border-grey-200 bg-white p-3";
  if (!score) return null; // 행 없음 = 아직 대기열 전(자동 시작이 곧 만든다). 보호자 화면에서는 아무 것도 보이지 않는다.
  const head = <p className="text-[11.5px] font-bold text-grey-500">{ESSAY_SCORE_LABEL}</p>;

  if (score.status === "pending" || score.status === "processing")
    return <div className={box} data-testid="essay-score-pending" role="status" aria-live="polite">{head}<p className="mt-1 text-[13px] text-grey-600">Scoring in progress… this usually takes under a minute.</p></div>;
  if (score.status === "failed") {
    const btn = (label: string) => !readOnly && onRetry && <button type="button" onClick={onRetry} className="mt-2 min-h-[44px] rounded-lg border border-grey-200 px-3 text-[12.5px] font-bold">{label}</button>;
    const when = score.nextRetryAt ? `${score.nextRetryAt.slice(0, 16).replace("T", " ")} UTC` : null;
    const ready = !score.nextRetryAt || new Date(score.nextRetryAt).getTime() <= Date.now();
    // "다시 시도" 문구는 실제 재시도 경로(Retry 버튼 → 기존 채점 시작 경로, 한도 초기화 뒤 한 번만 처리)가 있을 때만 쓴다. 읽기 전용(보호자·관리자)에는 안내 문구만.
    if (score.lastError === "daily_cap" || score.lastError === "monthly_budget") {
      const what = score.lastError === "daily_cap" ? "the daily AI scoring limit was reached" : "the monthly AI scoring capacity was reached";
      return <div className={box} data-testid="essay-score-waiting">{head}<p className="mt-1 text-[13px] text-grey-600">Scoring is paused because {what}.{when ? ` It can be tried again after ${when}.` : ""}</p>{ready ? btn("Retry now") : null}</div>;
    }
    if (score.lastError === "no_reference_answers")
      return <div className={box} data-testid="essay-score-no-anchors">{head}<p className="mt-1 text-[13px] text-grey-600">This question cannot be scored yet because no reference answers are available for it. It will be scored after they are added.</p>{btn("Check again")}</div>;
    return <div className={box} data-testid="essay-score-failed">{head}<p className="mt-1 text-[13px] text-grey-600">We could not score this essay yet.{!readOnly && onRetry ? " Press Retry to try again." : ""}</p>{btn("Retry now")}</div>;
  }
  if (score.status === "dead")
    return <div className={box} data-testid="essay-score-dead">{head}<p className="mt-1 text-[13px] text-grey-600">An AI estimate is not available for this essay. Use the reference answer and scoring guide below to review it.</p></div>;
  if (score.status === "skipped")
    return <div className={box} data-testid="essay-score-skipped">{head}<p className="mt-1 text-[13px] text-grey-600">{SKIP_TEXT[score.lastError ?? ""] ?? "An AI estimate is not available for this essay."}</p></div>;
  if (!score.scores || !score.rationale) return null;

  const { scores: s, rationale: r } = score;
  const def = resolveRubric(s.rubricVersion ?? score.rubricVersion, typeof s.taskType === "string" ? s.taskType : undefined) ?? englishRubric(); // 저장된 루브릭의 행·만점으로 그린다
  return (
    <div className={box} data-testid="essay-score-card">
      {head}
      <p className="mt-1 text-[20px] font-extrabold" data-testid="essay-score-total">{s.total} <span className="text-[13px] font-semibold text-grey-500">/ {def.total}</span></p>
      <ul className="mt-2 flex flex-col gap-2">
        {def.rows.map((row) => (
          <li key={row.key} className="text-[13px]" data-testid={`essay-row-${row.key}`}>
            <span className="font-bold">{row.label}</span> <span className="font-semibold text-grey-600">{String(s[row.key] ?? 0)}/{row.max}</span>
            <p className="mt-0.5 text-grey-600">{r[row.key]}</p>
          </li>
        ))}
      </ul>
      {r.improve.length > 0 && (
        <div className="mt-2" data-testid="essay-improve">
          <p className="text-[12px] font-bold">What to improve</p>
          <ul className="ml-4 list-disc text-[13px] text-grey-600">{r.improve.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      {s.disagreement && <p className="mt-2 text-[12px] text-grey-500" data-testid="essay-disagreement">Our two AI passes differed on this essay, so treat the estimate as especially approximate (the lower score is shown).</p>}
      <p className="mt-2 text-[11.5px] text-grey-500">{ESSAY_DISCLAIMER}</p>
    </div>
  );
}
