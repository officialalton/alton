"use client";

import { useState } from "react";
import type { ConsultantWithStudents } from "./consultant-assignment-actions";
import type { IntakeConsultation } from "@/app/consultant/intake-data";
import {
  listConsultantsAction,
  promoteToConsultantAction,
  assignStudentToConsultantAction,
  unassignStudentFromConsultantAction,
  listUnassignedConsultationsAction,
  assignConsultationToConsultantAction,
  listAssignedAwaitingScheduleAction,
  sendConsultationSchedulingLinkAction,
} from "./consultant-assignment-actions";

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
}: {
  initialConsultants: ConsultantWithStudents[];
  initialUnassignedConsultations: IntakeConsultation[];
  initialAssignedAwaitingSchedule: IntakeConsultation[];
}) {
  const [consultants, setConsultants] = useState(initialConsultants);
  const [unassigned, setUnassigned] = useState(initialUnassignedConsultations);
  const [awaitingSchedule, setAwaitingSchedule] = useState(initialAssignedAwaitingSchedule);
  const [assignConsultant, setAssignConsultant] = useState<Record<string, string>>({});
  const [promoteEmail, setPromoteEmail] = useState("");
  const [assignEmail, setAssignEmail] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSentIds, setLinkSentIds] = useState<Set<string>>(new Set());

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
    </div>
  );
}
