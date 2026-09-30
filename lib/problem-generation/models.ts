// 문제 생성·검수 모델 설정(2026-09-30). 환경변수로 덮어쓸 수 있고, 미지정이면 기존 값을 그대로 쓴다(기본 동작 불변).
//   GENERATION_MODEL: 문항 생성·재생성·자료·수선 호출, REVIEW_MODEL: 독립 채점·감사·루브릭, WEAK_MODEL: 약한 모델 풀이(실험용)
// 호출 시점에 읽는다(테스트·스크립트에서 process.env 를 바꿔도 반영).
export const DEFAULT_GENERATION_MODEL = "claude-sonnet-5";
export const DEFAULT_REVIEW_MODEL = "claude-sonnet-5";
export const DEFAULT_WEAK_MODEL = "claude-haiku-4-5";
export const generationModel = () => process.env.GENERATION_MODEL?.trim() || DEFAULT_GENERATION_MODEL;
export const reviewModel = () => process.env.REVIEW_MODEL?.trim() || DEFAULT_REVIEW_MODEL;
export const weakModel = () => process.env.WEAK_MODEL?.trim() || DEFAULT_WEAK_MODEL;
