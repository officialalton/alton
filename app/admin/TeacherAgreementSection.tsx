"use client";

import { useEffect, useState } from "react";
import {
  getTeacherAgreementStateAction,
  saveTeacherAgreementInputsAction,
  sendTeacherAgreementAction,
  retryTeacherAgreementArchiveAction,
  getRateAddendumStateAction,
  sendRateAddendumAction,
} from "./teacher-agreement-actions";
import type { TeacherAgreementState } from "@/lib/teacher-agreements/send";
import type { RateAddendumState } from "@/lib/teacher-agreements/addendum";
import type { TeacherAgreementInputs } from "@/lib/teacher-agreements/prepare";

const STATUS_LABEL: Record<TeacherAgreementState["status"], string> = {
  not_sent: "미발송",
  sent: "발송됨(서명 대기)",
  signed: "서명 완료",
  declined: "서명 거부",
  voided: "무효 처리",
};

type Field = { key: keyof TeacherAgreementInputs; label: string; placeholder?: string; multiline?: boolean; type?: string };
const FIELDS: Field[] = [
  { key: "engagement_type", label: "계약 형태" },
  { key: "work_country", label: "실제 근무 국가(2자리 코드)", placeholder: "US, KR ..." },
  { key: "work_region", label: "근무 주(미국인 경우)", placeholder: "CA" },
  { key: "work_location_detail", label: "근무 위치(캘리포니아 근무지 또는 도시)" },
  { key: "mailing_address", label: "우편 주소" },
  { key: "start_date", label: "시작일", type: "date" },
  { key: "supervisor_name", label: "감독자(Supervisor) 이름 — 캘리포니아 전용" },
  { key: "prior_materials", label: "기존 자료(비워 두면 None으로 기재)", multiline: true },
];

function RateAddendumBox({ teacherId }: { teacherId: string }) {
  const [st, setSt] = useState<RateAddendumState | null>(null);
  const [f, setF] = useState({ amount: "", currency: "KRW", effectiveDate: "" });
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    getRateAddendumStateAction(teacherId).then((r) => alive && r.ok && setSt(r.data));
    return () => {
      alive = false;
    };
  }, [teacherId]);
  if (!st) return null;
  return (
    <div className="mt-3 border-t border-grey-200 pt-3" data-testid="rate-addendum-box">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">시급 변경 합의서</div>
      <p className="text-[12px] text-grey-600 mb-2">
        서명된 계약의 시급은 직접 바꿀 수 없습니다. 합의서를 보내 선생님이 서명하면 적용 시작일부터 새 시급이 적용되고, 그 전 수업은 기존 시급으로 정산됩니다.
      </p>
      {st.latest && (
        <p className="text-[12px] text-ink mb-2">
          최근 합의서: {st.latest.status === "signed" ? "서명 완료" : st.latest.status === "sent" ? "서명 대기" : st.latest.status === "declined" ? "거부" : "무효"}
          {st.latest.effectiveDate ? ` · 적용 시작 ${st.latest.effectiveDate}` : ""}
        </p>
      )}
      {st.blockers.map((b) => (
        <p key={b} className="text-[12px] text-red">{b}</p>
      ))}
      {st.canCreate && (
        <div className="grid gap-2">
          <div className="flex gap-2">
            <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className="px-2 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]">
              <option value="KRW">KRW (원)</option>
              <option value="USD">USD ($)</option>
            </select>
            <input type="number" step="any" min="0" placeholder="새 시급" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]" />
            <input type="date" value={f.effectiveDate} onChange={(e) => setF({ ...f, effectiveDate: e.target.value })} className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]" />
          </div>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMsg(null);
              const r = await sendRateAddendumAction(teacherId, f).catch(() => ({ ok: false as const, error: "발송에 실패했습니다." }));
              if (r.ok) {
                setSt(r.data);
                setMsg({ kind: "ok", text: "✓ 합의서를 발송했습니다(자동 적용은 서명 완료 후)" });
              } else setMsg({ kind: "err", text: r.error });
              setBusy(false);
            }}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50 justify-self-start"
          >
            시급 변경 합의서 발송
          </button>
        </div>
      )}
      {msg && <p className={`text-[12px] mt-1 ${msg.kind === "ok" ? "text-green" : "text-red"}`}>{msg.text}</p>}
    </div>
  );
}

export default function TeacherAgreementSection({ teacherId }: { teacherId: string }) {
  const [state, setState] = useState<TeacherAgreementState | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function apply(s: TeacherAgreementState) {
    setState(s);
    const f: Record<string, string> = {};
    for (const fld of FIELDS) f[fld.key] = (s.inputs?.[fld.key] as string | null | undefined) ?? "";
    setForm(f);
  }

  useEffect(() => {
    let cancelled = false;
    getTeacherAgreementStateAction(teacherId).then((r) => {
      if (cancelled) return;
      if (r.ok) apply(r.data);
      else setMsg({ kind: "err", text: r.error });
    });
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  async function run(fn: () => ReturnType<typeof saveTeacherAgreementInputsAction>, okText: string) {
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
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4" data-testid="teacher-agreement-section">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">선생님 계약서</div>
      {!state ? (
        <p className="text-[13px] text-grey-500">{msg?.text ?? "불러오는 중..."}</p>
      ) : (
        <>
          <p className="text-[13px] text-ink mb-2">
            상태: <strong data-testid="teacher-agreement-status">{STATUS_LABEL[state.status]}</strong>
            {state.form ? ` · ${state.form === "california_employment" ? "캘리포니아 고용계약" : state.form === "us_contractor_services" ? "미국 프리랜서 계약" : "해외(한국) 서비스 계약"}` : ""}
          </p>
          {state.status !== "signed" && (
            <>
              <div className="grid gap-2 mb-3">
                {FIELDS.map((f) =>
                  f.key === "engagement_type" ? (
                    <label key={f.key} className="text-[12px] text-grey-600 font-semibold">
                      {f.label}
                      <select
                        value={form.engagement_type || "contractor"}
                        onChange={(e) => setForm({ ...form, engagement_type: e.target.value })}
                        className="block w-full mt-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] font-normal"
                      >
                        <option value="contractor">프리랜서(독립 계약자) — 기본</option>
                        <option value="employee">직원(employee) — 캘리포니아 근무자만</option>
                      </select>
                      <span className="block text-[11px] text-grey-500 font-normal mt-1">
                        근로자성 오분류 위험이 있으니, 업무 지시·통제 수준을 확인한 뒤 선택하세요. 직원으로 선택하면 캘리포니아 고용계약서가 사용됩니다.
                      </span>
                    </label>
                  ) : (
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
                        value={form[f.key] ?? ""}
                        placeholder={f.placeholder}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="block w-full mt-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] font-normal"
                      />
                    )}
                  </label>
                  )
                )}
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  disabled={busy}
                  onClick={() => run(() => saveTeacherAgreementInputsAction(teacherId, form), "✓ 저장되었습니다")}
                  className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-ink text-ink disabled:opacity-50"
                >
                  입력 저장
                </button>
                <button
                  disabled={busy || !state.ready}
                  onClick={() => run(() => sendTeacherAgreementAction(teacherId), "✓ 계약서를 발송했습니다")}
                  className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
                >
                  계약서 발송
                </button>
              </div>
              <ul className="mb-2 text-[12px]" data-testid="teacher-agreement-checklist">
                {state.checklist.map((c) => (
                  <li key={c.key} className={c.ok ? "text-green" : "text-red"}>
                    {c.ok ? "✓" : "✗"} {c.label}
                  </li>
                ))}
              </ul>
              {state.missing.length > 0 ? (
                <p className="text-[12px] text-red" data-testid="teacher-agreement-missing">
                  발송 전 필요한 입력: {state.missing.join(", ")}
                </p>
              ) : state.ready ? (
                <p className="text-[12px] text-green">발송 준비가 완료되었습니다. 수신: 선생님 @alton.education 주소 (자동 발송되지 않습니다)</p>
              ) : null}
            </>
          )}
          {state.status === "signed" && (
            <div className="mb-1">
              <p className="text-[12px] text-green">서명 완료본은 수정할 수 없습니다.</p>
              <RateAddendumBox teacherId={teacherId} />
              <p className="text-[12px] text-grey-600 mt-1" data-testid="teacher-agreement-archive">
                서명본 보관(Drive):{" "}
                {state.archive?.status === "succeeded"
                  ? "완료"
                  : state.archive?.status === "manual_review"
                    ? "수동 확인 필요"
                    : state.archive?.status === "retryable_failed"
                      ? `실패 — 재시도 대기(${state.archive.retryCount}회)`
                      : "대기/처리 중"}
                {state.archive?.lastError && state.archive.status !== "succeeded" ? ` · ${state.archive.lastError}` : ""}
              </p>
              {state.archive && state.archive.status !== "succeeded" && (
                <button
                  disabled={busy}
                  onClick={() => run(() => retryTeacherAgreementArchiveAction(teacherId), "보관을 다시 시도했습니다")}
                  className="mt-1 text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-ink text-ink disabled:opacity-50"
                >
                  보관 재시도
                </button>
              )}
            </div>
          )}
          {msg && <p className={"text-[12px] mt-1.5 " + (msg.kind === "ok" ? "text-green" : "text-red")}>{msg.text}</p>}
        </>
      )}
    </div>
  );
}
