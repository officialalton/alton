"use client";

// R6 6/N — 관리자 예약 운영 화면: Calendar/Meet 동기화 불일치(reconciliation_needed/failed)
// 예약 목록 확인, 수동 재처리 트리거, 회사/선생님 귀책 취소.

import { useEffect, useState } from "react";
import {
  listReconciliationNeededBookings,
  retryCalendarSyncNow,
  adminCancelLessonBooking,
  listNotificationOutboxSummary,
  type ReconciliationRow,
  type NotificationOutboxSummary,
} from "./booking-actions";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

const STATUS_LABEL: Record<string, string> = {
  failed: "재시도 중(Calendar 동기화 실패)",
  reconciliation_needed: "수동 확인 필요(재시도 한도 초과)",
};

const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  booking_confirmed: "예약 확정 알림",
  booking_cancelled: "예약 취소 알림",
  reminder_24h: "24시간 전 리마인드",
  reminder_2h: "2시간 전 리마인드",
};

export default function BookingReconciliationPanel() {
  const [rows, setRows] = useState<ReconciliationRow[] | null>(null);
  const [outboxSummary, setOutboxSummary] = useState<NotificationOutboxSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [reconciliation, outbox] = await Promise.all([
        listReconciliationNeededBookings(),
        listNotificationOutboxSummary(),
      ]);
      setRows(reconciliation);
      setOutboxSummary(outbox);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleRetryNow() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await retryCalendarSyncNow();
      setMessage(
        `${result.attempted}건 재시도 — 성공 ${result.succeeded}, 재시도 대기 ${result.failed}, 수동확인 필요 ${result.reconciliationNeeded}`
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(reservationId: string) {
    const reason = cancelReasonDraft.trim() || "관리자 취소";
    setLoading(true);
    setError(null);
    try {
      await adminCancelLessonBooking({ reservationId, cancelledByRole: "company", reason });
      setMessage("취소 처리됐습니다(수업권 release + 필요 시 만료일 30일 연장).");
      setCancellingReservationId(null);
      setCancelReasonDraft("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[880px] px-8 py-8">
      <div className="flex items-center justify-between mb-1.5">
        <h1 className="text-[20px] font-extrabold text-ink">예약 운영 · Calendar 동기화 불일치</h1>
        <button
          disabled={loading}
          onClick={handleRetryNow}
          className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-2 disabled:opacity-50"
        >
          지금 재처리
        </button>
      </div>
      <p className="text-[13px] text-grey-500 mb-5">
        Google Calendar/Meet 생성이 실패했거나 재시도 한도(5회)를 넘긴 예약입니다. 예약·수업권 hold 자체는
        영향받지 않습니다 — Google 쪽 산출물(이벤트·Meet 링크)만 재처리 대상입니다.
      </p>

      {message && <div className="mb-4 text-[13px] font-semibold text-ink bg-green/10 rounded-lg px-4 py-3">{message}</div>}
      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      {outboxSummary && outboxSummary.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[14px] font-bold text-ink mb-2">알림 발송 대기 현황</h2>
          <p className="text-[12px] text-grey-500 mb-2">
            실제 이메일·메시지 발송 인프라는 아직 없습니다(정식 오픈 전 필수 작업으로 별도 등록됨) — 아래는
            "발송 대기(pending)" 상태까지만 표시합니다.
          </p>
          <div className="flex flex-wrap gap-2">
            {outboxSummary.map((s) => (
              <span
                key={`${s.notificationType}-${s.status}`}
                className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-grey-100 text-grey-500"
              >
                {NOTIFICATION_TYPE_LABEL[s.notificationType] ?? s.notificationType} · {s.status} {s.count}건
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && !rows ? (
        <div className="text-[13px] text-grey-500">불러오는 중…</div>
      ) : !rows || rows.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          불일치 예약이 없습니다.
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.reservationId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">{r.teacherName ?? "(이름 없음)"} 선생님</div>
                <div className="text-[13px] text-grey-500 mt-0.5">{formatDateTime(r.startsAt)}</div>
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red/10 text-red">
                {STATUS_LABEL[r.googleSyncStatus] ?? r.googleSyncStatus}
              </span>
            </div>
            {r.googleSyncError && (
              <div className="mt-2 text-[12px] text-grey-500 bg-grey-100 rounded-lg px-3 py-2">
                최근 오류: {r.googleSyncError} (재시도 {r.googleSyncRetryCount}회)
              </div>
            )}
            {cancellingReservationId !== r.reservationId ? (
              <div className="mt-3 flex justify-end">
                <button
                  disabled={loading}
                  onClick={() => {
                    setCancellingReservationId(r.reservationId);
                    setCancelReasonDraft("");
                  }}
                  className="text-[12px] font-bold text-red disabled:opacity-50"
                >
                  이 예약 취소(회사 귀책)
                </button>
              </div>
            ) : (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <label className="block text-[11px] font-bold text-grey-500 mb-1">취소 사유(회사 귀책)</label>
                <input
                  autoFocus
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                  value={cancelReasonDraft}
                  onChange={(e) => setCancelReasonDraft(e.target.value)}
                  placeholder="예: Google Workspace 계정 미발급"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    disabled={loading}
                    onClick={() => setCancellingReservationId(null)}
                    className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                  >
                    닫기
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => handleCancel(r.reservationId)}
                    className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    취소 확정
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
