"use client";

import { useEffect, useState } from "react";
import {
  getConsultantAgreementStateAction,
  saveConsultantAgreementInputsAction,
  sendConsultantAgreementAction,
  retryConsultantAgreementArchiveAction,
} from "./consultant-agreement-actions";
import type { ConsultantAgreementState } from "@/lib/consultant-agreements/send";

const STATUS_LABEL: Record<ConsultantAgreementState["status"], string> = {
  not_sent: "미발송",
  sent: "발송됨(서명 대기)",
  signed: "서명 완료",
  declined: "서명 거부",
  voided: "무효 처리",
};

type Key = "work_country" | "work_region" | "work_location_detail" | "mailing_address" | "start_date" | "monthly_fee_currency" | "monthly_fee_amount" | "monthly_scope" | "prior_materials";
const FIELDS: { key: Key; label: string; placeholder?: string; multiline?: boolean; type?: string }[] = [
  { key: "work_country", label: "실제 근무 국가(2자리 코드)", placeholder: "KR(원화) 또는 US(달러)" },
  { key: "work_region", label: "근무 주(미국인 경우)", placeholder: "CA" },
  { key: "work_location_detail", label: "근무 도시·지역" },
  { key: "mailing_address", label: "우편 주소" },
  { key: "start_date", label: "시작일", type: "date" },
  { key: "monthly_fee_currency", label: "월 보수 통화(KRW 또는 USD)", placeholder: "KRW" },
  { key: "monthly_fee_amount", label: "월 보수 금액(원 또는 달러)", type: "number" },
  { key: "monthly_scope", label: "월 업무 범위(계약서에 그대로 기재됨)", multiline: true },
  { key: "prior_materials", label: "기존 자료(비워 두면 None으로 기재)", multiline: true },
];

/** 컨설턴트 프리랜서 계약서(독립 계약자) — 선생님 계약서 섹션과 같은 구조. 계약 형태는 프리랜서 고정. */
export default function ConsultantAgreementSection({ consultantId }: { consultantId: string }) {
  const [state, setState] = useState<ConsultantAgreementState | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function apply(s: ConsultantAgreementState) {
    setState(s);
    const f: Record<string, string> = {};
    for (const fld of FIELDS) f[fld.key] = ((s.inputs as Record<string, unknown> | null)?.[fld.key] as string | null | undefined) ?? "";
    setForm(f);
  }

  useEffect(() => {
    let cancelled = false;
    getConsultantAgreementStateAction(consultantId).then((r) => {
      if (cancelled) return;
      if (r.ok) apply(r.data);
      else setMsg({ kind: "err", text: r.error });
    });
    return () => {
      cancelled = true;
    };
  }, [consultantId]);

  async function run(fn: () => ReturnType<typeof saveConsultantAgreementInputsAction>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      if (r.ok) {
        apply(r.data);
        setMsg({ kind: "ok", text: okText });
      } else setMsg({ kind: "err", text: r.error });
    } catch {
      setMsg({ kind: "err", text: "처리에 실패했습니다. 잠시 후 다시 시도해주세요." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4" data-testid="consultant-agreement-section">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">컨설턴트 계약서(프리랜서)</div>
      {!state ? (
        <p className="text-[13px] text-grey-500">{msg?.text ?? "불러오는 중..."}</p>
      ) : (
        <>
          <p className="text-[13px] text-ink mb-2">
            상태: <strong data-testid="consultant-agreement-status">{STATUS_LABEL[state.status]}</strong>
          </p>
          {state.status !== "signed" && (
            <>
              <div className="grid gap-2 mb-3">
                {FIELDS.map((f) => (
                  <label key={f.key} className="text-[12px] text-grey-600 font-semibold">
                    {f.label}
                    {f.multiline ? (
                      <textarea
                        value={form[f.key] ?? ""}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        rows={2}
                        className="block w-full mt-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] font-normal"
                      />
                    ) : (
                      <input
                        type={f.type ?? "text"}
                        step={f.type === "number" ? "any" : undefined}
                        value={form[f.key] ?? ""}
                        placeholder={f.placeholder}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="block w-full mt-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] font-normal"
                      />
                    )}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  disabled={busy}
                  onClick={() => run(() => saveConsultantAgreementInputsAction(consultantId, form), "✓ 저장되었습니다")}
                  className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-ink text-ink disabled:opacity-50"
                >
                  입력 저장
                </button>
                <button
                  disabled={busy || !state.ready}
                  onClick={() => run(() => sendConsultantAgreementAction(consultantId), "✓ 계약서를 발송했습니다")}
                  className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
                >
                  계약서 발송
                </button>
              </div>
              <ul className="mb-2 text-[12px]" data-testid="consultant-agreement-checklist">
                {state.checklist.map((c) => (
                  <li key={c.key} className={c.ok ? "text-green" : "text-red"}>
                    {c.ok ? "✓" : "✗"} {c.label}
                  </li>
                ))}
              </ul>
              {state.ready && <p className="text-[12px] text-green">발송 준비가 완료되었습니다(자동 발송되지 않습니다).</p>}
            </>
          )}
          {state.status === "signed" && (
            <div className="mb-1">
              <p className="text-[12px] text-green">서명 완료본은 수정할 수 없습니다.</p>
              <p className="text-[12px] text-grey-600 mt-1" data-testid="consultant-agreement-archive">
                서명본 보관(Drive):{" "}
                {state.archive?.status === "succeeded" ? "완료" : state.archive?.status === "manual_review" ? "수동 확인 필요" : state.archive?.status === "retryable_failed" ? `실패 — 재시도 대기(${state.archive.retryCount}회)` : "대기/처리 중"}
              </p>
              {state.archive && state.archive.status !== "succeeded" && (
                <button
                  disabled={busy}
                  onClick={() => run(() => retryConsultantAgreementArchiveAction(consultantId), "보관을 다시 시도했습니다")}
                  className="mt-1 text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-ink text-ink disabled:opacity-50"
                >
                  보관 재시도
                </button>
              )}
            </div>
          )}
          {msg && <p className={`text-[12px] mt-1 ${msg.kind === "ok" ? "text-green" : "text-red"}`}>{msg.text}</p>}
        </>
      )}
    </div>
  );
}
