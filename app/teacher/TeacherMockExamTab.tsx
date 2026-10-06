"use client";

import { useCallback, useEffect, useState } from "react";
import TeacherMockExamAttemptViewer from "./TeacherMockExamAttemptViewer";
import MockExamSetContentViewer from "@/app/components/MockExamSetContentViewer";
import {
  loadTeacherMockExamTabDataAction,
  getMockExamSetContentForTeacherAction,
  getMockExamAttemptDetailForTeacherAction,
  listMyStudentMockExamAttemptsAction,
  type TeacherMockExamTabData,
  type TeacherStudentMockExamRow,
} from "./mock-exam-tab-actions";
import type { MockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import type { MockExamSetContentItem } from "@/lib/mock-exam/set-content";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDate } from "@/lib/format-datetime";

const SUB_TABS = ["Status", "Browse", "History"] as const;
type SubTab = (typeof SUB_TABS)[number];
const STATUS_LABEL: Record<string, string> = { assigned: "Not started", in_progress: "In progress", submitted: "Grading", graded: "Graded" };

// 2026-10-01 — 모의고사 배정 폐지(공개 세트는 모든 활성 학생이 직접 시작). 교사는 담당 학생의
// 응시 결과를 읽기 전용으로 본다: (1) "현황" 풀이·채점 결과·통계, (2) "열람" 공개 문항 미리보기,
// (3) "내역" 시작한 응시 목록. 특정 학생에게 시험을 지정하려면 학생 보드에 할 일을 추가한다.
export default function TeacherMockExamTab() {
  const [subTab, setSubTab] = useState<SubTab>("Status");
  const [data, setData] = useState<TeacherMockExamTabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    loadTeacherMockExamTabDataAction()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load mock exam data."));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (error) return <p className="text-[13px] text-red">{error}</p>;
  if (!data) return <p className="text-[13px] text-grey-500">Loading…</p>;

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-grey-200">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            aria-current={subTab === t ? "page" : undefined}
            className={
              "px-3 pb-2.5 -mb-px border-b-2 text-[13px] font-bold " +
              (subTab === t ? "text-ink border-ink" : "text-grey-500 border-transparent")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {subTab === "Status" && <StatusSubTab data={data} />}
      {subTab === "Browse" && <BrowseSubTab examSets={data.examSets} />}
      {subTab === "History" && <HistorySubTab />}
    </div>
  );
}

function StatusSubTab({ data }: { data: TeacherMockExamTabData }) {
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<MockExamAttemptDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const allAttempts = data.students.flatMap((s) => (data.attemptsByStudent[s.studentId] ?? []).filter((a) => a.status !== "assigned"));
  const graded = allAttempts.filter((a) => a.status === "graded" && a.correctCount !== null);
  const avgPct =
    graded.length > 0
      ? Math.round((graded.reduce((sum, a) => sum + a.correctCount! / a.totalCount, 0) / graded.length) * 100)
      : null;

  function openAttempt(attemptId: string) {
    setSelectedAttemptId(attemptId);
    setAttempt(null);
    setLoadError(null);
    getMockExamAttemptDetailForTeacherAction(attemptId)
      .then(setAttempt)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't load."));
  }

  if (selectedAttemptId) {
    return (
      <div>
        <button type="button" onClick={() => setSelectedAttemptId(null)} className="mb-3 text-[12px] font-semibold text-grey-500">
          ← Back to status
        </button>
        {loadError ? (
          <p className="text-[13px] text-red">{loadError}</p>
        ) : !attempt ? (
          <p className="text-[13px] text-grey-500">Loading…</p>
        ) : (
          <TeacherMockExamAttemptViewer attempt={attempt} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-grey-200 bg-white p-4">
        <p className="text-[12px] font-bold text-grey-500">Stats</p>
        <p className="mt-1 text-[13px]">
          {allAttempts.length} started · {graded.length} graded
          {avgPct !== null && ` · Average accuracy ${avgPct}%`}
        </p>
      </div>
      {data.students.map((s) => {
        const attempts = (data.attemptsByStudent[s.studentId] ?? []).filter((a) => a.status !== "assigned");
        if (attempts.length === 0) return null;
        return (
          <div key={s.studentId} className="rounded-lg border border-grey-200 bg-white p-4">
            <p className="mb-2 text-[13px] font-bold">{s.studentName ?? s.studentId}</p>
            <ul className="flex flex-col gap-1">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-[13px]">
                  <span>
                    {a.examSetName} — {STATUS_LABEL[a.status] ?? a.status}
                    {a.status === "graded" && a.correctCount !== null && ` (${a.correctCount}/${a.totalCount})`}
                    {/* 2026-09-22(사용자 지시) — 응시 중 재입장 횟수를 시간 어뷰징
                        의심 신호로 노출한다(2회 이상만 눈에 띄게). */}
                    {a.entryCount > 1 && (
                      <span className="ml-1.5 text-[11px] font-bold text-amber-600" title="Number of times the student left and re-entered the exam screen">
                        · Re-entered {a.entryCount}×
                      </span>
                    )}
                  </span>
                  {(
                    <button type="button" onClick={() => openAttempt(a.id)} className="text-[12px] font-bold text-ink underline">
                      View answers
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function BrowseSubTab({ examSets }: { examSets: { id: string; name: string; difficultyTier: string }[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MockExamSetContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open(setId: string) {
    setSelectedId(setId);
    setItems(null);
    setError(null);
    getMockExamSetContentForTeacherAction(setId)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load."));
  }

  if (selectedId) {
    return (
      <div>
        <button type="button" onClick={() => setSelectedId(null)} className="mb-3 text-[12px] font-semibold text-grey-500">
          ← Back to list
        </button>
        {error ? <p className="text-[13px] text-red">{error}</p> : !items ? <p className="text-[13px] text-grey-500">Loading…</p> : <MockExamSetContentViewer items={items} />}
      </div>
    );
  }

  if (examSets.length === 0) return <p className="text-[13px] text-grey-500">No published mock exams yet.</p>;

  return (
    <ul className="flex flex-col gap-1.5">
      {examSets.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => open(s.id)} className="w-full rounded-lg border border-grey-200 bg-white px-3 py-2 text-left text-[13px] font-semibold hover:bg-grey-50">
            {s.name} ({s.difficultyTier})
          </button>
        </li>
      ))}
    </ul>
  );
}

function HistorySubTab() {
  const tz = useViewerTimezone();
  const [rows, setRows] = useState<TeacherStudentMockExamRow[] | null>(null);

  useEffect(() => {
    listMyStudentMockExamAttemptsAction().then(setRows);
  }, []);

  if (rows === null) return <p className="text-[13px] text-grey-500">Loading…</p>;
  if (rows.length === 0) return <p className="text-[13px] text-grey-500">None of your students have started a mock exam yet.</p>;

  return (
    <table className="w-full text-left text-[13px]">
      <thead>
        <tr className="text-[12px] text-grey-500">
          <th className="py-1">Student</th>
          <th>Exam set</th>
          <th>Status</th>
          <th>Started</th>
          <th>Correct</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.attemptId} className="border-t border-grey-100">
            <td className="py-1.5">{r.studentName ?? r.studentId}</td>
            <td>{r.examSetName}</td>
            <td>{STATUS_LABEL[r.status] ?? r.status}</td>
            <td>{r.startedAt ? fmtDate(r.startedAt, undefined, tz) : "-"}</td>
            <td>{r.correctCount !== null ? `${r.correctCount}/${r.totalCount}` : "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
