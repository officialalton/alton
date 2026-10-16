"use client";

import { useState } from "react";
import type { AdminAccount } from "./admin-accounts-data";
import { setAdminTierAction, setAdminCapabilitiesAction } from "./admin-accounts-actions";
import { ADMIN_CAPABILITIES } from "@/lib/admin-capabilities";

const TIER_LABEL: Record<AdminAccount["tier"], string> = {
  master: "마스터",
  full: "전체 관리자",
  supervisor: "중간 관리자(제한)",
};

// 2026-09-22(사용자 지시, 관리자 계정 구조 시작) — 마스터 계정
// (official@alton.education)만 볼 수 있는 화면. 다른 관리자를 "전체 관리자"
// (오늘과 동일하게 무제한)와 "중간 관리자"(capability로 제한)로 나누고,
// 중간 관리자에게 부여할 항목을 고른다.
//
// 중요한 한계를 화면에도 그대로 적어 둔다: capability는 예약·상담·매칭·결제·
// 정산·학생·초대·동의·워크스페이스·계정 병합 관련 액션에만 걸려 있고, 그 외
// 다수의 관리자 화면(교재·문제은행 등)은 아직 이 권한 검사가 없어 중간
// 관리자도 그대로 접근할 수 있다 — 완전한 샌드박싱이 아니다.
export default function AdminAccountsTab({ initialAccounts }: { initialAccounts: AdminAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTierChange(account: AdminAccount, tier: "full" | "supervisor") {
    setBusyId(account.id);
    setError(null);
    try {
      await setAdminTierAction(account.id, tier);
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, tier } : a)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "등급을 바꾸지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleCapability(account: AdminAccount, key: string) {
    const next = account.capabilities.includes(key)
      ? account.capabilities.filter((c) => c !== key)
      : [...account.capabilities, key];
    setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, capabilities: next } : a)));
    setBusyId(account.id);
    setError(null);
    try {
      await setAdminCapabilitiesAction(account.id, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "권한을 바꾸지 못했습니다.");
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? account : a)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-[760px]">
      <div className="text-[12px] text-grey-500 bg-grey-100 rounded-lg px-4 py-3 mb-5">
        중간 관리자는 아래에서 켠 항목의 작업만 할 수 있습니다. 단, 교재·문제은행 등 일부 화면은 아직
        이 권한 검사가 걸려 있지 않아 중간 관리자도 접근할 수 있습니다 — 완전한 제한은 아닙니다.
      </div>

      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      {accounts.map((account) => (
        <div
          key={account.id}
          data-testid={`admin-account-${account.id}`}
          className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13.5px] font-bold text-ink">{account.name ?? "이름 없음"}</div>
              <div className="text-[12px] text-grey-500">{account.email ?? "-"}</div>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-grey-100 text-grey-600">
              {TIER_LABEL[account.tier]}
            </span>
          </div>

          {account.tier !== "master" && (
            <>
              <div className="flex gap-1.5 mt-3">
                {(["full", "supervisor"] as const).map((tier) => (
                  <button
                    key={tier}
                    disabled={busyId === account.id}
                    onClick={() => handleTierChange(account, tier)}
                    className={
                      "text-[12px] font-bold px-3 py-1.5 rounded-full disabled:opacity-50 " +
                      (account.tier === tier ? "bg-ink text-white" : "bg-grey-100 text-grey-600")
                    }
                  >
                    {TIER_LABEL[tier]}
                  </button>
                ))}
              </div>

              {account.tier === "supervisor" && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-grey-100">
                  {ADMIN_CAPABILITIES.map((cap) => {
                    const on = account.capabilities.includes(cap.key);
                    return (
                      <button
                        key={cap.key}
                        disabled={busyId === account.id}
                        onClick={() => handleToggleCapability(account, cap.key)}
                        className={
                          "text-[11.5px] font-semibold px-2.5 py-1 rounded-full border-[1.5px] disabled:opacity-50 " +
                          (on ? "bg-ink text-white border-ink" : "border-grey-200 text-grey-500")
                        }
                      >
                        {on ? "✓ " : ""}
                        {cap.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
