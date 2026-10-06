"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChildConsentStatus, ConsentPolicyOption } from "./consent-data";
import { consentForChild } from "./consent-actions";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateEn as fmtDate } from "@/lib/format-datetime-en";

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
      setError(e instanceof Error ? e.message : "We couldn't record your consent.");
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
      <h1 className="text-[20px] font-extrabold text-ink mb-2">Parental Consent</h1>
      <p className="text-[13px] text-grey-500 mb-5 leading-[1.6]">
        Children under 13 need a parent or guardian&apos;s consent to use the service.
      </p>

      {error && (
        <div className="bg-red/10 text-red text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {minors.length === 0 ? (
        <p className="text-[13px] text-grey-400">
          No children under 13 require consent.
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
                  {child.hasValidConsent ? "Consent given" : "Consent needed"}
                </span>
              </div>

              {child.latestConsent && (
                <p className="text-[12.5px] text-grey-500 mb-3">
                  Latest: {child.latestConsent.policyVersionTitle} ·{" "}
                  {fmtDate(child.latestConsent.consentedAt, undefined, tz)}
                  {child.latestConsent.revokedAt && " (revoked)"}
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
                    View {activePolicy.title}
                  </button>
                </p>
              )}

              {child.hasValidConsent && child.latestConsent ? (
                <button
                  type="button"
                  disabled
                  className="text-[13px] font-bold text-grey-400 border border-grey-200 rounded-lg px-4 py-2 opacity-50"
                >
                  Consent given
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyStudentId === child.studentId || !activePolicy}
                  onClick={() => handleConsent(child.studentId)}
                  className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2 disabled:opacity-50"
                >
                  {activePolicy ? `Agree to ${activePolicy.title}` : "No policy available"}
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
        ALTON EDUCATION regular lessons use Google Meet&apos;s AI meeting notes to support lesson quality and progress
        tracking. See the Family Service Agreement for details on how this data is handled. The family agreement does
        not require a subscription or any minimum purchase; lesson credits can be bought whenever you need them.
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
                Close
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
                "Document coming soon."
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
