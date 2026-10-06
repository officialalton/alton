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
  loadSettlementPageDataAction,
  saveMyPayoutAccountAction,
  uploadMyDocumentAction,
  getMyDocumentDownloadUrlAction,
  deleteMyDocumentAction,
  markPayoutNoticeReadAction,
  type PayoutNotice,
  type MaskedPayoutAccount,
  type TeacherDocumentItem,
} from "./settlement-actions";
import { formatPeriodLabelEn, formatPeriodWithPayoutEn, PAYOUT_DAY_FIRST_HALF, PAYOUT_DAY_SECOND_HALF } from "@/lib/payout/payout-schedule";
import { type SettlementMonth, type TeacherSettlement } from "./settlement-data";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDate, fmtDateTime } from "@/lib/format-datetime";

// 2026-09-12(제품 오너 확정 흐름) — 교사 화면은 아래 4단계로만 말한다.
// '확정'이라는 모호한 말 대신 '송금 승인됨'을 쓴다: 사람이 실제 지급 대상으로
// 최종 승인한 지점이 어디인지가 교사에게 분명해야 하기 때문이다.
// P4-2(UAT 후속) — 한 화면에 다 쌓여 있어 찾기 어렵다는 피드백에 따라 4개 서브탭으로 쪼갠다.
const SUBTABS = [
  { id: "summary", label: "Overview" },
  { id: "history", label: "Payout History" },
  { id: "account", label: "Payout Account" },
  { id: "documents", label: "Documents" },
] as const;
type SubtabId = (typeof SUBTABS)[number]["id"];

const STATUS_LABEL: Record<SettlementMonth["status"], string> = {
  scheduled: "Upcoming",
  in_review: "In review",
  approved: "Transfer approved",
  paid: "Paid",
};

// P4-2(UAT 후속) — 금액은 통화 코드(KRW) 대신 기호(₩/$)로 보여준다.
// KRW/JPY는 소수 단위가 없어 minor가 곧 금액이고, 그 외는 100분의 1 단위다.
const ZERO_DECIMAL_CURRENCIES = new Set(["KRW", "JPY"]);

function formatAmount(minor: number, currency: string): string {
  const zeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency);
  const value = zeroDecimal ? minor : minor / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: zeroDecimal ? 0 : 2,
      maximumFractionDigits: zeroDecimal ? 0 : 2,
    }).format(value);
  } catch {
    // 알 수 없는 통화 코드도 금액이 사라지지 않게 한다.
    return `${value.toLocaleString("en-US")} ${currency}`;
  }
}

// P4-2(UAT 후속, 2026-09-12) — 상태별로 지급 일정을 다르게 말한다.
// 검토 중인 건에 "지급 예정일 10월 26일"만 덩그러니 보이면, 그 날이 지난 뒤에도
// 같은 날짜가 남아 지급 시점을 오해하게 된다 — 검토 중에는 "검토 완료 후 지급"을
// 앞세우고 예정일은 괄호로만 덧붙인다.
// 'YYYY-MM-DD' 날짜 문자열은 new Date()로 파싱하면 UTC 자정이 되고, 그걸 로컬
// 시간대로 렌더하면 하루 밀린다(지급 예정일 10월 26일이 19일로 보일 수 있다).
// 날짜만 있는 값은 시간대 변환 없이 그대로 표기한다.
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDateOnly(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-");
  if (!y || !m || !d) return dateOnly;
  const monthName = MONTH_NAMES[Number(m) - 1];
  if (!monthName) return dateOnly;
  return `${monthName.slice(0, 3)} ${Number(d)}, ${y}`;
}

// 지급 예정일은 승인 시점에 묶음에 저장된다. **저장된 값이 있을 때만 구체적인
// 날짜를 보여준다** — 승인 전에는 아직 정해지지 않았으므로 명목 지급일(10일·26일)은 기간 규칙으로만 안내한다.
function payoutScheduleLabel(m: SettlementMonth, tz: string): string {
  if (m.status === "paid") {
    // 외부 송금일은 날짜만 있는 값, paid_at은 시각까지 있는 값이라 표기 방법이 다르다.
    if (m.externalTransfer) return `Paid on ${formatDateOnly(m.externalTransfer.transferredOn)}`;
    return m.paidAt ? `Paid on ${fmtDate(m.paidAt, undefined, tz)}` : "Paid";
  }
  // 기한이 지난 미지급 건: 과거 날짜를 "Paid by"로 보여 주지 않는다.
  if (m.overdue && m.effectiveDeadline) return `Was due ${formatDateOnly(m.effectiveDeadline)} — processing`;
  if (m.scheduledPayoutDate) {
    const dateLabel = formatDateOnly(m.scheduledPayoutDate);
    return m.status === "in_review" ? `Paid after review (by ${dateLabel})` : `Paid by ${dateLabel}`;
  }
  // 아직 승인 전이라 예정일이 정해지지 않았다(명목 지급일은 기간 규칙에서 안내).
  if (m.status === "in_review") return "In review – the payout deadline is set once approved";
  return "The payout deadline is set after approval";
}

function formatMonth(key: string): string {
  if (key === "unknown") return "Unknown period";
  const [y, m] = key.split("-");
  const monthName = MONTH_NAMES[Number(m) - 1];
  return monthName ? `${monthName} ${y}` : key;
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

export default function SettlementTab({ onAccountSaved }: { onAccountSaved?: () => void } = {}) {
  const tz = useViewerTimezone();
  const [settlement, setSettlement] = useState<TeacherSettlement | null>(null);
  const [account, setAccount] = useState<MaskedPayoutAccount | null>(null);
  const [documents, setDocuments] = useState<TeacherDocumentItem[] | null>(null);
  const [notices, setNotices] = useState<PayoutNotice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [subtab, setSubtab] = useState<SubtabId>("summary");

  function reload(): Promise<void> {
    return loadSettlementPageDataAction()
      .then(({ settlement: s, account: a, documents: d, notices: n }) => {
        setSettlement(s);
        setNotices(n ?? []);
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
              nextPayoutDate: null,
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
      <div className="max-w-[860px]" aria-busy="true" data-testid="settlement-skeleton">
        <div className="h-4 w-32 bg-grey-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-[860px]">
      <p className="text-[13px] text-grey-500 mb-5">
        Review payouts for completed lessons and upcoming amounts, and manage your bank account and documents.
      </p>
      {error && <p className="text-[12px] text-red mb-3">{error}</p>}

      {!account && subtab !== "account" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-[1.5px] border-red/40 bg-red/5 px-4 py-3" data-testid="account-setup-banner">
          <p className="text-[13px] font-semibold text-ink">Set up your payout account so we can pay you.</p>
          <button type="button" onClick={() => setSubtab("account")} className="text-[12.5px] font-bold text-white bg-red rounded-lg px-3 py-1.5">
            Set up payout account
          </button>
        </div>
      )}

      {notices.length > 0 && (
        <section className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4" data-testid="payout-notices">
          <div className="text-[13px] font-bold text-ink mb-2">Payout notices</div>
          <ul className="space-y-2">
            {notices.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3" data-testid={`payout-notice-${n.id}`}>
                <div>
                  <div className={"text-[12.5px] " + (n.read ? "text-grey-500" : "text-ink font-semibold")}>
                    {!n.read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red mr-1.5 align-middle" aria-label="Unread" />}
                    {n.message}
                  </div>
                  <div className="text-[11px] text-grey-400 mt-0.5">{fmtDateTime(n.createdAt, undefined, tz)}</div>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    data-testid={`mark-read-${n.id}`}
                    className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 shrink-0"
                    onClick={() => {
                      void markPayoutNoticeReadAction(n.id)
                        .then(() => setNotices((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))))
                        .catch(() => setError("Couldn't mark the notice as read."));
                    }}
                  >
                    Mark as read
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
        <div className="text-[13px] font-bold text-ink mb-2">Next upcoming payout</div>
        <TotalsRow totals={settlement.scheduledTotalsByCurrency} emptyLabel="No upcoming amount yet." />
        {Object.keys(settlement.overdueTotalsByCurrency ?? {}).length > 0 && (
          <div className="mt-2" data-testid="overdue-payout">
            <div className="text-[11.5px] font-bold text-red mb-0.5">Overdue — being processed</div>
            <TotalsRow totals={settlement.overdueTotalsByCurrency ?? {}} emptyLabel="" />
            {settlement.overdueSince && (
              <div className="text-[11.5px] text-grey-500">Was due {formatDateOnly(settlement.overdueSince)} — we are processing this payout.</div>
            )}
          </div>
        )}
        <div className="text-[11.5px] text-grey-500 mt-1.5 space-y-0.5">
          <div>
            <b>
              Payouts are made twice a month, no later than the {PAYOUT_DAY_FIRST_HALF}th and the {PAYOUT_DAY_SECOND_HALF}th.
            </b>{" "}
            (Lessons from the 1st–15th are paid no later than the {PAYOUT_DAY_FIRST_HALF}th of the same month; lessons from the 16th–end of month are paid no later than the {PAYOUT_DAY_SECOND_HALF}th of the next month. e.g. {formatPeriodWithPayoutEn("2026-10-01", "2026-10-15").replace(/, 2026/, "")})
          </div>
          {settlement.nextPayoutDate && <div>Next payout deadline: Paid by {formatDateOnly(settlement.nextPayoutDate)}</div>}
          <div>Pay periods and payout dates follow Pacific Time (America/Los_Angeles).</div>
          <div>The payout deadline is the date the money should be in your account. The Company sends the transfer a few business days earlier to allow for bank processing.</div>
          <div>If a payday falls on a weekend or U.S. federal bank holiday, payment is made on the preceding business day.</div>
          <div>Last updated: {fmtDateTime(settlement.refreshedAt, undefined, tz)}</div>
          <div>Amounts may change until finalized, depending on lesson outcomes and adjustments.</div>
          <div>Gross totals before taxes, fees, or other deductions.</div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-grey-200">
          <div>
            <div className="text-[11.5px] font-bold text-grey-400 mb-0.5">In review</div>
            <TotalsRow totals={settlement.inReviewTotalsByCurrency} emptyLabel="None" />
          </div>
          <div>
            <div className="text-[11.5px] font-bold text-grey-400 mb-0.5">Transfer approved</div>
            <TotalsRow totals={settlement.approvedTotalsByCurrency} emptyLabel="None" />
          </div>
          <div>
            <div className="text-[11.5px] font-bold text-grey-400 mb-0.5">Paid</div>
            <TotalsRow totals={settlement.paidTotalsByCurrency} emptyLabel="None" />
          </div>
        </div>
        <p className="text-[11px] text-grey-400 mt-2">
          When a payout period (1st–15th or 16th–end of month) ends, a batch is created and moves to <b>In review</b>. Once an
          operator gives final approval for payment, it becomes <b>Transfer approved</b>. If a lesson
          outcome or amount changes after the cutoff, the approved amount is not edited; the difference
          is applied as an adjustment in the next payout period.
        </p>
      </section>
      )}

      {subtab === "history" && (
      <section className="mb-4">
        <div className="text-[13px] font-bold text-ink mb-2">Payout history</div>
        {settlement.months.length === 0 ? (
          <p className="text-[13px] text-grey-500" data-testid="settlement-empty">
            No payouts yet. Completed lessons will appear here.
          </p>
        ) : (
          settlement.months.map((m) => {
            const key = `${m.periodKey}|${m.currency}|${m.status}`;
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
                        {m.periodStart && m.periodEnd ? formatPeriodLabelEn(m.periodStart, m.periodEnd) : formatMonth(m.settlementMonth)} lessons
                      </div>
                      <div className="text-[12px] text-grey-500 mt-0.5">
                        {payoutScheduleLabel(m, tz)} · {m.lessonCount} {m.lessonCount === 1 ? "lesson" : "lessons"}
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
                        <dt>Auto-calculated lesson total</dt>
                        <dd data-testid={`auto-${key}`}>
                          {formatAmount(m.autoCalculatedAmountMinor, m.currency)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Admin adjustment</dt>
                        <dd data-testid={`adjust-${key}`}>
                          {m.adjustmentAmountMinor > 0 ? "+" : ""}
                          {formatAmount(m.adjustmentAmountMinor, m.currency)}
                        </dd>
                      </div>
                      <div className="flex justify-between font-bold text-ink">
                        <dt>{m.status === "paid" ? "Amount paid" : "Final approved transfer amount"}</dt>
                        <dd data-testid={`final-${key}`}>{formatAmount(m.totalAmountMinor, m.currency)}</dd>
                      </div>
                    </dl>
                    <dl className="text-[11.5px] text-grey-500 mb-2 space-y-0.5">
                      <div className="flex justify-between">
                        <dt>Paid by</dt>
                        <dd data-testid={`sched-${key}`}>
                          {m.scheduledPayoutDate ? formatDateOnly(m.scheduledPayoutDate) : "Set after approval"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Automatic transfer</dt>
                        <dd data-testid={`auto-dispatch-${key}`}>
                          {m.autoDispatchEnabled ? "Yes" : "No (handled individually)"}
                        </dd>
                      </div>
                      {m.externalTransfer && (
                        <div className="flex justify-between">
                          <dt>Payment method</dt>
                          <dd data-testid={`external-${key}`}>
                            Direct bank transfer · {formatDateOnly(m.externalTransfer.transferredOn)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    {m.dateChanges.length > 0 && (
                      <ul className="text-[11px] text-grey-400 mb-2 space-y-0.5">
                        {m.dateChanges.map((c) => (
                          <li key={c.id} data-testid={`date-change-${c.id}`}>
                            Payout date {c.previousDate ? `${c.previousDate} → ` : ""}
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
                            {fmtDate(a.createdAt, undefined, tz)} ·{" "}
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
                          <th className="font-bold pb-1">Lesson date</th>
                          <th className="font-bold pb-1">Student</th>
                          <th className="font-bold pb-1">Subject</th>
                          <th className="font-bold pb-1">Type</th>
                          <th className="font-bold pb-1 text-right">Payable</th>
                          <th className="font-bold pb-1 text-right">Hourly rate</th>
                          <th className="font-bold pb-1 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.lines.map((l) => (
                          <tr key={l.payoutItemId} className="text-grey-500">
                            <td className="py-0.5">
                              {l.sessionDate ? fmtDate(l.sessionDate, undefined, tz) : "—"}
                            </td>
                            <td className="py-0.5">{l.studentName ?? "—"}</td>
                            <td className="py-0.5">{l.subjectName ?? "—"}</td>
                            <td className="py-0.5">{l.itemType}</td>
                            <td className="py-0.5 text-right">{l.payableMinutes} min</td>
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

      {subtab === "account" && (
        <PayoutAccountCard
          account={account}
          onSaved={(a) => {
            setAccount(a);
            onAccountSaved?.();
          }}
        />
      )}
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
  const tz = useViewerTimezone();
  // 정책(2026-10-06): 교사는 최초 1회만 등록한다. 저장 뒤에는 읽기 전용이고 수정은 ALTON 직원만 한다
  // (서버 액션·DB 함수도 같은 규칙으로 막는다 — 화면에서 숨기는 것만으로 끝내지 않는다).
  const [form, setForm] = useState({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    swiftOrRouting: "",
    currency: "KRW",
    country: "KR",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (account) {
    return (
      <section className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[13px] font-bold text-ink mb-2">Payout account</div>
        <div className="text-[12px] text-grey-500 space-y-0.5">
          <div>Account holder: {account.accountHolderName}</div>
          <div>Bank: {account.bankName}</div>
          <div data-testid="account-masked">Account number: {account.accountNumberMasked}</div>
          {account.swiftOrRouting && <div>SWIFT / routing: {account.swiftOrRouting}</div>}
          <div>Currency: {account.currency}</div>
          {account.country && <div>Country: {account.country}</div>}
          <div className="text-[11.5px] text-grey-400">Last updated {fmtDateTime(account.updatedAt, undefined, tz)}</div>
        </div>
        <p className="text-[11.5px] text-grey-500 mt-2" data-testid="account-locked-note">
          To change your account details, contact ALTON staff.
        </p>
      </section>
    );
  }

  const usd = form.currency === "USD";
  return (
    <section className="border-[1.5px] border-red/40 rounded-xl px-5 py-4 mb-4" data-testid="account-setup">
      <div className="text-[13px] font-bold text-ink mb-1">Set up your payout account</div>
      <p className="text-[12px] text-grey-500 mb-3" data-testid="account-empty">
        Payouts are made by bank transfer. Please enter your bank account once; after you save it, only ALTON staff can change it.
      </p>
      <div className="space-y-2">
        {error && <p className="text-[12px] text-red" data-testid="account-error">{error}</p>}
        <Field label="Account holder">
          <input
            value={form.accountHolderName}
            onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))}
            placeholder="Exactly as shown on the account"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
        </Field>
        <Field label="Bank name">
          <input
            value={form.bankName}
            onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
            placeholder="e.g. Woori Bank"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
        </Field>
        <Field label="Currency">
          <select
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value, country: e.target.value === "USD" ? "US" : "KR" }))}
            aria-label="Currency"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px] bg-white"
          >
            <option value="KRW">KRW (Korean won)</option>
            <option value="USD">USD (US dollar)</option>
          </select>
        </Field>
        <Field label="Country of the bank account">
          <input
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            placeholder="e.g. KR or US"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
        </Field>
        <Field label="Account number" hint={usd ? "Digits only (4–17)" : "Digits only (8–16); hyphens are fine, e.g. 1002-123-456789"}>
          <input
            value={form.accountNumber}
            onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
            placeholder="Full account number"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
        </Field>
        <Field label={usd ? "ABA routing number" : "SWIFT code (optional)"} hint={usd ? "9 digits" : undefined}>
          <input
            value={form.swiftOrRouting}
            onChange={(e) => setForm((f) => ({ ...f, swiftOrRouting: e.target.value }))}
            placeholder={usd ? "9-digit routing number" : "e.g. CZNBKRSE"}
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
        </Field>
        <p className="text-[11px] text-grey-400">
          For security, only the last 4 digits are shown after you save. To change them later, contact ALTON staff.
        </p>
        <div className="flex gap-3 mt-1">
          <button
            type="button"
            disabled={busy}
            aria-busy={busy}
            data-testid="account-save"
            className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const result = await saveMyPayoutAccountAction(form);
                if (result.status === "invalid") {
                  setError(result.message);
                } else {
                  setForm((f) => ({ ...f, accountNumber: "", swiftOrRouting: "" }));
                  onSaved(result.account);
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save payout account"}
          </button>
        </div>
      </div>
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
  const tz = useViewerTimezone();
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4">
      <div className="text-[13px] font-bold text-ink mb-1">Documents</div>
      <p className="text-[11.5px] text-grey-500 mb-2">
        For record-keeping only. Whether you upload documents does not affect payouts, matching, or lessons.
      </p>
      {error && <p className="text-[12px] text-red mb-2">{error}</p>}
      {documents.length === 0 ? (
        <p className="text-[12px] text-grey-500" data-testid="documents-empty">
          No documents uploaded yet.
        </p>
      ) : (
        <ul className="space-y-1 mb-2">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="text-ink truncate">{d.fileName}</span>
              <span className="text-[11.5px] text-grey-400 shrink-0">
                {fmtDate(d.uploadedAt, undefined, tz)}
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
                Download
              </button>
              {/* P4-2(UAT 후속) — 잘못 올린 파일을 교사가 직접 지울 수 있어야 한다. */}
              <button
                type="button"
                disabled={deletingId === d.id}
                data-testid={`delete-document-${d.id}`}
                className="text-[11.5px] font-bold text-red shrink-0 disabled:opacity-50"
                onClick={async () => {
                  if (!window.confirm(`Delete '${d.fileName}'? This cannot be undone.`)) return;
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
                {deletingId === d.id ? "Deleting…" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* 기본 file input은 버튼처럼 보이지 않는다는 피드백 — 입력은 숨기고 버튼으로 연다. */}
      <input
        ref={inputRef}
        type="file"
        aria-label="Upload document"
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
        {busy ? "Uploading…" : "Choose a file to upload"}
      </button>
      <p className="text-[11px] text-grey-400 mt-1">PDF or image (PNG/JPG/HEIC), up to 10MB</p>
    </section>
  );
}
