"use client";

import { useEffect, useState } from "react";
import type { SubjectEnrollmentView } from "./enrollment-data";
import { getTrialLessonReviewForFamily } from "@/app/parent/trial-conversion-actions";
import CurriculumOverlayView from "./CurriculumOverlayView";

// M4 UI 폴리싱 — 확정된 체험 리뷰만 노출한다(초안·Smart Notes 원본·Drive 링크·
// 내부 메모는 이 함수 자체가 반환하지 않으므로 화면에서 실수로 보여줄 수도 없다).
// 학생/보호자 공용 — 학생 화면에는 "정규 진행 희망" 버튼을 붙이지 않는다(그건
// app/parent/TrialConversionPanel.tsx의 역할).
function TrialReviewDisplay({ subjectEnrollmentId }: { subjectEnrollmentId: string }) {
  const [review, setReview] = useState<
    Awaited<ReturnType<typeof getTrialLessonReviewForFamily>> | undefined
  >(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getTrialLessonReviewForFamily(subjectEnrollmentId)
      .then(setReview)
      .catch(() => setReview(null));
  }, [subjectEnrollmentId]);

  if (!review) return null;

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[12px] font-semibold text-blue"
      >
        {open ? "리뷰 닫기" : "체험 수업 리뷰 보기"}
      </button>
      {open && (
        <div className="mt-2 bg-grey-50 rounded-lg px-3 py-2.5 border border-grey-200">
          <div className="text-[11.5px] font-bold text-grey-500 mb-1">체험 수업 리뷰 (선생님 확정)</div>
          {review.categoryNotes.map((c) => (
            <div key={c.key} className="mb-1.5">
              <div className="text-[10.5px] font-bold text-grey-400">{c.label}</div>
              <p className="text-[12.5px] text-ink whitespace-pre-wrap">{c.note}</p>
            </div>
          ))}
          <p className="text-[12.5px] text-ink whitespace-pre-wrap">{review.finalText}</p>
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<SubjectEnrollmentView["status"], string> = {
  planned: "예정",
  active: "수강중",
  paused: "일시중지",
  ended: "종료",
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function EnrollmentTab({
  enrollments,
}: {
  enrollments: SubjectEnrollmentView[];
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

  if (openCurriculum) {
    return (
      <CurriculumOverlayView
        subjectEnrollmentId={openCurriculum.enrollmentId}
        subjectName={openCurriculum.subjectName}
        onBack={() => setOpenCurriculum(null)}
      />
    );
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
        수강 과목
      </h1>
      <p className="text-[13px] text-grey-500 mb-5">
        현재 수강 중인 과목과 담당 선생님, 예정된 선생님 변경 일정을 확인할 수
        있습니다.
      </p>

      {enrollments.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          등록된 과목 수강이 없습니다.
        </div>
      ) : (
        enrollments.map((e) => (
          <div
            key={e.id}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[14px] font-bold text-ink">
                {e.subjectName}
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-grey-100 text-grey-500">
                {STATUS_LABEL[e.status]}
              </span>
            </div>

            <div className="text-[13px] text-ink mb-1">
              담당 선생님:{" "}
              <span className="font-semibold">
                {e.currentTeacher ? e.currentTeacher.teacherName : "배정 전"}
              </span>
            </div>
            {e.currentTeacher && (
              <div className="text-[12px] text-grey-500">
                {formatDate(e.currentTeacher.effectiveFrom)}부터
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

            <TrialReviewDisplay subjectEnrollmentId={e.id} />

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
