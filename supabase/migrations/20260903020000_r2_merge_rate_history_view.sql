-- R2 Task 5 (추가 확정) — teacher_rate_history.teacher_id는 병합 시 재배정하지
-- 않는다(과거 사실 보존, 실행 로그 참고). 그 결과 병합 원본이 익명화된 뒤에도
-- 관리자 정산·감사 화면과 선생님 본인이 "생존 계정 기준 전체 시급 이력"을
-- 놓치지 않고 볼 수 있어야 한다 — account_merges를 따라가 합쳐서 보여주되,
-- 원본 데이터(teacher_id·기간)는 그대로 두고 합치거나 덮어쓰지 않는다.
--
-- payout_items/payout_batches.teacher_id는 merge_accounts()가 이미 생존
-- 계정으로 재배정하므로(소유권 필드) 이 함수가 필요 없다 — teacher_rate_history
-- 만 예외적으로 원본을 유지하기 때문에 생기는 간극이다.
create or replace function public.teacher_rate_history_with_merged(p_teacher_id uuid)
returns table (
  source_teacher_id uuid,
  amount_minor bigint,
  currency text,
  effective_from timestamptz,
  effective_until timestamptz,
  created_by uuid,
  created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  -- 관리자는 누구든 조회 가능, 그 외에는 본인 것만 — is_admin()이 아닌 임의
  -- teacher_id 조회를 허용하면 R1 has_capability류와 같은 정보 노출 위험이
  -- 생기므로 self-only 조건을 항상 함께 건다.
  if not (is_admin() or auth.uid() = p_teacher_id) then
    raise exception '본인 또는 관리자만 조회할 수 있습니다.';
  end if;

  return query
  select trh.teacher_id, trh.amount_minor, trh.currency, trh.effective_from,
         trh.effective_until, trh.created_by, trh.created_at
  from teacher_rate_history trh
  where trh.teacher_id = p_teacher_id
     or trh.teacher_id in (
       select am.merged_id from account_merges am where am.survivor_id = p_teacher_id
     )
  order by trh.effective_from;
end;
$$;
revoke execute on function public.teacher_rate_history_with_merged(uuid) from public;
grant execute on function public.teacher_rate_history_with_merged(uuid) to authenticated;
