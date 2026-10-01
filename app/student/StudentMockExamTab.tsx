"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MockExamAttemptDetail, MockExamOverview } from "@/lib/mock-exam/attempt-data";
import { buildMockExamListRows, type MockExamListRow } from "@/lib/mock-exam/open-list";
import { startMockExamAction } from "@/lib/mock-exam/attempt-actions";
import MockExamOpenList from "@/app/components/MockExamOpenList";
import { loadMyMockExamOverviewAction, loadMockExamAttemptDetailAction } from "./mock-exam-tab-actions";
import MockExamResultView from "./mock-exam/[attemptId]/MockExamResultView";

// 2026-09-21(UAT 지적) — 모의고사 목록·결과는 독립 라우트가 아니라 StudentShell 의 탭 안에서 왼쪽
// 네비게이션을 유지한 채 본다. 실제로 시험을 보는 화면(타이머 있는 화면)만 /student/mock-exam/[attemptId].
// 2026-10-01 — 배정 폐지: 공개된 세트는 모든 활성 학생에게 보이고, '시작'을 눌러야 응시가 생긴다.
export default function StudentMockExamTab({ initialOverview }: { initialOverview?: MockExamOverview }) {
  const router = useRouter();
  const [overview, setOverview] = useState<MockExamOverview | null>(initialOverview ?? null);
  const [error, setError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MockExamAttemptDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (initialOverview) return;
    let cancelled = false;
    loadMyMockExamOverviewAction()
      .then((o) => {
        if (!cancelled) setOverview(o);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "모의고사 목록을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => (overview ? buildMockExamListRows(overview.catalog, overview.attempts) : []), [overview]);

  async function start(row: MockExamListRow) {
    setBusyKey(row.key);
    setStartError(null);
    const r = await startMockExamAction(row.examSetId);
    if (!r.ok) {
      setBusyKey(null);
      setStartError(r.error);
      return;
    }
    router.push(`/student/mock-exam/${r.value.attemptId}`);
  }

  function openResult(id: string) {
    setOpenId(id);
    setDetail(null);
    setDetailError(null);
    loadMockExamAttemptDetailAction(id)
      .then((d) => setDetail(d))
      .catch((e) => setDetailError(e instanceof Error ? e.message : "결과를 불러오지 못했습니다."));
  }

  if (error) return <p className="text-[13px] text-red">{error}</p>;
  if (overview === null) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;

  if (openId) {
    return (
      <div>
        <button type="button" onClick={() => setOpenId(null)} className="mb-3 text-[12px] font-semibold text-grey-500">
          ← 모의고사 목록으로
        </button>
        {detailError ? (
          <p className="text-[13px] text-red">{detailError}</p>
        ) : !detail ? (
          <p className="text-[13px] text-grey-500">불러오는 중…</p>
        ) : (
          <MockExamResultView attempt={detail} readOnly={false} />
        )}
      </div>
    );
  }

  return (
    <div>
      {startError && (
        <p role="alert" className="mb-2 text-[13px] text-red">
          {startError}
        </p>
      )}
      <MockExamOpenList rows={rows} readOnly={false} busyKey={busyKey} onStart={start} onOpenResult={openResult} />
    </div>
  );
}
