"use client";

import { useEffect, useState } from "react";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import MergeAccountsPanel from "./MergeAccountsPanel";
import { loadFreeMembersOverviewAction, type FreeMembersOverview } from "./free-members-actions";
import { fmtDate } from "@/lib/format-datetime";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";

const SUBTABS = [
  { id: "members", label: "회원 목록" },
  { id: "interests", label: "상담 관심" },
  { id: "review", label: "보호자 연결 수동 검토" },
  { id: "events", label: "초대 이벤트" },
] as const;
type SubtabId = (typeof SUBTABS)[number]["id"];

export const INTEREST_STATUS_LABEL: Record<string, string> = {
  registered: "관심 등록",
  invite_sent: "보호자 초대 발송",
  parent_linked: "보호자 연결됨",
  consultation_requested: "상담 요청됨",
  booked: "상담 예약됨",
};
export const INVITE_EVENT_LABEL: Record<string, string> = {
  sent: "발송",
  resent: "재발송",
  accepted: "수락",
  revoked: "취소",
  expired: "만료",
  superseded: "대체됨",
  manual_review: "수동 검토 전환",
  reminder_sent: "리마인더 발송",
  claimed_mismatch: "이메일 불일치",
};

/** 관리자 '무료 회원' 탭 — 읽기 전용 목록 + 보호자 연결 수동 검토 큐(기존 계정 병합 패널 연결). */
export default function FreeMembersTab() {
  const tz = useViewerTimezone();
  const [subtab, setSubtab] = useState<SubtabId>("members");
  const [data, setData] = useState<FreeMembersOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFreeMembersOverviewAction()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }, []);

  const date = (iso: string | null) => (iso ? fmtDate(iso, undefined, tz) : "-");

  return (
    <div className="max-w-[980px]" data-testid="free-members-tab">
      <div className="mb-5 border-b border-grey-200">
        <UnderlineSubTabs items={SUBTABS} activeId={subtab} onSelect={setSubtab} className="border-b-0" />
      </div>
      {error && <p className="text-[12.5px] text-red">{error}</p>}
      {!data && !error && <p className="text-[12.5px] text-grey-500" aria-busy="true">불러오는 중...</p>}
      {data && subtab === "members" && (
        <div className="space-y-2">
          {data.members.length === 0 && <p className="text-[12.5px] text-grey-500">무료 회원이 없습니다.</p>}
          {data.members.map((m) => (
            <div key={m.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[13.5px] font-bold text-ink">{m.name || "이름 없음"}</div>
                <div className="text-[12px] text-grey-500">{m.email}</div>
              </div>
              <div className="text-[12px] text-grey-500 text-right">
                <div>가입 {date(m.signedUpAt)}</div>
                <div>모의고사 응시 {m.attempts}회</div>
                <div>{m.interestStatus ? `상담 관심: ${INTEREST_STATUS_LABEL[m.interestStatus] ?? m.interestStatus}` : "상담 관심 없음"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {data && subtab === "interests" && (
        <div className="space-y-2">
          {data.interests.length === 0 && <p className="text-[12.5px] text-grey-500">진행 중인 상담 관심이 없습니다.</p>}
          {data.interests.map((i) => (
            <div key={i.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3 flex items-center justify-between gap-3">
              <div className="text-[13px] font-bold text-ink">{i.studentName || "이름 없음"}</div>
              <div className="text-[12px] text-grey-500 text-right">
                <div>{INTEREST_STATUS_LABEL[i.status] ?? i.status}</div>
                <div>{date(i.createdAt)}{i.consultationId ? " · 상담 연결됨" : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {data && subtab === "review" && (
        <div className="space-y-4">
          <p className="text-[12.5px] text-grey-500">
            초대받은 이메일이 이미 다른 계정으로 존재하거나 자동 연결할 수 없는 경우입니다. 계정을 확인한 뒤 아래 계정 병합으로 정리하거나 학생에게 새 초대를 안내하세요.
          </p>
          {data.manualReview.length === 0 && <p className="text-[12.5px] text-grey-500">수동 검토 대기가 없습니다.</p>}
          {data.manualReview.map((r) => (
            <div key={r.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3" data-testid="guardian-link-review-row">
              <div className="text-[13px] font-bold text-ink">{r.studentName || "이름 없음"} → {r.emailNormalized}</div>
              <div className="text-[12px] text-grey-500">{r.reason ?? "사유 없음"} · {date(r.createdAt)}</div>
            </div>
          ))}
          <details className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3">
            <summary className="text-[13px] font-bold text-ink cursor-pointer">계정 병합 열기</summary>
            <div className="mt-3"><MergeAccountsPanel /></div>
          </details>
        </div>
      )}
      {data && subtab === "events" && (
        <div className="space-y-1.5">
          {data.events.length === 0 && <p className="text-[12.5px] text-grey-500">초대 이벤트가 없습니다.</p>}
          {data.events.map((e) => (
            <div key={e.id} className="text-[12.5px] text-ink flex justify-between border-b border-grey-100 py-1.5">
              <span>{e.studentName || "이름 없음"} — {INVITE_EVENT_LABEL[e.eventType] ?? e.eventType}</span>
              <span className="text-grey-500">{date(e.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
