"use client";

import { useState } from "react";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import ReportedProblemsPanel from "./ReportedProblemsPanel";
import ErrorReportStatsPanel from "./ErrorReportStatsPanel";
import type { ReportFilter } from "./problem-error-report-actions";

const SUBTABS = [
  { id: "list", label: "신고 내역" },
  { id: "stats", label: "통계" },
] as const;
type SubtabId = (typeof SUBTABS)[number]["id"];

/** 관리자 '오류 신고' 메인 탭 — 신고 내역(목록·상세·판정) / 통계(축별 신고 수·신고율). */
export default function ErrorReportsTab({ initialSubtab = "list" }: { initialSubtab?: SubtabId } = {}) {
  const [subtab, setSubtab] = useState<SubtabId>(initialSubtab);
  const [filter, setFilter] = useState<ReportFilter | undefined>(undefined);

  return (
    <div className="max-w-[980px]" data-testid="error-reports-tab">
      <div className="mb-5 border-b border-grey-200">
        <UnderlineSubTabs items={SUBTABS} activeId={subtab} onSelect={setSubtab} className="border-b-0" />
      </div>
      {subtab === "list" ? (
        <ReportedProblemsPanel filter={filter} onClearFilter={() => setFilter(undefined)} />
      ) : (
        <ErrorReportStatsPanel
          onOpenCell={(f) => {
            setFilter(f);
            setSubtab("list");
          }}
        />
      )}
    </div>
  );
}
