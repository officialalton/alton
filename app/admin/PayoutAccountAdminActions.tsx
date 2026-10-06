"use client";

// 수취 계좌 관리자 조작(교사·컨설턴트 공용): '전체 번호 보기'(감사 기록, 30초 후 자동 숨김) + 교사/컨설턴트 대신 입력·수정 폼.
// 목록 데이터에는 번호가 없고, 번호는 reveal 콜백을 눌렀을 때만 이 컴포넌트 상태에 일시적으로 존재한다.

import { useEffect, useRef, useState } from "react";

export type RevealedAccount = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  swiftOrRouting: string | null;
  currency: string;
  country: string | null;
};

export type AccountFormValues = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  swiftOrRouting: string;
  currency: string;
  country: string;
};

const REVEAL_SECONDS = 30;

export default function PayoutAccountAdminActions({
  idKey,
  registered,
  initial,
  canManage,
  onReveal,
  onSave,
  onSaved,
}: {
  idKey: string;
  registered: boolean;
  initial: { accountHolderName: string; bankName: string; currency: string; country: string | null };
  canManage: boolean;
  onReveal: () => Promise<RevealedAccount>;
  onSave: (input: AccountFormValues) => Promise<{ status: "saved" } | { status: "invalid"; message: string }>;
  onSaved: () => void | Promise<void>;
}) {
  const [revealed, setRevealed] = useState<{ data: RevealedAccount; secondsLeft: number } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AccountFormValues>({ accountHolderName: "", bankName: "", accountNumber: "", swiftOrRouting: "", currency: "KRW", country: "KR" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function hide() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRevealed(null);
  }

  async function reveal() {
    setError(null);
    try {
      const data = await onReveal();
      if (timer.current) clearInterval(timer.current);
      setRevealed({ data, secondsLeft: REVEAL_SECONDS });
      timer.current = setInterval(() => {
        setRevealed((cur) => {
          if (!cur) return cur;
          if (cur.secondsLeft <= 1) {
            if (timer.current) clearInterval(timer.current);
            timer.current = null;
            return null;
          }
          return { ...cur, secondsLeft: cur.secondsLeft - 1 };
        });
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await onSave(form);
      if (result.status === "invalid") {
        setError(result.message);
        return;
      }
      setMessage("수취 계좌를 저장했습니다. 변경 이력과 본인 알림이 남았습니다.");
      setFormOpen(false);
      setForm((f) => ({ ...f, accountNumber: "", swiftOrRouting: "" }));
      hide();
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) return null;
  const input = "w-full border border-grey-200 rounded px-2 py-1 text-[12px]";
  return (
    <div className="mt-2">
      <div className="flex gap-2">
        {registered && (
          <button type="button" onClick={() => void reveal()} className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200" data-testid={`reveal-${idKey}`}>
            전체 번호 보기
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setFormOpen(!formOpen);
            setForm({ accountHolderName: initial.accountHolderName, bankName: initial.bankName, accountNumber: "", swiftOrRouting: "", currency: initial.currency || "KRW", country: initial.country ?? (initial.currency === "USD" ? "US" : "KR") });
            setError(null);
            setMessage(null);
          }}
          className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200"
          data-testid={`edit-${idKey}`}
        >
          {registered ? "수정(대신 입력)" : "대신 입력"}
        </button>
      </div>
      {error && <p className="text-[12px] text-red mt-1" data-testid={`error-${idKey}`}>{error}</p>}
      {message && <p className="text-[12px] text-green mt-1">{message}</p>}

      {revealed && (
        <div className="mt-2 pt-2 border-t border-grey-200 text-[12px] text-ink space-y-1" data-testid={`revealed-${idKey}`}>
          <div className="text-[11px] text-red font-bold">전체 번호 — {revealed.secondsLeft}초 뒤 자동으로 숨겨집니다. 열람 기록이 남았습니다.</div>
          <div>예금주 {revealed.data.accountHolderName} · {revealed.data.bankName} · {revealed.data.currency}</div>
          <div className="flex items-center gap-2">
            계좌번호 <b data-testid={`revealed-number-${idKey}`}>{revealed.data.accountNumber}</b>
            <button type="button" className="text-[11px] underline" onClick={() => void navigator.clipboard?.writeText(revealed.data.accountNumber)}>복사</button>
          </div>
          {revealed.data.swiftOrRouting && (
            <div className="flex items-center gap-2">
              SWIFT/라우팅 <b>{revealed.data.swiftOrRouting}</b>
              <button type="button" className="text-[11px] underline" onClick={() => void navigator.clipboard?.writeText(revealed.data.swiftOrRouting as string)}>복사</button>
            </div>
          )}
          <button type="button" className="text-[11px] font-bold underline" onClick={hide}>지금 숨기기</button>
        </div>
      )}

      {formOpen && (
        <div className="mt-2 pt-2 border-t border-grey-200 grid grid-cols-2 gap-2" data-testid={`form-${idKey}`}>
          <p className="col-span-2 text-[11px] text-grey-400">
            회의에서 받은 정보를 그대로 입력하세요. 결제 수단은 은행 송금뿐입니다. 저장하면 이력(끝 4자리만)과 본인 알림이 남고 번호는 암호화 저장됩니다.
          </p>
          <label className="text-[11.5px] text-grey-500">예금주
            <input value={form.accountHolderName} onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))} className={input} aria-label="예금주" />
          </label>
          <label className="text-[11.5px] text-grey-500">은행명
            <input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} className={input} aria-label="은행명" />
          </label>
          <label className="text-[11.5px] text-grey-500">계좌번호
            <input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} className={input} aria-label="계좌번호" autoComplete="off" />
          </label>
          <label className="text-[11.5px] text-grey-500">{form.currency === "USD" ? "ABA 라우팅 번호(9자리)" : "SWIFT(선택)"}
            <input value={form.swiftOrRouting} onChange={(e) => setForm((f) => ({ ...f, swiftOrRouting: e.target.value }))} className={input} aria-label="SWIFT/라우팅" autoComplete="off" />
          </label>
          <label className="text-[11.5px] text-grey-500">통화
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value, country: e.target.value === "USD" ? "US" : "KR" }))} className={input + " bg-white"} aria-label="통화">
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="text-[11.5px] text-grey-500">국가
            <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={input} aria-label="국가" />
          </label>
          <div className="col-span-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => void save()} data-testid={`save-${idKey}`} className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50">
              {busy ? "저장 중…" : "저장"}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="text-[12px] font-semibold text-grey-500">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
