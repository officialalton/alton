"use client";

import { useState } from "react";
import type { DocEditorData } from "./curriculum-doc-data";

const UNASSIGNED_UNIT = "(단원 미지정)";

type View =
  | { level: "subjects" }
  | { level: "units"; subjectName: string }
  | { level: "docs"; subjectName: string; unitLabel: string };

export default function MaterialsLibraryTab({ docs }: { docs: DocEditorData[] }) {
  const published = docs.filter((d) => d.status === "published");
  const [view, setView] = useState<View>({ level: "subjects" });

  const subjectNames = Array.from(new Set(published.map((d) => d.subjectName))).sort(
    (a, b) => a.localeCompare(b)
  );

  if (view.level === "subjects") {
    return (
      <div className="max-w-[640px] px-8 py-8">
        <h1 className="text-[20px] font-extrabold text-ink mb-1.5">교재 라이브러리</h1>
        <p className="text-[13px] text-grey-500 mb-5">
          과목 → 단원 → 교재 순서로 폴더처럼 탐색합니다. 교재를 클릭하면 실제
          교재 화면으로 진입합니다. 새 교재는 &quot;교재 문서&quot; 탭에서 만들어
          배포하세요.
        </p>

        {subjectNames.length === 0 ? (
          <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
            배포된 교재가 없습니다.
          </div>
        ) : (
          subjectNames.map((name) => {
            const count = published.filter((d) => d.subjectName === name).length;
            return (
              <button
                key={name}
                onClick={() => setView({ level: "units", subjectName: name })}
                className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
              >
                <span className="text-[13.5px] font-bold text-ink">📁 {name}</span>
                <span className="text-[12px] text-grey-500">{count}개 교재 ›</span>
              </button>
            );
          })
        )}
      </div>
    );
  }

  if (view.level === "units") {
    const docsInSubject = published.filter((d) => d.subjectName === view.subjectName);
    const unitLabels = Array.from(
      new Set(docsInSubject.map((d) => d.unitTitle ?? UNASSIGNED_UNIT))
    ).sort((a, b) => a.localeCompare(b));

    return (
      <div className="max-w-[640px] px-8 py-8">
        <button
          onClick={() => setView({ level: "subjects" })}
          className="text-[13px] text-grey-500 font-semibold mb-4"
        >
          ← 뒤로
        </button>
        <h1 className="text-[20px] font-extrabold text-ink mb-5">{view.subjectName}</h1>

        {unitLabels.map((label) => {
          const count = docsInSubject.filter(
            (d) => (d.unitTitle ?? UNASSIGNED_UNIT) === label
          ).length;
          return (
            <button
              key={label}
              onClick={() =>
                setView({ level: "docs", subjectName: view.subjectName, unitLabel: label })
              }
              className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
            >
              <span className="text-[13.5px] font-bold text-ink">📁 {label}</span>
              <span className="text-[12px] text-grey-500">{count}개 교재 ›</span>
            </button>
          );
        })}
      </div>
    );
  }

  const docsInUnit = published.filter(
    (d) =>
      d.subjectName === view.subjectName &&
      (d.unitTitle ?? UNASSIGNED_UNIT) === view.unitLabel
  );

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button
        onClick={() => setView({ level: "units", subjectName: view.subjectName })}
        className="text-[13px] text-grey-500 font-semibold mb-4"
      >
        ← 뒤로
      </button>
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">{view.unitLabel}</h1>
      <p className="text-[13px] text-grey-500 mb-5">{view.subjectName}</p>

      {docsInUnit.map((d) => (
        <a
          key={d.id}
          href={`/materials/${d.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 text-[13.5px] font-bold text-ink"
        >
          📖 {d.title}
        </a>
      ))}
    </div>
  );
}
