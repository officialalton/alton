"use client";

import Link from "next/link";
import { boardColumnOf, type BoardCard, type BoardCardStatus, type BoardColumn } from "@/lib/board/types";

// Student Success Planner — Board 칼럼 렌더링(학생 포털·학부모 포털 공유).
// 학생 포털은 수동 할 일에 상태 이동·삭제 버튼을 준다(onMove/onDelete 제공).
// 학부모 포털은 읽기 전용(둘 다 생략) — 부모는 만들지도, 옮기지도 않는다.

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

export default function BoardColumnsView({
  cards,
  onMove,
  onDelete,
  disableLinks,
}: {
  cards: BoardCard[];
  /** 없으면 수동 할 일도 읽기 전용으로 보여준다(학부모 포털). */
  onMove?: (cardId: string, status: BoardCardStatus) => void;
  onDelete?: (cardId: string) => void;
  /** 학부모 포털처럼 카드가 가리키는 화면(/student/...)에 접근 권한이 없을 때 —
   * 링크를 만들지 않고 텍스트만 보여준다. */
  disableLinks?: boolean;
}) {
  const nowIso = new Date().toISOString();
  const byColumn = new Map<BoardColumn, BoardCard[]>();
  for (const col of COLUMNS) byColumn.set(col.id, []);
  for (const card of cards) {
    byColumn.get(boardColumnOf(card, nowIso))?.push(card);
  }

  return (
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
                <BoardCardItem key={card.id} card={card} onMove={onMove} onDelete={onDelete} disableLinks={disableLinks} />
              ))}
              {colCards.length === 0 && <div className="text-[11px] text-grey-400">비어 있음</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BoardCardItem({
  card,
  onMove,
  onDelete,
  disableLinks,
}: {
  card: BoardCard;
  onMove?: (cardId: string, status: BoardCardStatus) => void;
  onDelete?: (cardId: string) => void;
  disableLinks?: boolean;
}) {
  const dueLabel = formatDueAt(card.dueAt);
  const editable = card.sourceType === "manual" && onMove && onDelete;
  const body = (
    <div className="bg-white rounded-lg border border-grey-200 px-3 py-2">
      <div className="text-[11px] font-bold text-grey-400 mb-0.5">{SOURCE_LABEL[card.sourceType]}</div>
      <div className="text-[13px] font-semibold text-ink">{card.title}</div>
      {card.subtitle && <div className="text-[11px] text-grey-500">{card.subtitle}</div>}
      {dueLabel && <div className="text-[11px] text-grey-500 mt-1">마감 {dueLabel}</div>}
      {editable && (
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
  return card.href && !disableLinks ? (
    <Link href={card.href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
