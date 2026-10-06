"use client";

// 관리자 `정산` > `수취 계좌`.
// 정책(2026-10-06 오너 확정): 교사는 최초 1회만 등록하고, 이후 수정은 마스터 관리자·정산권한 보유자가 교사를 대신해 입력한다.
// 목록에는 끝 4자리만 보인다. 전체 번호는 '전체 번호 보기' 버튼을 눌렀을 때만(호출마다 감사 기록) 약 30초 동안 일시적으로 표시한다.

import { useEffect, useState } from "react";
import PayoutAccountAdminActions from "./PayoutAccountAdminActions";
import {
  getPayoutAccountStaffPermissionAction,
  listTeacherPayoutAccountsAction,
  revealTeacherPayoutAccountAction,
  saveTeacherPayoutAccountByAdminAction,
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

export default function TeacherPayoutAccountsPanel() {
  const tz = useViewerTimezone();
  const [items, setItems] = useState<TeacherPayoutAccountListItem[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTeacherId, setOpenTeacherId] = useState<string | null>(null);

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
        결제 수단은 <b>은행 송금</b>뿐입니다. 선생님은 첫 로그인 뒤 본인 포털에서 <b>한 번만</b> 등록하고, 이후 변경은 마스터 관리자·정산권한
        보유자가 대신 입력합니다. 목록에는 끝 4자리만 보이며, 수동 송금이 필요할 때만 <b>전체 번호 보기</b>를 누르세요(누를 때마다 기록됩니다).
        {!canManage && " 이 계정은 입력·전체 번호 보기 권한이 없습니다."}
      </p>
      {error && <p className="text-[12px] text-red mb-2" data-testid="payout-accounts-error">{error}</p>}
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
            </div>
          </div>

          <PayoutAccountAdminActions
            idKey={a.teacherId}
            registered={a.registered}
            initial={{ accountHolderName: a.accountHolderName, bankName: a.bankName, currency: a.currency, country: a.country }}
            canManage={canManage}
            onReveal={() => revealTeacherPayoutAccountAction(a.teacherId)}
            onSave={(input) => saveTeacherPayoutAccountByAdminAction(a.teacherId, input)}
            onSaved={reload}
          />

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
