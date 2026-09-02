"use client";

import { useState } from "react";
import type { TeacherAvailabilityRuleRow } from "./availability-actions";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export type TeacherAvailabilityTabProps = {
  initialRules: TeacherAvailabilityRuleRow[];
  timezone: string;
  onAddRule: (input: { dayOfWeek: number; startTimeLocal: string; endTimeLocal: string; timezone: string; effectiveFrom: string }) => Promise<string>;
  onRemoveRule: (ruleId: string) => Promise<void>;
  onAddException: (input: { exceptionDate: string; kind: "blocked" | "available"; timezone: string; reason?: string }) => Promise<string>;
};

export default function TeacherAvailabilityTab({ initialRules, timezone, onAddRule, onRemoveRule, onAddException }: TeacherAvailabilityTabProps) {
  const [rules, setRules] = useState(initialRules);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTimeLocal, setStartTimeLocal] = useState("09:00");
  const [endTimeLocal, setEndTimeLocal] = useState("17:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionKind, setExceptionKind] = useState<"blocked" | "available">("blocked");
  const [exceptionMessage, setExceptionMessage] = useState<string | null>(null);

  async function handleAddRule() {
    setSubmitting(true);
    setError(null);
    try {
      const id = await onAddRule({
        dayOfWeek,
        startTimeLocal,
        endTimeLocal,
        timezone,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
      setRules((prev) => [...prev, { id, dayOfWeek, startTimeLocal, endTimeLocal, timezone, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveUntil: null }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveRule(ruleId: string) {
    setSubmitting(true);
    setError(null);
    try {
      await onRemoveRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddException() {
    if (!exceptionDate) return;
    setSubmitting(true);
    setError(null);
    setExceptionMessage(null);
    try {
      await onAddException({ exceptionDate, kind: exceptionKind, timezone });
      setExceptionMessage(`${exceptionDate} ${exceptionKind === "blocked" ? "휴무" : "임시 오픈"} 등록됐습니다.`);
      setExceptionDate("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">반복 가능 시간</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        매주 반복되는 수업 가능 시간을 등록하세요({timezone} 기준). 120분 수업 + 앞뒤 15분 버퍼가 자동 적용됩니다.
      </p>

      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-6">
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-[11px] font-bold text-grey-500 mb-1">요일</label>
            <select className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAY_LABELS.map((label, idx) => (
                <option key={idx} value={idx}>{label}요일</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-grey-500 mb-1">시작</label>
            <input type="time" className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={startTimeLocal} onChange={(e) => setStartTimeLocal(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-grey-500 mb-1">종료</label>
            <input type="time" className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={endTimeLocal} onChange={(e) => setEndTimeLocal(e.target.value)} />
          </div>
          <button disabled={submitting} onClick={handleAddRule} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
            추가
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-8">등록된 반복 가능 시간이 없습니다.</div>
      ) : (
        <div className="mb-8">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-grey-200 py-2.5 text-[13px]">
              <span>
                {DAY_LABELS[r.dayOfWeek]}요일 {r.startTimeLocal}~{r.endTimeLocal}
              </span>
              <button disabled={submitting} onClick={() => handleRemoveRule(r.id)} className="text-[12px] font-bold text-red disabled:opacity-50">
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-[15px] font-bold text-ink mb-2.5">날짜별 예외</h2>
      {exceptionMessage && <div className="mb-3 text-[13px] font-semibold text-ink bg-green/10 rounded-lg px-4 py-3">{exceptionMessage}</div>}
      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 flex gap-2 items-end flex-wrap">
        <div>
          <label className="block text-[11px] font-bold text-grey-500 mb-1">날짜</label>
          <input type="date" className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={exceptionDate} onChange={(e) => setExceptionDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-grey-500 mb-1">종류</label>
          <select className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={exceptionKind} onChange={(e) => setExceptionKind(e.target.value as "blocked" | "available")}>
            <option value="blocked">휴무(종일)</option>
            <option value="available">임시 오픈(종일)</option>
          </select>
        </div>
        <button disabled={submitting || !exceptionDate} onClick={handleAddException} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
          등록
        </button>
      </div>
    </div>
  );
}
