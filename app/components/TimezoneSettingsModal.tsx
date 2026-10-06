"use client";

// R6 — 4개 포털(학생/학부모/선생님/관리자) 공용 시간대 설정 모달. 계정 드롭다운의
// "시간대 설정" 메뉴에서 연다. 현재 값은 모달이 열릴 때 서버 액션으로 직접
// 읽어온다(각 Shell/page.tsx에 새 prop을 추가하지 않기 위한 의도적 선택). 시간대를
// 바꾸면 확정 일정 표시는 다음 페이지 로드 시 resolveUserTimezone() 기준으로
// 자동 반영된다 — 저장된 timestamptz 자체는 바뀌지 않는다(순수 표시 레이어).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TIMEZONE_OPTIONS } from "@/lib/timezone";
import { nearestSupportedTimezone } from "@/lib/schedule-timezone";
import {
  getMyTimezoneSettings,
  updateMyTimezone,
  updateHouseholdDefaultTimezone,
} from "@/lib/timezone-actions";

export default function TimezoneSettingsModal({
  onClose,
  showHouseholdDefault,
  suggestBrowserTimezone = false,
}: {
  onClose: () => void;
  /** 학부모 포털에서만 "가족 기본 시간대" 섹션을 보여준다. */
  showHouseholdDefault: boolean;
  /** 저장된 개인 시간대가 없을 때 브라우저 감지 값(지원 목록 중 가장 가까운 것)을 미리 선택하고, 해제 버튼을 숨긴다(선생님 온보딩). */
  suggestBrowserTimezone?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [isPrimaryGuardian, setIsPrimaryGuardian] = useState(false);
  // personal: 드롭다운에 항상 "실제로 지금 적용 중인 구체적 IANA 시간대"를 보여준다.
  // 개인 시간대를 명시적으로 설정 안 한 경우에도 가족 기본값(혹은 America/Los_Angeles)으로
  // 채워진다 — "가족 기본값 사용"이라는 추상적 옵션은 선택 상태로 노출되지 않는다.
  const [personal, setPersonal] = useState<string>("America/Los_Angeles");
  // hasOverride: 개인 시간대를 명시적으로 고정했는지 여부. false면 저장 시 개인 시간대
  // 컬럼을 null로 유지해 가족 기본값 변경을 계속 따라가고, true면 personal 값을 저장한다.
  const [hasOverride, setHasOverride] = useState(false);
  const [household, setHousehold] = useState<string>("America/Los_Angeles");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [suggested, setSuggested] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyTimezoneSettings().then((s) => {
      if (cancelled) return;
      const resolvedHousehold = s.householdDefaultTimezone ?? "America/Los_Angeles";
      if (suggestBrowserTimezone && s.profileTimezone == null) {
        // 마운트 뒤(effect)에만 브라우저 값을 읽는다 — hydration 안전.
        let browser: string | undefined;
        try {
          browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
          browser = undefined;
        }
        setPersonal(nearestSupportedTimezone(browser));
        setHasOverride(true);
        setSuggested(true);
      } else {
        setPersonal(s.profileTimezone ?? resolvedHousehold);
        setHasOverride(s.profileTimezone != null);
      }
      setHousehold(resolvedHousehold);
      setHouseholdId(s.householdId);
      setIsPrimaryGuardian(s.isPrimaryGuardian);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateMyTimezone(hasOverride ? personal : null);
      if (showHouseholdDefault && isPrimaryGuardian && householdId) {
        await updateHouseholdDefaultTimezone(householdId, household);
      }
      setDone(true);
      router.refresh();
      // 저장이 끝나면 창을 닫는다(반영은 refresh로 바로 된다).
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border-[1.5px] border-grey-200 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-ink">Time zone settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-[18px] leading-none text-grey-400 hover:bg-grey-50 hover:text-ink"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-[13px] text-grey-400 py-6 text-center">Loading…</p>
        ) : (
          <>
            {showHouseholdDefault && (
              <div className="mb-5">
                <p className="text-[12.5px] font-semibold text-ink mb-1">Family default time zone</p>
                <p className="text-[11.5px] text-grey-400 mb-2">
                  Family members who haven&apos;t set a personal time zone will see schedules in this time zone.
                  {!isPrimaryGuardian && " (Only the primary parent can change this.)"}
                </p>
                <select
                  value={household}
                  disabled={!isPrimaryGuardian || !householdId}
                  onChange={(e) => setHousehold(e.target.value)}
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] disabled:bg-grey-50 disabled:text-grey-400"
                >
                  {TIMEZONE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-5">
              <p className="text-[12.5px] font-semibold text-ink mb-1">My time zone</p>
              <p className="text-[11.5px] text-grey-400 mb-2">
                {suggested && !done
                  ? "We pre-selected the time zone detected from your browser. Check that it's correct and save."
                  : hasOverride
                  ? "You've set a personal time zone. It stays even if the family default changes."
                  : "You're following the family default. Selecting a different time zone sets it as your personal time zone."}
              </p>
              <select
                value={personal}
                onChange={(e) => {
                  setPersonal(e.target.value);
                  setHasOverride(true);
                }}
                className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px]"
              >
                {TIMEZONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {hasOverride && !suggestBrowserTimezone && (
                <button
                  type="button"
                  onClick={() => {
                    setHasOverride(false);
                    setPersonal(household);
                  }}
                  className="mt-2 text-[12px] font-semibold text-grey-500 underline"
                >
                  Clear personal setting (follow family default)
                </button>
              )}
            </div>

            {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-grey-500">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 rounded-lg bg-red text-white text-[13px] font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
