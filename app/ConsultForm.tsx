"use client";

import { useEffect, useState } from "react";
import { listOpenHomepageConsultSlots, submitHomepageConsultRequest, type OpenConsultSlot } from "./consult-actions";

// M1 — 홈페이지 상담 신청 폼. 관리자가 열어둔 60분 슬롯 중 하나를 선택해야
// 신청이 가능하다(요구사항 2). 제출은 즉시 확정이 아니라 "승인 대기"이며,
// 관리자 수락 후 이메일로 Meet 링크·동의 안내가 온다는 것을 명시한다.

export default function ConsultForm() {
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [studentGrade, setStudentGrade] = useState("");
  const [concerns, setConcerns] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [slots, setSlots] = useState<OpenConsultSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  useEffect(() => {
    const from = new Date();
    const to = new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000); // 3주치 슬롯 노출
    listOpenHomepageConsultSlots(from.toISOString(), to.toISOString())
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("개인정보 수집·이용에 동의해주세요.");
      return;
    }
    if (!selectedSlot) {
      setError("상담 희망 시간을 선택해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await submitHomepageConsultRequest({
        parentName,
        email,
        phone,
        studentGrade,
        concerns,
        slotStartsAtIso: selectedSlot,
        idempotencyKey: `${email.trim().toLowerCase()}-${selectedSlot}`,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "신청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border-[1.5px] border-grey-200 bg-white px-8 py-14 text-center">
        <p className="text-[18px] font-extrabold text-ink mb-2">
          상담 신청이 접수되었습니다.
        </p>
        <p className="text-[14px] text-grey-500">
          신청은 아직 확정이 아닌 승인 대기 상태입니다. 관리자가 확인 후 Google Meet
          링크와 안내를 이메일로 보내드리면 상담이 확정됩니다.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border-[1.5px] border-grey-200 bg-white px-6 py-8 sm:px-10 sm:py-10"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <Field label="학부모 이름">
          <input
            required
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="연락처">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 또는 010-..."
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="이메일">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="학년">
          <input
            value={studentGrade}
            onChange={(e) => setStudentGrade(e.target.value)}
            placeholder="예: 10학년"
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <Field label="어떤 점이 고민이신가요? (선택)">
        <textarea
          value={concerns}
          onChange={(e) => setConcerns(e.target.value)}
          className={INPUT_CLASS + " min-h-[90px]"}
        />
      </Field>

      <div className="mt-5">
        <span className="block text-[12.5px] font-bold text-ink mb-1.5">상담 희망 시간(60분)</span>
        {slotsLoading ? (
          <p className="text-[13px] text-grey-500">가능한 시간을 불러오는 중...</p>
        ) : slots.length === 0 ? (
          <p className="text-[13px] text-grey-500">현재 신청 가능한 시간이 없습니다. 잠시 후 다시 시도해주세요.</p>
        ) : (
          <select
            aria-label="상담 희망 시간"
            required
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">시간을 선택하세요</option>
            {slots.map((s) => (
              <option key={s.startsAt} value={s.startsAt}>
                {new Date(s.startsAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}
              </option>
            ))}
          </select>
        )}
      </div>

      <label className="flex items-start gap-2.5 mt-5 text-[12.5px] text-grey-500">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        상담 진행을 위한 개인정보 수집·이용에 동의합니다. (이름, 연락처, 이메일 —
        상담 목적 외 사용하지 않으며 상담 종료 후 일정 기간 보관 후 파기)
      </label>

      {error && <p className="text-[13px] text-red mt-3">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full sm:w-auto px-8 py-3.5 rounded-xl bg-red text-white text-[15px] font-bold disabled:opacity-50"
      >
        {submitting ? "신청 중..." : "상담 신청하기"}
      </button>

    </form>
  );
}

const INPUT_CLASS =
  "w-full px-3.5 py-2.5 border-[1.5px] border-grey-200 rounded-[10px] text-[13.5px]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-bold text-ink mb-1.5">{label}</span>
      {children}
    </label>
  );
}
