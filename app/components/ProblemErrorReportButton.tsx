"use client";

import { useId, useRef, useState, useTransition } from "react";
import { submitProblemErrorReportAction } from "@/lib/problem-error-reports/actions";
import {
  MEMO_MAX,
  MY_STATUS_TEXT,
  MY_STATUS_TEXT_EN,
  REPORT_TYPE_HINT,
  REPORT_TYPE_HINT_EN,
  REPORT_TYPE_LABEL,
  REPORT_TYPE_LABEL_EN,
  REPORT_UI_TEXT,
  reportTypesFor,
  type ReportLang,
  type MyReportStatus,
  type ReportContext,
  type ReportType,
  type ReporterRole,
} from "@/lib/problem-error-reports/labels";

/**
 * "문제 오류 신고" 버튼 — 학생·선생님 전용(학부모에는 렌더하지 않는다). 수업 과제 문제 화면·모의고사 응시·결과 화면 공용.
 * 버튼을 누르면 그 자리에서 유형(필수) + 메모 양식이 열린다. 해설 오류는 선생님 UI 에만 나온다.
 * 같은 문항 재신고는 서버가 duplicate 로 돌려주고, 화면은 '이미 신고함'으로 바꾼다.
 * 상태 문구(검토 중 / 오류 확정 / 오류 아님)는 부모가 한 번에 불러 initialStatus 로 내려준다.
 */
export default function ProblemErrorReportButton({
  context,
  role,
  initialStatus = null,
  className = "",
  variant = "pill",
  lang = "ko",
}: {
  context: ReportContext;
  role: ReporterRole;
  initialStatus?: MyReportStatus | null;
  className?: string;
  /** "icon": 응시 화면 번호 막대 안에 들어가는 작은 ⚠️ 아이콘(신고 양식은 아래로 떠서 열린다). 기본은 알약 버튼. */
  variant?: "pill" | "icon";
  /** 표시 언어. 기본 한국어, 모의고사 응시 화면은 영어. */
  lang?: ReportLang;
}) {
  const T = REPORT_UI_TEXT[lang];
  const statusText = lang === "en" ? MY_STATUS_TEXT_EN : MY_STATUS_TEXT;
  const typeLabel = lang === "en" ? REPORT_TYPE_LABEL_EN : REPORT_TYPE_LABEL;
  const typeHint = lang === "en" ? REPORT_TYPE_HINT_EN : REPORT_TYPE_HINT;
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportType | null>(null);
  const [memo, setMemo] = useState("");
  // 방금 내가 신고했으면 그 상태(검토 중)를, 아니면 부모가 나중에 내려준 진행 상태를 쓴다.
  const [justReported, setJustReported] = useState(false);
  const status: MyReportStatus | null = justReported ? "reviewing" : initialStatus;
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "new" | "duplicate">(null);
  const [pending, startTransition] = useTransition();
  const formId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const types = reportTypesFor(role);
  const memoRequired = type === "other";
  const canSubmit = Boolean(type) && (!memoRequired || memo.trim().length > 0) && !pending;

  function close() {
    setOpen(false);
    setError(null);
    triggerRef.current?.focus();
  }

  function submit() {
    if (!type || !canSubmit) return;
    setError(null);
    startTransition(async () => {
      const res = await submitProblemErrorReportAction({ context, reportType: type, memo: memo.trim() || null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(res.value.duplicate ? "duplicate" : "new");
      setJustReported(true);
      setMemo("");
      setType(null);
    });
  }

  const reported = status !== null;
  const isIcon = variant === "icon";
  return (
    <div className={`${isIcon ? "relative inline-block " : ""}${className}`} data-testid="problem-error-report">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={formId}
        aria-label={reported ? statusText[status!] : T.trigger}
        title={reported ? statusText[status!] : T.trigger}
        className={
          isIcon
            ? `inline-flex h-7 w-7 items-center justify-center rounded text-[15px] leading-none transition-opacity hover:bg-black/10 ${reported ? "opacity-100" : "opacity-60 hover:opacity-100"}`
            : `inline-flex min-h-[32px] items-center rounded-full border px-3 py-1 text-[11.5px] font-bold transition-colors ${
                reported ? "border-grey-200 bg-grey-50 text-grey-500" : "border-grey-300 text-grey-600 hover:bg-grey-100"
              }`
        }
      >
        {isIcon ? (reported ? "✅" : "⚠️") : reported ? statusText[status!] : T.trigger}
      </button>

      {open && (
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
          className={`rounded-lg border border-grey-200 bg-white p-3 text-[13px] ${isIcon ? "absolute left-0 top-full z-30 mt-1 w-[340px] shadow-lg" : "mt-2"}`}
          aria-label={T.trigger}
        >
          {done ? (
            <p role="status" className="text-[12.5px] font-semibold text-grey-700">
              {done === "duplicate" ? T.duplicate : T.accepted}
            </p>
          ) : (
            <>
              <fieldset disabled={pending}>
                <legend className="mb-1.5 text-[12px] font-bold text-grey-500">{T.legend}</legend>
                <div className="flex flex-col gap-1">
                  {types.map((t) => (
                    <label
                      key={t}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${type === t ? "border-ink bg-grey-50" : "border-grey-200"}`}
                    >
                      <input type="radio" name={`${formId}-type`} value={t} checked={type === t} onChange={() => setType(t)} className="mt-0.5" />
                      <span>
                        <span className="block font-bold">{typeLabel[t]}</span>
                        <span className="block text-[11.5px] text-grey-500">{typeHint[t]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="mt-2 block text-[12px] font-bold text-grey-500" htmlFor={`${formId}-memo`}>
                {T.memo}{memoRequired ? T.required : T.optional}
              </label>
              <textarea
                id={`${formId}-memo`}
                value={memo}
                onChange={(e) => setMemo(e.target.value.slice(0, MEMO_MAX))}
                rows={3}
                maxLength={MEMO_MAX}
                disabled={pending}
                placeholder={T.placeholder}
                className="mt-1 w-full rounded-lg border border-grey-200 p-2 text-[13px] focus:border-ink focus:outline-none"
              />
              <p className="mt-0.5 text-right text-[11px] text-grey-400">
                {memo.length}/{MEMO_MAX}
              </p>
              {error && (
                <p role="alert" className="mt-1 text-[12px] font-semibold text-red">
                  {error}
                </p>
              )}
            </>
          )}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={close} className="min-h-[32px] rounded-lg px-3 py-1 text-[12px] font-bold text-grey-500 hover:bg-grey-100">
              {done ? T.close : T.cancel}
            </button>
            {!done && (
              <button
                type="submit"
                disabled={!canSubmit}
                className="min-h-[32px] rounded-lg bg-ink px-3 py-1 text-[12px] font-bold text-white disabled:opacity-40"
              >
                {pending ? T.sending : T.submit}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
