"use client";

import { useState } from "react";
import type { TeacherVocabOverview, TeacherVocabQuizRow } from "./vocab-assign-data";
import VocabQuizIssueForm from "./VocabQuizIssueForm";

/** 교사 포털 — 담당 학생에게 즉석 단어 시험을 내고, 발급 이력(학생별 상태·점수·마감)을 본다. */
export default function VocabAssignTab({ overview }: { overview: TeacherVocabOverview }) {
  const [justIssued, setJustIssued] = useState(false);

  return (
    <div className="max-w-[720px]">
      <p className="text-[13px] text-grey-500 mb-5">
        담당 학생에게 ALTON SAT 공용 단어장 범위로 즉석 시험을 낼 수 있습니다. 학생은 단어장 화면에서 응시합니다.
      </p>

      <div className="mb-6">
        <VocabQuizIssueForm students={overview.students} books={overview.books} onIssued={() => setJustIssued(true)} />
        {justIssued && (
          <p className="text-[12px] text-grey-500 mt-2">
            발급 완료. 발급 이력에 반영하려면{" "}
            <button onClick={() => window.location.reload()} className="font-bold text-ink underline">
              새로고침
            </button>
            해주세요.
          </p>
        )}
      </div>

      <p className="text-[12px] font-bold text-grey-500 mb-2">발급 이력</p>
      {overview.recentQuizzes.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">아직 낸 시험이 없습니다.</div>
      ) : (
        overview.recentQuizzes.map((q) => <QuizRow key={q.id} q={q} />)
      )}
    </div>
  );
}

function QuizRow({ q }: { q: TeacherVocabQuizRow }) {
  return (
    <div className="border border-grey-200 rounded-xl px-4 py-3 mb-2 flex items-center justify-between">
      <div>
        <span className="text-[13px] font-bold text-ink">{q.studentName}</span>
        <span className="text-[12.5px] text-grey-500 ml-2">{q.wordCount}문항</span>
        {q.dueAt && <span className="text-[11px] text-red ml-2">마감 {new Date(q.dueAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
      <span className="text-[12.5px] font-bold text-ink">
        {q.status === "completed" ? `${q.score}/${q.total}점` : "응시 대기"}
      </span>
    </div>
  );
}
