"use client";

import { useEffect, useState } from "react";
import BoardColumnsView from "@/app/components/BoardColumnsView";
import { loadStudentBoardCardsForTeacherAction } from "@/app/teacher/board-actions";
import type { BoardCard } from "@/lib/board/types";

// Student Success Planner — 선생님용 보드(읽기 전용, 학부모 홈 보드와 동일 UX).
export default function TeacherPlannerBoard({ studentId }: { studentId: string }) {
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStudentBoardCardsForTeacherAction(studentId)
      .then((data) => {
        if (!cancelled) setCards(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "보드를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (error) {
    return <p className="text-[13px] text-red py-6 text-center">{error}</p>;
  }
  if (cards === null) {
    return <p className="text-[13px] text-grey-500 py-6 text-center">불러오는 중...</p>;
  }
  return (
    <div className="py-4">
      <BoardColumnsView cards={cards} disableLinks />
    </div>
  );
}
