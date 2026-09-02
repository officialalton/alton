"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChildConsentStatus, ConsentPolicyOption } from "./consent-data";
import { consentForChild, revokeChildConsent, setAiNotesConsentForChild } from "./consent-actions";

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

  async function handleToggleAiNotes(studentId: string, nextOptedIn: boolean) {
    setError(null);
    setBusyStudentId(studentId);
    try {
      const reason = nextOptedIn ? undefined : "보호자 거부";
      await setAiNotesConsentForChild(studentId, nextOptedIn, reason);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 회의록 설정 변경에 실패했습니다.");
    } finally {
      setBusyStudentId(null);
    }
  }

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

      <h2 className="text-[16px] font-bold text-ink mt-9 mb-2">AI 회의록(Smart Notes)</h2>
      <p className="text-[13px] text-grey-500 mb-5 leading-[1.6]">
        기본적으로 모든 수업에 AI 회의록이 사용됩니다(영상·원본 음성 녹화는 하지 않습니다). 자녀별로
        끄면 이후 새로 생성되는 수업부터 AI 회의록을 사용하지 않습니다 — 이미 진행된 수업에는
        영향이 없습니다.
      </p>
      <div className="space-y-3">
        {children.map((child) => (
          <div
            key={child.studentId}
            data-testid={`ai-notes-card-${child.studentId}`}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 flex items-center justify-between"
          >
            <span className="text-[14px] font-bold text-ink">{child.name}</span>
            <button
              type="button"
              disabled={busyStudentId === child.studentId}
              onClick={() => handleToggleAiNotes(child.studentId, !child.aiNotesOptedIn)}
              className={
                "text-[12px] font-bold rounded-full px-3 py-1.5 disabled:opacity-50 " +
                (child.aiNotesOptedIn ? "bg-green/10 text-green" : "bg-grey-100 text-grey-500")
              }
            >
              {child.aiNotesOptedIn ? "사용 중 · 끄기" : "사용 안 함 · 켜기"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
