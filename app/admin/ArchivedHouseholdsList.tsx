"use client";

// P4-1(B) — 사용자 > 아카이브됨 서브탭.
// 아카이브된 가구만 보여주고 `복귀`(플래그 해제)만 제공한다 — 예약·매칭은 복원하지 않는다.

import { useEffect, useState } from "react";
import {
  listArchivedHouseholdsAction,
  restoreHouseholdAction,
  type ArchivedHouseholdListItem,
} from "./household-archive-actions";

export default function ArchivedHouseholdsList() {
  const [items, setItems] = useState<ArchivedHouseholdListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 이펙트 본문에서 동기 setState를 부르지 않는다(react-hooks/set-state-in-effect) —
  // 상태 갱신은 전부 Promise 콜백 안에서만 한다.
  function reload(): Promise<void> {
    return listArchivedHouseholdsAction()
      .then((rows) => {
        setItems(rows);
        setError(null);
      })
      .catch((e) => {
        setItems([]);
        setError(e instanceof Error ? e.message : String(e));
      });
  }

  useEffect(() => {
    void reload();
    // 최초 진입 시 1회만 조회한다(복귀 후 갱신은 핸들러가 직접 부른다).
  }, []);

  if (items === null) {
    return (
      <div aria-busy="true" data-testid="archived-households-skeleton">
        <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 animate-pulse">
          <div className="h-3.5 w-24 bg-grey-200 rounded" />
          <div className="h-3 w-40 bg-grey-100 rounded mt-2" />
        </div>
      </div>
    );
  }

  return (
    <>
      {error && <p className="text-[12px] text-red mb-2">{error}</p>}
      {items.length === 0 && !error && (
        <p className="text-[13px] text-grey-500" data-testid="archived-households-empty">
          아카이브된 가구가 없습니다.
        </p>
      )}
      {items.map((h) => (
        <div key={h.householdId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13.5px] font-bold text-ink">{h.guardianName || "(이름 없음)"}</div>
              <div className="text-[12px] text-grey-500 mt-0.5">{h.guardianEmail}</div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                자녀: {h.childrenNames.length ? h.childrenNames.join(", ") : "없음"}
              </div>
              <div className="text-[11.5px] text-grey-400 mt-1">
                {new Date(h.archivedAt).toLocaleString("ko-KR")} 아카이브
                {h.archivedByName ? ` · 처리 ${h.archivedByName}` : ""}
              </div>
              <div className="text-[11.5px] text-grey-400">
                종료된 매칭 {h.endedAssignments}건 · 취소된 예약 {h.cancelledReservations}건
              </div>
            </div>
            <button
              type="button"
              disabled={busyId === h.householdId}
              onClick={async () => {
                setBusyId(h.householdId);
                setError(null);
                try {
                  await restoreHouseholdAction(h.householdId);
                  await reload();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusyId(null);
                }
              }}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink shrink-0 disabled:opacity-50"
              data-testid={`restore-household-${h.householdId}`}
            >
              {busyId === h.householdId ? "복귀 중..." : "복귀"}
            </button>
          </div>
          <p className="text-[11px] text-grey-400 mt-1.5">
            복귀해도 취소된 예약과 종료된 매칭은 자동으로 되살아나지 않습니다 — 필요하면 매칭·예약을 새로
            만들어주세요.
          </p>
        </div>
      ))}
    </>
  );
}
