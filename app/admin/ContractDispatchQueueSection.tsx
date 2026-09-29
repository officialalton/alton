"use client";

// 2026-09-28 — 초기 고객 절차 단순화 4단계: 자동 계약 발송 outbox 관리자 화면.
// 체험 수업 completed 또는 직접 계정 생성 시 DB 트리거가 이 큐에 작업을
// 쌓는다(contract_dispatch_jobs). 실제 DocuSign 발송은
// CONTRACT_AUTO_DISPATCH_ENABLED=true일 때만 일어난다 — 기본은 비활성이라
// 아래 "발송 실행" 버튼을 눌러도 큐만 계속 쌓이고 실제 이메일은 안 나간다.

import { useState } from "react";
import {
  listContractDispatchJobs,
  runContractDispatchQueueAction,
  retryContractDispatchJobAction,
  type ContractDispatchJobListItem,
} from "./contract-dispatch-actions";
import { useTabCachedData } from "./use-tab-cached-data";

const STATUS_LABEL: Record<ContractDispatchJobListItem["status"], string> = {
  queued: "대기 중",
  processing: "처리 중",
  sent: "발송됨",
  retryable_failed: "실패(재시도 가능)",
  permanent_failed: "실패(영구)",
};

const TRIGGER_LABEL: Record<ContractDispatchJobListItem["trigger_type"], string> = {
  completed_trial: "체험 수업 완료",
  direct_account_created: "직접 계정 생성",
  regular_recommended: "정규 바로 진행",
};

export default function ContractDispatchQueueSection() {
  const { data, refreshing, refresh } = useTabCachedData<{
    autoDispatchEnabled: boolean;
    jobs: ContractDispatchJobListItem[];
  }>({
    cacheKey: "contract-dispatch-jobs",
    ttlMs: 10_000,
    fetcher: listContractDispatchJobs,
  });
  const [running, setRunning] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);

  const jobs = data?.jobs ?? [];
  const autoDispatchEnabled = data?.autoDispatchEnabled ?? false;
  const pendingCount = jobs.filter((j) => j.status === "queued" || j.status === "retryable_failed").length;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-6" data-testid="contract-dispatch-queue">
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-[14px] font-extrabold text-ink">계약 자동 발송 큐</h2>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-[11.5px] font-bold text-ink underline disabled:opacity-50"
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>

      {!autoDispatchEnabled && (
        <div
          className="bg-yellow-bg text-[12px] text-ink rounded-lg px-3.5 py-2.5 mb-3"
          data-testid="contract-dispatch-disabled-banner"
        >
          자동 발송이 비활성화되어 있습니다(CONTRACT_AUTO_DISPATCH_ENABLED 환경변수
          필요). 체험 수업 완료·직접 계정 생성 시 이 큐에는 계속 쌓이지만, 실제
          이메일·계약서는 나가지 않습니다. 활성화는 별도 승인 후 진행합니다.
        </div>
      )}

      <p className="text-[12.5px] text-grey-500 mb-3">
        대기 {pendingCount}건 · 전체 {jobs.length}건
      </p>

      <div className="flex items-center gap-2 mb-3">
        <button
          disabled={running || pendingCount === 0}
          onClick={async () => {
            setRunning(true);
            setRunResult(null);
            try {
              const result = await runContractDispatchQueueAction();
              setRunResult(
                result.enabled
                  ? `처리 ${result.processed}건 — 발송 ${result.sent}건 / 실패 ${result.failed}건`
                  : "자동 발송이 비활성화되어 있어 아무 것도 처리하지 않았습니다."
              );
              await refresh();
            } finally {
              setRunning(false);
            }
          }}
          className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {running ? "처리 중..." : "발송 실행"}
        </button>
        {runResult && <span className="text-[12px] text-grey-500">{runResult}</span>}
      </div>

      {jobs.length === 0 ? (
        <p className="text-[13px] text-grey-400">큐에 쌓인 작업이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              data-testid={`contract-dispatch-job-${job.id}`}
              className="flex items-center justify-between border-[1.5px] border-grey-100 rounded-lg px-3.5 py-2.5"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-ink">{job.childName ?? job.child_id}</span>
                <span className="text-[11.5px] text-grey-500">
                  {TRIGGER_LABEL[job.trigger_type]} · {STATUS_LABEL[job.status]}
                  {job.last_error ? ` · ${job.last_error}` : ""}
                </span>
              </div>
              {(job.status === "retryable_failed" || job.status === "permanent_failed") && (
                <button
                  disabled={retryingId === job.id}
                  onClick={async () => {
                    setRetryingId(job.id);
                    try {
                      await retryContractDispatchJobAction(job.id);
                      await refresh();
                    } finally {
                      setRetryingId(null);
                    }
                  }}
                  className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                >
                  {retryingId === job.id ? "재시도 중..." : "재시도"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
