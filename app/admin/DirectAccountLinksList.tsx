"use client";

// 2026-09-07(발송 내역 목록 화면) — 지인/추천(DirectAccountCreationForm)으로
// 발송한 건은 상담 카드가 없어서 나중에 다시 찾아볼 방법이 없었다.
// listDirectOnboardingLinksAction()으로 목록을 불러와 카드로 나열하고,
// 각 항목을 펼치면 기존 TrialOnboardingLinkProgress(재발송/학생취소 버튼
// 포함, 이미 구현돼 있음)를 그대로 재사용해 상세를 보여준다.

import { useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import {
  listDirectOnboardingLinksAction,
  type DirectOnboardingLinkSummary,
} from "./direct-account-actions";
import TrialOnboardingLinkProgress from "./TrialOnboardingLinkProgress";

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
  const [links, setLinks] = useState<DirectOnboardingLinkSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await listDirectOnboardingLinksAction();
      setLinks(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  return (
    <div className="mt-6">
      <div className="text-[13px] font-bold text-ink mb-2">계정 생성 발송 내역</div>
      {loadError && <div className="text-[11.5px] text-red mb-2">{loadError}</div>}
      {!links ? (
        <div className="text-[11.5px] text-grey-500">불러오는 중...</div>
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
