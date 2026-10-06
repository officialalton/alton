"use client";

// 2026-09-28 — 초기 고객 절차 단순화 4단계: 자동 계약 발송 outbox 관리자 화면.
// 체험 수업 completed 또는 직접 계정 생성 시 DB 트리거가 이 큐에 작업을
// 쌓는다(contract_dispatch_jobs). 실제 DocuSign 발송은
// 2026-10-06: 관리자 토글(contract_dispatch_settings, 기본 켜짐)이 켜져 있으면 조건 충족 시
// 실제 DocuSign 계약서가 자동 발송된다. 환경변수 "false"는 비상 강제 정지.

import { useState } from "react";
import {
  listContractDispatchJobs,
  runContractDispatchQueueAction,
  setContractAutoDispatchEnabledAction,
  retryContractDispatchJobAction,
  type ContractDispatchJobListItem,
  type ContractDispatchSettingInfo,
} from "./contract-dispatch-actions";
import { useTabCachedData } from "./use-tab-cached-data";
import type { DispatchOneResult } from "@/lib/contract-dispatch/dispatcher";

// 2026-09-29(D7) — 재시도 결과를 관리자에게 그대로 알린다(게이트 OFF 에서는 아무 것도 보내지 않았음을 명시).
export function describeRetryOutcome(result: DispatchOneResult): string {
  switch (result.outcome) {
    case "disabled":
      return "자동 발송이 꺼져 있어 아무 것도 보내지 않았습니다. 작업은 그대로 대기 중입니다.";
    case "sent":
      return "계약서를 발송했습니다.";
    case "already_sent":
      return "이미 발송된 계약입니다. 새로 보내지 않았습니다.";
    case "skipped_no_guardian":
      return "보호자 정보를 찾을 수 없어 발송하지 못했습니다(가구·보호자 연결 확인 필요).";
    case "busy":
      return "같은 자녀의 다른 발송이 진행 중이라 이번에는 보내지 않았습니다. 잠시 후 다시 시도해 주세요.";
    case "failed":
      return `발송에 실패했습니다: ${result.error}`;
  }
}

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
    envHardStop: boolean;
    setting: ContractDispatchSettingInfo;
    jobs: ContractDispatchJobListItem[];
  }>({
    cacheKey: "contract-dispatch-jobs",
    ttlMs: 10_000,
    fetcher: listContractDispatchJobs,
  });
  const [running, setRunning] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [confirmingOn, setConfirmingOn] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [retryMessages, setRetryMessages] = useState<Record<string, string>>({});

  const jobs = data?.jobs ?? [];
  const autoDispatchEnabled = data?.autoDispatchEnabled ?? false;
  const envHardStop = data?.envHardStop ?? false;
  const settingEnabled = data?.setting.enabled ?? false;

  async function applyToggle(next: boolean) {
    setToggling(true);
    setToggleError(null);
    try {
      await setContractAutoDispatchEnabledAction(next);
      setConfirmingOn(false);
      await refresh();
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : "설정을 바꾸지 못했습니다.");
    } finally {
      setToggling(false);
    }
  }

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

      <div className="flex items-center justify-between gap-3 mb-3" data-testid="contract-dispatch-toggle">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-bold text-ink">
            계약서 자동 발송 {settingEnabled ? "켜짐" : "꺼짐"}
          </span>
          <span className="text-[11.5px] text-grey-500" data-testid="contract-dispatch-toggle-meta">
            {data?.setting.updatedAt
              ? `마지막 변경: ${data.setting.updatedByName ?? "알 수 없음"} · ${new Date(data.setting.updatedAt).toLocaleString("ko-KR")}`
              : "마지막 변경: 기본값(켜짐)"}
          </span>
        </div>
        <button
          role="switch"
          aria-checked={settingEnabled}
          aria-label="계약서 자동 발송"
          disabled={toggling || !data}
          onClick={() => (settingEnabled ? void applyToggle(false) : setConfirmingOn(true))}
          className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          {settingEnabled ? "끄기" : "켜기"}
        </button>
      </div>
      {toggleError && (
        <p className="text-[12px] text-red mb-2" role="alert">
          {toggleError}
        </p>
      )}
      {confirmingOn && (
        <div
          role="alertdialog"
          aria-label="계약서 자동 발송 켜기 확인"
          className="bg-yellow-bg text-[12px] text-ink rounded-lg px-3.5 py-3 mb-3"
          data-testid="contract-dispatch-confirm"
        >
          <p className="mb-2">
            자동 발송을 켜면 조건(체험 수업 완료·직접 계정 생성·정규 바로 진행)이 충족될 때 실제 DocuSign 계약서가
            보호자에게 자동으로 발송됩니다. 켜시겠습니까?
          </p>
          <div className="flex gap-2">
            <button
              disabled={toggling}
              onClick={() => void applyToggle(true)}
              className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
            >
              {toggling ? "처리 중..." : "켜기 확인"}
            </button>
            <button
              disabled={toggling}
              onClick={() => setConfirmingOn(false)}
              className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {!autoDispatchEnabled && (
        <div
          className="bg-yellow-bg text-[12px] text-ink rounded-lg px-3.5 py-2.5 mb-3"
          data-testid="contract-dispatch-disabled-banner"
        >
          {envHardStop
            ? "비상 정지(환경변수 CONTRACT_AUTO_DISPATCH_ENABLED=false)가 걸려 있어 위 설정과 관계없이 발송되지 않습니다. "
            : "자동 발송이 꺼져 있습니다. "}
          큐에는 계속 쌓이지만 실제 이메일·계약서는 나가지 않습니다.
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
                {retryMessages[job.id] && (
                  <span className="text-[11.5px] font-semibold text-ink" role="status" data-testid={`contract-dispatch-retry-message-${job.id}`}>
                    {retryMessages[job.id]}
                  </span>
                )}
              </div>
              {(job.status === "retryable_failed" || job.status === "permanent_failed") && (
                <button
                  disabled={retryingId === job.id}
                  onClick={async () => {
                    setRetryingId(job.id);
                    try {
                      const result = await retryContractDispatchJobAction(job.id);
                      setRetryMessages((prev) => ({ ...prev, [job.id]: describeRetryOutcome(result) }));
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
