"use client";

import { useEffect, useState } from "react";
import PlannerOverviewView from "@/app/student/PlannerOverviewView";
import StatsTab from "@/app/student/StatsTab";
import BoardColumnsView from "@/app/components/BoardColumnsView";
import type { StatsData } from "@/app/student/stats-data";
import type { BoardCard } from "@/lib/board/types";
import { loadStaffViewBoardCardsAction, loadStaffViewStatsAction, recordStaffStudentViewAction, type StaffViewKind } from "./staff-student-view-actions";

type View = "overview" | "board" | "stats";
const TABS: { id: View; label: string }[] = [
  { id: "overview", label: "오버뷰" },
  { id: "board", label: "보드" },
  { id: "stats", label: "통계" },
];

// 관리자 학생 프로필용 읽기 전용 오버뷰/보드/통계. 보드는 onMove/onDelete를 넘기지 않아
// 카드 이동·삭제가 UI에서 나타나지 않고, 서버 로더도 읽기만 한다.
export function useRecordStaffView(studentId: string, view: StaffViewKind | null) {
  useEffect(() => {
    if (!view) return;
    recordStaffStudentViewAction(studentId, view).catch(() => {
      // 감사 기록 실패가 열람 자체를 막지는 않는다(권한 오류는 로더가 따로 보여준다).
    });
  }, [studentId, view]);
}

export default function StaffStudentViews({ studentId }: { studentId: string }) {
  const [view, setView] = useState<View>("overview");
  useRecordStaffView(studentId, view);
  return (
    <div>
      <div role="tablist" className="flex gap-1 mb-4 border-b border-grey-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={view === t.id}
            onClick={() => setView(t.id)}
            className={
              "px-3 py-2 text-[13px] font-bold border-b-2 -mb-px " +
              (view === t.id ? "border-ink text-ink" : "border-transparent text-grey-500")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <StaffStudentViewBody key={studentId} studentId={studentId} view={view} />
    </div>
  );
}

// 컨설턴트 패널처럼 카드를 이미 갖고 있는 호출부를 위해 통계만 따로 쓸 수 있게 분리.
export function StaffStudentStats({ studentId }: { studentId: string }) {
  const [state, setState] = useState<{ data: StatsData | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    loadStaffViewStatsAction(studentId)
      .then((data) => !cancelled && setState({ data, error: null }))
      .catch((e) => !cancelled && setState({ data: null, error: e instanceof Error ? e.message : "통계를 불러오지 못했습니다." }));
    return () => {
      cancelled = true;
    };
  }, [studentId]);
  if (state.error) return <p role="alert" className="py-8 text-[13px] text-red">{state.error}</p>;
  if (!state.data) return <p className="py-8 text-[13px] text-grey-500">불러오는 중...</p>;
  return <StatsTab data={state.data} />;
}

function StaffStudentViewBody({ studentId, view }: { studentId: string; view: View }) {
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadStaffViewBoardCardsAction(studentId)
      .then((c) => !cancelled && setCards(c))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (view === "stats") return <StaffStudentStats studentId={studentId} />;
  if (error) return <p role="alert" className="py-8 text-[13px] text-red">{error}</p>;
  if (cards === null) return <p className="py-8 text-[13px] text-grey-500">불러오는 중...</p>;
  if (view === "overview") return <PlannerOverviewView cards={cards} />;
  return cards.length === 0 ? (
    <p className="py-8 text-[13px] text-grey-500">표시할 항목이 없습니다.</p>
  ) : (
    <BoardColumnsView cards={cards} disableLinks />
  );
}
