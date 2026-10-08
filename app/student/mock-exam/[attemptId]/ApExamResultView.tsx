"use client";

import { useMemo, useState } from "react";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";
import { AP_LABEL_TEXT, AP_SUBJECT_NAME } from "@/lib/ap-exam/layouts";
import { parseFrqAnswer } from "@/lib/ap-exam/frq-answer";
import LearningText from "@/app/session/[id]/LearningText";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import ProblemErrorReportButton from "@/app/components/ProblemErrorReportButton";
import { problemText } from "@/lib/problem-figures/label-rule";

// AP 모의고사 결과(영어 UI). MC: 정답률·섹션별·토픽별. FRQ: 내 답 + "참고 답안/채점 노트(공식 채점 아님)".
// AP 1~5 환산 점수·FRQ 점수는 표시하지 않는다(검증 계획 승인 전). 학부모 읽기 전용 화면은 이번 범위 밖.
const LETTERS = ["A", "B", "C", "D", "E"];
const sectionOf = (i: MockExamAttemptItem) => i.section as string;
type Filter = "all" | "wrong" | "frq";

export function topicOf(i: MockExamAttemptItem): string {
  return (i.satDomain ?? "").replace(/^ap:/, "") || "—";
}

export default function ApExamResultView({ attempt }: { attempt: MockExamAttemptDetail }) {
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
        <p className="text-[12px] font-bold text-grey-500">{subject} · {AP_LABEL_TEXT[attempt.apLabel ?? "mc_practice"]}</p>
        {mc.length > 0 && (
          <p className="mt-1 text-[20px] font-extrabold" data-testid="ap-mc-score">{correct} / {mc.length} <span className="text-[13px] font-semibold text-grey-500">multiple-choice correct ({Math.round((100 * correct) / mc.length)}%)</span></p>
        )}
        {bySection.length > 1 && (
          <ul className="mt-2 text-[12.5px] text-grey-600">{bySection.map((s) => <li key={s.key}>{s.label}: {s.correct}/{s.total}</li>)}</ul>
        )}
        {frq.length > 0 && <p className="mt-2 text-[12.5px] text-grey-600">Free-response answers are shown with a reference answer for self-review. They are not scored.</p>}
        <p className="mt-2 text-[11.5px] text-grey-500">AP scores (1–5) are not estimated for practice tests.</p>
      </section>

      {byTopic.length > 0 && (
        <section className="rounded-lg border border-grey-200 bg-white p-4" aria-label="Topics to review">
          <h3 className="mb-2 text-[13px] font-bold">Topics to review</h3>
          <ul className="flex flex-col gap-1 text-[12.5px]">{byTopic.map((t) => <li key={t.topic} className="flex justify-between"><span>Topic {t.topic}</span><span className={t.correct === t.total ? "text-green" : "text-red"}>{t.correct}/{t.total}</span></li>)}</ul>
        </section>
      )}

      <div className="flex gap-2" role="tablist" aria-label="Question filter">
        {([["all", "All questions"], ["wrong", "Missed"], ["frq", "Free response"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${filter === k ? "bg-ink text-white" : "bg-grey-100 text-grey-600"}`}>{l}</button>
        ))}
      </div>

      <ol className="flex flex-col gap-3">
        {shown.map((it) => {
          const n = attempt.items.indexOf(it) + 1;
          return (
            <li key={it.setItemId} className="rounded-lg border border-grey-200 bg-white p-4" data-testid="ap-review-item">
              <p className="mb-2 text-[12px] font-bold text-grey-500">Question {n}{it.format === "mc" ? (it.correct === true ? " · Correct" : it.response ? " · Incorrect" : " · Not answered") : " · Free response"}</p>
              {it.passage && <LearningText text={it.passage} className="mb-2 text-[13.5px]" />}
              {it.figure ? <ProblemFigure spec={it.figure} text={problemText(it.passage, it.question, it.options)} className="mb-3" /> : null}
              {it.question && <LearningText text={it.question} className="mb-2 font-semibold text-[14px]" />}
              {it.format === "mc" && it.options ? (
                <ul className="flex flex-col gap-1.5">
                  {it.options.map((o, i) => {
                    const isKey = it.correctIndex === i, mine = it.response === String(i);
                    return (
                      <li key={i} className={`flex gap-2 rounded-lg border px-3 py-1.5 text-[13px] ${isKey ? "border-green bg-green/10" : mine ? "border-red bg-red/5" : "border-grey-200"}`}>
                        <span className="font-bold">{LETTERS[i]}</span><span className="min-w-0 break-words"><LearningText text={o} /></span>
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
                      <div className="text-[12.5px] font-semibold"><span>({p.label}) [{p.points} pt]</span> <LearningText text={p.prompt} className="inline" /></div>
                      <p className="mt-1 whitespace-pre-wrap rounded border border-grey-200 bg-grey-50 px-3 py-2 text-[13px]" data-testid={`frq-answer-${p.label}`}>{parseFrqAnswer(it.response ?? "")[p.label] || "(no answer)"}</p>
                    </div>
                  ))}
                </div>
              )}
              {(it.explanationEn ?? it.explanation) && (
                <div className="mt-3 rounded-lg bg-grey-50 p-3">
                  <p className="mb-1 text-[11.5px] font-bold text-grey-500">{it.format === "essay" ? "Reference answer (not official scoring)" : "Explanation"}</p>
                  <LearningText text={(it.explanationEn ?? it.explanation) as string} className="whitespace-pre-wrap text-[13px]" />
                </div>
              )}
              <ProblemErrorReportButton className="mt-3" role="student" context={{ source: "mock_exam", attemptId: attempt.id, setItemId: it.setItemId, problemId: it.problemId }} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
