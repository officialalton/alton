"use client";

import { useCallback, useEffect, useState } from "react";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import { listSubjectCatalogAction } from "./subject-actions";
import SubjectTemplateTab from "./SubjectTemplateTab";
import CurriculumDocsTab from "./CurriculumDocsTab";
import DriveMaterialsPanel from "./DriveMaterialsPanel";
import type { AdminSubject } from "./subject-data";
import type { CurriculumDocListItem } from "./curriculum-doc-data";

const SUBTABS = [
  { id: "subjects", label: "과목 템플릿" },
  { id: "docs", label: "교재" },
  { id: "drive", label: "Drive 자료" },
] as const;

type SubtabId = (typeof SUBTABS)[number]["id"];

export default function CatalogTab({
  subjects: initialSubjects,
  docs: initialDocs,
}: {
  subjects: AdminSubject[];
  docs: CurriculumDocListItem[];
}) {
  const [subtab, setSubtab] = useState<SubtabId>("subjects");
  const [subjects, setSubjects] = useState(initialSubjects);
  const [docs, setDocs] = useState(initialDocs);

  // P2/P3(2026-09-12) — SSR prop은 `?tab=catalog`로 들어왔을 때만 채워진다.
  // 다른 탭에서 클라이언트 전환으로 들어오면 빈 배열이라 "과목이 없음"처럼
  // 보였고, 탭을 다시 들어가 서버 왕복이 일어나야 나타났다. 화면이 스스로
  // 불러와 어느 경로로 들어와도 같은 결과를 보게 한다.
  //
  // 불러오는 중 / 실제로 비어 있음 / 실패를 구분한다 — 셋을 같은 화면으로
  // 뭉개면 운영자가 무엇이 문제인지 알 수 없다.
  const [subjectsState, setSubjectsState] = useState<"loading" | "ready" | "error">(
    initialSubjects.length > 0 ? "ready" : "loading"
  );
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  const loadSubjects = useCallback(async (opts: { background?: boolean } = {}) => {
    // 이미 보여줄 목록이 있으면 화면을 로딩으로 덮지 않는다 — 배경에서 갱신한다.
    if (!opts.background) setSubjectsState("loading");
    setSubjectsError(null);
    try {
      setSubjects(await listSubjectCatalogAction());
      setSubjectsState("ready");
    } catch (e) {
      setSubjectsError(e instanceof Error ? e.message : "과목을 불러오지 못했습니다.");
      setSubjectsState("error");
    }
  }, []);

  useEffect(() => {
    // 2026-09-22(성능 전수 점검) — SSR(admin/page.tsx의 need("catalog", ...))이
    // 이미 initialSubjects를 받아 왔으면 마운트 시 다시 조회하지 않는다(예전엔
    // "배경 갱신"이라며 매번 다시 불렀는데, 갱신할 이유(신선도 문제) 없이 매
    // 탭 진입마다 왕복만 늘었다). 목록을 바꾸는 동작(추가·수정)은 각자 명시적으로
    // loadSubjects()를 다시 부른다.
    if (initialSubjects.length > 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    void loadSubjects();
    // 최초 1회만 — 이후 갱신은 명시적 동작(다시 시도)으로 한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <UnderlineSubTabs items={SUBTABS} activeId={subtab} onSelect={setSubtab} className="mb-0" />

      {subtab === "subjects" ? (
        subjectsState === "loading" ? (
          <p className="px-8 py-8 text-[13px] text-grey-500">과목을 불러오는 중…</p>
        ) : subjectsState === "error" ? (
          <div className="px-8 py-8">
            <p className="text-[13px] text-red mb-2">{subjectsError}</p>
            <button
              onClick={() => void loadSubjects()}
              className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <SubjectTemplateTab subjects={subjects} setSubjects={setSubjects} />
        )
      ) : subtab === "docs" ? (
        <CurriculumDocsTab docs={docs} setDocs={setDocs} subjects={subjects} />
      ) : (
        <DriveMaterialsPanel subjects={subjects} />
      )}
    </div>
  );
}
