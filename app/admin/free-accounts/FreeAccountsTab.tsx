"use client";

import { useState } from "react";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import AccountDetail from "./AccountDetail";
import AccountsList from "./AccountsList";
import AnalyticsPanel from "./AnalyticsPanel";
import ReviewQueue from "./ReviewQueue";

const SUBTABS = [
  { id: "accounts", label: "Accounts" },
  { id: "analytics", label: "Analytics" },
] as const;
type SubtabId = (typeof SUBTABS)[number]["id"];

/** 관리자 전용 Free Accounts 탭: Accounts(목록·상세) / Analytics. 기존 상담 관심·수동 검토·병합 도구는 Accounts 하단 "Review queue"에 보존. */
export default function FreeAccountsTab() {
  const [subtab, setSubtab] = useState<SubtabId>("accounts");
  const [selected, setSelected] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (selected) {
    return <AccountDetail studentId={selected} onBack={() => setSelected(null)} onChanged={() => setRefreshKey((k) => k + 1)} />;
  }
  return (
    <div className="max-w-[1100px]" data-testid="free-accounts-tab">
      <div className="mb-5 border-b border-grey-200"><UnderlineSubTabs items={SUBTABS} activeId={subtab} onSelect={setSubtab} className="border-b-0" /></div>
      {subtab === "accounts" && (
        <>
          <AccountsList onOpen={setSelected} refreshKey={refreshKey} />
          <details className="mt-8 border-[1.5px] border-grey-200 rounded-xl px-5 py-3">
            <summary className="text-[13px] font-bold text-ink cursor-pointer">Review queue</summary>
            <div className="mt-3"><ReviewQueue /></div>
          </details>
        </>
      )}
      {subtab === "analytics" && <AnalyticsPanel />}
    </div>
  );
}
