// AI 에세이 채점을 지원하는 AP 과목(플래그 AI_ESSAY_GRADING_ENABLED 와 별개로 과목 조건만 판단).
export const ESSAY_GRADING_SUBJECTS = ["ap_english_language", "ap_english_literature", "ap_us_history", "ap_world_history"] as const;
/** 준비만 끝난 과목(루브릭·프롬프트는 있으나 공식 채점 예시 보정 미통과). 보정 합격·오너 승인 뒤에만 아래 상수를 true 로 바꾼다(계획서 docs/ap/europeanhistory-essay-grading-plan.md §6). */
export const EURO_ESSAY_GRADING_VALIDATED: boolean = false;
export const ESSAY_GRADING_PREPARED_SUBJECTS = ["ap_european_history"] as const;
export const essayGradingSubject = (subject: string | null | undefined): boolean =>
  !!subject && ((ESSAY_GRADING_SUBJECTS as readonly string[]).includes(subject) || (subject === "ap_european_history" && EURO_ESSAY_GRADING_VALIDATED));

/** 학생 결과 화면용 안내 문구 — 서술형이 있는데 이 과목 AI 채점이 제공되지 않을 때. */
export const ESSAY_NOT_AVAILABLE_NOTICE = "AI essay scoring is not available for this subject yet. Your written responses are not scored; use the reference answers and scoring guides below to review them.";
export const essayScoringNotice = (subject: string | null | undefined): string | null => (!!subject && (ESSAY_GRADING_PREPARED_SUBJECTS as readonly string[]).includes(subject) && !essayGradingSubject(subject) ? ESSAY_NOT_AVAILABLE_NOTICE : null);
