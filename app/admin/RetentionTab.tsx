"use client";

import { useState } from "react";
import LegalHoldsPanel from "./LegalHoldsPanel";
import DeletionQueuePanel from "./DeletionQueuePanel";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";

type SubTab = "holds" | "deletions";
const SUB_NAV: { id: SubTab; label: string }[] = [
  { id: "holds", label: "법적 보류" },
  { id: "deletions", label: "삭제 대기열" },
];

export default function RetentionTab() {
  const [sub, setSub] = useState<SubTab>("holds");
  return (
    <div className="px-5 sm:px-8 py-6">
      <h2 className="text-[17px] font-extrabold text-ink mb-1">보존</h2>
      <UnderlineSubTabs className="mb-5" items={SUB_NAV} activeId={sub} onSelect={setSub} />
      {sub === "holds" ? <LegalHoldsPanel /> : <DeletionQueuePanel />}
    </div>
  );
}
