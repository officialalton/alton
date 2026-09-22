"use client";

import { useCallback, useEffect, useState } from "react";
import MockExamAssignPanel from "./MockExamAssignPanel";
import TeacherMockExamAttemptViewer from "./TeacherMockExamAttemptViewer";
import MockExamSetContentViewer from "@/app/components/MockExamSetContentViewer";
import {
  loadTeacherMockExamTabDataAction,
  getMockExamSetContentForTeacherAction,
  getMockExamAttemptDetailForTeacherAction,
  listMyAssignedMockExamAttemptsAction,
  type TeacherMockExamTabData,
  type TeacherAssignedMockExamRow,
} from "./mock-exam-tab-actions";
import type { MockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import type { MockExamSetContentItem } from "@/lib/mock-exam/set-content";

const SUB_TABS = ["배정", "현황", "열람", "내역"] as const;
type SubTab = (typeof SUB_TABS)[number];
const STATUS_LABEL: Record<string, string> = { assigned: "시작 전", in_progress: "진행 중", submitted: "채점 중", graded: "채점 완료" };

// 2026-09-21(UAT 지적) — 모의고사는 TeacherShell 탭 안에서 동작한다(좌측 네비게이션 유지).
// 배정/현황/열람/내역 4개 서브탭으로 재구성 — 배정만 있던 기존 화면에 (1) 담당 학생 풀이
// 현황·채점 결과·통계를 보고 실제로 어떻게 풀었는지 읽기 전용으로 들어가 보는 "현황",
// (2) 공개된 모의고사 문항을 미리 읽기 전용으로 보는 "열람", (3) 배정 내역을 더했다.
export default function TeacherMockExamTab() {
  const [subTab, setSubTab] = useState<SubTab>("배정");
  const [data, setData] = useState<TeacherMockExamTabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    loadTeacherMockExamTabDataAction()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "모의고사 배정 정보를 불러오지 못했습니다."));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (error) return <p className="text-[13px] text-red">{error}</p>;
  if (!data) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;

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

      {subTab === "배정" &&
        (data.students.length === 0 ? (
          <p className="text-[13px] text-grey-500">담당 학생이 없습니다.</p>
        ) : data.examSets.length === 0 ? (
          <p className="text-[13px] text-grey-500">공개된 시험 세트가 없습니다.</p>
        ) : (
          <MockExamAssignPanel students={data.students} examSets={data.examSets} attemptsByStudent={data.attemptsByStudent} onChanged={reload} />
        ))}
      {subTab === "현황" && <StatusSubTab data={data} />}
      {subTab === "열람" && <BrowseSubTab examSets={data.examSets} />}
      {subTab === "내역" && <HistorySubTab />}
    </div>
  );
}

function StatusSubTab({ data }: { data: TeacherMockExamTabData }) {
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<MockExamAttemptDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const allAttempts = data.students.flatMap((s) => data.attemptsByStudent[s.studentId] ?? []);
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
      .catch((e) => setLoadError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }

  if (selectedAttemptId) {
    return (
      <div>
        <button type="button" onClick={() => setSelectedAttemptId(null)} className="mb-3 text-[12px] font-semibold text-grey-500">
          ← 현황으로
        </button>
        {loadError ? (
          <p className="text-[13px] text-red">{loadError}</p>
        ) : !attempt ? (
          <p className="text-[13px] text-grey-500">불러오는 중…</p>
        ) : (
          <TeacherMockExamAttemptViewer attempt={attempt} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-grey-200 bg-white p-4">
        <p className="text-[12px] font-bold text-grey-500">통계</p>
        <p className="mt-1 text-[13px]">
          전체 배정 {allAttempts.length}건 · 채점 완료 {graded.length}건
          {avgPct !== null && ` · 평균 정답률 ${avgPct}%`}
        </p>
      </div>
      {data.students.map((s) => {
        const attempts = data.attemptsByStudent[s.studentId] ?? [];
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
                      <span className="ml-1.5 text-[11px] font-bold text-amber-600" title="응시 중 화면을 나갔다가 다시 들어온 횟수">
                        · 재입장 {a.entryCount}회
                      </span>
                    )}
                  </span>
                  {a.status !== "assigned" && (
                    <button type="button" onClick={() => openAttempt(a.id)} className="text-[12px] font-bold text-ink underline">
                      풀이 보기
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
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }

  if (selectedId) {
    return (
      <div>
        <button type="button" onClick={() => setSelectedId(null)} className="mb-3 text-[12px] font-semibold text-grey-500">
          ← 목록으로
        </button>
        {error ? <p className="text-[13px] text-red">{error}</p> : !items ? <p className="text-[13px] text-grey-500">불러오는 중…</p> : <MockExamSetContentViewer items={items} />}
      </div>
    );
  }

  if (examSets.length === 0) return <p className="text-[13px] text-grey-500">공개된 모의고사가 없습니다.</p>;

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
  const [rows, setRows] = useState<TeacherAssignedMockExamRow[] | null>(null);

  useEffect(() => {
    listMyAssignedMockExamAttemptsAction().then(setRows);
  }, []);

  if (rows === null) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;
  if (rows.length === 0) return <p className="text-[13px] text-grey-500">배정한 모의고사가 없습니다.</p>;

  return (
    <table className="w-full text-left text-[13px]">
      <thead>
        <tr className="text-[12px] text-grey-500">
          <th className="py-1">학생</th>
          <th>세트</th>
          <th>상태</th>
          <th>마감</th>
          <th>정답</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.attemptId} className="border-t border-grey-100">
            <td className="py-1.5">{r.studentName ?? r.studentId}</td>
            <td>{r.examSetName}</td>
            <td>{STATUS_LABEL[r.status] ?? r.status}</td>
            <td>{r.dueAt ? new Date(r.dueAt).toLocaleDateString("ko-KR") : "-"}</td>
            <td>{r.correctCount !== null ? `${r.correctCount}/${r.totalCount}` : "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
