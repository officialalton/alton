"use client";

import { useState } from "react";
import { setTeacherStatus } from "./users-actions";
import type { QcWarning, TeacherListItem } from "./users-data";

const STATUS_LABEL: Record<string, string> = {
  active: "활성",
  pending: "승인 대기",
};

export default function TeacherDetailPanel({
  teacher,
  warnings,
  onBack,
  onUpdated,
}: {
  teacher: TeacherListItem;
  warnings: QcWarning[];
  onBack: () => void;
  onUpdated: (patch: Partial<TeacherListItem>) => void;
}) {
  const [status, setStatus] = useState(teacher.status);

  async function handleStatusChange(next: string) {
    setStatus(next);
    await setTeacherStatus(teacher.id, next as "active" | "pending");
    onUpdated({ status: next });
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
      </div>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          담당 과목
        </div>
        <p className="text-[13px] text-ink">
          {teacher.subjectNames.length ? teacher.subjectNames.join(", ") : "매칭된 학생 없음"}
        </p>
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
