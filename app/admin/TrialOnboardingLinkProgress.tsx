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
  cancelTrialOnboardingLinkAction,
  type TrialOnboardingLinkDetail,
  type TrialOnboardingLinkStudent,
} from "./trial-onboarding-actions";
import { cancelDirectOnboardingLinkStudentAction } from "./direct-account-actions";
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
  cancelled: "취소됨(관리자가 링크에서 제외)",
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
  const [cancelling, setCancelling] = useState(false);
  const [reissueFormOpen, setReissueFormOpen] = useState(false);
  const [reissueGuardianEmail, setReissueGuardianEmail] = useState("");
  const [reissueStudentEmails, setReissueStudentEmails] = useState<string[]>([]);
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
      setReissueGuardianEmail(d.guardianEmail);
      // 2026-09-07(정정) — 이미 계정이 생성된(created) 학생만 재발급 대상에서
      // 뺀다. 취소된(cancelled) 학생도 재발급 폼에 그대로 남겨서 값을 고쳐
      // 다시 포함시킬 수 있게 한다 — 한 번 취소하면 영영 못 돌아오던 버그
      // 수정(제품 오너 실사용 중 발견).
      setReissueStudentEmails(s.filter((row) => row.status !== "created").map((row) => row.studentEmail));
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
                <div className="mt-1.5">
                  {!reissueFormOpen ? (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        data-testid="trial-onboarding-link-reissue-open"
                        onClick={() => setReissueFormOpen(true)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink"
                      >
                        링크 폐기하고 재발급
                      </button>
                      <button
                        type="button"
                        data-testid="trial-onboarding-link-cancel-all"
                        disabled={cancelling}
                        aria-busy={cancelling}
                        onClick={async () => {
                          if (!window.confirm("이 링크 전체를 취소할까요? 아직 계정이 생성되지 않은 학생 전원이 취소되고, 이 링크는 더 이상 유효하지 않게 됩니다.")) return;
                          setCancelling(true);
                          try {
                            const result = await cancelTrialOnboardingLinkAction(linkId);
                            if (result.status === "cancelled") {
                              showToast("success", "링크 전체를 취소했습니다.");
                              await load();
                            } else {
                              showToast("error", `전체 취소 실패 — ${result.error}`);
                            }
                          } catch (e) {
                            showToast("error", `전체 취소 실패 — ${e instanceof Error ? e.message : String(e)}`);
                          } finally {
                            setCancelling(false);
                          }
                        }}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-red disabled:opacity-50"
                      >
                        {cancelling ? "취소 중..." : "전체 취소"}
                      </button>
                    </div>
                  ) : (
                    <div className="border border-grey-200 rounded-lg px-2.5 py-2 bg-white space-y-1.5">
                      <div className="text-[11px] font-bold text-ink">
                        재발급 — 오타 수정 등으로 이메일을 새로 입력할 수 있습니다(비우면 기존 값 유지)
                      </div>
                      <label className="block text-[10.5px] text-grey-500">
                        보호자 이메일
                        <input
                          type="email"
                          value={reissueGuardianEmail}
                          onChange={(e) => setReissueGuardianEmail(e.target.value)}
                          data-testid="trial-onboarding-link-reissue-guardian-email"
                          className="mt-0.5 w-full border border-grey-200 rounded px-2 py-1 text-[11.5px] text-ink"
                        />
                      </label>
                      {students
                        .filter((s) => s.status !== "created")
                        .map((s, i) => (
                          <label key={s.id} className="block text-[10.5px] text-grey-500">
                            {s.studentName} 이메일
                            {s.status === "cancelled" && (
                              <span className="text-red font-bold"> (취소됨 — 재발급하면 이 값으로 다시 포함됩니다)</span>
                            )}
                            <input
                              type="email"
                              value={reissueStudentEmails[i] ?? ""}
                              onChange={(e) =>
                                setReissueStudentEmails((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                              }
                              data-testid={`trial-onboarding-link-reissue-student-email-${i}`}
                              className="mt-0.5 w-full border border-grey-200 rounded px-2 py-1 text-[11.5px] text-ink"
                            />
                          </label>
                        ))}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          disabled={reissuing}
                          aria-busy={reissuing}
                          data-testid="trial-onboarding-link-reissue"
                          onClick={async () => {
                            if (!window.confirm("기존 링크를 폐기하고 새 링크를 발급·재발송할까요? 보호자가 계속 계정 생성에 실패하는 경우에만 사용하세요.")) return;
                            setReissuing(true);
                            try {
                              const activeStudents = students.filter((s) => s.status !== "created");
                              const result = await reissueTrialOnboardingLinkAction(linkId, {
                                guardianEmail: reissueGuardianEmail,
                                students: activeStudents.map((s, i) => ({
                                  name: s.studentName,
                                  email: reissueStudentEmails[i] ?? s.studentEmail,
                                  grade: s.studentGrade ?? undefined,
                                  subject: s.studentSubject ?? undefined,
                                })),
                              });
                              if (result.status === "sent") {
                                showToast("success", "새 링크를 발급하고 재발송했습니다.");
                              } else if (result.status === "already_sent") {
                                showToast("success", "이미 새 링크가 발송된 상태입니다.");
                              } else {
                                showToast("error", `재발급 실패 — ${result.error}`);
                              }
                              setReissueFormOpen(false);
                              await load();
                            } catch (e) {
                              showToast("error", `재발급 실패 — ${e instanceof Error ? e.message : String(e)}`);
                            } finally {
                              setReissuing(false);
                            }
                          }}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-ink text-white disabled:opacity-50"
                        >
                          {reissuing ? "재발급 중..." : "재발급 확정"}
                        </button>
                        <button
                          type="button"
                          disabled={reissuing}
                          onClick={() => setReissueFormOpen(false)}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
                    {(s.status === "pending" || s.status === "failed") && (
                      <button
                        data-testid={`trial-onboarding-link-cancel-student-${s.id}`}
                        disabled={retryingId === s.id}
                        onClick={async () => {
                          if (!window.confirm(`${s.studentName} 학생을 이 링크에서 취소할까요? 더 이상 이 링크로 계정이 생성되지 않습니다.`)) return;
                          setRetryingId(s.id);
                          try {
                            await cancelDirectOnboardingLinkStudentAction(s.id, "관리자 취소(잘못된 이메일 등)");
                            showToast("success", `${s.studentName} 학생을 취소했습니다.`);
                            await load();
                          } catch (e) {
                            showToast("error", `취소 실패 — ${e instanceof Error ? e.message : String(e)}`);
                          } finally {
                            setRetryingId(null);
                          }
                        }}
                        className="text-[11px] font-bold px-2.5 py-1 mt-1.5 ml-1.5 rounded-lg border-[1.5px] border-grey-200 text-red disabled:opacity-50"
                      >
                        학생 취소
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
