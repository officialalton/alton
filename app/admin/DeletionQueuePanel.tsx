"use client";

import { useEffect, useState } from "react";
import { loadDeletionQueueAction, retryDeletionTargetAction } from "./retention-actions";
import { DELETION_STATUS_LABEL, type DeletionQueueView, type DeletionTargetRow } from "./retention-data";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDate } from "@/lib/format-datetime";

type Filter = "all" | "failed" | "pending" | "deleted";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "failed", label: "실패" },
  { id: "pending", label: "대기" },
  { id: "deleted", label: "삭제됨" },
];

// 읽기 전용 + 실패 건 '지금 재시도'(대기열로 되돌림)만. 수동 삭제·완료 처리는 없다.
export default function DeletionQueuePanel() {
  const tz = useViewerTimezone();
  const [view, setView] = useState<DeletionQueueView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [version, setVersion] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDeletionQueueAction()
      .then((v) => {
        if (!cancelled) {
          setView(v);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "삭제 대기열을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function retry(row: DeletionTargetRow) {
    setBusyId(row.id);
    setRowErrors((p) => ({ ...p, [row.id]: "" }));
    const res = await retryDeletionTargetAction(row.id);
    setBusyId(null);
    if (!res.ok) return setRowErrors((p) => ({ ...p, [row.id]: res.error }));
    setToast("다시 대기열에 넣었습니다. 다음 삭제 실행 때 처리됩니다.");
    setVersion((v) => v + 1);
  }

  if (error) return <p role="alert" className="text-[13px] text-red">{error}</p>;
  if (!view) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;

  const dt = (v: string | null) => (v ? fmtDate(new Date(v), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, tz) : "—");
  const order = { failed: 0, pending: 1, deleted: 2 } as const;
  const rows = view.rows.filter((r) => filter === "all" || r.status === filter).sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div>
      <p className="text-[12.5px] text-grey-500 mb-3">
        보존 기간이 지난 Drive 파일의 삭제 대기열입니다. 삭제 실행은 보존 배치가 하며, 여기서는 수동으로 삭제하거나 완료 처리할 수 없습니다. 활성 보류가 걸린 건은 재시도되지 않습니다.
      </p>
      {toast && <p role="status" className="text-[12.5px] text-green mb-3">{toast}</p>}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={"text-[12.5px] font-semibold rounded-full px-3 py-1 border " + (filter === f.id ? "bg-navy text-white border-navy" : "border-grey-200 text-grey-600")}
          >
            {f.label}
          </button>
        ))}
      </div>
      {view.truncated && <p className="text-[12px] text-grey-500 mb-2">대기·실패 건이 많아 일부만 표시합니다.</p>}
      {rows.length === 0 ? (
        <p className="text-[13px] text-grey-500">표시할 항목이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} data-testid={`target-${r.id}`} className={"border rounded-xl p-4 bg-white " + (r.status === "failed" ? "border-red" : "border-grey-200")}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={"text-[11px] font-bold px-2 py-0.5 rounded-full " + (r.status === "failed" ? "bg-red/10 text-red" : "bg-grey-100 text-grey-600")}>
                  {DELETION_STATUS_LABEL[r.status]}
                </span>
                <span className="text-[12.5px] text-ink font-semibold">{r.category}</span>
                <span className="text-[12px] text-grey-500">{r.sourceTable}</span>
                {r.escalatedAt && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red">7일 이상 실패 — 담당자 알림됨</span>}
              </div>
              <p className="text-[12px] text-grey-600 break-all">Drive 파일 ID: {r.driveFileId}</p>
              <p className="text-[12px] text-grey-500">
                시도 {r.attempts}회 · 삭제 예정 {dt(r.dueAt)}
                {r.status !== "deleted" && ` · 다음 시도 ${dt(r.nextAttemptAt)}`}
                {r.firstFailedAt && ` · 첫 실패 ${dt(r.firstFailedAt)}`}
                {r.deletedAt && ` · 삭제 ${dt(r.deletedAt)}`}
              </p>
              {r.lastError && <p className="text-[12px] text-red mt-1 break-words">마지막 오류: {r.lastError}</p>}
              {r.status === "failed" && view.canRetry && (
                <div className="mt-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => retry(r)}
                    className="text-[12.5px] font-semibold rounded-lg px-3 py-1.5 bg-navy text-white disabled:opacity-50"
                  >
                    {busyId === r.id ? "처리 중…" : "지금 재시도"}
                  </button>
                  {rowErrors[r.id] && <p role="alert" className="text-[12.5px] text-red mt-1">{rowErrors[r.id]}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
