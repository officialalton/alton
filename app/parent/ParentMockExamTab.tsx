"use client";

import { useEffect, useMemo, useState } from "react";
import type { MockExamOverview } from "@/lib/mock-exam/attempt-data";
import { buildMockExamListRows } from "@/lib/mock-exam/open-list";
import MockExamOpenList from "@/app/components/MockExamOpenList";
import { loadChildMockExamOverviewAction } from "./mock-exam-tab-actions";

// 2026-10-01 — 배정 폐지: 학부모는 공개된 모의고사 목록과 자녀의 시작·완료 상태를 읽기 전용으로 본다(시작 불가).
// 상세 결과만 기존 라우트로 연다.
export default function ParentMockExamTab({ studentId }: { studentId: string | null }) {
  const [overview, setOverview] = useState<MockExamOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    setOverview(null);
    loadChildMockExamOverviewAction(studentId)
      .then((o) => {
        if (!cancelled) setOverview(o);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the mock exam list.");
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const rows = useMemo(() => (overview ? buildMockExamListRows(overview.catalog, overview.attempts) : []), [overview]);

  if (!studentId) return <p className="p-8 text-[14px] text-grey-500">Please select a child first.</p>;
  if (error) return <p className="p-8 text-[14px] text-red">{error}</p>;
  if (overview === null) return <p className="p-8 text-[14px] text-grey-500">Loading...</p>;

  return (
    <div className="px-6 py-5">
      <MockExamOpenList rows={rows} readOnly resultHref={(attemptId) => `/parent/mock-exam/${studentId}/${attemptId}`} />
    </div>
  );
}
