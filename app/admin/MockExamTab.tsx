"use client";

import { useEffect, useState } from "react";
import { listMockExamSets, type MockExamSetSummary } from "./mock-exam-actions";
import MockExamSetsPanel from "./mock-exam/MockExamSetsPanel";

// 2026-09-22(성능 전수 점검) — "탭 전환은 서버 컴포넌트를 다시 못 탄다"는
// 이전 가정은 실제로는 틀렸다(admin/page.tsx의 P1-3 주석 — 탭 전환은 이미
// ?tab= 쿼리로 이 서버 컴포넌트를 다시 타는 RSC 왕복이다. catalog·booking·
// consult 등 다른 탭은 전부 이 방식으로 SSR 시딩된다). initialSets가 있으면
// (=admin/page.tsx의 need("mock-exam") 배치가 이미 받아 둔 경우) 마운트 시
// 재조회를 건너뛴다.
export default function MockExamTab({ initialSets }: { initialSets?: MockExamSetSummary[] }) {
  const [sets, setSets] = useState<MockExamSetSummary[] | null>(initialSets ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSets) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <p className="mt-1 text-sm text-grey-500">문제은행의 공개 문항만으로 영역·난이도 비중에 맞춘 고정형 세트를 조립·검토·공개합니다.</p>
      {error && <p className="mt-4 text-sm text-red">{error}</p>}
      {!error && sets === null && <p className="mt-4 text-sm text-grey-500">불러오는 중…</p>}
      {sets !== null && <MockExamSetsPanel initialSets={sets} />}
    </div>
  );
}
