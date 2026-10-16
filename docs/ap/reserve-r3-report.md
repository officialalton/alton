# 예비 3차(R3) 실행 보고 (2026-10-12, 오너 승인: 총 상한 $50·중단선 $45 유지, R3 합계 상한 $10.50)

계획: `docs/ap/reserve-plan-3.md`. 단계마다 `reserve-plan-3.ts --no-screen`(화면 증거 없는 새 통과분도 재고로 셈)으로 남은 부족만 생성했다. 동결 구성 해시를 유료 호출 전에 고정(`config/ap-frozen/supp-r3*-ab.v1.json`, `--check-only` 일치 확인), 자동 수선 반복 없음.

## 1. 단계별 지출·결과 (누적 시작 $32.0737 → 끝 **$36.5057**, R3 합계 **$4.4320 / 상한 $10.50**, 절대 중단선 $42.57·$45·$50 근접 없음)
| 단계(배치 id) | 후보 | 통과 | 첫 통과율 | 지출 / 단계 상한 | 누적 |
|---|---|---|---|---|---|
| R3-A `supp-r3a` 계산기 필수 MC(그래프·스킬 3 겹침) | 34 | **32** | 94% | $1.5088 / $2.50 | $33.5825 |
| R3-B `supp-r3b` 계산기 불가 MC | 53 | **47** | 89% | $1.6767 / $4.50 | $35.2592 |
| R3-B2 `supp-r3b2` 단원 3 부족 1건 재시도(반려 원형 2 수정 + 미사용 원형 1) | 3 | **3** | 100% | $0.0838 (B 상한 안) | $35.3430 |
| R3-C `supp-r3c` FRQ(새 유형 10) | 10 | **6** | 60% | $0.6905 / $3.50 | $36.0335 |
| R3-C2 `supp-r3c2` FRQ(반려 4 수정 + 새 유형 4) | 8 | **8** | 100% | $0.4722 (C 상한 안) | $36.5057 |
| 합계 | 108 | **MC 82 + FRQ 14** | | $4.4320 | |
- 단계 상한·통과율 50% 미만 중단 조건은 어느 단계에서도 걸리지 않았다(상한은 목표가 아니며 미사용분은 넘기지 않았다). R3-B2·C2 는 반려 원형의 결함(검토기가 지적한 거짓/혼동 해설·표기 오류·주제 코드 불일치·반올림 경계)을 무료로 진단·수정해 **새 후보**로 넣은 것이다(같은 후보 수선 아님).
- 단원 구성: A = 단원 1:2 2:4 3:2 4:9 5:6 6:4 7:2 8:5(그래프 12종 포함, 스킬 3 후보 11종). B = 단원 1:8 2:10 3:7 4:5 5:9 6:7 8:7(+B2 단원 3 3건).

## 2. 통과 고유 항목과 구조 문항군
| | MC 통과 | 자동 look-alike(엄격) 독립 | 보수 구조 판정(애매하면 같은 군) 새 독립 군 | 기존 군 합류 |
|---|---|---|---|---|
| R3-A | 32 | 32 | **22**(24건이 새 군에 속하나 신규끼리 2건 동군) | 8 |
| R3-B(+B2) | 50 | 50 | **20** | 30 |
| FRQ | 14 | 새 유형 14(재고 FRQ 유형 20 → **34**) | 14 | 0 |
- 보수 판정은 `scripts/ap-generation/r3-merge-groups.py` 에 항목별 근거와 함께 기록했고 `structure-groups.conservative.json` 에 반영했다(질문·풀이 골격이 기존 문항군과 같으면 합류: 예 사다리꼴 합→리만 합 군, 합성함수 한 점 값→연쇄법칙 군, 평균값·접선 절편 등). 숫자·문구·함수·표현만 바꾼 변형은 새 구조로 세지 않았다. `docs/ap/family-structure-review.md` 의 기준과 같다.
- BC 전용 항목은 만들지 않았다(AB 원형만, 단원 1~8).

## 3. 반려 사유 (MC 9, FRQ 4)
- R3-A(2): `c_abs_max_candidates_calc`·`c_motion_first_reversal_calc` — 지수 계수 `e^{-1x}`·`-1t` 표기(stimulus_expression), 최댓값이 끝점이라 임계점 계산 불필요(exam_suitability).
- R3-B(6): 거짓·혼동 오답 해설 5(`c_box_min_surface`, `c_chain_exp_cos_point`(검토기 계산 착오로 보임), `c_inverse_deriv_formula`(음수 표기 누락), `c_lhopital_twice_zero`, `c_limit_laws_from_given_limits`(분모 극한 1이라 오개념이 키와 같음)), 주제 코드 1.3 불일치 1(`c_one_sided_abs_quotient`). 단원 3 재시도 3/3 통과.
- R3-C(4): `frq_cooling_check`(주제 7.3 불일치·반올림 경계), `frq_exp_decay_de`(sympy `\log{\left(2 \right)}` 표기), `frq_limits_continuity`(`1x^2`·지저분한 자료), `frq_rational_param`(파트 주제 1.16·정당화 행 부족). 수정 후 C2 에서 4/4 통과.

## 4. 남은 부족 (`reserve-plan-3.ts --no-screen`, 최종)
- 구조 묶음 MC: 계산기 불가 Part A 308→**311/305**, 계산기 필수 Part B **152/137**, 그래프 필수 **101/98**, BC 전용 9·10 67/54 — **전부 충족(부족 0)**. 단원 1~10 MC, 단원별 계산기 필수 1~8 도 부족 0.
- FRQ: Part A(계산기) **23/21**, Part B(계산기 불가) **42/42**, BC 전용 10/9 — **부족 0**. 유형 재고 34종(미사용 22종).
- 기계적으로 채우지 않기로 한 **단원별 그래프 필수 36칸**은 그대로다(구조 묶음 부족 10 은 해소). 남은 단원별 그래프 부족: 단원 1:1 3:1 4:3 5:3 6:5 7:2 8:4 9:5 10:2(합 26, 오너 판단 대상).
- 주의: 위 재고는 **화면 증거까지 만든 항목(192항목)** 이므로 비프로덕션 적재·검증(렌더·화면 기록) 전까지 "검증 대기"다.

## 5. 렌더·화면 증거·관리자 등록
- 렌더 보고서 재생성(`render-check.ts`): R3 신규 그래프·표 항목 pass, 실패 0(기존 `run1:…f04-k8` 실패만 이전부터).
- 격리 스택 `ALTON_apr3`(하드닝 가드 통과, 이미 `isolated-stack.sh stop` 으로 정리·`config.toml` 원복·시드 정리·dev 서버 종료·워크트리 `.env.local` 삭제)에서 `data/ap/screen-evidence/evidence-r3.json`: **96건 × 2 뷰포트 = 192항목 전부 통과**(원문 수식 노출 검사 포함), 스크린샷 `docs/ap/screen-evidence/r3/`.
- 관리자 'AP 재고 관리' 배치 목록(`lib/ap-admin/batches.ts`)에 `supp-r3a`(행 34·통과 32), `supp-r3b`(53·47), `supp-r3b2`(3·3), `supp-r3c`(10·6), `supp-r3c2`(8·8) 등록, 공유 증거 파일 `evidence-r3.json`. 산출물: `data/ap/stock/supp-r3{a,b,b2,c,c2}-items.json`·`-pass-keys.json`·`supp-r3-all-pass-keys.json`, 런 디렉터리 `data/ap/sample-2027/supp-r3*-ab(-final)/`, `data/ap/render-check/report.json`. 조정 세션이 관리자 화면에서 적재 → 렌더 → 화면 기록 → 변환 순으로 검증한다.

## 6. TeX 위생
- `docs/ap/tex-audit.md` 는 이 시점 main 에 없어 협업 없이 진행했다. 새 원형(MC·FRQ)의 학생 노출 문장(문항·선택지·해설 `why`·FRQ 프롬프트/모범 답/루브릭)은 수식을 모두 `$...$` 안에 쓰도록 만들고 `archetypes/r3_lint.py` 로 검사했다(위반 0; 남은 10건은 그림 대체 설명문 stimulus.description 과 소유격 아포스트로피 오탐).
- **생성기 버그 수정**: `pipeline2.ts` 의 `structuredExplanation` 이 선택지 텍스트의 `$` 를 벗겨 해설에 수식이 `$...$` 밖으로 노출됐다(예: "The correct answer is \frac{3}{5}"). 벗기지 않도록 고쳤고, R3 런의 코드 생성 해설 180건(두 디렉터리 합)을 `r3-rewrap-explanations.ts` 로 같은 규칙으로 다시 썼다(결정적 게이트 재확인 `r3-gate-recheck.ts` 사유 0, 화면 증거는 재작성 뒤 payload 로 생성). 이전 배치의 기존 항목은 건드리지 않았다(감사 담당 몫).

## 7. 도구·커밋
- 신규 원형 모듈 `scripts/ap-generation/archetypes/calc_r3_*.py`(레지스트리가 자동 등록), 동기화 `r3_sync.py`(가이드 JSON·문서·FRQ 템플릿 `frq-r3.json`), 검사 `r3_lint.py`, 구조 `r3-structure.ts`·`r3-merge-groups.py`, 단계 목록 `calc_r3_stages.py`, 재현 `run-frozen.ts --config config/ap-frozen/supp-r3{a,b,b2,c,c2}-ab.v1.json` → `graph-finalize.ts <run> ap_calculus_ab <seed0>`(seed0 8100·9100·9300·9500·9700) → `stock.ts` → `supp-pass-keys.ts` → `render-check.ts` → 증거(격리 스택).
- `frq_region_bisect` 의 독립 확인 격자를 줄여(생성 24초) 가이드 일관성 테스트(`gates.test.ts`)가 제한 시간 안에 돈다. 단위 테스트 `lib/ap-generation` 138건 통과.
