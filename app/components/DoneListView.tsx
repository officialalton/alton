"use client";

import Link from "next/link";
import type { BoardCard } from "@/lib/board/types";
import { SOURCE_LABEL, formatDueAt } from "./BoardColumnsView";

// Home+Planner 통합(2026-09-22 사용자 지시) — "Done" 서브탭. 예전 "일정"
// 탭의 자리를 그대로 쓰되, 날짜별로 묶지 않고 완료된 항목만 단순 목록으로
// 보여준다("그냥 완료 테스크들 리스트로").
export default function DoneListView({ cards, disableLinks }: { cards: BoardCard[]; disableLinks?: boolean }) {
  if (cards.length === 0) {
    return <p className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">완료한 항목이 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {cards.map((card) => {
        const dueLabel = formatDueAt(card.dueAt);
        const body = (
          <div className="flex items-center justify-between bg-white border border-grey-200 rounded-lg px-3 py-2">
            <div>
              <span className="text-[11px] font-bold text-grey-400 mr-2">{SOURCE_LABEL[card.sourceType]}</span>
              <span className="text-[13px] font-semibold text-ink">{card.title}</span>
              {card.subtitle && <span className="text-[11px] text-grey-500 ml-2">{card.subtitle}</span>}
            </div>
            {dueLabel && <span className="text-[11px] text-grey-400">마감 {dueLabel}</span>}
          </div>
        );
        return card.href && !disableLinks ? (
          <Link key={card.id} href={card.href} className="block">
            {body}
          </Link>
        ) : (
          <div key={card.id}>{body}</div>
        );
      })}
    </div>
  );
}
