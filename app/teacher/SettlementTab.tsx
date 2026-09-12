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

import { useEffect, useState } from "react";
import {
  getMyPayoutAccountAction,
  listMyDocumentsAction,
  loadMySettlementAction,
  saveMyPayoutAccountAction,
  uploadMyDocumentAction,
  getMyDocumentDownloadUrlAction,
  type MaskedPayoutAccount,
  type TeacherDocumentItem,
} from "./settlement-actions";
import type { SettlementMonth, TeacherSettlement } from "./settlement-data";

// 2026-09-12(제품 오너 확정 흐름) — 교사 화면은 아래 4단계로만 말한다.
// '확정'이라는 모호한 말 대신 '송금 승인됨'을 쓴다: 사람이 실제 지급 대상으로
// 최종 승인한 지점이 어디인지가 교사에게 분명해야 하기 때문이다.
const STATUS_LABEL: Record<SettlementMonth["status"], string> = {
  scheduled: "예정",
  in_review: "검토 중",
  approved: "송금 승인됨",
  paid: "지급 완료",
};

function formatAmount(minor: number, currency: string): string {
  // KRW는 소수 단위가 없어 minor가 곧 원 금액이다. 그 외 통화는 100분의 1 단위로 본다.
  const value = currency === "KRW" || currency === "JPY" ? minor : minor / 100;
  return `${value.toLocaleString("ko-KR")} ${currency}`;
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

      <section className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[13px] font-bold text-ink mb-2">다음 지급 예정액</div>
        <TotalsRow totals={settlement.scheduledTotalsByCurrency} emptyLabel="예정된 금액이 없습니다." />
        <div className="text-[11.5px] text-grey-500 mt-1.5 space-y-0.5">
          <div>
            지급 예정 월:{" "}
            {settlement.nextPayoutMonth ? formatMonth(settlement.nextPayoutMonth) : "—"} (수업 월의 익월)
          </div>
          <div>구체적인 지급일은 확정되면 안내합니다.</div>
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
                        지급 예정 월 {formatMonth(m.payoutMonth)} · 수업 {m.lessonCount}건
                        {m.paidAt ? ` · 지급일 ${new Date(m.paidAt).toLocaleDateString("ko-KR")}` : ""}
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

      <PayoutAccountCard account={account} onSaved={setAccount} />
      <DocumentsCard documents={documents ?? []} onUploaded={(d) => setDocuments((prev) => [d, ...(prev ?? [])])} />
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
        <div className="space-y-1.5">
          {error && <p className="text-[12px] text-red">{error}</p>}
          <input
            value={form.accountHolderName}
            onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))}
            placeholder="예금주"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
          <input
            value={form.bankName}
            onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
            placeholder="은행명"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
          <input
            value={form.accountNumber}
            onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
            placeholder="계좌번호(전체 입력)"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
          <input
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            placeholder="통화(예: KRW)"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
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
}: {
  documents: TeacherDocumentItem[];
  onUploaded: (d: TeacherDocumentItem) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            </li>
          ))}
        </ul>
      )}
      <input
        type="file"
        aria-label="서류 업로드"
        disabled={busy}
        className="text-[11.5px]"
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
      <p className="text-[11px] text-grey-400 mt-1">PDF 또는 이미지(PNG/JPG/HEIC), 10MB 이하</p>
    </section>
  );
}
