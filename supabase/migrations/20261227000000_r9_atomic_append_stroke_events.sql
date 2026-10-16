-- R9 corrective (2026-09-07, 최종 라운드) — 스트로크 저장의 원자성/성능 결함 수정.
--
-- 배경: WhiteboardCanvas.tsx는 pointerUp에서 한 스트로크의 세그먼트들을
-- `for (const seg of segs) { await appendStrokeEvent(sessionId, seg) }` 로 순차
-- 호출했다. 두 가지 문제가 있었다:
--   1) 성능 — 세그먼트 수만큼 순차 왕복(round-trip)이 생겨 긴 스트로크일수록
--      저장이 느려진다.
--   2) 원자성 — 루프 중간 요청이 실패하면(네트워크 순단, 서버 거부) 그 앞의
--      세그먼트는 이미 커밋되고 뒤는 커밋되지 않아 "반쪽 스트로크"가 영구 남는다.
--      기존 실패 시 replayAndRedraw() 롤백 로직은 같은 스트로크 안에서 이미
--      커밋된 앞쪽 세그먼트를 되돌리지 못한다(replay는 서버에 남은 걸 다시
--      그릴 뿐 삭제하지 않는다 — 애초에 append-only 테이블이라 삭제 자체가 불가).
--
-- 수정: 클라이언트가 스트로크 전체 세그먼트 배열을 단일 RPC 호출로 보내고,
-- 이 함수가 DB 트랜잭션 하나 안에서 전부 append하거나 전부 실패시킨다(all-or-
-- nothing). 개별 세그먼트-이벤트 행의 스키마/의미는 그대로 유지한다 — 여러 행을
-- "N번의 개별 호출"이 아니라 "1번의 호출로 원자적으로" 추가하는 경로만 바꾼다.
--
-- 순서 보존: 함수 내부에서 jsonb 배열을 `with ordinality`로 인덱싱해 그 순서
-- 그대로 한 행씩 INSERT한다. session_annotation_events.seq는 bigserial이고 이
-- 함수 호출은 (RPC 한 번 = 트랜잭션 한 번, 단일 커넥션 내 순차 실행이므로) 세그먼트
-- 입력 순서와 동일한 순서로 seq를 단조 증가 배정받는다.
--
-- SECURITY INVOKER(기본값, 명시하지 않음)를 그대로 둔다 — 이 함수는 권한 상승이
-- 아니라 "여러 INSERT를 한 트랜잭션으로 묶는" 목적뿐이므로, 호출자 권한 그대로
-- authenticated로 실행되어 기존 RLS 정책("세션 당사자 기록, clear_all은 선생님만")이
-- 매 행 INSERT마다 정확히 그대로 적용된다 — 이 함수가 RLS를 우회할 방법은 없다.
create or replace function public.append_stroke_events(
  p_session_id uuid,
  p_segments jsonb
)
returns setof session_annotation_events
language plpgsql
as $$
declare
  v_author uuid := auth.uid();
  v_seg jsonb;
  v_row session_annotation_events;
begin
  if v_author is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;

  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments는 비어있지 않은 jsonb 배열이어야 합니다.';
  end if;

  -- 입력 순서(ord) 그대로 한 행씩 INSERT — bigserial seq가 이 순서 그대로
  -- 단조 증가 배정된다. 도중에 raise exception이 나면(예: 세그먼트 payload
  -- 모양이 깨짐) 이 함수 호출 전체(=하나의 문장, 하나의 트랜잭션)가 롤백되어
  -- 그 앞서 이미 INSERT한 세그먼트까지 전부 함께 사라진다(all-or-nothing).
  for v_seg in
    select value
    from jsonb_array_elements(p_segments) with ordinality as t(value, ord)
    order by ord
  loop
    if not (
      v_seg ? 'x0' and v_seg ? 'y0' and v_seg ? 'x1' and v_seg ? 'y1'
      and v_seg ? 'color' and v_seg ? 'tool'
    ) then
      raise exception 'stroke 세그먼트 payload에 필수 필드(x0,y0,x1,y1,color,tool)가 없습니다: %', v_seg;
    end if;

    insert into session_annotation_events (session_id, author_id, event_type, payload)
    values (p_session_id, v_author, 'stroke', v_seg)
    returning * into v_row;

    return next v_row;
  end loop;

  return;
end;
$$;

comment on function public.append_stroke_events(uuid, jsonb) is
  'R9 corrective: 한 스트로크의 세그먼트 배열을 단일 호출로, 단일 트랜잭션 안에서
  원자적으로 append한다(전부 성공 또는 전부 실패). SECURITY INVOKER — 호출자 권한
  그대로 실행되어 기존 RLS INSERT 정책이 매 행마다 그대로 적용된다.';

revoke all on function public.append_stroke_events(uuid, jsonb) from public, anon;
grant execute on function public.append_stroke_events(uuid, jsonb) to authenticated;
