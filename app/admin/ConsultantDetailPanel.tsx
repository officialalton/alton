"use client";

import { useEffect, useState } from "react";
import {
  getConsultantDetailAction,
  setStudentConsultantAction,
  type ConsultantDetail,
} from "./consultant-assignment-actions";

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
  const [detail, setDetail] = useState<ConsultantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);

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
            {detail.careerBio && (
              <p className="text-[12px] text-grey-500 mt-2 whitespace-pre-wrap">{detail.careerBio}</p>
            )}
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
                {new Date(h.changedAt).toLocaleString("ko-KR")} {h.reason ? `· ${h.reason}` : ""}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
