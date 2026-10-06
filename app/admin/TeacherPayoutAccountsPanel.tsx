"use client";

// 관리자 `정산` > `수취 계좌`.
// 정책(2026-10-06 오너 확정): 교사는 최초 1회만 등록하고, 이후 수정은 마스터 관리자·정산권한 보유자가 교사를 대신해 입력한다.
// 목록에는 끝 4자리만 보인다. 전체 번호는 '전체 번호 보기' 버튼을 눌렀을 때만(호출마다 감사 기록) 약 30초 동안 일시적으로 표시한다.

import { useEffect, useRef, useState } from "react";
import {
  getPayoutAccountStaffPermissionAction,
  listTeacherPayoutAccountsAction,
  revealTeacherPayoutAccountAction,
  saveTeacherPayoutAccountByAdminAction,
  type RevealedPayoutAccount,
  type TeacherPayoutAccountListItem,
} from "./teacher-payout-accounts-actions";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateTime } from "@/lib/format-datetime";

const FIELD_LABEL: Record<string, string> = {
  account_holder_name: "예금주",
  bank_name: "은행명",
  account_number: "계좌번호",
  currency: "통화",
  country: "국가",
  swift_or_routing: "SWIFT/라우팅",
};

const REVEAL_SECONDS = 30;
const EMPTY_FORM = { accountHolderName: "", bankName: "", accountNumber: "", swiftOrRouting: "", currency: "KRW", country: "KR" };

export default function TeacherPayoutAccountsPanel() {
  const tz = useViewerTimezone();
  const [items, setItems] = useState<TeacherPayoutAccountListItem[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openTeacherId, setOpenTeacherId] = useState<string | null>(null);
  const [formTeacherId, setFormTeacherId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ teacherId: string; data: RevealedPayoutAccount; secondsLeft: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function reload() {
    return listTeacherPayoutAccountsAction()
      .then((rows) => {
        setItems(rows);
        setError(null);
      })
      .catch((e) => {
        setItems([]);
        setError(e instanceof Error ? e.message : String(e));
      });
  }

  useEffect(() => {
    void reload();
    void getPayoutAccountStaffPermissionAction().then((p) => setCanManage(p.canManage)).catch(() => setCanManage(false));
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  function hideRevealed() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRevealed(null);
  }

  async function handleReveal(teacherId: string) {
    setError(null);
    try {
      const data = await revealTeacherPayoutAccountAction(teacherId);
      if (timer.current) clearInterval(timer.current);
      setRevealed({ teacherId, data, secondsLeft: REVEAL_SECONDS });
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

  async function handleSave(teacherId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await saveTeacherPayoutAccountByAdminAction(teacherId, form);
      if (result.status === "invalid") {
        setError(result.message);
        return;
      }
      setMessage("수취 계좌를 저장했습니다. 변경 이력과 교사 알림이 남았습니다.");
      setFormTeacherId(null);
      setForm(EMPTY_FORM);
      hideRevealed();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (items === null) {
    return (
      <div aria-busy="true" data-testid="payout-accounts-skeleton">
        <div className="h-4 w-32 bg-grey-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-[12px] text-grey-500 mb-3">
        결제 수단은 <b>은행 송금</b>뿐입니다. 선생님은 첫 로그인 뒤 본인 포털에서 <b>한 번만</b> 등록하고, 이후 변경은 마스터 관리자·정산권한
        보유자가 대신 입력합니다. 목록에는 끝 4자리만 보이며, 수동 송금이 필요할 때만 <b>전체 번호 보기</b>를 누르세요(누를 때마다 기록됩니다).
        {!canManage && " 이 계정은 입력·전체 번호 보기 권한이 없습니다."}
      </p>
      {error && <p className="text-[12px] text-red mb-2" data-testid="payout-accounts-error">{error}</p>}
      {message && <p className="text-[12px] text-green mb-2">{message}</p>}
      {items.length === 0 && !error && (
        <p className="text-[13px] text-grey-500" data-testid="payout-accounts-empty">
          등록된 수취 계좌가 없습니다.
        </p>
      )}
      {items.map((a) => (
        <div key={a.teacherId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5" data-testid={`account-row-${a.teacherId}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13.5px] font-bold text-ink">{a.teacherName || "(이름 없음)"}</div>
              {a.registered ? (
                <>
                  <div className="text-[12px] text-grey-500 mt-0.5">
                    예금주 {a.accountHolderName} · {a.bankName}
                    {a.enteredByAdmin && <span className="ml-1.5 text-[10.5px] font-bold text-grey-500 bg-grey-100 rounded-full px-2 py-0.5">관리자 입력</span>}
                  </div>
                  <div className="text-[12px] text-grey-500" data-testid={`masked-${a.teacherId}`}>
                    계좌번호 {a.accountNumberMasked}
                    {a.swiftOrRoutingMasked ? ` · SWIFT/라우팅 ${a.swiftOrRoutingMasked}` : ""} · {a.currency}
                    {a.country ? ` · ${a.country}` : ""}
                  </div>
                  <div className="text-[11.5px] text-grey-400 mt-1">최종 수정 {a.updatedAt ? fmtDateTime(a.updatedAt, undefined, tz) : "-"}</div>
                </>
              ) : (
                <div className="text-[12px] text-amber-700 mt-0.5" data-testid={`not-registered-${a.teacherId}`}>
                  미등록 — 선생님 포털에 계좌 등록 단계가 표시됩니다.
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {a.registered && (
                <button
                  type="button"
                  onClick={() => setOpenTeacherId(openTeacherId === a.teacherId ? null : a.teacherId)}
                  className="text-[11.5px] font-bold text-ink underline"
                  data-testid={`history-${a.teacherId}`}
                >
                  변경 이력 {a.changes.length}건
                </button>
              )}
              {canManage && a.registered && (
                <button
                  type="button"
                  onClick={() => void handleReveal(a.teacherId)}
                  className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200"
                  data-testid={`reveal-${a.teacherId}`}
                >
                  전체 번호 보기
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setFormTeacherId(formTeacherId === a.teacherId ? null : a.teacherId);
                    setForm({ ...EMPTY_FORM, accountHolderName: a.accountHolderName, bankName: a.bankName, currency: a.currency || "KRW", country: a.country ?? "KR" });
                    setError(null);
                  }}
                  className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200"
                  data-testid={`edit-${a.teacherId}`}
                >
                  {a.registered ? "수정(교사 대신 입력)" : "교사 대신 입력"}
                </button>
              )}
            </div>
          </div>

          {revealed?.teacherId === a.teacherId && (
            <div className="mt-3 pt-3 border-t border-grey-200 text-[12px] text-ink space-y-1" data-testid={`revealed-${a.teacherId}`}>
              <div className="text-[11px] text-red font-bold">전체 번호 — {revealed.secondsLeft}초 뒤 자동으로 숨겨집니다. 열람 기록이 남았습니다.</div>
              <div>예금주 {revealed.data.accountHolderName} · {revealed.data.bankName} · {revealed.data.currency}</div>
              <div className="flex items-center gap-2">
                계좌번호 <b data-testid={`revealed-number-${a.teacherId}`}>{revealed.data.accountNumber}</b>
                <button type="button" className="text-[11px] underline" onClick={() => void navigator.clipboard?.writeText(revealed.data.accountNumber)}>복사</button>
              </div>
              {revealed.data.swiftOrRouting && (
                <div className="flex items-center gap-2">
                  SWIFT/라우팅 <b>{revealed.data.swiftOrRouting}</b>
                  <button type="button" className="text-[11px] underline" onClick={() => void navigator.clipboard?.writeText(revealed.data.swiftOrRouting as string)}>복사</button>
                </div>
              )}
              <button type="button" className="text-[11px] font-bold underline" onClick={hideRevealed}>지금 숨기기</button>
            </div>
          )}

          {formTeacherId === a.teacherId && canManage && (
            <div className="mt-3 pt-3 border-t border-grey-200 grid grid-cols-2 gap-2" data-testid={`form-${a.teacherId}`}>
              <p className="col-span-2 text-[11px] text-grey-400">
                회의에서 받은 정보를 그대로 입력하세요. 저장하면 이력(끝 4자리만)과 선생님 알림이 남습니다. 번호는 암호화 저장됩니다.
              </p>
              <label className="text-[11.5px] text-grey-500">예금주
                <input value={form.accountHolderName} onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))} className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]" aria-label="예금주" />
              </label>
              <label className="text-[11.5px] text-grey-500">은행명
                <input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]" aria-label="은행명" />
              </label>
              <label className="text-[11.5px] text-grey-500">계좌번호
                <input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]" aria-label="계좌번호" autoComplete="off" />
              </label>
              <label className="text-[11.5px] text-grey-500">{form.currency === "USD" ? "ABA 라우팅 번호(9자리)" : "SWIFT(선택)"}
                <input value={form.swiftOrRouting} onChange={(e) => setForm((f) => ({ ...f, swiftOrRouting: e.target.value }))} className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]" aria-label="SWIFT/라우팅" autoComplete="off" />
              </label>
              <label className="text-[11.5px] text-grey-500">통화
                <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value, country: e.target.value === "USD" ? "US" : "KR" }))} className="w-full border border-grey-200 rounded px-2 py-1 text-[12px] bg-white" aria-label="통화">
                  <option value="KRW">KRW</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="text-[11.5px] text-grey-500">국가
                <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]" aria-label="국가" />
              </label>
              <div className="col-span-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => void handleSave(a.teacherId)} data-testid={`save-${a.teacherId}`} className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50">
                  {busy ? "저장 중…" : "저장"}
                </button>
                <button type="button" onClick={() => setFormTeacherId(null)} className="text-[12px] font-semibold text-grey-500">취소</button>
              </div>
            </div>
          )}

          {openTeacherId === a.teacherId && (
            <ul className="mt-3 pt-3 border-t border-grey-200 space-y-1">
              {a.changes.length === 0 ? (
                <li className="text-[11.5px] text-grey-400">기록된 변경 이력이 없습니다.</li>
              ) : (
                a.changes.map((c) => (
                  <li key={c.id} className="text-[11.5px] text-grey-500">
                    {fmtDateTime(c.createdAt, undefined, tz)} · {c.action === "created" ? "등록" : "수정"}
                    {c.enteredByAdmin ? " (관리자 입력)" : ""}
                    {c.changedFields.length > 0 ? ` · ${c.changedFields.map((f) => FIELD_LABEL[f] ?? f).join(", ")}` : ""}
                    {c.previousLast4 && c.newLast4 && c.previousLast4 !== c.newLast4 ? ` (****${c.previousLast4} → ****${c.newLast4})` : ""}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
