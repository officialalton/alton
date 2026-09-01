"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceProvisioningItem } from "./workspace-data";
import {
  startTeacherWorkspaceProvisioning,
  suspendTeacher,
  reactivateTeacher,
  getTeacherActivationChecklist,
} from "./workspace-actions";

const STATUS_LABEL: Record<string, string> = {
  not_started: "시작 전",
  creating: "생성 중",
  created: "생성됨",
  first_login_pending: "최초 로그인 대기",
  linked: "연결됨",
  suspended: "정지됨",
  retryable_failed: "재시도 필요",
  manual_review: "수동 검토 필요",
};

const CONDITION_LABEL: Record<string, string> = {
  workspace_issued: "Workspace 계정 발급",
  first_login: "최초 Google 로그인",
  identity_linked: "ALTON-Google identity 연결",
  valid_rate: "유효한 현재 시급 이력",
  onboarding_complete: "필수 프로필·온보딩 완료",
  contract_signed: "계약 확인",
  admin_base_info: "관리자 기본정보 입력 완료",
};

export default function WorkspaceTab({
  provisionings,
}: {
  provisionings: WorkspaceProvisioningItem[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checklistByTeacher, setChecklistByTeacher] = useState<
    Record<string, { condition: string; satisfied: boolean; evidence_at: string | null }[]>
  >({});

  const [form, setForm] = useState({
    workspaceEmail: "",
    personalContactEmail: "",
    workspaceRecoveryEmail: "",
    personalPhone: "",
    givenName: "",
    familyName: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleStart() {
    setError(null);
    setSubmitting(true);
    try {
      await startTeacherWorkspaceProvisioning({
        workspaceEmail: form.workspaceEmail,
        personalContactEmail: form.personalContactEmail,
        workspaceRecoveryEmail: form.workspaceRecoveryEmail || form.personalContactEmail,
        personalPhone: form.personalPhone || null,
        givenName: form.givenName,
        familyName: form.familyName,
      });
      setForm({
        workspaceEmail: "",
        personalContactEmail: "",
        workspaceRecoveryEmail: "",
        personalPhone: "",
        givenName: "",
        familyName: "",
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "프로비저닝 시작에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShowChecklist(teacherId: string) {
    setError(null);
    try {
      const checklist = await getTeacherActivationChecklist(teacherId);
      setChecklistByTeacher((prev) => ({ ...prev, [teacherId]: checklist }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "체크리스트 조회에 실패했습니다.");
    }
  }

  async function handleSuspend(teacherId: string) {
    const reason = window.prompt("중단 사유를 입력해주세요.");
    if (!reason) return;
    setError(null);
    setBusyId(teacherId);
    try {
      await suspendTeacher(teacherId, reason);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "중단 처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(teacherId: string) {
    const reason = window.prompt("복귀 사유를 입력해주세요.");
    if (!reason) return;
    const amountStr = window.prompt("새 시급(원 단위 정수)을 입력해주세요.");
    const amount = Number(amountStr);
    if (!amountStr || !Number.isFinite(amount) || amount <= 0) return;
    setError(null);
    setBusyId(teacherId);
    try {
      await reactivateTeacher({
        teacherId,
        reason,
        newRateAmountMinor: amount,
        newRateCurrency: "KRW",
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "복귀 처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-[760px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">
        선생님 Google Workspace 프로비저닝
      </h1>

      {error && (
        <div className="bg-red/10 text-red text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-6">
        <h2 className="text-[14px] font-bold text-ink mb-3">새 프로비저닝 시작</h2>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input
            placeholder="workspace_email (xxx@alton.education)"
            value={form.workspaceEmail}
            onChange={(e) => setForm((f) => ({ ...f, workspaceEmail: e.target.value }))}
            className="col-span-2 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
          <input
            placeholder="personal_contact_email"
            value={form.personalContactEmail}
            onChange={(e) => setForm((f) => ({ ...f, personalContactEmail: e.target.value }))}
            className="px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
          <input
            placeholder="workspace_recovery_email(비우면 개인 이메일과 동일)"
            value={form.workspaceRecoveryEmail}
            onChange={(e) => setForm((f) => ({ ...f, workspaceRecoveryEmail: e.target.value }))}
            className="px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
          <input
            placeholder="personal_phone(선택)"
            value={form.personalPhone}
            onChange={(e) => setForm((f) => ({ ...f, personalPhone: e.target.value }))}
            className="px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
          <input
            placeholder="이름(given)"
            value={form.givenName}
            onChange={(e) => setForm((f) => ({ ...f, givenName: e.target.value }))}
            className="px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
          <input
            placeholder="성(family)"
            value={form.familyName}
            onChange={(e) => setForm((f) => ({ ...f, familyName: e.target.value }))}
            className="px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
        </div>
        <button
          disabled={submitting || !form.workspaceEmail || !form.personalContactEmail}
          onClick={handleStart}
          className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2 disabled:opacity-50"
        >
          {submitting ? "처리 중..." : "프로비저닝 시작"}
        </button>
      </div>

      <h2 className="text-[14px] font-bold text-ink mb-3">프로비저닝 현황</h2>
      <div className="space-y-3">
        {provisionings.length === 0 && (
          <p className="text-[13px] text-grey-400">진행 중인 프로비저닝이 없습니다.</p>
        )}
        {provisionings.map((p) => (
          <div key={p.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13.5px] font-bold text-ink">{p.workspaceEmail}</span>
              <span className="text-[11.5px] font-semibold rounded-full px-2.5 py-1 bg-grey-100 text-grey-500">
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>
            <p className="text-[12px] text-grey-500 mb-2">
              {p.linkedTeacherName ? `연결된 선생님: ${p.linkedTeacherName}` : "아직 연결되지 않음"}
            </p>

            {p.linkedTeacherId && (
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => handleShowChecklist(p.linkedTeacherId!)}
                  className="text-[12px] font-bold text-ink border border-grey-200 rounded-lg px-3 py-1.5"
                >
                  활성화 선행조건 확인
                </button>
                <button
                  disabled={busyId === p.linkedTeacherId}
                  onClick={() => handleSuspend(p.linkedTeacherId!)}
                  className="text-[12px] font-bold text-red border border-red rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  중단(inactive)
                </button>
                <button
                  disabled={busyId === p.linkedTeacherId}
                  onClick={() => handleReactivate(p.linkedTeacherId!)}
                  className="text-[12px] font-bold text-green border border-green rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  복귀(active)
                </button>
              </div>
            )}

            {p.linkedTeacherId && checklistByTeacher[p.linkedTeacherId] && (
              <ul className="text-[12px] text-grey-600 space-y-1 mt-2 pt-2 border-t border-grey-200">
                {checklistByTeacher[p.linkedTeacherId].map((c) => (
                  <li key={c.condition} className="flex items-center justify-between">
                    <span>
                      {c.satisfied ? "✅" : "⬜"} {CONDITION_LABEL[c.condition] ?? c.condition}
                    </span>
                    <span className="text-grey-400">
                      {c.evidence_at ? new Date(c.evidence_at).toLocaleDateString("ko-KR") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
