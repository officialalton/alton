"use client";

// R12.1 — 보호자 포털 "상담 신청" 서브탭. 신청 폼만 다룬다.
//
// Phase A 마무리(2026-09-23, 사용자 지시) — "보호자는 자녀별 담당 컨설턴트를
// 확인하고 그 사람에게 상담 신청... 할 수 있어야 합니다. 상담 신청 화면에는
// 담당 컨설턴트의 가능 시간만 표시하고, 현재 남아 있는 '관리자 가능 시간'
// 안내를 수정합니다. 다자녀 가족은 대상 자녀를 명시합니다." 자녀 중 하나라도
// 담당 컨설턴트가 배정돼 있으면 그 컨설턴트(들) 중 하나를 골라 그 사람의
// 실제 가용시간만 보여준다 — 관리자 일반 슬롯은 더 이상 섞지 않는다.
// 아직 아무도 배정되지 않은 신규 가족만 기존 관리자 슬롯 흐름을 그대로 쓴다
// (배정 전이라 특정 담당자가 없음 — 정상적인 케이스).

import { useEffect, useState } from "react";
import ConsultSlotPicker from "@/app/components/ConsultSlotPicker";
import {
  listOpenGuardianMeetingSlots,
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

  async function handleSubmit() {
    setError(null);
    if (!slotStartsAt) {
      setError("상담 희망 시간을 먼저 선택해주세요.");
      return;
    }
    if (!reason.trim()) {
      setError("상담 사유를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    const result = await submitMeetingRequest({
      reason,
      slotStartsAtIso: slotStartsAt,
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
    return <div className="max-w-[720px] px-5 py-6 text-[13px] text-grey-500">불러오는 중…</div>;
  }

  const hasAssignedConsultant = consultants.length > 0;

  return (
    <div className="max-w-[720px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-1">상담 신청</h2>
      <p className="text-[12.5px] text-grey-500 mb-5">
        {hasAssignedConsultant ? (
          <>
            담당 컨설턴트 <b className="text-ink">{selected?.consultantName ?? ""}</b>님의 상담 가능 시간을 선택하고, 상담
            사유를 입력해 신청할 수 있습니다.
          </>
        ) : (
          "상담 가능 시간을 선택하고, 상담 사유를 입력해 신청할 수 있습니다."
        )}{" "}
        신청 진행 상황과 대화는 각각 &quot;상담 내역&quot;·&quot;메신저&quot;에서 확인해주세요.
      </p>

      {hasAssignedConsultant && consultants.length > 1 && (
        <div className="mb-4">
          <label className="text-[11px] font-bold text-grey-500 mb-1 block">대상 자녀</label>
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
                {c.childName ?? "이름 없음"}({c.consultantName ?? "담당자"})
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4 mb-5">
        <h3 className="text-[13.5px] font-bold text-ink mb-3">상담 희망 시간(60분)</h3>
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
          <ConsultSlotPicker
            fetchSlots={listOpenGuardianMeetingSlots}
            selectedStartsAt={slotStartsAt}
            onSelect={(iso) => {
              setSlotStartsAt(iso);
              setSubmitted(false);
            }}
          />
        )}
      </section>

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4">
        {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}
        {submitted && <p className="text-[12.5px] text-green-600 mb-2">상담 신청이 접수되었습니다.</p>}
        <textarea
          aria-label="상담 사유"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setSubmitted(false);
          }}
          placeholder="상담 사유를 입력해주세요"
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[120px]"
        />
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="mt-3 px-6 py-2.5 rounded-xl bg-red text-white text-[13px] font-bold disabled:opacity-50"
        >
          {submitting ? "신청 중..." : "상담 신청하기"}
        </button>
      </section>
    </div>
  );
}
