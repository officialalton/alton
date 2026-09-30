"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChildConsentStatus, ConsentPolicyOption } from "./consent-data";
import { consentForChild } from "./consent-actions";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDate } from "@/lib/format-datetime";

// 2026-09-28(초기 고객 절차 단순화) — 체험 Smart Notes 동의 섹션과 "정규 진행
// 희망" 섹션(TrialConversionPanel)을 제거했다. 체험 수업에는 이제 AI 기록을
// 아예 안 쓰므로 별도 동의가 불필요해졌고, 계약 자동 발송도 학부모 클릭이
// 아니라 체험 수업 완료 여부로 트리거된다(docs/2026-09-26-consent-contract-
// simplification-implementation-plan.md). 이 화면에는 13세 미만 보호자 동의만
// 남는다 — 그 시스템은 이번 변경과 무관하게 그대로 유지된다.
export default function ConsentTab({
  children,
  activePolicy,
}: {
  children: ChildConsentStatus[];
  activePolicy: ConsentPolicyOption | null;
}) {
  const tz = useViewerTimezone();
  const router = useRouter();
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docModal, setDocModal] = useState<{ title: string; documentUrl: string | null } | null>(null);

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

  // 2026-09-10(P0) — 생년월일이 아직 입력되지 않은 자녀(계정 생성 직후 등)는
  // is_under_13()이 fail-closed로 true를 반환해도 "미성년 확정"이 아니므로
  // 동의 카드를 띄우지 않는다(dobKnown으로 구분).
  const minors = children.filter((c) => c.isUnder13 && c.dobKnown);

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
                  {fmtDate(child.latestConsent.consentedAt, undefined, tz)}
                  {child.latestConsent.revokedAt && " (철회됨)"}
                </p>
              )}

              {activePolicy && (
                <p className="text-[12.5px] mb-3">
                  <button
                    type="button"
                    onClick={() =>
                      setDocModal({ title: activePolicy.title, documentUrl: activePolicy.documentUrl })
                    }
                    className="text-ink underline font-semibold"
                  >
                    {activePolicy.title} 원문 보기
                  </button>
                </p>
              )}

              {child.hasValidConsent && child.latestConsent ? (
                <button
                  type="button"
                  disabled
                  className="text-[13px] font-bold text-grey-400 border border-grey-200 rounded-lg px-4 py-2 opacity-50"
                >
                  동의 완료
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

      {docModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 px-5"
          onClick={() => setDocModal(null)}
        >
          <div
            data-testid="consent-document-modal"
            className="bg-white rounded-xl max-w-[560px] w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-grey-200">
              <h2 className="text-[14px] font-extrabold text-ink">{docModal.title}</h2>
              <button
                type="button"
                onClick={() => setDocModal(null)}
                className="text-[13px] font-bold text-grey-400"
              >
                닫기
              </button>
            </div>
            <div className="px-5 py-5 overflow-y-auto text-[13px] text-grey-500 leading-[1.6]">
              {docModal.documentUrl ? (
                <iframe
                  src={docModal.documentUrl}
                  title={docModal.title}
                  className="w-full h-[50vh] border-0"
                />
              ) : (
                "원문 준비 중입니다."
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
