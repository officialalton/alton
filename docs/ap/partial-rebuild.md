# AB 부분 연습 세트 3종 재구성 — 풀 모의고사와 겹침 0 (2026-10-12 오너 결정)

게시된 AB 부분 세트 3종(Non-Calculator 29 / Calculator 13 / Free-Response 4)이 풀 모의고사와 크게 겹쳤다(예: Calculator 는 AB#1 3 + 초안 10). 오너 결정: **보관하고 남은 예비 재고로 겹침 0 으로 다시 만든다.** 이름·공식 구성·계산기 규칙은 그대로, 풀 모의고사 6세트(AB#1 v1·v2 포함)와 부분 세트끼리 동일 문항 0, BC 전용 문항은 AB 에 넣지 않는다. 생성·지출 없음(누적 $32.0737, 중단선 $45 변동 없음).

## 1. 계획 계산 (`scripts/ap-generation/partial-rebuild-plan.ts`, 무료·DB 없음)
- 입력: 화면 증거 보유 + DB 준비(비프로덕션 검증 완료) 재고 432건 중 AB 전용(`subj=ab`, BC 전용 주제 제외) 예비. 제외 288건 = AB#1 v2 문항(게시본에서 v2 가 빼는 10건은 **예비로 돌려보내되 기본은 쓰지 않음**, v2 가 넣는 10건은 제외) + 초안 5세트(`exact-assign-5sets-cons.json` 240건). 문항군 = `structure-groups.conservative.json`(보수 구조 묶음).
- 방법: 세트별 정수계획(`lib/ap-exam/ilp.ts`) 3개 — 정확한 문항 수·계산기 파트·MC 문항군 상한 1(불가능할 때만 2)·FRQ 서로 다른 유형·문항군 / 목적 = 이전 부분 세트 문항 재사용 최소(100) + 단원·스킬 비중 편차 + 그래프 MC 목표 미달(NC 3·C 2) 최소. 세 세트 모두 `optimal`(분기한정 하한 = 목적값, 증명).
- 독립 검증: 계획 직후 `planPartialDraftSet`(`lib/ap-admin/partial-draft.ts`, 배정기와 별개 코드)으로 세 세트를 다시 검증하고 풀 6세트·세트끼리 겹침 행렬을 계산한다. 위반이 있으면 계획 파일을 쓰지 않는다.
- 산출: `data/ap/stock/assembled/partial-rebuild-ab-plan.json`(세트 3종 키·단원/스킬 분포·겹침 행렬). 재실행: `STRUCTURE_GROUPS_FILE=data/ap/stock/structure-groups.conservative.json npx tsx scripts/ap-generation/partial-rebuild-plan.ts --write data/ap/stock/assembled/partial-rebuild-ab-plan.json`(`--allow-v1-removed` 로 v1 에서 빠지는 10건도 예비로 허용 가능).

## 2. 결과: 불부족, 추가 생성 0
| 세트 | 구성 | 다루는 단원 | 비고 |
|---|---|---|---|
| AP Calculus AB — Non-Calculator Practice | Part A MC 29 · 62분 · 계산기 불가 | Units 1–8 (4/5/2/4/4/4/1/5) | 문항군 1·그래프 MC 8·스킬 1/2/3 = 19/7/3. **이전 Non-Calculator 세트 문항 1건 재사용**(`run2:ap_calculus_ab-m06-k1`) |
| AP Calculus AB — Calculator Practice | Part B MC 13 · 38분 · 그래핑 계산기 필수 | Units 1–8 (1/1/2/3/2/2/1/1) | 문항군 1·그래프 MC 2, 이전 세트 문항 재사용 0 |
| AP Calculus AB — Free-Response Practice | **공식 6문항 · 90분**(Part A 2 계산기 허용 + Part B 4 계산기 불가) | Units 2·3·4·5·7·8 (각 1) | 서로 다른 6유형·6문항군. 기존 4문항 짧은 연습이 아니라 공식 구성으로 복원 |

- 예비(AB 전용, 제외 후): MC 계산기불가 50(문항군 29)·계산기필수 24(문항군 18)·FRQ 계산기 4·FRQ 불가 9. **결합 칸**: Non-Calculator 는 문항군 상한 1 이면 29문항을 위해 문항군 29개를 모두 써야 하는데 예비가 정확히 29개이고 그중 한 문항군의 유일한 계산기 불가 문항이 이전 Non-Calculator 세트에 있던 것(m06-k1)이다. 상한을 2 로 풀면 피할 수 있지만(오너 "가급적 1" 우선) 1건 재노출을 택했다 — 정책상 부분 세트의 재노출(20%까지)은 허용 범위 안이며 풀 모의고사 겹침이 아니다.
- 재구성 뒤 남는 예비: MC 계산기불가 21(문항군 14, 그래프 2)·계산기필수 11(문항군 9, 그래프 2)·FRQ 계산기 2·FRQ 불가 5.
- **조정 세션 주의**: AB#1 v2 추가분 10건 중 5건은 초안 5세트와 같은 문항이다(`docs/ap/reserve-topup-2.md`). v2 적용 시 초안 쪽 5건을 다른 예비로 바꿔야 하는데, 그 대체 문항도 위 남는 예비에서 나온다. 부분 세트 재구성이 이미 예비를 가져가므로 대체용으로 계산기불가 21·계산기필수 11·FRQ 7 이 남는다.

## 3. 겹침 행렬(동일 문항 수) — 전부 0
행 = 새 부분 세트(PNC / PC / PF). 열 = AB#1 v1(게시본) · AB#1 v2(계획) · BC#1·AB#2·AB#3·BC#2·BC#3 초안 · 새 부분 세트 3종 → **모든 칸 0**(`overlapMatrix` 필드). v1 에서 빠지는 10건을 쓰지 않으므로 v2 공개 전·후 어느 순서에서도 v1/v2 와 겹치지 않는다. 이전 부분 세트와의 겹침은 위 1건뿐(보관 뒤 재노출).

## 4. 화면 저장 — ⑤-b 부분 연습 세트 초안 저장 (관리자 → Mock Exams → AP 재고 관리)
- 서버 액션 `apStockAssemblePartialAction`(`requireAdmin`), 서비스 `runAssemblePartial`, 순수 검증 `planPartialDraftSet`. **미리보기 → '확인했습니다' → 실행**, 같은 계획 해시일 때만 저장, 환경 가드(허용 목록의 비프로덕션 ref)·감사 로그(`assemble_draft`, scope `partial: true`) 동일. 공개는 없다(초안만). 공개 범위 기본 무료(`planned_access_tier`).
- 독립 검증 항목: 이름이 공식 이름(또는 번호 접미)일 것 · 해당 이름의 공식 문항 수(29 / 13 / 2+4, 또는 짧은 FRQ 2~4 묶음은 'Practice Section' 레이아웃·묶음당 15분) · 계산기 파트(Part A MC 불가 / Part B MC 필수 / FRQ A 허용·B 불가) · AB 전용·BC 전용 주제·BC 전용 FRQ 금지 · MC 문항군 ≤ 2(권장 1, 초과 시 거부 아님 표시만 `doubledFamilies`)·FRQ 서로 다른 유형·문항군 · 모든 문항 mock_exam 변환·렌더·화면 검증 완료 · **비보관 AP 세트 전부(풀·부분, 초안 포함)와 동일 문항 0** + 예약 문항(AB#1 v2 추가분·초안 5세트) 0 · 같은 이름·같은 구성 거부 · 다루는 단원 비어 있지 않음(미리보기에 `Units …` 표시, 시작·결과 화면은 `apCoverageLines` 가 같은 값으로 안내).
- DB: 마이그레이션 `20262100000520_ap_admin_create_partial_draft_set.sql`(**additive 새 함수, 원격 미적용**) — 부분 라벨(mc_practice·frq_practice)만, 같은 이름 비보관 AP 세트와 비보관 AP 세트 전부와의 문항 겹침을 DB 에서 한 번 더 거부. 기존 `ap_admin_create_draft_set` 은 변경 없음.
- **보관은 새 단계를 만들지 않고 기존 '공개' 탭의 보관 처리를 쓴다**(가장 단순, 이미 감사·테스트됨). 이전 세트가 보관되기 전에는 같은 이름·겹침으로 저장이 거부되므로 순서가 강제된다.

## 5. 운영 순서 (조정 세션)
1. 마이그레이션 520 을 비프로덕션에 적용(`db push --linked`) — 이 변경 승인 후.
2. AB#1 새 버전(v2) 초안 생성 → 공개(이전 공개본 자동 보관). (v2 와 초안 5세트의 겹침 5건 교체는 별도 처리.)
3. 이전 부분 세트 3종(Non-Calculator/Calculator/Free-Response)을 '공개' 탭에서 **보관**. (이 시점부터 부분 세트가 목록에서 사라지므로 4~5 를 바로 이어서 한다.)
4. ⑤-b 에서 계획 파일 `partial-rebuild-ab-plan.json` 의 세 세트를 각각 미리보기 → 확인 → 초안 저장(공개 범위 무료).
5. 세 초안을 공개 탭에서 공개(공개 게이트가 섹션별 공식 문항 수를 다시 강제).
- 새 세트 3종은 이전 세트와 **다른 set_group**(새 세트)이라 '새 버전'이 아니다 — 기존 응시자의 결과는 보관된 세트에 그대로 남고 새 세트는 새 시험으로 시작한다.
- 랜딩 숫자(`lib/landing/practice-test-count.ts`: 게시된 무료 세트, 10분 캐시): AB `sets` 는 3→(보관 직후 0)→3 으로 복원되어 순증감 0, `fullExams` 는 부분 세트와 무관(AB#1 v2 는 같은 그룹이라 수 변화 없음, 초안 5세트 공개 시 +5).

## 6. 남은 일 / 한계
- 마이그레이션 520 의 DB 통합 테스트(`lib/ap-admin/ap-admin-draft-set.integration.test.ts`)는 작성만 하고 **미실행**(격리 스택 미기동). 실행은 격리 스택에서만.
- BC 부분 세트는 이번 범위 아님(요청은 AB 3종). BC 전용 재고(MC 45·FRQ 2)는 BC 풀 세트용 예비로 남는다.
- 코드 기본 겹침 상수 `partialOverlapMax`(20%)와 `docs/ap/publication-flow.md` 겹침 표는 일반 규칙으로 유지 — 이번 재구성만 풀·부분 세트 전체와 0 으로 저장한다. 부분 세트 겹침 0 을 정책 기본으로 바꿀지는 오너 확인 필요.
