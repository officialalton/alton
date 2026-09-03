"use client";

// M4 (2/N) — 관리자용 상담→체험→정규 전환 파이프라인 화면. 온보딩 링크 발급→
// 과목·선생님 배정→정규 계약 발송까지 이 한 패널에서 처리한다.

import { useEffect, useState } from "react";
import {
  confirmTrialIntentAction,
  createTrialOnboardingLinkAction,
  listTrialOnboardingCandidatesAction,
  listRegularConversionCandidatesAction,
  planTrialSubjectAndAssignTeacherAction,
  sendRegularContractOneClickAction,
  type TrialOnboardingCandidate,
  type RegularConversionCandidate,
} from "./trial-onboarding-actions";

export default function TrialOnboardingPanel() {
  const [candidates, setCandidates] = useState<TrialOnboardingCandidate[] | null>(null);
  const [conversions, setConversions] = useState<RegularConversionCandidate[] | null>(null);
  const [linkOpenId, setLinkOpenId] = useState<string | null>(null);
  const [linkResult, setLinkResult] = useState<{ linkId: string; rawToken: string } | null>(null);
  const [assignOpenId, setAssignOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      <h2 className="text-[16px] font-extrabold text-ink mb-1.5">상담 → 체험 → 정규 전환 (M4)</h2>
      <p className="text-[13px] text-grey-500 mb-5">
        관리자 추천(trial_recommended)과 보호자 본인의 체험 진행 확정을 구분해서 처리합니다.
      </p>

      {candidates.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          체험 추천된 상담이 없습니다.
        </div>
      ) : (
        candidates.map((c) => (
          <div key={c.consultationId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
            <div className="text-[13.5px] font-bold text-ink">
              {c.contactName} ({c.contactEmail})
            </div>
            <div className="text-[12px] text-grey-500 mt-0.5">
              체험 진행 확정: {c.trialIntentConfirmedAt ? "완료" : "대기"} · 계정 연결:{" "}
              {c.childId ? "완료" : "대기"}
            </div>

            {!c.trialIntentConfirmedAt && (
              <button
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await confirmTrialIntentAction(c.consultationId);
                    await refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                  setBusy(false);
                }}
                disabled={busy}
                className="text-[12px] font-bold px-3 py-1.5 mt-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
              >
                체험 진행 확정
              </button>
            )}

            {c.trialIntentConfirmedAt && !c.childId && (
              <TrialLinkForm
                consultationId={c.consultationId}
                open={linkOpenId === c.consultationId}
                onOpen={() => {
                  setLinkOpenId(c.consultationId);
                  setLinkResult(null);
                }}
                onIssued={(r) => setLinkResult(r)}
              />
            )}
            {linkOpenId === c.consultationId && linkResult && (
              <div className="text-[11.5px] text-grey-500 mt-2 break-all">
                온보딩 링크(로컬 검증용, 실제 이메일 발송 없음):
                <br />
                {`/api/trial-onboarding/redeem?token=${linkResult.rawToken}`}
              </div>
            )}

            {c.childId && (
              <TrialAssignmentForm
                childId={c.childId}
                open={assignOpenId === c.consultationId}
                onOpen={() => setAssignOpenId(c.consultationId)}
                onDone={() => setAssignOpenId(null)}
              />
            )}
          </div>
        ))
      )}

      <h3 className="text-[14px] font-extrabold text-ink mt-6 mb-1.5">정규 계약 발송 대기</h3>
      {conversions.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          정규 진행을 희망한 과목 수강이 없습니다.
        </div>
      ) : (
        conversions.map((v) => (
          <RegularContractRow key={v.subjectEnrollmentId} item={v} onSent={refresh} />
        ))
      )}

      {error && <div className="text-[12.5px] text-red-600 mt-2">{error}</div>}
    </div>
  );
}

function TrialLinkForm({
  consultationId,
  open,
  onOpen,
  onIssued,
}: {
  consultationId: string;
  open: boolean;
  onOpen: () => void;
  onIssued: (r: { linkId: string; rawToken: string }) => void;
}) {
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentGrade, setStudentGrade] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={onOpen}
        className="text-[12px] font-bold px-3 py-1.5 mt-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
      >
        온보딩 링크 발급
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <input className="w-full border border-grey-300 rounded px-2 py-1 text-[12.5px]" placeholder="보호자 이메일" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
      <input className="w-full border border-grey-300 rounded px-2 py-1 text-[12.5px]" placeholder="보호자 이름" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
      <input className="w-full border border-grey-300 rounded px-2 py-1 text-[12.5px]" placeholder="학생 이름" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
      <input className="w-full border border-grey-300 rounded px-2 py-1 text-[12.5px]" placeholder="학생 이메일" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} />
      <input className="w-full border border-grey-300 rounded px-2 py-1 text-[12.5px]" placeholder="학년(선택)" value={studentGrade} onChange={(e) => setStudentGrade(e.target.value)} />
      <button
        disabled={busy || !guardianEmail || !guardianName || !studentName || !studentEmail}
        onClick={async () => {
          setBusy(true);
          const result = await createTrialOnboardingLinkAction({
            consultationId,
            guardianEmail,
            guardianName,
            studentName,
            studentEmail,
            studentGrade: studentGrade || undefined,
          });
          onIssued(result);
          setBusy(false);
        }}
        className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
      >
        {busy ? "발급 중..." : "링크 발급"}
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
        className="text-[12px] font-bold px-3 py-1.5 mt-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
      >
        과목 수강 + 선생님 배정
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <input className="w-full border border-grey-300 rounded px-2 py-1 text-[12.5px]" placeholder="과목 ID" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} />
      <input className="w-full border border-grey-300 rounded px-2 py-1 text-[12.5px]" placeholder="선생님 ID" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} />
      {error && <div className="text-[11.5px] text-red-600">{error}</div>}
      <button
        disabled={busy || !subjectId || !teacherId}
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
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
      <div className="text-[13.5px] font-bold text-ink">
        {item.childName} · {item.subjectName ?? "-"}
      </div>
      <div className="text-[12px] text-grey-500 mt-0.5">
        계약 상태: {item.contractStatus ?? "-"} · 보호자: {item.guardianName ?? "-"} ({item.guardianEmail ?? "-"})
      </div>
      {result && <div className="text-[12px] text-grey-600 mt-1">{result}</div>}
      <button
        disabled={busy || !item.guardianEmail || !item.guardianName}
        onClick={async () => {
          setBusy(true);
          const outcome = await sendRegularContractOneClickAction({
            childId: item.childId,
            subjectEnrollmentId: item.subjectEnrollmentId,
            guardianEmail: item.guardianEmail!,
            guardianName: item.guardianName!,
            childName: item.childName,
          });
          if (outcome.status === "failed") {
            setResult(`발송 실패(재처리 가능): ${outcome.error}`);
          } else if (outcome.status === "already_sent") {
            setResult(`이미 발송됨 (envelope: ${outcome.envelopeId})`);
          } else {
            setResult(`발송 완료 (envelope: ${outcome.envelopeId})`);
          }
          setBusy(false);
          onSent();
        }}
        className="text-[12px] font-bold px-3 py-1.5 mt-2 rounded-lg bg-ink text-white disabled:opacity-50"
      >
        {busy ? "발송 중..." : "정규 계약 발송"}
      </button>
    </div>
  );
}
