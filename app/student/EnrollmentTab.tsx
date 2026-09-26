"use client";

import { useEffect, useState } from "react";
import type { SubjectEnrollmentView } from "./enrollment-data";
import { getLessonReviewsForFamily, type FamilyLessonReview } from "@/app/parent/lesson-review-family-actions";
import CurriculumOverlayView from "./CurriculumOverlayView";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";

const LESSON_TYPE_LABEL: Record<FamilyLessonReview["lessonType"], string> = {
  trial: "체험",
  regular: "정규",
};

// 2026-09-17(제품 오너 피드백) — 체험 수업으로만 제한하지 않는다: 완료된 모든
// 수업(체험+정규)의 확정 리뷰를 보여준다. 초안·Smart Notes 원본·내부 메모는
// getLessonReviewsForFamily 자체가 반환하지 않으므로 화면에서 실수로 보여줄 수도
// 없다. 미팅록은 앱 안의 요약(ai_summary)과 실제 Google Meet 문서 링크
// (meetingRecordLink, Drive reader 권한이 실제로 부여된 경우에만) 둘 다 보여준다.
// 학생/보호자 공용 — 학생 화면에는 "정규 진행 희망" 버튼을 붙이지 않는다(그건
// app/parent/TrialConversionPanel.tsx의 역할).
function LessonReviewsDisplay({ subjectEnrollmentId }: { subjectEnrollmentId: string }) {
  const [reviews, setReviews] = useState<FamilyLessonReview[] | undefined>(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getLessonReviewsForFamily(subjectEnrollmentId)
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [subjectEnrollmentId]);

  if (!reviews || reviews.length === 0) return null;

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[12px] font-semibold text-blue"
      >
        {open ? "리뷰 닫기" : `수업 리뷰 보기 (${reviews.length})`}
      </button>
      {open &&
        reviews.map((review) => (
          <div key={review.reviewId} className="mt-2 bg-grey-50 rounded-lg px-3 py-2.5 border border-grey-200">
            <div className="text-[11.5px] font-bold text-grey-500 mb-1">
              {LESSON_TYPE_LABEL[review.lessonType]} 수업 리뷰 (선생님 확정)
            </div>
            {review.categoryNotes.map((c) => (
              <div key={c.key} className="mb-1.5">
                <div className="text-[10.5px] font-bold text-grey-400">{c.label}</div>
                <p className="text-[12.5px] text-ink whitespace-pre-wrap">{c.note}</p>
              </div>
            ))}
            <p className="text-[12.5px] text-ink whitespace-pre-wrap">{review.finalText}</p>

            {/* 확정된 리뷰에 한해서만 이 컴포넌트가 렌더되므로(getLessonReviewsForFamily가
                final 행만 반환) 미팅록도 항상 확정 이후 것만 노출된다. */}
            <div className="mt-2.5 pt-2.5 border-t border-grey-200">
              <div className="text-[10.5px] font-bold text-grey-400 mb-1">미팅록 요약</div>
              {review.aiSummary ? (
                <p className="text-[12.5px] text-ink whitespace-pre-wrap mb-1.5">{review.aiSummary}</p>
              ) : (
                <p className="text-[12px] text-grey-400 mb-1.5">등록된 미팅록이 없습니다.</p>
              )}
              {review.meetingRecordLink && (
                <a
                  href={review.meetingRecordLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] font-semibold text-blue underline"
                >
                  미팅록 원본 보기(열람 전용)
                </a>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

const STATUS_LABEL: Record<SubjectEnrollmentView["status"], string> = {
  planned: "예정",
  active: "수강중",
  paused: "일시중지",
  completed: "완료",
  terminated: "종료",
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 종료 상태 — "수강 종료" 서브탭. 나머지(planned/active/paused)는 "수강중".
const ENDED_STATUSES = new Set<SubjectEnrollmentView["status"]>(["completed", "terminated"]);

export default function EnrollmentTab({
  enrollments,
  childName,
}: {
  enrollments: SubjectEnrollmentView[];
  /** 학부모 포털에서 자녀가 여럿일 때, 상단 별도 제목 대신 카드 안에 소속
   * 자녀를 표시하기 위한 값(학생 포털에서는 전달하지 않음 — 항상 본인이므로). */
  childName?: string;
}) {
  // v3 커리큘럼 열람 결함 수정(2026-09-11) — 이 탭은 subject_enrollments(v3)만
  // 조회하므로(loadStudentSubjectEnrollments, enrollment-data.ts) 여기 뜨는
  // 과목은 전부 v3다. 레거시 전용 학생의 커리큘럼("수업" 탭 안 레거시 세션
  // 카드 클릭, LessonsTab.tsx)은 이 탭에 아예 나타나지 않으므로 건드리지
  // 않는다. 자녀별로 이 컴포넌트를 따로 렌더링하는 학부모 포털
  // (app/parent/EnrollmentTab.tsx)에서도 인스턴스별 로컬 상태라 자녀 간
  // 섞이지 않는다.
  const [openCurriculum, setOpenCurriculum] = useState<{
    enrollmentId: string;
    subjectName: string;
  } | null>(null);
  const [subTab, setSubTab] = useState<"active" | "ended">("active");

  if (openCurriculum) {
    return (
      <CurriculumOverlayView
        subjectEnrollmentId={openCurriculum.enrollmentId}
        subjectName={openCurriculum.subjectName}
        onBack={() => setOpenCurriculum(null)}
      />
    );
  }

  const visibleEnrollments = enrollments.filter((e) =>
    subTab === "ended" ? ENDED_STATUSES.has(e.status) : !ENDED_STATUSES.has(e.status)
  );

  return (
    <div className="max-w-[640px]">
      <UnderlineSubTabs
        className="mb-5"
        items={[
          { id: "active", label: "수강중" },
          { id: "ended", label: "수강 종료" },
        ]}
        activeId={subTab}
        onSelect={setSubTab}
      />

      {visibleEnrollments.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {subTab === "ended" ? "종료된 과목 수강이 없습니다." : "등록된 과목 수강이 없습니다."}
        </div>
      ) : (
        visibleEnrollments.map((e) => (
          <div
            key={e.id}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[14px] font-bold text-ink">
                {e.subjectName}
                {childName && (
                  <span className="ml-2 text-[11px] font-semibold text-grey-500">{childName}</span>
                )}
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-grey-100 text-grey-500">
                {STATUS_LABEL[e.status]}
              </span>
            </div>

            {/* v3 종료된 수강 담당 교사 표시 결함 수정(2026-09-11) — 활성
                매칭이 없다고 무조건 "배정 전"을 보여주면, 매칭 종료로
                담당 교사가 사라진 게 아니라 "애초에 배정된 적 없음"처럼
                읽혀 오해를 준다. 이 과목 수강 건 자체의 종료 이력
                (e.history, enrollment 단위로 이미 스코프됨 — 다른 수강
                건의 교사가 섞일 수 없다)에 마지막 교사가 있으면 그걸
                보여준다. */}
            {e.currentTeacher ? (
              <>
                <div className="text-[13px] text-ink mb-1">
                  담당 선생님: <span className="font-semibold">{e.currentTeacher.teacherName}</span>
                </div>
                <div className="text-[12px] text-grey-500">
                  {formatDate(e.currentTeacher.effectiveFrom)}부터
                </div>
              </>
            ) : e.history.length > 0 ? (
              <div className="text-[13px] text-ink mb-1">
                마지막 담당 선생님:{" "}
                <span className="font-semibold">{e.history[0].teacherName}</span>
              </div>
            ) : (
              <div className="text-[13px] text-ink mb-1">
                담당 선생님: <span className="font-semibold">배정 전</span>
              </div>
            )}

            {e.upcomingTeacherChange && (
              <div className="mt-2 text-[12px] font-semibold text-red bg-red/5 rounded-lg px-3 py-2">
                {formatDate(e.upcomingTeacherChange.effectiveFrom)}부터{" "}
                {e.upcomingTeacherChange.teacherName} 선생님으로 변경 예정
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpenCurriculum({ enrollmentId: e.id, subjectName: e.subjectName })}
              className="text-[12px] font-semibold text-blue mt-1"
            >
              커리큘럼 보기 →
            </button>

            <LessonReviewsDisplay subjectEnrollmentId={e.id} />

            {e.history.length > 0 && (
              <details className="mt-2.5">
                <summary className="text-[12px] font-semibold text-grey-500 cursor-pointer">
                  이전 선생님 변경 이력 ({e.history.length})
                </summary>
                <div className="mt-1.5 space-y-1.5">
                  {e.history.map((h) => (
                    <div
                      key={h.id}
                      className="text-[12px] text-grey-500 border-l-2 border-grey-200 pl-2.5"
                    >
                      {h.teacherName} — {formatDate(h.effectiveFrom)} ~{" "}
                      {formatDate(h.effectiveUntil)}
                      {h.reason ? ` (${h.reason})` : ""}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))
      )}
    </div>
  );
}
