"use client";

import { useEffect, useState } from "react";
import {
  loadMyBoardCardsAction,
  createMyManualTaskAction,
  updateMyManualTaskStatusAction,
  deleteMyManualTaskAction,
} from "./board-actions";
import type { BoardCard } from "@/lib/board/types";
import BoardColumnsView from "@/app/components/BoardColumnsView";

// Student Success Planner — Board(할 일 관리) MVP(2026-09-21 승인).
// 4개 고정 칼럼(기한 경과/백로그/진행중/완료) 렌더링은 BoardColumnsView(학생·
// 학부모 포털 공유)가 맡는다. 이 컴포넌트는 데이터 로딩과 수동 할 일 CRUD만.

export default function BoardTab() {
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

  if (error) return <p className="text-[13px] text-red">{error}</p>;
  if (cards === null) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;

  return (
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

      <BoardColumnsView cards={cards} onMove={handleMoveTask} onDelete={handleDeleteTask} />
    </div>
  );
}
