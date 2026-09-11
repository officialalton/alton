"use client";

// 2026-09-07(발송 내역 목록 화면) — 계정 생성(DirectAccountCreationForm)으로
// 발송한 건은 상담 카드가 없어서 나중에 다시 찾아볼 방법이 없었다.
// listDirectOnboardingLinksAction()으로 목록을 불러와 카드로 나열하고,
// 각 항목을 펼치면 기존 TrialOnboardingLinkProgress(재발송/학생취소 버튼
// 포함, 이미 구현돼 있음)를 그대로 재사용해 상세를 보여준다.
//
// 2026-09-10(P1-B 신규 통합 보드 — 계정 생성 탭 이관) — 사용자 > 학부모
// 탭에 있던 것을 신규 > 계정 생성 탭으로 옮기면서, 다른 탭과 동일한
// 관리자 계정 단위 TTL 캐시(재진입 시 직전 목록 즉시 표시 + 백그라운드
// 갱신) + 최종 카드 형태 스켈레톤 + 재시도 문구로 바꿨다.

import { useImperativeHandle, forwardRef } from "react";
import {
  listDirectOnboardingLinksAction,
  type DirectOnboardingLinkSummary,
} from "./direct-account-actions";
import TrialOnboardingLinkProgress from "./TrialOnboardingLinkProgress";
import { useTabCachedData } from "./use-tab-cached-data";

// "계정 생성"도 상태 변화가 잦은 화면으로 분류해 TTL 10초를 쓴다(신규
// 현황·정규 계약 발송과 동일).
const ACCOUNT_CREATION_LINKS_TTL_MS = 10_000;

function LinkRowSkeleton() {
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 animate-pulse" data-testid="direct-onboarding-links-skeleton">
      <div className="h-3 w-40 bg-grey-200 rounded mb-2" />
      <div className="h-2.5 w-56 bg-grey-100 rounded" />
    </div>
  );
}

const LINK_STATUS_LABEL: Record<DirectOnboardingLinkSummary["status"], string> = {
  pending: "보호자 확인 대기",
  redeemed: "완료",
  expired: "만료됨",
  revoked: "취소됨(재발급됨)",
};

const NOTICE_STATUS_LABEL: Record<DirectOnboardingLinkSummary["noticeDeliveryStatus"], string> = {
  pending: "발송 대기",
  sent: "발송됨",
  failed: "발송 실패",
};

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR");
}

export type DirectAccountLinksListHandle = { refresh: () => void };

const DirectAccountLinksList = forwardRef<DirectAccountLinksListHandle>(function DirectAccountLinksList(_props, ref) {
  const {
    data: links,
    error: loadError,
    refreshing,
    refresh,
  } = useTabCachedData<DirectOnboardingLinkSummary[]>({
    cacheKey: "account-creation-links",
    ttlMs: ACCOUNT_CREATION_LINKS_TTL_MS,
    fetcher: listDirectOnboardingLinksAction,
  });

  useImperativeHandle(ref, () => ({ refresh: () => refresh() }), [refresh]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[13px] font-bold text-ink">계정 생성 발송 내역</div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-[11.5px] font-bold text-ink underline disabled:opacity-50"
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>
      {loadError && (
        <div
          className="border-[1.5px] border-red/30 bg-red/5 rounded-xl px-4 py-3 mb-2 flex items-center justify-between"
          data-testid="direct-onboarding-links-error"
        >
          <span className="text-[11.5px] text-red font-semibold">불러오지 못했습니다</span>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-red/30 text-red disabled:opacity-50"
          >
            {refreshing ? "다시 시도 중..." : "다시 시도"}
          </button>
        </div>
      )}
      {!links ? (
        <div className="space-y-2">
          <LinkRowSkeleton />
          <LinkRowSkeleton />
        </div>
      ) : links.length === 0 ? (
        <div className="text-[11.5px] text-grey-500">아직 발송한 내역이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {links.map((l) => (
            <div
              key={l.linkId}
              className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3"
              data-testid="direct-onboarding-link-row"
            >
              <div className="flex items-start justify-between gap-2" data-testid={`direct-onboarding-link-row-${l.linkId}`}>
                <div>
                  <div className="text-[12.5px] font-bold text-ink">
                    {l.guardianName} <span className="font-normal text-grey-500">({l.guardianEmail})</span>
                  </div>
                  <div className="text-[11px] text-grey-500 mt-0.5">
                    발송: {fmt(l.noticeSentAt ?? l.createdAt)} · 학생 {l.studentCount}명
                    {l.studentsCreated > 0 && ` · 계정생성 ${l.studentsCreated}건`}
                    {l.studentsFailed > 0 && ` · 실패 ${l.studentsFailed}건`}
                    {l.studentsCancelled > 0 && ` · 취소 ${l.studentsCancelled}건`}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-grey-100 text-ink">
                    {LINK_STATUS_LABEL[l.status]}
                  </span>
                  <span
                    className={
                      "text-[10.5px] font-bold px-2 py-0.5 rounded-full " +
                      (l.noticeDeliveryStatus === "failed"
                        ? "bg-red/10 text-red"
                        : l.noticeDeliveryStatus === "sent"
                          ? "bg-green/10 text-green"
                          : "bg-grey-100 text-grey-500")
                    }
                  >
                    {NOTICE_STATUS_LABEL[l.noticeDeliveryStatus]}
                  </span>
                </div>
              </div>
              <TrialOnboardingLinkProgress linkId={l.linkId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default DirectAccountLinksList;
