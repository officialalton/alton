"use client";

// R15-A(3/3) — 컨설턴트가 보낸 구조화된 배정 요청. 수락하면(실제 학생이면)
// 기존 공통 매칭 경로로 바로 배정이 확정된다 — 이 화면에서 직접
// teacher_assignments를 만들지 않는다.

import { useEffect, useState } from "react";
import {
  listMyReceivedTeacherAssignmentRequestsAction,
  respondTeacherAssignmentRequestAction,
} from "./teacher-assignment-request-actions";
import type { TeacherAssignmentRequestRow } from "@/app/consultant/teacher-assignment-request-actions";

const STATUS_LABEL: Record<TeacherAssignmentRequestRow["status"], string> = {
  pending: "응답 대기",
  accepted: "수락됨",
  rejected: "거절함",
  cancelled: "취소됨",
};

export default function TeacherAssignmentRequestsTab() {
  const [requests, setRequests] = useState<TeacherAssignmentRequestRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setRequests(await listMyReceivedTeacherAssignmentRequestsAction());
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    load();
  }, []);

  async function respond(id: string, accept: boolean) {
    setBusyId(id);
    setError(null);
    try {
      await respondTeacherAssignmentRequestAction(id, accept, accept ? undefined : rejectReason);
      setRejectingId(null);
      setRejectReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const past = requests?.filter((r) => r.status !== "pending") ?? [];

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">배정 요청</h1>
      <p className="text-[13px] text-grey-500 mb-6">
        컨설턴트가 보낸 체험 과목·배정 요청입니다. 수락하면 실제 학생 계정이 있는 경우 바로 배정이 확정됩니다(아직
        계정이 없는 가입 대기 학생은 계정 생성 후 확정됩니다).
      </p>
      {error && <p className="text-[13px] text-red mb-3">{error}</p>}

      {!requests ? (
        <p className="text-[13px] text-grey-500">불러오는 중...</p>
      ) : pending.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-6">
          응답 대기 중인 요청이 없습니다.
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {pending.map((r) => (
            <div key={r.id} className="border-[1.5px] border-ink rounded-xl px-5 py-4">
              <div className="text-[14px] font-bold text-ink">{r.studentName}</div>
              <div className="text-[12.5px] text-grey-500 mt-1 space-y-0.5">
                {r.grade && <div>학년: {r.grade}</div>}
                {r.currentScore && <div>현재 성적: {r.currentScore}</div>}
                {r.goal && <div>목표: {r.goal}</div>}
                <div>{r.isNewStudent ? "신규 학생" : "기존 학생"}</div>
                {r.preferredSchedule && <div>희망 일정: {r.preferredSchedule}</div>}
                {r.requestNote && <div>요청 내용: {r.requestNote}</div>}
                {!r.studentId && <div className="text-grey-400">(아직 학생 계정 생성 전 — 사전 문의)</div>}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  disabled={busyId === r.id}
                  onClick={() => respond(r.id, true)}
                  className="text-[12.5px] font-bold text-white bg-ink rounded-lg px-3.5 py-1.5 disabled:opacity-50"
                >
                  수락
                </button>
                {rejectingId === r.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="거절 사유(필수)"
                      className="border border-grey-200 rounded px-2 py-1 text-[12px]"
                    />
                    <button
                      disabled={busyId === r.id || !rejectReason.trim()}
                      onClick={() => respond(r.id, false)}
                      className="text-[12.5px] font-bold text-red border-[1.5px] border-red/30 rounded-lg px-3 py-1.5 disabled:opacity-50"
                    >
                      거절 확정
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => setRejectingId(r.id)}
                    className="text-[12.5px] font-bold text-grey-500 border-[1.5px] border-grey-200 rounded-lg px-3.5 py-1.5 disabled:opacity-50"
                  >
                    거절
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-[14px] font-bold text-ink mb-2">지난 요청</h2>
          <div className="space-y-1.5">
            {past.map((r) => (
              <div key={r.id} className="text-[12.5px] text-grey-500 border border-grey-200 rounded-lg px-3 py-2">
                {r.studentName} — {STATUS_LABEL[r.status]}
                {r.rejectReason && ` · 사유: ${r.rejectReason}`}
                {r.needsReprocessing && <span className="text-red"> · 배정 확정 재처리 필요(관리자·컨설턴트 조치 대기)</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
