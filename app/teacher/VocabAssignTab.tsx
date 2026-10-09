"use client";

import { useState } from "react";
import type { TeacherVocabOverview, TeacherVocabQuizRow } from "./vocab-assign-data";
import VocabQuizIssueForm from "./VocabQuizIssueForm";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateTime } from "@/lib/format-datetime";

/** 교사 포털 — 담당 학생에게 즉석 단어 시험을 내고, 발급 이력(학생별 상태·점수·마감)을 본다. */
export default function VocabAssignTab({ overview }: { overview: TeacherVocabOverview }) {
  const [justIssued, setJustIssued] = useState(false);

  return (
    <div className="max-w-[720px]">
      <p className="text-[13px] text-grey-500 mb-5">
        Issue an on-the-spot vocabulary quiz to your students from the ALTON SAT shared word books. Students take it from their Vocabulary screen.
      </p>

      <div className="mb-6">
        <VocabQuizIssueForm students={overview.students} books={overview.books} onIssued={() => setJustIssued(true)} />
        {justIssued && (
          <p className="text-[12px] text-grey-500 mt-2">
            Issued.{" "}
            <button onClick={() => window.location.reload()} className="font-bold text-ink underline">
              Refresh
            </button>{" "}
            to see it in the issue history.
          </p>
        )}
      </div>

      <p className="text-[12px] font-bold text-grey-500 mb-2">Issue history</p>
      {overview.recentQuizzes.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">No quizzes issued yet.</div>
      ) : (
        overview.recentQuizzes.map((q) => <QuizRow key={q.id} q={q} />)
      )}
    </div>
  );
}

function QuizRow({ q }: { q: TeacherVocabQuizRow }) {
  const tz = useViewerTimezone();
  return (
    <div className="border border-grey-200 rounded-xl px-4 py-3 mb-2 flex items-center justify-between">
      <div>
        <span className="text-[13px] font-bold text-ink">{q.studentName}</span>
        <span className="text-[12.5px] text-grey-500 ml-2">{q.wordCount} questions</span>
        {q.dueAt && <span className="text-[11px] text-red ml-2">Due {fmtDateTime(q.dueAt, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }, tz)}</span>}
      </div>
      <span className="text-[12.5px] font-bold text-ink">
        {q.status === "completed" ? `${q.score}/${q.total}` : "Not taken yet"}
      </span>
    </div>
  );
}
