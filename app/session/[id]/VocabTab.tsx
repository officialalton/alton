"use client";

import { useState } from "react";
import { removeVocabWord } from "./vocab-actions";
import type { VocabEntry } from "./vocab-data";

export default function VocabTab({
  initialWords,
  isTeacher,
  canManage,
  studentName,
}: {
  initialWords: VocabEntry[];
  isTeacher: boolean;
  canManage: boolean;
  studentName: string;
}) {
  const [words, setWords] = useState(initialWords);

  async function handleRemove(id: string) {
    setWords((prev) => prev.filter((w) => w.id !== id));
    await removeVocabWord(id);
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
        {isTeacher ? `${studentName} 학생의 단어장` : "단어장"}
      </h1>
      <p className="text-[13px] text-grey-500 mb-5">
        {isTeacher
          ? "학생이 교재에서 저장한 단어들입니다. 선생님도 여기서 함께 확인할 수 있습니다."
          : "교재를 읽다가 모르는 단어를 클릭하면 단어장에 추가할 수 있습니다. AI가 자동으로 뜻·예문·비슷한 단어를 정리해줍니다."}
      </p>

      {words.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          아직 저장한 단어가 없습니다. 교재에서 모르는 단어를 클릭해보세요.
        </div>
      ) : (
        words.map((v) => (
          <div
            key={v.id}
            className="border border-grey-200 rounded-xl px-4 py-3.5 mb-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-ink">{v.word}</h3>
              {canManage && (
                <button
                  onClick={() => handleRemove(v.id)}
                  className="text-[12px] font-semibold text-red"
                >
                  삭제
                </button>
              )}
            </div>
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-2.5">
              뜻
            </div>
            <div className="text-[13px] text-ink">{v.definition}</div>
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-2">
              예문
            </div>
            <div className="text-[13px] text-ink">{v.example}</div>
            {v.similarWords && v.similarWords.length > 0 && (
              <>
                <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-2">
                  비슷한 단어
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {v.similarWords.map((s) => (
                    <span
                      key={s}
                      className="text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-grey-100 text-grey-500"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
