"use client";

// 공유 자료 세트의 자료 블록: 범위 머리말("Questions 13–15 refer to the following information.") + 접기/펼치기.
// 세트 안에서 이동해도 자료는 그대로 보이고(기본 펼침), 접은 상태는 세트 단위로 유지돼 2·3번째 문항에서 반복되는 자료를 접어 둘 수 있다.
// 각 문항 화면은 펼치면 자료를 갖고 있어 단독으로도 풀 수 있다.
import { useState } from "react";
import { sharedSetHeading, type SharedSetRange } from "@/lib/ap-exam/shared-set";

export default function SharedStimulus({ range, children }: { range: SharedSetRange; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const closed = collapsed[range.key] ?? false;
  const id = `shared-stimulus-${range.key}`;
  return (
    <div className="mb-4 rounded-lg border border-grey-200 bg-grey-50 px-3 py-2.5" data-testid="ap-shared-stimulus" role="group" aria-labelledby={`${id}-h`}>
      <div className="flex items-start justify-between gap-2">
        <p id={`${id}-h`} className="min-w-0 text-[12.5px] font-bold text-ink" data-testid="ap-shared-heading">{sharedSetHeading(range)}</p>
        <button type="button" aria-expanded={!closed} aria-controls={id} onClick={() => setCollapsed((c) => ({ ...c, [range.key]: !closed }))}
          className="inline-flex min-h-[44px] shrink-0 items-center px-2 text-[12px] font-semibold text-grey-600 underline md:min-h-0 md:px-0" data-testid="ap-shared-toggle">
          {closed ? "Show information" : "Hide information"}
        </button>
      </div>
      <div id={id} hidden={closed} className="mt-2 min-w-0 overflow-x-auto">{children}</div>
    </div>
  );
}
