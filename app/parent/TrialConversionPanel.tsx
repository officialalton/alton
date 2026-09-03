"use client";

// M4 — 보호자가 확정된 체험 리뷰를 확인한 뒤 "정규 진행 희망"을 표시하는 패널.
// 리뷰 본문 자체는 app/student/EnrollmentTab.tsx(학생·보호자 공용)가 이미
// 보여주므로 여기서는 중복 표시하지 않고, "정규 진행 희망" 버튼과 그 의미
// 설명만 담당한다. 확정된 리뷰가 없으면 아무것도 보여주지 않는다(리뷰 미확정 →
// 정규 진행 선택 단계로 못 넘어감).

import { useEffect, useState } from "react";
import { getTrialLessonReviewForFamily, confirmRegularProgressIntent } from "./trial-conversion-actions";
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
  const [hasFinalReview, setHasFinalReview] = useState<boolean | undefined>(undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTrialLessonReviewForFamily(subjectEnrollmentId)
      .then((review) => setHasFinalReview(!!review))
      .catch(() => setHasFinalReview(false));
  }, [subjectEnrollmentId]);

  // 리뷰가 아직 확정되지 않았으면 이 단계 자체를 보여주지 않는다(정규 진행
  // 선택은 확정 리뷰가 있어야만 가능 — 서버에서도 같은 조건을 다시 검증한다).
  if (!hasFinalReview) return null;

  return (
    <div className="mx-8 mb-4 border-[1.5px] border-grey-200 rounded-xl px-5 py-4">
      <div className="text-[13px] font-bold text-ink mb-1">{subjectName} — 정규 수업 진행 여부</div>
      <p className="text-[12px] text-grey-500 mb-2.5">
        위 체험 리뷰를 확인하셨다면, 정규 수업 진행을 희망하시는지 알려주세요. 이 버튼을
        누르는 것은 <b>계약 체결이나 결제가 아니며</b>, 관리자에게 "계약 준비를 시작해주세요"라는
        의사를 전달할 뿐입니다. 이후 정규 계약서가 이메일로 발송되고, 보호자님께서 직접
        서명을 완료하셔야 계약이 체결됩니다.
      </p>
      {error && <div className="text-[12px] text-red mb-2">{error}</div>}
      {!confirmed ? (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await confirmRegularProgressIntent(subjectEnrollmentId);
              setConfirmed(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
            setBusy(false);
          }}
          aria-busy={busy}
          className="text-[12.5px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {busy ? "처리 중..." : "정규 진행 희망합니다"}
        </button>
      ) : (
        <div className="text-[12.5px] font-semibold text-ink bg-grey-100 rounded-lg px-3 py-2">
          접수 완료 — 관리자가 확인 후 정규 계약서를 이메일로 보내드립니다. 서명을 완료하시면
          단건·10회·20회 수업권 구매로 이어집니다.
        </div>
      )}
    </div>
  );
}
