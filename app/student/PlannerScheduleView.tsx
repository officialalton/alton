"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadMyBoardCardsAction } from "./board-actions";
import type { BoardCard } from "@/lib/board/types";

const SOURCE_LABEL: Record<BoardCard["sourceType"], string> = {
  homework: "과제",
  mock_exam: "모의고사",
  vocab_quiz: "단어시험",
  manual: "할 일",
};

function dateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDateKey(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "UTC" });
}

// Student Success Planner — Schedule 탭(2026-09-21 승인 계획의 일부). 마감일이
// 있는 카드만 날짜순으로 묶어 보여준다. 완료된 카드는 접어 두지 않고 그대로
// 보여주되(연속성), 지난 마감은 "지남" 표시만 한다 — 별도 상태 변경은 Board에서.
export default function PlannerScheduleView() {
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMyBoardCardsAction()
      .then(setCards)
      .catch((e) => setError(e instanceof Error ? e.message : "일정을 불러오지 못했습니다."));
  }, []);

  if (error) return <p className="text-[13px] text-red">{error}</p>;
  if (cards === null) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;

  const withDue = cards.filter((c): c is BoardCard & { dueAt: string } => Boolean(c.dueAt));
  withDue.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const noDue = cards.filter((c) => !c.dueAt);

  const byDate = new Map<string, (BoardCard & { dueAt: string })[]>();
  for (const card of withDue) {
    const key = dateKey(card.dueAt);
    const list = byDate.get(key) ?? [];
    list.push(card);
    byDate.set(key, list);
  }
  const nowIso = new Date().toISOString();

  if (withDue.length === 0) {
    return <p className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">마감일이 있는 항목이 없습니다.</p>;
  }

  return (
    <div>
      {[...byDate.entries()].map(([key, dayCards]) => (
        <div key={key} className="mb-5">
          <div className="text-[12px] font-bold text-grey-500 mb-2">{formatDateKey(key)}</div>
          <div className="flex flex-col gap-1.5">
            {dayCards.map((card) => {
              const overdue = card.status !== "done" && card.dueAt < nowIso;
              const body = (
                <div className="flex items-center justify-between bg-white border border-grey-200 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-[11px] font-bold text-grey-400 mr-2">{SOURCE_LABEL[card.sourceType]}</span>
                    <span className="text-[13px] font-semibold text-ink">{card.title}</span>
                  </div>
                  {overdue && <span className="text-[11px] font-bold text-red">기한 경과</span>}
                  {card.status === "done" && <span className="text-[11px] font-bold text-grey-400">완료</span>}
                </div>
              );
              return card.href ? (
                <Link key={card.id} href={card.href} className="block">
                  {body}
                </Link>
              ) : (
                <div key={card.id}>{body}</div>
              );
            })}
          </div>
        </div>
      ))}
      {noDue.length > 0 && (
        <p className="text-[11px] text-grey-400 mt-2">마감일 없는 항목 {noDue.length}건은 보드에서 확인하세요.</p>
      )}
    </div>
  );
}
