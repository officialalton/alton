"use client";

// M4 UAT #5 — "지난 상담" 탭: 상담 종료 처리된 건 목록 + 4가지 종료유형별 필터/통계.

import { useEffect, useState } from "react";
import {
  listClosedConsultationsAction,
  type ClosedConsultationItem,
} from "./consultation-kanban-actions";
import { CLOSURE_TYPE_LABEL, type ConsultationClosureType } from "./consultation-kanban-constants";

const card = "border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3";
const errText = "text-[12px] text-red mb-2";

const ALL_TYPES: ConsultationClosureType[] = ["no_trial", "trial_no_convert", "regular_in_progress", "contract_signed"];

export default function ClosedConsultationsSection() {
  const [items, setItems] = useState<ClosedConsultationItem[] | null>(null);
  const [counts, setCounts] = useState<Record<ConsultationClosureType, number> | null>(null);
  const [filter, setFilter] = useState<ConsultationClosureType | "all">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClosedConsultationsAction()
      .then((r) => {
        setItems(r.items);
        setCounts(r.countsByType);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "지난 상담 조회에 실패했습니다."));
  }, []);

  if (error) return <p className={errText}>{error}</p>;
  if (!items || !counts) return <p className="text-[13px] text-grey-500">불러오는 중...</p>;

  const visible = filter === "all" ? items : items.filter((i) => i.closureType === filter);

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-5" data-testid="closure-type-stats">
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            data-testid={`closure-stat-${t}`}
            onClick={() => setFilter(filter === t ? "all" : t)}
            className={
              "text-left border-[1.5px] rounded-xl px-3 py-2.5 " +
              (filter === t ? "border-ink" : "border-grey-200")
            }
          >
            <div className="text-[11px] font-bold text-grey-500">{CLOSURE_TYPE_LABEL[t]}</div>
            <div className="text-[20px] font-extrabold text-ink">{counts[t]}</div>
          </button>
        ))}
      </div>

      {filter !== "all" && (
        <button className="text-[12px] font-semibold text-blue mb-3" onClick={() => setFilter("all")}>
          전체 보기
        </button>
      )}

      {visible.length === 0 && <p className="text-[13px] text-grey-500">해당하는 지난 상담이 없습니다.</p>}

      {visible.map((i) => (
        <div key={i.id} className={card} data-testid={`closed-consultation-${i.id}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-bold text-ink">
                {i.contactName}{" "}
                <span className="text-[11px] font-semibold text-grey-500">({CLOSURE_TYPE_LABEL[i.closureType]})</span>
              </div>
              <div className="text-[12px] text-grey-500">
                {i.contactEmail} · 종료일 {new Date(i.closedAt).toLocaleString("ko-KR")}
              </div>
            </div>
          </div>
          {i.closureReviewText && (
            <p className="text-[12.5px] text-ink whitespace-pre-wrap mt-2 pt-2 border-t border-grey-200">
              {i.closureReviewText}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
