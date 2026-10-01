-- P2 6차 정정 — 같은 내용의 재공개는 버전을 새로 만들지 않는다.
--
-- 2026-09-13 제품 오너 지적: "중복 클릭 4회에 버전이 4개 생긴 결과는 번호 충돌 방지
-- 확인입니다. 같은 공개 요청의 중복 클릭·재시도는 버전 하나로 처리하고, 이후
-- 의도적인 재공개는 새 버전을 만드는 기준으로 보완해주세요."
--
-- 20261331000000 은 재공개마다 무조건 한 벌을 떴다. 버튼을 연타하거나 네트워크
-- 재시도가 나면 **똑같은 내용의 버전이 여러 개** 쌓인다. 버전 기록이 의미를 잃고,
-- 준비안이 어느 것을 가리켜야 하는지도 흐려진다.
--
-- 기준을 내용으로 옮긴다: 직전 버전의 스냅샷과 지금 내용이 같으면 새로 만들지 않고
-- 그 버전을 그대로 돌려준다. 내용이 달라졌을 때만 새 버전이다. 그러면
--
--   같은 요청의 중복 클릭·재시도  → 내용이 같으므로 버전 하나
--   내용을 고친 뒤의 재공개        → 내용이 다르므로 새 버전
--
-- 가 자동으로 갈린다. 시각을 기준으로 삼지 않는 이유는, 사람이 "언제 눌렀나"가
-- 아니라 "무엇이 달라졌나"로 버전을 이해하기 때문이다.

create or replace function public.publish_curriculum_doc(
  p_doc_id uuid,
  p_published boolean
)
returns uuid
language plpgsql
as $$
declare
  v_was_published boolean;
  v_version_id uuid;
  v_latest_id uuid;
  v_latest_snapshot jsonb;
  v_current_snapshot jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_doc_id::text, 77));

  select status = 'published' into v_was_published
  from curriculum_docs where id = p_doc_id;

  if v_was_published is null then
    raise exception '존재하지 않는 교재입니다.';
  end if;

  update curriculum_docs
  set status = (case when p_published then 'published' else 'draft' end)::doc_status
  where id = p_doc_id;

  if not p_published then
    return null;
  end if;

  select id, snapshot into v_latest_id, v_latest_snapshot
  from curriculum_doc_versions
  where curriculum_doc_id = p_doc_id
  order by version_number desc
  limit 1;

  if v_was_published then
    v_current_snapshot := public.curriculum_doc_snapshot(p_doc_id);

    -- capturedAt 은 뜬 시각이라 항상 다르다. 내용 비교에서는 뺀다.
    if v_latest_snapshot is not null
       and (v_latest_snapshot - 'capturedAt') = (v_current_snapshot - 'capturedAt') then
      -- 같은 내용이다 — 중복 클릭이거나 재시도다. 새로 만들지 않는다.
      return v_latest_id;
    end if;

    v_version_id := public.capture_curriculum_doc_version(p_doc_id, 'publish', '재공개');
  else
    -- 초안 → 공개는 status 변경 트리거가 방금 한 벌 떴다.
    v_version_id := v_latest_id;
  end if;

  if v_version_id is null then
    raise exception '공개 시점 내용을 저장하지 못했습니다.';
  end if;

  return v_version_id;
end;
$$;

comment on function public.publish_curriculum_doc(uuid, boolean) is
  'P2 6차: 교재 공개·비공개를 한 트랜잭션으로 처리한다. 공개면 그 시점 내용을 버전 '
  '행으로 남기고, 남기지 못하면 상태 변경도 함께 되돌린다. **내용이 직전 버전과 같으면 '
  '새 버전을 만들지 않는다** — 중복 클릭·재시도는 버전 하나, 내용을 고친 재공개만 새 '
  '버전이다. 교재 단위 advisory lock 으로 동시 요청을 직렬화한다.';
