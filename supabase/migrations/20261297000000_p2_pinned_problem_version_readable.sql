-- P2/P3 3단계 — 제품 오너 피드백 3: 고정된 문제 버전을 실제 화면에서 읽을 수
-- 있어야 한다.
--
-- 20261293000000의 조회 정책은 "공개(published) 버전"만 열어줬다. 그런데
-- publish_problem_version()은 새 버전을 공개할 때 이전 공개 버전을 archived로
-- 보관한다. 두 정책을 합치면, 문제를 한 번 수정하는 순간 그 문제를 쓴 과거
-- 수업은 지문·보기·정답·해설을 통째로 읽지 못하게 된다 — 버전을 보존한다는
-- 설계 목적 자체가 무효가 된다.
--
-- 그래서 "내가 볼 수 있는 수업의 스냅샷이 가리키는 버전"을 조회 대상에 더한다.
-- 가시성 판단은 session_content_manifest의 기존 조회 정책에 그대로 위임한다
-- (여기서 역할 판단을 새로 쓰지 않는다 — 정책이 두 벌로 갈라지지 않게).
drop policy if exists "문제 버전 조회" on problem_versions;
create policy "문제 버전 조회" on problem_versions for select
  using (
    is_admin()
    or created_by = auth.uid()
    or (status = 'published' and exists (select 1 from problems p where p.id = problem_id))
    or exists (
      select 1 from session_content_manifest m
      where m.problem_version_id = problem_versions.id
    )
  );

comment on policy "문제 버전 조회" on problem_versions is
  'P2: 공개 버전은 문제를 볼 수 있는 사람에게, 보관된 과거 버전은 그 버전을 고정한 수업의 '
  '스냅샷을 볼 수 있는 사람에게만 열린다. 스냅샷 자체의 조회 권한(session_content_manifest 정책)이 '
  '실질적인 게이트다.';
