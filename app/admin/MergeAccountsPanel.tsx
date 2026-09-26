"use client";

import { useEffect, useState } from "react";
import {
  findAccountForMergeByEmail,
  mergeAccounts,
  listPendingAnonymizations,
  anonymizeMergedAccount,
  type MergeSearchResult,
  type PendingAnonymization,
} from "./merge-actions";

const ROLE_LABEL: Record<string, string> = {
  student: "학생",
  teacher: "선생님",
  parent: "학부모",
  consultant: "컨설턴트",
  admin: "관리자",
};

// Section 2(2026-09-24) — merge_accounts()/anonymize_merged_account() DB
// 함수는 R2 Task 5(2026-08-31)에 이미 있었지만, 관리자가 실제로 실행할
// 화면이 없었다(master-roadmap-v3.md에 명시된 미완료 항목). 후보 검색 →
// 확인 → 사유 입력 → 실행, 그리고 30일 유예 지난 병합 원본의 익명화 실행
// 목록까지 이 화면 하나로 묶는다. 실제 소유권 재배정·감사 이력·동시성
// 방지는 전부 DB 함수가 하고, 여기는 얇은 UI일 뿐이다.
export default function MergeAccountsPanel() {
  const [survivorEmail, setSurvivorEmail] = useState("");
  const [mergedEmail, setMergedEmail] = useState("");
  const [survivor, setSurvivor] = useState<MergeSearchResult>(null);
  const [merged, setMerged] = useState<MergeSearchResult>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [pending, setPending] = useState<PendingAnonymization[] | null>(null);
  const [anonBusyId, setAnonBusyId] = useState<string | null>(null);

  function loadPending() {
    listPendingAnonymizations()
      .then(setPending)
      .catch((e) => setError(e instanceof Error ? e.message : "익명화 대기 목록을 불러오지 못했습니다."));
  }
  useEffect(loadPending, []);

  async function search(kind: "survivor" | "merged") {
    setError(null);
    setNotice(null);
    const email = kind === "survivor" ? survivorEmail : mergedEmail;
    try {
      const result = await findAccountForMergeByEmail(email);
      if (!result) {
        setError("해당 이메일의 계정을 찾을 수 없습니다.");
        return;
      }
      if (kind === "survivor") setSurvivor(result);
      else setMerged(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색에 실패했습니다.");
    }
  }

  async function runMerge() {
    if (!survivor || !merged) return;
    setBusy(true);
    setError(null);
    try {
      await mergeAccounts({ survivorId: survivor.id, mergedId: merged.id, reason });
      setNotice(`병합 완료 — ${merged.name ?? merged.email}의 데이터가 ${survivor.name ?? survivor.email}로 옮겨졌습니다.`);
      setSurvivor(null);
      setMerged(null);
      setSurvivorEmail("");
      setMergedEmail("");
      setReason("");
      setConfirming(false);
      loadPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "병합에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function runAnonymize(profileId: string) {
    setAnonBusyId(profileId);
    setError(null);
    try {
      await anonymizeMergedAccount(profileId);
      setNotice("익명화 및 계정 삭제가 완료되었습니다.");
      loadPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "익명화에 실패했습니다.");
    } finally {
      setAnonBusyId(null);
    }
  }

  const roleMismatch = survivor && merged && survivor.role !== merged.role;

  return (
    <div className="max-w-[720px]">
      <h2 className="text-[16px] font-extrabold text-ink mb-1">계정 병합</h2>
      <p className="text-[12.5px] text-grey-500 mb-4">
        중복 가입 등으로 생긴 같은 사람의 두 계정을 하나로 합칩니다. 생존 계정에 모든 데이터가 재배정되고,
        병합된 계정은 즉시 로그인이 막히며(closed) 30일 뒤 개인정보가 익명화됩니다. 되돌릴 수 없습니다.
      </p>
      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}
      {notice && <p className="text-[12.5px] text-green mb-3">{notice}</p>}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-[12px] font-bold text-grey-500 block mb-1">생존 계정(남길 계정) 이메일</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={survivorEmail}
              onChange={(e) => setSurvivorEmail(e.target.value)}
              className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[12.5px]"
              placeholder="survivor@example.com"
            />
            <button
              type="button"
              onClick={() => search("survivor")}
              disabled={!survivorEmail.trim()}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50 shrink-0"
            >
              찾기
            </button>
          </div>
          {survivor && (
            <p className="text-[12px] text-ink mt-1.5 bg-grey-100 rounded-lg px-2.5 py-1.5">
              {survivor.name ?? "이름 없음"} · {ROLE_LABEL[survivor.role] ?? survivor.role}
            </p>
          )}
        </div>
        <div>
          <label className="text-[12px] font-bold text-grey-500 block mb-1">병합될 계정(닫을 계정) 이메일</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={mergedEmail}
              onChange={(e) => setMergedEmail(e.target.value)}
              className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[12.5px]"
              placeholder="duplicate@example.com"
            />
            <button
              type="button"
              onClick={() => search("merged")}
              disabled={!mergedEmail.trim()}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50 shrink-0"
            >
              찾기
            </button>
          </div>
          {merged && (
            <p className="text-[12px] text-ink mt-1.5 bg-grey-100 rounded-lg px-2.5 py-1.5">
              {merged.name ?? "이름 없음"} · {ROLE_LABEL[merged.role] ?? merged.role}
            </p>
          )}
        </div>
      </div>

      {roleMismatch && (
        <p className="text-[12.5px] text-red mb-3">두 계정의 역할이 달라({ROLE_LABEL[survivor!.role]} / {ROLE_LABEL[merged!.role]}) 병합할 수 없습니다.</p>
      )}

      {survivor && merged && !roleMismatch && (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-4 mb-4">
          <label className="text-[12px] font-bold text-grey-500 block mb-1">병합 사유</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[12.5px] min-h-[60px]"
            placeholder="예: 같은 학생이 이메일을 바꿔 재가입함"
          />
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!reason.trim()}
              className="mt-2 text-[12.5px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
            >
              병합 진행
            </button>
          ) : (
            <div className="mt-2 bg-red/5 border-[1.5px] border-red/30 rounded-lg px-3 py-2.5">
              <p className="text-[12.5px] text-ink font-semibold mb-2">
                정말로 {merged.name ?? merged.email}({ROLE_LABEL[merged.role]}) 계정을 {survivor.name ?? survivor.email}에 병합하고
                닫으시겠습니까? 되돌릴 수 없습니다.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={runMerge}
                  className="text-[12.5px] font-bold px-3.5 py-1.5 rounded-lg bg-red text-white disabled:opacity-50"
                >
                  {busy ? "병합 중..." : "확인, 병합합니다"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="text-[12.5px] font-bold text-grey-500 px-3.5 py-1.5">
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <h3 className="text-[13px] font-extrabold text-ink mb-2 mt-6">익명화 대기 중인 병합 계정</h3>
      {pending === null && <p className="text-[12.5px] text-grey-500">불러오는 중...</p>}
      {pending !== null && pending.length === 0 && <p className="text-[12.5px] text-grey-500">대기 중인 항목이 없습니다.</p>}
      {pending !== null &&
        pending.map((p) => (
          <div key={p.mergedId} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-bold text-ink">
                {p.mergedName ?? "이름 없음"} → {p.survivorName ?? "이름 없음"}
              </div>
              <div className="text-[11.5px] text-grey-500 mt-0.5">
                병합일 {new Date(p.mergedAt).toLocaleDateString("ko-KR")}
                {p.reason && ` · ${p.reason}`}
                {!p.eligibleNow && " · 아직 30일 유예 기간 중"}
              </div>
            </div>
            <button
              type="button"
              disabled={!p.eligibleNow || anonBusyId === p.mergedId}
              onClick={() => runAnonymize(p.mergedId)}
              className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50 shrink-0"
              title={!p.eligibleNow ? "30일이 지나야 익명화할 수 있습니다" : undefined}
            >
              {anonBusyId === p.mergedId ? "처리 중..." : "익명화 실행"}
            </button>
          </div>
        ))}
    </div>
  );
}
