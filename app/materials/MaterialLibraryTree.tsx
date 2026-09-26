"use client";

import { useState } from "react";
import type { LibrarySubjectTree } from "@/lib/subject-material-library";

const KIND_BADGE: Record<string, string> = { pdf: "PDF", video: "영상" };
const KIND_ICON: Record<string, string> = { pdf: "📄", video: "🎬", html: "📖" };
// 2026-09-22(사용자 지시) — 교재별로 실제 파일 색을 다르게 두지 않는 대신, 제목
// 해시로 표지 색을 결정해 갤러리에서 서로 구분되게 한다(실제 PDF 1페이지 렌더는
// 별도 썸네일 생성 파이프라인이 필요해 이번 라운드 범위 밖 — docs/CURRENT.md 참고).
const COVER_COLORS = ["bg-red", "bg-ink", "bg-grey-600", "bg-green"];

function coverColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_COLORS[hash % COVER_COLORS.length];
}

/**
 * 과목 → 단원 → 키워드 → 자료 갤러리(2026-09-22, 사용자 지시로 리스트에서
 * 갤러리뷰로 재설계). 학생·교사·보호자 포털이 공유한다. 최상단 과목 버튼으로
 * 과목을 고르고, 그 안의 교재는 표지 카드 그리드로 보여준다.
 */
export default function MaterialLibraryTree({
  subjects,
  sectionHeading,
  description,
  emptyMessage,
  docHref,
}: {
  subjects: LibrarySubjectTree[];
  /** 페이지 제목이 아니라 하위 구획 제목(예: 보호자 포털의 자녀별 구분). 페이지
   * 제목은 호출자(각 포털 Shell)의 PageFrame이 영어로 그린다. */
  sectionHeading?: string;
  description: string;
  emptyMessage: string;
  /** 자료 링크 — 보호자는 자녀를 쿼리로 붙여야 하므로 호출자가 만든다. */
  docHref: (docId: string) => string;
}) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(subjects[0]?.subjectId ?? null);
  const selected = subjects.find((s) => s.subjectId === selectedSubjectId) ?? subjects[0] ?? null;

  return (
    <div className="max-w-[920px]">
      {sectionHeading && (
        <h2 className="text-[15px] font-extrabold text-ink mb-1.5">{sectionHeading}</h2>
      )}
      <p className="text-[13px] text-grey-500 mb-4">{description}</p>

      {subjects.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {emptyMessage}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {subjects.map((subject) => (
              <button
                key={subject.subjectId}
                type="button"
                onClick={() => setSelectedSubjectId(subject.subjectId)}
                className={
                  "text-[13px] font-bold px-3.5 py-1.5 rounded-full border-[1.5px] " +
                  (subject.subjectId === selected?.subjectId
                    ? "bg-ink text-white border-ink"
                    : "border-grey-200 text-grey-500")
                }
              >
                {subject.subjectName}
              </button>
            ))}
          </div>

          {selected && (
            <div>
              {selected.units.map((unit) => (
                <details key={unit.unitId ?? "unassigned"} open className="mb-4" data-testid="material-unit-group">
                  <summary className="cursor-pointer text-[13px] font-bold text-grey-500 px-2 py-1.5 rounded-lg hover:bg-grey-100">
                    {unit.unitTitle}
                  </summary>
                  <div className="pl-1 pt-2">
                    {unit.keywordGroups.map((kg) => (
                      <div key={kg.keywordId ?? "no-keyword"} className="mb-4">
                        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide px-1 mb-2">
                          {kg.label}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {kg.docs.map((doc) => (
                            <a
                              key={doc.id}
                              href={docHref(doc.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block group"
                            >
                              <div
                                className={
                                  "aspect-[3/4] rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow " +
                                  coverColorFor(doc.id)
                                }
                              >
                                <span className="text-[32px]">{KIND_ICON[doc.kind]}</span>
                              </div>
                              <div className="mt-1.5 flex items-start gap-1">
                                {KIND_BADGE[doc.kind] && (
                                  <span className="shrink-0 text-[10px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5">
                                    {KIND_BADGE[doc.kind]}
                                  </span>
                                )}
                                <span className="text-[11px] font-semibold text-ink leading-snug line-clamp-2">{doc.title}</span>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
