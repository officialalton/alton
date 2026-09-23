"use client";

import Link from "next/link";
import type { BoardCard } from "@/lib/board/types";

// 2026-09-22(사용자 지시, 재작업) — "이거 말한거야" 스크린샷(Notion 타임라인)처럼
// 실제 간트 형태로 다시 만든다: 왼쪽에 제목 목록, 오른쪽에 날짜 눈금 + 기간 막대.
// 마감일 없는 카드는 위쪽 "기한 없음" 구획에 막대 없이 따로 보여준다.
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 28;
const PAD_DAYS = 3;

function startOfDay(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / DAY_MS);
}

export default function TimelineView({
  cards,
  disableLinks,
}: {
  cards: BoardCard[];
  disableLinks?: boolean;
}) {
  const dated = cards.filter((c) => c.dueAt);
  const undated = cards.filter((c) => !c.dueAt);

  if (dated.length === 0) {
    return (
      <div>
        {undated.length === 0 ? (
          <p className="text-[13px] text-grey-400">표시할 항목이 없습니다.</p>
        ) : (
          <UndatedSection cards={undated} disableLinks={disableLinks} />
        )}
      </div>
    );
  }

  const startsMs = dated.map((c) => startOfDay(c.dueStartAt ?? c.dueAt!));
  const endsMs = dated.map((c) => startOfDay(c.dueAt!));
  const rangeStart = Math.min(...startsMs) - PAD_DAYS * DAY_MS;
  const rangeEnd = Math.max(...endsMs) + PAD_DAYS * DAY_MS;
  const totalDays = daysBetween(rangeStart, rangeEnd) + 1;
  const totalWidth = totalDays * DAY_WIDTH;

  const ticks: { left: number; label: string }[] = [];
  for (let i = 0; i < totalDays; i += 7) {
    const d = new Date(rangeStart + i * DAY_MS);
    ticks.push({ left: i * DAY_WIDTH, label: d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) });
  }

  const todayMs = startOfDay(new Date().toISOString());
  const todayLeft = todayMs >= rangeStart && todayMs <= rangeEnd ? daysBetween(rangeStart, todayMs) * DAY_WIDTH : null;

  const rows = [...dated].sort((a, b) => startOfDay(a.dueStartAt ?? a.dueAt!) - startOfDay(b.dueStartAt ?? b.dueAt!));

  return (
    <div>
      {undated.length > 0 && <UndatedSection cards={undated} disableLinks={disableLinks} />}
      <div className="flex border-[1.5px] border-grey-200 rounded-xl overflow-hidden">
        <div className="w-[180px] shrink-0 border-r-[1.5px] border-grey-200">
          <div className="h-9 border-b border-grey-100" />
          {rows.map((card) => (
            <div key={card.id} className="h-11 flex items-center px-3 border-b border-grey-100 last:border-b-0">
              <span className="text-[12.5px] font-bold text-ink truncate">{card.title}</span>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto flex-1">
          <div style={{ width: totalWidth, position: "relative" }}>
            <div className="h-9 border-b border-grey-100 relative">
              {ticks.map((t) => (
                <div key={t.left} className="absolute top-0 h-full flex items-center" style={{ left: t.left }}>
                  <div className="w-px h-full bg-grey-100 mr-1.5" />
                  <span className="text-[10.5px] text-grey-400 whitespace-nowrap">{t.label}</span>
                </div>
              ))}
              {todayLeft !== null && <div className="absolute top-0 bottom-0 w-px bg-red" style={{ left: todayLeft }} />}
            </div>
            <div style={{ position: "relative" }}>
              {todayLeft !== null && (
                <div className="absolute top-0 bottom-0 w-px bg-red/40" style={{ left: todayLeft, height: rows.length * 44 }} />
              )}
              {rows.map((card) => (
                <GanttRow key={card.id} card={card} rangeStart={rangeStart} todayMs={todayMs} disableLinks={disableLinks} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GanttRow({
  card,
  rangeStart,
  todayMs,
  disableLinks,
}: {
  card: BoardCard;
  rangeStart: number;
  todayMs: number;
  disableLinks?: boolean;
}) {
  const startMs = startOfDay(card.dueStartAt ?? card.dueAt!);
  const endMs = startOfDay(card.dueAt!);
  const left = daysBetween(rangeStart, startMs) * DAY_WIDTH;
  const width = (daysBetween(startMs, endMs) + 1) * DAY_WIDTH;
  const isOverdue = card.status !== "done" && endMs < todayMs;

  const bar = (
    <div
      className={
        "absolute top-2 h-7 rounded-md px-2 flex items-center text-[11px] font-bold text-white truncate " +
        (card.status === "done" ? "bg-grey-300" : isOverdue ? "bg-red" : "bg-ink") +
        (disableLinks || !card.href ? "" : " hover:opacity-80 cursor-pointer")
      }
      style={{ left, width: Math.max(width, DAY_WIDTH) }}
      title={card.title}
    >
      {card.title}
    </div>
  );

  return (
    <div className="h-11 border-b border-grey-100 last:border-b-0 relative">
      {!disableLinks && card.href ? <Link href={card.href}>{bar}</Link> : bar}
    </div>
  );
}

function UndatedSection({ cards, disableLinks }: { cards: BoardCard[]; disableLinks?: boolean }) {
  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold text-grey-400 mb-1.5">기한 없음 ({cards.length})</div>
      <div className="flex flex-wrap gap-1.5">
        {cards.map((card) => {
          const chip = (
            <div className="text-[11.5px] font-semibold text-grey-600 bg-grey-100 rounded-full px-3 py-1 truncate max-w-[220px]">
              {card.title}
            </div>
          );
          return !disableLinks && card.href ? (
            <Link key={card.id} href={card.href}>
              {chip}
            </Link>
          ) : (
            <div key={card.id}>{chip}</div>
          );
        })}
      </div>
    </div>
  );
}
