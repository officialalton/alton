-- 2026-09-17 — Math 컴파일러 지문/질문/선택지 영어 전환(20261xxx 이전) 및 해설 표기
-- 결함 수정 이전에 만들어진 검증용 문항을 검수 에이전트 실행 전에 일괄 보관 처리한다.
-- additive/데이터 정리 전용, 스키마 변경 없음. 비프로덕션(worpsqwqgnspddnrtnvq) 전용.
update problems
set
  archived_at = now(),
  archived_reason = '2026-09-17 컴파일러 언어·표기 수정 이전에 만들어진 검증용 문항 일괄 보관(검수 에이전트 실행 전 정리)'
where archived_at is null;
