"use client";

import { useState } from "react";
import SubjectTemplateTab from "./SubjectTemplateTab";
import CurriculumDocsTab from "./CurriculumDocsTab";
import type { AdminSubject } from "./subject-data";
import type { DocEditorData } from "./curriculum-doc-data";

const SUBTABS = [
  { id: "subjects", label: "과목 템플릿" },
  { id: "docs", label: "교재 문서" },
  { id: "materials", label: "교재 라이브러리" },
  { id: "approval", label: "승인 대기" },
] as const;

type SubtabId = (typeof SUBTABS)[number]["id"];

export default function CatalogTab({
  subjects,
  docs,
}: {
  subjects: AdminSubject[];
  docs: DocEditorData[];
}) {
  const [subtab, setSubtab] = useState<SubtabId>("subjects");

  return (
    <div>
      <div className="flex gap-4 px-8 pt-6 border-b border-grey-200">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubtab(t.id)}
            className={
              "text-[13.5px] font-semibold pb-2.5 -mb-px border-b-2 " +
              (subtab === t.id
                ? "text-ink border-ink"
                : "text-grey-500 border-transparent")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {subtab === "subjects" ? (
        <SubjectTemplateTab initialSubjects={subjects} />
      ) : subtab === "docs" ? (
        <CurriculumDocsTab initialDocs={docs} subjects={subjects} />
      ) : (
        <div className="p-8 text-[14px] text-grey-500">
          {SUBTABS.find((t) => t.id === subtab)?.label} 탭은 준비 중입니다.
        </div>
      )}
    </div>
  );
}
