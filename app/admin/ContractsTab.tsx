"use client";

import { useState } from "react";
import { sendFamilyContract } from "./contracts-actions";
import type { FamilyContract, PendingConsult } from "./contracts-data";

export default function ContractsTab({
  pendingConsults,
  contracts,
}: {
  pendingConsults: PendingConsult[];
  contracts: FamilyContract[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visiblePending = pendingConsults.filter((c) => !sentIds.includes(c.id));

  async function handleSend(consultRequestId: string) {
    setError(null);
    setLoadingId(consultRequestId);
    try {
      await sendFamilyContract({ consultRequestId, studentName, studentEmail });
      setSentIds((prev) => [...prev, consultRequestId]);
      setOpenId(null);
      setStudentName("");
      setStudentEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "계약서 발송에 실패했습니다.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">계약</h1>
      <p className="text-[13px] text-grey-500 mb-5">DocuSign 서명 상태를 총괄합니다.</p>

      <h2 className="text-[14px] font-bold text-ink mb-3">발송 대기</h2>
      <div className="mb-8">
        {visiblePending.length === 0 && (
          <p className="text-[13px] text-grey-500">발송 대기 중인 상담 신청이 없습니다.</p>
        )}
        {visiblePending.map((c) => (
          <div key={c.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">{c.personName}</div>
                <div className="text-[12px] text-grey-500">{c.email}</div>
              </div>
              {openId !== c.id && (
                <button
                  onClick={() => setOpenId(c.id)}
                  className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5"
                >
                  계약서 발송
                </button>
              )}
            </div>
            {openId === c.id && (
              <div className="mt-3 pt-3 border-t border-grey-200">
                <label htmlFor={`student-name-${c.id}`} className="block text-[12px] font-semibold text-grey-500 mb-1">
                  학생 이름
                </label>
                <input
                  id={`student-name-${c.id}`}
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-2"
                />
                <label htmlFor={`student-email-${c.id}`} className="block text-[12px] font-semibold text-grey-500 mb-1">
                  학생 이메일
                </label>
                <input
                  id={`student-email-${c.id}`}
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] mb-3"
                />
                {error && <p className="text-[12px] text-red mb-2">{error}</p>}
                <button
                  onClick={() => handleSend(c.id)}
                  disabled={loadingId === c.id}
                  className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  {loadingId === c.id ? "발송 중…" : "발송 확정"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <h2 className="text-[14px] font-bold text-ink mb-3">발송된 계약</h2>
      {contracts.length === 0 ? (
        <p className="text-[13px] text-grey-500">발송된 계약이 없습니다.</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-grey-500 border-b border-grey-200">
              <th className="py-2">학부모</th>
              <th className="py-2">학생</th>
              <th className="py-2">상태</th>
              <th className="py-2">서명일</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id} className="border-b border-grey-100">
                <td className="py-2">{c.parentName}</td>
                <td className="py-2">{c.studentName}</td>
                <td className="py-2">{c.status === "signed" ? "서명완료" : "발송됨"}</td>
                <td className="py-2">{c.signedAt ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
