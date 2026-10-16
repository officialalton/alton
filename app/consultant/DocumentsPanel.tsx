"use client";

import { useEffect, useState } from "react";
import { listMyContractDocumentsAction } from "./documents-actions";
import type { ContractArchiveRow } from "@/app/admin/contract-archive-data";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDate } from "@/lib/format-datetime";

// Phase B(2, 2026-09-23) — Documents 메인 탭. app/admin/ContractArchivePanel.tsx와
// 같은 라벨·다운로드 흐름을 쓰되(사용자 지시: "기존 계약 문서 정책에 따라"),
// 조회 범위는 RLS(담당 컨설턴트 조회 정책)로 본인 담당 학생만으로 좁혀진다.
// 발송·재발송·무효화 등 쓰기 액션은 두지 않는다(조회 전용).

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Ready to send",
  sent: "Sent",
  awaiting_signature: "Awaiting signature",
  signed: "Signed",
  active: "Active",
  termination_pending: "Termination pending",
  terminated: "Terminated",
  void: "Void",
  superseded: "Superseded",
  expired: "Expired",
};

const ENVELOPE_STATUS_LABEL: Record<string, string> = {
  sent: "Sent",
  delivered: "Viewed",
  completed: "Signed",
  declined: "Declined",
  voided: "Voided",
};

const ARTIFACT_LABEL: Record<string, string> = {
  queued: "Archive queued",
  processing: "Archiving",
  succeeded: "Archived",
  retryable_failed: "Archive failed (retryable)",
  manual_review: "Archive failed (needs review)",
};

function formatDate(value: string | null, tz: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return fmtDate(d, { year: "numeric", month: "long", day: "numeric" }, tz);
}

export default function DocumentsPanel() {
  const tz = useViewerTimezone();
  const [rows, setRows] = useState<ContractArchiveRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<Record<string, string>>({});

  function messageForReason(reason: string | undefined): string {
    switch (reason) {
      case "not_found":
        return "Document not found or you don't have permission to view it.";
      case "not_stored":
        return "Archiving isn't finished yet, so it can't be downloaded.";
      case "fetch_failed":
        return "Download isn't available right now. Please try again later.";
      default:
        return "Couldn't download.";
    }
  }

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    setError(null);
    listMyContractDocumentsAction({ search: search.trim() || undefined })
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load contracts.");
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  async function handleDownload(row: ContractArchiveRow) {
    if (!row.signedArtifactId) return;
    setDownloadState((prev) => ({ ...prev, [row.contractId]: "Downloading…" }));
    try {
      const res = await fetch(`/api/consultant/contract-artifacts/${row.signedArtifactId}`);
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { reason?: string };
        setDownloadState((prev) => ({ ...prev, [row.contractId]: messageForReason(payload.reason) }));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contract-${row.studentName || row.contractId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadState((prev) => ({ ...prev, [row.contractId]: "Download started." }));
    } catch {
      setDownloadState((prev) => ({ ...prev, [row.contractId]: messageForReason("fetch_failed") }));
    }
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">Documents</h1>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student or parent name"
          aria-label="Search by student or parent name"
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 min-w-[200px]"
        />
      </div>

      {error && <p className="text-[13px] text-red mb-3">{error}</p>}
      {rows === null && !error && <p className="text-[13px] text-grey-500">Loading…</p>}
      {rows?.length === 0 && <p className="text-[13px] text-grey-500">No contract documents for your students or families yet.</p>}

      {rows?.map((row) => {
        const isOpen = openId === row.contractId;
        return (
          <div key={row.contractId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[14px] font-bold text-ink">{row.studentName || "Unnamed"}</span>
              {row.guardianName && <span className="text-[12px] text-grey-500">Parent {row.guardianName}</span>}
              <span className="text-[10.5px] font-bold text-grey-500 bg-grey-100 rounded-full px-2 py-0.5">
                {CONTRACT_STATUS_LABEL[row.status] ?? row.status}
              </span>
              {row.latestVersionNumber !== null && <span className="text-[11px] text-grey-500">v{row.latestVersionNumber}</span>}
              <span className="text-[11px] text-grey-500 ml-auto">{formatDate(row.createdAt, tz)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-grey-500">
              <span>Signature {row.envelopeStatus ? (ENVELOPE_STATUS_LABEL[row.envelopeStatus] ?? row.envelopeStatus) : "—"}</span>
              <span>Company signature {row.companySignedAt ? "done" : "pending"}</span>
              <span>Signed copy {row.signedArtifactSyncStatus ? (ARTIFACT_LABEL[row.signedArtifactSyncStatus] ?? row.signedArtifactSyncStatus) : "none"}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={() => setOpenId(isOpen ? null : row.contractId)}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
              >
                {isOpen ? "Collapse" : "Details"}
              </button>
              {row.signedArtifactDownloadable ? (
                <button onClick={() => void handleDownload(row)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white">
                  Download signed copy
                </button>
              ) : (
                <span className="text-[11.5px] text-grey-500">
                  {row.signedArtifactId ? "Not archived yet, so it can't be downloaded" : "No signed copy yet"}
                </span>
              )}
              {downloadState[row.contractId] && <span className="text-[11.5px] text-grey-500">{downloadState[row.contractId]}</span>}
            </div>

            {isOpen && (
              <dl className="mt-3 pt-3 border-t border-grey-100 text-[12px] text-grey-500 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="font-bold">Latest version</dt>
                <dd>{row.latestVersionNumber !== null ? `v${row.latestVersionNumber}` : "None yet"}</dd>
                <dt className="font-bold">Signature status updated</dt>
                <dd>{formatDate(row.envelopeStatusUpdatedAt, tz)}</dd>
                <dt className="font-bold">Company signed on</dt>
                <dd>{formatDate(row.companySignedAt, tz)}</dd>
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}
