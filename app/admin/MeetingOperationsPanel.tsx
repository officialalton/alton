"use client";

// R11(문의·면담) — 면담 운영(목록 + 상태 변경 + 담당 컨설턴트 배정 + 일정 확정 +
// 취소 후 재신청 + Google 재동기화). 2026-09-29: Inquiries 탭에서 Consultants 탭의
// '면담' 서브탭으로 이동했다. 면담 가능시간(가용시간) UI는 list_open_meeting_slots RPC가
// 제거되어 효과가 없으므로 삭제했다(테이블은 이력용으로 유지).

import { useEffect, useState } from "react";
import {
  loadMeetingOperationsDashboardAction,
  updateMeetingRequestStatus,
  scheduleMeetingRequest,
  assignMeetingRequestConsultant,
  cancelAndRerequestMeetingRequest,
  resyncMeetingRequestCalendar,
} from "./inquiry-and-meeting-actions";
import MeetingRequestReviewPanel from "./MeetingRequestReviewPanel";
import { useTabCachedData } from "./use-tab-cached-data";
import { fmtIntl } from "@/lib/format-datetime";

const INQUIRY_TTL_MS = 30_000;
export const NEEDS_ACTION = new Set(["requested", "confirming", "scheduling"]);

const MEETING_STATUS_LABEL: Record<string, string> = {
  requested: "신청됨",
  confirming: "확인 중",
  scheduling: "일정 조율 중",
  scheduled: "일정 확정",
  completed: "완료",
  cancelled: "취소",
};
const MEETING_STATUS_ORDER = ["requested", "confirming", "scheduling", "scheduled", "completed"] as const;
const CONTACT_PREFERENCE_LABEL: Record<string, string> = {
  phone: "전화",
  message: "메시지",
  either: "둘 다 가능",
};

type MeetingTransitionTarget = "confirming" | "scheduling" | "scheduled" | "completed";

function nextMeetingStatus(status: string): MeetingTransitionTarget | null {
  const idx = MEETING_STATUS_ORDER.indexOf(status as (typeof MEETING_STATUS_ORDER)[number]);
  if (idx === -1 || idx === MEETING_STATUS_ORDER.length - 1) return null;
  return MEETING_STATUS_ORDER[idx + 1] as MeetingTransitionTarget;
}

// datetime-local(<input type="datetime-local">) 문자열("YYYY-MM-DDTHH:mm")을
// KST 기준 ISO로 만든다. 서버 액션(scheduleMeetingRequest)이 그대로 Date로
// 파싱하므로, 타임존 미표기 문자열이 브라우저 로컬이 아니라 KST로 해석되게
// 여기서 오프셋을 명시한다.
function kstLocalToIso(value: string): string {
  return `${value}:00+09:00`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return fmtIntl(new Date(iso), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function MeetingOperationsSkeleton() {
  return (
    <div data-testid="meeting-operations-skeleton">
      <h3 className="text-[13.5px] font-extrabold text-ink mb-2">면담 요청 목록</h3>
      {[0, 1].map((i) => (
        <div key={i} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3 animate-pulse">
          <div className="h-3.5 w-40 bg-grey-200 rounded mb-2" />
          <div className="h-3 w-56 bg-grey-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function MeetingOperationsPanel({ onNeedsActionCount }: { onNeedsActionCount?: (n: number) => void }) {
  // 2026-09-10(P1 재진입 성능 배치) — "면담 운영" 서브탭은 SSR 시딩 없이
  // (기본 서브탭이 아니므로) 처음 열 때만 조회하되, 이후 재진입은 TTL
  // 캐시(30초)로 직전 데이터를 즉시 보여주고 백그라운드로 갱신한다.
  const {
    data: dashboard,
    error: fetchError,
    refresh,
    refreshing,
  } = useTabCachedData({
    cacheKey: "inquiry-meetings",
    ttlMs: INQUIRY_TTL_MS,
    fetcher: loadMeetingOperationsDashboardAction,
  });
  const meetings = dashboard?.requests ?? null;
  // Consultants > 면담 서브탭 배지용 — 조치가 필요한(신청됨·확인 중·일정 조율 중) 요청 수.
  useEffect(() => {
    if (meetings) onNeedsActionCount?.(meetings.filter((m) => NEEDS_ACTION.has(m.status)).length);
  }, [meetings, onNeedsActionCount]);
  const consultants = dashboard?.consultants ?? [];
  // 미팅별 담당 컨설턴트 선택값(미선택이면 제안값 → 현재 담당자 순으로 표시).
  const [assignPick, setAssignPick] = useState<Record<string, string>>({});
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // 2026-09-18 — window.prompt는 브라우저 자동화(원격 UAT 도구)에서 채울 수
  // 없고 UX도 나쁘다. 인라인 datetime-local 입력 2개로 교체한다.
  const [scheduleFormOpenId, setScheduleFormOpenId] = useState<string | null>(null);
  const [scheduleStarts, setScheduleStarts] = useState("");
  const [scheduleEnds, setScheduleEnds] = useState("");
  // 관리자 포털 정리 항목 3(2026-09-23) — 담당 컨설턴트가 있는 요청은
  // 기본적으로 컨설턴트 포털(app/consultant/meeting-actions.ts)에서 처리한다.
  // 관리자는 전체 조회는 계속 하되, "관리자 개입"을 누른 건만 상태 변경
  // 버튼을 보여준다(미배정 건은 항상 버튼이 보인다).
  const [interveningIds, setInterveningIds] = useState<Set<string>>(new Set());
  const error = mutationError ?? fetchError;

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
      refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  if (meetings === null) return <MeetingOperationsSkeleton />;

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-[12px] font-bold text-ink underline disabled:opacity-50"
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>
      {error && <p className="text-[12px] text-red mb-3">{error}</p>}

      <section className="mb-8">
        <h3 className="text-[13.5px] font-extrabold text-ink mb-2">면담 요청 목록</h3>
        {meetings.length === 0 && <p className="text-[13px] text-grey-500">면담 요청이 없습니다.</p>}
        {meetings.map((m) => {
          const isDelegated = !!m.consultantId;
          const isIntervening = interveningIds.has(m.id);
          const showActions = !isDelegated || isIntervening;
          return (
          <div key={m.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <p className="text-[13.5px] font-bold text-ink">
              {m.householdLabel}{m.childName ? ` · ${m.childName}` : ""} — {MEETING_STATUS_LABEL[m.status] ?? m.status}
            </p>
            <p className="text-[12.5px] text-grey-500 mt-1">
              {m.subject && `주제: ${m.subject} · `}희망 시간: {formatDateTime(m.startsAt)}
            </p>
            {m.content && <p className="text-[12.5px] text-grey-700 mt-1">내용: {m.content}</p>}
            {m.contactPreference && (
              <p className="text-[12.5px] text-grey-500 mt-0.5">
                희망 연락: {CONTACT_PREFERENCE_LABEL[m.contactPreference] ?? m.contactPreference}
                {m.preferredContactTime ? ` · ${m.preferredContactTime}` : ""}
              </p>
            )}
            {m.rescheduledFromId && (
              <p className="text-[11.5px] text-grey-500 mt-0.5">이전 미팅을 취소하고 다시 신청한 요청입니다. 담당 컨설턴트를 배정한 뒤 일정을 다시 확정하세요.</p>
            )}
            {(m.googleSyncStatus === "failed" || m.googleSyncStatus === "reconciliation_needed") && (
              <div className="flex items-center gap-2 mt-2 bg-grey-100 rounded-lg px-3 py-1.5" data-testid={`sync-status-${m.id}`}>
                <span className="text-[11.5px] text-red">
                  {m.googleSyncStatus === "reconciliation_needed"
                    ? `Google 동기화 실패 — 자동 재시도 중단(${m.googleSyncRetryCount}/5회), 확인이 필요합니다.`
                    : `Google 동기화 실패 — 자동 재시도 대기(${m.googleSyncRetryCount}/5회).`}
                  {m.googleSyncLastError ? ` 사유: ${m.googleSyncLastError}` : ""}
                </span>
                <button
                  disabled={busyId === m.id}
                  onClick={() => withBusy(m.id, async () => { await resyncMeetingRequestCalendar(m.id); })}
                  className="text-[11px] font-bold text-ink underline shrink-0 disabled:opacity-50"
                >
                  Google 재동기화
                </button>
              </div>
            )}
            {isDelegated && (
              <div className="flex items-center gap-2 mt-2 bg-grey-100 rounded-lg px-3 py-1.5">
                <span className="text-[11.5px] text-grey-500">담당 컨설턴트 {m.consultantName ?? "미상"}님이 처리 중입니다.</span>
                {!isIntervening && m.status !== "completed" && m.status !== "cancelled" && (
                  <button
                    onClick={() => setInterveningIds((prev) => new Set(prev).add(m.id))}
                    className="text-[11px] font-bold text-ink underline shrink-0"
                  >
                    관리자 개입
                  </button>
                )}
              </div>
            )}
            {(m.status === "requested" || m.status === "confirming" || m.status === "scheduling") && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <label htmlFor={`assign-${m.id}`} className="text-[11.5px] font-bold text-grey-500">담당 컨설턴트</label>
                <select
                  id={`assign-${m.id}`}
                  value={assignPick[m.id] ?? m.consultantId ?? m.suggestedConsultantId ?? ""}
                  onChange={(e) => setAssignPick((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  disabled={busyId === m.id}
                  className="text-[12px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1"
                >
                  <option value="">선택</option>
                  {consultants.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.id.slice(0, 8)}{c.id === m.suggestedConsultantId ? " (가족 담당)" : ""}
                    </option>
                  ))}
                </select>
                {(() => {
                  const picked = assignPick[m.id] ?? m.consultantId ?? m.suggestedConsultantId ?? "";
                  return (
                    <button
                      disabled={busyId === m.id || !picked || picked === m.consultantId}
                      className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                      onClick={() => withBusy(m.id, () => assignMeetingRequestConsultant({ meetingRequestId: m.id, consultantId: picked }))}
                    >
                      {m.consultantId ? "담당자 변경" : "담당자 배정"}
                    </button>
                  );
                })()}
              </div>
            )}
            {showActions && (
            <div className="flex gap-2 mt-3">
              {(() => {
                const next = nextMeetingStatus(m.status);
                if (next === "scheduled") return null;
                return (
                  next && (
                    <button
                      disabled={busyId === m.id}
                      className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                      onClick={() => withBusy(m.id, () => updateMeetingRequestStatus(m.id, next))}
                    >
                      {MEETING_STATUS_LABEL[next]}로 변경
                    </button>
                  )
                );
              })()}
              {nextMeetingStatus(m.status) === "scheduled" ? (
                // 2026-09-17/18 — "일정 확정"은 status만 바꾸는 게 아니라 유효한
                // 시간으로 실제 Calendar+Meet 이벤트를 만들어야 하므로, 여기서
                // 시간을 입력받아 scheduleMeetingRequest(가드된 서버 액션)를
                // 호출한다. 시간이 없거나 잘못되면 액션이 거부하고 상태는
                // 그대로 남는다(조용히 scheduled로 넘어가지 않음). window.prompt는
                // 자동화 도구로 채울 수 없고 UX도 나빠 인라인 폼으로 교체(2026-09-18).
                scheduleFormOpenId === m.id ? (
                  <div className="flex flex-col gap-1.5 border-[1.5px] border-grey-200 rounded-lg px-2.5 py-2">
                    <label className="text-[11px] font-semibold text-grey-500">
                      시작 시간(KST)
                      <input
                        type="datetime-local"
                        value={scheduleStarts}
                        onChange={(e) => setScheduleStarts(e.target.value)}
                        className="ml-1.5 border-[1.5px] border-grey-200 rounded px-1.5 py-0.5 text-[11.5px]"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-grey-500">
                      종료 시간(KST)
                      <input
                        type="datetime-local"
                        value={scheduleEnds}
                        onChange={(e) => setScheduleEnds(e.target.value)}
                        className="ml-1.5 border-[1.5px] border-grey-200 rounded px-1.5 py-0.5 text-[11.5px]"
                      />
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        disabled={busyId === m.id || !scheduleStarts || !scheduleEnds}
                        className="text-[11.5px] font-bold text-white bg-ink rounded-lg px-2.5 py-1 disabled:opacity-50"
                        onClick={() =>
                          withBusy(m.id, async () => {
                            await scheduleMeetingRequest({
                              meetingRequestId: m.id,
                              startsAt: kstLocalToIso(scheduleStarts),
                              endsAt: kstLocalToIso(scheduleEnds),
                            });
                            setScheduleFormOpenId(null);
                          })
                        }
                      >
                        확정
                      </button>
                      <button
                        className="text-[11.5px] font-semibold text-grey-500"
                        onClick={() => setScheduleFormOpenId(null)}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      disabled={busyId === m.id || !m.consultantId}
                      title={m.consultantId ? undefined : "먼저 담당 컨설턴트를 배정해 주세요"}
                      className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                      onClick={() => {
                        setScheduleStarts("");
                        setScheduleEnds("");
                        setScheduleFormOpenId(m.id);
                      }}
                    >
                      일정 확정(Calendar+Meet 생성)
                    </button>
                    {!m.consultantId && (
                      <span className="text-[11.5px] text-grey-500 self-center">먼저 담당 컨설턴트를 배정해 주세요</span>
                    )}
                  </>
                )
              ) : null}
              {m.status === "scheduled" && (
                <button
                  disabled={busyId === m.id}
                  title="일정을 취소(Google 일정 삭제)하고, 담당 컨설턴트·시간이 비어 있는 새 요청을 만듭니다"
                  className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                  onClick={() => withBusy(m.id, async () => { await cancelAndRerequestMeetingRequest(m.id); })}
                >
                  취소 후 재신청
                </button>
              )}
              {m.status !== "completed" && m.status !== "cancelled" && (
                <button
                  disabled={busyId === m.id}
                  className="text-[12px] font-bold text-red border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                  onClick={() => withBusy(m.id, () => updateMeetingRequestStatus(m.id, "cancelled"))}
                >
                  취소
                </button>
              )}
            </div>
            )}
            {m.status === "completed" && <MeetingRequestReviewPanel meetingRequestId={m.id} />}
          </div>
          );
        })}
      </section>
    </div>
  );
}

