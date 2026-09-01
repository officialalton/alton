"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setTeacherStatus, setTeacherCalendlyUrl, setTeacherHourlyRate } from "./users-actions";
import { assignTeacherSubject, unassignTeacherSubject } from "./teacher-subjects-actions";
import type { AdminSubject } from "./subject-data";
import type { QcWarning, TeacherListItem } from "./users-data";

const STATUS_LABEL: Record<string, string> = {
  active: "활성",
  pending: "승인 대기",
  suspended: "일시정지",
};

export default function TeacherDetailPanel({
  teacher,
  warnings,
  subjects,
  onBack,
  onUpdated,
}: {
  teacher: TeacherListItem;
  warnings: QcWarning[];
  subjects: AdminSubject[];
  onBack: () => void;
  onUpdated: (patch: Partial<TeacherListItem>) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(teacher.status);
  const [savedStatus, setSavedStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [assignedSubjectIds, setAssignedSubjectIds] = useState(teacher.assignedSubjectIds);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [togglingSubjectId, setTogglingSubjectId] = useState<string | null>(null);
  const [savedSubjectId, setSavedSubjectId] = useState<string | null>(null);
  const [calendlyUrl, setCalendlyUrl] = useState(teacher.calendlySchedulingUrl ?? "");
  const [savingUrl, setSavingUrl] = useState(false);
  const [savedUrl, setSavedUrl] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(
    teacher.hourlyRateKrw != null ? String(teacher.hourlyRateKrw) : ""
  );
  const [savingRate, setSavingRate] = useState(false);
  const [savedRate, setSavedRate] = useState(false);

  async function handleToggleSubject(subjectId: string) {
    if (togglingSubjectId) return;
    setSubjectError(null);
    setSavedSubjectId(null);
    setTogglingSubjectId(subjectId);
    try {
      if (assignedSubjectIds.includes(subjectId)) {
        await unassignTeacherSubject(teacher.id, subjectId);
        const next = assignedSubjectIds.filter((id) => id !== subjectId);
        setAssignedSubjectIds(next);
        onUpdated({ assignedSubjectIds: next });
      } else {
        await assignTeacherSubject(teacher.id, subjectId);
        const next = [...assignedSubjectIds, subjectId];
        setAssignedSubjectIds(next);
        onUpdated({ assignedSubjectIds: next });
      }
      setSavedSubjectId(subjectId);
      // 매칭 탭의 과목별 선생님 후보 목록은 admin/page.tsx 로드 시점에 고정된
      // props라서, 여기서 서버 데이터를 갱신해줘야 다른 탭에도 반영된다.
      router.refresh();
    } catch (e) {
      setSubjectError(e instanceof Error ? e.message : "과목 배정 처리에 실패했습니다.");
    } finally {
      setTogglingSubjectId(null);
    }
  }

  async function handleStatusChange(next: string) {
    const previous = status;
    setStatus(next);
    setSavedStatus(false);
    setStatusError(null);
    try {
      await setTeacherStatus(teacher.id, next as "active" | "pending" | "suspended");
      onUpdated({ status: next });
      setSavedStatus(true);
    } catch (e) {
      setStatus(previous);
      setStatusError(
        e instanceof Error ? e.message : "상태 전환에 실패했습니다."
      );
    }
  }

  async function handleSaveCalendlyUrl() {
    setSavingUrl(true);
    setSavedUrl(false);
    try {
      await setTeacherCalendlyUrl(teacher.id, calendlyUrl);
      onUpdated({ calendlySchedulingUrl: calendlyUrl.trim() || null });
      setSavedUrl(true);
    } finally {
      setSavingUrl(false);
    }
  }

  async function handleSaveHourlyRate() {
    const rate = Number(hourlyRate);
    if (!rate || rate <= 0) return;
    setSavingRate(true);
    setSavedRate(false);
    try {
      await setTeacherHourlyRate(teacher.id, rate);
      onUpdated({ hourlyRateKrw: rate });
      setSavedRate(true);
    } finally {
      setSavingRate(false);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold mb-4">
        ← 뒤로
      </button>
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">{teacher.name}</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        {teacher.email} {teacher.school ? `· ${teacher.school}` : ""}
      </p>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          상태
        </div>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] font-semibold"
        >
          {Object.entries(STATUS_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        {savedStatus && <p className="text-[12px] text-green mt-1.5">✓ 저장되었습니다</p>}
        {statusError && <p className="text-[12px] text-red mt-1.5">{statusError}</p>}
      </div>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          담당 과목
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {subjects.map((s) => {
            const assigned = assignedSubjectIds.includes(s.subjectId);
            return (
              <button
                key={s.subjectId}
                disabled={togglingSubjectId === s.subjectId}
                onClick={() => handleToggleSubject(s.subjectId)}
                className={
                  "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] disabled:opacity-50 " +
                  (assigned ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
                }
              >
                {s.subjectName}
              </button>
            );
          })}
        </div>
        {subjectError && <p className="text-[12px] text-red">{subjectError}</p>}
        {!subjectError && savedSubjectId && (
          <p className="text-[12px] text-green mt-1">✓ 저장되었습니다</p>
        )}
      </div>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          매칭된 학생 (수강 중)
        </div>
        <p className="text-[13px] text-ink">
          {teacher.subjectNames.length ? teacher.subjectNames.join(", ") : "매칭된 학생 없음"}
        </p>
      </div>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          개인 예약 링크 (Calendly)
        </div>
        <p className="text-[12px] text-grey-500 mb-2">
          Calendly에서 이 선생님을 팀원으로 초대하고 개인 이벤트 타입을 만든 뒤,
          그 예약 페이지 URL을 여기에 넣으면 학생 포털에서 이 선생님과 직접
          회차를 예약할 수 있습니다. 이벤트 타입 만들 때 화상 회의 연동을
          <b> Zoom으로 반드시 설정</b>해주세요(Calendly 기본값은 Google Meet).
        </p>
        <div className="flex gap-2">
          <input
            value={calendlyUrl}
            onChange={(e) => setCalendlyUrl(e.target.value)}
            placeholder="https://calendly.com/xxx-teacher/session"
            className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
          <button
            disabled={savingUrl}
            onClick={handleSaveCalendlyUrl}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50 shrink-0"
          >
            {savingUrl ? "저장 중..." : "저장"}
          </button>
        </div>
        {savedUrl && <p className="text-[12px] text-green mt-1.5">✓ 저장되었습니다</p>}
      </div>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          시급 (정산 기준)
        </div>
        <div className="flex gap-2">
          <input
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            type="number"
            min="1"
            placeholder="예: 30000"
            className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
          <button
            disabled={savingRate}
            onClick={handleSaveHourlyRate}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50 shrink-0"
          >
            {savingRate ? "저장 중..." : "저장"}
          </button>
        </div>
        {savedRate && <p className="text-[12px] text-green mt-1.5">✓ 저장되었습니다</p>}
      </div>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          QC 경고 이력 ({warnings.length})
        </div>
        {warnings.length === 0 ? (
          <p className="text-[13px] text-grey-500">경고 이력이 없습니다.</p>
        ) : (
          warnings.map((w) => (
            <div key={w.id} className="border-b border-grey-100 last:border-0 py-2">
              <div className="text-[12.5px] font-bold text-ink">
                {w.type}
                {w.studentName ? ` · ${w.studentName}` : ""}
              </div>
              {w.detail && <p className="text-[12.5px] text-grey-500 mt-0.5">{w.detail}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
