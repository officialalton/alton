"use client";

import { useState } from "react";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import BoardTab from "./BoardTab";
import PlannerScheduleView from "./PlannerScheduleView";
import PlannerOverviewView from "./PlannerOverviewView";

// Student Success Planner(2026-09-21 승인) — 보드/일정/오버뷰 3개 서브탭.
export default function PlannerTab() {
  const [subtab, setSubtab] = useState<"board" | "schedule" | "overview">("board");

  return (
    <div>
      <UnderlineSubTabs
        className="mb-5"
        items={[
          { id: "board", label: "보드" },
          { id: "schedule", label: "일정" },
          { id: "overview", label: "오버뷰" },
        ]}
        activeId={subtab}
        onSelect={setSubtab}
      />
      {subtab === "board" && <BoardTab />}
      {subtab === "schedule" && <PlannerScheduleView />}
      {subtab === "overview" && <PlannerOverviewView />}
    </div>
  );
}
