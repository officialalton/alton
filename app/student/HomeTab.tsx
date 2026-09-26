"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import BoardColumnsView from "@/app/components/BoardColumnsView";
import TimelineView from "@/app/components/TimelineView";
import FamilyReviewCard from "@/app/components/FamilyReviewCard";
import { StatsWidget, UpcomingWidget } from "./HomeDashboard";
import PlannerOverviewView from "./PlannerOverviewView";
import type { DashboardData } from "./dashboard-data";
import {
  loadMyBoardCardsAction,
  createMyManualTaskAction,
  updateMyManualTaskStatusAction,
  deleteMyManualTaskAction,
} from "./board-actions";
import { getMyLessonReviewsAction } from "./review-actions";
import type { FamilyLessonReview } from "@/app/parent/lesson-review-family-actions";
import type { BoardCard } from "@/lib/board/types";

// Home+Planner 통합(2026-09-22 사용자 지시, 재정리) — Home은 이제 Planner
// (Board)다. 캘린더·예정 수업(기존 Home 화면)은 Classes 탭의 "수업 일정"
// 서브탭으로 옮겼다(통계는 그대로 여기 Overview에 남는다). 서브탭:
// Overview(완료율·수업 참여율 요약) / TODO(할 일 보드, 완료 포함 전체 4칼럼) /
// Review(학부모 포털과 동일한 수업 리뷰 — 2026-09-22 재지시로 별도 Done
// 서브탭은 없애고 보드 안에 완료 칼럼으로 되돌렸다).
export default function HomeTab({
  studentName,
  dashboard,
}: {
  studentName: string;
  dashboard: DashboardData;
}) {
  const router = useRouter();
  const [subtab, setSubtab] = useState<"overview" | "todo" | "review">("overview");
  const [boardView, setBoardView] = useState<"board" | "timeline">("board");
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDueStart, setNewDueStart] = useState("");
  const [newDueEnd, setNewDueEnd] = useState("");
  const [adding, setAdding] = useState(false);

  function reload() {
    loadMyBoardCardsAction()
      .then(setCards)
      .catch((e) => setError(e instanceof Error ? e.message : "보드를 불러오지 못했습니다."));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleAddTask() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      // 2026-09-22(사용자 지시) — 기한을 기간(시작~마감)으로도 입력할 수 있다
      // (시간 입력은 없음, 날짜만). 마감일 없이 시작일만 있는 건 성립하지
      // 않으므로 마감일이 없으면 시작일도 함께 무시한다.
      const dueAt = newDueEnd ? new Date(`${newDueEnd}T00:00:00`).toISOString() : null;
      const dueStartAt = dueAt && newDueStart ? new Date(`${newDueStart}T00:00:00`).toISOString() : null;
      const card = await createMyManualTaskAction(title, dueAt, dueStartAt);
      setCards((prev) => (prev ? [card, ...prev] : [card]));
      setNewTitle("");
      setNewDueStart("");
      setNewDueEnd("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "할 일을 추가하지 못했습니다.");
    } finally {
      setAdding(false);
    }
  }

  async function handleMoveTask(cardId: string, status: "backlog" | "in_progress" | "done") {
    setCards((prev) => prev?.map((c) => (c.id === cardId ? { ...c, status } : c)) ?? prev);
    try {
      await updateMyManualTaskStatusAction(cardId, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태를 바꾸지 못했습니다.");
      reload();
    }
  }

  async function handleDeleteTask(cardId: string) {
    setCards((prev) => prev?.filter((c) => c.id !== cardId) ?? prev);
    try {
      await deleteMyManualTaskAction(cardId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제하지 못했습니다.");
      reload();
    }
  }

  return (
    <div className="px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-4">{studentName}의 학습 현황</h1>
      <UnderlineSubTabs
        className="mb-5"
        items={[
          { id: "overview", label: "Overview" },
          { id: "todo", label: "TODO" },
          { id: "review", label: "Review" },
        ]}
        activeId={subtab}
        onSelect={setSubtab}
      />

      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}
      {cards === null ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : subtab === "overview" ? (
        <div>
          <div className="max-w-[280px] mb-6">
            <StatsWidget attendanceRate={dashboard.attendanceRate} />
          </div>
          <PlannerOverviewView cards={cards} />
        </div>
      ) : subtab === "todo" ? (
        <div>
          <form
            className="flex flex-wrap items-center gap-2 mb-5"
            onSubmit={(e) => {
              e.preventDefault();
              void handleAddTask();
            }}
          >
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="+ 할 일 추가"
              className="flex-1 min-w-[160px] border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
            />
            <input
              type="date"
              value={newDueStart}
              onChange={(e) => setNewDueStart(e.target.value)}
              title="시작일(선택)"
              className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]"
            />
            <span className="text-[13px] text-grey-400">~</span>
            <input
              type="date"
              value={newDueEnd}
              onChange={(e) => setNewDueEnd(e.target.value)}
              title="마감일(선택)"
              className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]"
            />
            <button
              type="submit"
              disabled={adding || !newTitle.trim()}
              className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50"
            >
              추가
            </button>
          </form>
          <div className="flex gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setBoardView("board")}
              className={`text-[12px] font-bold px-3 py-1.5 rounded-lg ${boardView === "board" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
            >
              보드
            </button>
            <button
              type="button"
              onClick={() => setBoardView("timeline")}
              className={`text-[12px] font-bold px-3 py-1.5 rounded-lg ${boardView === "timeline" ? "bg-ink text-white" : "bg-grey-100 text-grey-500"}`}
            >
              타임라인
            </button>
          </div>
          {boardView === "board" ? (
            <BoardColumnsView cards={cards} onMove={handleMoveTask} onDelete={handleDeleteTask} />
          ) : (
            <TimelineView cards={cards} />
          )}
          {/* 2026-09-22(사용자 지시) — 보드 아래에 예정 수업 리스트(학부모/학생 통일 컴포넌트 재사용). */}
          <div className="max-w-[420px] mt-6">
            <UpcomingWidget upcoming={dashboard.upcoming} onShowAll={() => router.push("?tab=classes", { scroll: false })} />
          </div>
        </div>
      ) : (
        <HomeReviewPanel />
      )}
    </div>
  );
}

// 2026-09-22(사용자 지시 — "학부모랑 똑같이 Review 탭 만들어줘") — 학부모 홈의
// "수업 리뷰" 섹션과 같은 구성. 상담 리뷰는 household(보호자) 단위 개념이라
// 여기엔 없다(review-actions.ts 주석 참고).
function HomeReviewPanel() {
  const [reviews, setReviews] = useState<FamilyLessonReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyLessonReviewsAction()
      .then(setReviews)
      .catch((e) => setError(e instanceof Error ? e.message : "리뷰를 불러오지 못했습니다."));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[14px] font-bold text-ink mb-1.5">월간 종합 리뷰</h2>
        <p className="text-[13px] text-grey-500">아직 생성된 월간 종합 리뷰가 없습니다. 준비 중입니다.</p>
      </div>

      <div>
        <h2 className="text-[14px] font-bold text-ink mb-3">수업 리뷰</h2>
        {error && <p className="text-[13px] text-red mb-2">{error}</p>}
        {reviews === null ? (
          <p className="text-[13px] text-grey-500">불러오는 중...</p>
        ) : reviews.filter((r) => r.meetingRecordLink).length === 0 ? (
          <p className="text-[13px] text-grey-500">확정된 미팅록이 있는 수업이 아직 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {reviews
              .filter((r) => r.meetingRecordLink)
              .sort((a, b) => (a.finalizedAt > b.finalizedAt ? 1 : -1))
              .map((r) => (
                <FamilyReviewCard key={r.reviewId} review={r} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
