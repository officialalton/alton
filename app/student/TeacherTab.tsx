"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  TeacherListItem,
  TeacherProfileData,
  TeacherSessionHistoryItem,
} from "./teacher-data";
import type { ChatMessage } from "./chat-data";
import ChatPanel from "./ChatPanel";

type SubView =
  | { type: "list" }
  | { type: "profile"; teacherId: string }
  | { type: "chat"; teacherId: string };

export default function TeacherTab({
  teachers,
  profiles,
  sessionHistory,
  chatThreads,
}: {
  teachers: TeacherListItem[];
  profiles: Record<string, TeacherProfileData | null>;
  sessionHistory: Record<string, TeacherSessionHistoryItem[]>;
  chatThreads: Record<string, { threadId: string; messages: ChatMessage[] }>;
}) {
  const [subView, setSubView] = useState<SubView>({ type: "list" });

  if (subView.type === "chat") {
    const thread = chatThreads[subView.teacherId];
    const teacher = teachers.find((t) => t.teacherId === subView.teacherId);
    if (!thread || !teacher) return null;
    return (
      <ChatPanel
        threadId={thread.threadId}
        teacherName={teacher.name}
        initialMessages={thread.messages}
        onBack={() => setSubView({ type: "list" })}
      />
    );
  }

  if (subView.type === "profile") {
    const profile = profiles[subView.teacherId];
    if (!profile) return null;
    return (
      <ProfileView
        profile={profile}
        history={sessionHistory[subView.teacherId] ?? []}
        onBack={() => setSubView({ type: "list" })}
      />
    );
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">선생님</h1>

      {teachers.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          매칭된 선생님이 없습니다.
        </div>
      ) : (
        teachers.map((t) => (
          <div
            key={t.teacherId}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-3"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-grey-100 text-ink font-extrabold flex items-center justify-center text-[15px] shrink-0">
                {t.name.charAt(0)}
              </div>
              <div>
                <div className="text-[14.5px] font-bold text-ink">{t.name}</div>
                {t.school && (
                  <div className="text-[12px] text-grey-500">{t.school}</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3.5">
              {t.subjects.map((s) => (
                <span
                  key={s.subjectName}
                  className="text-[12px] font-semibold px-3 py-1 rounded-full bg-grey-100 text-ink"
                >
                  {s.subjectName} · {s.currentSession}/{s.totalSessions}회차
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSubView({ type: "profile", teacherId: t.teacherId })}
                className="text-[12px] font-bold px-4 py-2 rounded-lg border border-grey-200"
              >
                프로필 보기
              </button>
              <button
                onClick={() => setSubView({ type: "chat", teacherId: t.teacherId })}
                className="text-[12px] font-bold px-4 py-2 rounded-lg bg-ink text-white"
              >
                💬 메시지
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ProfileView({
  profile,
  history,
  onBack,
}: {
  profile: TeacherProfileData;
  history: TeacherSessionHistoryItem[];
  onBack: () => void;
}) {
  const router = useRouter();
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="max-w-[560px] px-8 py-8">
      <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold mb-4">
        ← 뒤로
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-grey-100 text-ink font-extrabold flex items-center justify-center text-[18px] shrink-0">
          {profile.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-[18px] font-extrabold text-ink">{profile.name}</h1>
          {profile.school && (
            <p className="text-[12.5px] text-grey-500">{profile.school}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {profile.subjects.map((s) => (
          <span
            key={s}
            className="text-[12px] font-semibold px-3 py-1 rounded-full bg-grey-100 text-ink"
          >
            {s}
          </span>
        ))}
      </div>

      {profile.bio && (
        <p className="text-[13.5px] text-ink leading-[1.6] border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-5">
          {profile.bio}
        </p>
      )}

      {!showHistory ? (
        <button
          onClick={() => setShowHistory(true)}
          className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border border-grey-200"
        >
          이 선생님과 진행한 수업 내역 보기
        </button>
      ) : history.length === 0 ? (
        <p className="text-[12.5px] text-grey-500">아직 진행한 수업이 없습니다.</p>
      ) : (
        history.map((h) => (
          <button
            key={h.sessionId}
            onClick={() => router.push(`/session/${h.sessionId}`)}
            className="w-full text-left border-[1.5px] border-grey-200 rounded-lg px-4 py-3 mb-2"
          >
            <div className="text-[12px] text-grey-500">
              {formatKoreanDateTime(h.scheduledAt)}
            </div>
            <div className="text-[13px] font-semibold text-ink">
              {h.subjectName} · {h.sessionNumber}회차
            </div>
          </button>
        ))
      )}
    </div>
  );
}

function formatKoreanDateTime(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
