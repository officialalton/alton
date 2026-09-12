"use client";

import { useState } from "react";
import type { ConsentGapItem, CompletedConsentItem } from "./consultation-data";

// P4-3 1단계 — `신규 > 보호자 동의 대기`에서 `문서 > 동의서`로 옮기면서
// ConsultationTab.tsx의 로컬 컴포넌트를 그대로 꺼냈다. props 시그니처는
// 바꾸지 않는다(순수 표시 컴포넌트 — 데이터는 컨테이너가 넣어준다).
const card = "border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3";

export default function ConsentGapSection({ gaps, completed }: { gaps: ConsentGapItem[]; completed: CompletedConsentItem[] }) {
  const [view, setView] = useState<"pending" | "done">("pending");

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-grey-200">
        <button
          onClick={() => setView("pending")}
          className={
            "text-[12.5px] font-bold px-3 py-2 -mb-px border-b-2 " +
            (view === "pending" ? "border-ink text-ink" : "border-transparent text-grey-500")
          }
        >
          대기 ({gaps.length})
        </button>
        <button
          onClick={() => setView("done")}
          className={
            "text-[12.5px] font-bold px-3 py-2 -mb-px border-b-2 " +
            (view === "done" ? "border-ink text-ink" : "border-transparent text-grey-500")
          }
        >
          완료 ({completed.length})
        </button>
      </div>

      {view === "pending" ? (
        <>
          <p className="text-[13px] text-grey-500 mb-4">
            생년월일 미입력 또는 필수 보호자 동의가 없어 이용이 막혀 있는 학생 목록입니다.
          </p>
          {gaps.length === 0 ? (
            <p className="text-[13px] text-grey-500">막혀 있는 학생이 없습니다.</p>
          ) : (
            gaps.map((g) => (
              <div key={g.childId} className={card}>
                <div className="text-[14px] font-bold text-ink">{g.childName ?? g.childId}</div>
                <div className="text-[12px] text-grey-500">
                  {!g.hasDob && "생년월일 미입력"}
                  {!g.hasDob && !g.hasActiveConsent && " · "}
                  {!g.hasActiveConsent && "유효한 보호자 동의 없음"}
                </div>
              </div>
            ))
          )}
        </>
      ) : completed.length === 0 ? (
        <p className="text-[13px] text-grey-500">완료된 동의가 없습니다.</p>
      ) : (
        completed.map((c) => (
          <div key={c.childId} className={card}>
            <div className="text-[14px] font-bold text-ink">{c.childName ?? c.childId}</div>
            <div className="text-[12px] text-grey-500">동의 완료</div>
          </div>
        ))
      )}
    </div>
  );
}
