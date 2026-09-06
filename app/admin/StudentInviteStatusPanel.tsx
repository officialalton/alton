"use client";

// M4 후속 — 학생 본인 비밀번호 설정 초대(보호자 대상 "체험 온보딩 안내"와는
// 별개)의 발송 성공/실패 상태를 보여주고, 실패했거나 아직 열어보지 않았으면
// 같은 계정으로 재발송할 수 있게 한다. 이미 완료(비밀번호 설정+이메일 확인)된
// 학생에게는 재발송 버튼 자체를 숨긴다.

import { useEffect, useState } from "react";
import { getStudentInviteStatusAction, resendStudentInviteAction, type StudentInviteStatus } from "./student-invite-actions";

export default function StudentInviteStatusPanel({ consultationId }: { consultationId: string }) {
  const [status, setStatus] = useState<StudentInviteStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setStatus(await getStudentInviteStatusAction(consultationId));
    } catch {
      setStatus(null);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  if (!status || !status.linkId) return null;

  return (
    <div className="mt-2.5 bg-grey-50 rounded-lg px-3.5 py-3">
      <div className="text-[11.5px] font-bold text-ink">학생 비밀번호 설정 초대</div>
      <div className="text-[11.5px] text-grey-500 mt-0.5">
        수신자: {status.studentEmail ?? "확인 필요"}
      </div>

      {status.completed ? (
        <div className="text-[11.5px] text-green mt-1.5">완료 — 학생이 이미 비밀번호 설정을 마쳤습니다.</div>
      ) : status.inviteStatus === "failed" ? (
        <div className="text-[11.5px] text-red mt-1.5">
          발송 실패{status.error ? `: ${status.error}` : ""}
        </div>
      ) : status.inviteStatus === "sent" ? (
        <div className="text-[11.5px] text-grey-500 mt-1.5">
          발송 완료{status.sentAt ? ` — ${new Date(status.sentAt).toLocaleString("ko-KR")}` : ""} · 학생 응답 대기 중
        </div>
      ) : (
        <div className="text-[11.5px] text-grey-500 mt-1.5">발송 대기 중</div>
      )}

      {error && <div className="text-[11.5px] text-red mt-1">{error}</div>}

      {!status.completed && (
        <button
          disabled={busy}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await resendStudentInviteAction(consultationId);
              await refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
            setBusy(false);
          }}
          className="text-[11.5px] font-bold px-3 py-1.5 mt-2 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          {busy ? "재발송 중..." : status.inviteStatus === "failed" ? "재발송" : "안내 재발송"}
        </button>
      )}
    </div>
  );
}
