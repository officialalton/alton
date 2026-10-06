"use client";

import { useMemo, useState } from "react";
import LearningText from "@/app/session/[id]/LearningText";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import { stripInlineOptions } from "@/lib/problem-text";
import type { ProblemHistoryEntry } from "./problem-history-data";
import { SKILL_CODES, domainLabel, domainShort, skillLabel } from "@/lib/problem-taxonomy";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateEn as fmtDate } from "@/lib/format-datetime-en";
import { problemText } from "@/lib/problem-figures/label-rule";

// 2026-09-14 — 학생 포털 문제 기록(v3). 수업·과제에서 답한 문제를 한 줄씩. 펼치면 지문·내 답·채점 결과, 채점 뒤엔 정답·해설.

const FORMAT_LABEL: Record<ProblemHistoryEntry["format"], string> = { mc: "Multiple choice", spr: "Numeric entry", essay: "Written response", math: "Worked solution" };
const GRADE_LABEL = { correct: "Correct", partial: "Partially correct", incorrect: "Incorrect" } as const;
const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];
const ALL = "All";

type GradeFilter = "all" | "correct" | "partial" | "incorrect" | "pending";

export default function ProblemHistoryTab({ entries, isFreeMember = false }: { entries: ProblemHistoryEntry[]; isFreeMember?: boolean }) {
  const tz = useViewerTimezone();
  const [subject, setSubject] = useState(ALL);
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [formatFilter, setFormatFilter] = useState<"all" | ProblemHistoryEntry["format"]>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "lesson" | "homework" | "mock_exam">("all");
  const [skillFilter, setSkillFilter] = useState("");
  // 기술별 성취(2026-09-14) — 채점된 문제만 센다. 문제은행·자동 구성과 같은 분류.
  const skillSummary = useMemo(() => {
    const m = new Map<string, { graded: number; correct: number; total: number }>();
    for (const e of entries) {
      const key = e.skillCode ?? "";
      if (!key) continue;
      const cur = m.get(key) ?? { graded: 0, correct: 0, total: 0 };
      cur.total += 1;
      if (e.graded) cur.graded += 1;
      if (e.grade === "correct") cur.correct += 1;
      m.set(key, cur);
    }
    return SKILL_CODES.filter((k) => m.has(k.code)).map((k) => ({ ...k, ...m.get(k.code)! }));
  }, [entries]);
  const [openId, setOpenId] = useState<string | null>(null);

  const subjects = useMemo(() => Array.from(new Set(entries.map((e) => e.subjectName).filter(Boolean))), [entries]);
  const filtered = entries.filter((e) => {
    if (subject !== ALL && e.subjectName !== subject) return false;
    if (gradeFilter === "pending" && e.graded) return false;
    if (gradeFilter !== "all" && gradeFilter !== "pending" && e.grade !== gradeFilter) return false;
    if (formatFilter !== "all" && e.format !== formatFilter) return false;
    if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
    if (skillFilter && e.skillCode !== skillFilter) return false;
    return true;
  });
  const correctCount = entries.filter((e) => e.grade === "correct").length;
  const gradedCount = entries.filter((e) => e.graded).length;

  return (
    <div className="max-w-[760px]">
      <p className="text-[13px] text-grey-500 mb-4">
        {isFreeMember
          ? "Questions you missed or saved from your practice tests. Review the explanation and try them again."
          : "Problems you answered in lessons and assignments. Answers and explanations unlock once your teacher grades them."}
        {entries.length > 0 && (
          <>
            {" "}
            Correct <b className="text-green">{correctCount}</b> / Graded {gradedCount} / Total {entries.length}
          </>
        )}
      </p>

      <div className="flex flex-col gap-2 text-[12.5px] mb-4">
        {subjects.length > 1 && (
          <Chips label="Subject" value={subject} onChange={setSubject} options={[ALL, ...subjects].map((s) => [s, s])} />
        )}
        <Chips
          label="Grade"
          value={gradeFilter}
          onChange={(v) => setGradeFilter(v as GradeFilter)}
          options={[["all", "All"], ["correct", "Correct"], ["partial", "Partial"], ["incorrect", "Incorrect"], ["pending", "Pending"]]}
        />
        <Chips
          label="Format"
          value={formatFilter}
          onChange={(v) => setFormatFilter(v as "all" | ProblemHistoryEntry["format"])}
          options={[["all", "All"], ["mc", "Multiple choice"], ["spr", "Numeric"], ["essay", "Written"], ["math", "Worked"]]}
        />
        {!isFreeMember && (
        <Chips
          label="Source"
          value={sourceFilter}
          onChange={(v) => setSourceFilter(v as "all" | "lesson" | "homework" | "mock_exam")}
          options={[["all", "All"], ["lesson", "Lesson"], ["homework", "Assignment"], ["mock_exam", "Practice Test"]]}
        />
        )}
      </div>

      {skillSummary.length > 0 && (
        <section className="mb-4 border-[1.5px] border-grey-200 rounded-xl px-4 py-3" data-testid="skill-summary">
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">Skill progress (graded problems)</div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {skillSummary.map((k) => (
              <li key={k.code}>
                <button
                  type="button"
                  onClick={() => setSkillFilter(skillFilter === k.code ? "" : k.code)}
                  aria-pressed={skillFilter === k.code}
                  className={"w-full text-left text-[12.5px] rounded-lg px-3 py-1.5 border-[1.5px] " + (skillFilter === k.code ? "border-ink bg-grey-100" : "border-grey-100")}
                >
                  <span className="text-grey-500">{domainShort(k.domain)} › </span>
                  <span className="font-bold text-ink">{k.label}</span>
                  <span className="float-right">
                    <b className="text-green">{k.correct}</b> / {k.graded}
                    {k.total > k.graded && <span className="text-grey-500"> (+{k.total - k.graded} pending)</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">No problems match these filters.</div>
      ) : (
        <ul className="border-[1.5px] border-grey-200 rounded-xl divide-y divide-grey-100">
          {filtered.map((e) => {
            const open = openId === e.workId;
            const snippet = stripInlineOptions(e.passage, e.options).replace(/\s+/g, " ");
            return (
              <li key={e.workId} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : e.workId)}
                  aria-expanded={open}
                  className="w-full text-left flex flex-wrap items-center gap-2"
                >
                  <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5">{FORMAT_LABEL[e.format]}</span>
                  <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5">
                    {e.source === "homework" ? "Assignment" : e.source === "mock_exam" ? "Practice Test" : "Lesson"}
                  </span>
                  <GradeBadge entry={e} />
                  {e.skillCode && (
                    <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5" title={domainLabel(e.satDomain) ?? undefined}>
                      {domainShort(e.satDomain)} › {skillLabel(e.skillCode)}
                    </span>
                  )}
                  <span className="text-[13px] text-ink flex-1 min-w-[200px] truncate">{snippet || "(No text)"}</span>
                  <span className="text-[11.5px] text-grey-500 shrink-0">
                    {isFreeMember
                      ? ["Practice Test", e.unitTitle, e.startsAt ? fmtDate(e.startsAt, { month: "short", day: "numeric", year: "numeric" }, tz) : null].filter(Boolean).join(" · ")
                      : [e.subjectName, e.unitTitle, e.startsAt ? fmtDate(e.startsAt, undefined, tz) : null].filter(Boolean).join(" · ")}
                  </span>
                </button>
                {open && <HistoryDetail entry={e} isFreeMember={isFreeMember} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chips({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-grey-500 mr-1 w-[36px]">{label}</span>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={"px-3 py-1 rounded-full border-[1.5px] text-[12px] font-bold " + (value === v ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function GradeBadge({ entry }: { entry: ProblemHistoryEntry }) {
  if (!entry.graded) return <span className="text-[11px] font-bold text-grey-500">Pending</span>;
  if (!entry.grade) return <span className="text-[11px] font-bold text-green">Graded</span>;
  const cls = entry.grade === "correct" ? "text-green" : entry.grade === "partial" ? "text-amber-600" : "text-red";
  return <span className={"text-[11px] font-bold " + cls}>{GRADE_LABEL[entry.grade]}</span>;
}

function HistoryDetail({ entry: e, isFreeMember }: { entry: ProblemHistoryEntry; isFreeMember: boolean }) {
  return (
    <div className="mt-3 rounded-lg bg-grey-100 px-4 py-3" data-testid="history-detail">
      <ProblemFigure spec={e.figure} text={problemText(e.passage, e.options)} className="mb-2" />
      <LearningText text={stripInlineOptions(e.passage, e.options) || "(No text)"} className="learning-body text-[13.5px] leading-[1.75] text-ink" />
      {e.format === "mc" && e.options.length > 0 && (
        <ol className="mt-2 space-y-1">
          {e.options.map((o, i) => {
            const mine = e.myChoice === i;
            const correct = e.correctIndex === i;
            return (
              <li
                key={i}
                className={
                  "flex gap-2 text-[13px] rounded px-2 py-1 " +
                  (correct ? "bg-green/10 text-green font-bold" : mine ? (e.graded ? "bg-red/10 text-red" : "bg-white text-ink font-bold") : "text-ink")
                }
              >
                <span className="font-bold shrink-0">{OPTION_LABELS[i] ?? i + 1}</span>
                <LearningText text={o} className="learning-body" />
                {mine && <span className="ml-auto text-[11px] shrink-0">My answer</span>}
                {correct && !mine && <span className="ml-auto text-[11px] shrink-0">Correct</span>}
              </li>
            );
          })}
        </ol>
      )}
      {(e.format === "spr" || e.format === "essay") && (
        <p className="mt-2 text-[13px] text-ink whitespace-pre-wrap">
          <span className="font-bold">My answer: </span>
          {e.myText?.trim() || "None"}
          {e.acceptedAnswers && e.acceptedAnswers.length > 0 && (
            <>
              {" "}
              <span className="font-bold text-green">· Answer: {e.acceptedAnswers.join(" or ")}</span>
            </>
          )}
        </p>
      )}
      {e.format === "math" && <p className="mt-2 text-[12.5px] text-grey-500">You can view your work on the whiteboard in the Problems tab of that lesson.</p>}
      {e.graded && (
        <div className="mt-2 text-[12.5px] text-ink">
          <span className="font-bold">{isFreeMember ? "Result: " : "Teacher's grade: "}</span>
          {e.grade ? GRADE_LABEL[e.grade] : "Graded"}
          {e.gradeComment && <span className="text-grey-500"> · “{e.gradeComment}”</span>}
        </div>
      )}
      {e.explanation && (
        <div className="mt-2">
          <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-1">Explanation</div>
          <LearningText text={e.explanation} className="learning-body text-[13px] leading-[1.7] text-ink" />
        </div>
      )}
      {!e.graded && !isFreeMember && <p className="mt-2 text-[12px] text-grey-500">The answer and explanation will appear here once your teacher grades it.</p>}
    </div>
  );
}
