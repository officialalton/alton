"use client";

// M1 — 관리자 상담 운영 화면: 승인 대기 신청 수락/거절/시간변경, 오늘·주간·월간
// 예정 상담 캘린더, 공용 상담 가능시간(반복/예외) 관리, 상담 결과 기록.
// booking-actions.ts의 BookingReconciliationPanel과 동일하게 클라이언트에서
// 직접 서버 액션을 호출해 자체 데이터를 불러온다(page.tsx 데이터로더를 건드리지
// 않는 최소 침습 방식).

import { useEffect, useState } from "react";
import {
  listConsultationsForAdmin,
  listPendingConsultationRequests,
  acceptConsultationRequest,
  rejectConsultationRequest,
  rescheduleConsultationRequest,
  cancelConsultationRequest,
  recordConsultationOutcome,
  retryTrialEntitlementGrant,
  retryFailedConsultationCalendarSyncs,
  retryConsultationSmartNotesConfig,
  reprocessUnlinkedConsultationSmartNotesEvents,
  listConsultAvailabilityRules,
  addConsultAvailabilityRule,
  deactivateConsultAvailabilityRule,
  listConsultAvailabilityExceptions,
  addConsultAvailabilityException,
  removeConsultAvailabilityException,
  type ConsultationListItem,
  type ConsultAvailabilityRule,
  type ConsultAvailabilityException,
} from "./consultation-scheduling-actions";
import {
  listWorkspaceEventsSubscriptions,
  retryExpiringWorkspaceEventsSubscriptions,
  runSmartNotesReconciliation,
  type WorkspaceEventsSubscriptionRow,
} from "./workspace-events-actions";

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

// 요구사항 5(2026-09-03 통합 보완) — Calendar 초대 실패는 다른 종류의 문제(단순 재시도
// 대기 vs 관리자 개입 필요)와 구분되는 상태·문구로 보여준다.
const SYNC_STATUS_LABEL: Record<string, string> = {
  pending: "Calendar 초대 발송 대기",
  synced: "Calendar 네이티브 초대 발송됨",
  failed: "Calendar 초대 실패(자동 재시도 중)",
  reconciliation_needed: "Calendar 초대 실패 — 관리자 확인 필요(이메일로 대체 안내됨)",
};

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  active: "정상",
  expiring: "만료 임박",
  expired: "만료됨",
  error: "오류",
  disabled: "관리자 정지",
};

const OUTCOME_LABEL: Record<string, string> = {
  trial_recommended: "체험 진행 권장",
  regular_recommended: "정규 진행 권장",
  on_hold: "보류",
  closed: "종료",
};

// M1 요구사항 3(2026-09-03 조건부 승인 보완) — "상담 진행 가능"과 "상담 완료 가능"은
// 서로 다른 시점의 서로 다른 기준이라 별도로 표시한다.
const CONSULT_READINESS_LABEL: Record<string, string> = {
  ready: "상담 진행 준비 완료(동의 확인 + Smart Notes ON)",
  consent_pending: "상담 진행 불가 — 동의 확인 대기",
  smart_notes_pending: "상담 진행 불가 — Smart Notes 활성화 확인 필요",
  not_applicable: "-",
};
// M2 — 체험수업권 지급 상태(요구사항 7). "체험 진행 권장"으로 결과가 기록된 순간
// 시스템이 자동 지급을 시도하고, 여기 나오는 상태는 그 결과를 보여준다.
const TRIAL_GRANT_STATUS_LABEL: Record<string, string> = {
  not_applicable: "-",
  pending: "체험수업권 지급 처리 중",
  granted: "체험수업권 지급 완료",
  failed: "체험수업권 지급 실패 — 재처리 필요",
};

const COMPLETION_READINESS_LABEL: Record<string, string> = {
  ready: "상담 완료 처리 가능",
  consult_not_ready: "완료 불가 — 상담 진행 조건(동의+Smart Notes) 미충족",
  smart_notes_not_linked: "완료 불가 — Smart Notes 원본이 아직 자동 연결되지 않음(재처리 대상)",
  summary_missing: "완료 불가 — 관리자 검토 요약 미작성",
  not_applicable: "-",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

type CalendarView = "today" | "week" | "month";

function rangeFor(view: CalendarView): { from: Date; to: Date } {
  const now = new Date();
  if (view === "today") {
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    return { from, to };
  }
  if (view === "week") {
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(to.getDate() + 7);
    return { from, to };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from, to };
}

export default function ConsultationSchedulingPanel() {
  const [pending, setPending] = useState<ConsultationListItem[]>([]);
  const [scheduled, setScheduled] = useState<ConsultationListItem[]>([]);
  const [view, setView] = useState<CalendarView>("week");
  const [rules, setRules] = useState<ConsultAvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<ConsultAvailabilityException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<WorkspaceEventsSubscriptionRow[]>([]);

  // 요구사항 5 — window.prompt 대신 검증 가능한 인라인 폼.
  const [rescheduleOpenId, setRescheduleOpenId] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [outcomeOpenId, setOutcomeOpenId] = useState<string | null>(null);
  const [outcomeSummary, setOutcomeSummary] = useState("");
  const [outcomeValue, setOutcomeValue] = useState<"trial_recommended" | "regular_recommended" | "on_hold" | "closed" | "">("");

  async function reload() {
    setLoading(true);
    try {
      const { from, to } = rangeFor(view);
      const [pendingRows, scheduledRows, ruleRows, exceptionRows, subscriptionRows] = await Promise.all([
        listPendingConsultationRequests(),
        listConsultationsForAdmin({ from: from.toISOString(), to: to.toISOString() }),
        listConsultAvailabilityRules(),
        listConsultAvailabilityExceptions(),
        listWorkspaceEventsSubscriptions(),
      ]);
      setPending(pendingRows);
      setScheduled(scheduledRows.filter((r) => r.status === "scheduled" || r.status === "completed"));
      setRules(ruleRows);
      setExceptions(exceptionRows);
      setSubscriptions(subscriptionRows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && <p className="text-[12px] text-red mb-3">{error}</p>}

      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-extrabold text-ink">승인 대기 상담 신청 ({pending.length})</h2>
          <div className="flex gap-2">
            <button
              className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
              onClick={() => withBusy("__retry", async () => { await retryFailedConsultationCalendarSyncs(); })}
            >
              Calendar 재처리 실행
            </button>
            <button
              className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
              onClick={() => withBusy("__retry_smart_notes", async () => { await reprocessUnlinkedConsultationSmartNotesEvents(); })}
            >
              Smart Notes 미매칭 재처리
            </button>
          </div>
        </div>
        {loading ? (
          <p className="text-[13px] text-grey-500">불러오는 중...</p>
        ) : pending.length === 0 ? (
          <p className="text-[13px] text-grey-500">승인 대기 중인 신청이 없습니다.</p>
        ) : (
          pending.map((c) => (
            <div key={c.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
              <p className="text-[13.5px] font-bold text-ink">
                {c.contact_name} · {c.contact_email} {c.contact_phone ? `· ${c.contact_phone}` : ""}
              </p>
              <p className="text-[12.5px] text-grey-500 mt-1">
                희망 시간: {formatDateTime(c.starts_at)} · 출처: {c.source}
                {c.hold_expires_at && ` · hold 만료: ${formatDateTime(c.hold_expires_at)}`}
              </p>
              {c.concerns && <p className="text-[12.5px] text-grey-500 mt-1">문의: {c.concerns}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  disabled={busyId === c.id}
                  className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                  onClick={() => withBusy(c.id, () => acceptConsultationRequest(c.id))}
                >
                  수락(Calendar·Meet 생성)
                </button>
                <button
                  disabled={busyId === c.id}
                  className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                  onClick={() => withBusy(c.id, () => rejectConsultationRequest(c.id, "관리자 판단"))}
                >
                  거절
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-extrabold text-ink">예정 상담</h2>
          <div className="flex gap-1">
            {(["today", "week", "month"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={
                  "text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " +
                  (view === v ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
                }
              >
                {v === "today" ? "오늘" : v === "week" ? "주간" : "월간"}
              </button>
            ))}
          </div>
        </div>
        {scheduled.length === 0 ? (
          <p className="text-[13px] text-grey-500">해당 기간에 예정된 상담이 없습니다.</p>
        ) : (
          scheduled.map((c) => (
            <div key={c.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
              <p className="text-[13.5px] font-bold text-ink">
                {formatDateTime(c.starts_at)} · {c.contact_name}
              </p>
              <p className="text-[12.5px] text-grey-500 mt-1">
                {SYNC_STATUS_LABEL[c.google_sync_status] ?? c.google_sync_status}
                {c.google_meet_link && (
                  <>
                    {" · "}
                    <a className="underline" href={c.google_meet_link} target="_blank" rel="noreferrer">
                      Meet 링크
                    </a>
                  </>
                )}
                {c.outcome && ` · 결과: ${OUTCOME_LABEL[c.outcome] ?? c.outcome}`}
              </p>
              <p className="text-[12px] mt-1.5" style={{ color: c.consultReadiness === "ready" ? "#16a34a" : "#b91c1c" }}>
                {CONSULT_READINESS_LABEL[c.consultReadiness]}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: c.completionReadiness === "ready" ? "#16a34a" : "#b91c1c" }}>
                {COMPLETION_READINESS_LABEL[c.completionReadiness]}
              </p>
              {c.outcome === "trial_recommended" && (
                <p className="text-[12px] mt-0.5" style={{ color: c.trial_entitlement_grant_status === "granted" ? "#16a34a" : "#b91c1c" }}>
                  {TRIAL_GRANT_STATUS_LABEL[c.trial_entitlement_grant_status]}
                  {c.trial_entitlement_grant_status === "failed" && c.trial_entitlement_grant_error && ` (${c.trial_entitlement_grant_error})`}
                  {c.trial_entitlement_grant_status === "granted" && c.trial_entitlement_grant_expires_at &&
                    ` · 만료: ${formatDateTime(c.trial_entitlement_grant_expires_at)}까지 체험수업이 시작해야 사용 가능`}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  disabled={busyId === c.id}
                  className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                  onClick={() => {
                    setOutcomeOpenId(null);
                    setRescheduleOpenId(rescheduleOpenId === c.id ? null : c.id);
                    setRescheduleValue("");
                  }}
                >
                  시간 변경
                </button>
                <button
                  disabled={busyId === c.id}
                  className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                  onClick={() => withBusy(c.id, () => cancelConsultationRequest(c.id, "관리자 취소"))}
                >
                  취소
                </button>
                {c.completionReadiness === "smart_notes_not_linked" && (
                  <button
                    disabled={busyId === c.id}
                    className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                    onClick={() => withBusy(c.id, () => retryConsultationSmartNotesConfig(c.id))}
                  >
                    Smart Notes 재처리
                  </button>
                )}
                {c.outcome === "trial_recommended" && c.trial_entitlement_grant_status === "failed" && (
                  <button
                    disabled={busyId === c.id}
                    className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                    onClick={() => withBusy(c.id, () => retryTrialEntitlementGrant(c.id))}
                  >
                    체험수업권 지급 재처리
                  </button>
                )}
                <button
                  disabled={busyId === c.id || c.completionReadiness !== "ready"}
                  title={c.completionReadiness !== "ready" ? COMPLETION_READINESS_LABEL[c.completionReadiness] : undefined}
                  className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                  onClick={() => {
                    setRescheduleOpenId(null);
                    setOutcomeOpenId(outcomeOpenId === c.id ? null : c.id);
                    setOutcomeSummary("");
                    setOutcomeValue("");
                  }}
                >
                  상담 결과 기록
                </button>
              </div>

              {rescheduleOpenId === c.id && (
                <form
                  className="mt-3 flex flex-wrap items-end gap-2 border-t border-grey-200 pt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!rescheduleValue) return;
                    withBusy(c.id, () => rescheduleConsultationRequest(c.id, new Date(rescheduleValue).toISOString(), "관리자 시간 변경")).then(
                      () => setRescheduleOpenId(null)
                    );
                  }}
                >
                  <label className="text-[12px] text-ink">
                    새 상담 시간
                    <input
                      type="datetime-local"
                      required
                      value={rescheduleValue}
                      onChange={(e) => setRescheduleValue(e.target.value)}
                      className="block mt-1 px-2 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12px]"
                    />
                  </label>
                  <button type="submit" disabled={busyId === c.id} className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50">
                    변경 확정
                  </button>
                  <button type="button" className="text-[12px] text-grey-500" onClick={() => setRescheduleOpenId(null)}>
                    취소
                  </button>
                </form>
              )}

              {outcomeOpenId === c.id && (
                <form
                  className="mt-3 flex flex-col gap-2 border-t border-grey-200 pt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!outcomeValue || outcomeSummary.trim() === "") return;
                    withBusy(c.id, () =>
                      recordConsultationOutcome({ consultationId: c.id, outcome: outcomeValue, notes: "", adminReviewSummary: outcomeSummary })
                    ).then(() => setOutcomeOpenId(null));
                  }}
                >
                  <label className="text-[12px] text-ink">
                    관리자 검토 요약(고객 노출 가능, Smart Notes 원본은 자동 공개되지 않습니다 — 공백 불가)
                    <textarea
                      required
                      value={outcomeSummary}
                      onChange={(e) => setOutcomeSummary(e.target.value)}
                      className="block w-full mt-1 px-2 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12px] min-h-[60px]"
                    />
                  </label>
                  <label className="text-[12px] text-ink">
                    상담 결과
                    <select
                      required
                      value={outcomeValue}
                      onChange={(e) => setOutcomeValue(e.target.value as typeof outcomeValue)}
                      className="block mt-1 px-2 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12px]"
                    >
                      <option value="">선택하세요</option>
                      {Object.entries(OUTCOME_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" disabled={busyId === c.id} className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50">
                      기록 저장
                    </button>
                    <button type="button" className="text-[12px] text-grey-500" onClick={() => setOutcomeOpenId(null)}>
                      취소
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-extrabold text-ink">Workspace Events 구독 상태</h2>
          <div className="flex gap-2">
            <button
              className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
              onClick={() => withBusy("__renew_subscriptions", async () => { await retryExpiringWorkspaceEventsSubscriptions(); })}
            >
              만료 임박 구독 갱신 실행
            </button>
            <button
              className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
              onClick={() => withBusy("__reconcile_smart_notes", async () => { await runSmartNotesReconciliation(); })}
            >
              Smart Notes 사후 대조 실행
            </button>
          </div>
        </div>
        {subscriptions.length === 0 ? (
          <p className="text-[13px] text-grey-500">등록된 구독이 없습니다(상담·수업이 아직 확정되지 않았거나 전부 신규).</p>
        ) : (
          subscriptions.map((s) => (
            <p key={s.id} className="text-[12.5px] text-grey-700 mb-1">
              {s.organizer_email}({s.organizer_role === "consult_organizer" ? "상담 관리자" : "선생님"}) —{" "}
              <span style={{ color: s.status === "active" ? "#16a34a" : "#b91c1c" }}>{SUBSCRIPTION_STATUS_LABEL[s.status] ?? s.status}</span>
              {s.expires_at && ` · 만료: ${formatDateTime(s.expires_at)}`}
              {s.last_error && ` · 최근 오류: ${s.last_error}`}
            </p>
          ))
        )}
      </section>

      <section>
        <h2 className="text-[14px] font-extrabold text-ink mb-2">공용 상담 가능시간</h2>
        <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
          <p className="text-[12.5px] font-bold text-ink mb-2">반복 주간 가능시간</p>
          {rules.length === 0 ? (
            <p className="text-[12.5px] text-grey-500 mb-2">등록된 반복 가능시간이 없습니다.</p>
          ) : (
            rules.map((r) => (
              <p key={r.id} className="text-[12.5px] text-grey-700 mb-1">
                {WEEKDAY_LABEL[r.weekday]}요일 {r.start_time}~{r.end_time}
                {r.active && (
                  <button
                    className="ml-2 underline text-red"
                    onClick={() => withBusy(r.id, () => deactivateConsultAvailabilityRule(r.id))}
                  >
                    비활성화
                  </button>
                )}
              </p>
            ))
          )}
          <button
            className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 mt-2"
            onClick={() => {
              const weekday = window.prompt("요일(0=일 ... 6=토)");
              const start = window.prompt("시작 시각(HH:MM)");
              const end = window.prompt("종료 시각(HH:MM)");
              if (weekday == null || !start || !end) return;
              withBusy("__rule", () => addConsultAvailabilityRule({ weekday: Number(weekday), startTime: start, endTime: end }));
            }}
          >
            반복 가능시간 추가
          </button>
        </div>

        <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4">
          <p className="text-[12.5px] font-bold text-ink mb-2">날짜별 예외(휴무)</p>
          {exceptions.length === 0 ? (
            <p className="text-[12.5px] text-grey-500 mb-2">등록된 예외가 없습니다.</p>
          ) : (
            exceptions.map((ex) => (
              <p key={ex.id} className="text-[12.5px] text-grey-700 mb-1">
                {ex.exception_date} — {ex.is_closed ? "휴무" : `${ex.start_time}~${ex.end_time} 임시 오픈`}
                {ex.reason && ` (${ex.reason})`}
                <button className="ml-2 underline text-red" onClick={() => withBusy(ex.id, () => removeConsultAvailabilityException(ex.id))}>
                  삭제
                </button>
              </p>
            ))
          )}
          <button
            className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 mt-2"
            onClick={() => {
              const date = window.prompt("휴무 날짜(YYYY-MM-DD)");
              if (!date) return;
              withBusy("__exception", () => addConsultAvailabilityException({ date, isClosed: true, reason: "관리자 등록 휴무" }));
            }}
          >
            휴무일 추가
          </button>
        </div>
      </section>
    </div>
  );
}
