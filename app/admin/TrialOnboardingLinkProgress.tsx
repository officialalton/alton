"use client";

// 2026-09-06 — 제품 오너 지적: "메일을 보낸 상태에서 해당 상담건의 부모님/자녀
// 이메일 등에 대한 입력을 어떻게 했는지, 부모가 동의하고 계정 만들기 전 상태에
// 대해 확인하기 어렵다. 보낸 내역을 어디선가 볼 수 있어야 한다." 관리자가
// 상담 카드에서 "체험 온보딩 안내 발송"을 누른 뒤, 그 발송 건의 진행 상태
// (보낸 시각, 보호자 이메일, 학생별 입력값·계정생성상태, 링크 전체 상태)를
// 조회 전용으로 펼쳐볼 수 있게 한다. 조회 함수(getTrialOnboardingLinkDetailAction/
// listTrialOnboardingLinkStudentsAction)는 이미 있었고 데이터도 이미 쌓이고
// 있었다 — 화면에 연결만 되어 있지 않았다.

import { useEffect, useState } from "react";
import {
  getTrialOnboardingLinkDetailAction,
  listTrialOnboardingLinkStudentsAction,
  retryFailedTrialOnboardingStudentAction,
  reissueTrialOnboardingLinkAction,
  type TrialOnboardingLinkDetail,
  type TrialOnboardingLinkStudent,
} from "./trial-onboarding-actions";
import { useToasts, ToastStack } from "./Toast";

const LINK_STATUS_LABEL: Record<TrialOnboardingLinkDetail["status"], string> = {
  pending: "발송됨 — 보호자 확인 대기",
  redeemed: "보호자가 확인해 계정 생성 완료",
  expired: "만료됨",
  revoked: "취소됨(재발급으로 대체)",
};

const STUDENT_STATUS_LABEL: Record<TrialOnboardingLinkStudent["status"], string> = {
  pending: "계정 생성 대기",
  created: "계정 생성 완료",
  failed: "계정 생성 실패",
};

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR");
}

export default function TrialOnboardingLinkProgress({ linkId }: { linkId: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TrialOnboardingLinkDetail | null>(null);
  const [students, setStudents] = useState<TrialOnboardingLinkStudent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [reissuing, setReissuing] = useState(false);
  const { toasts, showToast, dismiss } = useToasts();

  async function load() {
    setLoadError(null);
    try {
      const [d, s] = await Promise.all([
        getTrialOnboardingLinkDetailAction(linkId),
        listTrialOnboardingLinkStudentsAction(linkId),
      ]);
      setDetail(d);
      setStudents(s);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, linkId]);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11.5px] font-bold text-blue underline"
        data-testid="trial-onboarding-link-progress-toggle"
      >
        {open ? "발송 내역 접기" : "발송 내역 보기"}
      </button>

      {open && (
        <div className="mt-2 bg-grey-50 rounded-lg px-3.5 py-3" data-testid="trial-onboarding-link-progress">
          <ToastStack toasts={toasts} dismiss={dismiss} />
          {loadError && <div className="text-[11.5px] text-red">{loadError}</div>}
          {!detail || !students ? (
            <div className="text-[11.5px] text-grey-500">불러오는 중...</div>
          ) : (
            <>
              <div className="text-[11.5px] font-bold text-ink">
                링크 상태: {LINK_STATUS_LABEL[detail.status]}
              </div>
              <div className="text-[11px] text-grey-500 mt-1">
                보호자: {detail.guardianName} ({detail.guardianEmail})
              </div>
              <div className="text-[11px] text-grey-500 mt-0.5">
                {detail.noticeDeliveryStatus === "sent"
                  ? `안내 발송 완료 — ${fmt(detail.noticeSentAt)}`
                  : detail.noticeDeliveryStatus === "failed"
                    ? `안내 발송 실패${detail.noticeSendError ? `: ${detail.noticeSendError}` : ""}`
                    : "안내 발송 대기"}
              </div>
              {detail.redeemedAt && (
                <div className="text-[11px] text-grey-500 mt-0.5">보호자 확인: {fmt(detail.redeemedAt)}</div>
              )}
              <div className="text-[11px] text-grey-400 mt-0.5">
                발급: {fmt(detail.createdAt)} · 만료: {fmt(detail.expiresAt)}
              </div>

              {detail.status === "pending" && !detail.redeemedAt && (
                <button
                  type="button"
                  disabled={reissuing}
                  aria-busy={reissuing}
                  data-testid="trial-onboarding-link-reissue"
                  onClick={async () => {
                    if (!window.confirm("기존 링크를 폐기하고 새 링크를 발급·재발송할까요? 보호자가 계속 계정 생성에 실패하는 경우에만 사용하세요.")) return;
                    setReissuing(true);
                    try {
                      const result = await reissueTrialOnboardingLinkAction(linkId);
                      if (result.status === "sent") {
                        showToast("success", "새 링크를 발급하고 재발송했습니다.");
                      } else if (result.status === "already_sent") {
                        showToast("success", "이미 새 링크가 발송된 상태입니다.");
                      } else {
                        showToast("error", `재발급 실패 — ${result.error}`);
                      }
                      await load();
                    } catch (e) {
                      showToast("error", `재발급 실패 — ${e instanceof Error ? e.message : String(e)}`);
                    } finally {
                      setReissuing(false);
                    }
                  }}
                  className="text-[11px] font-bold px-2.5 py-1 mt-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                >
                  {reissuing ? "재발급 중..." : "링크 폐기하고 재발급"}
                </button>
              )}

              <div className="mt-2.5 space-y-1.5">
                {students.map((s) => (
                  <div
                    key={s.id}
                    className="border border-grey-200 rounded-lg px-2.5 py-2 bg-white"
                    data-testid="trial-onboarding-link-progress-student"
                  >
                    <div className="text-[11.5px] font-bold text-ink">
                      {s.studentName} <span className="font-normal text-grey-500">({s.studentEmail})</span>
                    </div>
                    <div className="text-[11px] text-grey-500 mt-0.5">
                      {s.studentGrade && `${s.studentGrade} · `}
                      {s.studentSubject ?? "과목 미입력"}
                    </div>
                    <div
                      className={
                        "text-[11px] mt-0.5 " +
                        (s.status === "created" ? "text-green" : s.status === "failed" ? "text-red" : "text-grey-500")
                      }
                    >
                      {STUDENT_STATUS_LABEL[s.status]}
                      {s.status === "failed" && s.error && `: ${s.error}`}
                    </div>
                    {s.status === "failed" && (
                      <button
                        disabled={retryingId === s.id}
                        aria-busy={retryingId === s.id}
                        onClick={async () => {
                          setRetryingId(s.id);
                          try {
                            const result = await retryFailedTrialOnboardingStudentAction(linkId, s.id);
                            if (result.status === "failed") {
                              showToast("error", `재시도 실패 — ${result.error}`);
                            } else {
                              showToast("success", `${s.studentName} 계정 생성 재시도 성공`);
                            }
                            await load();
                          } catch (e) {
                            showToast("error", `재시도 실패 — ${e instanceof Error ? e.message : String(e)}`);
                          } finally {
                            setRetryingId(null);
                          }
                        }}
                        className="text-[11px] font-bold px-2.5 py-1 mt-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                      >
                        {retryingId === s.id ? "재시도 중..." : "재시도"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
