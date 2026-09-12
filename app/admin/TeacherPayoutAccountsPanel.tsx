"use client";

// P4-2 — 관리자 `정산` > `수취 계좌` 목록(조회 전용).
// 교사 본인이 등록한 것과 같은 원본을 읽고 같은 마스킹을 적용한다.

import { useEffect, useState } from "react";
import {
  listTeacherPayoutAccountsAction,
  type TeacherPayoutAccountListItem,
} from "./teacher-payout-accounts-actions";

const FIELD_LABEL: Record<string, string> = {
  account_holder_name: "예금주",
  bank_name: "은행명",
  account_number: "계좌번호",
  currency: "통화",
  country: "국가",
  swift_or_routing: "SWIFT/라우팅",
};

export default function TeacherPayoutAccountsPanel() {
  const [items, setItems] = useState<TeacherPayoutAccountListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openTeacherId, setOpenTeacherId] = useState<string | null>(null);

  useEffect(() => {
    void listTeacherPayoutAccountsAction()
      .then((rows) => {
        setItems(rows);
        setError(null);
      })
      .catch((e) => {
        setItems([]);
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

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
        선생님이 본인 포털에서 등록·수정한 수취 계좌입니다. 보안을 위해 계좌번호는 끝 4자리만
        표시되며, 값 수정은 선생님 본인만 할 수 있습니다.
      </p>
      {error && <p className="text-[12px] text-red mb-2">{error}</p>}
      {items.length === 0 && !error && (
        <p className="text-[13px] text-grey-500" data-testid="payout-accounts-empty">
          등록된 수취 계좌가 없습니다.
        </p>
      )}
      {items.map((a) => (
        <div key={a.teacherId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13.5px] font-bold text-ink">{a.teacherName || "(이름 없음)"}</div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                예금주 {a.accountHolderName} · {a.bankName}
              </div>
              <div className="text-[12px] text-grey-500" data-testid={`masked-${a.teacherId}`}>
                계좌번호 {a.accountNumberMasked} · {a.currency}
                {a.country ? ` · ${a.country}` : ""}
              </div>
              <div className="text-[11.5px] text-grey-400 mt-1">
                최종 수정 {new Date(a.updatedAt).toLocaleString("ko-KR")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenTeacherId(openTeacherId === a.teacherId ? null : a.teacherId)}
              className="text-[11.5px] font-bold text-ink underline shrink-0"
              data-testid={`history-${a.teacherId}`}
            >
              변경 이력 {a.changes.length}건
            </button>
          </div>
          {openTeacherId === a.teacherId && (
            <ul className="mt-3 pt-3 border-t border-grey-200 space-y-1">
              {a.changes.length === 0 ? (
                <li className="text-[11.5px] text-grey-400">기록된 변경 이력이 없습니다.</li>
              ) : (
                a.changes.map((c) => (
                  <li key={c.id} className="text-[11.5px] text-grey-500">
                    {new Date(c.createdAt).toLocaleString("ko-KR")} · {c.action === "created" ? "등록" : "수정"}
                    {c.changedFields.length > 0
                      ? ` · ${c.changedFields.map((f) => FIELD_LABEL[f] ?? f).join(", ")}`
                      : ""}
                    {c.previousLast4 && c.newLast4 && c.previousLast4 !== c.newLast4
                      ? ` (****${c.previousLast4} → ****${c.newLast4})`
                      : ""}
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
