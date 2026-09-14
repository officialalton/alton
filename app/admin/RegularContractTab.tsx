"use client";

// 2026-09-10(P1-B 신규 통합 보드) — 매칭 탭 하단 "정규 계약 발송 대기"를
// 이 전용 탭으로 이관했다("신규" 안에서 "신규 현황" 바로 다음 탭). 계약
// 발송·재발송·발송 상태·계약 완료는 이제 여기서만 관리한다(매칭 화면에는
// 남기지 않음). 컴포넌트 자체(RegularContractRow)는 TrialOnboardingPanel.tsx
// 것을 그대로 옮겼다 — 로직 변경 없음, 목록 조회 방식만 TTL 캐시로 바꿨다.

import { useState } from "react";
import {
  listRegularConversionCandidatesAction,
  sendRegularContractOneClickAction,
  type RegularConversionCandidate,
} from "./trial-onboarding-actions";
import { createNewContractVersionForResend } from "./consultation-actions";
import { useTabCachedData } from "./use-tab-cached-data";

// "신규"와 마찬가지로 상태 변화가 잦은 화면으로 분류해 TTL 10초를 쓴다.
const REGULAR_CONTRACT_TTL_MS = 10_000;

function ContractRowSkeleton() {
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 animate-pulse" data-testid="regular-contract-skeleton">
      <div className="h-3.5 w-40 bg-grey-200 rounded mb-2" />
      <div className="h-3 w-56 bg-grey-100 rounded" />
    </div>
  );
}

export default function RegularContractTab() {
  const {
    data: conversions,
    error,
    refreshing,
    refresh,
  } = useTabCachedData<RegularConversionCandidate[]>({
    cacheKey: "regular-contract-candidates",
    ttlMs: REGULAR_CONTRACT_TTL_MS,
    fetcher: listRegularConversionCandidatesAction,
  });

  return (
    <div className="max-w-[640px] px-8 py-8">
      <div className="flex items-center justify-between mb-1.5">
        <h1 className="text-[20px] font-extrabold text-ink">정규 계약 발송</h1>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-[12px] font-bold text-ink underline disabled:opacity-50"
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>
      <p className="text-[13px] text-grey-500 mb-5">
        보호자가 정규 진행을 희망한 과목입니다. 계약 발송·재발송·발송 상태·계약 완료를 여기서 관리합니다.
      </p>

      {error && (
        <div
          className="border-[1.5px] border-red/30 bg-red/5 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
          data-testid="regular-contract-error"
        >
          <span className="text-[13px] text-red font-semibold">불러오지 못했습니다</span>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-red/30 text-red disabled:opacity-50"
          >
            {refreshing ? "다시 시도 중..." : "다시 시도"}
          </button>
        </div>
      )}

      {conversions === null && !error && (
        <>
          <ContractRowSkeleton />
          <ContractRowSkeleton />
        </>
      )}

      {conversions !== null && (
        conversions.length === 0 ? (
          <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
            정규 진행을 희망한 과목 수강이 없습니다.
          </div>
        ) : (
          conversions.map((v) => <RegularContractRow key={v.subjectEnrollmentId} item={v} onSent={refresh} />)
        )
      )}
    </div>
  );
}

function RegularContractRow({
  item,
  onSent,
}: {
  item: RegularConversionCandidate;
  onSent: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [approverTitle, setApproverTitle] = useState("CEO, Do Kyung Kim");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [result, setResult] = useState<
    { status: "sent" | "already_sent"; envelopeId: string; at: string } | { status: "failed"; error: string } | null
  >(null);

  // 로컬 result만 보면 새로고침 후 이미 발송된 계약도 버튼이 "정규 계약 발송"으로
  // 되돌아가 재발송을 유도한다(TrialConversionPanel에서 겪은 것과 같은 종류의
  // 문제) — item.latestVersionHasEnvelope(최신 active 버전에 실제 envelope가
  // 있는지)로 판단한다. contracts.status(계약 전체 상태)는 쓰지 않는다 — 재발송으로
  // 새 버전을 만들면 이전 버전 완료로 인해 계약 상태 자체는 여전히 'active'로
  // 남아있어, 새 버전이 미발송인데도 "이미 발송됨"으로 잘못 표시되는 버그가 있었다.
  const isSent =
    result?.status === "sent" || result?.status === "already_sent" || (!result && item.latestVersionHasEnvelope);
  const canSend = !!item.guardianEmail && !!item.guardianName;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
      <div className="text-[13.5px] font-bold text-ink">
        {item.childName} · {item.subjectName ?? "-"}
      </div>
      <div className="text-[12px] text-grey-500 mt-0.5">
        보호자: {item.guardianName ?? "확인 필요"} ({item.guardianEmail ?? "이메일 없음"})
      </div>
      {!canSend && (
        <div className="text-[11.5px] text-red mt-1">
          발송 차단 — 보호자 이메일/이름을 확인할 수 없습니다(계정 연결 상태를 다시 확인하세요).
        </div>
      )}

      {result?.status === "failed" && (
        <div className="text-[12px] text-red mt-2 bg-red/5 rounded-lg px-3 py-2">
          발송 실패 — 관리자 조치 필요. 계약은 그대로 보관돼 있어 아래 버튼으로 안전하게
          다시 시도할 수 있습니다.
          <div className="mt-1 font-mono text-[11px] break-all">{result.error}</div>
        </div>
      )}
      {isSent && (
        <div className="text-[12px] text-ink mt-2 bg-grey-100 rounded-lg px-3 py-2">
          {result?.status === "sent"
            ? `발송 완료 — 수신자 ${item.guardianEmail} · 발송 시각 ${new Date(result.at).toLocaleString("ko-KR")} · 상태: 서명 대기`
            : `이미 발송됨 — 수신자 ${item.guardianEmail} · 상태: 서명 대기`}
        </div>
      )}
      {resendError && <div className="text-[12px] text-red mt-2">{resendError}</div>}

      {!confirming ? (
        <div className="flex gap-2 mt-2.5">
          <button
            disabled={!canSend || isSent}
            onClick={() => setConfirming(true)}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
          >
            {result?.status === "failed" ? "다시 시도" : isSent ? "발송 완료" : "회사 승인 및 계약 발송"}
          </button>
          {isSent && (
            <button
              disabled={resending}
              aria-busy={resending}
              onClick={async () => {
                setResending(true);
                setResendError(null);
                try {
                  await createNewContractVersionForResend({ contractId: item.contractId });
                  setResult(null);
                  onSent();
                } catch (e) {
                  setResendError(e instanceof Error ? e.message : String(e));
                } finally {
                  setResending(false);
                }
              }}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
            >
              {resending ? "새 버전 만드는 중..." : "재발송(새 버전)"}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2.5 bg-grey-50 rounded-lg px-3.5 py-3">
          <p className="text-[12px] text-ink mb-2">
            확인 버튼을 누르면 <b>회사가 이 계약 버전을 전자승인한 기록(계약 주체·승인자·직함·승인
            일시·문서 식별값)이 계약서에 삽입된 뒤 DocuSign으로 발송</b>됩니다. 도장 이미지나
            DocuSign 전자서명이 아니라 인증된 관리자의 승인 기록입니다. 수신자: <b>{item.guardianEmail}</b>
          </p>
          <label className="block text-[11px] font-semibold text-grey-500 mb-2">
            승인자 직함(계약서에 그대로 인쇄됩니다)
            <input
              className="w-full mt-0.5 border border-grey-300 rounded px-2 py-1.5 text-[12.5px]"
              value={approverTitle}
              onChange={(e) => setApproverTitle(e.target.value)}
              placeholder="예: CEO, 운영팀장"
            />
          </label>
          <div className="flex gap-2">
            <button
              disabled={busy || !approverTitle.trim()}
              aria-busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const outcome = await sendRegularContractOneClickAction({
                    childId: item.childId,
                    subjectEnrollmentId: item.subjectEnrollmentId,
                    guardianEmail: item.guardianEmail!,
                    guardianName: item.guardianName!,
                    childName: item.childName,
                    approverTitle: approverTitle.trim(),
                  });
                  if (outcome.status === "failed") {
                    setResult({ status: "failed", error: outcome.error });
                  } else {
                    setResult({ status: outcome.status, envelopeId: outcome.envelopeId, at: new Date().toISOString() });
                  }
                } finally {
                  setBusy(false);
                  setConfirming(false);
                  onSent();
                }
              }}
              className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
            >
              {busy ? "발송 처리 중..." : "확인 — 회사 승인 및 발송 실행"}
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="text-[12px] font-semibold px-3.5 py-1.5 rounded-lg text-grey-500"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
