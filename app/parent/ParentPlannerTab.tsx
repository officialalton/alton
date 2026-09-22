"use client";

import { useEffect, useState } from "react";
import { loadChildBoardCardsAction } from "./board-actions";
import type { BoardCard } from "@/lib/board/types";
import BoardColumnsView from "@/app/components/BoardColumnsView";

// Student Success Planner — 학부모 홈 연동(2026-09-21 승인 계획). 읽기 전용
// 보드 — 카드 이동·수동 할 일 추가는 학생 본인만 한다. 자녀가 보는 자료 화면은
// 학부모 권한 밖이라(다른 라우트) 클릭 이동도 막는다(disableLinks).
export default function ParentPlannerTab({ studentId }: { studentId: string | null }) {
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    setCards(null);
    loadChildBoardCardsAction(studentId)
      .then((rows) => {
        if (!cancelled) setCards(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "보드를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!studentId) return <p className="p-8 text-[14px] text-grey-500">자녀를 먼저 선택하세요.</p>;
  if (error) return <p className="p-8 text-[14px] text-red">{error}</p>;
  if (cards === null) return <p className="p-8 text-[14px] text-grey-500">불러오는 중...</p>;

  return (
    <div className="px-6 py-5">
      <BoardColumnsView cards={cards} disableLinks />
    </div>
  );
}
