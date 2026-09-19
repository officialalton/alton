"use client";

import { useEffect, useState } from "react";
import { listMockExamSets, type MockExamSetSummary } from "./mock-exam-actions";
import MockExamSetsPanel from "./mock-exam/MockExamSetsPanel";

// 2026-09-19 — AdminShell 탭 통합. 기존 /admin/mock-exam 독립 라우트는 SSR로
// 초기 목록을 내려받았지만, 탭 전환 시엔 서버 컴포넌트를 다시 못 타므로
// ProblemBankTab과 같은 패턴(클라이언트에서 마운트 시 직접 조회)으로 바꾼다.
export default function MockExamTab() {
  const [sets, setSets] = useState<MockExamSetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMockExamSets()
      .then((rows) => {
        if (!cancelled) setSets(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "모의고사 세트를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">고정형 모의고사 V1 — 세트 관리</h1>
      <p className="mt-1 text-sm text-grey-500">문제은행의 공개 문항만으로 영역·난이도 비중에 맞춘 고정형 세트를 조립·검토·공개합니다.</p>
      {error && <p className="mt-4 text-sm text-red">{error}</p>}
      {!error && sets === null && <p className="mt-4 text-sm text-grey-500">불러오는 중…</p>}
      {sets !== null && <MockExamSetsPanel initialSets={sets} />}
    </div>
  );
}
