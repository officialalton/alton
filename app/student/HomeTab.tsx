"use client";

import { useEffect, useState } from "react";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import BoardColumnsView from "@/app/components/BoardColumnsView";
import DoneListView from "@/app/components/DoneListView";
import { StatsWidget } from "./HomeDashboard";
import PlannerOverviewView from "./PlannerOverviewView";
import type { DashboardData } from "./dashboard-data";
import {
  loadMyBoardCardsAction,
  createMyManualTaskAction,
  updateMyManualTaskStatusAction,
  deleteMyManualTaskAction,
} from "./board-actions";
import { boardColumnOf, type BoardCard } from "@/lib/board/types";

// Home+Planner 통합(2026-09-22 사용자 지시, 재정리) — Home은 이제 Planner
// (Board)다. 캘린더·예정 수업(기존 Home 화면)은 Classes 탭의 "수업 일정"
// 서브탭으로 옮겼다(통계는 그대로 여기 Overview에 남는다). 서브탭:
// Overview(완료율·수업 참여율 요약) / TODO(할 일 보드, 완료 제외) /
// Done(완료한 항목 — 예전 "일정" 탭 자리, 날짜별로 묶지 않고 단순 목록).
export default function HomeTab({
  studentName,
  dashboard,
}: {
  studentName: string;
  dashboard: DashboardData;
}) {
  const [subtab, setSubtab] = useState<"overview" | "todo" | "done">("overview");
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
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
      const card = await createMyManualTaskAction(title);
      setCards((prev) => (prev ? [card, ...prev] : [card]));
      setNewTitle("");
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

  const nowIso = new Date().toISOString();
  const doneCards = cards?.filter((c) => boardColumnOf(c, nowIso) === "done") ?? [];

  return (
    <div className="px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-4">{studentName}의 학습 현황</h1>
      <UnderlineSubTabs
        className="mb-5"
        items={[
          { id: "overview", label: "Overview" },
          { id: "todo", label: "TODO" },
          { id: "done", label: "Done" },
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
            className="flex gap-2 mb-5"
            onSubmit={(e) => {
              e.preventDefault();
              void handleAddTask();
            }}
          >
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="+ 할 일 추가"
              className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
            />
            <button
              type="submit"
              disabled={adding || !newTitle.trim()}
              className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50"
            >
              추가
            </button>
          </form>
          <BoardColumnsView
            cards={cards.filter((c) => boardColumnOf(c, nowIso) !== "done")}
            onMove={handleMoveTask}
            onDelete={handleDeleteTask}
            columns={["overdue", "backlog", "in_progress"]}
          />
        </div>
      ) : (
        <DoneListView cards={doneCards} />
      )}
    </div>
  );
}
