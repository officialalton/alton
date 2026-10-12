"use client";

// 2026-10-12 — 상담 현황 칸반(관리자 전용)의 "계정 생성 대기" 구역. 직접 계정 생성·
// 기존 보호자 자녀 추가 안내가 발송됐지만 보호자가 아직 링크를 열지 않아 학생 계정이
// 만들어지지 않은 건을 보여준다. 보호자가 열어 계정이 생성되면 이 카드는 사라지고
// 기존 "link:" 계정 생성 카드가 이어받는다(서버 조회가 중복을 막는다).
// 재발송은 기존 reissueDirectOnboardingLinkAction(기존 링크 폐기 후 새 링크 발송)을 그대로
// 쓰고, 재발송 대기시간은 무료 회원 초대 재발송과 같은 RESEND_COOLDOWN_MS를 쓴다.

import { useState } from "react";
import type { KanbanCard } from "./consultation-kanban-data";
import { reissueDirectOnboardingLinkAction } from "./direct-account-actions";
import { resendRemainingMs } from "@/app/student/tutoring-state";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateTime } from "@/lib/format-datetime";
import { useToasts, ToastStack } from "./Toast";

const DAY_MS = 24 * 60 * 60 * 1000;

export function elapsedDays(fromIso: string, now: number = Date.now()): number {
  const t = Date.parse(fromIso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

export default function PendingAccountLinkCards({
  cards,
  onChanged,
  onOpenAccountCreation,
}: {
  cards: KanbanCard[];
  onChanged: () => void;
  onOpenAccountCreation?: () => void;
}) {
  const tz = useViewerTimezone();
  const { toasts, showToast, dismiss } = useToasts();
  const [busyLinkId, setBusyLinkId] = useState<string | null>(null);
  const pending = cards.filter((c) => c.pendingAccountLink);
  if (pending.length === 0) return null;

  async function resend(linkId: string) {
    if (!window.confirm("기존 링크를 폐기하고 새 링크를 발급·재발송할까요?")) return;
    setBusyLinkId(linkId);
    try {
      const result = await reissueDirectOnboardingLinkAction(linkId);
      if (result.status === "sent") showToast("success", "새 링크를 발급하고 재발송했습니다.");
      else if (result.status === "duplicate_emails") {
        showToast("error", `이미 사용 중인 이메일이 있어 재발송하지 않았습니다: ${result.collisions.map((c) => c.email).join(", ")}`);
      } else if (result.status === "failed") showToast("error", `재발송 실패 — ${result.error}`);
      else showToast("success", "이미 새 링크가 발송된 상태입니다.");
      onChanged();
    } catch (e) {
      showToast("error", `재발송 실패 — ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyLinkId(null);
    }
  }

  return (
    <section className="mb-4" data-testid="pending-account-links" aria-label="계정 생성 대기">
      <ToastStack toasts={toasts} dismiss={dismiss} />
      <div className="text-[12.5px] font-bold text-ink mb-2 flex items-center justify-between">
        <span>계정 생성 대기</span>
        <span className="text-[11px] font-semibold text-grey-500">{pending.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {pending.map((c) => {
          const p = c.pendingAccountLink!;
          const sentIso = p.noticeSentAt ?? p.createdAt;
          const remaining = resendRemainingMs(sentIso);
          const failed = p.noticeDeliveryStatus === "failed";
          const days = elapsedDays(sentIso);
          return (
            <div
              key={c.id}
              data-testid={`pending-account-link-${p.linkId}`}
              className="border-[1.5px] border-grey-200 rounded-xl px-3 py-2.5"
            >
              <div className="text-[13px] font-bold text-ink truncate flex items-center gap-1">
                <span className="text-[10px] font-semibold rounded px-1 py-0.5 shrink-0 bg-blue-50 text-blue-600">
                  계정 생성
                </span>
                <span className="truncate">{c.contact_name}</span>
              </div>
              <div className="text-[11px] text-grey-500 truncate">{c.contact_email}</div>
              <div className="text-[10.5px] text-grey-500">
                발송 {fmtDateTime(sentIso, undefined, tz)} · {days === 0 ? "오늘" : `${days}일 경과`}
              </div>
              {p.studentCount > 0 && c.requested_children && (
                <div className="text-[10.5px] text-grey-400 truncate">
                  학생 {p.studentCount}명: {c.requested_children.map((ch) => ch.name).join(", ")}
                </div>
              )}
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span
                  className={
                    "text-[10.5px] font-bold px-2 py-0.5 rounded-full " +
                    (failed ? "bg-red/10 text-red" : "bg-green/10 text-green")
                  }
                >
                  {failed ? "발송 실패" : "발송됨 — 보호자 확인 대기"}
                </span>
                <button
                  type="button"
                  data-testid={`pending-account-link-resend-${p.linkId}`}
                  disabled={busyLinkId === p.linkId || remaining > 0}
                  aria-busy={busyLinkId === p.linkId}
                  onClick={() => resend(p.linkId)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                >
                  {busyLinkId === p.linkId
                    ? "재발송 중..."
                    : remaining > 0
                      ? `재발송 (${Math.ceil(remaining / 60000)}분 후 가능)`
                      : "재발송"}
                </button>
                {onOpenAccountCreation && (
                  <button
                    type="button"
                    data-testid={`pending-account-link-detail-${p.linkId}`}
                    onClick={onOpenAccountCreation}
                    className="text-[11px] font-bold text-ink underline"
                  >
                    발송 내역에서 보기
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
