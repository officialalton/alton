# 최신 상태표 (단일 문서, 2026-10-08 갱신 — 보고 대신 이 표를 갱신한다)

| 항목 | 상태 |
|---|---|
| 누적 비용 | $22.966 (무효 v8-bio-r $0.1146 포함), 중단선 $27, 여유 $4.034, 총 상한 $30 |
| AB 사용 가능 재고(자동 통과·결함 없음·중복 제외·렌더 통과) | MC 202 / FRQ 35 (그래프가 풀이에 필수인 MC 15 + FRQ 15 — 이전 표기 'MC 30'은 MC·FRQ 합산 오표기였음, 화면 검증 증거는 자동 Playwright) |
| AB 풀 세트 | **선택 완료(정확 제약 선택, 제약 전부 통과, 사용 이력 반영)**: `docs/ap/ab-full-set-selection.md` / `data/ap/stock/ab-full-set-selection.json`. 풀 모의고사 겹침 0(게시된 풀 없음). 연습 세트 재노출 9/48(Non-Calculator 6, Calculator 3, FRQ 0), 첫 노출 39. 그래프 필수 MC 10(내부 기준), FRQ 6유형. 화면 검증 완료/대기 수는 선택 문서 참조. 신규 생성 불필요, 예비 생성 미승인 |
| 알려진 결함 | planApSet 탐욕 선택은 `ab-select.ts` 로 대체(풀 세트용); 화면 검증 증거 0; Bio D 온도 방향 불일치 템플릿(v10 에서 수정) |
| Bio data_short 원형 | **재검증 대기(수정 후)** — v9 첫 통과 3/4(원래 버전 `v9-bio-data-short` 그대로 보존), v10 동결 구성 `config/ap-frozen/bio-data-short.v10.json` 기록, 유료 검증 미실행 |
| Bio v9 통과 항목 | k1 pepsin·k2 pepsin·k3 amylase: 온도 방향 결함 없음(무료 결정적 검사). 루브릭 문구는 구버전 — v10 문구 기준 재판정 필요하면 재검증 시 포함. k0 catalase: 결함 있음(실패 사유와 일치) |
| Bio v8 통과 | 4건 모두 amylase/pepsin, 방향 결함 없음. 원래 버전 보존 |
| 무효 측정 | v8-bio-r (승격 근거 제외) |
| AB 풀 세트 단원·스킬 분포 | 공식 고정 구성이 **아니다**: CED 는 비중 범위(%)만 정하고, 1:5 2:5 3:3 4:5 5:8 6:7 7:4 8:5 · 스킬 25/12/5 는 이 세트가 범위 안에서 정한 배분(정책 문서·생성기 문구 정정, 스킬 3 상한 9→8 정정) |
| BC 풀 세트 가능성(기존 재고만) | `docs/ap/bc-full-set-feasibility.md`: 공식 제약으로는 **조립 가능**(MC 단원 배분은 하한 합=42 로 `3 3 3 3 5 7 3 3 5 7` 한 가지, 단원 9·10 = 12문항 전부 BC 고유). AB 풀 세트와 겹침 0 이면 그래프 필수 MC 6 부족(내부 기준). 단원 9·10 은 스킬 2·그래프/표 0(품질 공백), BC 전용 FRQ 는 유형당 1문항군(대체 여유 0). 최소 생성 $0.80(겹침 0) / 권고 $2.14, 누적 $22.966 + 중단선 $27 이내, 미승인·미실행. AB 세트 완성은 AB 초기 목표 부족(Part A 단원 4·5·8 각 5, Part B 단원 2·6, 그래프 4, 스킬 3 = 1)을 해결한 것이 아님 |
| BC 보충·커버리지(2026-10-09) | `bc-full-set-feasibility.md` §9–11: 보충 필수 범위 = 단원 9/10 MC 6(자료·스킬 2) + BC 전용 FRQ 1 문항군 2건, **총 상한 $2.8**(생성+풀이+검토+난이도+표본+재시도 포함, 누적 $22.966→$25.77 < 중단선 $27), 선택분 $2.1 은 별도 승인. '조립 가능'과 '시험 준비 충분'은 구분: BC 고유 MC 44 전부 텍스트형, 단원 9 토픽 5/9·단원 10 토픽 5/15, BC 전용 FRQ 는 급수·매개변수뿐(오일러·로지스틱·극좌표·벡터 없음). 게시 AB 풀 세트는 재검증에서 영향 없음(`ab-select --prev`). 미승인·미실행 |
| BC 보강 반영(2026-10-09, 신규 지출 0) | 보강 통과 16건(MC 15 + FRQ 1) 렌더 검사 통과(그림 15/15)·결함 스캔 신규 0. **학생 화면 증거 16/16 통과**(390x844·1280x800, automated, 해시 결속; `data/ap/screen-evidence/evidence-bc-topup.json`, 스크린샷 `docs/ap/screen-evidence/bc-topup/`). 격리 스택에서 적재(새 키 18, 갱신 0)→`mark-verified --render/--screen` 16건 기록까지 리허설 완료. **비프로덕션(`worpsqwqgnspddnrtnvq`) 적재·검증 기록은 미실행**(키 취득이 자동 분류기에 거부됨 — 오너/조정 세션이 키를 환경변수로 제공해 같은 명령 실행 필요, `bc-full-set-feasibility.md` §12). 재고 재계산(AB 풀 세트 항목 제외, 겹침 0): MC 단원 9 재고 15→25(그래프 0→6, 표 0→4, 스킬 2 0→10), 단원 10 14→19(그래프 0→1, 표 0→4, 스킬 2 0→5), 그래프 필수 MC 5→12, **BC 풀 세트 MC 42 공식 제약+내부 기준(그래프 ≥10 포함) 위반 0으로 조립 가능**. BC 전용 FRQ 문항군 2→3(오일러·로지스틱 1건뿐 — 목표 2건에서 **1건 부족**). 전범위 충분성은 선언하지 않음. BC 세트 조립·게시 없음 |
| 통합 테스트 가드(2026-10-09) | `SUPABASE_TEST_DB_URL`/`API_URL` 미지정 또는 공유 포트(544xx)면 `vitest.integration-guard.ts` 가 테스트 시작 전에 중단(`lib/dev/integration-db-guard.ts`). 모든 `*.integration.test.ts`(universities 설정 포함)가 가드된 경로로만 실행됨(`lib/dev/integration-guard-coverage.test.ts`). 공유 스택 의도 실행은 **조정 세션 전용** `ALLOW_SHARED_TEST_DB=1 SHARED_TEST_DB_NOTE="coordinator-approved: <사유>"` — 에이전트·자동화 편의용 아님 |
| 공유 DB 사고 기록(2026-10-08) — 사실 | **과거 통합 테스트가 공유 로컬 DB(54422)에 쓰기를 했음**(2026-10-08 20:13~23:28 로컬, 실행 ID `apx…`(예: `apxmv0l3bejc2rc`), 테스트 로그 근거). |
| 공유 DB 사고 기록 — 감사 | 이후 감사 조회는 **읽기 전용**. 잔여 테스트 행 **0**. 시퀀스·통계는 **복원하지 않음(의도)** — 만지지 않는다. |
| 선택 스크립트 안전(2026-10-09) | `ab-select.ts` 기본·`--dry-run` 은 디스크 무변경, 보고서는 `--write-report <경로>`, 게시본은 `--write-published` 명시 때만(`import-candidates.ts --report` 도 출력만, 저장은 `--write-report <경로>`). 입력 순서·`--seed` 고정 시 동일 결과(재현). 정렬 안정화로 `--prev` 없는 새 탐색 결과는 이전 실행과 다를 수 있으나 게시본은 불변 |
| 대기 1 — 로그인 대기 | AB 배포본 전체 흐름 검증(별도 테스트 계정으로 오너가 창에서 로그인) |
| 대기 2 — 콘텐츠 부족 | BC 보강은 필수 단계 완료(MC 15 + FRQ 1). 남음: 오일러·로지스틱 FRQ 문항군 1건(선택 +1건, 약 $0.2–0.4, **별도 오너 승인 필요·생성 안 함**), 극좌표·벡터·부분적분류 FRQ 없음, 단원 10 토픽 7/15. AB↔BC 동일 문항 재사용은 금지(확정) |
| 완료 — 비프로덕션 적재(오너 실행, 2026-10-09) | 대상 `worpsqwqgnspddnrtnvq` 확인(`대상:` 줄). 적재: 재고 18건(auto_passed 16·rejected 2), **새 키 insert 18·update 0·보존 0**, 적재 완료 insert 18. 렌더 검증 기록 16건(건너뜀 0 — 기대 최대 15보다 1 많음: 텍스트형 서술형 1건도 기록된 것으로 보이며 확인 필요), 화면 검증 기록 신규 16건(라벨 갱신 0). 사후 확인(재실행 시 '이미 검증됨') 미수행. 오너 터미널 화면 캡처로 확인 |
| 예산(2026-10-09 오너) | 총 상한 $30 → **$50**, 제안 중단선 **$45**(오너 확정 전), 누적 $23.8634. 생성 승인 아님 |
| 목표: AB 3 + BC 3 풀 모의고사(2026-10-09) | `docs/ap/six-set-plan.md`: AB#1 = 게시본 새 버전(그래프 하한 9 승인, 교체 10건), 나머지 5세트 기본 하한 10, 6세트 서로 겹침 0·문항군 상한 1. 재고만으로 부족: MC 약 60(그래프 필수 약 45) + FRQ 1(BC 전용). BC#1 단독(새 AB 제외) 부족 = 그래프 필수 MC 4. 단계 한도(보수·예비 포함): S1 $4.52, S2 $2.72, S3 $10.21 → 누적 $41.30(< 중단선 $45). 1.5배 일반 예비 R(MC 35 + FRQ 13)은 보수 $14.98 라 상한 $50 초과(관측 단가면 $33.5). 미승인·미실행 |
| 재고 1.5배 정책(2026-10-09) | `docs/ap/stock-policy-1-5x.md` — 품질 통과 고유 재고 기준, 칸 단위 올림, 대체 어려운 구조에 예비 우선, 사용·예약 문항은 후속 계획에서 제외 |
| 게시본 새 버전 적용 설계 | `docs/ap/set-new-version-design.md` — 같은 set_group_id·version_no+1·옛 응시 보존·진행 중 응시 유지. 코드에 없는 것: 새 버전 초안 생성 동작, 'Updated version'·겹친 문항 수 표시, 집계의 재응시 취급 확인. 미구현·미적용 |

## 공유 로컬 DB 쓰기 사고 2 (2026-10-09, 화면 증거 시드)
- 격리 스택(`ALTON_apev1`, 54521/54522)에서 화면 증거를 만들던 중 `local-demo-seed.ts` 첫 실행 1회가 **DB 쪽만 공유 스택 54422**로 접속(기본값 상수가 `.env.local` 읽기보다 먼저 계산됨). 원인 수정: `local-demo-seed.ts`·`screen-evidence.ts`가 `SUPABASE_TEST_DB_URL` 필수, 544xx 거부, API 포트+1=DB 포트 검사.
- 감사 조회(읽기 전용, 공유 54422): `ap_candidate_items` run_id `apdemo%` **1행**, `subjects` name `apdemo%` **4행** 잔여(2026-10-09 약 15:40~15:50 UTC). 상태 파일 부재로 시드 `cleanup`으로 못 지움. **삭제·복구는 하지 않음 — 오너 판단 대기.** 비프로덕션·프로덕션은 무관.
- **정리(2026-10-09, 오너 승인):** 접두어 전체 삭제가 아니라 확인한 정확한 행 ID만 삭제. 사전 점검: 두 테이블을 가리키는 FK 23개 전부 참조 0(과목 AB 1행을 가리키는 `ap_candidate_items` 본 행 제외), `candidate_key` 컬럼이 있는 다른 테이블은 뷰(파생)만 1행씩이고 실테이블 참조 0. 한 트랜잭션에서 `ap_candidate_items` 1행(`apdemomv155sy4-s1-graph-ab-final_ap_calculus_ab-m01-k0`)과 `subjects` 4행(ID `0282b369…`·`b2642f7b…`·`b83b5c70…`·`e3aef5da…`)을 삭제, 삭제 건수 1·4 일치 확인 후 커밋. 사후 `apdemo%` 잔여 0·0. 시퀀스·통계는 원복하지 않음(의도).

## DB 기준 현황 (2026-10-12, 비프로덕션 worpsqwqgnspddnrtnvq, 관리자 화면 'AP 재고 관리'로 처리)
- 후보 적재·검증: 통과 키 168건(그래프 70·형제 21·보강 49·BC 보충 16·보강2 12) **전부 review_env_ready**, DB 후보 행 1077. 20+2 배치 전부 문제은행 변환(모의고사용).
- 게시(검수 환경, 무료 공개): **풀 모의고사 6개** — AB#1 **v2**(10건 교체, v1 보관·기존 응시 3건은 v1 유지), AB2, AB3, BC1, BC2, BC3(MC 42·FRQ 6 각). 세트 간 동일 문항 0(풀 모의고사끼리), 문항군 구조 기준 상한 1.
- 부분 연습(겹침 0으로 재구성·재게시, 기존 3종은 보관): Non-Calculator Practice(MC 29), Calculator Practice(MC 13), Free-Response Practice(공식 FRQ 6).
- 마이그레이션 적용(비프로덕션): 480–483(새 버전·노출·분석), 490·491(재고 관리 이력·초안 RPC), 500(AB·BC 공통 범위 세트 가드), 510(공개 범위 전환), 520(부분 초안 RPC), 530(새 버전 겹침은 풀 모의고사끼리만).
- 누적 생성 비용 **$32.0737**(중단선 $45·총상한 $50). 이번 구간 추가 지출 $0.7825(보강2).
- 열린 항목: 서술형·MC 설명의 원문 TeX 노출 점검·수정(`docs/ap/tex-audit.md` 예정), 출시 차단 결함 점검 패널, 재구성 후 예비 재계산(`docs/ap/reserve-plan-3.md` 예정), Desmos 상용 키(오너 제공 대기), 프로덕션 공개는 별도 승인.

## R3 적재 완료·Statistics 사실 확인 (2026-10-12)
- R3 보강 생성 지출 $4.4320(상한 $10.50의 42%), 누적 **$36.5057**(중단선 $45·총상한 $50). 통과 MC 82·FRQ 14 — 배치 `supp-r3a`(32)·`r3b`(47)·`r3b2`(3)·`r3c`(6)·`r3c2`(8)를 관리자 화면으로 적재·렌더·화면 기록·문제은행 변환까지 완료. 통과 키 264건 전부 review_env_ready, DB 후보 행 1185. 출시 게이트 9/9 통과(미충족 0, 차단 결함 0, 열린 신고 0).
- 남은 부족: 단원별 그래프 필수 26칸(기계적 채움 제외, 추정 $1.5~2.5).
- 섹션 타이머: 탭 클릭으로 시계가 시작되지 않고 'Start section' 누를 때만 시작(마이그레이션 560, 배포본 확인).
- Statistics(`docs/ap/statistics-facts.md`): 시험 3시간, MC 42(90분, 3문항 세트 2개), FRQ 4(90분, 각 10점), investigative question은 별도 FRQ가 아니라 Q1 파트 E(스킬 1.A·토픽 1.10), 수식·표 제공, 계산기 허용. 코드 공백은 생성·조립 계층(`gates.ts` OPTION_COUNT, `cells.ts`, `subjects/stats.ts`, `stock.ts` SUBJECT_FAMILY, `assemble-draft.ts` subjectOfSetId, unitBounds). 파일럿 사양: 20 원형(U1 5·U2 5·U3 4·U4 3·U5 3).

- 2026-10-12 ST1 새 버전(v2) 교체 계획: `scripts/ap-generation/st1-new-version-plan.ts` → `data/ap/stock/st1-v2-swap-plan.json`(v1 `stats-st1-s2b` → `stats-st1-s3a-prefer-ep`, 단독 MC 10칸 위치 교체, 검증기 위반 0, exam_prep 10→17/42). 섹션 ap_mc(1–42, 세트 13–15·31–33 불변)/ap_frq. 패널·서버·RPC 는 과목 비의존이라 코드 변경 없이 목록에 나타남(안내 문구만 보강). 테스트 `lib/ap-admin/new-version-stats.test.ts`. 미리보기·초안 생성은 조정 세션이 비프로덕션에서 실행.

- 2026-10-13 ST2(두 번째 Statistics 풀 세트) 조립 완료: 배치 `stats-s3b`(런 a-d, $2.2398, 누적 $42.5699, 통과 42/52), `data/ap/stock/exact-assign-stats-st2-s3b.json`(= `assembled/stats-st2-s3b.json`), 가상 칸 0·ST1 v2 와 겹침 0·단원 10/9/9/7/7·MC exam_prep 21/42(50%)·FRQ 4유형 전부 신규. 보고 `docs/ap/statistics-s3b-report.md`. 비프로덕션 적재(`stats-s1`·`s2a`·`s2b`·`s3a`·`s3b`)와 초안 저장은 조정 세션.
## Physics 1 P0 무료 엔지니어링 완료 (2026-10-13)
- 범위: 유료 호출·DB·키·push·삭제 없음. 본문: `docs/ap/physics1-groundwork.md` §10–12(이 문서가 §1–9 계획 위에 구현 결과·동결 골격·예산·위험을 덧붙임).
- 구현: Python 원형 **47 단독 MC + 2문항 세트 2 + FRQ 4유형**(MR 10 / TBR 12 / LAB 10 / QQT 8, 합 40) — `scripts/ap-generation/archetypes/phys_*.py`. 모든 정답은 sympy·정확 분수 경로와 numpy·RK4·이분법 독립 경로로 이중 계산. 장면 모델 + 결정적 SVG 렌더 10종(`phys_figs.py`: FBD·에너지 막대·벡터·운동 도해·경사·Atwood·충돌·막대·U자관·탱크), 선택지 그림 문항 2(FBD·에너지 막대).
- TS: `subjects/physics1.ts`(+JSON 51항목), `gates.ts`(`ap_physics_1`: 선지 4, MC 비평가 스킬 1.A·1.B·1.C·3.A, FRQ 유형별 프로필), `stats-set.ts` `setSizeOf`(Physics 세트 2문항), `pipeline2.ts` Physics 지침, `run-frozen.ts`(`test_*.py` 해시 제외).
- 테스트: pytest/unittest **41**(결정성·구조 중복 없음·선택지 간격·수치 진실 22·그림 검사·FRQ 구조) + Vitest **6**(TS 게이트·가이드 일치·FRQ 게이트) 전부 통과. 파이프라인 무료 배선 점검(`plan|blueprint|check --subject ap_physics_1`, `AP_FIXED_WORDING=1`): MC 22/22, FRQ 4/4 통과(호출 비용 0).
- 동결 구성 골격(미동결·미실행): `config/ap-frozen/phys-p1-a.template.json`(MC 22문항, 상한 $1.8, 기대 $1.5, 통과율 가정 80%), `phys-p1-b.template.json`(FRQ 4, 상한 $3.6, 기대 $3.2, 통과율 가정 70%). 누적 $40.3301 기준 중단선($45) 여유 $4.6699 — P1-a 는 안, P1-a+b 상한 합 $5.4 는 $0.73 초과.
- 비용(중간): 파일럿 $4.9, 첫 세트+예비 $10.5, 풀 모의고사 2회+예비 $20.9, 위 합+파일럿+재작업 20% **≈ $31**(낙관 $22 / 보수 $55). 현 총 상한 $50 안 여유 $9.67 → 풀 2회는 예산 상향 결정 필요.
- 유료 호출 전 남은 일: TS `ap_diagram` 렌더·정규화 연결(`diagram/phys_scene`, `figure_choice` AP 연결), 공식 참조 정보 대조(`g=9.8` UNVERIFIED), FRQ 응답 방식(오너 §8-B), 풀 세트용 `cells.ts`·`stock.ts`·`assemble-draft.ts` 배선.
