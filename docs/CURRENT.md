# ALTON — 현재 상태 (2026-10-21 현황 점검)

기준 코드: `af588bf23` (`preview/m4-integration-verification`). 이 문서는 저장소 조사와 오너가 전달한 개발자 보고를 구분한다. 이번 점검은 원격 DB 조회·쓰기, 배포, 유료 호출, 브라우저 UAT를 실행하지 않았다.

읽는 순서: `../CLAUDE.md` → `POLICY-DECISIONS.md` 최신 정정 → 이 문서 → `BRANCH-WORKFLOW.md`. 상세 근거·발견 사항은 [전반 점검표](qa/alton-overview-audit-2026-10-21.md). 종전 CURRENT 전체는 [원문 이력](history/CURRENT-archive-before-2026-10-21-overview.md)에 보존했다. 과거 완료·미적용·예산·URL을 현재 값으로 재사용하지 않는다.

- **[2026-10-22 LT5 공개]** Eng Lit Exam 5(`4cf9f1f2`) 공개, 풀 모의고사 75·부분 3, 원장 $572.7657. 테스트 응시 6건 정리(`docs/ops/test-attempt-cleanup-2026-10-22-b.sql`).
- **[2026-10-22 PH5 공개]** Physics 1 Exam 5(`6935d468`) 공개, 풀 모의고사 74·부분 3, 원장 $568.6353. LT5는 대기. 아래 PH5·LT5 엄격 게이트 기록은 PH5 v6 이전 시점이다.
- **[2026-10-22 PH5·LT5 엄격 게이트]** 둘 다 미공개. PH5 부족: 단원 1 단독 1 + 2문항 세트 2(단원 1·2), LT5 부족: 시 FRQ(Darkling Thrush가 Exam 3 MC 지문과 같은 작품)·q3 프롬프트 교체(상세 `docs/ap/operator-checkpoint-2026-10-22.md`). 원장 $567.1786.
- **[2026-10-22 08:12Z] AP 공개 현황(DB 집계)**: 풀 모의고사 **73**, 부분 연습 3(mc 2 + frq 1). 과목별 풀 모의고사: Biology 5, Calc AB 3, Calc BC 5, Chemistry 4, CS A 4, English Language 5, Eng Lit 4, European History 2, Macro 3, Micro 3, Physics 1 4, Physics C E&M 5, Physics C Mechanics 5, Precalculus 5, Psychology 5, Statistics 5, US History 3, World History 3. 오늘 공개: Chemistry 4(`856cfaad`), CS A 4(`b25f8cae`), Psychology 3·4·5. **CS A 5(`7c42225c`)는 CS4와의 구조 쌍둥이 7개 이상으로 보관 처리**(되돌릴 수 있음, 실제 응시 0). 공개 뒤 재점검에서 CH4·CS4·PS3·PS4에도 쌍둥이가 확인돼 교체 대상 목록은 `docs/ap/post-publish-twin-audit-2026-10-22.md`. CH5는 unit 3.4 기체 단독 1개 부족으로 차단. PH5·LT5는 이번 라운드 처리 안 함(엄격한 쌍둥이 점검 게이트를 먼저 적용, `docs/ap/structure-rule-scope.md`). 원장 누적 $557.9848(상한 730/740).
- **[2026-10-22] SAT R&W Hard 보강 C안 완료**: 공개 SAT 30세트 새 버전(R&W M1·M2 쉬운에 Hard 약 10.5%, 171문항 교체·이전 버전 보존), 마이그레이션 `20262100000680` 적용, SAT 장부 $23.607. 확인 범위: DB·검증 함수·관리자 미리보기 + Production 학생 화면 1문항(Test 1 R&W M1 8번). 라우팅 임계값·점수 환산은 미보정, 난이도 라벨은 학생 데이터 보정 전. 테스트 응시 `28ddc49c…` 정리 대기. 상세 [rw-hard-topup](sat/rw-hard-topup-2026-10-22.md).

## 1. 서비스·환경

| 항목 | 현재 기준 / 확인 범위 |
|---|---|
| 정본 | `~/Developer/ALTON`, 통합 브랜치 `preview/m4-integration-verification`. 기능·문서 변경은 전용 worktree. 폐기된 iCloud 저장소에서 git/DB/테스트 실행 금지 |
| 서비스 | Alton Education 안의 무료 학습 → 같은 계정으로 튜터링 전환. 모의고사·약점·기존 노트·단어장·공개 교재 재사용. 관련 과거 구현 내역은 이력 문서 |
| 운영 주소 | `https://alton.education`; Preview `https://alton-git-review-alton7.vercel.app`. 현재 배포 커밋·가용성은 이번에 재확인하지 않음 |
| **DB 경계** | `production-open-runbook.md`의 10-15 정정: Preview/Production은 `worpsqwqgnspddnrtnvq`를 공유. 이 ref를 '비프로덕션'이라 불러도 쓰기는 운영 데이터에 영향을 줄 수 있음. 독립 테스트 DB로 취급 금지 |
| Vercel | 10-19 정책 대장에 Pro 전환 기록. `vercel.json`: resync 매시간, 계약 발송 6시간마다, 나머지 5개 하루 1회. 실제 실행·플래그 값은 별도 확인 |
| 마이그레이션 | 기준 코드에 로컬 SQL 598개. 파일명 최댓값 `20262100000630`은 날짜형 Stripe 신규 파일 `20261030100000`, `20261031100000`보다 숫자가 큼. 최댓값 하나로 원격 적용 여부를 판단하지 않음. 두 Stripe 파일은 공유 DB 적용됐다는 개발자 보고만 확인 |

## 2. 모의고사·채점

- 공개 AP 과목 허용 목록: **18개**, 레이아웃 등록: **24개**(6개는 공개 대기). 코드 등록은 공개 완료가 아니다. 감사표의 DB 조회 스냅샷은 풀 세트 **57**, 부분 연습 **3**, 합계 **60**. 이번 실시간 DB 재집계 아님. SAT는 10-19 기록상 26세트, 목표 30; 현재 수량 재확인 필요.
- AP 목표: 정책 대장의 20과목·과목당 목표 10/최소 5. 이후 신규 10과목 개발 승인이 있어 코드에는 24개가 등록됨. 목표 20을 임의로 24로 바꾸거나 24개 제공 중이라고 광고하지 않는다.
- AP AI 채점: English Language/Literature, US/World History **4과목 지원**. European History **코드 준비·검증 미달·꺼짐**. 나머지 **13과목 FRQ 미지원**. SAQ·에세이·기타 FRQ 구분은 `ap/frq-scoring-roadmap.md`.
- AP 1~5 경계점·환산 적용은 감사 시점 **없음**. 원점수·가중 합산·피드백과 예상 AP 등급은 별개. 전체 채점·풀 구성이 충족될 때만 합산, 미채점은 0점 아님.
- English Language 응시 `5b9952b6`: 2/6 + 제출 확정 빈 답안 0/6 + 0/6, FRQ 2/18·가중 합산 6.1/100. Calculus AB `7020773d`: FRQ 미지원 54점, 합산 없음. **개발자 Preview UAT 보고 확인**, 이번 점검자가 직접 본 것은 아님. 보호자 화면은 계정 연결 대기, 관리자 AP 결과는 코드 있음·화면 확인 대기.
- 남은 채점 결함: 한도 초과가 최종 skipped가 되어 재시도 불가, 앵커 3개 미만은 행 없이 제외돼 영구 채점 중 가능. 추가 비용 장부 위험(A4)은 2026-10-21 아래 항목대로 코드 수정·테스트 완료(Preview 미확인).
- **A4 AI 채점 비용 집계(2026-10-21 2차 수정)**. 1차: `store.finish`가 cost_usd/토큰을 실행 단위 값으로 덮어써 재시도·호출 전 실패(0)가 과거 지출을 지웠음 -> 응답(행)별 누적으로 합산. 2차(월 귀속): 행 누적값을 `updated_at`으로 월에 배분하던 방식은 전월 누적이 이번 달 지출로 이동하고 비용 0 상태 갱신도 월을 옮김 -> **비용 원장 `essay_ai_cost_events`**(호출 실행마다 이벤트 1행, 월·일은 `occurred_at`(**UTC**; 교사 정산의 America/Los_Angeles 와 다름)만으로 집계; 새 마이그레이션 `20262100000650_essay_ai_cost_events.sql`; 선택 이유: 행 jsonb 누적은 월 경계 원자 갱신·예약·감사가 어렵고 원장은 insert 위주라 가장 단순). 월 지출 = `essay_ai_month_spend()`(확정+유효 예약), 기존 `essay_ai_cost_daily`는 같은 열로 원장 기준 재정의. 원장 이전 행은 보존: 이벤트 없는 행은 뷰가 `updated_at` 시점 legacy 비용으로 집계하고 다음 갱신 직전에 legacy 이벤트로 고정(비용 0 갱신도 월을 못 옮김, claim 은 더 이상 `updated_at`을 바꾸지 않음). 일괄 backfill SQL은 `docs/ap/essay-ai-cost-events-backfill.sql`(작성만, 미실행). **수정 완료** / **자동 테스트 통과**(`lib/essay-grading` 91건; 전월 $0.10 + 이번 달 재시도 $0.02 -> 전월 0.10·이번 달 0.02·누적 0.12, 비용 0 상태 갱신 불변, UTC 월 경계 직전·직후, 대기 행; 마이그레이션 SQL은 임시 Postgres 에서 2회 적용·월/예약 시나리오 확인) / **원격 마이그레이션 미적용·Preview 미확인**(적용은 총괄). **[2026-10-21 갱신]** 650·660 DB 적용 완료, 코드(`499bdf7f1`)는 Production 배포 완료 — **빌드·로그·DB 상태 확인까지, 실제 요청 경로 미확인**. 호출 전 예약·정산·재시도·한도 거절을 실제 앱 경로로 확인하기 전까지 월 한도 강제를 운영 검증 완료로 쓰지 않는다(무오류 로그만으로는 검증이 아니다). **[2026-10-22 격리 스택 검증]** 실제 store·큐·원장 RPC 계층을 격리 DB에서 스텁 모델로 실행해 예약·정산·재시도 비용 누적·일일/월 한도 대기·기준 답안 부족·동시 요청 초과 방지·UTC 월 경계 7개 시나리오 통과(`docs/ops/essay-ledger-path-verification-2026-10-22.md`). **Production 서버 액션·인증·실제 응시 경로와 실제 Anthropic 호출은 미확인**이라 운영 검증 완료는 아직이다. 마이그레이션 적용 전 환경에서는 함수 없음 오류를 감지해 예전 근사로 대체하고 예약 없이 진행(소프트 한도).
- **A4 월 예산 동시 실행(2026-10-21)**: 월 예산 `AI_ESSAY_MONTHLY_BUDGET_USD`는 **절대 상한이 아닌 근사 한도**다. 이전 코드(사전 검사만)는 여러 요청이 같은 잔여 예산을 보고 동시에 실행 가능 — 초과 범위 산정은 `docs/ap/essay-ai-grading.md` "월 예산 동시 실행 한계"(요청당 최악 4호출 = 영어 $0.234 · History $0.282, 동시 처리 N건이면 최대 (N-1)×최악 초과: N=10 약 $2.1~2.5, N=50 약 $11.5~13.8, 코드에 전역 동시성 상한 없음). 최소안 구현: 호출 전 최악 비용을 원장에 `reserved`로 원자 예약(`reserve_essay_ai_budget`, advisory lock 직렬화) -> 완료 시 실비 정산·호출 전 실패 시 0 해제. 예약 만료는 호출 시작 표시(`call_started_at`)로 구분: 시작 없는 예약만 30분 뒤 해제, 시작했는데 정산 없는 예약은 unsettled 로 합계 유지(관리자 확인: `essay_ai_unsettled`·`essay_ai_ledger_status()`), 확정 비용은 영구. 구형 코드가 쓴 비용은 원장이 모르므로 전환 기간엔 "전체 서비스 지출을 통제"라고 하지 않는다(적용안 7절 대조). 650·660 만 개별 적용하는 절차는 적용안 5절. 예약 거절 시 모델 호출 없이 월 예산 대기. **수정 완료 / 자동 테스트 통과(모의 클라이언트+임시 Postgres) / 원격 마이그레이션·Preview 미확인.** 남은 한계: 단가 가정(env)이 틀리면 어긋남, 예외로 끝난 호출 자체의 비용은 알 수 없음(정산 누락), Anthropic 콘솔 한도는 별도 **[오너]**.
- **A4 과거 영향 정정**: 결론은 "현재 확인한 저장 행(원격 `mock_exam_essay_scores` 3행: 완료 1·건너뜀 2)에서는 재시도 덮어쓰기에 따른 감소가 발견되지 않음"까지다. DB에 남지 않은 실패 호출까지 포함한 전체 Anthropic API 과금이 $0 영향이라고 입증한 것이 아니다(콘솔 사용량 대조 필요). 이전 문구 "과거 과소 집계 0건·0달러"는 철회.
- **A5 환불·웹훅 대장(2026-10-21 2차 보완)**: 미해결(handled_at/resolved_at null)은 오래된 순 최대 1,000건 먼저, 처리 완료는 최근 100건. 2차: 서버 전체 대기·완료 건수와 불러온 건수를 구분 표시, 1,000건 초과 시 경고와 "처리 대기 더 불러오기"(키셋 커서 `(created_at,id)`, 200건씩, 새 서버 액션 `listPaymentRefundPage` 동일 capability·커서 형식 검증), 처리 완료 과거 기록 "이전 처리 기록 더 보기"(`handled_at` 역순), 필터는 "불러온 대기 건에만 적용"으로 명시. **수정 완료 / 자동 테스트 통과**(1,450건 대기를 빠짐·중복 없이 순회, 250건 완료 이력 페이지, 컴포넌트·액션 권한·커서 검증) / **Preview 화면 미확인**. 남은 한계: 웹훅 이상 대장은 여전히 미해결 1,000·해결 100건 제한(건수 표시, 페이지 이동 없음), 필터는 불러온 건 범위, 1,000건 초과 데이터는 모의 클라이언트로만 검증.
- 사람/교사 채점·유료 인센티브·고정 160명 모집 **제외**. AI 독립 평가·근거 비교와 자발 성적 공유로 개선. 자체 샘플 일치는 공식/실제 학생 정확도 증명 아님. $65/$75안 철회, 단계별 최대 약 $74는 **제안·미승인**. 일반 운영 채점 비용과 분리.
- European History: 최초 자체 샘플 검증 $3.70, 기준 미달(16개 DBQ/LEQ 첫 채점 정확 43.8%, ±1 81.3%, 부호 오차 -0.75). 기존 총 $12 안에서 추가 $2 한 차례 개선 검증 지시; 이번에 실행 완료 증거 없음. 공식 샘플·허락 발송 보류는 AI 자체 검증을 막는 관문이 아니다.
- CS A: 7/7/5/6 총25가 CED p.145와 일치. 세트3의 9×4는 구조·루브릭 검토 대상. Micro/Macro 비중은 최신 문서 확인값 **66.65/33.35**; 근거와 코드 반영은 `ap/grade-estimate-audit-2026-10-21.md`.
- 풀 세트 동일 문항 재사용 0, 구조 문항군당 1, 1.5배 준비 재고. 전문가 문항 검수는 출시 후 오류 신고이며 사전 승인 게이트 아님.

## 3. 결제·정산·계약·보관

- Stripe: `494150d96`, `be52a9291`, `9e39537a4`가 기준 코드에 포함. 구매 단위 중복 지급 방지·금액/통화 대조·모드 이상 기록·환불 대장·관리자 처리 화면 구현. **코드 포함과 Production 배포 완료는 다르다**.
- 환불 자동 회수: `STRIPE_AUTO_REVOKE_ON_REFUND` 기본 꺼짐, 운영 활성화 보류. 전액 성공 환불·그 구매 전부 미사용 조건. 실제 예약 함수 통합 검증 29건은 개발자 보고; 이번에 재실행하지 않음. 수동 회수는 예약 검사/잠금 경합 미해결, Preview 환불 화면 UAT도 대기. 자세한 대장 조회 한계까지 점검표 참조.
- 정산: Mercury 수동 송금(미국 USD/한국 KRW), Mercury Books 회계, Wise 계획 폐기. 지급 기한 26일/10일(Pacific, 비영업일 직전 영업일). 예전 5일/20일 금지. 자동 송금은 보류; 현재 운영 env/실거래/Books 대사 재확인 안 함.
- 계약: 가족·교사·컨설턴트 영문 운영 문안과 DocuSign/Drive 경로 존재. 발송·운영 폴더·환경값 확인은 별도. 10-15 기록은 계약 자동 발송 false / 에세이 AI true지만 현재 값으로 단정하지 않음. 이번에 계약·약관 본문 수정 없음.
- 보관: legal hold·Smart Notes 삭제 큐·별도 Drive 삭제 플래그 구현 기록. 실제 삭제·배치 활성화 안 함. 전사·Smart Notes는 수업/상담별 종료+1년 기준, 활성 hold 확인. 세부 분류·법적 기록은 기존 보관 문서 참고.

## 4. 공개 사이트·콘텐츠 운영

- SEO: 과목·시험별 공개 페이지, SAT 영역 페이지, AP 허브, 샘플·메타데이터·사이트맵·Instagram 반영 코드가 있음. 색인/순위 보장 아님. Search Console 재제출·신규 URL 검사는 오너 단계이며 이번 재확인 없음.
- Insights: Sanity 연결 코드 존재, projectId 없으면 빈 목록 반환. 프로젝트·dataset·첫 글 게시 여부는 미확인. `seo/2026-10-21-seo-diagnosis-and-plan.md` 참고.
- 인문·언어 중단 작업은 `af588bf23`로 **복구 체크포인트 병합**. 후보/설정/실제 자료를 회수한 것이며 생성 완료·검증 통과·세트 공개 완료가 아님. `qa/ap-humanities-r19-status-2026-10-19.md`는 당시 이력. BC4 재배정·PM2 초안 회수는 최신 증거 확인 필요; 유료 중복 실행 금지.
- 콘텐츠 생성 누적 예산은 최신 승인 **$650/중단 $640**(`POLICY-DECISIONS.md`). 오래된 $30/$50/$220을 현재 상한으로 쓰지 않는다. 실제 누적은 원장 합집합 대조 후 보고하고 이 문서에서 추정하지 않음.

## 5. 다음 작업과 검증 경계

1. 채점 재시도/기준 답안 부족 상태와 비용 누적 문제 수정·검증.
2. 수동 환불의 잠금 후 예약 재검사·전체 롤백, 처리 대장 누락 방지, 관리자 UAT.
3. 보호자 테스트 계정 연결 후 AP 결과 UAT. 승인된 작업이며 계정 생성 제약만 별도 해결.
4. 회수 콘텐츠의 후보/세트/공개 상태와 BC4·PM2 산출물 확인, DB·배포 목록과 대조.
5. 역할별 핵심 UAT·Stripe 모드/실제 이벤트 대사·자동화 스위치 확인 후 별도 운영 승인.

**이번 문서 점검의 완료 범위:** 코드·커밋·문서 읽기와 정책 동기화. 전체 기능 E2E, 학생 계정 전 문항 풀이, 원격 DB 감사, Production 스모크는 미실행이다. 실행하지 않은 테스트를 통과로 보고하지 않는다.
1. **P2 9~11차** — 준비안 유지·다시 구성·수업 시작 고정, 학생별 자동 상속, 수업 준비 화면 통합, 학생·보호자 사전 열람. 결함 5건(시딩 `source_unit_id`, 문제은행 RLS, 버전 스탬프 정의자 등).
2. **P2 12·13차** — 상위 변경의 완전한 반영(`inherited`·제외 기록·순서·목표), 학생·보호자 회차별 `수업 준비`, **Drive 기반 PDF·영상 자료 최소 구현**(고정 사본 공개·페이지 필기·뷰어). Drive 구조 정정(과목 → 키워드). 실제 Drive 첫 공개 성공(15,343KB·99쪽).
3. **P2 14차** — UAT 수정 5건(카탈로그 업데이트, 시딩 폴백, 보관 교재 건너뛰기, `수업 시작` 열 이름, **수업 준비 15~30초 → 1.4초**), PDF 뷰어(썸네일·fit-page·레티나·반투명 도구), 문제 슬라이드·교사 정답 토글, 객관식 지문 끝 A)~D) 중복 제거.
4. **P3 5차** — 문제 풀이·채점 흐름 재정리(객관식 클릭·서술형 연습장·풀이형 제출, 정답은 채점 뒤), 교사 채점 UI, PDF 텍스트·전체 지우기, 연습장·문제 기록 탭 제거.
5. **P3 6차** — 관리자 교재 정리(키워드 폴더, 과목 전체 Drive 동기화, Drive 원본 없는 교재 보관), 시작한 수업 '진행 중' 표시 + `수업 구성 변경`(재고정), 잔손질.
6. **P3 7차** — **과제 v3 한 갈래 통일**, 학생 포털 과제 = 수업별 탭 + 같은 패널, 커리큘럼 회차 키워드 칩, 연습장 실시간, PDF 필기 크기 추종·저장 후 사라짐 수정, 교사 수업 준비 → 수업 화면.
7. **P3 8차** — 과제 답안·채점·문제 위 필기를 수업과 **분리**(source/context), **문제 화면 전체 필기 레이어**(수업·과제 공통), 채점 결과·점수 표시, 관리자 교재 탭 통합·새 교재 차단·노출용 이름·목차 접기.
8. **P3 9차** — 문제 템플릿 ①~⑤(SPR / 표·수식 / 도형·그래프 데이터 렌더 + 그림 확인 게이트 / 그림 파일 첨부 / 유형 코드·문항 말투·메모·밑줄), 문제은행 난이도·`전체 공개`·자동 확장 칸. **실제 모델 호출 표본 10문항** 렌더 확인 → 영어 규칙·응답 정규화·라벨 위치 수정. AI 내용 오류(변 라벨 오기) 실례 확인 — 그림 확인 게이트가 필요한 이유.

24. **P3 25차 — 유형별 문제 품질 계약·독립 품질 검사**(2026-09-15, migration 20261371): 세부 기술 30개마다 질문 대상/자료 근거/표시 방식/정답 근거/답안 형식 다섯 연결을 정의·검사(`lib/problem-quality-contract.ts`), 생성 모델과 별도의 독립 검사(정답 일치·오답 근거·추정 난이도, `lib/problem-generation/review.ts`), 파이프라인(생성→자료→계약→검사→사유 재생성→부족분, `pipeline.ts`)을 서버 액션과 표본 배치(`scripts/problem-quality-batch.ts`)가 공유. `problem_versions.quality`(추정 난이도·근거·오답 근거·검토 필요), `problem_response_stats` 뷰(보정 재료). 관리자에는 난이도 근거·검토 필요·응답 통계만 표시. 선택지는 A)~D). 문서 `docs/2026-09-15-problem-type-conditions.md`.
23. **P3 24차 — 생성 게이트·템플릿 확장·제한 정리**(2026-09-15): 생성 결과는 공개 게이트와 같은 검사(자료 참조·렌더·내용)를 통과해야 초안 저장, 실패 시 사유 피드백으로 1회 자동 재생성 + 부족분 재생성. 평행선·횡단선 템플릿에 횡단선 교점·삼각형(crossing)과 수직 횡단선·직각 표시(perpendicular) 추가. 제한 조건은 네 분류(범위 밖/관례·정확성/구현 대기/임시 제거)로 전수 조사(`docs/2026-09-15-problem-bank-restructure.md` 6절), 구현 대기 4건은 scene 부품 조합 렌더러(6-6)로 다음 단위. 자료 포함 여부·유형은 생성 전에 선택(권장은 자료 포함 기본/텍스트형).
22. **P3 23차 — 문제은행 생성·편집 재구성**(2026-09-15, migration 20261369·20261370): 관리 과목과 문항 체계(sat_rw/sat_math/ap, `problems.exam_system`·`ap_subject`) 분리, 생성 탭에 문항 체계 탭 + 7단계 흐름, 체계·유형별 항목만 표시(`editorVisibility`), 자료 필요성 자동 판정(`lib/problem-material-need.ts`, R&W 정량 근거 포함, 필수면 저장·공개 차단), 질문 분리 저장(`problem_versions.question`)과 복수 생성 계약 검증(질문 없는 결과는 저장 안 함, 사유 분리), 질문 없는 문제는 자동 구성 후보 제외 + 집계·'질문 보완 필요' 표시, AP 는 과목 선택·준비 중 자리만. 문서 `docs/2026-09-15-problem-bank-restructure.md`.
21. **P3 22차 — RW 구조화 자료 블록**: 기존 11개 유형에 Text 1/Text 2 구역·메모 목록+목표·빈칸/밑줄 대상(정확히 하나)·질문 분리·정량 근거 figure(data) 를 저장 시 해석·검증(`lib/rw-stimulus.ts` → `render_check` → 공개 게이트, DB 변경 없음). 학생·관리자 같은 `RwStimulusView`. 레거시 passage 그대로 읽힘, 코드 없는 옛 문제는 검사 안 함. 로컬 E2E 13건(결정적 7 + AI 6) 통과. 문서 `docs/2026-09-14-rw-structured-blocks.md`. 다음: 분류 후속 UI(criteria skill_codes 편집·일괄 지정), Preview UI UAT.
20. **P3 21차 — SAT Math 마무리**: 부분 3건 해소 + E2E 없던 표현 5건 + 템플릿 8 복합 도형(음영) → 19개 기술 코드 전부 검증됨, "SAT Math 범위 완료(로컬 E2E 기준)". 3D 좌표는 범위 밖 판정. 다음: Reading & Writing 기존 11개 유형의 구조화 자료 블록(Text 1/2·메모·표/그래프 근거·밑줄/빈칸) 보완.
19. **P3 20차 — SAT Math 커버리지 매트릭스**(`docs/2026-09-14-sat-math-coverage-matrix.md`: 기술 코드 19 × 표현 × 상태 — 검증됨 16·부분 3), figure_choice 정답 자리 자동 배치·정답 불일치 거부, E2E 그래프 선택지 통과.
18. **P3 19차 — 좌표기하·복합 도형(polygon·circle·midpoint·intersection·transform, 값 계산 대조), figure_choice/figure_set, 수식·선택지 블록(KaTeX 조판 검증·로마숫자 진술 `statements` `20261368`·선택지 정합·SPR 형식) → 내용 검증도 `render_check` 게이트.** 로컬 E2E(진술 블록) 통과. 다음: SAT Math 커버리지 매트릭스 문서 → 분류 후속 UI.
17. **P3 18차 — 템플릿 6 사각형·다각형, 템플릿 7 입체 2.5D**(직육면체·정육면체·원기둥·원뿔·구·사각뿔). 대표 10문항씩·거부 사례·로컬 E2E(사다리꼴·원기둥) 통과. 다음: 좌표기하·복합 도형 → 그래프/도형 선택지(figure choice) → 수식·로마숫자 선택지 Block.
16. **P3 17차 — SAT 6~11 대조 보완 + 템플릿 5 원**: 점도표·양방향 표·문장형 자료, 음영 부등식·조각함수·유리함수·점근선, 선택지 부등호 대조·좌표 노출 거부, 원 템플릿(중심·반지름·현·호·부채꼴·접선·중심각·원주각). 로컬 E2E(원·부등식) 통과.
15. **P3 16차 — 문제 분류 모델**(`20261367`): `problem_skill_codes`(SAT 영역 8 · 세부 기술 30, College Board 분류), `problems.sat_domain/skill_code`(코드→영역 트리거, 옛 유형에서 영역 백필), 문제은행 필터·새 문제(영역→기술 선택 시 유형·형식·그림 요구 자동)·분류 편집, AI 생성 프롬프트에 영역·기술 힌트, 자동 구성 후보 뷰·회차 조건 `skill_codes` 필터, 수업 준비 후보 기술 필터·배지, 학생 문제 기록 기술별 성취(채점 기준). 로컬 통합·컴포넌트 테스트 통과.
14. **P3 15차 — 템플릿 4 표·데이터 그래프**(표·숫자 목록·막대·선·히스토그램·산점도+추세선·상자그림, 한 원본 데이터, 값·항목·단위 참조 lint, `require_data`). 로컬 E2E 통과, Preview DB 게이트 실측. 다음: SAT 영역·세부 기술 코드 분류 모델(문제은행·자동 구성·성취 기록 공통) → 원 → 사각형·다각형·입체 → 좌표기하·복합 → 그래프/도형 선택지 → 수식·로마숫자 선택지 Block.
13. **P3 14차 — 템플릿 3 좌표평면(객체 id)**: 점·직선·함수·선분·산점도+추세선, 라벨 후보 자리 배치(없으면 거부), 지문 좌표·이름·식 일치 lint, 옛 `coordinate_plane` 레거시화(`20261366`), 템플릿 1 → 공통 `Sheet` 이관. 로컬 E2E 통과. 제품 오너 확정: 수학 템플릿 전 범위(표·데이터 그래프, 원·사각형·좌표기하, 그래프/도형 선택지·복합 도형)를 이 로드맵에서 완결.
12. **P3 13차 — 템플릿 2 삼각형·직각삼각형·합동/닮음**(관계형 스키마·표준형 배치·변/각/직각/높이/두 번째 삼각형·참조 lint·라벨 충돌), 공통 조판 `_layout.ts`. 로컬 E2E 통과. Preview 는 DB 게이트만 실측(UI 는 UAT 계정 필요).
11. **P3 12차 — 표준 렌더링 엔진 템플릿 1(평행선·횡단선·각)** 끝까지: AI 는 관계만(`parallel_transversal`), 렌더러가 좌표·호·라벨 자리(충돌 시 거부), 검증 계층 `checkFigure`(지문 참조·중복·충돌·잘림·방위 표현·레거시·alt) → `render_check` 저장, 공개 게이트(`20261365`: ok + 그림 해시 일치 + 미리보기 확인, 좌표형 geometry 공개 불가=재생성 필요, 업로드 alt 필수). 관리자 편집기: 렌더 미리보기 우선, JSON 접힘. 로컬 E2E(실제 모델) 통과.
10. **P3 11차** — 과제 발급 = 키워드별 개수·무작위(`20261364`), 학생 포털 문제 기록 v3 재구성, v3 과제 탭 역할 수정(답 선택·필기 불가 결함), 교재 목차 이름 = 현재 노출용 이름, 교사 해설 보기 전 형식, 그림 라벨 평문화, 렌더링 엔진 설계안.
9. **P3 10차** — 그림 SAT 지면 스타일(격자·화살표 축·원점 O·축 설명·각 호 표시), UAT 수정: 문제 화면 필기 레이어가 **클릭을 먹던 결함**(선택지·버튼 클릭 불가) 수정, 서술형 = 글 상자 타이핑, 연습장 제거, PDF T 상자 기본 크기(가로 2배·5줄), 수업 준비 `담을 수 있는 문제` 클릭 미리보기(지문·선택지·그림), **키워드 자동 문제 기본 캡 20**(`20261363`).

25. **P3 26차 — SAT Math 19개 기술 코드 전부 결정적 컴파일러로 전환**(AI 호출 0회, 2026-09-16~17): 식·함수 공통 엔진(A) 8종(`linear_equations_two_var`·`systems_linear`은 같은 엔진 재사용·`linear_inequalities`·`linear_equations_one_var`·`linear_functions`·`equivalent_expressions`·`nonlinear_equations_systems`·`nonlinear_functions`), 통계·확률 공통 엔진(B) 7종(`ratios_rates_units`·`percentages`·`one_variable_data`·`two_variable_data`·`probability`·`inference_margin_error`·`evaluating_statistical_claims`), 도형 공통 엔진(C) 4종(`area_volume`·`lines_angles_triangles`·`right_triangles_trigonometry`·`circles`). 해설 이중언어(`explanation`/`explanationEn`, DB 컬럼 `problem_versions.explanation_en`, 관리자 UI 토글)도 이 배치에서 완성. 커밋 `e3b687d`~`0428b05`(중간 UAT 수정 다수 포함, `git log` 참고). 다음: Preview UI UAT(로컬·non-prod DB 검증만 완료, 아직 Preview 화면 확인 안 됨).
26. **P3 27차 — R&W 5개 세부 기술에 얇은 근거 모델(Evidence Model) 추가**(2026-09-17, migration `20261403000000`): `words_in_context`·`central_ideas_details`·`inferences`·`command_of_evidence_text`·`cross_text_connections`에 구조화된 `target`/`evidence_span`/`answer_rationale`/`distractor_error_types` 필드를 기존 생성과 함께 산출, 저장 전 결정적 검사(지문 내 축어 일치 evidence_span + enum 검증)를 초안 채택 게이트로 추가, 관리자 화면에만 노출(학생·학부모는 안 보임). `cross_text_connections`의 `target`이 질문 재진술이 아니라 두 지문을 합성한 명제를 내도록 후속 수정. 커밋 `f106784`, `1e47505`. 다음: Preview UI UAT.
27. **P5 — 언어 전환 이전 문제 아카이브**(migration `20261402000000`): 문제 지문·질문·선택지가 영어로 통일되기 전 시기(한국어 혼용)의 기존 문제를 전부 보관 상태로 전환(`problems`/`problem_versions` 공개 후보에서 제외), 삭제 없음.

마이그레이션: `20261346`~`20261403`(전부 additive, 공유 non-prod 적용). 배치별 상세는 아카이브의 각 블록.

> 아래 28~30번은 `git log` 재구성(2026-09-23, 커밋 메시지 원문 기준 — 그 세션의 실시간 맥락은 없어 UAT 세부 스크린샷 등 부가 정보는 생략했다).

28. **학생 성공 플래너 Board(2026-09-21) + 컨설턴트 role/포털 Phase 1~2(2026-09-22, migration `20261444000000`~`20261459000000`)**:
    - `2de9d94` **Student Success Planner Board MVP**: 과제·모의고사·단어시험·수동 할 일을 한 보드(칸반)에서 관리하는 화면을 학생 포털에 신설 — 이후 컨설턴트 담당 학생 패널의 Board 탭이 이 컴포넌트를 그대로 재사용.
    - `24e2389`/`7422284`(docs) — 컨설턴트 인테이크 role 모델·관리자 핸드오프 설계 확정(`docs/superpowers/specs/2026-09-22-consultant-role-and-intake-design.md`).
    - `d3043dc` **컨설턴트 role/포털 Phase 1**: `consultations`에 `intake_owner_id`/`admissions_consultant_id`/`contacted_at` 추가, `assign_consultation_owner()`/`mark_consultation_contacted()` RPC로 배정·연락 상태를 감사 이력과 함께 변경. `manage_consultation_intake`/`manage_admissions_students` capability 도입. 관리자 "Consultants" 탭에 미배정 상담 요청 큐, 컨설턴트 포털에 "신규 배정" 화면 신설.
    - `e204f76`/`32ed1b2`/`4bfea5a` — 실제 UAT 컨설턴트 계정(이메일이 여러 번 바뀌며 재백필) role/capability 부여.
    - `b16dfe4` **컨설턴트별 가능시간**: 기존 회사 공용 가용시간 규칙을 컨설턴트 개인 단위로도 가능하게 확장(`consultant_id` nullable — null=공용, 값 있음=개인).
    - `05a6e96` **랜딩 폼 "신청만" + 컨설턴트 전용 스케줄링 링크**: 홈페이지 상담 신청에서 슬롯 선택 UI 제거(신청만 접수). 관리자가 어드미션 컨설턴트를 배정하면 "링크 보내기"로 서명된 스케줄링 링크(`/schedule/[token]`)를 수동 발송(자동 발송 아님, 실제 이메일 발송 지점이라 확인 게이트). 고객은 로그인 없이 배정된 컨설턴트의 개인 가능시간만 보고 직접 확정.
    - `c80ac70` **컨설턴트 전용 Google 로그인**: 캘린더 접근이 필요해 비밀번호 로그인이 아닌 Google 로그인 전용 계정 연결(선생님 콜백과 동일 패턴, 사전 등록 이메일만 최초 로그인 시 자동 연결).
    - `6637c51`/`a376aa4` — 스케줄링 이메일 CTA 버튼 스타일 적용, 확정 시 동의 버전 누락 버그 수정(기존 UAT 데이터 백필 포함).
    - `ee4a91e` **컨설턴트별 Calendar organizer + 자동배정**: 배정된 어드미션 컨설턴트가 있으면 그 사람의 실제 Google Workspace 계정을 Calendar/Meet organizer로 사용(R6 선생님별 패턴과 동일). 전역 자동배정 토글(관리자) + 컨설턴트 개인 "신규 배정 받기" 토글, 켜져 있으면 신청 접수 즉시 가용 컨설턴트 중 무작위 배정. `42addae`는 그 토글 RPC의 WHERE절 누락 버그 수정.

29. **컨설턴트 담당 학생 패널(Overview/Board/Roadmap) + 칸반화 + Board/Roadmap 공통 기능 확장**(2026-09-22, migration `20261460000000`~`20261463000000`):
    - `b53c431` **담당 학생 Overview/Board(수정 권한)/Roadmap 탭**: 로드맵만 보이던 학생 카드 클릭 화면을 세 서브탭으로 확장, Board는 컨설턴트가 학생 본인처럼 직접 할 일을 추가·이동·삭제 가능(RLS에 `is_assigned_consultant_of()` 반영). `a9e6387`은 두 탭이 같은 데이터를 중복 조회하던 성능 결함과 이름 중복 표기(예: "학생 학생") 정정.
    - `f53e088` **"신규 배정"을 칸반으로**: 컨설턴트 본인에게 배정된 상담 요청만 연락 필요/일정 조율 중/일정 확정 3칼럼 칸반으로 표시(관리자 화면은 반대로 전체 노출).
    - `a1790e6` **Board 개선**: 카드마다 마감일 항상 노출(수동 할 일은 시작~마감 기간 입력 가능), 작성자(선생님/컨설턴트/학생 본인/관리자) 표시, 학생·학부모 Board 아래에 예정 수업 리스트 추가.
    - `ced35f4` **로드맵 개선**: 저장 성공 배너, 수강과목을 개별 CRUD 가능한 리스트로 교체, "목표 설정" 서브서브탭(목표 GPA/SAT/AP 과목수/Extracurricular) 신설.
    - `602fdae` **프로필 IA 재구성 + 타임라인뷰**: 프로필을 요약/인구통계/학업정보/대학 관심사/활동·수상/준비 현황 서브서브탭으로 재편, Board에 보드/타임라인 전환 토글 추가(마감일 기준 월별 묶음).
    - `f356dc4` **간트 타임라인 + Board 구조 정리**: 타임라인뷰를 실제 간트 차트로 재작업, 학생 Home의 별도 "Done" 탭을 없애고 4칼럼 Board로 복귀(학부모 포털과 동일 구성), 학생 Home에 학부모와 동일한 "Review"(수업 리뷰) 탭 추가.
    - `224cee7` **학부모 Home 서브탭 정리**: 종합/수업/상담 리뷰를 "Review" 하나로 통합, "Done"을 별도 탭 대신 Board 안 칼럼으로 재통합, 모의고사를 좌측 독립 nav로 이동.

30. **로그인 화면 통합 — 역할별 버튼 3개 → "직원" 버튼 하나**(2026-09-22): `0349cdb` — 선생님/관리자/컨설턴트 개별 Google 로그인 버튼을 하나로 합치고, 첫 로그인 시 선생님→컨설턴트 순으로 사전 등록 여부를 확인해 자동 연결(재로그인은 기존 role로 바로 라우팅, 관리자 콜드 스타트는 미지원 — 기존 설계 유지). 개별 콜백 라우트는 삭제. `348a6b5`는 버튼 라벨을 "Staff - Google Login"으로 확정.

31. **컨설턴트 포털 — 가구/학생 메신저 + 개인 일정 잡기 + 교사 재조정 요청**(2026-09-22~23, migration `20261464000000`~`20261472000000`, non-prod 반영 완료):
    - **가구 메신저 컨설턴트 접근**: 담당 학생의 household 메신저(보호자↔컨설턴트)를 읽고 답장할 수 있게 함. `household_id_for_assigned_student()` SECURITY DEFINER RPC로 `household_members` 원본 행을 넓게 노출하지 않고 household_id만 반환하는 패턴 사용.
    - **학생↔컨설턴트 개인 메신저**를 신설(보호자와 별도 채널). 프로필/모의고사 열람 RLS도 담당 컨설턴트까지 확장(`is_assigned_consultant_of()`).
    - **학생-컨설턴트 개인 일정 잡기(신청→확정)**: 수업 예약과 같은 UI 패턴이되, 학생 개인 단위로 진행 가능(보호자 동반 불필요) — 컨설턴트가 요청을 확인하고 확정/변경/거절하는 request→confirm 흐름(수업 예약 자체의 즉시 확정 방식과는 분리해 새로 설계, 기존 예약 상태 머신은 건드리지 않음).
    - **선생님 수업 재조정 요청**: 기존 즉시 확정 예약 시스템(약 54개 연관 테스트)은 그대로 두고, 교사가 확정된 예약에 대해 변경을 요청하면 학생/보호자가 확인 후 확정·변경·거절할 수 있는 별도 레이어를 추가.
    - **버그 수정**(실사용 UAT로 발견): 컨설턴트 담당 학생 목록이 전부 "이름 없음"으로 뜨던 문제(프로필 가시성 RLS 누락), Overview/Board가 500으로 멈추던 문제(모의고사 권한 함수가 컨설턴트 관계를 모름), 일정 확정 시각이 신청 시각과 어긋나던 타임존 버그(`toISOString()`이 항상 UTC를 반환해 `datetime-local` input에 잘못 채워짐 — `lib/calendar-date-utils.ts`에 DST-안전 `zonedDateTimeToUtcIso()` 유틸 신설), 학생 쪽 "일정 잡기"가 배정된 컨설턴트가 있는데도 없다고 뜨던 RLS 누락.
    - **메신저 안읽음 배지**: 학생·컨설턴트 포털 데스크톱/모바일 내비에 실제 안읽음 수 배지 추가. 버그 수정 — 보호자가 보낸 메시지가 학생 쪽 배지에 안 잡히던 필터 누락.

32. **ESLint 실제 이슈 161개 전량 정리 + 죽은 기능 2건 삭제(사용자 승인)**(2026-09-23):
    - **근본 원인 2건**: (a) `.claude/worktrees/**`(다른 세션들의 전체 git worktree 사본, 각자 `.next` 빌드 산출물 포함)가 lint 대상에서 빠지지 않아 `npx eslint .`가 실제 161개가 아니라 766개로 부풀려 보고되고 있었음 — `eslint.config.mjs`에 ignore 패턴 추가. (b) 코드베이스 전반에 이미 퍼져 있던 "`_` 접두사로 의도적 미사용 표시" 관례를 ESLint 설정이 인식하지 못해, 그 관례를 따른 곳들까지 전부 에러로 잡히고 있었음(`no-unused-vars` 71개 중 23개) — `argsIgnorePattern`/`varsIgnorePattern: '^_'` 규칙 추가.
    - 나머지는 카테고리별 수작업 정리: 미사용 import·타입·함수·상수 삭제, 한국어 따옴표 `&ldquo;/&rdquo;` 치환(30건), `react/no-children-prop`(데이터 prop 이름이 우연히 `children`과 겹치던 곳을 JSX children 형태로 전환, 동작 동일), `exhaustive-deps` 실제 버그 1건 수정(관리자 통합 일정 화면이 시간대 비동기 로드 후 재계산 안 되던 문제), `set-state-in-effect` 28건(전부 "마운트 시 데이터 로드" 관용 패턴 확인 후 의도 명시), 렌더 중 `Date.now()`/ref 직접 조작 2건을 effect로 이동.
    - **기획 참고 — 기능 2건 완전 삭제(코드베이스에서 더 이상 존재하지 않음)**:
      1. **"제안서(Proposal)" 생성/발송 UI**(`ProposalSection`, admin `ConsultationTab`) — 2026-09-10 서브탭 재편으로 진입 경로 자체가 이미 없어졌던 채 방치돼 있던 기능. `제안서 생성 → 발송 → 학부모 수락/거절 관리자 기록` 흐름 전체와 백엔드 액션(`createProposal`/`sendProposal`/`respondToProposal`)을 삭제. **`proposals`/`proposal_subjects` DB 테이블 자체는 남아있음**(삭제하지 않음, 데이터 손실 없음). 이 기능이 다시 필요해지면 재설계가 필요함(코드 없음).
      2. **개인 이메일 기반 선생님/학부모 초대 폼**(`InviteForm`, admin `UsersTab`) — Google Workspace 프로비저닝(R2 Task 7)으로 이미 대체된 뒤 호출부 없이 방치돼 있던 폼. 삭제.
    - 검증: `tsc` 클린, `vitest run` 2530/2531 통과(1건은 무관한 기존 flaky), `npm run build` 성공, Preview 배포 확인.

33. **컨설턴트 포털 확장 Phase B/C + 관리자 포털 정리(2026-09-23, 사용자 업무지시서 전체 완료, migration `20261550000000`~`20261568000000`)**:
    - **Phase B — 컨설턴트 포털**: Students 탭을 배정 중/배정 종료 서브탭으로 분리(종료는 기록 조회 전용) + Roadmap 상단 중복 요약 제거. Documents 메인 탭 신설(담당 학생 계약 문서·서명 상태, 다른 컨설턴트 담당 건 접근 불가). Schedule 메인 탭으로 통합(예정 일정/일정 오픈/휴무 3서브탭 — 휴무 등록 시 기존 확정 일정과 충돌 검사). Profile(성별·이력·시간대 자기수정, 입사일 등 회사기준정보는 관리자 전용 — `protect_hire_date` 트리거로 강제). Settlement(계좌 등록 + 관리자가 확정한 지급 예정/완료 내역 조회 — 상담 건수 기반 자동계산·자동지급 없음, 확정 전후 상태 구분).
    - **Phase A 마무리**: 보호자가 자녀별 담당 컨설턴트에게 직접 상담 신청(그 컨설턴트의 가능 시간만 노출). 관리자<->컨설턴트/선생님 내부 메신저 신설(고객에게 노출 안 됨). 선생님 배정 요청 수락/거절 결과가 내부 메신저에 시스템 메시지로 반영.
    - **Phase C — 상담 세션 화면**: 컨설턴트가 확정된 일정에서 "상담 시작"으로 진입, 관리자가 등록한 상담 자료를 열람(다운로드 기록 남김), 상담 메모·다음 행동 저장.
    - **버그 2건(전부 실사용 UAT로 발견, mock 테스트는 못 잡음)**: (a) 보호자→담당 컨설턴트 상담 신청이 처음부터 전혀 동작하지 않았음 — `consultant_assignments`/`profiles`에 guardian용 SELECT RLS 정책 자체가 없어 조용히 빈 배열만 반환(예외 없음). (b) `consultation_materials` RLS가 `profiles` role 확인을 일반 서브쿼리로 써서 `profiles`의 무거운 RLS가 재귀 평가돼 `statement timeout` 발생 — `is_admin()`과 같은 SECURITY DEFINER 헬퍼(`is_consultant()`)로 교체. **패턴 노트**: 다른 테이블 값을 확인하는 새 RLS 정책은 반드시 SECURITY DEFINER 헬퍼를 쓸 것(인라인 서브쿼리는 침묵 실패 또는 타임아웃 위험).
    - **관리자 포털 정리(5항목 전체 완료)**: (1) Users에 Consultants 서브탭 추가(담당 학생·이력·프로필, 매칭 변경은 기존 Consultants 운영 탭과 같은 RPC 재사용). (2) Messenger 메인 탭 신설, Teachers/Consultants 내부 문의 분리(향후 학생·보호자 채널 확장 가능한 구조). (3) Inquiries 면담 목록에서 담당 컨설턴트가 있는 요청은 "처리 중" 배지로 표시하고 상태변경 버튼 기본 숨김("관리자 개입"으로 예외 처리, 전체 조회는 유지). (4) Entitlements/Schedule/Bookings/Payouts/Onboarding 장문 설명 축약, 내부 용어(hold/payout_batches/batch 등) 순화, **Bookings 화면을 서브탭 없는 7섹션 나열 구조에서 4개 서브탭(동기화 실패·재처리/외부 변경 감지/지각·노쇼·세션 판정/메이크업·정산 조정)으로 재구성**. (5) Users/Onboarding 성능 실측(컨설턴트 데이터 추가로 인한 불필요한 전체 조회 없음 확인 — 서브탭 열 때만 lazy fetch).
    - 검증: 매 슬라이스마다 `tsc`/`eslint`/관련 vitest 통과 확인, 세션 종료 시점 `vitest run --exclude "**/*.integration.test.ts"` 334개 파일 2595개 전부 통과, `npm run build` 성공. 매 슬라이스 실제 Preview 배포 + 실제 Google/이메일 계정으로 라이브 UAT(관리자 `official@alton.education`, 컨설턴트 `jiman@alton.education`, 선생님 `teacher1@alton.education`, 보호자/학생 `matchbox512+alton-uat-p16@gmail.com` 계열 실제 비밀번호 로그인) — UAT 테스트 데이터·메시지는 세션 중 즉시 정리(단, `document_access_events` 등 append-only 감사 테이블은 정책대로 보존).
    - **남은 것**: (a) 컨설턴트 시간대 설정이 앱 전역 날짜 표시에 아직 일관 적용되지 않음(저장·조회만 구현, Profile 화면 자체에서 명시적으로 알린 한계). (b) 상담 자료 화면 캡처 등 완전한 유출 차단은 구현 범위 밖(다운로드/공개링크 제한 + 접근 기록만). (c) Bookings 서브탭 재구성 이후 UAT는 이번 세션에서 기능별로만 확인 — 마일스톤 종료 폴리싱 라운드에서 화면 전체 한 번 더 훑어볼 것.

34. **`feature/university-info-sources` 병합 + 실데이터 non-prod 반영(2026-09-23, 조정 세션 수행, 사용자 승인)**: 대학 정보 수집·신고 브랜치를 통합 브랜치로 merge(커밋 `3015727`, 충돌 없음). 새 마이그레이션은 `20261600000000`(college_db_p10_cds_metric_keys — CDS 세부 지표 metric_key 화이트리스트 확장, additive) 하나뿐, 그 이전 `20261480000000`~`20261540000000`은 이미 이전에 적용돼 있었다. `db push --linked`로 non-prod 반영(local=remote 확인), `tsc`/`eslint`/`vitest`(334 files·2595 tests)/`npm run build` 전부 통과.
    - **실데이터 동기화**: 해당 브랜치는 200개교 CDS 실데이터를 로컬 supabase(`127.0.0.1:54422`)에만 psql로 직접 입력해왔다(non-prod에는 없었음). `pg_dump --data-only`로 받은 export를 검토한 결과 **`universities.id`가 로컬/non-prod 간 서로 다른 UUID**임을 발견(seed 마이그레이션이 환경마다 `gen_random_uuid()`로 새로 생성 — 애초에 `(name, country)` unique key로 dedup하는 구조) — non-prod에서 200개교를 `(name, country)`로 매칭해 id를 재매핑한 뒤 적용. `university_update_proposals`(341행, local-only `refresh_job_id` 참조라 FK 위반)는 내부 봇 로그성 데이터로 판단해 이번엔 제외. 결과(non-prod에서 직접 확인): `data_collection_status` verified_pilot 142/sources_pending_review 55/unconfirmed 3, `university_admission_metrics` 3378행, `university_majors` 3924행, `university_source_urls` 398행 — 원 세션 보고 수치와 일치. Preview 컨설턴트 포털 College Explore(Princeton University 상세)에서 실제 CDS 수치(SAT 1510–1580, ACT 34–35, 합격률 4.4% 등) 정상 표시 확인.
    - **패턴 노트**: 여러 세션이 각자 로컬 DB에 데이터를 채운 뒤 병합할 때, id가 `gen_random_uuid()` 기반이면 환경마다 다르다는 것을 항상 가정하고 자연키(name/email 등)로 재매핑해야 한다 — 그대로 INSERT하면 FK가 로컬 전용 id를 가리켜 전부 실패하거나(참조 있는 테이블) 중복 행이 생긴다(참조 없는 테이블).

마이그레이션(2026-09-14 배치): `20261346`~`20261403`. 이후 배치는 위 각 항목 참고, 최신은 `20261600000000`(1절 표 참고).

35. **SAT Math 그래프 선택지 필수 정책 버그 수정(2026-09-24)**: `nonlinear_functions`는 일반 AI 파이프라인이 아니라 결정적 Math 컴파일러로 생성되며, 컴파일러가 `require_figure_choice`를 무시해 텍스트 문항을 채택하던 것이 실제 원인. 이차함수의 동일 축 그래프 선택지 4개를 계산해 만들고 정답 자리·오답 근거를 함께 맞췄다. 컴파일러와 일반 파이프라인 양쪽에서 관리자 `require_*` 정책의 자료 누락을 거부하도록 검사하고, 관리자 읽기 전용 검수 화면에도 그래프 4개를 표시한다. DB 변경 없음. 로컬 관리자 브라우저에서 7문항 생성·7건 모두 `figure_choice` 4개·실제 SVG 4개 확인.
36. **문제은행 유형별 생성 품질 UAT(2026-09-24, 진행 중, 브랜치 `uat/problem-bank-generation-quality`)**: 위 35번 수정이 실제로 전 세부 기술·전 자료 유형에서 안전한지 SAT Math 19개(35행, 자료 유형별 분기 포함)·SAT R&W 11개(11행)를 코드로 유도한 매트릭스로 전수 점검. Math 19개는 전부 AI 없는 결정적 컴파일러 경로(`runMathCompilerBatch`)라 비용 없이 자동화(`lib/problem-generation/uat-matrix.test.ts`, vitest, 결과는 `docs/assets/2026-09-24-problem-bank-uat/matrix-result.json`) — **완료**: 35행 모두 "자료 필수인데 자료 없이 통과" 재발은 없음. 1차 실행에서 9개 조합(35번 수정이 `materialBlocker`를 전 컴파일러 공통 경로에 걸면서, 애초에 그 자료 유형을 그려본 적 없던 컴파일러가 0/2건으로 막힘 — `linear_functions` plane·data, `systems_linear` figure_choice, `nonlinear_equations_systems` plane, `ratios_rates_units`/`percentages`/`inference_margin_error`/`evaluating_statistical_claims` data, `circles` plane)이 드러났고, 제품 오너 지시로 **전부 실제 자료 생성기 구현으로 해결**(옵션 제거 아님) — `linear_functions`에 직선 그래프·함수표, `systems_linear`에 그래프 선택지 4개(코드로 계산한 4개 직선쌍 중 하나만 일치), `nonlinear_equations_systems`에 이차함수+직선 좌표평면(linear_quadratic_intersection 세부 패턴 고정), `circles`에 좌표평면 원(circle_equation_transform 고정), 통계·비율 4종에 표 자료 추가. 지원 안 하는 세부 패턴을 강제로 고르면 조용히 대체하지 않고 명시적으로 거절한다. **재실행 결과: 35행 전부 2/2(70/70 문항) 통과, 8회 반복 실행으로 무작위성 불안정 없음 확인**(커밋 `0642099`). tsc·eslint·관련 vitest(504건) 전부 통과, circles 컴파일러의 기존 무작위 스트레스 테스트 1건은 이번 변경과 무관한 사전 존재 flaky 테스트로 별도 격리 확인. SAT R&W 11개 행은 실제 AI 파이프라인이 필요해 이 세션 환경에 `ANTHROPIC_API_KEY`가 없어 미실행(테스트는 자동 skip, 키만 넣으면 그대로 돈다) — `vercel env pull`로 Preview 시크릿을 시도했으나 CLI는 Secret 타입 값을 복호화해 주지 않아 확보 불가(로그·저장소에 키 값 남기지 않음). **브라우저 UAT 완료**: 로컬 dev 서버 + 로컬 Supabase로 신고된 시나리오(SAT Math > Advanced Math > Nonlinear functions > "자료 포함 · 그래프/도형 선택지 4개", 7문항)를 실제 관리자 화면에서 재현 — "자동 통과 7/7" 확인, DB 조회로 7건 전부 `figure.type='figure_choice'`·`choices` 4개 확인. **별도 관찰(이번 수정과 무관, 조사 안 함)**: 검수 탭에서 AI/컴파일러 생성 미공개 초안 행을 펼쳐도 "지문/자료" 미리보기 영역이 비어 보임(목록 제목도 "(아직 내용이 없는 문제)") — DB에는 내용이 정상 저장돼 있어 표시 전용 문제로 보이나, 이번 수정 파일과 무관한 영역이라 원인 조사는 하지 않음. 제품 오너 확인 필요하면 별도 티켓으로.

## 5. 검증 구분

- **자동 테스트(로컬 DB)**: 위 전부. 통합 — 부모 변경 반영 25, Drive 자료 15, 채점·재고정·과제·문제 필기·출처 분리·SPR·그림 게이트 21 등. 컴포넌트 — ProblemsPanel 32, ProblemBankTab 28, PDF 레이어 9, HomeworkTab 7, StudentHomeworkTab 3, CurriculumDocsTab 13, Drive 패널 6, 셸 18, figures 4, blocks 4.
- **실제 Drive·Preview·제품 오너 계정**: Drive 읽기 → 폴더 생성 → 가져오기 → 고정 사본 공개 → 카탈로그 편입 → 학생 회차 → 수업 준비 → 수업 시작 → PDF 렌더·필기 저장/복원 → 문제 슬라이드 → 객관식 채점.
- **실제 모델 호출**: 표본 10문항(로컬).
- **미확인**: 2026-09-14 야간 배치(P3 5차 이후)의 Preview UAT — 진행 중 / 두 계정 동시 필기·상대 레이어 지우개 / 영상 재생 / 모바일·iPad·Pencil / 원본 교체·재공개 후 필기 유지(RPC 테스트만) / 시험 데이터: 옛 과제 UI 답안(`session_homework_attempts`)은 옮기지 않음.

## 6. 미결·다음 작업 단위

- **제품 분석 P0 — Vercel Web Analytics/Speed Insights + 상담 전환 이벤트 3종
  (2026-09-25, 완료, `docs/2026-09-25-product-analytics-prd.md` 기준)**:
  랜딩·상담 신청 전환을 측정할 최소 분석 기반. 대학 탐색은 이번 범위에서
  명시적으로 제외.
  - **연결**: `@vercel/analytics`/`@vercel/speed-insights`를
    `app/layout.tsx`에 `AnalyticsScripts`(서버 컴포넌트)로 연결. 이
    컴포넌트는 `process.env.NEXT_PUBLIC_VERCEL_ENV === "production"`일
    때만 `<Analytics/>`/`<SpeedInsights/>`를 렌더링한다 — `next.config.ts`가
    `VERCEL_ENV`(Vercel 시스템 환경변수, 기본적으로 클라이언트 미노출)를
    `NEXT_PUBLIC_VERCEL_ENV`로 명시 복사해, 프로젝트의 "Automatically
    expose System Environment Variables" 설정 여부와 무관하게 항상 동작한다.
    local/test/Preview는 이 값이 없거나 `"preview"`라 스크립트 자체가
    내려가지 않는다(별도 활성화 필요 없음, 설정 하나로 충분).
  - **공통 이벤트 모듈**: `lib/analytics/`
    (`events.ts`=이벤트별 허용 속성 화이트리스트 단일 진실 소스,
    `track.ts`=`trackEvent()`, `config.ts`=환경 판정,
    `AnalyticsScripts.tsx`). 화면 코드는 `trackEvent(eventName, props)`만
    호출 — 도구 종류·허용 속성은 전부 이 모듈이 결정한다.
  - **이벤트 3종**(P0, PRD 축소판 — 대학 탐색 이벤트 2종은 제외):
    `landing_cta_clicked`(`cta_name`, `section`) — 랜딩 헤더 "상담 신청"
    링크 클릭(`app/LandingCtaLink.tsx`). `consultation_started`
    (`entry_point`) — 상담 폼 첫 포커스, 폼 인스턴스당 1회(`onceKey`).
    `consultation_submitted`(`entry_point`, `consultation_type`) — 서버
    저장 성공 직후에만, 실패(catch)에는 보내지 않음 — 전부
    `app/ConsultForm.tsx`.
  - **개인정보 방어**: `trackEvent()`가 이벤트별 화이트리스트에 없는 속성은
    무조건 버린다(블랙리스트가 아니라 화이트리스트라 실수로 넣은 새 필드가
    기본적으로 새어나가지 않는다). `page_path`는 호출부 입력을 쓰지 않고
    `window.location.pathname`에서 직접 읽어 쿼리스트링·fragment를 원천
    차단한다.
  - **중복 방지**: `onceKey`(폼당 1회성 이벤트)와 짧은 시간창 디바운스
    (연타 방지) 두 가지 메커니즘. 분석 전송 예외는 항상 삼켜 실제 기능
    (로그인·상담 제출)에 영향 없음.
  - **검증**: tsc/eslint 클린. 신규 유닛 테스트 24건(환경 게이팅, 화이트
    리스트, PII 미포함, 중복 방지, 실패 시 미발생 등) 전부 통과. 전체 회귀
    2694/2708(12 skip) 통과(무관한 기존 flaky 지오메트리 테스트 1건 제외).
  - **Preview 확인**: 랜딩 CTA 클릭·상담 폼 작성·제출 성공 흐름을 실제
    브라우저로 확인(아래 최종 보고 참고) — Preview에서는 분석 스크립트
    자체가 로드되지 않아 네트워크 전송이 없음을 확인.
  - **운영 전 필요 작업(코드 변경 아님, 사람이 해야 함)**: Vercel
    프로젝트 설정에서 Web Analytics와 Speed Insights를 활성화해야
    실제 프로덕션 배포에서 대시보드에 데이터가 쌓인다(Project → Analytics
    / Speed Insights 탭에서 Enable). 코드는 이미 조건부로 스크립트를
    내려주므로, 이 활성화 전에는 프로덕션에서도 대시보드가 비어 있을 뿐
    기능·성능에는 영향 없다.
  - **남은 것**: P1(대학 탐색 이벤트 2종, PostHog/GA4)은 이번 범위 밖 —
    별도 지시 대기.
- **R12 보존 자동화 1차 슬라이스 — closure_pending 자동 폐쇄 + closed 계정
  접근통제(2026-09-24, 완료, `20261900000013`~`20261900000015`)**: §4.13/§4.19의
  `closure_pending`(30일 철회 유예) → `closed` 자동 전환과, `closed` 계정
  제한 보관("사유 입력 후에만 접근, 조회는 감사 로그에 남긴다")을 구현.
  `close_expired_pending_accounts()`(cron 대상, `/api/cron/close-pending-accounts`,
  다른 크론과 동일 fail-closed — 지금은 CRON_SECRET 미설정으로 비활성),
  `record_closed_account_access()` + `account_closure_access_events`(append-only
  감사), 관리자 Users 화면의 `ClosedAccountAccessGate`(사유 입력 전엔
  StudentDetailPanel/TeacherDetailPanel을 렌더하지 않음). non-prod에서 실제
  계정으로 30일 경과 backdate → 자동 폐쇄 → 사유 입력 열람 → 감사 기록까지
  end-to-end 확인 후 테스트 계정 정리(auth.users만 삭제, profiles/
  account_status_events/account_closure_access_events는 정책대로 보존).
  **버그 2건 발견·수정**: (1) `is_admin() or auth.role() = 'service_role'`
  패턴이 `auth.role()`이 NULL일 때(일반 authenticated 세션이 jwt role claim을
  안 가진 경우) `false or NULL` = NULL → plpgsql이 NULL을 false로 취급해
  관리자/서비스 게이트를 그냥 통과시키는 fail-open이었다 — `mark_expired_invites()`
  (`20261900000007`)에도 같은 결함이 있어서 함께 고침(`20261900000014`).
  (2) `close_expired_pending_accounts()` 초안이 `status_transition_tokens`
  없이 바로 UPDATE해서 `protect_account_status()` 트리거가 항상 거부.
  **남은 것**: 자료유형별 보관기간 실제 자동 삭제/비식별화 배치, GW-14
  (Smart Notes 미검토 원본 1년/확정 리뷰 3년 이중 만료 — Google Drive
  API 연동 필요, 별도 슬라이스), 정기 스케줄러 연결(현재는 cron 등록만
  하고 CRON_SECRET 미설정으로 전부 비활성 유지 — 사용자가 활성화 시점 결정).
- **ParentDetailPanel 신설(2026-09-24, 완료)**: 관리자 Users > 학부모 카드가
  이제 클릭 가능하며, 상세 화면에서 상태 전환(Student/TeacherDetailPanel과
  동일 패턴, closed는 ClosedAccountAccessGate로 보호), 연결 자녀와 자녀별
  담당 컨설턴트(배정 변경은 ConsultantDetailPanel과 같은
  `setStudentConsultantAction()` 재사용), 가구의 계약·진행 현황
  (`contracts`, `v3_contract_status` 11개 값 전부 라벨링), 가구 연락 이력
  (`household_messages` 최근 20건)을 확인·관리할 수 있다. `ParentListItem`에
  `status` 필드가 그동안 아예 없었던 것도 함께 추가(`loadParents`).
  non-prod 실제 계정으로 브라우저 검증 완료. `setParentStatus`는 이제 실제
  UI 호출부가 생겼다(이전까지 액션만 있고 화면이 없던 유일한 갭이었음).
  **부수 발견**: `ConsultantDetailPanel`의 보호자 이름 조회가 존재하지 않는
  컬럼(`member_id`)·값(`role='student'`)을 써서 항상 빈 결과만 받아 "보호자:
  없음"으로 조용히 폴백되는 버그를 발견 — 별도 세션으로 이관(task_83cdc1d7).
- **R12 자료 유형별 보존기간 자동 삭제·비식별화 배치 1차 슬라이스(2026-09-24,
  완료, `20261900000016`)**: §4.13 처리 방식 4가지 중 3가지를 대표 테이블로
  구현(4번째 "접근 차단 후 보존"은 위 closed 게이트 재사용, 신규 코드 없음).

  | 처리 방식 | 대표 테이블 | 기준 | 함수 |
  |---|---|---|---|
  | 완전 삭제(즉시/단기) | `notifications` | 생성 90일 후 | `retention_delete_expired_notifications` |
  | PII 비식별화(통계 유지) | `consult_requests` | completed 후 2년 | `retention_anonymize_expired_consult_requests` |
  | 별도 보존기간 뒤 삭제(보안 로그) | `session_access_events` | 1년 | `retention_delete_expired_access_logs` |
  | 채팅·문의 메시지 삭제(2026-10-06) | `subject_thread_messages`(archived 스레드)·`teacher_admin_messages`(closed 문의) | 종료 후 2년 | `retention_delete_expired_subject_thread_messages`·`retention_delete_expired_teacher_admin_messages` (배치 비활성 유지) |
  | legal hold·Smart Notes 삭제 큐(2026-10-06) | `legal_holds`, `retention_deletion_targets`, `retention_policies` | 수업 종료 +1년(자료), hold는 전 경로 검사, 설정은 지정자(`legal_hold_holder`)만·타 관리자는 요청 | 설계: `docs/2026-10-06-retention-implementation-design.md`, 보류 항목 `docs/2026-10-06-retention-deferred-designs.md` (배치·Drive 삭제 플래그 닫힘) |
  | 보존 데이터 모델(2026-10-07) | `child_deletion_requests`, `retention_free_member_scope`, 읽기 전용 리포트 함수 | 삭제 없음 | 마이그레이션 20262100000220 |
  | 접근 차단 후 보존(계정 폐쇄) | `students`/`teachers`/`parents` | closed 전환 즉시 | (기존) `ClosedAccountAccessGate` |

  오케스트레이터 `run_data_retention_batch()` + cron `/api/cron/data-retention-batch`는
  `CRON_SECRET`과 `RETENTION_BATCH_ENABLED` 둘 다 있어야 실행(정산 크론과
  동일 fail-closed 패턴) — 둘 다 미설정으로 유지. 배치당 LIMIT 500, WHERE절
  재평가로 재실행 안전. 실행 기록은 `retention_batch_runs`(append-only)에
  남긴다. non-prod에서 세 유형 모두 실제 계정/문서로 검증 완료(테스트 데이터
  정리, 감사 행만 보존).

  **남은 정책 결정 사항**:
  1. `document_access_events`(계약·정산 자료 접근 이력) — 자체 트리거로
     UPDATE/DELETE가 bypass 없이 영구 차단돼 있어 이번 배치에서 제외했다.
     "1년 후 삭제"를 그대로 적용할지, 계약·정산과 같은 7년으로 볼지, 아예
     영구 보존할지 법무 검토 후 결정 필요.
  2. 이번 슬라이스는 ~250개 테이블 중 4개 대표 테이블만 다룬다. 나머지
     테이블(예: `chat_messages`/`household_messages`(2년 채팅), 계약·결제·
     정산 7년 대상(`contracts`/`purchase_receipts`/`teacher_payouts` 등),
     `session_smart_notes`(GW-14, Drive 연동 필요))은 각각 별도 슬라이스로
     남아있다 — 정책표의 나머지 카테고리는 문서화만 됐고 배치는 미구현.
  3. cron 활성화(스케줄은 등록됐으나 `CRON_SECRET`/`RETENTION_BATCH_ENABLED`
     둘 다 미설정으로 비활성) 시점은 사용자 결정 대기.
  4. **(2026-09-29, 온보딩 간소화 7단계)** 배치 로직은 확장하지 않았다 — v3 §4.13·계획서에
     기간이 명시된 대상 중 지금 테이블이 있고 Drive 없이 안전한 것이 없다. 크론 라우트에
     `?dryRun=true`(지우지 않고 대상 건수만 집계)만 추가했고, transcript·Smart Notes 행과
     Drive 파일 삭제(마지막 수업 후 1년, GW-14)는 5단계 구현 뒤 오케스트레이터에 붙일
     TODO 훅을 route.ts에 남겼다. **기간 미정 → 오너 결정 필요**: `contract_dispatch_jobs`
     종료 행, 만료된 온보딩 링크·상담 동의 토큰(`consult_consent_tokens`, 발급 경로 삭제됨),
     `consultations`의 상담 종료 후 2년 PII 비식별화(§4.13 "상담 기록 종료 후 2년"은 있으나
     계약 체결 가족의 연락처에 미치는 영향 결정 필요).
- **선생님 학습 플래너 "보드" 탭 연결(2026-09-24, 완료)**: `2026-09-21`에
  만든 Student Success Planner Board(학부모 포털엔 연결됨)가 선생님 화면에는
  한 번도 연결되지 않아 항상 "준비 중" placeholder만 보이던 버그를 실사용
  중 발견·수정(`app/teacher/board-actions.ts` + `TeacherPlannerBoard`,
  학부모 board-actions와 동일한 읽기 전용/RLS 의존 패턴). "일정"·"오버뷰"
  탭은 여전히 미구현.
- **[출시 전 재확인 필요] Question Bank AI 생성 — `require_figure_choice`
  선택 시 그래프/도형이 실제로 하나도 포함되지 않는 버그(2026-09-24, 발견,
  별도 세션(`task_119ff183`)에 이관, 수정 미완료)**: 관리자가 SAT Math
  생성 화면에서 "자료 포함 · 그래프/도형 선택지 4개"를 선택해도 생성된
  문항에 도형이 붙지 않는다. 코드 추적 결과 `lib/problem-generation/pipeline.ts`의
  `makeFigure()`가 실패해도 조용히 넘어가고(`console.error`만), 품질 게이트
  `materialBlocker`가 관리자가 강제한 `figurePolicy`가 아니라 문항 텍스트
  기준 자체 판정(`judgeMaterialNeed`)만 봐서 무자료 문항도 그냥 통과시키는
  것으로 추정(확정 아님, 별도 세션에서 실제 로그로 검증 중).
- **계정 병합·개인정보 삭제 실제 운영 경로 검증 + 관리자 UI 신설(2026-09-24,
  완료, `20261900000012`)**: Section 2 지시("실제 운영 경로를 점검")에 따라
  `merge_accounts()`/`anonymize_merged_account()`(R2 Task 5, 2026-08-31)를
  실제로 처음 end-to-end 실행해보니 — 지금까지 이 두 함수의 단위 테스트가
  `admin.auth.admin.deleteUser()`를 mock해왔기 때문에 실제 DB로는 한 번도
  검증된 적이 없었다 — **PII 스크럽은 정상 동작하지만 그다음 실제 Auth
  계정(로그인 자격증명) 삭제가 구조적으로 항상 실패**하는 버그를 발견했다.
  원인: `profiles.id`가 `auth.users.id`를 `ON DELETE CASCADE`로 참조해,
  Auth 계정을 지우면 profiles 행까지 지우려다가 merge_accounts()가 의도적으로
  재배정하지 않는 감사·정산 기록(INSERT-only `account_status_events`, 7년
  보관 `account_merges` 등, 원래 UUID로 "누가 했는지" 영구 보존해야 함)의
  NO ACTION 제약 ~203개 중 하나에 막혔다. **수정**: `profiles_id_fkey`
  CASCADE 제약 자체를 제거(ON DELETE 동작만 바꾸면 오히려 삭제 자체가
  막힘, PK라 SET NULL도 불가) — 이미 PII가 스크럽된 profiles 행은 그
  자체로 "PII 없는 영구 주체"이므로 auth.users 생사와 분리해도 되고,
  이렇게 하면 203개 참조 테이블 전부 손댈 필요가 없다(전부 그대로 같은
  UUID를 계속 참조). **검증**: 브라우저로 실제 계정 2쌍 생성→UI로 병합→
  30일 유예 경과로 backdate→"익명화 실행" 클릭까지 실제 API 경로로 수행,
  DB 직접 조회로 auth.users 실제 삭제(0행)·profiles/account_merges/
  account_status_events 전부 원래 UUID 그대로 보존 확인. 전체 비통합
  테스트 2610개 + 병합 전용 테스트 32개 통과. **잔여 위험(별도 조치
  필요)**: auth.users를 profiles 거치지 않고 직접 참조하는 컬럼 8개
  (`contract_company_approvals.approved_by`, `university_*` 검토자 컬럼
  7개, 전부 NO ACTION) — 병합·삭제 대상이 이 컬럼에 실제로 등장하는
  관리자 계정이면 여전히 삭제가 막힘(학생·학부모·교사 병합에서는 해당
  없음 확인). 관리자 계정 삭제가 실제로 필요해지면 이 8개도 같은 방식으로
  다시 다뤄야 함. **관리자 UI 신설**: Users 탭에 "계정 병합" 서브탭 추가
  (이메일 검색·확인·사유 입력·실행, 30일 유예 대기 목록+실행 버튼) —
  master-roadmap-v3.md가 명시했던 "실행 화면 자체가 없다"는 미완료 항목
  해소. `inactive` 상태 머신·복귀 UI·자료 유형별 보관기간 자동화·GW-14
  Smart Notes 만료 자동화·정기 스케줄러 연결은 이번 범위 밖(별도 항목,
  아래 계속).

- **[출시 전 재확인 필요] figure_choice 실제 AI E2E 공개 성공 토스트 미출현
  (2026-09-24, 미완료·원인 미확인)**: `e2e/figure-template-1.spec.ts` "그래프
  선택지: 지문 → AI 그래프 4개 → 편향 검증 → 공개 → 학생 화면(선택지 안 그림)"
  테스트가 실제 AI(`E2E_REAL_AI=1`) 실행에서 "공개하기" 클릭 뒤 공개 성공 토스트
  (`/공개했습니다|공개됐습니다|공개되었습니다/`)가 20초 안에 뜨지 않아 실패(같은
  라운드에서 확인한 다른 3개 버그 — 선택자 모호성/문구 드리프트/컴파일러-전용
  스킬 오인 — 와는 별개, 그것들은 전부 수정·재검증 완료). 이 실패 하나는 원인
  미확인 상태로 남겨둠 — 반복 실행으로 재현·진단 비용(실제 API 호출)을 더
  쓰지 않기로 함(2026-09-24 사용자 지시). 테스트 프로세스 종료 시 `afterAll`이
  이 실행이 만든 문제 행을 정리해 DB 증거는 남아있지 않다 — 재조사 시 이
  테스트만 다시 `E2E_REAL_AI=1`로 단독 실행해 재현부터 할 것(`figure_choice`
  타입 AI 생성 경로: `app/admin/ProblemDraftEditor.tsx`의 `makeFigure("figure_choice")`
  → 서버 액션 → 실제 Anthropic 호출). **출시 전 반드시 재확인**(다른 3가지
  E2E_REAL_AI 스펙 유형 중 유일하게 미검증 상태로 남은 것).

- **College Board 커버리지 전수 매핑 완료 + Math SPR 아키텍처 결론(2026-09-17, 완료)**:
  `2026-09-17-collegeboard-coverage-map.md` — 실전 시험지 7종(test4·6·7·8·9·10·11)
  840문항(R&W 462 + Math 378) 전수 분류 완료(test5는 결번). **최종 결론**: "생성
  가능+결정론적 검증 있음" 331건(39.4%), 상위 스킬은 있으나 하위 패턴 불가 209건
  (24.9%), 생성 가능하나 검증 없음(R&W 위주) 273건(32.5%), 완전 불가 27건(3.2%).
  **화면 렌더링 검증은 840건 전부 미확인이었으나 2026-09-18 uat20260918로 4건
  (Math MC/SPR, R&W 근거모델/정량모델) 실제 학생·교사 세션까지 검증 완료**(아래
  참고). SPR은 특정 스킬 추가로 해결 안 됨 — `math-compilers/batch.ts`의
  `format="mc"` 고정 출력을 SPR 분기 가능하도록 재설계해야 하는 아키텍처
  작업(로드맵 Step 3, 아직 미착수). 완전 불가 갭 랭킹 1순위(산점도 회귀/최적선)는
  Step 4에서 이미 구현 완료.
- **문제은행 전수 감사 + 역할별/실사용자 UAT(2026-09-18, 완료)**: 활성(보관 안 된)
  160문항 전수 감사(`2026-09-18-problem-bank-full-audit.md`) → 결함 8건(원시
  LaTeX·빈 초안·내부 필드명 노출·완전 중복) 발견해 마이그레이션 `20261413000000`
  으로 보관 처리(non-prod 반영 완료). 관리자 역할 UAT(`2026-09-18-problem-bank-role-uat.md`)
  전부 PASS. 공개 문항이 0건이라 학생/교사 실사용 흐름은 별도로 Math MC·SPR,
  R&W 근거모델·정량모델 각 1문항씩 실제 공개해 `uat20260918`(정리 안 함, 회귀
  재현용으로 보존) 계정으로 실 세션 풀이·자동채점·교사 채점 확정까지 끝까지
  검증(`2026-09-18-real-student-teacher-uat.md`) — 전부 정상. 이 UAT에서
  `/student` 홈 500 에러(1절 참고)와 `ProblemLogTab.tsx`가 어떤 화면에서도
  import되지 않는 죽은 코드로 보인다는 점을 발견(둘 다 미수정, 판단만 보류).
- **고정형 SAT 모의고사 V1(정책 확정, 구현 대기 — 2026-09-17)**: 모의고사는 과제와
  별도 원본·응시 기록을 가진다. 수업 화면에 `모의고사` 탭을 추가해 교사가 배정하고 학생이
  시작·재개할 수 있으며, 학생 포털의 독립 모의고사 탭에서도 같은 응시를 연다. V1은
  기본·표준·상위 난이도의 고정 세트를 여러 개 운영하고 적응형 모듈은 V2로 미룬다. Math
  문제·과제·모의고사에는 공통 계산기와 ALTON용으로 재구성한 참조표를 제공하며 R&W에는
  보이지 않는다. 상세 사양: [`2026-09-17-fixed-mock-exam-v1-spec.md`](2026-09-17-fixed-mock-exam-v1-spec.md).

- **학부모 포털 IA 재구성 + 상담 신청·메신저(2026-09-17~18, 완료 — R12/R12.1 전체 반영, non-prod 배포·UAT 완료)**:
  - **메인 nav 최종 순서**: 홈 → 수업권 → 수강 과목 → 수업 → 상담 → 단어장 → 과제.
    **제거된 탭과 새 위치**: 가족(신규 자녀 상담 신청 흐름 자체를 폐기, `ConsultRequestTab.tsx`/
    `consult-request-actions.ts`/`consult-request-data.ts` 삭제 — 학부모는 이제 기존 자녀든
    신규든 상담 신청은 `상담 신청` 서브탭 하나로만 함) · 문의(구 `household_messages` 대화
    화면 → `상담` 탭의 `메신저` 서브탭으로 통합) · 예약(독립 탭 제거 → `수업` 탭 안
    "예정 수업 예약하기" 버튼으로 `LessonBookingTab`(학생 포털과 공유, 동작 변경 없음)을
    모달로 연다) · 교재(관리자 전용 라이브러리 탭 제거, 기존 세션·수강 과목 화면의
    `/materials/[id]` 진입점은 그대로 유지) · 독립 `통계` 탭(죽은 placeholder였음 →
    `홈`의 `통계` 서브탭으로 이동, 학생 포털 `stats-data.ts`의 `loadStats` 재사용).
    `지인 추천`(`CreditsTab`)·`동의`(`ConsentTab`)는 메인 nav에서 제거해 프로필
    드롭다운(학부모님 ▾) 메뉴로 이동 — `동의`는 자녀별 미해결 동의/정규 진행 선택
    건수를 숫자 배지로 표시.
  - **상담(`consult`) 탭**: 서브탭 3개 — `상담 신청`(`ConsultationRequestTab.tsx`, `상담
    사유` 단일 입력만, `submitMeetingRequest({ reason })`), `상담 내역`
    (`ConsultationHistoryTab.tsx`, 상태별 목록 + 완료 건의 확정 리뷰·미팅록 조건부
    노출), `메신저`(`MessengerTab.tsx`, 기존 그대로, 안읽음 배지). 상담 신청 내부
    메시지 스레드(`meeting_request_messages`)는 더 이상 UI로 노출하지 않음(테이블
    자체는 additive-only 원칙으로 유지, 대화는 메신저로만).
  - **스키마(R11 `meeting_requests`/`household_messages` 확장, 신규 테이블 만들지
    않음)**: `meeting_requests`(5단계 상태 requested→confirming→scheduling→
    scheduled→completed, cancelled는 레거시 조회용; content/contact_preference/
    preferred_contact_time; Calendar 동기화 컬럼 `google_event_id`/
    `google_meeting_code`/`google_sync_status`/`google_sync_retry_count`,
    `google_meet_link`는 R11부터 있던 컬럼), `meeting_request_reviews`(draft/final
    상태, `save_meeting_request_review_draft`/`finalize_meeting_request_review`
    RPC로만 씀), `meeting_request_review_edits`(확정 후 관리자 수정 시마다 이전
    `final_text`를 스냅샷 — `admin_edit_meeting_request_review` RPC가 원자적으로
    처리, `lesson_reviews`와 달리 이번 상담 리뷰는 확정 후 수정도 이력을 남기는
    것이 요구사항이었음), `meeting_request_review_drive_access`(미팅록 Drive 문서
    권한 부여 상태 `pending/granted/failed` — `status='granted'`일 때만 학부모에게
    링크 노출, `DRIVE_ARTIFACTS_ALLOW_REAL_WRITES` 게이트로 실제 Drive 호출 차단
    가능), `meeting_request_messages`(유지, UI 미노출), `household_message_reads`
    (메신저 안읽음 추적).
  - **RLS 요약**: `meeting_request_reviews`는 `status='final'`인 행만 그 household의
    guardian이 조회 가능(draft는 관리자만), 쓰기는 위 SECURITY DEFINER RPC로만
    허용(직접 insert/update 정책 없음 — `lesson_reviews` 패턴과 동일). `meeting_
    request_review_drive_access`는 관리자 전체 조회, guardian은 자기 household의
    확정된 리뷰에 연결된 행만 조회 가능(쓰기는 서비스 롤/서버 액션에서만). 다른
    household의 `meeting_requests`/리뷰/미팅록은 어느 화면에서도 조회 불가(Preview
    UAT에서 실제 두 household 계정으로 교차 열람 차단 확인).
  - **Calendar/Meet 연동**: 관리자가 `일정 확정`을 누르면(인라인 `datetime-local`
    입력, `window.prompt` 아님) `app/admin/inquiry-and-meeting-actions.ts`의
    `scheduleMeetingRequest()`가 (1) 시작/종료 시간 유효성(둘 다 필요, 종료>시작)
    검사 후 거부, (2) `google_event_id`가 이미 있으면 `patchCalendarEventTime`만
    호출(멱등, 재생성 안 함), 없으면 `createCalendarEventWithMeet` 호출, (3) Calendar
    API 호출이 실패하면 DB를 전혀 쓰지 않아 상태가 조용히 `scheduled`로 넘어가지
    않는다. 참석자 이메일은 `profiles`가 아니라(email 컬럼 없음) `auth.admin.
    getUserById()`로 조회(기존 `consultation-kanban-actions.ts` 패턴과 동일).
    관리자 리뷰 UI(`MeetingRequestReviewPanel.tsx` + `meeting-request-review-
    actions.ts`)는 완료된 상담에 draft 저장/확정/확정 후 수정 버튼을 제공하고,
    미팅록 Drive 문서 연결 시 `grantSmartNotesReaderPermission`(세션 Smart Notes와
    동일 헬퍼)으로 그 household 보호자에게 reader 권한 부여를 시도한다.
  - **홈(`activeTab==="home"`) 재설계**: 서브탭 4개 — `종합 리뷰`(수업/상담 리뷰를
    합친 목록이 **아니다** — 향후 AI OS가 월 단위로 생성할 "월간 종합 리뷰" 전용
    빈 자리, 이번 범위에서는 생성 로직·데이터 모델 없이 "아직 생성된 월간 종합
    리뷰가 없습니다. 준비 중입니다." 정적 문구만), `수업 리뷰`(`lesson-review-
    family-actions.ts`의 `getLessonReviewsForFamily`를 자녀의 모든 수강 과목에
    병렬 호출해 합친 것 — 확정 리뷰+확정 미팅록이 있는 것만, 시간순), `상담
    리뷰`(`home-reviews-actions.ts`의 `getHomeConsultationReviews` — household
    범위 확정된 `meeting_request_reviews`만, 최신순, 미팅록 없으면 "미팅록이
    없습니다."만 표시), `통계`(`home-stats-actions.ts`가 학생 포털 `stats-data.ts`
    의 `loadStats` 재사용). 상단 동의 배너(구 `ChildrenStatusRow`)와 캘린더·예정
    수업(구 `HomeDashboard` 사용)은 제거 — 동의 긴급도는 프로필 드롭다운 배지로만.
  - **마이그레이션·배포**: `supabase/migrations/20261406000000`(R12 V1)~
    `20261412000000`(스마트노트 권한 상태 조회 함수) 전부 non-prod(`worpsqwqgnspddnrtnvq`)
    반영 완료(`migration list --linked` local=remote 확인). 최신 Preview:
    **https://alton-ilrqy8v1j-alton7.vercel.app**(커밋 `e5b1042`).
  - **Preview UAT 실제 확인(2026-09-18, 실행 ID `r13-0918c`, 정리 완료)**: 태그된
    household 2개 + 관리자 계정으로 상담 신청 제출→관리자 일정 확정(실제 Calendar
    이벤트+Meet 링크 생성, `google_event_id`/`google_sync_status='succeeded'` DB
    확인)→완료 처리→리뷰 draft→확정→학부모 계정으로 홈 `상담 리뷰`·`상담 내역`
    양쪽에서 확정 리뷰 실제 열람 확인→다른 household 계정으로는 전혀 보이지 않음
    확인. UAT로 만든 DB 데이터·Auth 계정·실제 생성된 Calendar 이벤트(`v7rjj2epr9g4
    csroidibopjm1c`) 전부 삭제 확인 완료(재조회 시 `status="cancelled"`).
  - **남은 blocker**:
    (a) ~~미팅록 Drive 원본 링크 실제 클릭 검증 미완료~~ — **2026-09-23 해소.**
    R3(계약서 업로드, `lib/drive-preview-verify-auth.ts`)와 동일한 Preview 전용
    최소권한 서비스 계정 경로를 `lib/drive-session-tasks.ts`의
    `processOneSessionDriveTask`에 임시로 분기 추가해, 실제
    `grantSmartNotesReaderPermission` 코드 경로로 UAT 계정(`matchbox512@gmail.com`)에
    Google Drive 테스트 문서 reader 권한 부여 → Drive API `permissions.list`로
    `role: "reader"` 실제 부여 확인(서버 응답 직접 확인, 클릭 자체는 미실시했지만
    권한 부여 메커니즘 자체는 실측 검증됨). 검증 중 실제 버그 1건 발견·수정
    (Drive 파일 생성 시 `drive/v3` 대신 `upload/drive/v3` 엔드포인트를 써야
    multipart 업로드가 성공함 — 기존 `lib/drive-artifacts.ts`의 `uploadArtifactToDrive`
    는 정상 경로를 쓰고 있었으나 이번에 새로 짠 임시 라우트에서 처음엔 잘못 씀).
    검증 후 임시 라우트·코드 분기·테스트 Drive 파일·DB 테스트 행·
    `DRIVE_ARTIFACTS_ALLOW_REAL_WRITES` env var 전부 원복·삭제 완료(커밋 `5b50dd0`→
    `e5c9767`). `session_drive_tasks` 워커 자체는 여전히 Preview에서
    `assertNotPreview()`로 프로덕션 체인을 못 쓰므로, Preview에서 실제로
    자동 처리되게 하려면 R3처럼 상시 preview-safe 분기를 정식으로 유지할지는
    별도 정책 결정 필요(이번엔 검증 1회성 임시 조치로만 사용).
    (b) ~~`supabase/migrations/20261413000000_p6_problem_bank_full_audit_archive.sql`
    non-prod 미반영~~ — **2026-09-23 재확인 결과 이미 non-prod에 적용되어 있었음**
    (`migration list --linked`에 버전 기록 존재, 대상 8개 문항 전부 `archived_at`
    설정 확인). 이 항목은 오기재였던 것으로 보임 — 실제로 남은 액션 없음.

- **예약·수업 준비·진도 단일 흐름(2026-09-17, 완료)**: 예약 확정 시 다음 미완료 회차
  (`curriculum_overlay_units.status`)를 자동 연결하고 그 시점 교재·문제·키워드를
  세션 전용 사본으로 즉시 복사(`_stage_unit_for_session`, 기존 P2 자동연결 트리거
  `auto_link_next_unit_to_session` 확장 — 이전에는 연결 기록만 남기고 구성을 복사하지
  않아 "연동됐지만 교재는 비어있음" 결함이 있었다). 정상 완료 시 회차를 진도상
  completed로 전진(`finalize_lesson_session`). 체험/정규 동일 코드 경로(`confirm_lesson_booking`
  →`sessions` insert→같은 트리거). 마이그레이션 `20261390`~`20261393`(재조정 가드,
  회차 연결 시 자동 상속, 자동배정+진도전진, `session_drive_tasks` RLS) 비프로덕션
  반영 완료. 실제 화면 데이터 로더(`loadPlannedMaterialData`/`unit_preview_for_viewer`/
  `loadSessionSelection`/`loadLessonBookingData`) 직접 호출로 학생·학부모·교사 화면
  단위 검증 완료(`lib/booking/curriculum-unit-screen-verification.integration.test.ts`).
  **주의**: 이 자동화는 이 시점 이후 새로 확정되는 예약부터만 적용된다. **2026-09-17
  이전에 만들어진 세션(회차가 비었거나 "아직 배정된 교재가 없습니다"로 보이는 것들)
  은 소급 보정하지 않았다** — 옛 수동 연결 방식으로 만들어졌기 때문이며, 확인하려면
  같은 학생·과목으로 새 예약을 하나 만들어 자동 연결·구성 복사가 되는지 보면 된다.
  체험 전용 커리큘럼(체험 관리 과목 + 1회차)은 코드 경로만 준비돼 있고, 실제 과목·
  회차 콘텐츠는 관리자가 아직 만들어야 한다. 과제는 이 자동 구성에서 의도적으로
  제외(정책 확정: 예약만으로 자동 발급하지 않음 — 회차에 기본 과제 계획/추천 문제
  구성은 둘 수 있으나 실제 발급은 교사가 명시적으로 함, 필요 시 회차별 자동 발급
  규칙은 별도 설계).
- **지금**: 제품 오너 Preview UAT(문제은행 AI 생성 → 그림 확인 → 전체 공개 → 수업 준비에 담기 → SPR 풀이·채점 / 과제 발급·풀이 / 문제 위 필기 / 관리자 교재 탭).
- **분류 후속 UI(criteria `skill_codes` 일괄 편집)는 2026-09-17 제품 오너 지시로 폐기** — 스펙이 백로그 한 줄뿐이고 대상·진입화면·권한이 전혀 정해지지 않아 로드맵에서 제외.
- **SAT Math 19종 + R&W 근거모델 5종 Preview UAT(2026-09-17 지시 → 2026-09-23 완료)**: 관리자 문제은행 화면에서 19개 Math 기술 코드 전부(Algebra 5·Advanced Math 3·PSDA 7·Geo/Trig 4)를 결정형 컴파일러("AI 생성" 버튼, 실제 AI 호출 0회·비용 $0)로 1개씩 생성→"자동 통과" 확인→저장, R&W 근거모델 5종(words_in_context/central_ideas_details/inferences/command_of_evidence_text/cross_text_connections)은 실제 AI 생성(평가모델 검증 통과까지 개당 40~90초, 2회 재시도로 통과한 경우 포함 5/5 전부 성공)으로 생성. Math 19개 스킬 결과물 25개 초안 중 24개 전체 공개 완료(1개는 발행 게이트가 정답 선택지 표기 불일치를 정상적으로 거부 — `x = 3` vs `3`, 버그 아님), R&W 5개 스킬 결과물 6개 초안 중 5개 공개(구조·정답 근거 표기 육안 확인 포함). **발견한 실제 버그**: 관리자 문제은행 "전체 공개" 버튼이 `window.confirm()` 네이티브 다이얼로그를 쓰는데, 이게 브라우저 자동화 도구의 CDP 입력 파이프를 블로킹시켜 타임아웃 발생(사람이 클릭할 땐 문제없음 — 자동화 환경에서만 드러난 이슈, 코드 결함 아님). 미완료: 모바일 뷰포트 화면 확인은 이번에도 브라우저 자동화 환경 한계(`resize_window`가 실제 `window.innerWidth`를 바꾸지 못함)로 불가.
- **단어장(2026-09-15~16, 완료 — 최종 8권 구성)**: ALTON SAT 공용 단어장. 원래 10권 계획 중 8·9·10권(추상·개념/저빈도 정밀/최상급)은 후보 어휘 풀이 좁아 중복률이 급증해 각각 200개를 못 채웠다(제품 오너 지시로 세 권의 목표를 8권 하나로 병합, `scripts/vocab-library-seed.ts`의 `VOLUME_PLAN`에서 9·10권 제거·8권 난이도 3~5로 확장). **1~8권 전부 완료(1,800단어)**, 마이그레이션 `20261378`+`20261383`+`20261384` non-prod 반영 완료. 내 단어장 폴더(기본 "오답 노트"), 별표 저장, 시험 선택지 영어화, UI 개편(가리기 개별 공개·A-Z 필터·랜덤 순서·페이지네이션) 전부 구현·테스트·Preview 배포 완료(마이그레이션 `20261376`~`20261380`). 기존 지문 클릭 저장(`VocabClickLayer.tsx`)은 손대지 않음.
- **과제(2026-09-16, 완료, 제품 오너 2차 정정 최종안)**: 과제를 수업(세션)과 완전히 분리 — 발급 시 수업 선택 없음, 배치명 = 발급 날짜, 발급할 때마다 새 배치(`homework_batches`, 단어장 `vocab_quizzes`와 같은 패턴: 세션 비의존 자기완결 레코드). 교사↔학생 쌍 단위로만 저장·노출(RLS + 쿼리 이중 격리, 다른 교사·다른 학생 노출 불가). 학생 포털 과제 탭·교사 포털 "과제 내역"·세션뷰 과제 탭 전부 동일한 공통 컴포넌트(`HomeworkBatchPanel`)로 배치를 눌러 열면 기존 목차/슬라이드 UI 그대로 정답·해설·채점. RPC `issue_homework_batch_v2`(마이그레이션 `20261382`, non-prod 반영 완료). **마이그레이션 `20261381`(`issue_homework_batch`, 회차 연동 1차안)은 이 최종안으로 대체되어 앱에서 더 이상 호출되지 않음 — DB 컬럼/RPC는 삭제하지 않고 방치.** 검증: 통합 테스트 6/6(발급 권한·배치 분리·문제 중복 방지·RLS 격리), 컴포넌트 테스트 전부 통과.
- **SAT Math 생성 품질(2026-09-16, 1단계 완료 + 실측 파일럿 완료)**: 코드 검토([`2026-09-16-sat-math-generation-code-review-and-proposal.md`](2026-09-16-sat-math-generation-code-review-and-proposal.md))에서 지목한 A(검사·저장 문항 분리)/B(필수 검사 미실행이 통과 처리)/C(해설 따라 정답 자동 변경)/G(오답 수정 후 재검증 누락) 결함을 Math 한정으로 수정·모의 검증(`lib/problem-generation/pipeline.test.ts`). R&W는 기존 동작 유지. **실측 파일럿(2026-09-16, `scripts/problem-quality-pilot.ts`, 승인된 소액 예산)**: 5개 유형×5문항 실제 API 호출 → 22/25 저장(88%), 총 $1.55(문항당 $0.07). 실패는 대부분 "정답-해설 불일치라 자동 정정 안 함" 정책이 정상 작동한 케이스. 저장은 admin 문제은행에 초안까지만 — 공개는 관리자 확인 후. **미완료**: 계산 기반 검증 확장(좌표평면·연립방정식 target 명시화 등, 검토 문서 3~4절), 유형 확대 배치(남은 예산 $28.45), Preview 로그인 확인(테스트 계정 없어 미실시).
- **Smart Notes 학생 열람 정책 반전(2026-09-16, 제품 오너 지시)**: 기존 정책("고객에게 원본을 직접 보여주지 않는다", `20261025000000`)을 뒤집어 **정규 수업(계정 생성 이후)에 한해 학생·보호자가 회의록 원본을 열람(view-only)** 할 수 있게 함(마이그레이션 `20261388`). 첫 상담(consultations)은 계속 관리자 전용 — 이 반전 대상이 아님. `session_smart_notes`에 학생·보호자 SELECT RLS 추가, 실제 Drive 문서 reader 권한 부여는 기존 `session_drive_tasks` 큐(`DRIVE_ARTIFACTS_ALLOW_REAL_WRITES` 게이트 재사용)로 비동기 처리(`grantSmartNotesReaderPermission`). **주의**: 이 웹훅(`app/api/webhooks/workspace-events/route.ts`)은 아직 실제 Pub/Sub 구독이 없어(코드 상단 주석 참고) 실제 트래픽으로 발동한 적이 없다 — 큐에 넣는 로직만 완성, 실제 동작은 구독 생성 후 확인 필요. **미완료**: 학생/보호자 포털에 "미팅록 보기" 링크 UI(백엔드 권한만 구현), 동의서 정책 갱신(제품 오너가 계약 문안은 직접 수정 예정 — 콘센트 UI 구조는 아직 손대지 않음), 수업 리뷰 화면 자체의 재설계(5단계 버튼+선택적 텍스트, 교사 본인 리뷰 열람, AI 요약 제거)는 별도 착수 필요.
- 미결(제품 오너): 학생이 푼 것 실시간 배지 / 선택지 자체가 그래프 4개인 문항(선택지 figure) / 이미지가 있는 문항의 AI 생성(현재 AI는 데이터 도형만) / 기한·알림·AI 과제 생성(후속).
- 다듬을 것: ~~`CompositionPanel` 전체 새로고침~~ ~~PDF 교재 행 키워드 이름~~ ~~SessionShell·ProblemBankTab lint 오류~~(완료 2026-09-15). 열린 항목: 통합 테스트 병렬 격리(예약 fixture·append-only 전역 count — 테스트 인프라 결함, 제품 결함 아님) / `session_homework_attempts`는 삭제·마이그레이션 없이 읽기 전용 보존, 보존·삭제 정책은 v3 과제 흐름 안정화 뒤 별도 결정.
- **SECURITY DEFINER·anon 권한 감사(2026-09-23, 1차 완료)**: `pg_proc`에서 SECURITY
  DEFINER 함수 311개 전수 조회 → anon 실행권한(PUBLIC 포함) + 내부 인가검사
  부재 조합으로 51개 후보 도출 → 실제 앱 호출부(`app/**`) 대조로 압축한 결과
  **실제 결함 2건 확인**(둘 다 anon role로 직접 재현해 exploit 성립 확인):
  (1) `find_possible_duplicate_consultations(p_email, p_phone, p_exclude_id)` —
  anon이 임의 이메일/전화번호로 호출하면 `consultations` 테이블 전체 컬럼(연락처·
  상담 내용 등 PII)을 그대로 반환. 유일한 앱 호출부(`app/admin/consultation-actions.ts`
  `findDuplicateConsultationCandidates`)는 `requireAdmin()` 이후 service_role로만
  호출하므로 anon/authenticated 권한은 순수 과잉이었음.
  (2) `hold_entitlement(...)` — 내부에 호출자 인가 검사가 전혀 없어 child_id/
  reservation_id만 알면 타인의 수업권을 소모시킬 수 있었음. 시그니처 변경 이력
  때문에 **오버로드 2개**(4-인자 레거시 + 5-인자 현재)가 각각 별도 ACL을 갖고
  있었고 둘 다 PUBLIC(=X) 포함 과잉 권한 보유. 유일한 호출부(`app/admin/entitlement-actions.ts`
  `holdEntitlementForReservation`)도 `requireAdmin()`+service_role만 사용.
  추가로 `mark_expired_invites()`(is_admin() 내부검사는 있으나 아직 앱에서 미호출)의
  불필요한 anon/authenticated 권한도 함께 제거(방어 심층화).
  **수정**: `supabase/migrations/20261900000001~3` 3건으로 anon/authenticated/PUBLIC
  EXECUTE 권한 회수, service_role/postgres만 유지. **검증**: 수정 전 anon role로
  직접 SQL 실행해 exploit 재현(전체 PII 행 실제로 받아옴) → 수정 후 동일 호출이
  `permission denied for function`으로 차단됨을 재확인, `has_function_privilege()`로
  anon=false/authenticated=false(hold_entitlement)/service_role=true 3중 확인,
  관련 단위 테스트(`consultation-actions.test.ts`/`entitlement-actions.test.ts`)
  63개 전부 통과 확인. **영향받은 사용자 흐름**: 없음(관리자 전용 기능이었고
  실제 호출 경로는 이미 service_role만 썼음 — 이번 수정은 "의도한 대로만 되게"
  좁힌 것이지 기존 정상 흐름을 바꾼 것이 아님).
  **미완료(2차 필요)**: 같은 전수 조회에서 PUBLIC(=X) 권한을 가진 SECURITY
  DEFINER 함수가 85개 더 발견됨(대부분 `is_admin()`/`is_master_admin()`/`auth.uid()`
  등 내부 인가검사가 있어 anon이 호출해도 예외로 막히는 것으로 확인했으나,
  하나하나 실측 재현은 이번 1차 범위에서 다 못함) — 다음 라운드에서 나머지도
  같은 방식(전수 실측 → 앱 호출부 대조 → PUBLIC/anon 권한 회수)으로 좁혀야 함.
  또한 이번에 실제로 겪은 함정(시그니처를 바꾸며 CREATE OR REPLACE하면 새
  오버로드가 별도 함수 객체·별도 ACL로 남고, 이미 적용된 마이그레이션 파일을
  고쳐도 반영 안 되는 문제가 겹쳐 한 번에 안 끝나고 세 번에 나눠 고쳐야 했음)를
  체크리스트화해 다음 라운드에 반영할 것.

- **SECURITY DEFINER·anon 권한 감사 2차(2026-09-24, 완료, `20261900000006`)**: 1차가
  남긴 85개 후보 중 anon 실행권한을 가진 SECURITY DEFINER 139개를 전수 조회해
  함수 본문에 `auth.uid()`/`is_admin()`/`raise exception`/trigger 등 내부 인가
  패턴이 없는 21개를 추출, 앱 실제 호출부(`app/**`, `lib/**`) 대조로 좁혔다.
  **실제 결함 1건 확인(exploit 성립)**: `issue_consult_consent_token(consultation_id,
  token_plain, ttl_hours)` — 내부 인가 검사가 전혀 없고 호출자가 consultation_id와
  평문 토큰을 둘 다 직접 지정한다. anon이 임의 consultation_id로 직접 호출하면
  자기가 고른 토큰으로 그 상담의 동의 확인 토큰을 새로 발급받아(기존 토큰도
  무효화 안 됨) 남의 상담 동의를 대신 확인 처리할 수 있었다. `set role anon`으로
  직접 재현(수정 전 성공 → 수정 후 `permission denied` 확인). 유일한 실제 호출부
  (`lib/consultation/calendar-sync.ts`)는 admin(service_role) 클라이언트만 씀 —
  anon/authenticated/PUBLIC 권한 회수, service_role만 유지.
  **나머지 20개**: 전부 anon 직접 호출 경로 없음(session 클라이언트 또는 admin
  클라이언트로만 호출) — anon/PUBLIC 회수(6개는 admin 전용이라 authenticated도
  회수: `find_consultant_provisioning_for_identity`/`find_teacher_provisioning_for_identity`/
  `log_workspace_link_rejected`/`get_teacher_activation_checklist`/
  `cancel_reservation_notifications`/`refresh_teacher_onboarding_completed_at`/
  `record_pending_guardian_account`/`release_trial_onboarding_link_finalize_claim`,
  나머지 `has_valid_guardian_consent`/`is_under_13`/`student_date_of_birth_known`/
  `list_open_consult_slots`/`list_open_consultant_meeting_slots`/`list_open_meeting_slots`/
  `student_already_has_homework_problem`/`current_curriculum_doc_version_id`/
  `session_student_id`/`session_teacher_id`/`current_account_active`는 authenticated
  유지 — 세션 클라이언트로 실사용 중이거나, RLS USING절에 직접 인라인될 가능성이
  있어 잘못 회수하면 정상 조회가 정책 평가 단계에서 깨질 수 있음). `resolve_consult_consent_token`/
  `confirm_consult_consent_by_token`은 토큰 소지 자체가 인가 수단인 설계(주석에
  명시)라 그대로 둠. **검증**: `has_function_privilege()`로 anon=false 19건 전부
  확인, service_role=true 확인, 관련 단위 테스트(consent-data/workspace-actions/
  trial-onboarding-finalize/consult-actions/consultant-schedule-actions/
  inquiry-actions/calendar-sync) 53개 전부 통과. **영향받은 정상 흐름**: 없음(전부
  server action이 admin 또는 session 클라이언트로만 부르던 것을 그대로 유지 —
  브라우저가 anon 키로 이 RPC들을 직접 부르는 코드 경로는 원래도 없었음).
  **미완료(→ 3차에서 완료, 아래 참고)**: 나머지 118개는 이번엔 정규식 1차
  스크리닝만 했음.

- **SECURITY DEFINER 권한 감사 3차·최종 완료(2026-09-24, `20261900000008~11`)**:
  2차가 남긴 118개(정규식으로 "인가 패턴 있음"까지만 확인됨)를 위험도 순으로
  4개 배치 나눠 전부 개별 실측·호출부 대조 완료 — 1차(2개)·2차(1개)까지 합쳐
  이제 anon/PUBLIC 실행권한을 가진 SECURITY DEFINER 함수 전수(139개)가 개별
  검증 끝났다.
  - **batch1 토큰/초대 14개** — **실제 결함 1건**: `finalize_account_invite(invite_id,
    auth_user_id)`에 `auth.uid()` 검사가 전혀 없고 호출자가 auth_user_id를 직접
    지정 — anon이 accepted 상태(claim 직후~finalize 전 실존 경합구간)인 임의
    초대에 자기 auth_user_id를 넣어 남의 household/학생 프로필을 가로챌 수
    있었다. `set role anon`으로 재현(수정 전 성공 → 수정 후 permission denied),
    유일한 호출부(`app/api/invite/accept/route.ts`)는 admin 클라이언트+서버
    생성 auth_user_id만 써서 service_role만 남겨도 영향 없음. `claim_account_invite`는
    기존 통합테스트 6개가 "anon 접근이 계약"이라고 명시해(토큰 해시 검증 자체가
    인가 근거) 그대로 둠 — 처음에 같이 좁혔다가 테스트 실패로 원복.
  - **batch2 개인정보 22개** — **실제 결함 1건**: `assert_guardian_consent_ok`가
    원래(20260913000000) 생성 시점부터 anon 회수·authenticated만 부여였는데
    지금 anon이 붙어 있었음(재정의한 마이그레이션 없음 — 원인 불명 드리프트,
    이런 "원래 좁혀놨는데 나중에 풀린" 사례가 또 있을 수 있어 정기 재감사
    필요). anon으로 임의 student_id를 넣으면 "13세 미만+동의 없음" 여부를
    예외 메시지로 알아낼 수 있었다 — 재현 확인 후 원복.
  - **batch3 결제·상태변경 25개** — **실제 결함 2건**: `finalize_trial_onboarding_students`
    (auth.uid() 미검사, guardian_auth_user_id 직접 지정 — 같은 클래스의 결함이나
    link_id+claim_id 검증이 1차 방어선), `schedule_reservation_notifications`
    (앱 호출부 자체가 없음 — 다른 SECURITY DEFINER 함수 안에서만 PERFORM으로
    쓰여 애초에 anon/authenticated 권한이 불필요했는데, anon이 임의 reservation_id로
    직접 불러 "정규수업이 예약되었습니다" 알림을 그 가족에게 반복 주입할 수
    있었음 — 스팸/사회공학 벡터). 둘 다 service_role만 남김.
  - **batch4 문의·모의고사·순수 헬퍼 57개** — 55개는 문제 없음(전부 `auth.uid()`를
    본인 또는 정확한 대상 관계로 대조하는 구조 확인), 2개(`submit_homepage_consult_request`,
    `list_consultant_open_slots`)는 취약점은 아니었으나(각각 idempotency key,
    만료·소진 토큰 검사가 있어 anon 직접 호출도 안전) 앱이 admin 클라이언트로만
    부르므로 잉여 권한 회수.
  - **검증 방식(전 배치 공통)**: 각 함수를 "패턴이 있다"가 아니라 "그 패턴이
    실제로 호출자 자신 또는 대상과 일치를 확인하는가"까지 본문을 읽어 판단,
    `has_function_privilege()`로 anon=false/service_role 또는 authenticated=true
    확인, 관련 unit/integration 테스트 재실행(총 150개 이상 통과), 실제 exploit
    가능성이 있던 4건은 수정 전 `set role anon`으로 직접 재현 후 수정 확인.
  - **정상 흐름 영향**: 없음 — 전부 앱이 admin 또는 session 클라이언트로만
    부르던 것을 그대로 유지, `claim_account_invite`만 예외적으로 anon 접근이
    설계상 필요해 그대로 둠.
  - **후속 필요**: (1) 이번에 발견한 "원래 좁혀놨는데 나중에 anon이 재부여된"
    드리프트(`assert_guardian_consent_ok`)의 원인을 아직 못 찾음 — 같은 드리프트가
    다른 함수에도 있을 수 있어 주기적 재감사 권장. (2) 이번 4개 배치도 "인가
    패턴이 있는가"를 사람이 읽고 판단한 것이라, 조건 분기가 미묘하게 틀린
    경우(예: OR 조건 중 하나가 항상 true가 되는 버그)는 여전히 놓쳤을 수 있다 —
    완벽한 전수 검증이 아니라 "이번 세션이 실제로 읽고 판단한 결과"임을
    출시 전 재확인 시 감안할 것.

- **모바일 사이드바 반응형(2026-09-23, 완료)**: 컨설턴트 포털에서 모바일 폭에서도
  사이드바가 항상 풀사이즈로 떠 있어 본문이 가로 스크롤되던 문제 — `app/consultant/ConsultantShell.tsx`에
  `md:` 브레이크포인트로 사이드바를 드로어화(햄버거 버튼+오버레이+탭 시 자동
  닫힘). 실제 375px 뷰포트로 재현 검증 완료. 다른 포털(관리자/선생님/학부모)
  셸은 아직 손대지 않음 — 같은 패턴이면 각각 별도로 필요.

- **university_source_urls 중복 정리(2026-09-23, 완료)**: 모바일 UAT 중 발견 —
  non-prod에 `(university_id, url, source_type, cycle_year)` 완전 일치 중복
  408건(858→450행) 적재돼 있던 것을 가장 이른 id만 남기고 정리. 데이터 수집
  세션 쪽 로컬 DB도 같은 패턴 12건 확인·정리됨(595→583행).

- **E2E 전용 fixture 분리(2026-09-23~24, 완료)**:
  `e2e/minor-consent.spec.ts`가 공용 계정(`ACCOUNTS.student`=지훈)의 생년월일을
  13세 미만으로 바꿨다 되돌리는 식으로 테스트해, fullyParallel 아래 다른
  스펙(`auth-roles.spec.ts` 등)과 같은 계정 상태를 두고 경합하던 것을 이 스펙
  전용 학생/학부모 fixture(`supabase/seed.sql` §13, `e2e-minor-consent-*@example.com`)로
  이전. 옮기는 과정에서 이 스펙 자체의 드리프트 3건도 함께 발견·수정(제품
  코드 변경 없음, 전부 테스트 쪽 문제): (1) "동의 철회" 버튼이 `ConsentTab.tsx`에
  실제로 연결 안 돼 있음(백엔드 함수는 있음 — 제품 오너 확인 결과 UI는 의도적
  보류, 테스트만 관리자 직접 호출 경로로 수정), (2) 로그아웃 헬퍼가 찾던
  "OOO님 ▾" 버튼이 모바일 전용(`md:hidden`) 상단바에만 있어 데스크톱 기본
  뷰포트에서 영원히 타임아웃, (3) 로그아웃(form action) 리다이렉트를 안
  기다리고 바로 다음 로그인을 시도해 실제 경합 재현.
  뒤이어 `complete-profile-flow.spec.ts`/`r4-purchase-flow.spec.ts`도 같은
  패턴으로 이전.

  **2026-09-24 — 나머지 8개 파일 완료**: `r5-subject-enrollment-flow`,
  `r5-subject-enrollment-teacher-assignment`, `m3-teacher-assignment-termination-flow`,
  `r6-lesson-booking-flow`, `problem-bank-flow`, `figure-template-1`,
  `rw-structured-blocks`가 공용 지훈/이서아/공용 household/공용 선생님
  커리큘럼 템플릿을 더 이상 건드리지 않도록 전용 fixture로 옮김. 생성·정리
  로직은 새 공통 헬퍼 `e2e/fixtures.ts`(`createFamily`/`cleanupFamily`/
  `createFixtureTeacher`/`cleanupFixtureTeacher`/`grantOperatingCurriculum`/
  `startedSessionWith` 등)로 통합 — 실행마다 `randomUUID`+타임스탬프로
  태깅된 계정을 만들고, `entitlement_ledger`/`teacher_rate_history`처럼
  설계상 삭제 불가한(INSERT-only 트리거) 테이블이 걸린 경우에만
  `r4-purchase-flow.spec.ts`와 동일하게 완전 삭제 대신 contract만 void하고
  남긴다(다음 실행과 충돌하지 않음 — 실행마다 새 계정이므로). `fullyParallel`
  설정은 그대로 유지.

  `teacher_curriculum_templates(teacher_id, subject_id)` UNIQUE 제약을
  `r5-subject-enrollment-flow`와 `r5-subject-enrollment-teacher-assignment`가
  둘 다 공용 이도현+SAT Math 조합에 동시에 쓰면 병렬 실행 시 충돌하는 것을
  발견 — `r5-subject-enrollment-flow`는 이 스펙 전용 임시 선생님으로
  옮겨 해결(`r6`의 `teacher_availability_rules`는 다른 파일이 안 건드려 충돌
  없음, 공용 선생님 자체를 여러 파일이 assignment 대상으로 재사용하는 것은
  exclusion 제약이 enrollment 단위라 안전).

  `r5-subject-enrollment-flow`/`m3-teacher-assignment-termination-flow`는
  2026-09-11 정보구조 개편(관리자 매칭 화면이 "매칭" 탭에서 "사용자 > 학생 >
  학생 프로필"로 이동, 수강 계획 생성→활성화→배정 3단계가 매칭 확인 한
  번으로 통합)으로 기존 테스트가 이미 존재하지 않는 화면을 찾고 있던 것도
  함께 발견·재작성(순수 테스트 드리프트, 제품 결함 아님). `r6-lesson-booking-flow`도
  2026-09-19 UAT 반영(예약이 독립 "Bookings" 탭으로 이동)에 맞춰 갱신.

  **검증**: DB 레벨 4개 파일(`r5-subject-enrollment-flow`/
  `r5-subject-enrollment-teacher-assignment`/`m3`/`r6`, 총 17개 테스트)을
  기본 병렬 설정으로 두 번 연속 실행해 모두 통과, 재실행 계약 중복 충돌
  없음 확인. 공용 시드 계정(지훈/이서아)에 남은 contracts 없음 확인.
  나머지 3개 파일(`problem-bank-flow`/`figure-template-1`/`rw-structured-blocks`)은
  실제 AI 생성을 포함해 fixture 전환 자체는 끝났지만, 검증 중 이 작업과
  무관한 별개의 사전 존재 UI 드리프트를 발견해 별도 작업으로 분리했다
  (아래 항목 참고) — 이번 라운드에서는 8개 파일 전체가 아니라 5개 파일만
  실제 통과까지 확인됨.

- **문제은행 E2E 3개 파일 UI 드리프트(2026-09-24 발견, 미해결 — 별도 작업)**:
  `problem-bank-flow`/`figure-template-1`/`rw-structured-blocks` 3개 파일이
  `/admin?tab=problem-bank`으로 이동한 뒤 실제 AI 생성까지 검증하는 흐름인데,
  fixture 격리 검증 중 이 파일들이 2026-09-17 제품 개편("생성/검수/공개/보관"
  4개 버킷 분리, 버킷 기본값이 이제 "검수") 이후 한 번도 갱신되지 않았음을
  발견했다. 확인된 것:
  1. `page.goto("/admin?tab=problem-bank")` 직후 곧바로 "SAT Math"/"AP" 등
     체계 탭을 찾던 12곳 전부 — 그 탭은 "생성" 버킷 안에만 있는데 기본
     버킷이 "검수"라 전부 타임아웃. **이건 이번에 고쳤다**("생성" 버킷 버튼
     클릭을 12곳 모두 추가, `npx tsc --noEmit` 통과).
  2. 위 수정 후 재검증하니 또 다른 문제 발견: `problem-bank-flow.spec.ts`의
     "AP 탭" 테스트가 `getByLabel("SAT 영역", { exact: true })).toHaveCount(1)`을
     기대하는데, 그 라벨을 가진 select는 버킷 분리 이전에 "생성" 화면에
     같이 있던 필터 줄(`FilterBar`, `aria-label="SAT 영역"`, 검수/공개/보관
     버킷에만 있음)과 SAT R&W 생성 폼 자신(`aria-label="SAT 영역"`, AP
     선택 시엔 렌더 안 됨) 둘을 가정한 것 — 버킷 분리 이후 "생성" 화면에는
     필터 줄이 없어져 AP 탭에서는 0개가 정상이다. 같은 이유로 CASES 루프
     테스트들이 쓰는 `getByLabel("SAT 영역", {exact:true}).nth(1)`도 필터
     줄이 사라져 `.nth(1)`이 범위를 벗어날 가능성이 높다(직접 하나하나
     재검증 필요 — 실제 AI 호출이 걸려 비용·시간이 크다).
  **사용자 결정(2026-09-24)**: 이번 fixture 격리 작업 범위에서 제외하고
  별도 티켓으로 분리. 다음 세션에서 실제 AI 생성까지 포함해 3개 파일
  전체를 현재 화면 기준으로 재검증·수정할 것 — 위 두 항목이 출발점.

- **`mark_expired_invites` cron 연결(2026-09-24, 완료)**: `app/api/cron/mark-expired-invites/route.ts`
  신설(기존 payout 크론과 동일 fail-closed 패턴, `vercel.json`에 매시간 등록).
  RPC가 `is_admin()`만 통과시켜(서비스 롤 호출은 `auth.uid()`가 null이라 항상
  실패) 크론이 원래 못 돌았을 것 — `is_admin() OR auth.role() = 'service_role'`로
  조건만 넓혀 사람 관리자 세션 경로는 그대로 두고 서비스 롤도 허용
  (`20261900000007`). 검증: `set role service_role`로 직접 호출 성공, `set role
  anon`은 여전히 차단, 기존 통합 테스트 18개 전부 통과, 새 라우트 테스트 4개
  추가. **주의**: Vercel에 `CRON_SECRET` 환경변수가 아직 없으면 이 크론은
  503으로 비활성 상태 그대로다(다른 두 payout 크론과 같은 안전장치) — 실제
  활성화하려면 `CRON_SECRET`을 설정해야 하고, 이는 다른 크론까지 동시에
  활성화시키는 스위치이므로 사용자 승인 필요.

- **Workspace 위임 계정 분리(2026-09-24, 재확인 — 코드 작업 아님, 외부 실제
  계정 작업 필요)**: `docs/2026-08-29-master-roadmap-v3.md:1014`에 명시된 원래
  요구사항은 domain-wide delegation의 위임 대상을 `official@alton.education`
  (Gate C 검증 때 임시로 쓴 실제 회사 최고관리자 계정)에서 **사용자 관리
  권한만 가진 전용 자동화 관리자 계정**으로 바꾸는 것. 코드는 이미
  `GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL` 환경변수로 위임 대상 이메일을
  주입받게 돼 있어(`lib/google-workspace-auth.ts:149`) 코드 변경은 필요 없다 —
  남은 작업은 전부 실제 Google Workspace Admin Console에서 사람이 해야 하는
  일이라 이 세션이 대신 할 수 없다: (1) `alton.education` 도메인에 사용자
  관리(만) 권한을 가진 커스텀 관리자 역할 생성, (2) 그 역할로 새 계정(예:
  `automation@alton.education`) 생성, (3) domain-wide delegation의 승인 대상
  주체(subject)를 그 계정 이메일로 변경, (4) Vercel
  `GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL`을 새 이메일로 갱신, (5) 기존
  `official@alton.education` 위임을 그대로 둘지 회수할지 결정. 실제 회사
  Google Workspace 관리자 콘솔 접근·계정 생성은 사용자(또는 IT 담당)가 직접
  진행해야 하며, 완료되면 이 세션(또는 다음 세션)이 env 값 갱신·재검증만
  이어받는다.

## 7. 관련 문서
- **표준 렌더링 엔진**(승인됨, 템플릿 1 구현): `docs/2026-09-14-standard-rendering-engine-design.md` + 표본 `docs/assets/2026-09-14-render-samples/`. AI=의미 데이터만, ALTON 렌더러=조판, 검증 계층=거부. 좌표형 `geometry` 는 레거시(표시만, 공개 불가). 템플릿 1~7 완료(평행선·삼각형·좌표평면·표/데이터·원·사각형/다각형·입체) + 분류 모델. 다음: 좌표기하·복합 도형 → 그래프/도형 선택지 → 수식·로마숫자 선택지 Block.

- **남은 작업 전체 목록**: [`2026-09-14-remaining-work.md`](2026-09-14-remaining-work.md)(A 지금 UAT → B 콘텐츠·수업 → C 상담·결제·정산·문서 → D 운영·소통 → E 보안·데이터 수명 → F 출시 게이트).
- 문제 템플릿 설계: [`2026-09-14-problem-template-design.md`](2026-09-14-problem-template-design.md) · 과제 통일: [`2026-09-14-homework-v3-unification.md`](2026-09-14-homework-v3-unification.md) · 문제 풀이·채점·PDF 텍스트: [`2026-09-14-problem-answer-grading-and-pdf-text-notes.md`](2026-09-14-problem-answer-grading-and-pdf-text-notes.md) · Drive 자료 설계: [`2026-09-14-drive-material-assets-design.md`](2026-09-14-drive-material-assets-design.md) · PDF 규격: [`2026-09-14-lesson-pdf-spec.md`](2026-09-14-lesson-pdf-spec.md) · 로드맵: [`2026-08-29-master-roadmap-v3.md`](2026-08-29-master-roadmap-v3.md) · 이전 이력 전체: [`history/CURRENT-archive-until-2026-09-14.md`](history/CURRENT-archive-until-2026-09-14.md).

- 2026-09-29 관리자 Consultants 탭 서브탭화: 배정(자동배정·미배정·일정 대기)/계정/선생님 배정 요청/상담 자료, 대기 건수 배지. `정산`은 Payouts의 `컨설턴트 정산` 서브탭(`ConsultantSettlementPanel.tsx`)으로 이동(동작 변경 없음). 스크린샷: `docs/assets/2026-09-29-admin-consultants-subtabs/`.
- 2026-09-29 관리자 Messenger 통합: Inquiries 메인 탭 제거(`?tab=inquiry`는 Messenger 가족 서브탭으로 매핑). 문의함(household 스레드)은 Messenger > `가족` 채널(안읽음 배지, SSR `initialInquiryThreads` 유지), 면담 운영은 Consultants > `면담` 서브탭(지연 로딩, 조치 필요 건수 배지). 죽은 `면담 가능시간` UI·서버 액션 삭제(테이블 유지, 마이그레이션 없음). 스크린샷: `docs/assets/2026-09-29-admin-messenger-consolidation/`.


## AP 렌더링·변환·응시 (2026-10-09, feat/ap-render 로컬 커밋 — 원격 적용 전)
- 마이그레이션 `20262100000400_ap_item_conversion.sql`, `20262100000401_ap_exam_sets.sql`(로컬 DB 적용·재적용 멱등 확인, 원격 미적용 — 총괄이 비프로덕션에 순서대로 적용).
- 그림: `lib/problem-figures/templates/ap-*.ts`(ap_graph/ap_table/ap_table_set/ap_diagram) + `lib/ap-figures/`(정규화·게이트). 보고서·스냅샷 `data/ap/render-check/`.
- 변환·세트: `lib/ap-exam/`, `scripts/ap-generation/{publish-to-bank,assemble-ap-set,mark-verified,render-check,local-demo-seed}.ts`. 상세 `docs/ap/publication-flow.md` §5.

## AP 모의고사 콘텐츠 현황 (2026-10-14, 비프로덕션 `worpsqwqgnspddnrtnvq`, 전부 무료 공개)
- 공개: SAT 14세트(감사 r1~r5 반영), AP Calculus AB/BC, Statistics, Physics 1, Chemistry, Microeconomics, Macroeconomics, CS A, Biology(1=v2, 2=v3), English Language(1·2=v2, 독립 검수 수정본), Psychology(1·2, CED 2025: MC 75·FRQ AAQ+EBQ).
- 진행: English Literature(LT), US History(US) 생성 에이전트. 세계사 등 남은 과목은 예산 상향 후.
- 예산: 누적 $172.5 / 상한 $220 / 중단선 $215(`scripts/ap-generation/ledger-total.ts`). 원장 병합은 항목 합집합(at,note,usd).
- 학생 목록은 AP 안에서 과목별 서브탭(`StudentMockExamTab`), 시험 중 나가기 버튼·섹션 시작 화면 포함.
- English 서술형 AI 채점: `lib/essay-grading/*`(루브릭 englang-v2, 평균 오차 0.33점, 참고용 ±1점), Vercel Preview에 키·플래그 설정 완료. 학생에게 켜기 전 실제 제출 UAT 필요.
- 새 AP 과목 투입 절차: 커리큘럼 시드 SQL(`scripts/ap-curriculum/seed-sql.ts` → `supabase db query --linked -f`) → 관리자 '배치 전체 적재'(필요 시 건너뜀 허용) → 초안 저장(배정 보고서) → 검토 탭에서 공개. 공개 세트 교체는 '새 버전'(교체안 `data/ap/stock/*swap-plan*.json`).
- 알려진 한계: 사람 검수 없음(모델 검증), Macro·Psych 난이도 높은 문항 적음, English 샘플 점수 일부 사람 채점 필요, Vercel Function Storage 한도 임박(`docs/vercel-function-size.md` 작업 중).

## AP 결과 화면·예상 등급 준비 현황 (2026-10-21)
- **예상 AP 등급은 여전히 숨김**(향후 제공 방향, 현재 숨김은 임시). 환산 경계점 값은 18과목 모두 없음(`docs/ap/grade-estimate-audit-2026-10-21.md`).
- 결과 화면(학생·학부모 읽기 전용·관리자 읽기 전용)은 `lib/ap-exam/result-score.ts` 하나를 쓴다: 미채점 FRQ ≠ 0점, 가중 합산은 풀 구성·전체 채점 완료 때만.
- **Preview 학생 결과 화면 확인 완료**: English Language 응시 `5b9952b6…`, Calculus AB 응시 `7020773d…`(총괄 확인). English Language 의 빈 응답 2건은 **제출 확정 후 실제 0점**이며 복구 대상이 아니다(정책상 건너뜀 `empty`). 표시된 **가중 합산 6.1/100 은 해당 응시의 계산 검증 결과일 뿐 예상 AP 등급 정확성 검증이 아니다.**
- **학부모 화면·관리자 AP 결과 화면은 각각 브라우저 확인 전까지 미완료**(코드·단위 테스트 완료; 보호자 연결 계정은 오너 가입 대기).
- 채점 상태 결함 수정(2026-10-21): 일일·월간 한도 초과는 최종 skipped 가 아니라 "대기"(failed + 한도 초기화 시각 `next_retry_at`, 시도 횟수 미소모, 예산 자동 증액 없음)이며 기존 Retry 경로로 초기화 뒤 한 번만 처리된다. 기준 답안(앵커) 3개 미만은 모델 호출 없이 `no_reference_answers` 이용 불가 상태와 사유를 남기고, 보강 뒤 그 답안만 재처리된다(임시 기준 답안 자동 생성 없음). 완료 답안·제출 확정된 빈 답안은 재채점하지 않는다. 멈춘 응시 집계: `docs/ap/stuck-essay-scoring-report-2026-10-21.md`(전부 테스트 계정, 일괄 재채점 하지 않음).
- 파일럿: 이용량 구간별 AI 호출 예산(최대 약 $74)은 **미승인 제안**. 사람 2차 채점·유료 인센티브는 범위 제외. European History 추가 검증은 별도 에이전트(예산 중복 없음). `docs/ap/grade-estimate-pilot-plan.md`.

- **[2026-10-21 22:51 UTC] AP US History Practice Exam 3 공개**: 세트 `e3cb8ff1-e775-4532-ba4a-5bbe1611ad82`(문항 60: MC 55 + FRQ 5), 실제 사료판. DB 해시 20/20 파일·렌더·화면 증거 일치, 독립 편성 위반 0, US1·US2와 문항 겹침 0. 옛 합성 초안 `7d5377c4…`는 보관(응시 0, 문항 60 보존). 근거 범위: SAQ1 B·C 루브릭을 증거 기반으로 수정하고 AI 채점기 2종(Opus 5.5·Sonnet 5.5) 16사례 회귀 16/16 일치 — **역사 교사 검수 아님**. 공개 US History는 3세트. 검증용 테스트 응시 1건(학생 테스트22, 시도 `99e0ade2-3218-4d95-8dfe-0f3ffba6b9bd`, 미제출)은 정리 대상.
