"use client";

// 2026-09-22(사용자 지시 — "선생님이 일정 확인 후 확정하거나 변경/거절") —
// 선생님이 건 재조정 요청(reservation_reschedule_requests, status='pending')을
// 학생/보호자가 수락/거절한다. 수락 전까지 기존 예약은 그대로 유효 — 배너가
// 없어도 기존 예약대로 진행하면 된다(강제 아님).
//
// LessonBookingTab.tsx가 학생·보호자 포털에서 공유되므로, 어느 쪽 서버
// 액션을 쓸지는 호출부가 listPending/onRespond로 주입한다(이 컴포넌트는
// 순수 표시·상호작용만 담당).

import { useEffect, useState } from "react";

export type PendingReschedule = {
  id: string;
  proposedStartsAt: string;
  reason: string | null;
};

function formatDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function RescheduleRequestsBanner({
  timezone,
  listPending,
  onRespond,
}: {
  timezone: string;
  listPending: () => Promise<PendingReschedule[]>;
  onRespond: (requestId: string, accept: boolean) => Promise<void>;
}) {
  const [requests, setRequests] = useState<PendingReschedule[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    listPending()
      .then(setRequests)
      .catch(() => setRequests([]));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRespond(requestId: string, accept: boolean) {
    setBusyId(requestId);
    setError(null);
    try {
      await onRespond(requestId, accept);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  if (!requests || requests.length === 0) return null;

  return (
    <div className="mb-5 space-y-2.5">
      {error && <p className="text-[12.5px] text-red">{error}</p>}
      {requests.map((r) => (
        <div key={r.id} className="border-[1.5px] border-red/30 bg-red/5 rounded-xl px-4 py-3">
          <div className="text-[13px] font-bold text-ink">선생님이 수업 시간 변경을 제안했습니다</div>
          <div className="text-[12.5px] text-grey-600 mt-1">
            제안된 시간: {formatDateTime(r.proposedStartsAt, timezone)}
          </div>
          {r.reason && <div className="text-[12px] text-grey-500 mt-0.5">사유: {r.reason}</div>}
          <div className="flex gap-2 mt-2.5">
            <button
              type="button"
              disabled={busyId === r.id}
              onClick={() => handleRespond(r.id, true)}
              className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              수락
            </button>
            <button
              type="button"
              disabled={busyId === r.id}
              onClick={() => handleRespond(r.id, false)}
              className="text-[12px] font-bold text-grey-600 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              거절(기존 시간 유지)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
