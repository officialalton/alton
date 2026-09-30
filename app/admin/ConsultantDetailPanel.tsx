"use client";

import { useEffect, useState } from "react";
import {
  getConsultantDetailAction,
  setStudentConsultantAction,
  setConsultantActiveAction,
  assignStudentToConsultantAction,
  type ConsultantDetail,
} from "./consultant-assignment-actions";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateTime } from "@/lib/format-datetime";

// Users > Consultants 프로필 상세(관리자 포털 정리 항목 1, 2026-09-23).
// 매칭 변경은 ConsultantAssignmentsTab과 같은 setStudentConsultantAction을
// 그대로 호출한다 — 두 화면의 변경 결과가 항상 일치해야 하기 때문.
export default function ConsultantDetailPanel({
  consultantId,
  consultantName,
  onBack,
}: {
  consultantId: string;
  consultantName: string | null;
  onBack: () => void;
}) {
  const tz = useViewerTimezone();
  const [detail, setDetail] = useState<ConsultantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [activeNotice, setActiveNotice] = useState<string | null>(null);

  function reload() {
    getConsultantDetailAction(consultantId)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultantId]);

  async function handleUnassign(studentId: string) {
    setUnassigningId(studentId);
    setError(null);
    try {
      await setStudentConsultantAction(studentId, null, "관리자 배정 해제(Users > Consultants)");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "배정 해제에 실패했습니다.");
    } finally {
      setUnassigningId(null);
    }
  }

  // 2026-09-29(B7) — 비활성화: 미확정 상담은 자동 미배정, 확정 상담은 취소 후 새 링크로 안내.
  async function handleToggleActive(nextActive: boolean) {
    if (
      !nextActive &&
      !window.confirm(
        "이 컨설턴트를 비활성화할까요? 아직 확정되지 않은 상담은 자동으로 미배정되고 예약 링크가 회수됩니다. 이미 확정된 상담은 취소 후 새 링크로 다시 잡아야 합니다."
      )
    ) {
      return;
    }
    setTogglingActive(true);
    setError(null);
    setActiveNotice(null);
    try {
      const r = await setConsultantActiveAction(consultantId, nextActive, nextActive ? undefined : "관리자 비활성화(Users > Consultants)");
      setActiveNotice(
        nextActive
          ? "다시 활성화했습니다."
          : `비활성화했습니다. 미확정 상담 ${r.unassigned}건을 미배정으로 돌렸고, 확정 상담 ${r.scheduled_remaining}건은 취소 후 새 링크가 필요합니다(신규 현황의 처리 필요 목록 참고).`
      );
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "변경에 실패했습니다.");
    } finally {
      setTogglingActive(false);
    }
  }

  async function handleAssign() {
    const email = assignEmail.trim();
    if (!email) return;
    setAssigning(true);
    setError(null);
    try {
      await assignStudentToConsultantAction(consultantId, email);
      setAssignEmail("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "배정에 실패했습니다.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="max-w-[640px]">
      <button onClick={onBack} className="text-[12.5px] font-semibold text-grey-500 mb-4">
        ← 목록으로
      </button>
      <h2 className="text-[16px] font-extrabold text-ink mb-1">{consultantName ?? "컨설턴트"}</h2>
      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}
      {!detail && !error && <p className="text-[12.5px] text-grey-500">불러오는 중...</p>}

      {detail && (
        <>
          <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
            <div className="text-[12.5px] text-grey-500">{detail.email ?? "이메일 없음"}</div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-[12px] text-grey-500">
              <div>
                <span className="text-grey-400">성별</span>
                <div className="text-ink font-semibold">{detail.gender ?? "-"}</div>
              </div>
              <div>
                <span className="text-grey-400">입사일</span>
                <div className="text-ink font-semibold">{detail.hireDate ?? "-"}</div>
              </div>
              <div>
                <span className="text-grey-400">담당 학생 수</span>
                <div className="text-ink font-semibold">{detail.currentStudents.length}명</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span
                className={`text-[11.5px] font-bold px-2 py-0.5 rounded-full ${detail.deactivatedAt ? "bg-red/10 text-red" : "bg-grey-100 text-ink"}`}
                data-testid="consultant-active-status"
              >
                {detail.deactivatedAt ? "비활성" : "활성"}
              </span>
              <button
                onClick={() => handleToggleActive(!!detail.deactivatedAt)}
                disabled={togglingActive}
                className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
              >
                {togglingActive ? "처리 중..." : detail.deactivatedAt ? "다시 활성화" : "비활성화"}
              </button>
            </div>
            {activeNotice && <p className="text-[12px] text-ink mt-2" role="status">{activeNotice}</p>}
            {detail.careerBio && (
              <p className="text-[12px] text-grey-500 mt-2 whitespace-pre-wrap">{detail.careerBio}</p>
            )}
          </div>

          <h3 className="text-[13px] font-extrabold text-ink mb-2">신규 학생 배정</h3>
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
              placeholder="학생 계정 이메일"
              className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[12.5px]"
            />
            <button
              onClick={handleAssign}
              disabled={assigning || !assignEmail.trim()}
              className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50 shrink-0"
            >
              {assigning ? "배정 중..." : "배정"}
            </button>
          </div>

          <h3 className="text-[13px] font-extrabold text-ink mb-2">담당 중인 학생·보호자</h3>
          {detail.currentStudents.length === 0 && (
            <p className="text-[12.5px] text-grey-500 mb-4">배정된 학생이 없습니다.</p>
          )}
          {detail.currentStudents.map((s) => (
            <div key={s.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3 mb-2 flex items-center justify-between">
              <div>
                <div className="text-[13px] font-bold text-ink">{s.name ?? "이름 없음"}</div>
                <div className="text-[11.5px] text-grey-500 mt-0.5">
                  보호자: {s.guardianNames.length ? s.guardianNames.join(", ") : "없음"}
                </div>
              </div>
              <button
                onClick={() => handleUnassign(s.id)}
                disabled={unassigningId === s.id}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50 shrink-0"
              >
                {unassigningId === s.id ? "해제 중..." : "배정 해제"}
              </button>
            </div>
          ))}

          <h3 className="text-[13px] font-extrabold text-ink mb-2 mt-5">배정 이력</h3>
          {detail.history.length === 0 && <p className="text-[12.5px] text-grey-500">이력이 없습니다.</p>}
          {detail.history.map((h) => (
            <div key={h.id} className="border-[1.5px] border-grey-100 rounded-xl px-4 py-2.5 mb-1.5 text-[12px]">
              <div className="text-ink font-semibold">
                {h.studentName ?? "학생"} · {h.priorConsultantName ?? "미배정"} → {h.newConsultantName ?? "미배정"}
              </div>
              <div className="text-grey-500 mt-0.5">
                {fmtDateTime(h.changedAt, undefined, tz)} {h.reason ? `· ${h.reason}` : ""}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
