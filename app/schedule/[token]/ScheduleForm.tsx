"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ConsultSlotPicker, { type ConsultSlotPickerHandle } from "@/app/components/ConsultSlotPicker";
import { listOpenSlotsForTokenAction, redeemSchedulingLinkAction } from "@/app/schedule-actions";
import SchedulingLinkInvalid from "./SchedulingLinkInvalid";
import { DEFAULT_TIMEZONE, timezoneLabel } from "@/lib/timezone";
import { fmtDateTime } from "@/lib/format-datetime";
import { detectInitialScheduleTimezone, saveScheduleTimezone } from "@/lib/schedule-timezone";

export default function ScheduleForm({ token }: { token: string }) {
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState("");
  const [linkInvalid, setLinkInvalid] = useState(false);
  const pickerRef = useRef<ConsultSlotPickerHandle>(null);
  // hydration 안전: 서버 렌더와 첫 클라이언트 렌더는 항상 기본 시간대, 마운트 뒤에 저장값/브라우저 감지값으로 바꾼다.
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration 안전: 브라우저 값은 마운트 뒤에만 읽는다
    setTimezone(detectInitialScheduleTimezone());
  }, []);
  function handleTimezoneChange(tz: string) {
    setTimezone(tz);
    saveScheduleTimezone(tz);
  }

  // 서버 액션은 무효 토큰을 throw 하지 않고 결과값으로 돌려준다(프로덕션에서 문구가 가려지지 않도록).
  // useCallback 으로 고정한다: 렌더마다 새 함수를 넘기면 ConsultSlotPicker 의 useEffect 가 부모가 다시
  // 그려질 때마다(슬롯 선택·제출 중·제출 완료) 슬롯을 재조회하고, 예약 직후의 재조회는 이미 사용된
  // 토큰이라 invalid_link 가 되어 확정 화면을 덮어 버렸다(2026-09-29 e2e 발견).
  const fetchSlots = useCallback(
    async (fromIso: string, toIso: string) => {
      const r = await listOpenSlotsForTokenAction(token, fromIso, toIso);
      if (r.ok) return r.slots;
      if (r.reason === "invalid_link") {
        setLinkInvalid(true);
        return [];
      }
      throw new Error(r.error);
    },
    [token],
  );

  async function handleConfirm() {
    if (!selectedSlot) {
      setError("상담 시간을 선택해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await redeemSchedulingLinkAction(token, selectedSlot, timezone);
      if (r.ok) {
        setConfirmedSlot(selectedSlot);
        setConfirmed(true);
      } else if (r.reason === "invalid_link") {
        setLinkInvalid(true);
      } else {
        setError(r.error);
        setSelectedSlot("");
        pickerRef.current?.refetch();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "예약하지 못했습니다.");
      setSelectedSlot("");
      pickerRef.current?.refetch();
    } finally {
      setSubmitting(false);
    }
  }

  // 확정된 뒤에는 무엇이 와도 확정 화면이 우선한다(토큰은 확정과 동시에 소진된다).
  if (linkInvalid && !confirmed) return <SchedulingLinkInvalid />;

  if (confirmed) {
    return (
      <div className="rounded-2xl border-[1.5px] border-grey-200 bg-white px-8 py-14 text-center">
        <p className="text-[18px] font-extrabold text-ink mb-2">상담 일정이 확정되었습니다.</p>
        {confirmedSlot && (
          <p className="text-[14px] font-bold text-ink mb-2" data-testid="schedule-confirmed-time">
            {fmtDateTime(confirmedSlot, { dateStyle: "full", timeStyle: "short" }, timezone)} ({timezoneLabel(timezone)})
          </p>
        )}
        <p className="text-[14px] text-grey-500">Google Meet 링크와 캘린더 초대를 이메일로 보내드립니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-[1.5px] border-grey-200 bg-white px-6 py-8 sm:px-10 sm:py-10">
      <p className="text-[15px] font-extrabold text-ink mb-1">상담 시간을 선택해 주세요</p>
      <p className="text-[13px] text-grey-500 mb-5">담당 컨설턴트의 가능한 시간 중에서 편한 시간을 골라주세요(60분).</p>

      <ConsultSlotPicker ref={pickerRef} fetchSlots={fetchSlots} timezone={timezone} onTimezoneChange={handleTimezoneChange} selectedStartsAt={selectedSlot || null} onSelect={setSelectedSlot} />

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
