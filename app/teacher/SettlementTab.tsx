"use client";

// P4-2 — 교사 포털 `정산` 탭.
// 착수 정리: docs/2026-09-12-p4-2-teacher-settlement-plan.md
//
// 표시 원칙(확정 정책):
//  * 예정 금액은 "아직 확정되지 않았고 수업 판정·조정에 따라 변동될 수 있다"를
//    화면에서 분명히 말한다 — 확정/지급 완료 금액과 칸을 나눈다.
//  * 세금·수수료·보류 공제를 반영하지 않은 총액임을 명시한다(확정 정책 없음).
//  * 제출 서류에는 "필수/미제출" 같은 게이트로 읽힐 표현을 쓰지 않는다 —
//    제출 여부가 정산·매칭·수업을 막지 않는다.

import { useEffect, useRef, useState } from "react";
import {
  getMyPayoutAccountAction,
  listMyDocumentsAction,
  loadMySettlementAction,
  saveMyPayoutAccountAction,
  uploadMyDocumentAction,
  getMyDocumentDownloadUrlAction,
  deleteMyDocumentAction,
  type MaskedPayoutAccount,
  type TeacherDocumentItem,
} from "./settlement-actions";
import { PAYOUT_DAY_OF_MONTH, type SettlementMonth, type TeacherSettlement } from "./settlement-data";

// 2026-09-12(제품 오너 확정 흐름) — 교사 화면은 아래 4단계로만 말한다.
// '확정'이라는 모호한 말 대신 '송금 승인됨'을 쓴다: 사람이 실제 지급 대상으로
// 최종 승인한 지점이 어디인지가 교사에게 분명해야 하기 때문이다.
// P4-2(UAT 후속) — 한 화면에 다 쌓여 있어 찾기 어렵다는 피드백에 따라 4개 서브탭으로 쪼갠다.
const SUBTABS = [
  { id: "summary", label: "정산 현황" },
  { id: "history", label: "정산 내역" },
  { id: "account", label: "계좌" },
  { id: "documents", label: "서류" },
] as const;
type SubtabId = (typeof SUBTABS)[number]["id"];

const STATUS_LABEL: Record<SettlementMonth["status"], string> = {
  scheduled: "예정",
  in_review: "검토 중",
  approved: "송금 승인됨",
  paid: "지급 완료",
};

// P4-2(UAT 후속) — 금액은 통화 코드(KRW) 대신 기호(₩/$)로 보여준다.
// KRW/JPY는 소수 단위가 없어 minor가 곧 금액이고, 그 외는 100분의 1 단위다.
const ZERO_DECIMAL_CURRENCIES = new Set(["KRW", "JPY"]);

function formatAmount(minor: number, currency: string): string {
  const zeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency);
  const value = zeroDecimal ? minor : minor / 100;
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: zeroDecimal ? 0 : 2,
      maximumFractionDigits: zeroDecimal ? 0 : 2,
    }).format(value);
  } catch {
    // 알 수 없는 통화 코드도 금액이 사라지지 않게 한다.
    return `${value.toLocaleString("ko-KR")} ${currency}`;
  }
}

// P4-2(UAT 후속, 2026-09-12) — 상태별로 지급 일정을 다르게 말한다.
// 검토 중인 건에 "지급 예정일 10월 10일"만 덩그러니 보이면, 10일이 지난 뒤에도
// 같은 날짜가 남아 지급 시점을 오해하게 된다 — 검토 중에는 "검토 완료 후 지급"을
// 앞세우고 예정일은 괄호로만 덧붙인다.
// 'YYYY-MM-DD' 날짜 문자열은 new Date()로 파싱하면 UTC 자정이 되고, 그걸 로컬
// 시간대로 렌더하면 하루 밀린다(지급 예정일 10월 10일이 10월 9일로 보였다).
// 날짜만 있는 값은 시간대 변환 없이 그대로 표기한다.
function formatDateOnly(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-");
  if (!y || !m || !d) return dateOnly;
  return `${y}. ${Number(m)}. ${Number(d)}.`;
}

// 지급 예정일은 승인 시점에 묶음에 저장된다. **저장된 값이 있을 때만 구체적인
// 날짜를 보여준다** — 승인 전에는 아직 정해지지 않았으므로 "매월 10일" 규칙만 안내한다.
function payoutScheduleLabel(m: SettlementMonth): string {
  if (m.status === "paid") {
    // 외부 송금일은 날짜만 있는 값, paid_at은 시각까지 있는 값이라 표기 방법이 다르다.
    if (m.externalTransfer) return `지급일 ${formatDateOnly(m.externalTransfer.transferredOn)}`;
    return m.paidAt ? `지급일 ${new Date(m.paidAt).toLocaleDateString("ko-KR")}` : "지급 완료";
  }
  if (m.scheduledPayoutDate) {
    const dateLabel = formatDateOnly(m.scheduledPayoutDate);
    return m.status === "in_review" ? `검토 완료 후 지급 (예정일 ${dateLabel})` : `지급 예정일 ${dateLabel}`;
  }
  // 아직 승인 전이라 예정일이 정해지지 않았다.
  if (m.status === "in_review") return "검토 중 · 승인되면 지급 예정일이 정해집니다";
  return "승인 후 지급 예정일이 정해집니다";
}

function formatMonth(key: string): string {
  if (key === "unknown") return "기간 미상";
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

function TotalsRow({ totals, emptyLabel }: { totals: Record<string, number>; emptyLabel: string }) {
  const entries = Object.entries(totals);
  if (entries.length === 0) return <span className="text-[13px] text-grey-400">{emptyLabel}</span>;
  return (
    <span className="text-[18px] font-extrabold text-ink">
      {entries.map(([currency, minor]) => formatAmount(minor, currency)).join(" · ")}
    </span>
  );
}

export default function SettlementTab() {
  const [settlement, setSettlement] = useState<TeacherSettlement | null>(null);
  const [account, setAccount] = useState<MaskedPayoutAccount | null>(null);
  const [documents, setDocuments] = useState<TeacherDocumentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [subtab, setSubtab] = useState<SubtabId>("summary");

  function reload(): Promise<void> {
    return Promise.all([loadMySettlementAction(), getMyPayoutAccountAction(), listMyDocumentsAction()])
      .then(([s, a, d]) => {
        setSettlement(s);
        setAccount(a);
        setDocuments(d);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setSettlement(
          (prev) =>
            prev ?? {
              months: [],
              scheduledTotalsByCurrency: {},
              inReviewTotalsByCurrency: {},
              approvedTotalsByCurrency: {},
              paidTotalsByCurrency: {},
              nextPayoutMonth: null,
              refreshedAt: new Date().toISOString(),
            }
        );
        setDocuments((prev) => prev ?? []);
      });
  }

  useEffect(() => {
    void reload();
  }, []);

  if (settlement === null) {
    return (
      <div className="max-w-[860px] px-8 py-8" aria-busy="true" data-testid="settlement-skeleton">
        <div className="h-4 w-32 bg-grey-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-[860px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">정산</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        완료된 수업의 정산 내역과 지급 예정 금액을 확인하고, 수취 계좌와 제출 서류를 관리합니다.
      </p>
      {error && <p className="text-[12px] text-red mb-3">{error}</p>}

      <div className="flex gap-4 mb-5 border-b border-grey-200">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubtab(t.id)}
            data-testid={`settlement-subtab-${t.id}`}
            className={
              "text-[13.5px] font-semibold pb-2.5 -mb-px border-b-2 " +
              (subtab === t.id ? "text-ink border-ink" : "text-grey-500 border-transparent")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {subtab === "summary" && (
      <section className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[13px] font-bold text-ink mb-2">다음 지급 예정액</div>
        <TotalsRow totals={settlement.scheduledTotalsByCurrency} emptyLabel="예정된 금액이 없습니다." />
        <div className="text-[11.5px] text-grey-500 mt-1.5 space-y-0.5">
          <div>
            <b>
              매월 {PAYOUT_DAY_OF_MONTH}일에 전월 수업분을 지급합니다.
            </b>{" "}
            (예: 9월 수업분 → 10월 {PAYOUT_DAY_OF_MONTH}일)
          </div>
          <div>마지막 갱신: {new Date(settlement.refreshedAt).toLocaleString("ko-KR")}</div>
          <div>수업 판정·조정 결과에 따라 확정 전까지 금액이 변동될 수 있습니다.</div>
          <div>세금·수수료 등 공제를 반영하지 않은 총액입니다.</div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-grey-200">
          <div>
            <div className="text-[11.5px] font-bold text-grey-400 mb-0.5">검토 중</div>
            <TotalsRow totals={settlement.inReviewTotalsByCurrency} emptyLabel="없음" />
          </div>
          <div>
            <div className="text-[11.5px] font-bold text-grey-400 mb-0.5">송금 승인됨</div>
            <TotalsRow totals={settlement.approvedTotalsByCurrency} emptyLabel="없음" />
          </div>
          <div>
            <div className="text-[11.5px] font-bold text-grey-400 mb-0.5">지급 완료</div>
            <TotalsRow totals={settlement.paidTotalsByCurrency} emptyLabel="없음" />
          </div>
        </div>
        <p className="text-[11px] text-grey-400 mt-2">
          정산 대상 월이 끝나면 월별 정산 묶음이 만들어져 <b>검토 중</b>으로 넘어가고, 운영자가
          지급 대상으로 최종 승인하면 <b>송금 승인됨</b>이 됩니다. 마감 뒤 수업 판정이나 금액이
          바뀌면 이미 승인된 금액을 고치지 않고 다음 정산월의 조정 항목으로 반영합니다.
        </p>
      </section>
      )}

      {subtab === "history" && (
      <section className="mb-4">
        <div className="text-[13px] font-bold text-ink mb-2">월별 정산 내역</div>
        {settlement.months.length === 0 ? (
          <p className="text-[13px] text-grey-500" data-testid="settlement-empty">
            아직 정산 내역이 없습니다. 수업이 완료되면 이곳에 표시됩니다.
          </p>
        ) : (
          settlement.months.map((m) => {
            const key = `${m.settlementMonth}|${m.currency}|${m.status}`;
            const open = openMonth === key;
            return (
              <div key={key} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setOpenMonth(open ? null : key)}
                  data-testid={`settlement-month-${key}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[13.5px] font-bold text-ink">
                        {formatMonth(m.settlementMonth)} 수업분
                      </div>
                      <div className="text-[12px] text-grey-500 mt-0.5">
                        {payoutScheduleLabel(m)} · 수업 {m.lessonCount}건
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13.5px] font-extrabold text-ink">
                        {formatAmount(m.totalAmountMinor, m.currency)}
                      </div>
                      <div className="text-[11.5px] text-grey-500">{STATUS_LABEL[m.status]}</div>
                    </div>
                  </div>
                </button>
                {open && (
                  <div className="mt-3 pt-3 border-t border-grey-200">
                    {/* 자동 산정과 관리자 조정을 분리해 보여준다 — 어느 금액이
                        시스템 산출이고 어느 금액이 사람이 더한/뺀 것인지 교사가
                        구분할 수 있어야 한다. */}
                    <dl className="text-[11.5px] text-grey-500 mb-2 space-y-0.5">
                      <div className="flex justify-between">
                        <dt>자동 산정 수업 합계</dt>
                        <dd data-testid={`auto-${key}`}>
                          {formatAmount(m.autoCalculatedAmountMinor, m.currency)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>관리자 조정액</dt>
                        <dd data-testid={`adjust-${key}`}>
                          {m.adjustmentAmountMinor > 0 ? "+" : ""}
                          {formatAmount(m.adjustmentAmountMinor, m.currency)}
                        </dd>
                      </div>
                      <div className="flex justify-between font-bold text-ink">
                        <dt>{m.status === "paid" ? "지급 금액" : "최종 송금 승인 금액"}</dt>
                        <dd data-testid={`final-${key}`}>{formatAmount(m.totalAmountMinor, m.currency)}</dd>
                      </div>
                    </dl>
                    <dl className="text-[11.5px] text-grey-500 mb-2 space-y-0.5">
                      <div className="flex justify-between">
                        <dt>지급 예정일</dt>
                        <dd data-testid={`sched-${key}`}>
                          {m.scheduledPayoutDate ? formatDateOnly(m.scheduledPayoutDate) : "승인 후 확정"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>자동 송금</dt>
                        <dd data-testid={`auto-dispatch-${key}`}>
                          {m.autoDispatchEnabled ? "대상" : "대상 아님(개별 처리)"}
                        </dd>
                      </div>
                      {m.externalTransfer && (
                        <div className="flex justify-between">
                          <dt>지급 방식</dt>
                          <dd data-testid={`external-${key}`}>
                            은행 직접 송금 · {formatDateOnly(m.externalTransfer.transferredOn)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    {m.dateChanges.length > 0 && (
                      <ul className="text-[11px] text-grey-400 mb-2 space-y-0.5">
                        {m.dateChanges.map((c) => (
                          <li key={c.id} data-testid={`date-change-${c.id}`}>
                            지급 예정일 {c.previousDate ? `${c.previousDate} → ` : ""}
                            {c.newDate}
                            {c.reason ? ` — ${c.reason}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.adjustments.length > 0 && (
                      <ul className="text-[11px] text-grey-400 mb-2 space-y-0.5">
                        {m.adjustments.map((a) => (
                          <li key={a.id} data-testid={`adjust-reason-${a.id}`}>
                            {new Date(a.createdAt).toLocaleDateString("ko-KR")} ·{" "}
                            {a.amountMinor > 0 ? "+" : ""}
                            {formatAmount(a.amountMinor, a.currency)} — {a.reason}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="overflow-x-auto">
                    <table className="w-full text-[11.5px]">
                      <thead>
                        <tr className="text-grey-400 text-left">
                          <th className="font-bold pb-1">수업일</th>
                          <th className="font-bold pb-1">학생</th>
                          <th className="font-bold pb-1">과목</th>
                          <th className="font-bold pb-1">구분</th>
                          <th className="font-bold pb-1 text-right">지급 대상</th>
                          <th className="font-bold pb-1 text-right">시급</th>
                          <th className="font-bold pb-1 text-right">금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.lines.map((l) => (
                          <tr key={l.payoutItemId} className="text-grey-500">
                            <td className="py-0.5">
                              {l.sessionDate ? new Date(l.sessionDate).toLocaleDateString("ko-KR") : "—"}
                            </td>
                            <td className="py-0.5">{l.studentName ?? "—"}</td>
                            <td className="py-0.5">{l.subjectName ?? "—"}</td>
                            <td className="py-0.5">{l.itemType}</td>
                            <td className="py-0.5 text-right">{l.payableMinutes}분</td>
                            <td className="py-0.5 text-right">
                              {formatAmount(l.hourlyRateSnapshotMinor, l.currency)}
                            </td>
                            <td className="py-0.5 text-right font-bold text-ink">
                              {formatAmount(l.amountMinor, l.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
      )}

      {subtab === "account" && <PayoutAccountCard account={account} onSaved={setAccount} />}
      {subtab === "documents" && (
        <DocumentsCard
          documents={documents ?? []}
          onUploaded={(d) => setDocuments((prev) => [d, ...(prev ?? [])])}
          onDeleted={(id) => setDocuments((prev) => (prev ?? []).filter((d) => d.id !== id))}
        />
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  // 힌트를 label 안에 두면 접근성 이름이 "계좌번호 하이픈(-)은..."처럼 합쳐져
  // 입력을 라벨로 찾기 어려워진다 — 힌트는 label 밖에 둔다.
  return (
    <div className="block">
      <label className="block">
        <span className="block text-[11.5px] font-bold text-grey-400 mb-0.5">{label}</span>
        {children}
      </label>
      {hint && <span className="block text-[11px] text-grey-400 mt-0.5">{hint}</span>}
    </div>
  );
}

function PayoutAccountCard({
  account,
  onSaved,
}: {
  account: MaskedPayoutAccount | null;
  onSaved: (a: MaskedPayoutAccount) => void;
}) {
  const [editing, setEditing] = useState(false);
  // P4-2(UAT 후속) — 통화가 미리 채워져 있으면 "이미 저장된 값"처럼 보인다는
  // 피드백에 따라, 입력은 라벨이 붙은 필드로 나누고 통화는 선택으로 바꾼다.
  const [form, setForm] = useState({ accountHolderName: "", bankName: "", accountNumber: "", currency: "KRW" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
      <div className="text-[13px] font-bold text-ink mb-2">수취 계좌</div>
      {!editing ? (
        <>
          {account ? (
            <div className="text-[12px] text-grey-500 space-y-0.5">
              <div>예금주: {account.accountHolderName}</div>
              <div>은행: {account.bankName}</div>
              <div data-testid="account-masked">계좌번호: {account.accountNumberMasked}</div>
              <div>통화: {account.currency}</div>
              <div className="text-[11.5px] text-grey-400">
                최종 수정 {new Date(account.updatedAt).toLocaleString("ko-KR")}
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-grey-500" data-testid="account-empty">
              등록된 수취 계좌가 없습니다.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setError(null);
              setForm({
                accountHolderName: account?.accountHolderName ?? "",
                bankName: account?.bankName ?? "",
                accountNumber: "",
                currency: account?.currency ?? "KRW",
              });
            }}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink mt-2"
          >
            {account ? "수정" : "등록"}
          </button>
        </>
      ) : (
        <div className="space-y-2">
          {error && <p className="text-[12px] text-red">{error}</p>}
          <Field label="예금주">
            <input
              value={form.accountHolderName}
              onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))}
              placeholder="통장에 적힌 이름 그대로"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
            />
          </Field>
          <Field label="은행명">
            <input
              value={form.bankName}
              onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
              placeholder="예: 우리은행"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
            />
          </Field>
          <Field label="계좌번호" hint="띄어쓰기 없이 하이픈(-)을 넣어서 작성해주세요. 예: 1002-123-456789">
            <input
              value={form.accountNumber}
              onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
              placeholder="전체 계좌번호"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
            />
          </Field>
          <Field label="통화">
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              aria-label="통화"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px] bg-white"
            >
              <option value="KRW">KRW (원)</option>
              <option value="USD">USD (달러)</option>
            </select>
          </Field>
          <p className="text-[11px] text-grey-400">
            보안을 위해 저장된 계좌번호는 끝 4자리만 표시됩니다. 수정할 때는 전체를 다시 입력해주세요.
          </p>
          <div className="flex gap-3 mt-1">
            <button
              type="button"
              disabled={busy}
              aria-busy={busy}
              className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const result = await saveMyPayoutAccountAction(form);
                  if (result.status === "invalid") {
                    setError(result.message);
                  } else {
                    onSaved(result.account);
                    setEditing(false);
                  }
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "저장 중..." : "저장"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-[12px] font-semibold text-grey-500">
              취소
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DocumentsCard({
  documents,
  onUploaded,
  onDeleted,
}: {
  documents: TeacherDocumentItem[];
  onUploaded: (d: TeacherDocumentItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4">
      <div className="text-[13px] font-bold text-ink mb-1">제출 서류</div>
      <p className="text-[11.5px] text-grey-500 mb-2">
        보관용 제출 창구입니다. 제출 여부가 정산·매칭·수업 진행에 영향을 주지 않습니다.
      </p>
      {error && <p className="text-[12px] text-red mb-2">{error}</p>}
      {documents.length === 0 ? (
        <p className="text-[12px] text-grey-500" data-testid="documents-empty">
          업로드한 서류가 없습니다.
        </p>
      ) : (
        <ul className="space-y-1 mb-2">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="text-ink truncate">{d.fileName}</span>
              <span className="text-[11.5px] text-grey-400 shrink-0">
                {new Date(d.uploadedAt).toLocaleDateString("ko-KR")}
              </span>
              <button
                type="button"
                className="text-[11.5px] font-bold text-ink underline shrink-0"
                onClick={async () => {
                  setError(null);
                  try {
                    const url = await getMyDocumentDownloadUrlAction(d.id);
                    window.open(url, "_blank", "noopener");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                내려받기
              </button>
              {/* P4-2(UAT 후속) — 잘못 올린 파일을 교사가 직접 지울 수 있어야 한다. */}
              <button
                type="button"
                disabled={deletingId === d.id}
                data-testid={`delete-document-${d.id}`}
                className="text-[11.5px] font-bold text-red shrink-0 disabled:opacity-50"
                onClick={async () => {
                  if (!window.confirm(`'${d.fileName}'을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
                  setDeletingId(d.id);
                  setError(null);
                  try {
                    await deleteMyDocumentAction(d.id);
                    onDeleted(d.id);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setDeletingId(null);
                  }
                }}
              >
                {deletingId === d.id ? "삭제 중..." : "삭제"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* 기본 file input은 버튼처럼 보이지 않는다는 피드백 — 입력은 숨기고 버튼으로 연다. */}
      <input
        ref={inputRef}
        type="file"
        aria-label="서류 업로드"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            const formData = new FormData();
            formData.append("file", file);
            const result = await uploadMyDocumentAction(formData);
            if (result.status === "invalid") setError(result.message);
            else onUploaded(result.document);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        data-testid="upload-document"
        className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
      >
        {busy ? "업로드 중..." : "파일 선택해서 올리기"}
      </button>
      <p className="text-[11px] text-grey-400 mt-1">PDF 또는 이미지(PNG/JPG/HEIC), 10MB 이하</p>
    </section>
  );
}
