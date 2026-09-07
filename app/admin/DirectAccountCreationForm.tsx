"use client";

// 2026-09-06(M4 마지막 항목) — 지인/추천: 상담 없이 바로 보호자+학생 계정 생성.
// UI 패턴은 TrialOnboardingStudentsForm.tsx와 동일(보호자 1명 + 학생 1~N행)하되
// consultationId를 받지 않고 sendDirectOnboardingNoticeAction()을 호출한다.

import { useState } from "react";
import {
  sendDirectOnboardingNoticeAction,
  type SendDirectOnboardingNoticeResult,
} from "./direct-account-actions";
import { useToasts, ToastStack } from "./Toast";

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StudentRow = { name: string; email: string; grade: string; subject: string };

function emptyRow(): StudentRow {
  return { name: "", email: "", grade: "", subject: "" };
}

export default function DirectAccountCreationForm() {
  const [open, setOpen] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SendDirectOnboardingNoticeResult | null>(null);
  const { toasts, showToast, dismiss } = useToasts();

  function updateStudent(index: number, field: keyof StudentRow, value: string) {
    setStudents((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }
  function addStudentRow() {
    setStudents((prev) => [...prev, emptyRow()]);
  }
  function removeStudentRow(index: number) {
    setStudents((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }
  function reset() {
    setGuardianEmail("");
    setGuardianName("");
    setStudents([emptyRow()]);
    setError(null);
  }

  const isValid =
    guardianName.trim().length > 0 &&
    SIMPLE_EMAIL_RE.test(guardianEmail.trim()) &&
    students.every((s) => s.name.trim().length > 0 && SIMPLE_EMAIL_RE.test(s.email.trim()));

  if (!open) {
    return (
      <div className="mt-4">
        <button
          onClick={() => {
            setOpen(true);
            setLastResult(null);
          }}
          className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full"
        >
          + 지인/추천 — 상담 없이 바로 계정 생성
        </button>
        <ToastStack toasts={toasts} dismiss={dismiss} />
      </div>
    );
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mt-4">
      <div className="text-[13px] font-bold text-ink mb-1">지인/추천 — 상담 없이 바로 계정 생성</div>
      <p className="text-[11.5px] text-grey-500 mb-3">
        상담 칸반과 완전히 무관하게 보호자+학생 계정을 바로 생성합니다. 보호자에게 계정 생성 안내
        이메일이 1개 발송되고, 학생 계정 생성이 성공하면 체험수업권도 동일하게 지급됩니다.
      </p>
      {error && <p className="text-[12px] text-red mb-2">{error}</p>}
      <div className="space-y-1.5">
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
        <div className="flex gap-3 mt-2">
          <button
            className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
            disabled={busy || !isValid}
            aria-busy={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const result = await sendDirectOnboardingNoticeAction({
                  guardianEmail,
                  guardianName,
                  students: students.map((s) => ({
                    name: s.name,
                    email: s.email,
                    grade: s.grade || undefined,
                    subject: s.subject || undefined,
                  })),
                });
                setLastResult(result);
                if (result.status === "failed") {
                  setError(`발송 실패(관리자 조치 필요) — ${result.error}`);
                  showToast("error", `발송 실패 — ${result.error}`);
                } else {
                  showToast("success", "계정 생성 안내 발송 완료");
                  reset();
                  setOpen(false);
                }
              } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                setError(message);
                showToast("error", `발송 실패 — ${message}`);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "발송 중..." : "계정 생성 안내 발송"}
          </button>
          <button onClick={() => setOpen(false)} className="text-[12px] font-semibold text-grey-500">
            취소
          </button>
        </div>
        {lastResult?.status === "sent" && lastResult.localRedeemUrl && (
          <p className="text-[11px] text-grey-500 break-all mt-1">
            (개발용) 로컬 확인 링크: {lastResult.localRedeemUrl}
          </p>
        )}
      </div>
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
