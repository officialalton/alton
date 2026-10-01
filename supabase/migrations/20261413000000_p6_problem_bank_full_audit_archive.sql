-- 2026-09-18 — 모의고사 전 문제은행 전수 감사(Step 2) 결과 보관 처리.
-- 검수(draft) 상태로 활성 중이던 160개 문항 중 아래 7개 항목을 기계적으로 검사해
-- 8건이 실패했다: 원시 LaTeX 노출(2건), 빈 초안(2건), 금칙어(evidence_span) 노출(1건),
-- 지문 중복(2건 — 동일 지문/해설/숫자의 완전 중복, 템플릿 문구 재사용이 아님).
-- 공개(confirmed) 상태 문항은 모두 이미 보관 처리되어 있어(20261402000000) 이번 감사에서
-- 신규로 공개 상태를 되돌릴 항목은 없다. additive/데이터 정리 전용, 스키마 변경 없음.
-- 비프로덕션(worpsqwqgnspddnrtnvq) 전용.
update problems
set
  archived_at = now(),
  archived_reason = '2026-09-18 문제은행 전수 감사(모의고사 준비 Step 2) — 구조적 결함으로 보관: ' ||
    case id
      when '2a0779b0-1ebc-4ef5-bba2-357c20215faa' then '해설에 원시 LaTeX($...$) 노출'
      when '0d5c1e37-91f9-4e2b-b2fe-c890ed3feb2b' then '해설에 원시 LaTeX($...$) 노출'
      when '7c74b222-16c6-4948-a3e5-7fed8cc97749' then '해설에 원시 LaTeX($...$) 노출'
      when 'c5809139-15a4-4b04-8f48-6f4b9a18eb8f' then '빈 초안(지문/문항/선택지/해설/정답 전부 누락)'
      when '631341f1-c2c5-4fd7-8568-eed6c7db9eab' then '빈 초안(지문/문항/선택지/해설/정답 전부 누락)'
      when '83584a4e-1974-4723-93d8-7dd5ed7870be' then '해설(answer_rationale)에 내부 스키마 필드명(evidence_span) 노출'
      when '0a2e6764-772e-487a-91e5-006e5564279b' then '동일 지문·해설·수치의 중복 문항(ee3606c2-1102-46ca-8348-b3cf9c496a83와 중복)'
      when 'ee3606c2-1102-46ca-8348-b3cf9c496a83' then '동일 지문·해설·수치의 중복 문항(0a2e6764-772e-487a-91e5-006e5564279b와 중복)'
    end
where id in (
  '2a0779b0-1ebc-4ef5-bba2-357c20215faa',
  '0d5c1e37-91f9-4e2b-b2fe-c890ed3feb2b',
  '7c74b222-16c6-4948-a3e5-7fed8cc97749',
  'c5809139-15a4-4b04-8f48-6f4b9a18eb8f',
  '631341f1-c2c5-4fd7-8568-eed6c7db9eab',
  '83584a4e-1974-4723-93d8-7dd5ed7870be',
  '0a2e6764-772e-487a-91e5-006e5564279b',
  'ee3606c2-1102-46ca-8348-b3cf9c496a83'
)
and archived_at is null;
