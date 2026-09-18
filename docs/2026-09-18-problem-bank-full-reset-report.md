# 문제은행 전수 재검수 — 진행 보고 (2026-09-18, 1차 — 보관 완료 + 생성 파일럿)

이 문서는 진행 중인 상태를 기록한다. 완료된 것과 남은 것을 명확히 구분한다.

## 1. 기존 검수 대기 문항 정리 — 완료(로컬 검증), 비프로덕션 미적용

비프로덕션(`worpsqwqgnspddnrtnvq`) `problems`/`problem_versions`를 읽기 전용으로 덤프해
(`npx supabase db dump --linked --data-only`) 로컬 스크래치 스키마에 적재하고 다음 조건으로
대상을 확정했다:

- `problems.archived_at is null`(활성) 이고 최신 버전(`version_no` 최대) `status = 'draft'`
- **제외**: 공개 문항(latest status=published), 이미 보관된 문항, `session_problem_work`/
  `session_homework_items`가 참조하는 `problem_version_id`/`problem_id`(교차검사 결과 **겹침 0건**
  — 애초에 draft 버전은 세션에 고정될 수 없는 구조라 예상된 결과)

**대상 147건**, 스킬 코드·난이도별 집계:

| skill_code | difficulty | 건수 |
|---|---|---|
| area_volume | medium | 5 |
| boundaries | medium | 5 |
| central_ideas_details | medium | 4 |
| circles | medium | 3 |
| command_of_evidence_quant | medium | 4 |
| command_of_evidence_text | medium | 5 |
| cross_text_connections | medium | 5 |
| equivalent_expressions | hard | 5 |
| evaluating_statistical_claims | medium | 5 |
| form_structure_sense | medium | 4 |
| inference_margin_error | medium | 5 |
| inferences | medium | 4 |
| linear_equations_one_var | hard | 3 |
| linear_equations_one_var | medium | 9 |
| linear_equations_two_var | hard | 4 |
| linear_functions | hard | 5 |
| linear_inequalities | hard | 2 |
| lines_angles_triangles | medium | 6 |
| nonlinear_equations_systems | hard | 5 |
| nonlinear_functions | medium | 5 |
| one_variable_data | medium | 5 |
| percentages | medium | 5 |
| probability | medium | 5 |
| ratios_rates_units | medium | 5 |
| rhetorical_synthesis | medium | 5 |
| right_triangles_trigonometry | medium | 5 |
| systems_linear | hard | 5 |
| text_structure_purpose | medium | 5 |
| transitions | medium | 4 |
| two_variable_data | medium | 5 |
| words_in_context | medium | 5 |
| **합계** | | **147** |

보관 사유(정확히 이 문자열): `문제은행 전수 재검수 전 기존 검수 대기 정리`

마이그레이션: `supabase/migrations/20261416000000_p8_problem_bank_pre_reset_archive.sql`
(순수 데이터 UPDATE, 스키마 변경 없음, DELETE 아님). **로컬 스냅샷 사본에 대해 dry-run으로
검증 완료**(147건 정확히 갱신, 다른 기존 보관 사유 10종 방해받지 않음 확인) — 이 브랜치에
커밋만 하고 `db push --linked`는 실행하지 않았다(BRANCH-WORKFLOW.md 규칙). **통합 세션이
비프로덕션에 적용해야 이 결과가 실제로 반영된다.**

보관 전·후 수: 보관 전 활성 draft 147건 → 이 마이그레이션 적용 후 활성 draft 0건(작업 2의
새 생성분이 그 자리를 채운다).

## 2. 새 점검 생성 — 파일럿만 완료, 전체 미완료

### 실행 경로

`scripts/problem-bank-full-reset-generate.ts`(이번에 작성)가 실제 관리자 서버 액션
(`generateBankProblemsAction`, `app/admin/problem-bank-actions.ts`)과 **정확히 같은 함수**를 호출한다:

- SAT Math 19종 전부 → `runMathCompilerBatch`(결정적 컴파일러, **AI 호출 0회, 비용 $0**)
- SAT R&W 11종 → `runGenerationPipeline`(실제 Anthropic API 호출)
- 저장은 `createDraftVersionAction`/`createBankProblemAction`과 동일한 RPC
  (`save_problem_draft_version`, `set_problem_quality`)를 그대로 호출한다.
- `requireAdmin()`만 건너뛴다(스크립트에는 Next 쿠키 세션이 없다) — 기존
  `scripts/evidence-model-verify.ts`, `scripts/problem-quality-batch.ts`와 동일한 선례 패턴.

### 파일럿 결과 (R&W `words_in_context`, 로컬 DB, 실제 API 호출)

| 난이도 | 요청 | 최종 저장 | 첫 시도 통과 | 후보 평가 | 모델 호출(평균) | 재생성(해소) | 빈 응답 | 소요 시간 |
|---|---|---|---|---|---|---|---|---|
| medium | 7 | 7 | 1/7 | 7 | 6.71 | 7(5) | 0 | 201초 |
| hard | 3 | **0** | 0/1 | 1 | 54(누적) | 8(0) | 0 | 219초 |

**품질 관찰**: medium은 100% 최종 저장됐지만 hard는 8회 재생성이 전부 실패해 0/3 저장 —
hard 난이도에서 독립 검사(정답·오답 근거) 통과율이 크게 낮다는 신호. 이 원인은 이번
점검 단계에서 **분석만 하고 생성 로직은 고치지 않는다**(지시사항). 30개 스킬 전체 배치
때 같은 패턴이 반복되면 hard 3문항 요청이 실제로는 최종 저장 0~1개로 끝나는 스킬이
다수 나올 수 있다 — "결정 필요" 항목 참고.

### 남은 작업 (미완료 — 다음 세션이 이어서 실행)

30개 스킬 중 **1개(words_in_context)만 파일럿 완료**. 나머지 29개 스킬 × (medium 7 + hard 3)이
아직 실행되지 않았다. 재실행 방법:

```bash
cd "ALTON-problem-bank-full-review"  # 이 브랜치 워크트리
npx tsx scripts/problem-bank-full-reset-generate.ts \
  --progress=docs/2026-09-18-problem-bank-full-reset-progress.jsonl
# 특정 스킬만: --skills=code1,code2
```

스킬 하나(난이도 하나) 끝날 때마다 `docs/2026-09-18-problem-bank-full-reset-progress.jsonl`에
한 줄씩 append된다 — 중단되면 이 파일을 보고 어디까지 끝났는지 확인 후 `--skills=`로 남은
것만 이어서 돌리면 된다. **이 로그에 없는 스킬·난이도는 아직 생성되지 않은 것이다.**

예상 소요: R&W 11종은 AI 호출 포함 스킬당 medium+hard 약 7분(파일럿 기준 420초) → 11종
전체 약 80분. Math 19종은 컴파일러라 스킬당 수 초 내외로 훨씬 빠르다. 예상 비용은
R&W hard 실패율이 높을 경우 재생성 횟수가 늘어 파일럿보다 커질 수 있다(파일럿 10문항
시도로 약 $1 내외 API 비용 추정 — 정확한 토큰 비용은 이 보고서에서 계측하지 않았다).

**이 생성 결과는 전부 로컬 DB에만 있다.** 마이그레이션이 아니라 스크립트 실행 결과이므로,
통합 세션이 비프로덕션에 반영하려면 위 스크립트를 비프로덕션을 가리키는 `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL` 등)로 바꿔서 직접 실행해야 한다 — `db push`로는 반영되지 않는다.

## 3. 로컬 DB 상태 관련 주의

이 브랜치의 로컬 개발 DB(`127.0.0.1:54422`)는 기존에 이미 290개 공개 문항이 시딩돼 있었고
draft가 0건이었다 — 즉 로컬 DB는 비프로덕션의 실제 검수 대기 상태를 반영하지 않는다.
1절의 147건 집계·2절의 파일럿은 각각 (1) 비프로덕션 읽기 전용 스냅샷, (2) 로컬 DB에 새로
쓴 파일럿 데이터를 근거로 한다 — 서로 다른 DB라는 점에 주의.

## 4. 결정 필요

- **R&W hard 난이도 통과율**: 파일럿 1개 스킬(words_in_context hard)에서 3/3 요청이
  전부 저장 실패했다. 30개 스킬 전체를 돌리기 전에, 이 실패가 이 스킬만의 문제인지
  R&W hard 전반의 구조적 문제인지 최소 2~3개 스킬을 더 파일럿해 확인하는 것을 권장한다
  (생성 로직 수정은 별도 작업 — 여기서는 재현 조건과 통과율 영향만 보고).
- **비프로덕션 반영 시점**: 147건 보관과 300건 생성(완료 시)을 통합 세션이 언제 비프로덕션에
  반영할지 — 특히 생성 스크립트를 비프로덕션 대상으로 실행하는 것은 실제 AI 비용이 다시
  발생한다(로컬 파일럿과 별개로 한 번 더).

## 5. 커밋된 파일

- `supabase/migrations/20261416000000_p8_problem_bank_pre_reset_archive.sql` — 147건 보관(로컬
  dry-run 검증 완료, 비프로덕션 미적용)
- `scripts/problem-bank-full-reset-generate.ts` — 30개 스킬 생성 스크립트(재사용 가능)
- `docs/2026-09-18-problem-bank-full-reset-progress.jsonl` — 진행 로그(현재 words_in_context만)
- 이 보고서
