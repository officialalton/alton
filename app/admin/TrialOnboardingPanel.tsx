"use client";

// M4 — 관리자용 상담→체험→정규 전환 파이프라인 화면. 상담별로 14단계 진행
// 상태를 한 화면에서 보여주고, 다음 관리자 행동을 안내한다. 체험/정규 구분
// 없이 단일 teacher_assignments 배정이라는 정책을 그대로 반영해 "배정"은
// 한 단계로만 표시한다.

import { useEffect, useState } from "react";
import {
  confirmTrialIntentAction,
  sendTrialOnboardingNoticeAction,
  type SendTrialOnboardingNoticeResult,
  listTrialOnboardingCandidatesAction,
  listRegularConversionCandidatesAction,
  planTrialSubjectAndAssignTeacherAction,
  sendRegularContractOneClickAction,
  getTrialOnboardingPipelineAction,
  type TrialOnboardingCandidate,
  type RegularConversionCandidate,
  type TrialOnboardingPipeline,
} from "./trial-onboarding-actions";
import { retryTrialEntitlementGrant } from "./consultation-scheduling-actions";

const LINK_STATUS_LABEL: Record<TrialOnboardingCandidate["linkStatus"], string> = {
  none: "온보딩 링크 미발급",
  pending: "온보딩 링크 발급됨 — 보호자 응답 대기",
  redeemed: "온보딩 링크 사용 완료",
  expired: "온보딩 링크 만료됨 — 재발급 필요",
  revoked: "온보딩 링크 취소됨",
};

export default function TrialOnboardingPanel() {
  const [candidates, setCandidates] = useState<TrialOnboardingCandidate[] | null>(null);
  const [conversions, setConversions] = useState<RegularConversionCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setCandidates(await listTrialOnboardingCandidatesAction());
    } catch {
      setCandidates([]);
    }
    try {
      setConversions(await listRegularConversionCandidatesAction());
    } catch {
      setConversions([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (!candidates || !conversions) return null;

  return (
    <div className="max-w-[640px] px-8 py-8 border-t border-grey-200 mt-8">
      <h2 className="text-[16px] font-extrabold text-ink mb-1.5">상담 → 체험 → 정규 전환</h2>
      <p className="text-[13px] text-grey-500 mb-5">
        상담별 전환 진행 상태와 다음에 해야 할 관리자 행동을 순서대로 보여줍니다.
      </p>

      {candidates.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          체험 추천된 상담이 없습니다.
        </div>
      ) : (
        candidates.map((c) => <CandidateCard key={c.consultationId} candidate={c} onChanged={refresh} />)
      )}

      <h3 className="text-[14px] font-extrabold text-ink mt-6 mb-1.5">정규 계약 발송 대기</h3>
      <p className="text-[12px] text-grey-500 mb-3">
        보호자가 정규 진행을 희망한 과목입니다. 아래에서 계약 발송을 진행하세요.
      </p>
      {conversions.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          정규 진행을 희망한 과목 수강이 없습니다.
        </div>
      ) : (
        conversions.map((v) => <RegularContractRow key={v.subjectEnrollmentId} item={v} onSent={refresh} />)
      )}

      {error && <div className="text-[12.5px] text-red mt-2">{error}</div>}
    </div>
  );
}

function CandidateCard({
  candidate: c,
  onChanged,
}: {
  candidate: TrialOnboardingCandidate;
  onChanged: () => void;
}) {
  const [pipeline, setPipeline] = useState<TrialOnboardingPipeline | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkResult, setLinkResult] = useState<SendTrialOnboardingNoticeResult | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPipeline() {
    try {
      setPipeline(await getTrialOnboardingPipelineAction(c.consultationId, c.childId, c.trialIntentConfirmedAt));
    } catch {
      setPipeline(null);
    }
  }

  useEffect(() => {
    loadPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.childId, c.trialIntentConfirmedAt]);

  const doneCount = pipeline?.steps.filter((s) => s.done).length ?? 0;
  const currentStep = pipeline?.steps.find((s) => !s.done);

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
      <div className="flex items-center justify-between">
        <div className="text-[13.5px] font-bold text-ink">
          {c.contactName} <span className="font-normal text-grey-500">({c.contactEmail})</span>
        </div>
        {pipeline && (
          <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-grey-100 text-grey-500 shrink-0">
            {doneCount}/{pipeline.steps.length}단계
          </span>
        )}
      </div>

      {pipeline && (
        <ol className="mt-2.5 space-y-1">
          {pipeline.steps.map((s, i) => {
            const isCurrent = !s.done && pipeline.steps.slice(0, i).every((prev) => prev.done);
            return (
              <li
                key={s.key}
                className={
                  "text-[11.5px] flex items-center gap-1.5 " +
                  (s.done ? "text-grey-400" : isCurrent ? "text-ink font-bold" : "text-grey-300")
                }
              >
                <span aria-hidden="true">{s.done ? "✓" : isCurrent ? "▶" : "·"}</span>
                <span>{s.label}</span>
                {s.done && <span className="text-[10px] text-grey-300">완료</span>}
                {isCurrent && <span className="text-[10px] text-ink">← 다음 관리자 행동</span>}
              </li>
            );
          })}
        </ol>
      )}

      <div className="text-[11.5px] text-grey-500 mt-2">{LINK_STATUS_LABEL[c.linkStatus]}</div>
      {error && <div className="text-[12px] text-red mt-1.5">{error}</div>}

      {/* 1단계: 체험 진행 확정 */}
      {currentStep?.key === "trial_intent" && (
        <button
          disabled={busy}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await confirmTrialIntentAction(c.consultationId);
              onChanged();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
            setBusy(false);
          }}
          className="text-[12px] font-bold px-3 py-1.5 mt-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          {busy ? "처리 중..." : "체험 진행 확정"}
        </button>
      )}

      {/* 2단계: 온보딩 링크 발급(재발급 포함) */}
      {currentStep?.key === "account_linked" && c.linkStatus !== "pending" && (
        <TrialLinkForm
          consultationId={c.consultationId}
          open={linkOpen}
          reissue={c.linkStatus === "expired" || c.linkStatus === "revoked"}
          onOpen={() => {
            setLinkOpen(true);
            setLinkResult(null);
          }}
          onIssued={(r) => {
            setLinkResult(r);
            onChanged();
          }}
        />
      )}
      {currentStep?.key === "account_linked" && c.linkStatus === "pending" && (
        <div className="text-[12px] text-grey-500 mt-2.5">
          보호자 행동 대기 중 — 발급된 온보딩 링크로 계정을 생성하면 자동으로 다음 단계로
          넘어갑니다.
        </div>
      )}
      {linkOpen && linkResult && linkResult.status === "sent" && (
        <div className="text-[12px] text-ink mt-2 bg-grey-100 rounded-lg px-3 py-2">
          안내 이메일을 보냈습니다 — 발송 시각 {new Date(linkResult.sentAt).toLocaleString("ko-KR")}
          {linkResult.localRedeemUrl && (
            <>
              <br />
              <span className="text-[11px] text-grey-500">
                개발 환경 전용 확인 링크(실제 서비스에서는 노출되지 않음):
              </span>
              <br />
              <span className="text-[11px] text-grey-500 break-all">{linkResult.localRedeemUrl}</span>
            </>
          )}
        </div>
      )}
      {linkOpen && linkResult && linkResult.status === "already_sent" && (
        <div className="text-[12px] text-grey-500 mt-2 bg-grey-100 rounded-lg px-3 py-2">
          이미 발송된 안내입니다 — 발송 시각 {new Date(linkResult.sentAt).toLocaleString("ko-KR")} (중복 발송 안 함)
        </div>
      )}

      {/* 3단계: 과목 수강 + 선생님 배정 */}
      {currentStep?.key === "assignment" && (
        <TrialAssignmentForm
          childId={c.childId!}
          open={assignOpen}
          onOpen={() => setAssignOpen(true)}
          onDone={() => {
            setAssignOpen(false);
            onChanged();
          }}
        />
      )}

      {/* trial_entitlement은 자동 지급이 실패했을 수 있다(대개 grant 시점에
          child_id가 아직 없던 경우) — 실패 시 관리자가 수동 재시도할 수 있어야
          한다. grant_trial_entitlement_for_consultation()의 idempotency 덕분에
          이미 지급됐으면 재시도해도 중복 지급되지 않는다. */}
      {currentStep?.key === "trial_entitlement" && pipeline?.trialEntitlementGrantStatus === "failed" ? (
        <div className="mt-2.5">
          <div className="text-[12px] text-red">
            체험수업권 지급에 실패했습니다{pipeline.trialEntitlementGrantError ? `: ${pipeline.trialEntitlementGrantError}` : ""}
          </div>
          <button
            disabled={busy}
            aria-busy={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await retryTrialEntitlementGrant(c.consultationId);
                await loadPipeline();
                onChanged();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
              setBusy(false);
            }}
            className="text-[12px] font-bold px-3 py-1.5 mt-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
          >
            {busy ? "재시도 중..." : "체험수업권 지급 재시도"}
          </button>
        </div>
      ) : (
        /* 4~9단계: 전부 보호자·선생님 쪽 행동 대기 — 관리자가 누를 버튼이 없는 상태를
            명시적으로 보여준다(빈 화면처럼 보이지 않게). */
        currentStep &&
        ["trial_consent", "trial_entitlement", "trial_booking", "smart_notes", "review", "regular_intent"].includes(
          currentStep.key
        ) && <div className="text-[12px] text-grey-500 mt-2.5">{waitingMessage(currentStep.key)}</div>
      )}

      {/* 10단계 이후는 아래 "정규 계약 발송 대기" 목록에서 처리 — 여기서는
          진행 상태만 보여주고 별도 액션 버튼을 중복해서 두지 않는다. */}
      {currentStep?.key === "contract_sent" && (
        <div className="text-[12px] text-grey-500 mt-2.5">
          아래 "정규 계약 발송 대기" 목록에서 이 학생을 찾아 계약을 발송하세요.
        </div>
      )}
      {currentStep?.key === "signed" && (
        <div className="text-[12px] text-grey-500 mt-2.5">보호자 서명 대기 중입니다.</div>
      )}
      {currentStep?.key === "purchase" && (
        <div className="text-[12px] text-grey-500 mt-2.5">보호자의 정규상품 구매 대기 중입니다.</div>
      )}
      {currentStep?.key === "subject_active" && (
        <div className="text-[12px] text-grey-500 mt-2.5">
          구매가 완료됐습니다 — 과목 수강 관리(매칭) 패널의 "활성화" 버튼으로 마무리하세요.
        </div>
      )}
      {!currentStep && pipeline && <div className="text-[12px] text-green mt-2.5">모든 단계가 완료됐습니다.</div>}
    </div>
  );
}

function waitingMessage(key: string): string {
  switch (key) {
    case "trial_consent":
      return "보호자 행동 대기 중 — 온보딩 화면에서 Smart Notes 동의를 완료하면 체험수업권이 자동 지급됩니다.";
    case "trial_entitlement":
      return "체험수업권 지급 처리 중입니다. 잠시 후 다시 확인해주세요.";
    case "trial_booking":
      return "보호자·학생 행동 대기 중 — 배정된 선생님의 가능 시간으로 체험 수업을 예약하면 진행됩니다.";
    case "smart_notes":
      return "Smart Notes 연결 대기 중 — Google Calendar/Meet 연동이 끝나면 자동으로 연결됩니다. 오래 걸리면 아래 Google 연동 재처리 항목을 확인하세요.";
    case "review":
      return "선생님 행동 대기 중 — 체험 수업 완료 후 선생님이 리뷰를 확정하면 진행됩니다.";
    case "regular_intent":
      return "보호자 행동 대기 중 — 확정된 리뷰를 본 보호자가 정규 진행 희망을 표시하면 진행됩니다.";
    default:
      return "";
  }
}

function TrialLinkForm({
  consultationId,
  open,
  reissue,
  onOpen,
  onIssued,
}: {
  consultationId: string;
  open: boolean;
  reissue: boolean;
  onOpen: () => void;
  onIssued: (r: SendTrialOnboardingNoticeResult) => void;
}) {
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentGrade, setStudentGrade] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={onOpen}
        className="text-[12px] font-bold px-3 py-1.5 mt-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
      >
        {reissue ? "체험 온보딩 안내 재발송" : "체험 온보딩 안내 발송"}
      </button>
    );
  }

  return (
    <div className="mt-2.5 space-y-1.5">
      <label className="block text-[11px] font-semibold text-grey-500">
        보호자 이메일
        <input
          className="w-full mt-0.5 border border-grey-300 rounded px-2 py-1.5 text-[12.5px]"
          value={guardianEmail}
          onChange={(e) => setGuardianEmail(e.target.value)}
        />
      </label>
      <label className="block text-[11px] font-semibold text-grey-500">
        보호자 이름
        <input
          className="w-full mt-0.5 border border-grey-300 rounded px-2 py-1.5 text-[12.5px]"
          value={guardianName}
          onChange={(e) => setGuardianName(e.target.value)}
        />
      </label>
      <label className="block text-[11px] font-semibold text-grey-500">
        학생 이름
        <input
          className="w-full mt-0.5 border border-grey-300 rounded px-2 py-1.5 text-[12.5px]"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
        />
      </label>
      <label className="block text-[11px] font-semibold text-grey-500">
        학생 이메일
        <input
          className="w-full mt-0.5 border border-grey-300 rounded px-2 py-1.5 text-[12.5px]"
          value={studentEmail}
          onChange={(e) => setStudentEmail(e.target.value)}
        />
      </label>
      <label className="block text-[11px] font-semibold text-grey-500">
        학년(선택)
        <input
          className="w-full mt-0.5 border border-grey-300 rounded px-2 py-1.5 text-[12.5px]"
          value={studentGrade}
          onChange={(e) => setStudentGrade(e.target.value)}
        />
      </label>
      {error && <div className="text-[11.5px] text-red">{error}</div>}
      <button
        disabled={busy || !guardianEmail || !guardianName || !studentName || !studentEmail}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const result = await sendTrialOnboardingNoticeAction({
              consultationId,
              guardianEmail,
              guardianName,
              studentName,
              studentEmail,
              studentGrade: studentGrade || undefined,
            });
            if (result.status === "failed") {
              setError(`발송 실패(관리자 조치 필요) — ${result.error}`);
            } else {
              onIssued(result);
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
          setBusy(false);
        }}
        className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
      >
        {busy ? "발송 중..." : reissue ? "안내 재발송" : "안내 발송"}
      </button>
    </div>
  );
}

function TrialAssignmentForm({
  childId,
  open,
  onOpen,
  onDone,
}: {
  childId: string;
  open: boolean;
  onOpen: () => void;
  onDone: () => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={onOpen}
        className="text-[12px] font-bold px-3 py-1.5 mt-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
      >
        과목 수강 + 선생님 배정
      </button>
    );
  }

  return (
    <div className="mt-2.5 space-y-1.5">
      <label className="block text-[11px] font-semibold text-grey-500">
        과목 ID
        <input
          className="w-full mt-0.5 border border-grey-300 rounded px-2 py-1.5 text-[12.5px]"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        />
      </label>
      <label className="block text-[11px] font-semibold text-grey-500">
        선생님 ID
        <input
          className="w-full mt-0.5 border border-grey-300 rounded px-2 py-1.5 text-[12.5px]"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
        />
      </label>
      {error && <div className="text-[11.5px] text-red">{error}</div>}
      <button
        disabled={busy || !subjectId || !teacherId}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await planTrialSubjectAndAssignTeacherAction({
              childId,
              subjectId,
              teacherId,
              effectiveFrom: new Date().toISOString(),
            });
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
          setBusy(false);
        }}
        className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
      >
        {busy ? "배정 중..." : "배정 확정"}
      </button>
    </div>
  );
}

function RegularContractRow({
  item,
  onSent,
}: {
  item: RegularConversionCandidate;
  onSent: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [approverTitle, setApproverTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { status: "sent" | "already_sent"; envelopeId: string; at: string } | { status: "failed"; error: string } | null
  >(null);

  // 로컬 result만 보면 새로고침 후 이미 발송된 계약도 버튼이 "정규 계약 발송"으로
  // 되돌아가 재발송을 유도한다(TrialConversionPanel에서 겪은 것과 같은 종류의
  // 문제) — item.latestVersionHasEnvelope(최신 active 버전에 실제 envelope가
  // 있는지)로 판단한다. contracts.status(계약 전체 상태)는 쓰지 않는다 — 재발송으로
  // 새 버전을 만들면 이전 버전 완료로 인해 계약 상태 자체는 여전히 'active'로
  // 남아있어, 새 버전이 미발송인데도 "이미 발송됨"으로 잘못 표시되는 버그가 있었다.
  const isSent =
    result?.status === "sent" || result?.status === "already_sent" || (!result && item.latestVersionHasEnvelope);
  const canSend = !!item.guardianEmail && !!item.guardianName;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
      <div className="text-[13.5px] font-bold text-ink">
        {item.childName} · {item.subjectName ?? "-"}
      </div>
      <div className="text-[12px] text-grey-500 mt-0.5">
        보호자: {item.guardianName ?? "확인 필요"} ({item.guardianEmail ?? "이메일 없음"})
      </div>
      {!canSend && (
        <div className="text-[11.5px] text-red mt-1">
          발송 차단 — 보호자 이메일/이름을 확인할 수 없습니다(계정 연결 상태를 다시 확인하세요).
        </div>
      )}

      {result?.status === "failed" && (
        <div className="text-[12px] text-red mt-2 bg-red/5 rounded-lg px-3 py-2">
          발송 실패 — 관리자 조치 필요. 계약은 그대로 보관돼 있어 아래 버튼으로 안전하게
          다시 시도할 수 있습니다.
          <div className="mt-1 font-mono text-[11px] break-all">{result.error}</div>
        </div>
      )}
      {isSent && (
        <div className="text-[12px] text-ink mt-2 bg-grey-100 rounded-lg px-3 py-2">
          {result?.status === "sent"
            ? `발송 완료 — 수신자 ${item.guardianEmail} · 발송 시각 ${new Date(result.at).toLocaleString("ko-KR")} · 상태: 서명 대기`
            : `이미 발송됨 — 수신자 ${item.guardianEmail} · 상태: 서명 대기`}
        </div>
      )}

      {!confirming ? (
        <button
          disabled={!canSend || isSent}
          onClick={() => setConfirming(true)}
          className="text-[12px] font-bold px-3 py-1.5 mt-2.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {result?.status === "failed" ? "다시 시도" : isSent ? "발송 완료" : "회사 승인 및 계약 발송"}
        </button>
      ) : (
        <div className="mt-2.5 bg-grey-50 rounded-lg px-3.5 py-3">
          <p className="text-[12px] text-ink mb-2">
            확인 버튼을 누르면 <b>회사가 이 계약 버전을 전자승인한 기록(계약 주체·승인자·직함·승인
            일시·문서 식별값)이 계약서에 삽입된 뒤 DocuSign으로 발송</b>됩니다. 도장 이미지나
            DocuSign 전자서명이 아니라 인증된 관리자의 승인 기록입니다. 수신자: <b>{item.guardianEmail}</b>
          </p>
          <label className="block text-[11px] font-semibold text-grey-500 mb-2">
            승인자 직함(계약서에 그대로 인쇄됩니다)
            <input
              className="w-full mt-0.5 border border-grey-300 rounded px-2 py-1.5 text-[12.5px]"
              value={approverTitle}
              onChange={(e) => setApproverTitle(e.target.value)}
              placeholder="예: CEO, 운영팀장"
            />
          </label>
          <div className="flex gap-2">
            <button
              disabled={busy || !approverTitle.trim()}
              aria-busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const outcome = await sendRegularContractOneClickAction({
                    childId: item.childId,
                    subjectEnrollmentId: item.subjectEnrollmentId,
                    guardianEmail: item.guardianEmail!,
                    guardianName: item.guardianName!,
                    childName: item.childName,
                    approverTitle: approverTitle.trim(),
                  });
                  if (outcome.status === "failed") {
                    setResult({ status: "failed", error: outcome.error });
                  } else {
                    setResult({ status: outcome.status, envelopeId: outcome.envelopeId, at: new Date().toISOString() });
                  }
                } finally {
                  setBusy(false);
                  setConfirming(false);
                  onSent();
                }
              }}
              className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
            >
              {busy ? "발송 처리 중..." : "확인 — 회사 승인 및 발송 실행"}
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="text-[12px] font-semibold px-3.5 py-1.5 rounded-lg text-grey-500"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
