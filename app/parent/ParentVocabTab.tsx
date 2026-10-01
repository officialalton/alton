"use client";

import { useState } from "react";
import type { ParentVocabData } from "./vocab-data";
import VocabLibraryTab from "@/app/student/VocabLibraryTab";

// 2026-09-16(제품 오너 지시) — 보호자 단어장 화면도 학생 포털과 완전히 같은 UI를 쓰되 읽기 전용으로만
// 한다. 별도의 요약 화면을 유지하지 않고 VocabLibraryTab을 그대로 재사용한다.
export default function ParentVocabTab({ data }: { data: ParentVocabData }) {
  const { children, books } = data;
  const [childId, setChildId] = useState(children[0]?.childId ?? "");
  const current = children.find((c) => c.childId === childId) ?? children[0];

  if (!current) return <div className="max-w-[760px] text-[13px] text-grey-500">연결된 자녀가 없습니다.</div>;

  return (
    <div>
      {children.length > 1 && (
        <div className="max-w-[760px] mb-4 flex flex-wrap gap-2">
          {children.map((c) => (
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
      <VocabLibraryTab myWords={current.myWords} books={books} quizzes={current.quizzes} folders={current.folders} readOnly />
    </div>
  );
}
