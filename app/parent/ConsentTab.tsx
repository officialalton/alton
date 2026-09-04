"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChildConsentStatus, ConsentPolicyOption } from "./consent-data";
import { consentForChild, revokeChildConsent } from "./consent-actions";

export default function ConsentTab({
  children,
  activePolicy,
}: {
  children: ChildConsentStatus[];
  activePolicy: ConsentPolicyOption | null;
}) {
  const router = useRouter();
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConsent(studentId: string) {
    if (!activePolicy) return;
    setError(null);
    setBusyStudentId(studentId);
    try {
      await consentForChild(studentId, activePolicy.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "동의 처리에 실패했습니다.");
    } finally {
      setBusyStudentId(null);
    }
  }

  async function handleRevoke(consentId: string, studentId: string) {
    const reason = window.prompt("철회 사유를 입력해주세요.");
    if (reason === null) return;
    setError(null);
    setBusyStudentId(studentId);
    try {
      await revokeChildConsent(consentId, reason);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "철회 처리에 실패했습니다.");
    } finally {
      setBusyStudentId(null);
    }
  }

  const minors = children.filter((c) => c.isUnder13);

  return (
    <div className="max-w-[560px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-2">보호자 동의</h1>
      <p className="text-[13px] text-grey-500 mb-5 leading-[1.6]">
        만 13세 미만 자녀는 서비스 이용을 위해 보호자의 동의가 필요합니다.
      </p>

      {error && (
        <div className="bg-red/10 text-red text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {minors.length === 0 ? (
        <p className="text-[13px] text-grey-400">
          동의가 필요한 만 13세 미만 자녀가 없습니다.
        </p>
      ) : (
        <div className="space-y-4">
          {minors.map((child) => (
            <div
              key={child.studentId}
              data-testid={`consent-card-${child.studentId}`}
              className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[14px] font-bold text-ink">{child.name}</h2>
                <span
                  className={
                    "text-[12px] font-semibold rounded-full px-2.5 py-1 " +
                    (child.hasValidConsent
                      ? "bg-green/10 text-green"
                      : "bg-red/10 text-red")
                  }
                >
                  {child.hasValidConsent ? "동의 완료" : "동의 필요"}
                </span>
              </div>

              {child.latestConsent && (
                <p className="text-[12.5px] text-grey-500 mb-3">
                  최근 처리: {child.latestConsent.policyVersionTitle} ·{" "}
                  {new Date(child.latestConsent.consentedAt).toLocaleDateString("ko-KR")}
                  {child.latestConsent.revokedAt && " (철회됨)"}
                </p>
              )}

              {activePolicy && (
                <p className="text-[12.5px] mb-3">
                  {activePolicy.documentUrl ? (
                    <a
                      href={activePolicy.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink underline font-semibold"
                    >
                      {activePolicy.title} 원문 보기
                    </a>
                  ) : (
                    <span className="text-grey-400">{activePolicy.title} 원문 준비 중</span>
                  )}
                </p>
              )}

              {child.hasValidConsent && child.latestConsent ? (
                <button
                  type="button"
                  disabled={busyStudentId === child.studentId}
                  onClick={() => handleRevoke(child.latestConsent!.id, child.studentId)}
                  className="text-[13px] font-bold text-red border border-red rounded-lg px-4 py-2 disabled:opacity-50"
                >
                  동의 철회
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyStudentId === child.studentId || !activePolicy}
                  onClick={() => handleConsent(child.studentId)}
                  className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2 disabled:opacity-50"
                >
                  {activePolicy ? `${activePolicy.title}에 동의` : "동의 가능한 정책 없음"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p
        data-testid="smart-notes-contract-notice"
        className="text-[12.5px] text-grey-500 leading-[1.6] mt-9 border-t border-grey-200 pt-5"
      >
        ALTON 정규수업은 수업 품질과 진도 관리를 위해 Google Meet의 AI 수업 회의록을 사용합니다.
        자세한 처리 범위는 가족 서비스 이용계약에서 확인할 수 있습니다. 가족계약은 정기구매나
        일정 기간의 수업 구매를 의무화하지 않으며, 필요할 때 수업권을 구매해 이용할 수 있습니다.
      </p>
    </div>
  );
}
