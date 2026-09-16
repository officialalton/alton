"use client";

import { useState } from "react";
import type { ParentChildVocab } from "./vocab-data";

/** 보호자 — 자녀 단어장·시험 이력 읽기 전용. 응시·CRUD 버튼이 전혀 없다(정책: 보호자는 읽기만). */
export default function ParentVocabTab({ childrenVocab }: { childrenVocab: ParentChildVocab[] }) {
  const [childId, setChildId] = useState(childrenVocab[0]?.childId ?? "");
  const current = childrenVocab.find((c) => c.childId === childId) ?? childrenVocab[0];

  if (!current) return <div className="max-w-[720px] px-8 py-8 text-[13px] text-grey-500">연결된 자녀가 없습니다.</div>;

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">단어장</h1>
      <p className="text-[13px] text-grey-500 mb-5">자녀의 단어장과 시험 이력을 읽기 전용으로 볼 수 있습니다.</p>

      {childrenVocab.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {childrenVocab.map((c) => (
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

      {(() => {
        const defaultFolder = current.folders.find((f) => f.isDefault);
        const wrongWords = defaultFolder ? current.myWords.filter((w) => w.folderId === defaultFolder.id) : [];
        if (wrongWords.length === 0) return null;
        return (
          <div className="border-[1.5px] border-red rounded-xl px-4 py-3.5 mb-5 bg-red-bg">
            <p className="text-[13px] font-bold text-ink mb-1">오답 노트 {wrongWords.length}개</p>
            <div className="flex flex-wrap gap-1.5">
              {wrongWords.slice(0, 15).map((w) => (
                <span key={w.id} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-white text-red border border-red">{w.word}</span>
              ))}
              {wrongWords.length > 15 && <span className="text-[11px] text-grey-500">외 {wrongWords.length - 15}개</span>}
            </div>
          </div>
        );
      })()}

      <p className="text-[12px] font-bold text-grey-500 mb-2">내 단어장 ({current.myWords.length})</p>
      {current.myWords.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-6">아직 저장한 단어가 없습니다.</div>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {current.myWords.map((w) => (
            <span key={w.id} className="text-[12px] font-semibold px-2.5 py-1 rounded-lg bg-grey-100 text-ink" title={w.definition ?? ""}>{w.word}</span>
          ))}
        </div>
      )}

      <p className="text-[12px] font-bold text-grey-500 mb-2">시험 이력</p>
      {current.quizzes.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">아직 본 시험이 없습니다.</div>
      ) : (
        current.quizzes.map((q) => (
          <div key={q.id} className="border border-grey-200 rounded-xl px-4 py-3 mb-2 flex items-center justify-between">
            <span className="text-[13px] text-ink">
              {q.wordCount}문항 {q.assignedByTeacher && <span className="text-[11px] text-grey-500">(선생님이 냄)</span>}
            </span>
            <span className="text-[12.5px] font-bold text-ink">
              {q.status === "completed" ? `${q.score}/${q.total}점` : "응시 대기"}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
