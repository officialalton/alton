"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadMyBoardCardsAction,
  createMyManualTaskAction,
  updateMyManualTaskStatusAction,
  deleteMyManualTaskAction,
} from "./board-actions";
import { boardColumnOf, type BoardCard, type BoardColumn } from "@/lib/board/types";

// Student Success Planner — Board(할 일 관리) MVP(2026-09-21 승인).
// 4개 고정 칼럼: 기한 경과(파생)/백로그/진행중/완료. 과제·모의고사·단어시험
// 카드는 읽기 전용(그 화면에서 진행 상태가 바뀐다) — 클릭하면 해당 화면으로
// 이동한다. 수동 할 일만 이 화면에서 직접 만들고/옮기고/지운다.
// Schedule·Overview 탭은 다음 라운드.

const COLUMNS: { id: BoardColumn; label: string }[] = [
  { id: "overdue", label: "기한 경과" },
  { id: "backlog", label: "백로그" },
  { id: "in_progress", label: "진행중" },
  { id: "done", label: "완료" },
];

const SOURCE_LABEL: Record<BoardCard["sourceType"], string> = {
  homework: "과제",
  mock_exam: "모의고사",
  vocab_quiz: "단어시험",
  manual: "할 일",
};

function formatDueAt(dueAt: string | null): string | null {
  if (!dueAt) return null;
  return new Date(dueAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

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

  const nowIso = new Date().toISOString();
  const byColumn = new Map<BoardColumn, BoardCard[]>();
  for (const col of COLUMNS) byColumn.set(col.id, []);
  for (const card of cards) {
    const col = boardColumnOf(card, nowIso);
    byColumn.get(col)?.push(card);
  }

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const colCards = byColumn.get(col.id) ?? [];
          return (
            <div key={col.id} className="bg-grey-100 rounded-xl p-3 min-h-[120px]">
              <div className="text-[12px] font-bold text-grey-600 mb-2">
                {col.label} <span className="text-grey-400">{colCards.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {colCards.map((card) => (
                  <BoardCardItem
                    key={card.id}
                    card={card}
                    onMove={handleMoveTask}
                    onDelete={handleDeleteTask}
                  />
                ))}
                {colCards.length === 0 && <div className="text-[11px] text-grey-400">비어 있음</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardCardItem({
  card,
  onMove,
  onDelete,
}: {
  card: BoardCard;
  onMove: (cardId: string, status: "backlog" | "in_progress" | "done") => void;
  onDelete: (cardId: string) => void;
}) {
  const dueLabel = formatDueAt(card.dueAt);
  const body = (
    <div className="bg-white rounded-lg border border-grey-200 px-3 py-2">
      <div className="text-[11px] font-bold text-grey-400 mb-0.5">{SOURCE_LABEL[card.sourceType]}</div>
      <div className="text-[13px] font-semibold text-ink">{card.title}</div>
      {card.subtitle && <div className="text-[11px] text-grey-500">{card.subtitle}</div>}
      {dueLabel && <div className="text-[11px] text-grey-500 mt-1">마감 {dueLabel}</div>}
      {card.sourceType === "manual" && (
        <div className="flex items-center gap-1.5 mt-2">
          {(["backlog", "in_progress", "done"] as const)
            .filter((s) => s !== card.status)
            .map((s) => (
              <button
                key={s}
                onClick={() => onMove(card.id, s)}
                className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-2 py-0.5"
              >
                {s === "backlog" ? "백로그로" : s === "in_progress" ? "진행중으로" : "완료로"}
              </button>
            ))}
          <button onClick={() => onDelete(card.id)} className="text-[10.5px] font-bold text-red ml-auto">
            삭제
          </button>
        </div>
      )}
    </div>
  );
  return card.href ? (
    <Link href={card.href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
