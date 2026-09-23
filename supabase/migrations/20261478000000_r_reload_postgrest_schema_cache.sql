-- 2026-09-23 — PostgREST 스키마 캐시가 20261477000000의 새 함수
-- (consultant_name_for_household)를 아직 못 찾는 문제(Preview 실사용 중
-- 발견, "Could not find the function ... in the schema cache") 재현. 보통
-- 마이그레이션 적용 시 자동으로 리로드되지만, 이번엔 반영이 늦어 명시적으로
-- 다시 알린다. no-op(스키마 변경 없음).
notify pgrst, 'reload schema';
