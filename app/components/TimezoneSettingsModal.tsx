"use client";

// R6 — 4개 포털(학생/학부모/선생님/관리자) 공용 시간대 설정 모달. 계정 드롭다운의
// "시간대 설정" 메뉴에서 연다. 현재 값은 모달이 열릴 때 서버 액션으로 직접
// 읽어온다(각 Shell/page.tsx에 새 prop을 추가하지 않기 위한 의도적 선택). 시간대를
// 바꾸면 확정 일정 표시는 다음 페이지 로드 시 resolveUserTimezone() 기준으로
// 자동 반영된다 — 저장된 timestamptz 자체는 바뀌지 않는다(순수 표시 레이어).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TIMEZONE_OPTIONS } from "@/lib/timezone";
import {
  getMyTimezoneSettings,
  updateMyTimezone,
  updateHouseholdDefaultTimezone,
} from "@/lib/timezone-actions";

export default function TimezoneSettingsModal({
  onClose,
  showHouseholdDefault,
}: {
  onClose: () => void;
  /** 학부모 포털에서만 "가족 기본 시간대" 섹션을 보여준다. */
  showHouseholdDefault: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [isPrimaryGuardian, setIsPrimaryGuardian] = useState(false);
  const [personal, setPersonal] = useState<string>("");
  const [household, setHousehold] = useState<string>("America/Los_Angeles");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyTimezoneSettings().then((s) => {
      if (cancelled) return;
      setPersonal(s.profileTimezone ?? "");
      setHousehold(s.householdDefaultTimezone ?? "America/Los_Angeles");
      setHouseholdId(s.householdId);
      setIsPrimaryGuardian(s.isPrimaryGuardian);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateMyTimezone(personal === "" ? null : personal);
      if (showHouseholdDefault && isPrimaryGuardian && householdId) {
        await updateHouseholdDefaultTimezone(householdId, household);
      }
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border-[1.5px] border-grey-200 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-ink">시간대 설정</h2>
          <button onClick={onClose} className="text-grey-400 text-[13px]">닫기</button>
        </div>

        {loading ? (
          <p className="text-[13px] text-grey-400 py-6 text-center">불러오는 중...</p>
        ) : (
          <>
            {showHouseholdDefault && (
              <div className="mb-5">
                <p className="text-[12.5px] font-semibold text-ink mb-1">가족 기본 시간대</p>
                <p className="text-[11.5px] text-grey-400 mb-2">
                  가족 구성원이 개인 시간대를 따로 설정하지 않으면 이 값을 기준으로 일정이 표시됩니다.
                  {!isPrimaryGuardian && " (주 보호자만 변경할 수 있습니다)"}
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
              <p className="text-[12.5px] font-semibold text-ink mb-1">내 개인 시간대 (선택)</p>
              <p className="text-[11.5px] text-grey-400 mb-2">
                설정하면 가족 기본값보다 우선 적용됩니다. 비워두면 가족 기본값을 따릅니다.
              </p>
              <select
                value={personal}
                onChange={(e) => setPersonal(e.target.value)}
                className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px]"
              >
                <option value="">가족 기본값 사용</option>
                {TIMEZONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}
            {done && !error && <p className="text-[12.5px] text-green mb-3">저장했습니다.</p>}
          </>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-grey-500">
            닫기
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 rounded-lg bg-red text-white text-[13px] font-semibold disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
