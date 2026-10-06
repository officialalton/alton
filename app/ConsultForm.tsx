"use client";

import { useRef, useState } from "react";
import { submitHomepageConsultRequest } from "./consult-actions";
import { trackEvent } from "@/lib/analytics/track";

// M1 — 홈페이지 상담 신청 폼.
// 2026-09-22(컨설턴트 스펙 Phase 2b, 사용자 승인 "지금 바로 랜딩 폼도 스펙대로
// 고침") — 슬롯 선택 UI를 없앴다. 신청은 접수만 되고(status='requested',
// starts_at=null), 관리자가 어드미션 컨설턴트를 배정하면 그 사람 전용
// 스케줄링 링크가 담긴 안내 메일로 고객이 직접 시간을 고른다(더 이상 회사
// 공용 캘린더를 홈페이지에 노출하지 않는다).

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
  const submissionNonceRef = useRef<string | null>(null);
  if (submissionNonceRef.current === null) {
    submissionNonceRef.current = crypto.randomUUID();
  }

  function handleFormFocus() {
    // 제품 분석 P0(2026-09-25) — 폼을 처음 열거나 작성을 시작한 시점(첫 입력 포커스)에
    // 1회만 발생. submissionNonceRef는 이 폼 인스턴스마다 한 번만 만들어지므로
    // onceKey로 쓰면 리렌더·재포커스로 중복 집계되지 않는다.
    trackEvent("consultation_started", { entry_point: "landing_form" }, { onceKey: submissionNonceRef.current! });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("Please agree to the collection and use of your personal information.");
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
        idempotencyKey: `${email.trim().toLowerCase()}-${submissionNonceRef.current}`,
      });
      setSubmitted(true);
      // 서버 저장이 성공한 뒤에만 발생 — 실패 시(catch)에는 절대 보내지 않는다.
      trackEvent(
        "consultation_submitted",
        { entry_point: "landing_form", consultation_type: "homepage" },
        { onceKey: submissionNonceRef.current! }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border-[1.5px] border-grey-200 bg-white px-8 py-14 text-center">
        <p className="text-[18px] font-extrabold text-ink mb-2">
          Your consultation request has been received.
        </p>
        <p className="text-[14px] text-grey-500">
          Once a consultant is assigned, we&apos;ll email you a booking link. Pick a time
          that works for you there, and your consultation is confirmed.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onFocusCapture={handleFormFocus}
      className="rounded-2xl border-[1.5px] border-grey-200 bg-white px-6 py-8 sm:px-10 sm:py-10"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <Field label="Parent name">
          <input
            required
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 or 010-..."
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Student's grade">
          <input
            value={studentGrade}
            onChange={(e) => setStudentGrade(e.target.value)}
            placeholder="e.g. 10th grade"
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <Field label="What would you like help with? (optional)">
        <textarea
          value={concerns}
          onChange={(e) => setConcerns(e.target.value)}
          className={INPUT_CLASS + " min-h-[90px]"}
        />
      </Field>

      <label className="flex items-start gap-2.5 mt-5 text-[12.5px] text-grey-500">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        I agree to the collection and use of my personal information for this consultation.
        (Name, phone, and email are used only for the consultation and deleted after a
        retention period once it ends.)
      </label>

      {error && <p className="text-[13px] text-red mt-3">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full sm:w-auto px-8 py-3.5 rounded-xl bg-red text-white text-[15px] font-bold disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Request a consultation"}
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
