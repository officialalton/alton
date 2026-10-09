-- Mock Exam MST Phase 4 (1/1) — 라우팅 임계값 0.70(제품 오너 확정 2026-09-29): 새 version 발행. 기존 v1(0.65) 행은 수정하지 않는다.
-- 섹션별로 활성 정책이 이미 correct_ratio 0.70 이면 건너뛴다(재실행 안전). 이미 시작한 응시는 시작 때 고정된 버전(v1)으로 판정된다.
-- 효과: R&W 27문항 -> 19개 이상(18.9), Math 22문항 -> 16개 이상(15.4)이 higher.
-- 영향: 테이블 스키마 변경 없음, 데이터 행 2개 추가 + v1 active=false. 되돌리기: select mock_exam_set_routing_policy('rw','correct_ratio',0.65,'되돌림') 등 새 버전 발행.
do $$
declare s text;
begin
  foreach s in array array['rw', 'math'] loop
    if not exists (
      select 1 from mock_exam_routing_policies
      where section = s and active and threshold_type = 'correct_ratio' and threshold_value = 0.70
    ) then
      perform mock_exam_set_routing_policy(s, 'correct_ratio', 0.70, '제품 오너 확정(2026-09-29): M1 정답률 70% 이상 -> higher. Phase 5 캘리브레이션 전까지 유지.', null);
    end if;
  end loop;
end $$;
