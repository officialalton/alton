"use client";

// 2026-09-11(P4-1) — 기존 주 보호자를 골라 자녀 1명을 추가하는 진입점.
// DirectAccountCreationForm(신규 보호자 + 학생 1~N)과 화면은 비슷하지만 다른
// 진입점이다: 보호자를 새로 입력하지 않고 이미 있는 주 보호자를 검색해 고른다.
// 발송 이후 흐름(링크 → 확인 → 계정 생성 → 동의 → 매칭 → 체험권 → 예약)은
// 완전히 같은 공통 경로이며, 형제자매 상태는 건드리지 않는다.

import { useEffect, useRef, useState } from "react";
import {
  searchPrimaryGuardiansAction,
  sendAddChildToGuardianNoticeAction,
  type PrimaryGuardianCandidate,
  type SendDirectOnboardingNoticeResult,
} from "./direct-account-actions";
import { useToasts, ToastStack } from "./Toast";

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_QUERY_LENGTH = 2;

export default function AddChildToGuardianForm({ onSent }: { onSent?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<PrimaryGuardianCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<PrimaryGuardianCandidate | null>(null);
  const [student, setStudent] = useState({ name: "", email: "", grade: "", subject: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SendDirectOnboardingNoticeResult | null>(null);
  // 발급 전 자녀 이메일 중복 차단(lib/onboarding-email-guard.ts)에 걸린 이메일.
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null);
  const { toasts, showToast, dismiss } = useToasts();
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!open || selected) return;
    const q = query.trim();
    // 입력이 짧아졌을 때의 초기화는 onChange에서 처리한다 — 이펙트 본문에서
    // 동기 setState를 부르면 연쇄 렌더가 생긴다(react-hooks/set-state-in-effect).
    if (q.length < MIN_QUERY_LENGTH) return;
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchPrimaryGuardiansAction(q);
        if (seq !== searchSeq.current) return;
        setCandidates(result);
        setSearched(true);
      } catch (e) {
        if (seq !== searchSeq.current) return;
        setCandidates([]);
        setSearched(true);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open, selected]);

  function reset() {
    setQuery("");
    setCandidates([]);
    setSearched(false);
    setSelected(null);
    setStudent({ name: "", email: "", grade: "", subject: "" });
    setError(null);
    setDuplicateEmail(null);
  }

  const isValid =
    selected !== null &&
    student.name.trim().length > 0 &&
    SIMPLE_EMAIL_RE.test(student.email.trim());

  if (!open) {
    return (
      <div className="mt-2">
        <button
          onClick={() => {
            setOpen(true);
            setLastResult(null);
          }}
          className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full"
        >
          + 자녀 추가
        </button>
        <ToastStack toasts={toasts} dismiss={dismiss} />
      </div>
    );
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mt-2">
      <div className="text-[13px] font-bold text-ink mb-1">자녀 추가</div>
      <p className="text-[11.5px] text-grey-500 mb-3">
        이미 계정이 있는 주 보호자에게 자녀 1명을 추가합니다. 보호자에게 안내 이메일이 1개
        발송되고, 자녀 계정이 생성되면 동의·체험수업권은 그 자녀 기준으로 새로 시작합니다.
        기존 형제자매의 상태는 바뀌지 않습니다.
      </p>
      {error && <p className="text-[12px] text-red mb-2">{error}</p>}

      {!selected ? (
        <div className="space-y-1.5">
          <input
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              if (value.trim().length < MIN_QUERY_LENGTH) {
                searchSeq.current += 1; // 진행 중인 검색 결과가 뒤늦게 반영되지 않도록
                setCandidates([]);
                setSearched(false);
                setSearching(false);
              }
            }}
            placeholder="보호자 이름 또는 이메일로 검색"
            aria-label="보호자 검색"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
          />
          {query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH && (
            <p className="text-[11px] text-grey-400">{MIN_QUERY_LENGTH}자 이상 입력해주세요.</p>
          )}
          {searching && <p className="text-[11px] text-grey-400">검색 중...</p>}
          {!searching && searched && candidates.length === 0 && (
            <p className="text-[11px] text-grey-400" data-testid="guardian-search-empty">
              검색 결과가 없습니다. 주 보호자만 검색됩니다.
            </p>
          )}
          {!searching && candidates.length > 0 && (
            <ul className="border border-grey-200 rounded-lg divide-y divide-grey-200">
              {candidates.map((c) => (
                <li key={c.guardianId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      setError(null);
                    }}
                    className="w-full text-left px-2 py-1.5"
                    data-testid={`guardian-candidate-${c.guardianId}`}
                  >
                    <div className="text-[12px] font-bold text-ink">{c.name}</div>
                    <div className="text-[11px] text-grey-500 break-all">{c.email}</div>
                    <div className="text-[11px] text-grey-400">
                      {c.childrenNames.length > 0 ? `자녀: ${c.childrenNames.join(", ")}` : "등록된 자녀 없음"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="border border-grey-200 rounded-lg p-2 flex items-start justify-between gap-2">
            <div>
              <div className="text-[12px] font-bold text-ink">{selected.name}</div>
              <div className="text-[11px] text-grey-500 break-all">{selected.email}</div>
              <div className="text-[11px] text-grey-400">
                {selected.childrenNames.length > 0
                  ? `기존 자녀: ${selected.childrenNames.join(", ")}`
                  : "등록된 자녀 없음"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setDuplicateEmail(null);
              }}
              className="text-[11.5px] font-bold text-ink underline shrink-0"
            >
              변경
            </button>
          </div>

          <div className="border border-grey-200 rounded-lg p-2 space-y-1">
            <div className="text-[11px] font-bold text-grey-400">추가할 자녀</div>
            <input
              value={student.name}
              onChange={(e) => setStudent((s) => ({ ...s, name: e.target.value }))}
              placeholder="학생 이름"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
            />
            <input
              value={student.email}
              onChange={(e) => {
                setDuplicateEmail(null);
                setStudent((s) => ({ ...s, email: e.target.value }));
              }}
              placeholder="학생 이메일"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
            />
            {duplicateEmail !== null && duplicateEmail === student.email.trim().toLowerCase() && (
              <p className="text-[11px] text-red" data-testid="duplicate-email">
                이미 사용 중인 이메일입니다. 다른 이메일을 입력해주세요.
              </p>
            )}
            <input
              value={student.grade}
              onChange={(e) => setStudent((s) => ({ ...s, grade: e.target.value }))}
              placeholder="학년(선택)"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
            />
            <input
              value={student.subject}
              onChange={(e) => setStudent((s) => ({ ...s, subject: e.target.value }))}
              placeholder="과목(선택)"
              className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
            />
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <button
          className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
          disabled={busy || !isValid}
          aria-busy={busy}
          onClick={async () => {
            if (!selected) return;
            setBusy(true);
            setError(null);
            setDuplicateEmail(null);
            try {
              const result = await sendAddChildToGuardianNoticeAction({
                guardianId: selected.guardianId,
                student: {
                  name: student.name,
                  email: student.email,
                  grade: student.grade || undefined,
                  subject: student.subject || undefined,
                },
              });
              setLastResult(result);
              if (result.status === "duplicate_emails") {
                setDuplicateEmail(result.collisions[0]?.email.trim().toLowerCase() ?? null);
                showToast(
                  "error",
                  `이미 사용 중인 이메일이 있어 발송하지 않았습니다: ${result.collisions.map((c) => c.email).join(", ")}`
                );
              } else if (result.status === "failed") {
                setError(`발송 실패(관리자 조치 필요) — ${result.error}`);
                showToast("error", `발송 실패 — ${result.error}`);
              } else {
                showToast("success", "자녀 추가 안내 발송 완료");
                reset();
                setOpen(false);
                onSent?.();
              }
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              setError(message);
              showToast("error", `발송 실패 — ${message}`);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "발송 중..." : "자녀 추가 안내 발송"}
        </button>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-[12px] font-semibold text-grey-500"
        >
          취소
        </button>
      </div>
      {lastResult?.status === "sent" && lastResult.localRedeemUrl && (
        <p className="text-[11px] text-grey-500 break-all mt-1">
          (개발용) 로컬 확인 링크: {lastResult.localRedeemUrl}
        </p>
      )}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
