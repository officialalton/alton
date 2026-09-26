"use client";

import { useRef, useState } from "react";
import ConsultSlotPicker, { type ConsultSlotPickerHandle } from "@/app/components/ConsultSlotPicker";
import { listOpenSlotsForTokenAction, redeemSchedulingLinkAction } from "@/app/schedule-actions";

export default function ScheduleForm({ token }: { token: string }) {
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const pickerRef = useRef<ConsultSlotPickerHandle>(null);

  const fetchSlots = (fromIso: string, toIso: string) => listOpenSlotsForTokenAction(token, fromIso, toIso);

  async function handleConfirm() {
    if (!selectedSlot) {
      setError("상담 시간을 선택해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await redeemSchedulingLinkAction(token, selectedSlot);
      setConfirmed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "예약하지 못했습니다.");
      setSelectedSlot("");
      pickerRef.current?.refetch();
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="rounded-2xl border-[1.5px] border-grey-200 bg-white px-8 py-14 text-center">
        <p className="text-[18px] font-extrabold text-ink mb-2">상담 일정이 확정되었습니다.</p>
        <p className="text-[14px] text-grey-500">Google Meet 링크와 캘린더 초대를 이메일로 보내드립니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-[1.5px] border-grey-200 bg-white px-6 py-8 sm:px-10 sm:py-10">
      <p className="text-[15px] font-extrabold text-ink mb-1">상담 시간을 선택해 주세요</p>
      <p className="text-[13px] text-grey-500 mb-5">담당 컨설턴트의 가능한 시간 중에서 편한 시간을 골라주세요(60분).</p>

      <ConsultSlotPicker ref={pickerRef} fetchSlots={fetchSlots} selectedStartsAt={selectedSlot || null} onSelect={setSelectedSlot} />

      {error && <p className="text-[13px] text-red mt-3">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={submitting}
        className="mt-6 w-full px-8 py-3.5 rounded-xl bg-red text-white text-[15px] font-bold disabled:opacity-50"
      >
        {submitting ? "예약 중..." : "이 시간으로 확정하기"}
      </button>
    </div>
  );
}
