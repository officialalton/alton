"use client";

import { useEffect, useState } from "react";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import MergeAccountsPanel from "../MergeAccountsPanel";
import { loadFreeMembersOverviewAction, type FreeMembersOverview } from "../free-members-actions";

// 기존 상담 관심 큐·보호자 연결 수동 검토·초대 이벤트·계정 병합 운영 도구(Accounts 하위로 이관, 영어 UI).
const SUBTABS = [
  { id: "interests", label: "Consultation interest" },
  { id: "review", label: "Guardian link review" },
  { id: "events", label: "Invite events" },
] as const;
type SubtabId = (typeof SUBTABS)[number]["id"];

const INTEREST_STATUS_LABEL: Record<string, string> = {
  registered: "Interest registered", invite_sent: "Guardian invite sent", parent_linked: "Guardian linked",
  consultation_requested: "Consultation requested", booked: "Consultation booked",
};
const INVITE_EVENT_LABEL: Record<string, string> = {
  sent: "Sent", resent: "Resent", accepted: "Accepted", revoked: "Revoked", expired: "Expired", superseded: "Superseded",
  manual_review: "Moved to manual review", reminder_sent: "Reminder sent", claimed_mismatch: "Email mismatch",
};
const date = (iso: string | null) => (iso ? iso.slice(0, 10) : "-");

export default function ReviewQueue() {
  const [subtab, setSubtab] = useState<SubtabId>("review");
  const [data, setData] = useState<FreeMembersOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadFreeMembersOverviewAction().then(setData).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load."));
  }, []);

  return (
    <div data-testid="free-members-tab">
      <div className="mb-4 border-b border-grey-200"><UnderlineSubTabs items={SUBTABS} activeId={subtab} onSelect={setSubtab} className="border-b-0" /></div>
      {error && <p className="text-[12.5px] text-red">{error}</p>}
      {!data && !error && <p className="text-[12.5px] text-grey-500" aria-busy="true">Loading…</p>}
      {data && subtab === "interests" && (
        <div className="space-y-2">
          {data.interests.length === 0 && <p className="text-[12.5px] text-grey-500">No open consultation interest.</p>}
          {data.interests.map((i) => (
            <div key={i.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3 flex items-center justify-between gap-3">
              <div className="text-[13px] font-bold text-ink">{i.studentName || "No name"}</div>
              <div className="text-[12px] text-grey-500 text-right">
                <div>{INTEREST_STATUS_LABEL[i.status] ?? i.status}</div>
                <div>{date(i.createdAt)}{i.consultationId ? " · consultation linked" : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {data && subtab === "review" && (
        <div className="space-y-4">
          <p className="text-[12.5px] text-grey-500">
            The invited email already belongs to another account or cannot be linked automatically. Check the accounts, then clean up with Merge accounts below or ask the student to send a new invite.
          </p>
          {data.manualReview.length === 0 && <p className="text-[12.5px] text-grey-500">Nothing waiting for manual review.</p>}
          {data.manualReview.map((r) => (
            <div key={r.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3" data-testid="guardian-link-review-row">
              <div className="text-[13px] font-bold text-ink">{r.studentName || "No name"} → {r.emailNormalized}</div>
              <div className="text-[12px] text-grey-500">{r.reason ?? "No reason recorded"} · {date(r.createdAt)}</div>
            </div>
          ))}
          <details className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3">
            <summary className="text-[13px] font-bold text-ink cursor-pointer">Open Merge accounts</summary>
            <div className="mt-3"><MergeAccountsPanel /></div>
          </details>
        </div>
      )}
      {data && subtab === "events" && (
        <div className="space-y-1.5">
          {data.events.length === 0 && <p className="text-[12.5px] text-grey-500">No invite events.</p>}
          {data.events.map((e) => (
            <div key={e.id} className="text-[12.5px] text-ink flex justify-between border-b border-grey-100 py-1.5">
              <span>{e.studentName || "No name"} — {INVITE_EVENT_LABEL[e.eventType] ?? e.eventType}</span>
              <span className="text-grey-500">{date(e.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
