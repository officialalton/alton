"use client";

// 2026-09-29(관리자 Messenger 통합) — 기존 Inquiries 탭의 문의함(household_messages)을
// Messenger 탭의 '가족' 채널로 옮겼다. 동작·권한·데이터는 그대로.

import { useState } from "react";
import {
  listInquiryThreadsForAdmin,
  sendAdminInquiryMessage,
  closeHouseholdInquiry,
  markHouseholdMessengerReadByAdmin,
  type AdminInquiryThread,
} from "./inquiry-and-meeting-actions";
import { useTabCachedData } from "./use-tab-cached-data";
import PillSubTabs from "@/app/components/PillSubTabs";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtIntl } from "@/lib/format-datetime";

// 문의함은 SSR(initialThreads)로 최초 진입을 채우고, 재진입은 TTL 30초 캐시를 쓴다.
const INQUIRY_TTL_MS = 30_000;

function formatDateTime(iso: string | null, tz: string): string {
  if (!iso) return "-";
  return fmtIntl(new Date(iso), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }, tz);
}

function InquiryThreadSkeleton() {
  return (
    <div data-testid="inquiry-inbox-skeleton">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-32 bg-grey-200 rounded" />
            <div className="h-6 w-12 bg-grey-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 가족 채널 데이터. MessengerTab이 서브탭 배지(안읽음 수)에도 쓰므로 여기서 한 번만 구독한다. */
export function useFamilyInquiryThreads(initialThreads?: AdminInquiryThread[]) {
  return useTabCachedData<AdminInquiryThread[]>({
    cacheKey: "inquiry-inbox",
    ttlMs: INQUIRY_TTL_MS,
    seedData: initialThreads,
    fetcher: listInquiryThreadsForAdmin,
  });
}

export function FamilyMessengerPanel({
  data: threads,
  error: fetchError,
  refresh,
  refreshing,
}: ReturnType<typeof useFamilyInquiryThreads>) {
  const tz = useViewerTimezone();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [openInquiryId, setOpenInquiryId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed">("open");
  const error = mutationError ?? fetchError;

  if (threads === null) return <InquiryThreadSkeleton />;

  // 2026-09-22(사용자 지시) — household 전체 스레드가 아니라 문의(inquiry) 단위 카드.
  // 관리자가 종료하면 그 문의는 "지난 문의"로 넘어가 읽기 전용 내역이 된다.
  const visible = threads.filter((t) => t.status === statusFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <PillSubTabs
          items={[
            { id: "open", label: "진행 중 문의" },
            { id: "closed", label: "지난 문의" },
          ]}
          activeId={statusFilter}
          onSelect={setStatusFilter}
        />
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-[12px] font-bold text-ink underline disabled:opacity-50"
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>
      {error && <p className="text-[12px] text-red mb-3">{error}</p>}
      {visible.length === 0 && (
        <p className="text-[13px] text-grey-500">{statusFilter === "open" ? "진행 중인 문의가 없습니다." : "지난 문의가 없습니다."}</p>
      )}
      {visible.map((t) => (
        <div key={t.inquiryId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13.5px] font-bold text-ink">
              {t.householdLabel}
              {t.unreadForAdmin && <span className="ml-1.5 text-[11px] font-bold text-white bg-red rounded-full px-1.5 py-0.5">안읽음</span>}
            </span>
            <button
              className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
              onClick={() => {
                const opening = openInquiryId !== t.inquiryId;
                setOpenInquiryId(opening ? t.inquiryId : null);
                if (opening) {
                  markHouseholdMessengerReadByAdmin(t.householdId)
                    .then(refresh)
                    .catch(() => {});
                }
              }}
            >
              {openInquiryId === t.inquiryId ? "닫기" : "열기"}
            </button>
          </div>
          {openInquiryId === t.inquiryId && (
            <div>
              <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
                {t.messages.map((m) => (
                  <div
                    key={m.id}
                    className={"rounded-lg px-3 py-2 text-[12.5px] max-w-[85%] " + (m.senderRole === "admin" ? "bg-ink text-white ml-auto" : "bg-grey-100 text-ink")}
                  >
                    <div>{m.body}</div>
                    <div className={"text-[10.5px] mt-1 " + (m.senderRole === "admin" ? "text-white/70" : "text-grey-500")}>
                      {m.senderRole === "admin" ? "관리자" : "보호자"} · {formatDateTime(m.createdAt, tz)}
                    </div>
                  </div>
                ))}
              </div>
              {t.status === "open" ? (
                <>
                  <div className="flex gap-2 mb-2">
                    <textarea
                      aria-label="답장 내용"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="답장 내용을 입력해주세요"
                      className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[54px]"
                    />
                    <button
                      disabled={busy || !reply.trim()}
                      className="px-4 py-2 rounded-lg bg-ink text-white text-[13px] font-bold disabled:opacity-50 self-end"
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await sendAdminInquiryMessage(t.inquiryId, t.householdId, reply);
                          setReply("");
                          refresh();
                        } catch (e) {
                          setMutationError(e instanceof Error ? e.message : "전송에 실패했습니다.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      답장
                    </button>
                  </div>
                  <button
                    disabled={busy}
                    className="text-[12px] font-bold text-ink underline"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await closeHouseholdInquiry(t.inquiryId);
                        refresh();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    문의 종료
                  </button>
                </>
              ) : (
                <p className="text-[12px] font-bold text-grey-500">종료된 문의입니다(읽기 전용).</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
