-- 롤백(주의: 이 시드가 만든 과목 행을 지워 FK cascade 로 키워드·폴더·회차·연결·판·스킬·비중을 모두 지운다. 시드 이후 관리자가 편집한 내용도 사라진다).
-- 키워드 개별 DELETE 는 ap_official_keyword_protected 트리거가 막으므로 과목 단위로만 가능. 학생·선생님 층이 참조 중이면 FK 오류로 전체 중단된다.
-- 과목이 시드 이전부터 있었다면(다른 데이터 보유) 이 파일을 쓰지 말 것.
begin;
delete from subjects where ap_subject_code = 'ap_physics_2';
commit;
