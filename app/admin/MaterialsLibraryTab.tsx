"use client";

import { useState } from "react";
import type { CurriculumDocListItem } from "./curriculum-doc-data";

// 2026-09-14: 자료는 단원이 아니라 **대표 키워드**에 속한다(Drive 구조 과목 → 키워드 → 파일과 같다).
// 라이브러리도 그 순서로 접는다. 대표 키워드가 없는 교재만 따로 모은다.
const UNASSIGNED_KEYWORD = "(키워드 미지정)";
const KIND_ICON: Record<CurriculumDocListItem["kind"], string> = { html: "📖", pdf: "📄", video: "🎬" };

type View =
  | { level: "subjects" }
  | { level: "keywords"; subjectName: string }
  | { level: "docs"; subjectName: string; keywordLabel: string };

const keywordOf = (d: CurriculumDocListItem) => d.primaryKeywordLabel ?? UNASSIGNED_KEYWORD;

export default function MaterialsLibraryTab({ docs }: { docs: CurriculumDocListItem[] }) {
  const published = docs.filter((d) => d.status === "published" && !d.archivedAt);
  const [view, setView] = useState<View>({ level: "subjects" });

  const subjectNames = Array.from(new Set(published.map((d) => d.subjectName))).sort(
    (a, b) => a.localeCompare(b)
  );

  if (view.level === "subjects") {
    return (
      <div className="max-w-[640px] px-8 py-8">
        <h1 className="text-[20px] font-extrabold text-ink mb-1.5">교재 라이브러리</h1>
        <p className="text-[13px] text-grey-500 mb-5">
          과목 → 키워드 → 교재 순서로 폴더처럼 탐색합니다(Drive 폴더와 같은 구조). 교재를 클릭하면 실제
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
                onClick={() => setView({ level: "keywords", subjectName: name })}
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

  if (view.level === "keywords") {
    const docsInSubject = published.filter((d) => d.subjectName === view.subjectName);
    // 미지정 묶음은 맨 뒤.
    const keywordLabels = Array.from(new Set(docsInSubject.map(keywordOf))).sort((a, b) =>
      a === UNASSIGNED_KEYWORD ? 1 : b === UNASSIGNED_KEYWORD ? -1 : a.localeCompare(b)
    );

    return (
      <div className="max-w-[640px] px-8 py-8">
        <button
          onClick={() => setView({ level: "subjects" })}
          className="text-[13px] text-grey-500 font-semibold mb-4"
        >
          ← 뒤로
        </button>
        <h1 className="text-[20px] font-extrabold text-ink mb-5">{view.subjectName}</h1>

        {keywordLabels.map((label) => {
          const count = docsInSubject.filter((d) => keywordOf(d) === label).length;
          return (
            <button
              key={label}
              onClick={() =>
                setView({ level: "docs", subjectName: view.subjectName, keywordLabel: label })
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

  const docsInKeyword = published.filter(
    (d) => d.subjectName === view.subjectName && keywordOf(d) === view.keywordLabel
  );

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button
        onClick={() => setView({ level: "keywords", subjectName: view.subjectName })}
        className="text-[13px] text-grey-500 font-semibold mb-4"
      >
        ← 뒤로
      </button>
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">{view.keywordLabel}</h1>
      <p className="text-[13px] text-grey-500 mb-5">{view.subjectName}</p>

      {docsInKeyword.map((d) => (
        <a
          key={d.id}
          href={`/materials/${d.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 text-[13.5px] font-bold text-ink"
        >
          {KIND_ICON[d.kind]} {d.title}
          {d.kind !== "html" && (
            <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5 ml-2 align-middle">
              {d.kind === "pdf" ? "PDF" : "영상"}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}
