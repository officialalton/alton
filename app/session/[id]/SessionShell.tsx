"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  computeSessionViewState,
  type SessionViewState,
  type SessionViewViewer,
} from "@/lib/session-view";
import MaterialTab from "./MaterialTab";
import type { MaterialData } from "./material-data";
import VocabTab from "./VocabTab";
import type { VocabEntry } from "./vocab-data";
import HomeworkTab from "./HomeworkTab";
import type { HomeworkItem } from "./homework-data";
import AigenTab from "./AigenTab";

const TABS = [
  { id: "material", label: "교재", teacherOnly: false },
  { id: "homework", label: "과제", teacherOnly: false },
  { id: "aigen", label: "문제 생성", teacherOnly: true },
  { id: "log", label: "문제 기록", teacherOnly: false },
  { id: "vocab", label: "단어장", teacherOnly: false },
  { id: "docs", label: "연습장", teacherOnly: false },
  { id: "files", label: "보충 자료", teacherOnly: false },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DEFAULT_TAB: TabId = "homework";

const VIEWER_LABEL: Record<SessionViewViewer, string> = {
  student: "학생",
  teacher: "선생님",
  parent: "학부모 (읽기전용)",
  admin: "관리자 (읽기전용)",
};

export default function SessionShell({
  sessionId,
  studentId,
  unitTitle,
  subjectName,
  studentName,
  sessionNumber,
  viewerRole,
  initialTab,
  initialState,
  status,
  scheduledAt,
  durationMinutes,
  backHref,
  material,
  vocabWords,
  homeworkItems,
  subjectId,
  unitOptions,
}: {
  sessionId: string;
  studentId: string;
  unitTitle: string;
  subjectName: string;
  studentName: string;
  sessionNumber: number;
  viewerRole: SessionViewViewer;
  initialTab?: string;
  initialState: SessionViewState;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number;
  backHref: string;
  material: MaterialData;
  vocabWords: VocabEntry[];
  homeworkItems: HomeworkItem[];
  subjectId: string;
  unitOptions: string[];
}) {
  const router = useRouter();
  const isTeacher = viewerRole === "teacher";

  const validTabs = useMemo(
    () => TABS.filter((t) => !t.teacherOnly || isTeacher),
    [isTeacher]
  );
  const [activeTab, setActiveTab] = useState<TabId>(
    validTabs.some((t) => t.id === initialTab) ? (initialTab as TabId) : DEFAULT_TAB
  );

  const [state, setState] = useState(initialState);
  const [tipsVisible, setTipsVisible] = useState(true);
  const [homeworkList, setHomeworkList] = useState(homeworkItems);

  // 상태(prep/live/completed)를 주기적으로 재계산 — 시작/종료 시각이 지나면
  // 새로고침 없이도 상태바가 자동으로 전환되게 한다.
  useEffect(() => {
    if (status !== "upcoming") return;
    const timer = setInterval(() => {
      setState(computeSessionViewState(status, scheduledAt, durationMinutes));
    }, 30_000);
    return () => clearInterval(timer);
  }, [status, scheduledAt, durationMinutes]);

  function selectTab(tabId: TabId) {
    setActiveTab(tabId);
    router.replace(`?tab=${tabId}`, { scroll: false });
  }

  const scheduledLabel = useMemo(
    () => formatKoreanDateTime(scheduledAt),
    [scheduledAt]
  );
  const endLabel = useMemo(() => {
    if (!scheduledAt) return null;
    const end = new Date(
      new Date(scheduledAt).getTime() + durationMinutes * 60_000
    );
    return formatKoreanTime(end);
  }, [scheduledAt, durationMinutes]);

  return (
    <div className="min-h-screen bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-grey-200 px-6 py-3 flex-wrap">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(backHref)}
            className="text-[13px] text-grey-500 font-semibold whitespace-nowrap"
          >
            ← 나가기
          </button>
          <div>
            <div className="text-[15px] font-bold text-ink">{unitTitle}</div>
            <div className="text-[12.5px] text-grey-500">
              {subjectName} · {studentName} · {sessionNumber}회차
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {validTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={
                "text-[13.5px] font-semibold " +
                (activeTab === tab.id ? "text-ink" : "text-grey-500")
              }
            >
              {tab.id === "vocab" && isTeacher
                ? `${studentName} 학생의 단어장`
                : tab.label}
            </button>
          ))}
          {isTeacher && activeTab === "material" && (
            <button
              onClick={() => setTipsVisible((v) => !v)}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-grey-200"
            >
              💡 티칭 팁 {tipsVisible ? "숨기기" : "보기"}
            </button>
          )}
          <span className="text-[12px] font-bold px-3.5 py-1.5 rounded-full bg-ink text-white whitespace-nowrap">
            {VIEWER_LABEL[viewerRole]}
          </span>
        </div>
      </div>

      <StatusBar
        state={state}
        viewerRole={viewerRole}
        scheduledLabel={scheduledLabel}
        endLabel={endLabel}
      />

      {activeTab === "material" ? (
        <MaterialTab
          sessionId={sessionId}
          studentId={studentId}
          material={material}
          viewerRole={viewerRole}
          tipsVisible={tipsVisible}
        />
      ) : activeTab === "vocab" ? (
        <VocabTab
          initialWords={vocabWords}
          isTeacher={isTeacher}
          canManage={viewerRole === "student"}
          studentName={studentName}
        />
      ) : activeTab === "homework" ? (
        <HomeworkTab
          sessionId={sessionId}
          initialItems={homeworkList}
          viewerRole={viewerRole}
        />
      ) : activeTab === "aigen" && isTeacher ? (
        <AigenTab
          sessionId={sessionId}
          subjectId={subjectId}
          subjectName={subjectName}
          unitOptions={unitOptions}
          onFinalized={(items) =>
            setHomeworkList((prev) => [...prev, ...items])
          }
        />
      ) : (
        <div className="p-8 text-[14px] text-grey-500">
          {validTabs.find((t) => t.id === activeTab)?.label} 탭은 준비 중입니다.
        </div>
      )}
    </div>
  );
}

function StatusBar({
  state,
  viewerRole,
  scheduledLabel,
  endLabel,
}: {
  state: SessionViewState;
  viewerRole: SessionViewViewer;
  scheduledLabel: string | null;
  endLabel: string | null;
}) {
  if (state === "live") {
    return (
      <div className="flex items-center justify-between gap-4 px-6 py-2.5 bg-green-bg text-[13.5px] flex-wrap">
        <span>
          🟢 <b>Zoom 연결됨</b>
          {endLabel ? ` · 종료 예정 ${endLabel}` : ""}
        </span>
        <span className="flex items-center gap-4">
          {viewerRole === "student" && (
            <button
              onClick={() =>
                alert("노쇼가 접수되었습니다. 관리자에게 알림이 전송됩니다.")
              }
              className="text-red font-semibold"
            >
              선생님이 안 보이시나요? (노쇼 알림)
            </button>
          )}
          {viewerRole === "teacher" && (
            <button
              onClick={() => {
                if (confirm("수업을 종료하시겠습니까?")) {
                  alert(
                    "수업이 종료되었습니다. 리뷰 작성 화면으로 이동합니다."
                  );
                }
              }}
              className="bg-red text-white font-bold text-[13px] px-4 py-1.5 rounded-md"
            >
              수업 종료
            </button>
          )}
        </span>
      </div>
    );
  }

  if (state === "completed") {
    return (
      <div className="px-6 py-2.5 bg-grey-100 text-[13.5px]">
        ✅ <b>완료된 수업</b>입니다
      </div>
    );
  }

  return (
    <div className="px-6 py-2.5 bg-yellow-bg text-[13.5px]">
      🗓 <b>수업 준비 중</b>
      {scheduledLabel ? ` · ${scheduledLabel} 예정` : ""}
    </div>
  );
}

function formatKoreanDateTime(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function formatKoreanTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
