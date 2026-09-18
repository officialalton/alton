"use client";

import { useState } from "react";
import { checkUatCalendarEvent, deleteUatCalendarEventIfMatches } from "../uat-calendar-cleanup-actions";

const EVENT_ID = "v7rjj2epr9g4csroidibopjm1c";

export default function UatCleanupPanel() {
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="p-8 max-w-[720px]">
      <h1 className="text-[16px] font-bold mb-4">UAT Calendar 이벤트 정리</h1>
      <p className="text-[12.5px] text-grey-500 mb-4">event id: {EVENT_ID}</p>
      <div className="flex gap-2 mb-4">
        <button
          disabled={busy}
          className="px-4 py-2 bg-grey-200 rounded-lg text-[13px] font-bold"
          onClick={async () => {
            setBusy(true);
            try {
              setResult(await checkUatCalendarEvent(EVENT_ID));
            } catch (e) {
              setResult({ error: e instanceof Error ? e.message : String(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          1. 조회만(확인)
        </button>
        <button
          disabled={busy}
          className="px-4 py-2 bg-red text-white rounded-lg text-[13px] font-bold"
          onClick={async () => {
            setBusy(true);
            try {
              setResult(await deleteUatCalendarEventIfMatches(EVENT_ID));
            } catch (e) {
              setResult({ error: e instanceof Error ? e.message : String(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          2. 확인 후 일치하면 삭제
        </button>
      </div>
      <pre className="text-[11px] bg-grey-100 p-3 rounded-lg whitespace-pre-wrap">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
