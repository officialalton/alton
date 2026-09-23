"use client";

import { useEffect, useState } from "react";
import type { ConsultantWithStudents } from "./consultant-assignment-actions";
import type { IntakeConsultation } from "@/app/consultant/intake-data";
import type { TeacherAssignmentRequestRow } from "@/app/consultant/teacher-assignment-request-actions";
import {
  listConsultantsAction,
  promoteToConsultantAction,
  assignStudentToConsultantAction,
  unassignStudentFromConsultantAction,
  listUnassignedConsultationsAction,
  assignConsultationToConsultantAction,
  listAssignedAwaitingScheduleAction,
  sendConsultationSchedulingLinkAction,
  setAutoAssignEnabledAction,
} from "./consultant-assignment-actions";
import {
  listAllTeacherAssignmentRequestsAction,
  adminReprocessTeacherAssignmentRequestAction,
  adminCancelTeacherAssignmentRequestAction,
} from "./teacher-assignment-requests-actions";
import {
  getConsultantPayoutAccountAction,
  listConsultantPayoutPeriodsAction,
  listConsultantPayoutPeriodEventsAction,
  createConsultantPayoutPeriodAction,
  updateConsultantPayoutPeriodAmountAction,
  updateConsultantPayoutPeriodStatusAction,
  type ConsultantPayoutAccountAdminView,
  type ConsultantPayoutPeriodAdmin,
  type ConsultantPayoutPeriodEvent,
} from "./consultant-settlement-actions";

// 컨설턴트 포지션(2026-09-22 사용자 지시, 가볍게 시작) — 기존 계정을
// 이메일로 찾아 컨설턴트로 지정하고, 담당 학생을 이메일로 배정/해제한다.
// 신규 계정 발급 자체는 범위 밖(Supabase에서 계정을 먼저 만들어야 한다).
//
// Phase 1(2026-09-22 스펙) — "미배정 상담 요청" 큐를 추가한다. 요청 하나를
// 고르고 컨설턴트를 선택하면 intake_owner/admissions_consultant를 함께
// 배정한다(자동배정 모드는 Phase 2).
export default function ConsultantAssignmentsTab({
  initialConsultants,
  initialUnassignedConsultations,
  initialAssignedAwaitingSchedule,
  initialAutoAssignEnabled,
}: {
  initialConsultants: ConsultantWithStudents[];
  initialUnassignedConsultations: IntakeConsultation[];
  initialAssignedAwaitingSchedule: IntakeConsultation[];
  initialAutoAssignEnabled: boolean;
}) {
  const [consultants, setConsultants] = useState(initialConsultants);
  const [unassigned, setUnassigned] = useState(initialUnassignedConsultations);
  const [awaitingSchedule, setAwaitingSchedule] = useState(initialAssignedAwaitingSchedule);
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(initialAutoAssignEnabled);
  const [assignConsultant, setAssignConsultant] = useState<Record<string, string>>({});
  const [promoteEmail, setPromoteEmail] = useState("");
  const [assignEmail, setAssignEmail] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSentIds, setLinkSentIds] = useState<Set<string>>(new Set());

  async function handleToggleAutoAssign() {
    const next = !autoAssignEnabled;
    setBusy(true);
    setError(null);
    try {
      await setAutoAssignEnabledAction(next);
      setAutoAssignEnabled(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "설정을 바꾸지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function reload() {
    listConsultantsAction().then(setConsultants).catch(() => undefined);
  }

  function reloadUnassigned() {
    listUnassignedConsultationsAction().then(setUnassigned).catch(() => undefined);
    listAssignedAwaitingScheduleAction().then(setAwaitingSchedule).catch(() => undefined);
  }

  async function handleSendSchedulingLink(consultationId: string) {
    setBusy(true);
    setError(null);
    try {
      await sendConsultationSchedulingLinkAction(consultationId);
      setLinkSentIds((prev) => new Set(prev).add(consultationId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "링크를 보내지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignConsultation(consultationId: string) {
    const consultantId = assignConsultant[consultationId];
    if (!consultantId) return;
    setBusy(true);
    setError(null);
    try {
      await assignConsultationToConsultantAction(consultationId, consultantId);
      reloadUnassigned();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "배정하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePromote() {
    if (!promoteEmail.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await promoteToConsultantAction(promoteEmail.trim());
      setPromoteEmail("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "지정하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign(consultantId: string) {
    const email = assignEmail[consultantId]?.trim();
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      await assignStudentToConsultantAction(consultantId, email);
      setAssignEmail((prev) => ({ ...prev, [consultantId]: "" }));
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "배정하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnassign(consultantId: string, studentId: string) {
    setBusy(true);
    setError(null);
    try {
      await unassignStudentFromConsultantAction(consultantId, studentId);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "해제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[640px]">
      <div className="text-[12px] text-grey-500 bg-grey-100 rounded-lg px-4 py-3 mb-5">
        컨설턴트는 담당 학생의 로드맵(상담·에세이 진행 상황 포함)을 직접 작업합니다. 새 계정은 Supabase에서
        먼저 만든 뒤 여기서 이메일로 지정하세요 — 이 화면에서 계정을 새로 만들지는 않습니다.
      </div>

      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      <div className="flex items-center justify-between border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-6">
        <div>
          <div className="text-[13px] font-bold text-ink">자동배정</div>
          <div className="text-[11.5px] text-grey-500">
            {autoAssignEnabled
              ? "새 상담 요청을 신청 즉시 가능한 컨설턴트 중 무작위로 배정합니다."
              : "관리자가 요청마다 직접 컨설턴트를 배정합니다."}
          </div>
        </div>
        <button
          disabled={busy}
          onClick={handleToggleAutoAssign}
          className={
            "text-[12px] font-bold px-4 py-1.5 rounded-lg disabled:opacity-50 " +
            (autoAssignEnabled ? "bg-ink text-white" : "border-[1.5px] border-grey-200 text-ink")
          }
        >
          {autoAssignEnabled ? "자동배정 켜짐" : "자동배정 꺼짐"}
        </button>
      </div>

      <h2 className="text-[13.5px] font-bold text-ink mb-3">미배정 상담 요청 ({unassigned.length})</h2>
      {unassigned.length === 0 ? (
        <div className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-4 py-4 mb-6 text-center">
          배정 대기 중인 상담 요청이 없습니다.
        </div>
      ) : (
        <div className="mb-6">
          {unassigned.map((c) => (
            <div key={c.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2.5">
              <div className="text-[13px] font-bold text-ink">{c.contactName}</div>
              <div className="text-[12px] text-grey-500 mb-2">
                {c.contactEmail}
                {c.studentGrade ? ` · ${c.studentGrade}` : ""} · {new Date(c.requestedAt).toLocaleDateString("ko-KR")}
              </div>
              <div className="flex gap-2">
                <select
                  value={assignConsultant[c.id] ?? ""}
                  onChange={(e) => setAssignConsultant((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1 text-[12.5px]"
                >
                  <option value="">담당 컨설턴트 선택</option>
                  {consultants.map((con) => (
                    <option key={con.id} value={con.id}>
                      {con.name ?? con.email ?? "이름 없음"}
                    </option>
                  ))}
                </select>
                <button
                  disabled={busy || !assignConsultant[c.id]}
                  onClick={() => handleAssignConsultation(c.id)}
                  className="text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                >
                  배정
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-[13.5px] font-bold text-ink mb-3">일정 대기 중 ({awaitingSchedule.length})</h2>
      {awaitingSchedule.length === 0 ? (
        <div className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-4 py-4 mb-6 text-center">
          컨설턴트는 배정됐지만 일정이 아직 없는 요청이 없습니다.
        </div>
      ) : (
        <div className="mb-6">
          {awaitingSchedule.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2.5">
              <div>
                <div className="text-[13px] font-bold text-ink">{c.contactName}</div>
                <div className="text-[12px] text-grey-500">{c.contactEmail}</div>
              </div>
              {linkSentIds.has(c.id) ? (
                <span className="text-[11.5px] font-semibold text-green">링크 발송됨</span>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => handleSendSchedulingLink(c.id)}
                  className="text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                >
                  링크 보내기
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="text-[13.5px] font-bold text-ink mb-3">컨설턴트 계정</h2>
      <form
        className="flex gap-2 mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handlePromote();
        }}
      >
        <input
          value={promoteEmail}
          onChange={(e) => setPromoteEmail(e.target.value)}
          placeholder="기존 계정 이메일로 컨설턴트 지정"
          className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
        />
        <button
          type="submit"
          disabled={busy || !promoteEmail.trim()}
          className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50"
        >
          지정
        </button>
      </form>

      {consultants.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          아직 컨설턴트로 지정된 계정이 없습니다.
        </div>
      ) : (
        consultants.map((c) => (
          <div key={c.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="text-[13.5px] font-bold text-ink">{c.name ?? "이름 없음"}</div>
            <div className="text-[12px] text-grey-500 mb-3">{c.email ?? "-"}</div>

            {c.students.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {c.students.map((s) => (
                  <span
                    key={s.id}
                    className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-grey-100 text-ink flex items-center gap-1.5"
                  >
                    {s.name ?? "이름 없음"}
                    <button
                      disabled={busy}
                      onClick={() => handleUnassign(c.id, s.id)}
                      className="text-red font-bold disabled:opacity-50"
                      aria-label={`${s.name ?? "학생"} 배정 해제`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleAssign(c.id);
              }}
            >
              <input
                value={assignEmail[c.id] ?? ""}
                onChange={(e) => setAssignEmail((prev) => ({ ...prev, [c.id]: e.target.value }))}
                placeholder="학생 이메일로 배정"
                className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1 text-[12.5px]"
              />
              <button
                type="submit"
                disabled={busy || !assignEmail[c.id]?.trim()}
                className="text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
              >
                배정
              </button>
            </form>
          </div>
        ))
      )}

      <TeacherAssignmentRequestsAdminSection />
      <ConsultantSettlementAdminSection consultants={consultants} />
    </div>
  );
}

// R15-A(3/3) — 관리자는 전체 배정 요청을 보고 예외 처리(재처리/취소)할 수
// 있다. 생성은 컨설턴트 전용이라 이 화면에서 새로 만들지는 않는다.
function TeacherAssignmentRequestsAdminSection() {
  const [requests, setRequests] = useState<TeacherAssignmentRequestRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setRequests(await listAllTeacherAssignmentRequestsAction());
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    load();
  }, []);

  const needsAttention = (requests ?? []).filter((r) => r.needsReprocessing || r.status === "pending");

  return (
    <div className="mt-8 border-t border-grey-200 pt-6">
      <h2 className="text-[13.5px] font-bold text-ink mb-3">선생님 배정 요청 — 전체({requests?.length ?? 0})</h2>
      {error && <div className="mb-3 text-[12.5px] text-red">{error}</div>}
      {!requests ? (
        <p className="text-[12.5px] text-grey-500">불러오는 중...</p>
      ) : needsAttention.length === 0 ? (
        <div className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-4 py-4 text-center">
          응답 대기·재처리 필요 건이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {needsAttention.map((r) => (
            <div key={r.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
              <div className="text-[12.5px] font-bold text-ink">
                {r.studentName} — {r.status === "pending" ? "응답 대기" : "수락됨"}
                {r.needsReprocessing && <span className="text-red"> · 재처리 필요</span>}
              </div>
              {r.reprocessingError && <div className="text-[11.5px] text-red mt-0.5">{r.reprocessingError}</div>}
              <div className="flex gap-2 mt-2">
                {r.needsReprocessing && r.studentId && (
                  <button
                    disabled={busyId === r.id}
                    onClick={async () => {
                      setBusyId(r.id);
                      try {
                        await adminReprocessTeacherAssignmentRequestAction(r.id);
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "재처리에 실패했습니다.");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    className="text-[12px] font-bold px-3 py-1 rounded-lg bg-ink text-white disabled:opacity-50"
                  >
                    재처리
                  </button>
                )}
                {r.status === "pending" && (
                  <button
                    disabled={busyId === r.id}
                    onClick={async () => {
                      setBusyId(r.id);
                      try {
                        await adminCancelTeacherAssignmentRequestAction(r.id);
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "취소에 실패했습니다.");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    className="text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 text-red disabled:opacity-50"
                  >
                    요청 취소
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Phase B(5, 2026-09-23, 사용자 확정) — 관리자가 컨설턴트별 정산 기간·금액을
// 직접 입력·확정한다. 상담 건수·수업 수 자동 계산 없음. 컨설턴트를 고르면
// 그 사람의 수취 계좌(마스킹)와 지급 기간 목록(전체 상태 — draft 포함)이
// 뜬다. 금액 수정·상태 변경 버튼을 누를 때마다 이력이 남는다(아래 "이력
// 보기"에서 확인).
function ConsultantSettlementAdminSection({ consultants }: { consultants: ConsultantWithStudents[] }) {
  const [selectedConsultantId, setSelectedConsultantId] = useState("");
  const [account, setAccount] = useState<ConsultantPayoutAccountAdminView>(null);
  const [periods, setPeriods] = useState<ConsultantPayoutPeriodAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newNote, setNewNote] = useState("");
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [eventsByPeriod, setEventsByPeriod] = useState<Record<string, ConsultantPayoutPeriodEvent[]>>({});

  function reload(consultantId: string) {
    if (!consultantId) return;
    getConsultantPayoutAccountAction(consultantId).then(setAccount).catch(() => setAccount(null));
    listConsultantPayoutPeriodsAction(consultantId)
      .then(setPeriods)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }

  useEffect(() => {
    reload(selectedConsultantId);
  }, [selectedConsultantId]);

  async function handleCreate() {
    if (!selectedConsultantId || !newStart || !newEnd || !newAmount) return;
    setBusy(true);
    setError(null);
    try {
      await createConsultantPayoutPeriodAction({
        consultantId: selectedConsultantId,
        periodStart: newStart,
        periodEnd: newEnd,
        amountMinor: Math.round(Number(newAmount) * 100),
        currency: "KRW",
        note: newNote || undefined,
      });
      setNewStart("");
      setNewEnd("");
      setNewAmount("");
      setNewNote("");
      reload(selectedConsultantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAmount(periodId: string) {
    setBusy(true);
    setError(null);
    try {
      await updateConsultantPayoutPeriodAmountAction({ periodId, amountMinor: Math.round(Number(editAmount) * 100) });
      setEditingAmountId(null);
      reload(selectedConsultantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "금액을 바꾸지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(periodId: string, status: "draft" | "confirmed" | "paid") {
    setBusy(true);
    setError(null);
    try {
      await updateConsultantPayoutPeriodStatusAction({ periodId, status });
      reload(selectedConsultantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태를 바꾸지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEvents(periodId: string) {
    if (eventsByPeriod[periodId]) {
      setEventsByPeriod((prev) => {
        const next = { ...prev };
        delete next[periodId];
        return next;
      });
      return;
    }
    const events = await listConsultantPayoutPeriodEventsAction(periodId);
    setEventsByPeriod((prev) => ({ ...prev, [periodId]: events }));
  }

  return (
    <div className="mt-8">
      <h2 className="text-[15px] font-extrabold text-ink mb-3">정산</h2>
      <select
        value={selectedConsultantId}
        onChange={(e) => setSelectedConsultantId(e.target.value)}
        className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px] mb-4"
      >
        <option value="">컨설턴트 선택</option>
        {consultants.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name ?? c.id}
          </option>
        ))}
      </select>

      {selectedConsultantId && (
        <div>
          {error && <div className="mb-3 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

          <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-4">
            <div className="text-[11px] font-bold text-grey-500 uppercase tracking-wide mb-1">수취 계좌</div>
            {account ? (
              <div className="text-[13px] text-ink">
                {account.bankName} {account.accountNumberMasked} · 예금주 {account.accountHolderName}
              </div>
            ) : (
              <div className="text-[13px] text-grey-500">등록된 계좌가 없습니다.</div>
            )}
          </div>

          <form
            className="flex flex-wrap items-end gap-2 mb-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
            <span className="text-[13px] text-grey-500">~</span>
            <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="금액(원)"
              className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px] w-28"
            />
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="메모(선택)"
              className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px] flex-1 min-w-[120px]"
            />
            <button type="submit" disabled={busy || !newStart || !newEnd || !newAmount} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
              기간 등록
            </button>
          </form>

          {periods === null ? (
            <p className="text-[13px] text-grey-500">불러오는 중…</p>
          ) : periods.length === 0 ? (
            <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">등록된 정산 기간이 없습니다.</div>
          ) : (
            periods.map((p) => (
              <div key={p.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold text-ink">
                    {p.periodStart} ~ {p.periodEnd}
                  </span>
                  <span className="text-[10.5px] font-bold text-grey-500 bg-grey-100 rounded-full px-2 py-0.5">
                    {p.status === "draft" ? "작성 중(컨설턴트에게 안 보임)" : p.status === "confirmed" ? "지급 예정" : "지급 완료"}
                  </span>
                  {editingAmountId === p.id ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1 text-[12px] w-24"
                      />
                      <button disabled={busy} onClick={() => handleSaveAmount(p.id)} className="text-[11.5px] font-bold px-2 py-1 rounded-lg bg-ink text-white">
                        저장
                      </button>
                      <button onClick={() => setEditingAmountId(null)} className="text-[11.5px] font-bold text-grey-500">
                        취소
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingAmountId(p.id);
                        setEditAmount((p.amountMinor / 100).toString());
                      }}
                      className="text-[13px] font-bold text-ink underline"
                    >
                      {(p.amountMinor / 100).toLocaleString()} {p.currency}
                    </button>
                  )}
                </div>
                {p.note && <div className="text-[12px] text-grey-500 mt-1">{p.note}</div>}
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  {p.status === "draft" && (
                    <button disabled={busy} onClick={() => handleStatusChange(p.id, "confirmed")} className="text-[12px] font-bold px-3 py-1 rounded-lg bg-ink text-white disabled:opacity-50">
                      확정
                    </button>
                  )}
                  {p.status === "confirmed" && (
                    <>
                      <button disabled={busy} onClick={() => handleStatusChange(p.id, "paid")} className="text-[12px] font-bold px-3 py-1 rounded-lg bg-ink text-white disabled:opacity-50">
                        지급 완료 처리
                      </button>
                      <button disabled={busy} onClick={() => handleStatusChange(p.id, "draft")} className="text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50">
                        확정 취소
                      </button>
                    </>
                  )}
                  <button onClick={() => toggleEvents(p.id)} className="text-[12px] font-bold text-grey-500 underline">
                    {eventsByPeriod[p.id] ? "이력 접기" : "이력 보기"}
                  </button>
                </div>
                {eventsByPeriod[p.id] && (
                  <div className="mt-2 pt-2 border-t border-grey-100 text-[11.5px] text-grey-500 space-y-1">
                    {eventsByPeriod[p.id].length === 0 ? (
                      <div>이력이 없습니다.</div>
                    ) : (
                      eventsByPeriod[p.id].map((ev) => (
                        <div key={ev.id}>
                          {new Date(ev.createdAt).toLocaleString("ko-KR")} · {ev.actorName ?? "알 수 없음"} ·{" "}
                          {ev.eventType === "created" ? "생성" : ev.eventType === "amount_changed" ? "금액 변경" : "상태 변경"}
                          {ev.previousValue ? ` (${ev.previousValue} → ${ev.newValue})` : ` (${ev.newValue})`}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
