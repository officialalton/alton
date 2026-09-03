"use client";

// R6 6/N — 관리자 예약 운영 화면: Calendar/Meet 동기화 불일치(reconciliation_needed/failed)
// 예약 목록 확인, 수동 재처리 트리거, 회사/선생님 귀책 취소.

import { useEffect, useState } from "react";
import {
  listReconciliationNeededBookings,
  retryCalendarSyncNow,
  adminCancelLessonBooking,
  listNotificationOutboxSummary,
  listRecentIncidentReports,
  listExternalCalendarChanges,
  resolveExternalCalendarChange,
  resolveExternalChangeAcceptGoogleTime,
  resolveExternalChangeKeepAltonTime,
  resolveExternalChangeRecreateAfterDeletion,
  resolveExternalChangeCancelDueToDeletion,
  retryExternalCalendarReconciliationNow,
  type ReconciliationRow,
  type NotificationOutboxSummary,
  type IncidentReportAdminRow,
  type ExternalCalendarChangeRow,
  type ExternalChangeResolution,
} from "./booking-actions";

const EXTERNAL_CHANGE_STATUS_LABEL: Record<string, string> = {
  time_changed: "Google에서 시간 변경됨",
  deleted: "Google에서 이벤트 삭제됨",
  meet_link_changed: "Google에서 Meet 링크 변경됨",
};

const INCIDENT_REPORT_TYPE_LABEL: Record<string, string> = {
  teacher_late: "선생님 지각",
  student_no_show_reported: "학생 노쇼",
  teacher_no_show_reported: "선생님 노쇼",
};

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
  const [incidentReports, setIncidentReports] = useState<IncidentReportAdminRow[] | null>(null);
  const [externalChanges, setExternalChanges] = useState<ExternalCalendarChangeRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [resolvingReservationId, setResolvingReservationId] = useState<string | null>(null);
  const [resolveReasonDraft, setResolveReasonDraft] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [reconciliation, outbox, incidents, changes] = await Promise.all([
        listReconciliationNeededBookings(),
        listNotificationOutboxSummary(),
        listRecentIncidentReports(),
        listExternalCalendarChanges(),
      ]);
      setRows(reconciliation);
      setOutboxSummary(outbox);
      setIncidentReports(incidents);
      setExternalChanges(changes);
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
      const [result, externalResult] = await Promise.all([
        retryCalendarSyncNow(),
        retryExternalCalendarReconciliationNow(),
      ]);
      setMessage(
        `${result.attempted}건 재시도 — 성공 ${result.succeeded}, 재시도 대기 ${result.failed}, 수동확인 필요 ${result.reconciliationNeeded}` +
          ` · 외부 변경 대조: 선생님 ${externalResult.teachersChecked}명 확인, 신규 감지 ${externalResult.changesDetected}건`
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

  async function handleResolveExternalChange(reservationId: string, resolution: ExternalChangeResolution) {
    const reason = resolveReasonDraft.trim() || "관리자 확인";
    setLoading(true);
    setError(null);
    try {
      if (resolution === "accepted_google_time") {
        await resolveExternalChangeAcceptGoogleTime({ reservationId, reason });
      } else if (resolution === "kept_alton_time") {
        await resolveExternalChangeKeepAltonTime({ reservationId, reason });
      } else if (resolution === "recreated_after_deletion") {
        await resolveExternalChangeRecreateAfterDeletion({ reservationId, reason });
      } else if (resolution === "confirmed_cancelled") {
        await resolveExternalChangeCancelDueToDeletion({ reservationId, reason });
      } else {
        await resolveExternalCalendarChange({ reservationId, resolution, reason });
      }
      setMessage(
        resolution === "accepted_google_time"
          ? "Google 시간을 재검증 후 ALTON에 반영했습니다."
          : resolution === "kept_alton_time"
            ? "Google 이벤트를 ALTON 기준 시간으로 복원했습니다."
            : resolution === "recreated_after_deletion"
              ? "ALTON 일정을 유지하고 Calendar 이벤트를 재생성했습니다."
              : resolution === "confirmed_cancelled"
                ? "정식 취소 절차로 예약을 정리했습니다."
                : "외부 변경을 확인 처리했습니다."
      );
      setResolvingReservationId(null);
      setResolveReasonDraft("");
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

      <h2 className="text-[14px] font-bold text-ink mb-2 mt-8">Google 외부 변경 감지</h2>
      <p className="text-[12px] text-grey-500 mb-3">
        선생님/관리자가 Google Calendar에서 이 수업 이벤트를 ALTON 모르게 직접 바꿨을 때만
        여기 나타납니다. 예약·세션·수업권 hold는 감지만으로는 전혀 바뀌지 않습니다 — 아래에서
        관리자가 확인 처리해야만 확정됩니다. **UI 고도화 예정**: 지금은 이 목록 형태로만
        제공하고, 선생님별 금주/주간/월간 통합 일정 캘린더 뷰는 후속 작업으로 남아 있습니다.
      </p>
      {!externalChanges || externalChanges.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-8">
          감지된 외부 변경이 없습니다.
        </div>
      ) : (
        externalChanges.map((c) => (
          <div key={c.reservationId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">{c.teacherName ?? "(이름 없음)"} 선생님</div>
                <div className="text-[13px] text-grey-500 mt-0.5">ALTON 기준: {formatDateTime(c.startsAt)}</div>
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red/10 text-red">
                {EXTERNAL_CHANGE_STATUS_LABEL[c.externalChangeStatus] ?? c.externalChangeStatus}
              </span>
            </div>
            {c.externalChangeDetail && (
              <div className="mt-2 text-[12px] text-grey-500 bg-grey-100 rounded-lg px-3 py-2">
                Google 쪽 값: {JSON.stringify(c.externalChangeDetail)}
              </div>
            )}
            {resolvingReservationId !== c.reservationId ? (
              <div className="mt-3 flex justify-end">
                <button
                  disabled={loading}
                  onClick={() => {
                    setResolvingReservationId(c.reservationId);
                    setResolveReasonDraft("");
                  }}
                  className="text-[12px] font-bold text-ink disabled:opacity-50"
                >
                  확인 처리
                </button>
              </div>
            ) : (
              <div className="mt-3 border-t border-grey-200 pt-3">
                <label className="block text-[11px] font-bold text-grey-500 mb-1">처리 사유</label>
                <input
                  autoFocus
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                  value={resolveReasonDraft}
                  onChange={(e) => setResolveReasonDraft(e.target.value)}
                  placeholder="예: 선생님과 통화로 확인함"
                />
                {c.externalChangeStatus === "deleted" ? (
                  <p className="text-[11px] text-grey-500 mb-2">
                    Google 이벤트가 삭제됐습니다 — 예약·세션·수업권 hold는 자동으로 취소·재생성되지 않습니다.
                    아래 둘 중 하나를 반드시 선택하세요("무시"는 허용되지 않습니다): "ALTON 일정 유지"는 예약을
                    그대로 두고 Calendar 이벤트+Meet을 새로 만들고, "예약 취소"는 정식 취소 절차(수업권
                    release/30일 연장 포함)로 예약 자체를 정리합니다.
                  </p>
                ) : (
                  <p className="text-[11px] text-grey-500 mb-2">
                    "Google 시간 반영"은 가용성·버퍼·중복예약·수업권을 재검증한 뒤 ALTON DB를 Google 시간으로
                    맞춥니다. "ALTON 시간 유지"는 ALTON 시간은 그대로 두고 Google 이벤트만 되돌립니다. 두 처리
                    모두 감사 이력(`reservation_reschedules`)에 남습니다.
                  </p>
                )}
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    disabled={loading}
                    onClick={() => setResolvingReservationId(null)}
                    className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                  >
                    닫기
                  </button>
                  {c.externalChangeStatus === "deleted" ? (
                    <>
                      <button
                        disabled={loading}
                        onClick={() => handleResolveExternalChange(c.reservationId, "recreated_after_deletion")}
                        className="text-[12px] font-bold text-ink disabled:opacity-50"
                      >
                        ALTON 일정 유지(재생성)
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => handleResolveExternalChange(c.reservationId, "confirmed_cancelled")}
                        className="text-[12px] font-bold text-white bg-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                      >
                        예약 취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        disabled={loading}
                        onClick={() => handleResolveExternalChange(c.reservationId, "dismissed")}
                        className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                      >
                        무시(오탐)
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => handleResolveExternalChange(c.reservationId, "kept_alton_time")}
                        className="text-[12px] font-bold text-ink disabled:opacity-50"
                      >
                        ALTON 시간 유지
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => handleResolveExternalChange(c.reservationId, "accepted_google_time")}
                        className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                      >
                        Google 시간 반영
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <h2 className="text-[14px] font-bold text-ink mb-2 mt-8">지각·노쇼 신고 (최근 100건)</h2>
      <p className="text-[12px] text-grey-500 mb-3">
        학생·보호자·선생님이 제출한 신고 원문입니다. 최종 판정·수업권 소진·정산은 아직 이 화면의 범위가
        아닙니다(추후 단계에서 이 기록을 입력으로 처리).
      </p>
      {!incidentReports || incidentReports.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          제출된 신고가 없습니다.
        </div>
      ) : (
        incidentReports.map((r) => (
          <div key={r.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-bold text-ink">
                {r.studentName ?? "(학생 미확인)"} · {r.teacherName ?? "(선생님 미확인)"} 선생님
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red/10 text-red">
                {INCIDENT_REPORT_TYPE_LABEL[r.reportType] ?? r.reportType}
              </span>
            </div>
            <div className="text-[12px] text-grey-500 mt-1">
              {formatDateTime(r.reportedAt)} · 신고자: {r.reportedByName ?? "(알 수 없음)"}
              {r.minutesLate !== null ? ` · 지각 ${r.minutesLate}분` : ""}
            </div>
            {r.notes && <div className="mt-2 text-[12px] text-ink bg-grey-100 rounded-lg px-3 py-2">{r.notes}</div>}
          </div>
        ))
      )}
    </div>
  );
}
