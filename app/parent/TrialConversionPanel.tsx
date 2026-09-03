"use client";

// M4 (2/N) — 보호자가 확정된 체험 리뷰를 확인하고 "정규 진행 희망"을 표시하는
// 패널. 이 자체는 계약 체결/구매가 아니다. 확정된 리뷰가 없으면 아무것도
// 보여주지 않는다(자기 자신 fetch로 확인, subject_enrollments의 자녀별 목록을
// 받아 각 항목의 리뷰를 조회).

import { useEffect, useState } from "react";
import {
  getTrialLessonReviewForFamily,
  confirmRegularProgressIntent,
} from "./trial-conversion-actions";
import type { SubjectEnrollmentView } from "@/app/student/enrollment-data";

export default function TrialConversionPanel({ enrollments }: { enrollments: SubjectEnrollmentView[] }) {
  return (
    <>
      {enrollments.map((e) => (
        <TrialConversionRow key={e.id} subjectEnrollmentId={e.id} subjectName={e.subjectName} />
      ))}
    </>
  );
}

function TrialConversionRow({
  subjectEnrollmentId,
  subjectName,
}: {
  subjectEnrollmentId: string;
  subjectName: string;
}) {
  const [review, setReview] = useState<{ finalText: string; finalizedAt: string } | null | undefined>(undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getTrialLessonReviewForFamily(subjectEnrollmentId)
      .then(setReview)
      .catch(() => setReview(null));
  }, [subjectEnrollmentId]);

  if (!review) return null;

  return (
    <div className="mx-8 mb-3 border-[1.5px] border-grey-200 rounded-xl px-5 py-4 bg-grey-50">
      <div className="text-[12.5px] font-bold text-ink mb-1">{subjectName} — 체험 리뷰</div>
      <p className="text-[13px] text-ink whitespace-pre-wrap">{review.finalText}</p>
      {!confirmed ? (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await confirmRegularProgressIntent(subjectEnrollmentId);
            setConfirmed(true);
            setBusy(false);
          }}
          className="text-[12.5px] font-bold px-3 py-1.5 mt-2 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {busy ? "처리 중..." : "정규 진행 희망합니다"}
        </button>
      ) : (
        <div className="text-[12.5px] text-grey-500 mt-2">정규 진행 희망이 접수됐습니다. 관리자가 곧 계약을 준비합니다.</div>
      )}
    </div>
  );
}
