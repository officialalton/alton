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
import type {
  HomeworkKeywordOption,
  SessionHomeworkStatusItem,
} from "@/app/teacher/homework-composition-data";
import ScratchpadTab from "./ScratchpadTab";
import type { DocLink } from "./scratchpad-data";
import type { CanvasStroke } from "./material-data";
import type { StrokePayload } from "./annotation-events-types";
import ProblemLogTab from "./ProblemLogTab";
import type { ProblemLogEntry } from "./problemlog-data";

// R9(Task 4) — 세션 중 신규 문제 생성 탭("문제 생성")은 여기서 제거됐다.
// AI 문제 생성은 이제 관리자 콘텐츠 에디터(app/admin/CurriculumDocEditor.tsx)
// 전용 화면이며 검수·공개된 문제만 이 세션뷰의 과제/문제 기록 탭에 나타난다
// (docs/superpowers/specs/2026-09-07-curriculum-content-session-design.md §7).
const TABS = [
  { id: "material", label: "교재", teacherOnly: false },
  { id: "homework", label: "과제", teacherOnly: false },
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
  docLinks,
  whiteboardStrokes,
  problemLog,
  writesEnabled = true,
  sessionSource,
  initialAnnotationStrokes,
  currentUserId,
  homeworkKeywordOptions = [],
  homeworkStatusItems = [],
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
  docLinks: DocLink[];
  whiteboardStrokes: CanvasStroke[];
  problemLog: ProblemLogEntry[];
  // R8 1/N — v3(sessions_v3 cutover) 세션은 canvas_annotations/homework_items/
  // vocab_words 등 필기·과제·단어장 하위 테이블이 아직 legacy_sessions만 참조한다
  // (FK 마이그레이션은 이번 라운드 범위 밖, item 3 annotation event log 별도 작업에서
  // 다룰 예정). 그 사이 v3 세션에서 저장을 시도하면 FK 위반으로 서버 액션이 깨지므로,
  // writesEnabled=false일 때 편집 컴포넌트에 읽기전용에 해당하는 viewerRole을 넘겨
  // 저장 UI 자체를 숨긴다 — DB 레벨 강제가 아니라 UI 가드임을 명시.
  writesEnabled?: boolean;
  // R9 — 화이트보드는 v3 세션에서도 session_annotation_events로 실제 쓰기가
  // 가능해졌으므로(다른 탭과 달리 FK 문제 없음), writesEnabled/contentViewerRole
  // 읽기전용 강제를 우회해 실제 viewerRole·이벤트 로그 초기 상태를 별도로 넘긴다.
  sessionSource: "legacy" | "v3";
  initialAnnotationStrokes: StrokePayload[];
  currentUserId: string;
  // R9(레슨 준비 Task 4) — v3 세션에서 과제 구성(composeHomeworkFromSession) UI가
  // 고를 수 있는 키워드 후보. legacy 세션에는 항상 빈 배열이 넘어온다(그 세션엔
  // session_content_manifest 자체가 없다).
  homeworkKeywordOptions?: HomeworkKeywordOption[];
  // Gap 2 (2026-09-08) — v3 세션에서 발급된 과제의 학생 제출 현황(읽기전용).
  // legacy 세션·student/parent 뷰어에는 항상 빈 배열이 넘어온다.
  homeworkStatusItems?: SessionHomeworkStatusItem[];
}) {
  const router = useRouter();
  const isTeacher = viewerRole === "teacher";
  const contentViewerRole: SessionViewViewer = writesEnabled ? viewerRole : "admin";

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

      {!writesEnabled && (
        <div className="px-6 py-2 text-[12.5px] text-amber-800 bg-amber-50 border-b border-amber-200">
          이 수업은 새 예약 시스템(v3) 세션입니다 — 과제·단어장 저장은 다음
          라운드에서 지원됩니다. 화이트보드는 사용 가능하며, 그 외에는 배정된
          교재 열람만 가능합니다.
        </div>
      )}
      {activeTab === "material" ? (
        <MaterialTab
          sessionId={sessionId}
          studentId={studentId}
          material={material}
          viewerRole={contentViewerRole}
          tipsVisible={tipsVisible}
        />
      ) : activeTab === "vocab" ? (
        <VocabTab
          initialWords={vocabWords}
          isTeacher={isTeacher}
          canManage={viewerRole === "student" && writesEnabled}
          studentName={studentName}
        />
      ) : activeTab === "homework" ? (
        <HomeworkTab
          sessionId={sessionId}
          initialItems={homeworkList}
          viewerRole={contentViewerRole}
          sessionSource={sessionSource}
          realViewerRole={viewerRole}
          keywordOptions={homeworkKeywordOptions}
          homeworkStatusItems={homeworkStatusItems}
        />
      ) : activeTab === "docs" ? (
        <ScratchpadTab
          sessionId={sessionId}
          viewerRole={contentViewerRole}
          initialDocLinks={docLinks}
          initialWhiteboardStrokes={whiteboardStrokes}
          sessionSource={sessionSource}
          whiteboardViewerRole={viewerRole}
          initialAnnotationStrokes={initialAnnotationStrokes}
          currentUserId={currentUserId}
        />
      ) : activeTab === "log" ? (
        <ProblemLogTab initialEntries={problemLog} viewerRole={contentViewerRole} />
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
          🟢 <b>Google Meet 연결됨</b>
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
              disabled
              title="이 화면은 아직 실제 예약 시스템과 연결되지 않았습니다(R8에서 연결 예정) — 실제 수업 종료는 '수업 일정' 탭에서 처리하세요."
              className="bg-grey-200 text-grey-500 font-bold text-[13px] px-4 py-1.5 rounded-md cursor-not-allowed"
            >
              수업 종료(R8 연결 예정)
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
