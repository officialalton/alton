"use client";

// 2026-09-06(관리자 온보딩 발송 폼 통합) — 관리자가 "체험 온보딩 안내"를 발송하는
// 진입점은 두 곳(TrialOnboardingPanel.tsx의 파이프라인 카드, ConsultationKanbanBoard.tsx의
// 칸반 카드 상세)이지만 학생 1~N명 입력 폼(기본 1행 + "학생 추가")은 이 컴포넌트
// 하나만 존재한다. 두 진입점 모두 이 컴포넌트를 그대로 렌더링해
// sendTrialOnboardingNoticeAction()을 호출한다 — 가족당 온보딩 링크 1개, 학생별
// 개별 이름/이메일/학년/과목 입력, 형식 검증(빈 값·이메일 형식)까지 동일하게
// 적용된다. 별도의 "체험 대상 자녀 확정" 단계나 자녀 수 선택 UI는 만들지 않는다.

import { useState } from "react";
import {
  sendTrialOnboardingNoticeAction,
  type SendTrialOnboardingNoticeResult,
} from "./trial-onboarding-actions";
import { useToasts, ToastStack } from "./Toast";

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type TrialOnboardingStudentRow = { name: string; email: string; grade: string; subject: string };

function emptyRow(defaultGrade = ""): TrialOnboardingStudentRow {
  return { name: "", email: "", grade: defaultGrade, subject: "" };
}

export default function TrialOnboardingStudentsForm({
  consultationId,
  defaultGuardianEmail = "",
  defaultGuardianName = "",
  defaultStudentGrade = "",
  submitLabel,
  noticeDeliveryStatus,
  noticeSendError,
  onResult,
}: {
  consultationId: string;
  defaultGuardianEmail?: string;
  defaultGuardianName?: string;
  defaultStudentGrade?: string;
  submitLabel: string;
  /** 이전 발송 실패 배너 노출용(2026-09-05 보완, 기존 회귀 없음 요구사항) — 두
   *  진입점 모두 이 값을 넘기면 동일한 실패 배너를 보여준다. 넘기지 않으면(예:
   *  아직 발송 이력을 조회하지 않는 화면) 배너 자체를 렌더링하지 않는다. */
  noticeDeliveryStatus?: "pending" | "sent" | "failed" | null;
  noticeSendError?: string | null;
  onResult: (result: SendTrialOnboardingNoticeResult) => void;
}) {
  const [guardianEmail, setGuardianEmail] = useState(defaultGuardianEmail);
  const [guardianName, setGuardianName] = useState(defaultGuardianName);
  const [students, setStudents] = useState<TrialOnboardingStudentRow[]>([emptyRow(defaultStudentGrade)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 2026-09-11(제품 오너 확정 정책) — 발급 전 자녀 이메일 중복 차단 시, 어느
  // 학생 입력란이 문제인지 이메일별로 표시한다(일반 에러 배너 대신).
  const [duplicateEmails, setDuplicateEmails] = useState<Set<string>>(new Set());
  const { toasts, showToast, dismiss } = useToasts();

  function updateStudent(index: number, field: keyof TrialOnboardingStudentRow, value: string) {
    if (field === "email" && duplicateEmails.size > 0) {
      setDuplicateEmails((prev) => {
        const next = new Set(prev);
        next.delete(students[index].email.trim().toLowerCase());
        return next;
      });
    }
    setStudents((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }
  function addStudentRow() {
    setStudents((prev) => [...prev, emptyRow()]);
  }
  function removeStudentRow(index: number) {
    setStudents((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const isValid =
    guardianName.trim().length > 0 &&
    SIMPLE_EMAIL_RE.test(guardianEmail.trim()) &&
    students.every((s) => s.name.trim().length > 0 && SIMPLE_EMAIL_RE.test(s.email.trim()));

  return (
    <div className="space-y-1.5">
      {noticeDeliveryStatus === "failed" && (
        <p className="text-[12px] text-red mb-2" data-testid="trial-notice-failed">
          이전 발송 실패{noticeSendError ? `: ${noticeSendError}` : ""} — 아래에서 다시 시도할 수 있습니다.
        </p>
      )}
      {error && <p className="text-[12px] text-red">{error}</p>}
      <input
        value={guardianName}
        onChange={(e) => setGuardianName(e.target.value)}
        placeholder="보호자 이름"
        className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
      />
      <input
        value={guardianEmail}
        onChange={(e) => setGuardianEmail(e.target.value)}
        placeholder="보호자 이메일"
        className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
      />
      <div className="space-y-2 border-t border-grey-200 pt-2 mt-1">
        {students.map((s, i) => (
          <div key={i} className="border border-grey-200 rounded-lg p-2 space-y-1 relative">
            <div className="text-[11px] font-bold text-grey-400">학생 {i + 1}</div>
            <input
              value={s.name}
              onChange={(e) => updateStudent(i, "name", e.target.value)}
              placeholder="학생 이름"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
            />
            <input
              value={s.email}
              onChange={(e) => updateStudent(i, "email", e.target.value)}
              placeholder="학생 이메일"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
            />
            {duplicateEmails.has(s.email.trim().toLowerCase()) && (
              <p className="text-[11px] text-red" data-testid={`duplicate-email-${i}`}>
                이미 사용 중인 이메일입니다. 다른 이메일을 입력해주세요.
              </p>
            )}
            <input
              value={s.grade}
              onChange={(e) => updateStudent(i, "grade", e.target.value)}
              placeholder="학년(선택)"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
            />
            <input
              value={s.subject}
              onChange={(e) => updateStudent(i, "subject", e.target.value)}
              placeholder="과목(선택)"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
            />
            {students.length > 1 && (
              <button
                type="button"
                onClick={() => removeStudentRow(i)}
                className="text-[11px] text-red font-bold"
              >
                이 학생 삭제
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addStudentRow} className="text-[11.5px] font-bold text-ink underline">
          + 학생 추가
        </button>
      </div>
      <button
        className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
        disabled={busy || !isValid}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          setDuplicateEmails(new Set());
          try {
            const result = await sendTrialOnboardingNoticeAction({
              consultationId,
              guardianEmail,
              guardianName,
              students: students.map((s) => ({
                name: s.name,
                email: s.email,
                grade: s.grade || undefined,
                subject: s.subject || undefined,
              })),
            });
            if (result.status === "duplicate_emails") {
              setDuplicateEmails(new Set(result.collisions.map((c) => c.email.trim().toLowerCase())));
              showToast("error", `이미 사용 중인 이메일이 있어 발송하지 않았습니다: ${result.collisions.map((c) => c.email).join(", ")}`);
            } else if (result.status === "failed") {
              setError(`발송 실패(관리자 조치 필요) — ${result.error}`);
              showToast("error", `발송 실패 — ${result.error}`);
            } else if (result.status === "sent") {
              showToast("success", "체험 온보딩 안내 발송 완료");
            } else if (result.status === "already_sent") {
              showToast("success", "이미 발송된 안내입니다(중복 발송 안 함)");
            }
            onResult(result);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setError(message);
            showToast("error", `발송 실패 — ${message}`);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "발송 중..." : submitLabel}
      </button>
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
