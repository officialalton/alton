"use client";

import { useRef, useState } from "react";
import { submitHomepageConsultRequest } from "./consult-actions";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("개인정보 수집·이용에 동의해주세요.");
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
          담당 컨설턴트가 배정되면 예약 링크를 이메일로 보내드립니다. 그 링크에서
          직접 편한 시간을 고르시면 상담이 확정됩니다.
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
