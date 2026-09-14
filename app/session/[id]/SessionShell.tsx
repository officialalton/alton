"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  computeSessionViewState,
  type SessionViewState,
  type SessionViewViewer,
} from "@/lib/session-view";
import MaterialTab from "./MaterialTab";
import ProblemsPanel from "./ProblemsPanel";
import CompositionPanel from "@/app/lesson-prep/CompositionPanel";
import type {
  KeywordProblem,
  PickableMaterial,
  UnitComposition,
} from "@/lib/unit-composition";
import type { SessionLessonContext } from "./session-context-data";
import type { MaterialData } from "./material-data";
import type { SessionProblem } from "./session-problem-data";
import VocabTab from "./VocabTab";
import type { VocabEntry } from "./vocab-data";
import HomeworkTab from "./HomeworkTab";
import type { HomeworkItem } from "./homework-data";
import type { HomeworkKeywordPool, IssuedHomeworkItem } from "./homework-v3-data";
import type { StrokePayload } from "./annotation-events-types";
import { finalizeMyLessonSession } from "@/app/teacher/lesson-schedule-actions";

// R9(Task 4) — 세션 중 신규 문제 생성 탭("문제 생성")은 여기서 제거됐다.
// AI 문제 생성은 이제 관리자 콘텐츠 에디터(app/admin/CurriculumDocEditor.tsx)
// 전용 화면이며 검수·공개된 문제만 이 세션뷰의 과제/문제 기록 탭에 나타난다
// (docs/superpowers/specs/2026-09-07-curriculum-content-session-design.md §7).
//
// 2026-09-10(UI/UX 정리 1차) — 탭 순서를 수업 중 실제 사용 순서로 재배치
// (교재 설명 → 화이트보드 필기 → 단어 확인 → 즉석 문제 → 끝나고 과제 확인).
// 아직 구현되지 않은 "보충 자료" 탭은 노출하지 않는다(백엔드 준비되면 다시 추가).
const TABS = [
  { id: "material", label: "교재", teacherOnly: false },
  // P3 4단계 — 이 수업에 고정된 문제를 읽고 푸는 화면. 문제마다 풀이판이 붙는다.
  { id: "problems", label: "문제", teacherOnly: false },
  // 2026-09-14 UAT — '연습장' 탭은 문제 아래 연습장으로 대체돼 없앴고, '문제 기록'은 학생
  // 포털에서만 본다(수업 화면에서는 필요 없다).
  { id: "vocab", label: "단어장", teacherOnly: false },
  { id: "homework", label: "과제", teacherOnly: false },
  // 4절 — 별도 준비 페이지를 없애고 준비를 수업 화면 안으로 넣는다. 선생님·관리자만
  // 보이고, 이 수업이 다루는 회차가 있을 때만 나타난다.
  { id: "prep", label: "수업 준비", teacherOnly: true },
] as const;

type TabId = (typeof TABS)[number]["id"];

// 2026-09-10(UI/UX 정리 1차): 수업에 들어오면 가장 먼저 펼치는 화면은 교재다.
const DEFAULT_TAB: TabId = "material";

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
  prep = null,
  materialNotice = null,
  initialTab,
  initialState,
  status,
  startedLive = false,
  scheduledAt,
  durationMinutes,
  backHref,
  material,
  vocabWords,
  homeworkItems,
  writesEnabled = true,
  sessionSource,
  legacyPrivateMaterialStrokes = [],
  teacherMaterialStrokes = [],
  studentMaterialStrokes = [],
  sessionProblems = [],
  lessonContext = { unitTitle: null, goal: null, supplementTitles: [], primaryUnitId: null },
  currentUserId,
  homeworkProblems = [],
  homeworkPool = [],
  homeworkIssued = [],
  homeworkKeywordPools = [],
}: {
  sessionId: string;
  studentId: string;
  unitTitle: string;
  subjectName: string;
  studentName: string;
  sessionNumber: number;
  viewerRole: SessionViewViewer;
  /**
   * 이 수업이 다루는 회차의 구성. 선생님·관리자에게만 실어 보낸다 — 학생·학부모에게
   * 구성 편집과 교사 전용 초안을 노출하지 않는다(7절).
   */
  prep?: {
    composition: UnitComposition;
    pickable: PickableMaterial[];
    problems: KeywordProblem[];
  } | null;
  /**
   * 교재 자리에 덧붙일 말. 시작·완료된 수업인데 고정된 교재가 없을 때만 채운다 —
   * 문제만 있는 수업(정상)과 고정 기록을 확인할 수 없는 수업을 구분해 말한다.
   */
  materialNotice?: string | null;
  initialTab?: string;
  initialState: SessionViewState;
  status: string;
  /** v3 수업이 이미 시작(live)됐다 — 시간 기준 판정보다 우선해 '진행 중'으로 둔다(2026-09-14). */
  startedLive?: boolean;
  scheduledAt: string | null;
  durationMinutes: number;
  backHref: string;
  material: MaterialData;
  vocabWords: VocabEntry[];
  homeworkItems: HomeworkItem[];
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
  /** 정책 변경 전 본인이 남긴 비공개 교재 필기(보존 기록). */
  legacyPrivateMaterialStrokes?: StrokePayload[];
  /** 교재의 선생님 필기 레이어. */
  teacherMaterialStrokes?: StrokePayload[];
  /** 교재의 학생 필기 레이어. */
  studentMaterialStrokes?: StrokePayload[];
  /** 수업 시작 시 고정된 문제들(고정된 버전의 내용). */
  sessionProblems?: SessionProblem[];
  /** 이 수업이 커리큘럼의 어느 회차이고 그 목표가 무엇인지. */
  lessonContext?: SessionLessonContext;
  currentUserId: string;
  // 2026-09-14 과제 v3 통일 — 과제 문제(수업 문제와 같은 패널), 교사 발급 풀·발급 목록.
  homeworkProblems?: SessionProblem[];
  homeworkPool?: KeywordProblem[];
  homeworkIssued?: IssuedHomeworkItem[];
  homeworkKeywordPools?: HomeworkKeywordPool[];
}) {
  const router = useRouter();
  const isTeacher = viewerRole === "teacher";
  const contentViewerRole: SessionViewViewer = writesEnabled ? viewerRole : "admin";

  const canPrepare = viewerRole === "teacher" || viewerRole === "admin";
  const validTabs = useMemo(
    () =>
      TABS.filter((t) => {
        // 준비 탭은 관리자도 본다(teacherOnly 는 viewerRole==="teacher"만 통과시킨다).
        // 다룰 회차가 없으면 빈 탭을 만들지 않는다.
        if (t.id === "prep") return canPrepare && Boolean(prep);
        return !t.teacherOnly || isTeacher;
      }),
    [isTeacher, canPrepare, prep]
  );
  const [activeTab, setActiveTab] = useState<TabId>(
    validTabs.some((t) => t.id === initialTab) ? (initialTab as TabId) : DEFAULT_TAB
  );

  const [state, setState] = useState(initialState);
  const [repin, setRepin] = useState<"idle" | "running" | { error: string }>("idle");
  const [tipsVisible, setTipsVisible] = useState(true);
  const [homeworkList, setHomeworkList] = useState(homeworkItems);
  const [showEndLessonConfirm, setShowEndLessonConfirm] = useState(false);
  const [endingLesson, setEndingLesson] = useState(false);
  const [endLessonError, setEndLessonError] = useState<string | null>(null);
  // 2026-09-10(UI/UX 1차 리뷰 지적) — 예정 종료 전 조기 종료는 사유를 반드시
  // 화면에서 선택하게 한다. window.confirm으로 "학생 사유"를 자동 기록하던
  // 방식을 없앤다 — "학생 사유"만 이 화면에서 완료 처리하고, 선생님 귀책·
  // 서비스 장애는 각각 기존 처리 경로로 안내만 한다(이 화면에서 finalize를
  // 호출하지 않음).
  const [earlyEndReasonChoice, setEarlyEndReasonChoice] = useState<
    "student_reason" | "teacher_fault" | "service_incident" | null
  >(null);

  // 상태(prep/live/completed)를 주기적으로 재계산 — 시작/종료 시각이 지나면
  // 새로고침 없이도 상태바가 자동으로 전환되게 한다.
  useEffect(() => {
    if (status !== "upcoming" || startedLive) return;
    const timer = setInterval(() => {
      setState(computeSessionViewState(status, scheduledAt, durationMinutes));
    }, 30_000);
    return () => clearInterval(timer);
  }, [status, scheduledAt, durationMinutes, startedLive]);

  function selectTab(tabId: TabId) {
    setActiveTab(tabId);
    router.replace(`?tab=${tabId}`, { scroll: false });
  }

  // 2026-09-10(UI/UX 정리 1차, 1차 리뷰 보완) — 세션뷰 안에서도 수업을 종료할
  // 수 있게 한다. 예정 종료 시각 전이면(조기 종료) 사유를 화면에서 먼저
  // 선택하게 하고, "학생 사유"만 이 화면에서 실제로 완료 처리한다(기존
  // finalizeMyLessonSession 로직을 그대로 재사용 — 새 종료 로직을 만들지
  // 않음). 선생님 귀책·서비스 장애는 이 화면에서 finalize를 호출하지 않고
  // 기존 경로(수업 일정 탭의 "지각 당일 연장", 관리자 장애 판정 요청)로만
  // 안내한다 — window.confirm은 쓰지 않는다.
  function isEarlyEnd(): boolean {
    if (!scheduledAt) return false;
    const end = new Date(scheduledAt).getTime() + durationMinutes * 60_000;
    return Date.now() < end;
  }

  async function handleConfirmEndLesson() {
    const early = isEarlyEnd();
    if (early && earlyEndReasonChoice !== "student_reason") {
      // 선생님 사유/서비스 장애는 안내만 하고 이 화면에서는 종료 처리하지
      // 않는다(가드 — 버튼 자체가 그 두 경우엔 노출되지 않지만 이중 확인).
      return;
    }
    setEndingLesson(true);
    setEndLessonError(null);
    try {
      const result = await finalizeMyLessonSession(
        early
          ? {
              sessionId,
              outcome: "completed",
              reason: "학생 사유 조기 종료",
              earlyEndReason: "student_reason",
            }
          : {
              sessionId,
              outcome: "completed",
              reason: "선생님 수업 종료",
            }
      );
      if (!result.ok) {
        setEndLessonError(result.error);
        return;
      }
      setShowEndLessonConfirm(false);
      setEarlyEndReasonChoice(null);
      setState("completed");
      router.refresh();
    } finally {
      setEndingLesson(false);
    }
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
          {/* P2/P3 5단계 — 학생·과목·회차·목표는 바로 아래 LessonContextHeader가
              한 번만 보여준다. 여기서 같은 내용을 또 쓰면 좁은 화면에서 두 줄이
              겹쳐 읽기 어려워진다. 상단 바에는 나가기와 탭만 남긴다. */}
          <div className="text-[13px] font-bold text-ink whitespace-nowrap">
            {sessionNumber}회차
          </div>
          {/* 2026-09-14 제품 오너 — 준비 중·예정 일시는 별도 노란 줄이 아니라 회차 옆에. */}
          {state === "prep" && (
            <span className="text-[12.5px] text-grey-500 whitespace-nowrap" data-testid="prep-schedule">
              🗓 수업 준비 중{scheduledLabel ? ` · ${scheduledLabel} 예정` : ""}
            </span>
          )}
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
        onRequestEndLesson={() => {
          setEarlyEndReasonChoice(null);
          setEndLessonError(null);
          setShowEndLessonConfirm(true);
        }}
      />

      {showEndLessonConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl px-6 py-5 max-w-[360px] w-full">
            {!isEarlyEnd() ? (
              <>
                <div className="text-[15px] font-bold text-ink mb-2">수업을 종료할까요?</div>
                <p className="text-[13px] text-grey-500 mb-4">
                  {studentName} 학생과의 수업을 지금({formatKoreanTime(new Date())}) 종료 처리합니다.
                  종료 후에는 이 수업을 다시 진행 중 상태로 되돌릴 수 없습니다.
                </p>
                {endLessonError && <p className="text-[12px] text-red mb-3">{endLessonError}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowEndLessonConfirm(false)}
                    disabled={endingLesson}
                    className="text-[13px] font-semibold text-grey-500 px-3 py-2 disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleConfirmEndLesson}
                    disabled={endingLesson}
                    className="text-[13px] font-bold text-white bg-ink px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {endingLesson ? "종료 처리 중..." : "수업 종료"}
                  </button>
                </div>
              </>
            ) : earlyEndReasonChoice === null ? (
              <>
                <div className="text-[15px] font-bold text-ink mb-2">
                  예정 종료 시각 전입니다 — 조기 종료 사유를 선택하세요
                </div>
                <p className="text-[13px] text-grey-500 mb-4">
                  {studentName} 학생과의 수업이 아직 예정 종료 시각({endLabel ?? "-"})
                  전입니다. 실제 사유에 맞는 항목을 선택해주세요.
                </p>
                <div className="flex flex-col gap-2 mb-4">
                  <button
                    onClick={() => setEarlyEndReasonChoice("student_reason")}
                    className="text-left text-[13px] font-semibold text-ink border-[1.5px] border-grey-200 rounded-lg px-3.5 py-2.5"
                  >
                    학생 사유(조퇴 등)
                  </button>
                  <button
                    onClick={() => setEarlyEndReasonChoice("teacher_fault")}
                    className="text-left text-[13px] font-semibold text-ink border-[1.5px] border-grey-200 rounded-lg px-3.5 py-2.5"
                  >
                    선생님 사유(지각 등)
                  </button>
                  <button
                    onClick={() => setEarlyEndReasonChoice("service_incident")}
                    className="text-left text-[13px] font-semibold text-ink border-[1.5px] border-grey-200 rounded-lg px-3.5 py-2.5"
                  >
                    서비스 장애(Meet 연결 등)
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowEndLessonConfirm(false)}
                    className="text-[13px] font-semibold text-grey-500 px-3 py-2"
                  >
                    취소
                  </button>
                </div>
              </>
            ) : earlyEndReasonChoice === "student_reason" ? (
              <>
                <div className="text-[15px] font-bold text-ink mb-2">학생 사유로 종료할까요?</div>
                <p className="text-[13px] text-grey-500 mb-4">
                  {studentName} 학생과의 수업을 학생 사유(조퇴 등)로 지금(
                  {formatKoreanTime(new Date())}) 종료 처리합니다. 원장에 조기 종료
                  사유가 "학생 사유"로 기록됩니다.
                </p>
                {endLessonError && <p className="text-[12px] text-red mb-3">{endLessonError}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEarlyEndReasonChoice(null)}
                    disabled={endingLesson}
                    className="text-[13px] font-semibold text-grey-500 px-3 py-2 disabled:opacity-50"
                  >
                    ← 사유 다시 선택
                  </button>
                  <button
                    onClick={handleConfirmEndLesson}
                    disabled={endingLesson}
                    className="text-[13px] font-bold text-white bg-ink px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {endingLesson ? "종료 처리 중..." : "수업 종료"}
                  </button>
                </div>
              </>
            ) : earlyEndReasonChoice === "teacher_fault" ? (
              <>
                <div className="text-[15px] font-bold text-ink mb-2">이 화면에서는 종료할 수 없어요</div>
                <p className="text-[13px] text-grey-500 mb-4">
                  선생님 귀책(지각 등)으로 일찍 끝난 경우, 이 화면이 아니라
                  "수업 일정" 탭의 "지각 당일 연장"에서 처리해주세요. 여기서는
                  수업이 종료 처리되지 않습니다.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEarlyEndReasonChoice(null)}
                    className="text-[13px] font-semibold text-grey-500 px-3 py-2"
                  >
                    ← 사유 다시 선택
                  </button>
                  <button
                    onClick={() => setShowEndLessonConfirm(false)}
                    className="text-[13px] font-bold text-white bg-ink px-4 py-2 rounded-lg"
                  >
                    확인
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-[15px] font-bold text-ink mb-2">이 화면에서는 종료할 수 없어요</div>
                <p className="text-[13px] text-grey-500 mb-4">
                  서비스 장애(Meet 연결 실패 등)로 일찍 끝난 경우, 관리자에게
                  장애 판정을 요청해주세요. 여기서는 수업이 종료 처리되지
                  않습니다.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEarlyEndReasonChoice(null)}
                    className="text-[13px] font-semibold text-grey-500 px-3 py-2"
                  >
                    ← 사유 다시 선택
                  </button>
                  <button
                    onClick={() => setShowEndLessonConfirm(false)}
                    className="text-[13px] font-bold text-white bg-ink px-4 py-2 rounded-lg"
                  >
                    확인
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "material" && materialNotice && (
        <div className="px-6 py-2.5 text-[12.5px] text-grey-500 bg-grey-100 border-b-[1.5px] border-grey-200">
          {materialNotice}
        </div>
      )}

      {activeTab === "material" ? (
        <MaterialTab
          sessionId={sessionId}
          studentId={studentId}
          material={material}
          viewerRole={contentViewerRole}
          tipsVisible={tipsVisible}
          legacyPrivateStrokes={legacyPrivateMaterialStrokes}
          teacherStrokes={teacherMaterialStrokes}
          studentStrokes={studentMaterialStrokes}
          sessionSource={sessionSource}
          annotationViewerRole={viewerRole}
          viewerUserId={currentUserId}
        />
      ) : activeTab === "problems" ? (
        <ProblemsPanel
          sessionId={sessionId}
          studentId={studentId}
          problems={sessionProblems}
          viewerRole={viewerRole}
          viewerUserId={currentUserId}
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
          studentId={studentId}
          viewerUserId={currentUserId}
          initialItems={homeworkList}
          // 2026-09-14 UAT: v3 과제 패널은 수업 문제 패널과 같은 경로(session_problem_work·문제 위 필기)로 쓰므로
          // 레거시 FK 가드(contentViewerRole → admin)를 타면 학생이 답을 고르지도, 필기하지도 못한다.
          viewerRole={sessionSource === "v3" ? viewerRole : contentViewerRole}
          sessionSource={sessionSource}
          realViewerRole={viewerRole}
          homeworkProblems={homeworkProblems}
          pool={homeworkPool}
          issued={homeworkIssued}
          keywordPools={homeworkKeywordPools}
          usedInLessonIds={sessionProblems.map((p) => p.problemId)}
        />
      ) : activeTab === "prep" ? (
        prep ? (
          <>
            {startedLive && (viewerRole === "teacher" || viewerRole === "admin") && (
              // 2026-09-14 UAT — 시작한 수업은 시작 시점 구성이 고정돼 있다(정책). 진행 중이면 선생님이
              // 명시적으로 지금 구성으로 다시 고정할 수 있다. 자동으로는 바뀌지 않는다.
              <div className="mx-8 mt-6 border-[1.5px] border-grey-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3" data-testid="repin-live">
                <p className="text-[12.5px] text-ink flex-1 min-w-[240px]">
                  이 수업은 <b>시작 시점의 구성이 고정</b>돼 있습니다. 아래에서 바꾼 교재·문제를 이 수업에 적용하려면 <b>수업 구성 변경</b>을 누르세요.
                  학생이 이미 사용한 항목·필기·답안은 남습니다.
                </p>
                <button
                  type="button"
                  disabled={repin === "running"}
                  onClick={async () => {
                    setRepin("running");
                    const { repinLiveLesson } = await import("@/app/lesson-prep/actions");
                    const r = await repinLiveLesson(sessionId);
                    if (r.ok) window.location.reload();
                    else setRepin({ error: r.error });
                  }}
                  className="text-[12.5px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
                >
                  {repin === "running" ? "바꾸는 중…" : "수업 구성 변경"}
                </button>
                {typeof repin === "object" && <p className="text-[12px] text-red w-full">{repin.error}</p>}
              </div>
            )}
          <CompositionPanel
            composition={prep.composition}
            pickable={prep.pickable}
            problems={prep.problems}
            // 시작한 수업의 내용은 시작 시점에 고정됐다. 이 탭이 보여주는 것은 그
            // 고정본이 아니라 **회차의 현재 구성**이므로, 무엇을 고치는 중이고
            // 어디에 적용되는지 말하지 않으면 고정된 수업을 고치는 것처럼 보인다.
            // 고정 시점은 하나가 아니다. 교재·문제 버전은 수업 시작에, 답안과 제출
            // 시점의 풀이 범위는 제출에 고정되고, 필기와 피드백은 별도 기록으로
            // 남는다. "전부 시작 시점에 고정"이라고 쓰면 사실과 다르다.
            scopeNotice={
              state === "prep"
                ? null
                : "이 수업은 시작 당시의 교재·문제 구성을 사용합니다. 여기서 수정하는 회차 구성은 이 수업의 콘텐츠와 필기·답안·피드백을 바꾸지 않으며, 이 회차를 쓰는 아직 시작하지 않은 수업에 적용됩니다."
            }
          />
          </>
        ) : null
      ) : null}
    </div>
  );
}

function StatusBar({
  state,
  viewerRole,
  scheduledLabel,
  endLabel,
  onRequestEndLesson,
}: {
  state: SessionViewState;
  viewerRole: SessionViewViewer;
  scheduledLabel: string | null;
  endLabel: string | null;
  onRequestEndLesson: () => void;
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
              onClick={onRequestEndLesson}
              className="bg-ink text-white font-bold text-[13px] px-4 py-1.5 rounded-md"
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

  // 준비 중은 상단 바의 회차 옆에 적는다(2026-09-14) — 여기서는 줄을 만들지 않는다.
  return null;
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
