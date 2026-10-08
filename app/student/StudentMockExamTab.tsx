"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MockExamAttemptDetail, MockExamOverview } from "@/lib/mock-exam/attempt-data";
import { buildMockExamListRows, practiceTestTabOf, type MockExamListRow, type PracticeTestTab } from "@/lib/mock-exam/open-list";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import Pager from "@/app/components/Pager";
import { trackEvent } from "@/lib/analytics/track";
import { startMockExamAction } from "@/lib/mock-exam/attempt-actions";
import MockExamOpenList from "@/app/components/MockExamOpenList";
import { loadMyMockExamOverviewAction, loadMockExamAttemptDetailAction } from "./mock-exam-tab-actions";
import MockExamResultView from "./mock-exam/[attemptId]/MockExamResultView";

// 2026-09-21(UAT 지적) — 모의고사 목록·결과는 독립 라우트가 아니라 StudentShell 의 탭 안에서 왼쪽
// 네비게이션을 유지한 채 본다. 실제로 시험을 보는 화면(타이머 있는 화면)만 /student/mock-exam/[attemptId].
export const PRACTICE_TESTS_PAGE_SIZE = 5;
const TAB_ITEMS = [{ id: "todo", label: "To do" }, { id: "completed", label: "Completed" }] as const;

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
  const [listTab, setListTab] = useState<PracticeTestTab>("todo");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (initialOverview) return;
    let cancelled = false;
    loadMyMockExamOverviewAction()
      .then((o) => {
        if (!cancelled) setOverview(o);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load the practice test list.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => (overview ? buildMockExamListRows(overview.catalog, overview.attempts) : []), [overview]);

  const tabRows = useMemo(() => rows.filter((r) => practiceTestTabOf(r.state) === listTab), [rows, listTab]);
  const pageCount = Math.max(1, Math.ceil(tabRows.length / PRACTICE_TESTS_PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pageRows = tabRows.slice(pageSafe * PRACTICE_TESTS_PAGE_SIZE, (pageSafe + 1) * PRACTICE_TESTS_PAGE_SIZE);

  async function start(row: MockExamListRow) {
    setBusyKey(row.key);
    setStartError(null);
    const r = await startMockExamAction(row.examSetId);
    if (!r.ok) {
      setBusyKey(null);
      setStartError(r.error);
      return;
    }
    trackEvent("practice_test_started", { entry_point: "practice_tests_tab" });
    router.push(`/student/mock-exam/${r.value.attemptId}`);
  }

  function openResult(id: string) {
    setOpenId(id);
    setDetail(null);
    setDetailError(null);
    loadMockExamAttemptDetailAction(id)
      .then((d) => setDetail(d))
      .catch((e) => setDetailError(e instanceof Error ? e.message : "Couldn't load the results."));
  }

  if (error) return <p className="text-[13px] text-red">{error}</p>;
  if (overview === null) {
    return (
      <div role="status" aria-label="Loading practice tests" className="flex flex-col gap-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-grey-200 bg-white p-4"><div className="h-4 w-44 rounded bg-grey-100" /><div className="mt-2 h-3 w-28 rounded bg-grey-100" /></div>
        ))}
      </div>
    );
  }

  if (openId) {
    return (
      <div>
        <button type="button" onClick={() => setOpenId(null)} className="mb-3 text-[12px] font-semibold text-grey-500">
          ← Back to Practice Tests
        </button>
        {detailError ? (
          <p className="text-[13px] text-red">{detailError}</p>
        ) : !detail ? (
          <p className="text-[13px] text-grey-500">Loading…</p>
        ) : (
          <MockExamResultView
            attempt={detail}
            readOnly={false}
            attempts={overview.attempts.filter((a) => a.setGroupId && a.setGroupId === detail.setGroupId)}
            onSelectAttempt={openResult}
          />
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
      <UnderlineSubTabs
        items={TAB_ITEMS}
        activeId={listTab}
        onSelect={(id) => { setListTab(id); setPage(0); }}
        className="mb-3"
      />
      <MockExamOpenList
        rows={pageRows}
        readOnly={false}
        busyKey={busyKey}
        onStart={start}
        onOpenResult={openResult}
        emptyText={
          rows.length === 0
            ? "No practice tests are available yet."
            : listTab === "todo"
              ? "You're all caught up — no practice tests left to do."
              : "No completed practice tests yet."
        }
      />
      <Pager page={pageSafe} pageCount={pageCount} onPage={setPage} />
    </div>
  );
}
