"use client";

import Link from "next/link";
import type { BoardCard } from "@/lib/board/types";
import { formatDueRange } from "./BoardColumnsView";

// 2026-09-22(사용자 지시) — Due Date를 기간으로 입력할 수 있게 된 김에,
// 보드 아래에 타임라인뷰도 추가. 마감일이 있는 카드를 월별로 묶어 시간순으로
// 보여준다(학생·학부모 공유, disableLinks로 학부모 포털은 링크 없이).
export default function TimelineView({
  cards,
  disableLinks,
}: {
  cards: BoardCard[];
  disableLinks?: boolean;
}) {
  const withDate = cards
    .filter((c) => c.dueAt)
    .sort((a, b) => (a.dueAt! < b.dueAt! ? -1 : a.dueAt! > b.dueAt! ? 1 : 0));
  const withoutDate = cards.filter((c) => !c.dueAt);

  const groups = new Map<string, BoardCard[]>();
  for (const card of withDate) {
    const d = new Date(card.dueAt!);
    const key = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }

  if (withDate.length === 0 && withoutDate.length === 0) {
    return <p className="text-[13px] text-grey-400">표시할 항목이 없습니다.</p>;
  }

  return (
    <div>
      {[...groups.entries()].map(([month, monthCards]) => (
        <div key={month} className="mb-6">
          <div className="text-[12px] font-extrabold text-grey-400 mb-2">{month}</div>
          <div className="relative pl-4 border-l-2 border-grey-200 space-y-3">
            {monthCards.map((card) => (
              <TimelineRow key={card.id} card={card} disableLinks={disableLinks} />
            ))}
          </div>
        </div>
      ))}
      {withoutDate.length > 0 && (
        <div>
          <div className="text-[12px] font-extrabold text-grey-400 mb-2">기한 미정</div>
          <div className="relative pl-4 border-l-2 border-grey-200 space-y-3">
            {withoutDate.map((card) => (
              <TimelineRow key={card.id} card={card} disableLinks={disableLinks} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ card, disableLinks }: { card: BoardCard; disableLinks?: boolean }) {
  const body = (
    <div className="rounded-lg border-[1.5px] border-grey-200 px-3 py-2 hover:border-grey-300 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-bold text-ink">{card.title}</div>
        <div className="text-[11px] font-bold text-grey-400 whitespace-nowrap">
          {formatDueRange(card.dueAt, card.dueStartAt)}
        </div>
      </div>
      {card.subtitle && <div className="text-[11.5px] text-grey-500 mt-0.5">{card.subtitle}</div>}
      <div className="text-[10.5px] text-grey-300 mt-1">{card.createdByLabel}</div>
    </div>
  );

  return (
    <div className="relative">
      <div className="absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full bg-ink" />
      {!disableLinks && card.href ? (
        <Link href={card.href}>{body}</Link>
      ) : (
        body
      )}
    </div>
  );
}
