// AI 에세이 채점을 지원하는 AP 과목(플래그 AI_ESSAY_GRADING_ENABLED 와 별개로 과목 조건만 판단).
export const ESSAY_GRADING_SUBJECTS = ["ap_english_language", "ap_english_literature", "ap_us_history", "ap_world_history"] as const;
export const essayGradingSubject = (subject: string | null | undefined): boolean => !!subject && (ESSAY_GRADING_SUBJECTS as readonly string[]).includes(subject);
