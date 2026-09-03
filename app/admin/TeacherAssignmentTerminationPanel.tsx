"use client";

// M3 — 선생님 배정 종료 관리자 패널. 요청 목록/영향 미리보기/처리(재배정·수강종료)를
// 다룬다. 데이터는 마운트 시 서버 액션으로 직접 불러온다(별도 페이지 데이터 로더 없이
// MatchingTab 하단에 얹는 형태 — R5 매칭 화면과 같은 관리자 권한 범위이므로 자연스럽다).

import { useEffect, useState } from "react";
import {
  listTerminationRequests,
  previewTerminationImpactAction,
  processTerminationRequestAction,
  type TerminationRequestListItem,
  type TeachingHistoryItem,
  listSubjectTeachingHistoryForCurrentTeacher,
} from "./teacher-assignment-termination-actions";
import type { TerminationImpactReservation } from "@/lib/enrollment/teacher-assignment-termination";

const STATUS_LABEL: Record<string, string> = {
  requested: "요청됨",
  processing: "처리 중",
  completed: "완료",
  failed: "실패 — 재처리 필요",
  cancelled: "취소됨",
};

export default function TeacherAssignmentTerminationPanel() {
  const [requests, setRequests] = useState<TerminationRequestListItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [impact, setImpact] = useState<TerminationImpactReservation[] | null>(null);
  const [history, setHistory] = useState<TeachingHistoryItem[] | null>(null);
  const [resolution, setResolution] = useState<"reassign" | "end_enrollment">("end_enrollment");
  const [newTeacherId, setNewTeacherId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setRequests(await listTerminationRequests());
    } catch {
      setRequests([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function openRequest(r: TerminationRequestListItem) {
    setOpenId(r.id);
    setImpact(null);
    setHistory(null);
    setError(null);
    const [impactData, historyData] = await Promise.all([
      previewTerminationImpactAction(r.teacherAssignmentId).catch(() => []),
      listSubjectTeachingHistoryForCurrentTeacher(r.subjectEnrollmentId).catch(() => []),
    ]);
    setImpact(impactData);
    setHistory(historyData);
  }

  async function process(r: TerminationRequestListItem) {
    setBusy(true);
    setError(null);
    try {
      const result = await processTerminationRequestAction({
        requestId: r.id,
        resolution,
        newTeacherId: resolution === "reassign" ? newTeacherId : undefined,
        effectiveFrom: resolution === "reassign" ? effectiveFrom : undefined,
      });
      if (result.status === "failed") {
        setError(result.error ?? "처리 중 오류가 발생했습니다.");
      } else {
        setOpenId(null);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!requests) return null;

  return (
    <div className="max-w-[640px] px-8 py-8 border-t border-grey-200 mt-8">
      <h2 className="text-[16px] font-extrabold text-ink mb-1.5">선생님 배정 종료 요청</h2>
      <p className="text-[13px] text-grey-500 mb-5">
        trial/regular 구분 없이 단일 배정 관계에 대한 정식 종료(재배정 또는 수강 종료) 요청 목록입니다.
      </p>

      {requests.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          접수된 종료 요청이 없습니다.
        </div>
      ) : (
        requests.map((r) => (
          <div key={r.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13.5px] font-bold text-ink">
                  요청자: {r.requestedByRole} · {STATUS_LABEL[r.status] ?? r.status}
                </div>
                <div className="text-[12px] text-grey-500 mt-0.5">사유: {r.reason}</div>
                {r.error && <div className="text-[12px] text-red-600 mt-0.5">오류: {r.error}</div>}
              </div>
              {(r.status === "requested" || r.status === "failed") && (
                <button
                  className="text-[12.5px] font-semibold text-blue-600"
                  onClick={() => openRequest(r)}
                >
                  {r.status === "failed" ? "재처리" : "처리"}
                </button>
              )}
            </div>

            {openId === r.id && (
              <div className="mt-3 border-t border-grey-100 pt-3">
                {impact === null ? (
                  <div className="text-[12.5px] text-grey-500">영향 확인 중...</div>
                ) : (
                  <div className="text-[12.5px] text-grey-600 mb-2">
                    영향받는 미래 예약 {impact.length}건
                    {impact.some((i) => i.hasActiveHold) && " (보유분 있음)"}
                  </div>
                )}

                {history !== null && (
                  <div className="text-[12px] text-grey-500 mb-2">
                    과거 수업 이력 {history.length}건 확인됨 (Smart Notes 원본·정산 정보는 노출되지 않음)
                  </div>
                )}

                <div className="flex items-center gap-3 mb-2">
                  <label className="text-[12.5px] flex items-center gap-1">
                    <input
                      type="radio"
                      checked={resolution === "end_enrollment"}
                      onChange={() => setResolution("end_enrollment")}
                    />
                    수강 종료
                  </label>
                  <label className="text-[12.5px] flex items-center gap-1">
                    <input
                      type="radio"
                      checked={resolution === "reassign"}
                      onChange={() => setResolution("reassign")}
                    />
                    새 선생님으로 재배정
                  </label>
                </div>

                {resolution === "reassign" && (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      className="border border-grey-300 rounded px-2 py-1 text-[12.5px]"
                      placeholder="새 선생님 ID"
                      value={newTeacherId}
                      onChange={(e) => setNewTeacherId(e.target.value)}
                    />
                    <input
                      className="border border-grey-300 rounded px-2 py-1 text-[12.5px]"
                      type="date"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                    />
                  </div>
                )}

                {error && <div className="text-[12.5px] text-red-600 mb-2">{error}</div>}

                <button
                  disabled={busy}
                  onClick={() => process(r)}
                  className="text-[12.5px] font-bold text-white bg-ink rounded px-3 py-1.5 disabled:opacity-50"
                >
                  {busy ? "처리 중..." : "종료 처리 확정"}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
