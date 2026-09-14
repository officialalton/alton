"use client";

import { useEffect, useRef, useState } from "react";
import ConsultSlotPicker, { type ConsultSlotPickerHandle } from "@/app/components/ConsultSlotPicker";
import {
  listOpenGuardianConsultSlots,
  listGuardianConsultRequestsAction,
  submitGuardianConsultRequest,
} from "./consult-request-actions";
import type { RequestedChild, GuardianConsultRequest } from "./consult-request-data";

// 2026-09-06 — 보호자 포털 "새 자녀 상담 신청" 전용 화면(R11 범위 밖 — 기존 자녀의
// 일반 고민상담/현황면담은 이 화면에서 다루지 않는다). 보호자 정보(이름/이메일/
// household)는 서버 액션이 세션에서 자동으로 채우므로 이 화면은 재입력받지 않는다.
// 일정 선택 UI는 랜딩과 동일한 공용 컴포넌트 ConsultSlotPicker를 그대로 재사용한다.

type ChildDraft = {
  name: string;
  grade: string;
  subjectInterest: string;
  concerns: string;
};

function emptyChild(): ChildDraft {
  return { name: "", grade: "", subjectInterest: "", concerns: "" };
}

const STATUS_LABEL: Record<string, string> = {
  requested: "승인 대기",
  scheduled: "상담 확정",
  completed: "완료",
  cancelled: "취소/거절",
  no_show: "노쇼",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

export default function ConsultRequestTab() {
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild()]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const pickerRef = useRef<ConsultSlotPickerHandle>(null);

  const [history, setHistory] = useState<GuardianConsultRequest[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  function loadHistory() {
    listGuardianConsultRequestsAction()
      .then(setHistory)
      .catch((e) => setHistoryError(e instanceof Error ? e.message : "상담 이력을 불러오지 못했습니다."));
  }

  useEffect(() => {
    loadHistory();
  }, []);

  function updateChild(index: number, patch: Partial<ChildDraft>) {
    setChildren((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addChild() {
    setChildren((prev) => [...prev, emptyChild()]);
  }

  function removeChild(index: number) {
    setChildren((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit() {
    setError(null);
    if (!selectedSlot) {
      setError("상담 희망 시간을 선택해주세요.");
      return;
    }
    if (children.some((c) => !c.name.trim())) {
      setError("모든 자녀의 이름을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    const payload: RequestedChild[] = children.map((c) => ({
      name: c.name,
      grade: c.grade || undefined,
      subjectInterest: c.subjectInterest || undefined,
      concerns: c.concerns || undefined,
    }));
    const result = await submitGuardianConsultRequest({ slotStartsAtIso: selectedSlot, children: payload });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      // 랜딩 신청과 동일하게 슬롯 충돌 가능성이 있으므로 선택을 비우고 재조회한다.
      setSelectedSlot("");
      pickerRef.current?.refetch();
      return;
    }
    setSubmitted(true);
    setChildren([emptyChild()]);
    setSelectedSlot("");
    loadHistory();
  }

  return (
    <div className="max-w-[720px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-1">새 자녀 상담 신청</h2>
      <p className="text-[12.5px] text-grey-500 mb-5">
        신규 자녀에 대한 상담을 신청합니다. 자녀 계정 초대는 상담 후 관리자가
        안내해드립니다. 기존 자녀의 고민상담·현황면담 문의는 이 화면 범위 밖입니다
        `문의` 탭에서 남겨주세요.
      </p>

      {submitted && (
        <div className="bg-green/10 text-green text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          상담 신청이 접수되었습니다. 관리자가 확인 후 확정 안내를 드립니다.
        </div>
      )}
      {error && (
        <div className="bg-red/10 text-red text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-5">
        {children.map((c, i) => (
          <div key={i} className="border-[1.5px] border-grey-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-bold text-ink">자녀 {i + 1}</span>
              {children.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeChild(i)}
                  className="text-[11.5px] font-semibold text-red"
                >
                  삭제
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              <input
                placeholder="이름"
                aria-label={`자녀 ${i + 1} 이름`}
                value={c.name}
                onChange={(e) => updateChild(i, { name: e.target.value })}
                className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
              />
              <input
                placeholder="학년(선택)"
                aria-label={`자녀 ${i + 1} 학년`}
                value={c.grade}
                onChange={(e) => updateChild(i, { grade: e.target.value })}
                className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
              />
            </div>
            <input
              placeholder="관심 과목(선택)"
              aria-label={`자녀 ${i + 1} 관심 과목`}
              value={c.subjectInterest}
              onChange={(e) => updateChild(i, { subjectInterest: e.target.value })}
              className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] mb-2"
            />
            <textarea
              placeholder="상담 내용(선택)"
              aria-label={`자녀 ${i + 1} 상담 내용`}
              value={c.concerns}
              onChange={(e) => updateChild(i, { concerns: e.target.value })}
              className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[70px]"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addChild}
        className="text-[12.5px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3.5 py-2 mb-5"
      >
        + 자녀 추가
      </button>

      <div className="mb-5">
        <span className="block text-[12.5px] font-bold text-ink mb-1.5">상담 희망 시간(60분)</span>
        <ConsultSlotPicker
          ref={pickerRef}
          fetchSlots={listOpenGuardianConsultSlots}
          selectedStartsAt={selectedSlot || null}
          onSelect={setSelectedSlot}
        />
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="px-8 py-3 rounded-xl bg-red text-white text-[14px] font-bold disabled:opacity-50"
      >
        {submitting ? "신청 중..." : "상담 신청하기"}
      </button>

      <div className="mt-10">
        <h3 className="text-[14px] font-bold text-ink mb-3">신청 이력</h3>
        {historyError && <p className="text-[13px] text-red">{historyError}</p>}
        {!historyError && history === null && (
          <p className="text-[13px] text-grey-500">불러오는 중...</p>
        )}
        {history && history.length === 0 && (
          <p className="text-[13px] text-grey-500">신청 이력이 없습니다.</p>
        )}
        {history && history.length > 0 && (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-ink">
                    {STATUS_LABEL[h.status] ?? h.status}
                  </span>
                  <span className="text-[11px] text-grey-500">
                    신청일 {formatDateTime(h.requestedAt)}
                  </span>
                </div>
                <div className="text-[12px] text-grey-500 mt-1">
                  자녀: {h.requestedChildren.map((c) => c.name).join(", ") || "-"}
                </div>
                {(h.scheduledAt ?? h.startsAt) && (
                  <div className="text-[12px] text-grey-500 mt-0.5">
                    🗓 {formatDateTime(h.scheduledAt ?? h.startsAt)}
                  </div>
                )}
                {h.googleMeetLink && (
                  <a
                    href={h.googleMeetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-1 text-[12px] font-semibold text-ink underline"
                  >
                    Google Meet 링크
                  </a>
                )}
                {h.status === "cancelled" && h.cancellationReason && (
                  <div className="text-[12px] text-red mt-1">사유: {h.cancellationReason}</div>
                )}
                {h.status === "completed" && h.adminReviewSummary && (
                  <div className="text-[12px] text-grey-500 mt-1">📝 {h.adminReviewSummary}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
