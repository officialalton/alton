"use client";

import { useEffect, useState } from "react";
import { listContractArchiveAction } from "./contract-archive-actions";
import type { ContractArchiveRow } from "./contract-archive-data";

// P4-3 2단계 — `문서 > 계약` 아카이브. 조회와 다운로드만 한다.
// 발송·재발송·무효화 버튼은 두지 않는다(그 진입점은 `신규 > 정규 계약 발송`).

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: "작성 중",
  ready: "발송 준비",
  sent: "발송됨",
  awaiting_signature: "서명 대기",
  signed: "서명 완료",
  active: "이용 중",
  termination_pending: "해지 진행",
  terminated: "해지됨",
  void: "무효",
  superseded: "대체됨",
  expired: "만료",
};

const ENVELOPE_STATUS_LABEL: Record<string, string> = {
  sent: "발송",
  delivered: "열람",
  completed: "서명 완료",
  declined: "서명 거절",
  voided: "무효 처리",
};

// 보관 상태는 사람이 읽는 말로 바꾼다 — 내부 상태값을 그대로 노출하지 않는다.
const ARTIFACT_LABEL: Record<string, string> = {
  queued: "보관 대기",
  processing: "보관 중",
  succeeded: "보관 완료",
  retryable_failed: "보관 실패(재시도 가능)",
  manual_review: "보관 실패(확인 필요)",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default function ContractArchivePanel() {
  const [rows, setRows] = useState<ContractArchiveRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  // 다운로드 결과를 계약별로 따로 보여준다 — "파일 없음"과 "실패"는 다른 일이다.
  const [downloadState, setDownloadState] = useState<Record<string, string>>({});

  // 서버는 사유 코드만 준다(내부 예외·Drive 응답·파일 경로를 응답에 담지
  // 않는다). 사용자에게 보일 문구는 화면이 고른다.
  function messageForReason(reason: string | undefined): string {
    switch (reason) {
      case "not_found":
        return "문서를 찾을 수 없거나 열람 권한이 없습니다.";
      case "not_stored":
        return "아직 보관이 끝나지 않아 내려받을 수 없습니다.";
      case "fetch_failed":
        return "지금은 내려받을 수 없습니다. 잠시 뒤 다시 시도해 주세요.";
      default:
        return "내려받지 못했습니다.";
    }
  }

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listContractArchiveAction({ search: search.trim() || undefined, status: status || undefined })
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "계약을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [search, status]);

  async function handleDownload(row: ContractArchiveRow) {
    if (!row.signedArtifactId) return;
    setDownloadState((prev) => ({ ...prev, [row.contractId]: "내려받는 중…" }));
    try {
      const res = await fetch(`/api/admin/contract-artifacts/${row.signedArtifactId}`);
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { reason?: string };
        setDownloadState((prev) => ({
          ...prev,
          [row.contractId]: messageForReason(payload.reason),
        }));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `계약-${row.studentName || row.contractId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      // 브라우저가 실제로 저장했는지는 이 화면도 알 수 없다 — "받았습니다"라고
      // 단정하지 않는다.
      setDownloadState((prev) => ({ ...prev, [row.contractId]: "내려받기를 시작했습니다." }));
    } catch {
      setDownloadState((prev) => ({
        ...prev,
        [row.contractId]: messageForReason("fetch_failed"),
      }));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="학생·보호자 이름으로 찾기"
          aria-label="학생·보호자 이름으로 찾기"
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 min-w-[200px]"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="계약 상태"
          className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5"
        >
          <option value="">모든 상태</option>
          {Object.entries(CONTRACT_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-[13px] text-red mb-3">{error}</p>}
      {rows === null && !error && <p className="text-[13px] text-grey-500">불러오는 중…</p>}
      {rows?.length === 0 && (
        <p className="text-[13px] text-grey-500">조건에 맞는 계약이 없습니다.</p>
      )}

      {rows?.map((row) => {
        const isOpen = openId === row.contractId;
        return (
          <div
            key={row.contractId}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
          >
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[14px] font-bold text-ink">
                {row.studentName || "이름 없음"}
              </span>
              {row.guardianName && (
                <span className="text-[12px] text-grey-500">보호자 {row.guardianName}</span>
              )}
              <span className="text-[10.5px] font-bold text-grey-500 bg-grey-100 rounded-full px-2 py-0.5">
                {CONTRACT_STATUS_LABEL[row.status] ?? row.status}
              </span>
              {row.latestVersionNumber !== null && (
                <span className="text-[11px] text-grey-500">{row.latestVersionNumber}차</span>
              )}
              <span className="text-[11px] text-grey-500 ml-auto">{formatDate(row.createdAt)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-grey-500">
              <span>
                서명{" "}
                {row.envelopeStatus
                  ? (ENVELOPE_STATUS_LABEL[row.envelopeStatus] ?? row.envelopeStatus)
                  : "—"}
              </span>
              <span>회사 서명 {row.companySignedAt ? "완료" : "전"}</span>
              <span>
                서명본{" "}
                {row.signedArtifactSyncStatus
                  ? (ARTIFACT_LABEL[row.signedArtifactSyncStatus] ?? row.signedArtifactSyncStatus)
                  : "없음"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={() => setOpenId(isOpen ? null : row.contractId)}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
              >
                {isOpen ? "접기" : "자세히"}
              </button>
              {row.signedArtifactDownloadable ? (
                <button
                  onClick={() => void handleDownload(row)}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white"
                >
                  서명본 내려받기
                </button>
              ) : (
                <span className="text-[11.5px] text-grey-500">
                  {row.signedArtifactId
                    ? "아직 보관되지 않아 내려받을 수 없습니다"
                    : "서명본이 아직 없습니다"}
                </span>
              )}
              {downloadState[row.contractId] && (
                <span className="text-[11.5px] text-grey-500">{downloadState[row.contractId]}</span>
              )}
            </div>

            {isOpen && (
              <dl className="mt-3 pt-3 border-t border-grey-100 text-[12px] text-grey-500 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="font-bold">최신 버전</dt>
                <dd>{row.latestVersionNumber !== null ? `${row.latestVersionNumber}차` : "아직 없음"}</dd>
                <dt className="font-bold">서명 상태 갱신</dt>
                <dd>{formatDate(row.envelopeStatusUpdatedAt)}</dd>
                <dt className="font-bold">회사 서명</dt>
                <dd>{row.companySignedAt ? formatDate(row.companySignedAt) : "아직 없음"}</dd>
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}
