-- 2026-09-28 — placeholder
--
-- 이 버전 번호(20261900000019)는 같은 공유 비프로덕션 프로젝트
-- (worpsqwqgnspddnrtnvq)에 동시에 작업 중이던 다른 세션이 커밋 전에 먼저
-- 원격에 직접 db push한 마이그레이션이 차지했다(추정: finalize_trial_onboarding_students
-- 함수 오버로드 정리 작업, task_5b4bfecb). 그 세션이 실제 파일을 커밋하면 이
-- placeholder는 그 커밋의 실제 내용으로 교체돼야 한다 — 그 전까지는 로컬
-- 마이그레이션 히스토리가 원격과 어긋나 db push 전체가 막히는 것을 막기 위한
-- 빈 자리표시자다. no-op.
select 1;
