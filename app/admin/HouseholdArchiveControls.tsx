"use client";

// P4-1(B) — 가구 아카이브 버튼 + 확인 모달.
// 확정 정책(2026-09-11): 진행 중 수업이 있으면 아무 것도 바꾸지 않고 차단한다.
// 완료된 수업·이미 소진된 수업권은 보존한다. 복귀해도 예약·매칭은 자동 복원되지 않는다.

import { useState } from "react";
import {
  archiveHouseholdAction,
  previewHouseholdArchiveImpactAction,
  type HouseholdArchivePreview,
} from "./household-archive-actions";

export default function HouseholdArchiveControls({
  householdId,
  guardianName,
  onArchived,
}: {
  householdId: string;
  guardianName: string;
  onArchived: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<HouseholdArchivePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    setError(null);
    setPreview(null);
    setLoading(true);
    try {
      setPreview(await previewHouseholdArchiveImpactAction(householdId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={openModal}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-grey-500"
          data-testid={`archive-household-${householdId}`}
        >
          아카이브
        </button>
      </div>
    );
  }

  const blocked = (preview?.liveReservationCount ?? 0) > 0;

  return (
    <div
      className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mt-2 w-full"
      role="dialog"
      aria-label="가구 아카이브 확인"
    >
      <div className="text-[13px] font-bold text-ink mb-1">{guardianName} 가구를 아카이브할까요?</div>
      {loading && <p className="text-[11.5px] text-grey-400">영향 확인 중...</p>}
      {error && <p className="text-[12px] text-red mb-1">{error}</p>}
      {preview && (
        <>
          <ul className="text-[11.5px] text-grey-500 space-y-0.5 mb-2">
            <li>자녀 {preview.childCount}명</li>
            <li>종료될 매칭 {preview.activeAssignmentCount}건</li>
            <li>취소될 미래 예약 {preview.cancellableReservationCount}건 (일정·캘린더에서 해제됩니다)</li>
            <li>완료된 수업과 이미 사용한 수업권은 그대로 보존됩니다.</li>
            <li>복귀해도 예약·매칭은 자동으로 되살아나지 않습니다.</li>
          </ul>
          {blocked && (
            <p className="text-[12px] text-red mb-2" data-testid="archive-blocked">
              진행 중인 수업이 {preview.liveReservationCount}건 있어 지금은 아카이브할 수 없습니다. 수업이
              끝난 뒤 다시 시도하세요.
            </p>
          )}
        </>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
          disabled={busy || loading || blocked || !preview}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const result = await archiveHouseholdAction(householdId);
              if (result.status === "completed") {
                setOpen(false);
                onArchived();
              } else {
                setError(result.error);
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "처리 중..." : "아카이브"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-semibold text-grey-500"
        >
          취소
        </button>
      </div>
    </div>
  );
}
