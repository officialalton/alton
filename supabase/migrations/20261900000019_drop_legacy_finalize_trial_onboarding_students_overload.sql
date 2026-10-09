-- 2026-09-28 — finalize_trial_onboarding_students 중복 오버로드 정리
--
-- 20261280000000이 6-인자 버전(p_claim_id 추가)을 새로 만들었는데, 이후
-- 20261481000000의 `create or replace function ...(5개 인자)`는 시그니처가
-- 달라 원래 5-인자 함수만 갱신하고 6-인자 오버로드는 그대로 남겼다. 그 결과
-- 두 오버로드가 동시에 존재해 위치 인자 5개로 호출하면(기본값 매칭 때문에
-- 둘 다 후보가 되어) "function ... is not unique" 에러가 난다.
--
-- 6-인자 버전(claim 잠금 포함)이 최신 정본이므로, legacy 5-인자 오버로드를
-- 제거한다. 실제 애플리케이션 코드(lib/trial-onboarding-finalize.ts)는 항상
-- 이름 붙은 인자 6개를 전부 넘기므로 영향 없다.

drop function if exists public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb);
