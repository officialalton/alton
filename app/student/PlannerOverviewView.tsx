"use client";

import { useEffect, useState } from "react";
import { loadMyBoardCardsAction } from "./board-actions";
import { boardColumnOf, type BoardCard, type BoardColumn } from "@/lib/board/types";

const COLUMN_LABEL: Record<BoardColumn, string> = {
  overdue: "기한 경과",
  backlog: "백로그",
  in_progress: "진행중",
  done: "완료",
};

const SOURCE_LABEL: Record<BoardCard["sourceType"], string> = {
  homework: "과제",
  mock_exam: "모의고사",
  vocab_quiz: "단어시험",
  manual: "할 일",
};

// Student Success Planner — Overview 탭(2026-09-21 승인 계획의 일부, 1차 버전).
// 지금 가진 카드만으로 계산할 수 있는 요약(칼럼별·소스별 개수, 완료율)만
// 보여준다 — 점수·리뷰 등 다른 데이터 소스 연동은 다음 라운드.
export default function PlannerOverviewView({ cards: cardsProp }: { cards?: BoardCard[] } = {}) {
  const [cards, setCards] = useState<BoardCard[] | null>(cardsProp ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 2026-09-22(Home+Planner 통합) — 호출부(HomeTab)가 이미 보드 카드를 갖고
    // 있으면(cardsProp) 다시 조회하지 않는다.
    if (cardsProp) return;
    loadMyBoardCardsAction()
      .then(setCards)
      .catch((e) => setError(e instanceof Error ? e.message : "요약을 불러오지 못했습니다."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="text-[13px] text-red">{error}</p>;
  if (cards === null) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;

  const nowIso = new Date().toISOString();
  const columnCounts: Record<BoardColumn, number> = { overdue: 0, backlog: 0, in_progress: 0, done: 0 };
  const sourceCounts: Record<BoardCard["sourceType"], number> = { homework: 0, mock_exam: 0, vocab_quiz: 0, manual: 0 };
  for (const card of cards) {
    columnCounts[boardColumnOf(card, nowIso)]++;
    sourceCounts[card.sourceType]++;
  }
  const total = cards.length;
  const completionRate = total === 0 ? null : Math.round((columnCounts.done / total) * 100);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(Object.keys(COLUMN_LABEL) as BoardColumn[]).map((col) => (
          <div key={col} className="bg-grey-100 rounded-xl px-4 py-3">
            <div className="text-[11px] font-bold text-grey-500">{COLUMN_LABEL[col]}</div>
            <div className="text-[22px] font-extrabold text-ink mt-1">{columnCounts[col]}</div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <div className="text-[12px] font-bold text-grey-500 mb-1">전체 완료율</div>
        <div className="text-[20px] font-extrabold text-ink">
          {completionRate === null ? "—" : `${completionRate}%`}
          <span className="text-[12px] font-semibold text-grey-400 ml-2">
            ({columnCounts.done}/{total})
          </span>
        </div>
      </div>

      <div>
        <div className="text-[12px] font-bold text-grey-500 mb-2">종류별 항목 수</div>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(SOURCE_LABEL) as BoardCard["sourceType"][]).map((src) => (
            <div key={src} className="flex items-center justify-between text-[13px] border-b border-grey-100 py-1.5">
              <span className="text-grey-600">{SOURCE_LABEL[src]}</span>
              <span className="font-bold text-ink">{sourceCounts[src]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
