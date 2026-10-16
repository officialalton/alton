"use client";

// 2026-09-29 온보딩 정책 라운드 — 관리자가 "아무도 모르면 멈추는" 건을 한곳에서 보는 큐.
//  · 컨설턴트가 체험을 확정했지만 온보딩 안내가 아직 안 나간 건(B2) — 발송 권한은 관리자 전용
//  · 컨설턴트 비활성화로 미배정된 미확정 상담(B7), 비활성 컨설턴트의 확정 상담("취소 후 새 링크")
//  · 체험권이 소진·만료된 체험 추천 건(E1/E2/E4) — 사유를 남기고 수동 재지급(종류별 1회)
// 비어 있으면 아무것도 그리지 않는다.

import { useState } from "react";
import {
  listOnboardingAttentionAction,
  regrantTrialEntitlementAction,
  type OnboardingAttentionQueue,
} from "./onboarding-attention-actions";
import { useTabCachedData } from "./use-tab-cached-data";

const STATE_LABEL = { exhausted: "소진", expired: "만료" } as const;

export default function OnboardingAttentionPanel({ onOpenConsultation }: { onOpenConsultation?: (id: string) => void }) {
  const { data, refresh } = useTabCachedData<OnboardingAttentionQueue>({
    cacheKey: "onboarding-attention-queue",
    ttlMs: 15_000,
    fetcher: listOnboardingAttentionAction,
  });
  const [reasonByChild, setReasonByChild] = useState<Record<string, string>>({});
  const [busyChild, setBusyChild] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!data) return null;
  const total =
    data.onboarding_send_pending.length +
    data.unassigned_inactive_consultant.length +
    data.scheduled_inactive_consultant.length +
    data.trial_entitlement_unavailable.length;
  if (total === 0) return null;

  const open = (id: string, label: string) =>
    onOpenConsultation ? (
      <button type="button" className="underline font-semibold" onClick={() => onOpenConsultation(id)}>
        {label}
      </button>
    ) : (
      <span className="font-semibold">{label}</span>
    );

  return (
    <section
      className="border-[1.5px] border-ink rounded-xl px-5 py-4 mb-5 bg-yellow-bg/40"
      data-testid="onboarding-attention-panel"
      aria-label="처리가 필요한 온보딩 건"
    >
      <h2 className="text-[14px] font-extrabold text-ink mb-2">처리 필요 {total}건</h2>
      {message && (
        <p className="text-[12px] text-ink mb-2" role="status">
          {message}
        </p>
      )}

      {data.onboarding_send_pending.length > 0 && (
        <div className="mb-3" data-testid="attention-onboarding-send-pending">
          <div className="text-[12.5px] font-bold text-ink mb-1">
            온보딩 안내 발송 대기 {data.onboarding_send_pending.length}건
          </div>
          <ul className="text-[12px] text-ink space-y-0.5">
            {data.onboarding_send_pending.map((r) => (
              <li key={r.consultation_id}>
                {open(r.consultation_id, r.contact_name)} — {r.confirmed_by_consultant ? "컨설턴트" : "관리자"}
                {r.confirmed_by_name ? `(${r.confirmed_by_name})` : ""}가 체험 진행을 확정했습니다. 안내 발송은 관리자가 처리합니다.
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.unassigned_inactive_consultant.length > 0 && (
        <div className="mb-3" data-testid="attention-unassigned">
          <div className="text-[12.5px] font-bold text-ink mb-1">
            담당 컨설턴트 비활성화로 미배정된 상담 {data.unassigned_inactive_consultant.length}건
          </div>
          <ul className="text-[12px] text-ink space-y-0.5">
            {data.unassigned_inactive_consultant.map((r) => (
              <li key={r.consultation_id}>
                {open(r.consultation_id, r.contact_name)} — 이전 담당 {r.from_consultant_name ?? "알 수 없음"}. 새 컨설턴트를
                배정하고 예약 링크를 다시 보내 주세요.
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.scheduled_inactive_consultant.length > 0 && (
        <div className="mb-3" data-testid="attention-scheduled-inactive">
          <div className="text-[12.5px] font-bold text-ink mb-1">
            비활성 컨설턴트의 확정 상담 {data.scheduled_inactive_consultant.length}건
          </div>
          <ul className="text-[12px] text-ink space-y-0.5">
            {data.scheduled_inactive_consultant.map((r) => (
              <li key={r.consultation_id}>
                {open(r.consultation_id, r.contact_name)} — 담당 {r.consultant_name ?? "알 수 없음"}. 담당자는 바꿀 수 없으니
                상담을 취소한 뒤 새 예약 링크를 보내 주세요.
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.trial_entitlement_unavailable.length > 0 && (
        <div data-testid="attention-trial-unavailable">
          <div className="text-[12.5px] font-bold text-ink mb-1">
            체험권 소진·만료 {data.trial_entitlement_unavailable.length}건
          </div>
          <ul className="space-y-1.5">
            {data.trial_entitlement_unavailable.map((r) => (
              <li key={r.consultation_id} className="text-[12px] text-ink">
                <div>
                  {open(r.consultation_id, r.contact_name)} — 체험권이 {STATE_LABEL[r.state]}되었습니다(자동 재지급 없음).
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <input
                    value={reasonByChild[r.child_id] ?? ""}
                    onChange={(e) => setReasonByChild((prev) => ({ ...prev, [r.child_id]: e.target.value }))}
                    placeholder="재지급 사유(5자 이상, 기록으로 남습니다)"
                    aria-label="체험권 재지급 사유"
                    className="flex-1 min-w-[200px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1 text-[12px] bg-white"
                  />
                  <button
                    type="button"
                    disabled={busyChild === r.child_id || (reasonByChild[r.child_id] ?? "").trim().length < 5}
                    onClick={async () => {
                      setBusyChild(r.child_id);
                      setMessage(null);
                      try {
                        await regrantTrialEntitlementAction(r.child_id, reasonByChild[r.child_id] ?? "");
                        setMessage("체험권을 1회 재지급했습니다.");
                        await refresh();
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : "재지급에 실패했습니다.");
                      } finally {
                        setBusyChild(null);
                      }
                    }}
                    className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
                  >
                    {busyChild === r.child_id ? "재지급 중..." : `${STATE_LABEL[r.state]} 체험권 1회 재지급`}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
