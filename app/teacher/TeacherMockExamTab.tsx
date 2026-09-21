"use client";

import { useCallback, useEffect, useState } from "react";
import MockExamAssignPanel from "./MockExamAssignPanel";
import { loadTeacherMockExamTabDataAction, type TeacherMockExamTabData } from "./mock-exam-tab-actions";

// 2026-09-21(UAT 지적) — 모의고사 배정은 독립 라우트(/teacher/mock-exam)가 아니라 TeacherShell 탭 안에서
// 동작한다(좌측 네비게이션 유지). 배정·채점 확정 뒤에는 목록을 다시 읽어 즉시 반영한다.
export default function TeacherMockExamTab() {
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
  if (data.students.length === 0) return <p className="text-[13px] text-grey-500">담당 학생이 없습니다.</p>;
  if (data.examSets.length === 0) return <p className="text-[13px] text-grey-500">공개된 시험 세트가 없습니다.</p>;

  return <MockExamAssignPanel students={data.students} examSets={data.examSets} attemptsByStudent={data.attemptsByStudent} onChanged={reload} />;
}
