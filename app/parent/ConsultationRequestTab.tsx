"use client";

// R12.1 — 보호자 포털 "상담 신청" 서브탭. 신청 폼만 다룬다.
//
// Phase A 마무리(2026-09-23, 사용자 지시) — "보호자는 자녀별 담당 컨설턴트를
// 확인하고 그 사람에게 상담 신청... 할 수 있어야 합니다. 상담 신청 화면에는
// 담당 컨설턴트의 가능 시간만 표시하고, 현재 남아 있는 '관리자 가능 시간'
// 안내를 수정합니다. 다자녀 가족은 대상 자녀를 명시합니다." 자녀 중 하나라도
// 담당 컨설턴트가 배정돼 있으면 그 컨설턴트(들) 중 하나를 골라 그 사람의
// 실제 가용시간만 보여준다 — 관리자 일반 슬롯은 더 이상 섞지 않는다.
// 2026-09-29 오너 규칙 — 회사 공용 슬롯은 없다. 아직 아무도 배정되지 않은 가족은
// 시간 선택 없이 사유만 접수하고(관리자 배정 큐), 배정 후 일정을 안내받는다.

import { useEffect, useState } from "react";
import ConsultSlotPicker from "@/app/components/ConsultSlotPicker";
import {
  listOpenSlotsForConsultantAction,
  getMyHouseholdConsultantsAction,
  submitMeetingRequest,
  type HouseholdChildConsultant,
} from "./inquiry-actions";

export default function ConsultationRequestTab() {
  const [consultants, setConsultants] = useState<HouseholdChildConsultant[] | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [slotStartsAt, setSlotStartsAt] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getMyHouseholdConsultantsAction()
      .then((list) => {
        setConsultants(list);
        if (list.length > 0) setSelectedChildId(list[0].childId);
      })
      .catch(() => setConsultants([]));
  }, []);

  const selected = consultants?.find((c) => c.childId === selectedChildId) ?? null;
  const hasAssignedConsultant = (consultants?.length ?? 0) > 0;

  async function handleSubmit() {
    setError(null);
    if (hasAssignedConsultant && !slotStartsAt) {
      setError("Please select a consultation time first.");
      return;
    }
    if (!reason.trim()) {
      setError("Please tell us what you'd like to discuss.");
      return;
    }
    setSubmitting(true);
    const result = await submitMeetingRequest({
      reason,
      slotStartsAtIso: hasAssignedConsultant ? (slotStartsAt ?? undefined) : undefined,
      childId: selected?.childId,
      consultantId: selected?.consultantId,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSlotStartsAt(null);
    setReason("");
    setSubmitted(true);
  }

  if (consultants === null) {
    return <div className="max-w-[720px] px-5 py-6 text-[13px] text-grey-500">Loading…</div>;
  }

  return (
    <div className="max-w-[720px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-1">Request a Consultation</h2>
      <p className="text-[12.5px] text-grey-500 mb-5">
        {hasAssignedConsultant ? (
          <>
            Pick an available time with your consultant <b className="text-ink">{selected?.consultantName ?? ""}</b> and
            tell us what you&apos;d like to discuss.
          </>
        ) : (
          "Tell us what you'd like to discuss. ALTON EDUCATION will assign a consultant and follow up with scheduling."
        )}{" "}
        Track progress and status under &quot;History&quot; and continue the conversation under &quot;Messages&quot;.
      </p>

      {hasAssignedConsultant && consultants.length > 1 && (
        <div className="mb-4">
          <label className="text-[11px] font-bold text-grey-500 mb-1 block">Child</label>
          <select
            value={selectedChildId ?? ""}
            onChange={(e) => {
              setSelectedChildId(e.target.value);
              setSlotStartsAt(null);
              setSubmitted(false);
            }}
            className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]"
          >
            {consultants.map((c) => (
              <option key={c.childId} value={c.childId}>
                {c.childName ?? "Unnamed"} ({c.consultantName ?? "Consultant"})
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4 mb-5">
        <h3 className="text-[13.5px] font-bold text-ink mb-3">Preferred Time (60 min)</h3>
        {hasAssignedConsultant ? (
          selected && (
            <ConsultSlotPicker
              key={selected.consultantId}
              fetchSlots={(from, to) => listOpenSlotsForConsultantAction(selected.consultantId, from, to)}
              selectedStartsAt={slotStartsAt}
              onSelect={(iso) => {
                setSlotStartsAt(iso);
                setSubmitted(false);
              }}
            />
          )
        ) : (
          <p className="text-[12.5px] text-grey-700">
            A consultant hasn&apos;t been assigned yet, so a time can&apos;t be selected. Leave your request below and
            ALTON EDUCATION will assign a consultant and follow up with scheduling.
          </p>
        )}
      </section>

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4">
        {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}
        {submitted && <p className="text-[12.5px] text-green-600 mb-2">Your consultation request has been received.</p>}
        <textarea
          aria-label="What would you like to discuss?"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setSubmitted(false);
          }}
          placeholder="What would you like to discuss?"
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[120px]"
        />
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="mt-3 px-6 py-2.5 rounded-xl bg-red text-white text-[13px] font-bold disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </section>
    </div>
  );
}
