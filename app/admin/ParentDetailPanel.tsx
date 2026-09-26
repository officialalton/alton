"use client";

import { useEffect, useState } from "react";
import {
  getParentDetailAction,
  setChildConsultantFromParentPanelAction,
  type ParentDetail,
} from "./parent-detail-actions";
import { setParentStatus } from "./users-actions";

const STATUS_LABEL: Record<string, string> = {
  active: "활성",
  pending: "가입 대기",
  suspended: "일시정지",
  inactive: "비활성(장기 휴면)",
};

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  ready: "발송 준비",
  sent: "발송됨",
  awaiting_signature: "서명 대기",
  signed: "서명 완료",
  active: "진행 중",
  termination_pending: "해지 처리 중",
  terminated: "해지됨",
  void: "무효화됨",
  superseded: "대체됨",
  expired: "만료됨",
};

export default function ParentDetailPanel({
  parentId,
  parentName,
  parentEmail,
  onBack,
}: {
  parentId: string;
  parentName: string;
  parentEmail: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<ParentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [consultantEditingId, setConsultantEditingId] = useState<string | null>(null);
  const [consultantEmailDraft, setConsultantEmailDraft] = useState("");
  const [consultantSaving, setConsultantSaving] = useState(false);
  const [consultantError, setConsultantError] = useState<string | null>(null);

  function reload() {
    getParentDetailAction(parentId)
      .then((d) => {
        setDetail(d);
        setStatus(d.status);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId]);

  async function handleStatusChange(next: string) {
    const previous = status;
    setStatus(next);
    setStatusError(null);
    try {
      await setParentStatus(parentId, next as "active" | "pending" | "suspended" | "inactive");
    } catch (e) {
      setStatus(previous);
      setStatusError(e instanceof Error ? e.message : "상태 전환에 실패했습니다.");
    }
  }

  function startConsultantEdit(childId: string, currentEmail: string) {
    setConsultantEditingId(childId);
    setConsultantEmailDraft(currentEmail);
    setConsultantError(null);
  }

  async function handleConsultantSave(childId: string) {
    setConsultantSaving(true);
    setConsultantError(null);
    try {
      await setChildConsultantFromParentPanelAction(childId, consultantEmailDraft.trim() || null);
      setConsultantEditingId(null);
      reload();
    } catch (e) {
      setConsultantError(e instanceof Error ? e.message : "배정 변경에 실패했습니다.");
    } finally {
      setConsultantSaving(false);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-600 font-semibold mb-4 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
      >
        ← 뒤로
      </button>
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">{parentName}</h1>
      <p className="text-[13px] text-grey-500 mb-5">{parentEmail}</p>

      {loadError && <p className="text-[13px] text-red">{loadError}</p>}
      {!detail && !loadError && <p className="text-[13px] text-grey-500">불러오는 중...</p>}

      {detail && (
        <>
          <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">상태</div>
            <select
              value={status ?? detail.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] font-semibold"
            >
              {Object.entries(STATUS_LABEL).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            {statusError && <p className="text-[12px] text-red mt-1.5">{statusError}</p>}
            <p className="text-[12px] text-grey-500 mt-2">
              가입일 {detail.joinedAt ? new Date(detail.joinedAt).toLocaleDateString("ko-KR") : "미입력"}
              {detail.location ? ` · ${detail.location}` : ""}
              {detail.referralCode ? ` · 추천코드 ${detail.referralCode}` : ""}
            </p>
          </div>

          <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-3">
              연결 자녀 · 담당 컨설턴트 ({detail.children.length}명)
            </div>
            {detail.children.length === 0 && <p className="text-[13px] text-grey-500">연결된 자녀가 없습니다.</p>}
            {detail.children.map((child) => (
              <div key={child.id} className="border-b border-grey-100 last:border-0 py-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-bold text-ink">{child.name ?? "이름 없음"}</span>
                    <span className="text-[11px] text-grey-500 ml-2">
                      {child.status === "active" ? "활성" : child.status}
                    </span>
                  </div>
                </div>
                <div className="text-[12px] text-grey-500 mt-1">
                  담당 컨설턴트: {child.consultantName ?? "미배정"}
                </div>
                {consultantEditingId === child.id ? (
                  <div className="flex gap-2 mt-1.5">
                    <input
                      value={consultantEmailDraft}
                      onChange={(e) => setConsultantEmailDraft(e.target.value)}
                      placeholder="컨설턴트 계정 이메일 (비우면 배정 해제)"
                      className="flex-1 px-2.5 py-1 border-[1.5px] border-grey-200 rounded-lg text-[12px]"
                    />
                    <button
                      onClick={() => handleConsultantSave(child.id)}
                      disabled={consultantSaving}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-ink text-white disabled:opacity-50"
                    >
                      {consultantSaving ? "저장 중..." : "저장"}
                    </button>
                    <button
                      onClick={() => setConsultantEditingId(null)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startConsultantEdit(child.id, "")}
                    className="text-[11px] font-bold text-grey-500 mt-1 underline"
                  >
                    배정 변경
                  </button>
                )}
              </div>
            ))}
            {consultantError && <p className="text-[12px] text-red mt-2">{consultantError}</p>}
          </div>

          <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-3">
              계약·진행 현황 ({detail.contracts.length}건)
            </div>
            {detail.contracts.length === 0 && <p className="text-[13px] text-grey-500">계약 이력이 없습니다.</p>}
            {detail.contracts.map((c) => (
              <div key={c.id} className="border-b border-grey-100 last:border-0 py-2 text-[12.5px]">
                <span className="font-bold text-ink">{c.childName ?? "학생"}</span>
                <span className="text-grey-500"> · {CONTRACT_STATUS_LABEL[c.status] ?? c.status}</span>
                {c.voidedAt && <span className="text-red"> · 무효화됨({c.voidReason ?? "사유 없음"})</span>}
                <div className="text-[11px] text-grey-400 mt-0.5">
                  {new Date(c.createdAt).toLocaleDateString("ko-KR")}
                </div>
              </div>
            ))}
          </div>

          <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-3">
              연락 이력(최근 {detail.messages.length}건)
            </div>
            {detail.messages.length === 0 && <p className="text-[13px] text-grey-500">연락 이력이 없습니다.</p>}
            {detail.messages.map((m) => (
              <div key={m.id} className="border-b border-grey-100 last:border-0 py-2 text-[12.5px]">
                <span className="font-bold text-ink">{m.senderName ?? m.senderRole}</span>
                <span className="text-grey-400 text-[11px] ml-2">
                  {new Date(m.createdAt).toLocaleString("ko-KR")}
                </span>
                <p className="text-grey-600 mt-0.5 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
