"use client";

import { useState } from "react";
import type { ParentChildHomework } from "./homework-data";
import HomeworkBatchPanel from "@/app/components/HomeworkBatchPanel";

// 2026-09-16(제품 오너 지시) — 보호자 과제 화면도 학생 포털과 완전히 같은 UI를 쓰되 읽기 전용으로만
// 한다(제출·채점 버튼 없음). HomeworkBatchPanel을 그대로 재사용한다.
export default function ParentHomeworkTab({ childrenHomework }: { childrenHomework: ParentChildHomework[] }) {
  const [childId, setChildId] = useState(childrenHomework[0]?.childId ?? "");
  const current = childrenHomework.find((c) => c.childId === childId) ?? childrenHomework[0];

  if (!current) return <div className="max-w-[760px] px-8 py-8 text-[13px] text-grey-500">연결된 자녀가 없습니다.</div>;

  return (
    <div className="max-w-[760px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">과제</h1>
      <p className="text-[13px] text-grey-500 mb-4">자녀의 과제를 읽기 전용으로 볼 수 있습니다.</p>
      {childrenHomework.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {childrenHomework.map((c) => (
            <button
              key={c.childId}
              onClick={() => setChildId(c.childId)}
              className={"text-[12.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (c.childId === current.childId ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
            >
              {c.childName}
            </button>
          ))}
        </div>
      )}
      <HomeworkBatchPanel batches={current.batches} viewerRole="student" readOnly />
    </div>
  );
}
