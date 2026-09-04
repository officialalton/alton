# M4 외부 통합 검증 요청서 (실행 금지 — 문서만, 제품 오너 승인·실행 대상)

이 문서는 **요청서**다. 이 문서에 적힌 어떤 외부 호출·이메일 발송·Preview
생성·원격 DB 적용도 이 세션에서 실행하지 않았다. 실제 실행은 제품 오너가 아래
내용을 검토·승인한 뒤 직접(또는 명시적으로 재지시한 별도 세션에서) 수행해야
한다. **Preview 브랜치 push·Preview 생성 자체도 아직 하지 않았다 — 이 라운드는
계획 정정까지만이다.**

## 0. 배경

M4(상담→체험→정규 전환 통합)는 로컬 코드·DB·E2E·UI 폴리싱까지 완료됐다
(`docs/CURRENT.md`/`docs/2026-08-29-master-roadmap-v3.md` M4 절,
`docs/2026-09-03-m4-migration-execution-log.md` 참고). 이번 라운드에서 체험
온보딩 안내를 실제 SMTP 경로로 보내고, prospect 이메일과 보호자 로그인
이메일을 분리 처리하는 기능이 추가됐다(로컬 Mailpit으로만 검증, 실제 발송
없음). 남은 것은 실제 Google/DocuSign/Stripe와 Preview 환경을 이용한 종단
통합 검증뿐이다.

## 1. 안전한 Preview 계획 (Preview 전용 브랜치 — main push 아님)

- **브랜치 방식**: 로컬 `main`을 원격 `main`에 push하지 않는다. 대신 현재
  검증된 로컬 HEAD에서 **`preview/m4-integration-verification`** 브랜치를
  새로 만들어 그 브랜치만 원격에 push한다(`git push origin preview/m4-integration-verification`).
  이 브랜치는 이 요청서 승인 전까지 만들지 않는다.
- **대상 Vercel 프로젝트**: 기존 R4/R5 검증 때 쓴 것과 동일한 Vercel 프로젝트
  (Production 도메인 `app.alton.education`을 서비스하는 그 프로젝트) — 별도
  프로젝트를 새로 만들지 않는다. Vercel의 "Git 브랜치별 자동 Preview 배포"
  기능을 그대로 쓴다(Production Branch 설정은 `main`으로 유지된 채 그대로 둠).
- **Production 브랜치와 분리된다는 확인 방법**:
  1. Vercel 프로젝트 설정(Settings → Git)에서 Production Branch가 여전히
     `main`으로 지정돼 있는지 배포 전에 스크린샷으로 남긴다.
  2. `preview/m4-integration-verification` push 후 Vercel이 만든 배포가
     "Preview" 유형(Production 아님)으로 표시되는지 배포 목록에서 확인한다.
  3. 배포된 Preview URL이 `app.alton.education`이 아니라 `*.vercel.app`
     (또는 프로젝트의 Preview 전용 서브도메인)인지 URL을 직접 확인한다.
  4. 검증 도중 Production 도메인에 접속해 이전과 동일한 화면(M4 변경 반영
     안 됨)이 보이는지 대조 확인한다.
- **환경변수**: Preview 환경변수만 설정·변경한다(Vercel Settings →
  Environment Variables → Preview 스코프로 한정). Production 스코프 환경변수는
  이 검증 전체에서 조회만 하고 변경하지 않는다.

## 2. 원격 비운영 Supabase 프로젝트 식별 + 마이그레이션 목록

- **대상 프로젝트**: R4/R5 검증 때 이미 확인된 비운영 Supabase 프로젝트,
  참조 ref `worpsqwqgnspddnrtnvq`(`docs/CURRENT.md` "최신 마이그레이션" 절에
  이미 이 ref로 R5 마이그레이션 3건이 `db push --linked`로 반영된 이력이
  있음). **실행 직전 반드시 재확인**: Supabase 대시보드에서 이 프로젝트 이름이
  "officialalton's Project"(운영 조직과 무관한 개발/검증용 프로젝트)이고
  실제 고객 테이블(예: 결제 완료 건수, 실제 학생 수)이 비어있거나 테스트
  데이터뿐인지 한 번 더 확인한 뒤에만 진행한다.
- **현재 원격에 적용된 마이그레이션**: `20260925000000`/`20260925010000`/
  `20260925020000`(R5, 이미 반영 확인됨) — 그 이후(R6/M1/M2/M3/M4 전체)는
  **아직 이 원격 프로젝트에 반영되지 않았다**(로컬 개발 DB에만 적용돼 있음).
- **이번에 적용 예정인 마이그레이션 목록**(R6부터 M4 6/N까지, 순서대로):
  `20260926000000`~`20261008000000`(R6, 총 8개) → `20261009000000`~
  `20261011000000`(M1, 3개) → `20261012000000`~`20261013000000`(M2, 2개) →
  `20261014000000`(M3, 1개) → `20261015000000`~`20261018000000`(M4, 4개).
  **`npx supabase migration list --linked`로 실행 직전 실제 diff를 다시 뽑아
  이 목록과 대조한 뒤에만 진행한다** — 이 문서의 목록은 작성 시점 스냅샷이다.
- **적용 전 백업**: Supabase 대시보드의 Point-in-Time-Recovery(또는 최소
  `pg_dump`)로 적용 직전 스냅샷을 남긴다.
- **migration diff 확인**: `npx supabase db diff --linked`(또는 각 마이그레이션
  파일을 순서대로 육안 검토)로 additive-only(컬럼/테이블 추가, 기존 데이터
  삭제·컬럼 제거 없음)인지 재확인 — 이 세션이 작성한 모든 M1~M4 마이그레이션은
  설계상 additive-only다.
- **적용**: `npx supabase db push --linked`.
- **적용 후 검증**: `npx supabase migration list --linked`로 local=remote
  일치 확인 + 핵심 테이블(`teacher_assignments`, `subject_enrollments`,
  `trial_onboarding_links` 등) 존재·건수 확인.
- **실패 시 복구**: PITR 스냅샷으로 롤백(Supabase 대시보드) 후 원인 파악 —
  `db push`가 실패하면 기본적으로 트랜잭션 단위라 부분 반영 위험은 낮지만,
  실패 시 어떤 마이그레이션까지 반영됐는지 `migration list --linked`로
  확인 후 그 이후만 재시도한다.

## 3. 테스트 계정 계획(확정)

| 역할 | 이메일 | 비고 |
|---|---|---|
| 관리자 | `admin@alton.education`(기존 Sandbox 관리자 계정) | 신규 생성 불필요 |
| 보호자(신규, prospect 겸용) | **`matchbox512@snu.ac.kr`** — 상담 prospect 이메일이자 신규 보호자 로그인 이메일로 그대로 사용 | 서로 다른 신규 이메일을 따로 만들지 않는다. 이 계정으로 로그인 이메일 변경 예외 흐름(§외부 UAT에서는 실행 안 함, 로컬에서만 검증됨)은 시도하지 않는다 |
| 학생 | **`matchbox512@gmail.com`**(보호자 `matchbox512@snu.ac.kr`와는 별개의 실제 이메일 — 제품 오너 확정) | 보호자 이메일과 절대 혼용하지 않는다(서로 다른 실제 주소) |
| 선생님 | **`teacher1@alton.education`**(실제 Google Workspace 계정, Calendar/Meet organizer 필요) | `seoyeon@example.com` 같은 로컬 시드 계정은 실제 Google Workspace 계정이 아니므로 이 검증에 쓰지 않는다 — 실제 Calendar 이벤트 organizer가 되려면 진짜 `@alton.education` Workspace 계정이 필요하다. 이 계정에 대해 선생님 배정·가능 시간(teacher_availability_rules)이 원격 DB에 미리 준비돼 있어야 한다(§7 1단계에서 확인). |

**결정 필요 항목 없음** — 테스트 계정 4개(관리자·보호자·학생·선생님) 전부
확정됐다.

## 4. 외부 이메일 상한 재계산(표)

| 메일 종류 | 발신 주체 | 수신자 | 목적 | 최대 발송 수 |
|---|---|---|---|---|
| 체험 온보딩 안내 | ALTON 자체 SMTP(`lib/email.ts`) | `matchbox512@snu.ac.kr` | 온보딩 링크 전달 | 1건(멱등 — 재클릭해도 안 늘어남을 로컬에서 이미 확인) |
| Supabase Auth 계정 확인/recovery(보호자) | Supabase(GoTrue) | `matchbox512@snu.ac.kr` | 계정 생성 확인 + `/set-password` 진입 | 1건(재시도 포함 최대 2건) |
| 학생 계정 확인 | Supabase(GoTrue) | `matchbox512@gmail.com` | 학생 Auth 계정 생성 확인 | 1건 |
| 체험 Calendar 초대·정리 알림(60분) | Google Calendar(네이티브 초대, `sendUpdates=all`) | `matchbox512@gmail.com`만(보호자 제외 — 기존 정책) | 초대 + 검증 후 이벤트 취소 시 취소 알림 | 초대 1건 + 취소 알림 1건 = 최대 2건 |
| 정규 Calendar 초대·정리 알림(120분) | Google Calendar(네이티브 초대) | 위와 동일 | 초대 + (검증만 하고 실제 수업 없이 정리할 경우) 취소 알림 | 초대 1건 + 취소 알림 1건 = 최대 2건 |
| DocuSign 서명 요청·완료 확인 | DocuSign Sandbox | `matchbox512@snu.ac.kr` | 서명 요청 + 서명 완료 확인 | 최대 2건 |
| Stripe TEST 영수증 | Stripe | `matchbox512@snu.ac.kr` | 결제 확인(TEST 모드는 발송 안 되는 경우도 있음) | 최대 1건 |

**총 예상 발송 수: 최대 11건.** 보호자 관련 메일은 전부 `matchbox512@snu.ac.kr`
로만, 학생 관련 메일은 전부 `matchbox512@gmail.com`으로만 간다. **이메일
변경 예외 흐름(로그인 이메일을 다른 주소로 바꾸는 것)은 이 외부 UAT에서
실행하지 않는다** — 이미 로컬 DB 통합 테스트(`app/consult/trial-login-email-change.integration.test.ts`)
와 컴포넌트 테스트(`ConfirmEmailForm.test.tsx`)로 검증 완료. 지정되지 않은
실제 고객·임의 주소로는 어떤 메일도 발송하지 않는다.

## 5. Google Calendar·Meet·Smart Notes·Workspace Events 검증 범위(정정)

- **Calendar 이벤트 최대 2개**: 체험 60분 1개 + 정규 120분 1개. 두 이벤트
  모두 organizer는 `teacher1@alton.education`, attendee는 §3의 학생 이메일만
  (보호자는 attendee 아님 — 기존 정책 그대로).
- **정규 120분 이벤트는 생성 확인만 한다** — 실제 정규 회의 참여, 두 번째
  Smart Notes 생성은 하지 않는다(체험 1회분만 Smart Notes를 실제로 발생시킨다).
  120분 이벤트는 "같은 `teacher_assignment` ID·같은 선생님으로 이벤트가
  정상 생성되는지"만 확인하고 바로 취소·정리한다.
- **Smart Notes 실제 회의는 체험 1회만, 최대 20분**: 제품 오너가 체험
  Meet에 접속해 Smart Notes(자동 회의록) 생성이 트리거되는 것만 확인되면
  즉시 종료한다 — 실제 수업 진행 시간만큼 오래 접속해있지 않는다.
- **Smart Notes 문서 최대 1개**: 생성 확인 후 반드시 Drive에서 삭제한다(이전
  요청서의 "보관 후 별도 정리"를 "검증 후 즉시 삭제"로 강화).
- **Workspace Events 구독**: 이번 검증 중 **새로 만든 구독만** 정지·삭제한다.
  `teacher1@alton.education`이나 다른 조직 계정에 이미 있던 기존 공유 구독은
  절대 건드리지 않는다 — 구독 목록을 검증 시작 전/후로 비교해 이번에 새로
  생긴 것만 골라 정리한다.
- **정리 대상**: Calendar 이벤트 2개, Meet space 2개(각 이벤트에 연결),
  Smart Notes 문서 1개, 이번에 신규 생성된 Workspace Events 구독. Directory
  API/IAM 변경은 하지 않는다(기존 DWD 위임 범위 그대로 사용).

## 6. DocuSign·Stripe 검증 범위(정정)

- **DocuSign**: Sandbox envelope 최대 1개, 보호자(제품 오너, `matchbox512@snu.ac.kr`
  로 서명)가 실제로 서명 완료하는 것까지 확인한다. `assertDocusignSandboxBaseUri()`
  가 Sandbox 아닌 Production 발송을 코드 레벨에서 막지만, 발송 직후 대시보드
  에서 Sandbox 계정으로 발송된 것을 다시 한번 눈으로 확인 — Production으로
  가는 것으로 보이면 즉시 중단.
- **Stripe**: TEST 모드 정규상품 구매 최대 1건. Live 키·실제 결제수단은
  어디에도 입력하지 않는다(테스트 카드 `4242 4242 4242 4242`만 사용).
- **환불은 이번에 하지 않는다** — M2에서 이미 로컬로 검증 완료된 항목이라
  실제 Stripe 환불 API를 다시 부르지 않는다. 계약·결제·웹훅 재처리를 반복
  실험하지 않고, 이미 있는 로컬 테스트 근거(각 R/M 실행 로그)를 그대로 신뢰한다.
- **순서 확인**: 보호자 서명 완료(§7 18단계) 전에는 구매 화면이 열리지
  않는지 먼저 확인하고, 서명 완료 후에만 구매 단계가 열리는지 확인한다.
- **구매 후 확인**: 구매 완료 후 기존 과목 수강 관계가 활성화되고, 체험 때
  배정된 것과 **동일한 `teacher_assignment` ID·동일 선생님(`teacher1@alton.education`)**
  이 그대로 유지되는지 DB에서 직접 확인한다(새 배정이 생기지 않아야 함).

## 7. 전체 종단 UAT 순서 (23단계)

1. Preview 브랜치(`preview/m4-integration-verification`) push + 원격 비운영
   Supabase DB에 M1~M4 마이그레이션 적용 확인(§2) — `teacher1@alton.education`
   에게 SAT Math 등 과목 자격·가능 시간(teacher_availability_rules)이 미리
   준비돼 있는지도 이때 확인.
2. 홈페이지에서 상담 신청(prospect 이메일 = `matchbox512@snu.ac.kr`).
3. 관리자: 상담 수락 → 상담 완료 처리(outcome=trial_recommended).
4. 보호자(제품 오너, 전화 등 외부 채널로 확인한 것을 관리자가 대행 입력하는
   방식): 체험 희망 확인 → 관리자가 `confirmTrialIntentAction` 실행.
5. 관리자: "체험 온보딩 안내 발송" 클릭(§3의 학생 이메일 입력 포함) — 실제
   이메일 1건 발송.
6. 보호자: `matchbox512@snu.ac.kr` 메일함에서 온보딩 링크 수신.
7. 보호자: 링크 클릭 → 로그인 이메일 확인 화면(prospect 이메일 그대로 사용,
   변경하지 않음) → "이 이메일로 계속" → 보호자·학생 계정 생성 + 이메일
   검증(Supabase Auth 확인 메일).
8. (DB 확인) `prospect_contacts.converted_guardian_id`가 방금 생성된 실제
   보호자 계정 id로 명시 연결됐는지, 이메일 문자열 일치가 아니라 실제 인증된
   계정 id 기준인지 확인.
9. 관리자: 과목 수강 관계 생성 + `teacher1@alton.education` 단일 선생님 배정.
10. 보호자: 로그인 → 학생별 최초 1회 체험 Smart Notes 동의.
11. (자동) 60분 체험수업권 지급 확인.
12. 관리자 또는 보호자: `teacher1@alton.education`의 실제 가능 시간으로 체험
    예약(24시간 이상 뒤) → 실제 Calendar 이벤트 1개 + Meet 생성.
13. Calendar·Meet·Workspace Events·Smart Notes 자동 연결 확인(관리자 화면
    "Smart Notes 연결" 단계가 자동으로 완료로 바뀌는지) — 제품 오너가 Meet에
    잠깐(최대 20분) 접속·퇴장.
14. 외부 학생 attendee가 Smart Notes 원본(AI 회의록)에 접근할 수 없는지
    확인(원본은 배정된 선생님·필요한 관리자만 접근 가능해야 함).
15. 선생님(`teacher1@alton.education`): 체험 리뷰 작성 → 미리보기 확인 →
    공개 확정.
16. 보호자: 확정 리뷰 확인 → 정규 진행 희망 표시.
17. 관리자: '정규 계약 발송' 1회 클릭(확인 다이얼로그 통과) → 회사 선서명 +
    DocuSign Sandbox 발송이 한 번에 실행되는지 확인.
18. 보호자: 실제 DocuSign 이메일 수신 → 실서명 완료.
19. DocuSign 웹훅 반영 → 계약 `active` 전환 확인(서명 전에는 구매 버튼이
    없었는지도 이 시점에 되짚어 확인).
20. 보호자: Stripe TEST로 정규상품(단건 또는 10회) 구매.
21. 관리자: 과목 활성화 → 같은 `teacher_assignment`·같은 선생님으로 120분
    정규 Calendar 이벤트가 생성되는지 확인(정규 회의 참여·2차 Smart Notes는
    생성하지 않음).
22. 위에서 만든 체험·정규 Calendar 이벤트 2개 취소(취소 알림 발송 확인),
    Smart Notes 문서 삭제, 신규 Workspace Events 구독 정지.
23. 모든 외부 객체·환경변수·테스트 상태 정리 확인(§9) 후 Preview 브랜치 유지/
    삭제 여부를 제품 오너에게 보고.

## 8. 실패 즉시 중단 조건

다음 중 하나라도 발생하면 **즉시 중단**하고 원인 파악 전 다음 단계로 진행하지
않는다:

- Production 도메인·배포·환경변수에 어떤 형태로든 영향이 발생한 것으로 보이는 경우.
- 원격 `main`으로의 push가 필요해 보이는 상황(이 검증은 Preview 브랜치로만 진행).
- §3에서 지정한 주소(`matchbox512@snu.ac.kr`, `matchbox512@gmail.com`) 외의 실제
  주소로 메일이 발송된 경우.
- Stripe가 TEST가 아니라 Live 모드로 동작하는 것으로 보이는 경우.
- DocuSign이 Sandbox가 아니라 Production 계정으로 발송된 경우.
- 학생 등 외부 attendee가 Smart Notes 원본(AI 회의록)에 실제로 접근 가능한 것으로 확인된 경우.
- 계정 이메일 문자열이 같다는 이유만으로 자동 병합되는 것을 발견한 경우.
- 기존(이번에 새로 만들지 않은) Workspace Events 구독이나 다른 조직의
  Google 객체를 변경·삭제하려는 상황이 생긴 경우.
- §4~§6에서 정한 상한(이메일 11건, Calendar 이벤트 2개, DocuSign envelope
  1개, Stripe 결제 1건 등)을 넘기려는 상황이 생긴 경우.
- 원격 DB가 비운영 프로젝트가 아니거나, 이 검증과 무관한 기존 데이터가
  예기치 않게 변경된 것을 발견한 경우.

## 9. 정리·원복 절차

1. **Google 객체**: 체험·정규 Calendar 이벤트 2개 + Meet space 2개 + Smart
   Notes 문서 1개를 **반드시 삭제**한다. Workspace Events 구독은 **이번에
   새로 만든 것만** 정지·삭제하고, 기존 구독·IAM·Production 환경변수는
   손대지 않는다.
2. **환경변수**: Preview에서 켠 모든 `*_ALLOW_REAL_CALLS`/`*_ALLOW_REAL_READS`
   플래그를 검증 종료 즉시 `false`로 되돌린다.
3. **DocuSign·Stripe**: Sandbox/TEST 계정에 남는 envelope 1개·결제 1건은
   삭제할 수 없는(또는 삭제할 필요 없는) 원격 기록이므로 지우지 않되, 정확한
   envelope ID·Stripe payment intent ID·목적(M4 외부 통합 검증)을 이 문서
   갱신본이나 실행 로그에 남긴다.
4. **DB 테스트 데이터**: 이번 검증으로 만들어진 상담·계정·계약·구매·
   entitlement 행은 삭제하지 않고 유지하되(불변 테이블이 섞여 있어 완전
   삭제가 어렵다는 점은 로컬 통합 테스트와 동일), 이 데이터가 향후 운영
   집계·매칭·정산 로직에 섞이지 않는지 확인한다 — 서비스 오픈 전이라 현재는
   운영 집계 자체가 없지만, R7(정산) 착수 전에 이 테스트 데이터를 별도
   표시하거나 정리하는 절차를 그때 다시 검토한다(이번 라운드에서 R7 착수는
   금지).
5. **Preview 배포**: 검증이 끝나면 이 Preview 브랜치를 유지할지 삭제할지, 그
   배포 상태가 어떻게 됐는지 제품 오너에게 보고한다. **Production 승격·원격
   `main` 반영은 이 요청서의 범위가 아니며 별도 승인 전까지 하지 않는다.**

## 10. 예상 소요 시간 + 제품 오너가 직접 확인해야 하는 화면

- **예상 소요 시간**: 준비(Preview 배포·원격 DB 마이그레이션·환경변수) 45분
  + 종단 흐름 실행(§7의 23단계) 약 1.5~2시간 = 총 2.5~3시간 내외(이메일·서명
  대기 포함 반나절 정도 여유 있게 잡는 것을 권장).
- **제품 오너가 직접 확인해야 하는 화면**:
  1. `matchbox512@snu.ac.kr` 메일함에서 온보딩 링크·DocuSign 서명 요청·서명
     완료·Stripe 영수증 수신 확인.
  2. `matchbox512@gmail.com` 메일함에서 계정 확인 메일·Calendar 초대 수신 확인.
  3. 실제 Google Meet 접속·퇴장(Smart Notes 트리거 확인, 최대 20분).
  4. 실제 DocuSign 서명 완료 페이지.
  5. 실제 Stripe TEST 카드 입력 화면.
  6. 관리자 화면의 14단계 파이프라인 표시가 각 단계마다 실제로 자동 갱신되는지.
  7. Vercel 프로젝트 설정에서 Production Branch가 여전히 `main`인지, 이번
     배포가 Preview 유형으로 표시되는지(§1의 확인 방법).

## 11. 법률 placeholder·테스트 계정 확인

- Smart Notes 동의 문구, 계약서 템플릿은 **확정 법률 문구가 아닌 placeholder**
  다 — 화면에도 "확정 전 초안" 안내가 이미 붙어있다. 이 검증으로 이 문구가
  실제 고객에게 노출되는 일은 없다 — §3에서 지정한 테스트 계정
  (`matchbox512@snu.ac.kr`, `matchbox512@gmail.com`, `teacher1@alton.education`,
  기존 관리자 계정) 이외의 누구도 이 흐름에 접근하지 않는다.
- 계약·법률 문서 자체는 이번 검증에서 수정하지 않는다.

## 12. Calendar·Meet·Workspace Events·Smart Notes 전용 Preview 인증 경로 — 승인 요청(신규)

§5 검증을 Preview 배포에서 실제로 진행하려면 기존 `assertNotPreview()`
(`lib/google-workspace-auth.ts`)가 Preview의 모든 Google Workspace 호출을
막는다. 이번 라운드에서 **코드만** 새로 설계·구현했고(아래 12.1~12.3), 실제
GCP 리소스 생성·IAM 부여·Vercel 환경변수 설정·실제 호출은 전혀 하지
않았다 — 전부 제품 오너 승인 후 아래 12.4 순서대로 진행해야 한다.

### 12.1 설계된 이름(실제 생성 안 됨)

- **WIF provider**: `vercel-m4-calendar-preview-verify`
  (pool `vercel`, 프로젝트 `590621873979`, R3의 `vercel-r3-preview`와
  이름·용도 모두 별개).
- **Sandbox 서비스 계정**: `m4-calendar-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com`
  (R3의 `r3-drive-preview-verify@...`와 별개, Production `gate-c-automation`과도
  완전히 분리 — 코드 어디에도 `gate-c-automation`을 참조하지 않는다, 단위
  테스트로 확인함).
- **이 서비스 계정에 필요한 최소 역할/설정**:
  1. WIF provider → 이 서비스 계정 impersonation을 허용하는 IAM 바인딩
     (`roles/iam.workloadIdentityUser`, 아래 12.2 조건부 attribute condition 포함).
  2. 자기 자신에 대한 `iam.serviceAccounts.signJwt` 권한
     (`roles/iam.serviceAccountTokenCreator`를 자기 자신에 셀프 바인딩 —
     기존 Production 서비스 계정과 동일한 패턴).
  3. Google Workspace Admin Console에서 **Domain-wide delegation** 등록,
     허용 scope는 정확히 아래 4개만(그 외 어떤 scope도 추가하지 않는다):
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/meetings.space.settings`
     - `https://www.googleapis.com/auth/meetings.space.readonly`
     - `https://www.googleapis.com/auth/admin.directory.user.readonly`
     (Directory 프로비저닝 scope, Drive scope는 요구하지 않음 — DWD는 구조상
     "도메인 전체 사용자 임퍼소네이션"을 허용하므로, 이 서비스 계정이 임퍼소네이션할
     수 있는 대상은 스코프로만 제한되고 특정 사용자로 한정할 방법은 Google API
     자체에 없다는 한계가 있음 — 남은 위험은 "이 4개 scope로 도메인 내 아무 사용자나
     사칭 가능"이며, 완화책은 12.4의 짧은 검증 기간 후 즉시 폐기다).

### 12.2 Preview 전용 플래그와 fail-closed 조건

새 파일 `lib/google-workspace-preview-verify-auth.ts`. 서버 전용 플래그
`GOOGLE_WORKSPACE_M4_PREVIEW_VERIFY_ALLOW`(기본값 없음 = false 취급, 정확히
문자열 `"true"`일 때만 활성). 이 플래그가 켜져 있어도 아래 중 하나라도
불일치·누락이면 즉시 throw하고 Production 체인으로 넘어가지 않는다:

1. `process.env.VERCEL_ENV !== "preview"`
2. `GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_VERCEL_ORG_ID`가 미설정이거나
   `process.env.VERCEL_ORG_ID`와 불일치 (Vercel team 제한)
3. `GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_VERCEL_PROJECT_ID`가 미설정이거나
   `process.env.VERCEL_PROJECT_ID`와 불일치 (Vercel project 제한)
4. `GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_BRANCH`가 미설정이거나
   `process.env.VERCEL_GIT_COMMIT_REF`와 불일치 (검증 브랜치
   `preview/m4-integration-verification`으로 추가 제한)

플래그가 아예 없으면(Production/local 기본 상태) 위 검사에 도달하기 전에
이미 차단되고, 각 호출부(`lib/google-calendar.ts`,`lib/google-meet.ts`,
`lib/google-workspace-events-subscriptions.ts`,
`lib/google-workspace-directory-readonly.ts`)는 기존 함수
(`getCalendarApiAccessToken`/`getMeetSettingsApiAccessToken`/
`getMeetReadonlyApiAccessToken`/`getDirectoryApiAccessToken`, 전부 기존
`assertNotPreview()` 그대로)로만 간다 — Production/local 동작은 전혀
바뀌지 않는다.

### 12.3 변경된 코드 파일과 테스트 결과

**신규**:
- `lib/google-workspace-preview-verify-auth.ts` — Preview 전용 WIF/서비스계정
  인증 체인(자체 signJwt+토큰 교환, Production 파일과 완전 분리).
- `lib/google-workspace-preview-verify-auth.test.ts` — 9개 케이스(기본 차단,
  잘못된 환경, 기대값 미설정, org/project/branch 불일치 3종, 정상 경로에서
  Production 서비스 계정·R3 provider 미사용 확인, scope 최소성 확인, 에러
  메시지에 응답 본문 미포함 확인).

**수정(조건부 분기만 추가, 기존 분기·기존 함수 시그니처는 그대로)**:
- `lib/google-calendar.ts` — `resolveCalendarAccessToken()` 추가, Calendar
  이벤트 CRUD 4곳에서 사용.
- `lib/google-meet.ts` — `resolveMeetSettingsAccessToken()`/
  `resolveMeetReadonlyAccessToken()` 추가, 기존 7개 호출부 교체.
- `lib/google-workspace-events-subscriptions.ts` — `resolveMeetReadonlyAccessToken()`
  추가, 구독 생성/조회/갱신/삭제 4개 함수에서 사용.
- `lib/google-workspace-directory-readonly.ts` — `resolveDirectoryAccessToken()`
  추가, `getWorkspaceUserByEmail()`에서 사용(§5 Workspace Events 구독 생성 시
  organizer의 Directory immutable id 조회용). `getWorkspaceUserByGoogleId()`/
  `listWorkspaceUsersInOrgUnit()`은 이번 검증 범위 밖이라 그대로 뒀다 — 여전히
  Preview에서 무조건 차단.

**변경하지 않음**: `lib/google-workspace-auth.ts`(Production 체인,
`assertNotPreview()` 포함) — 이번 라운드에서 한 줄도 수정하지 않았다.

**테스트 결과** (2026-09-03, 로컬):
- `npx vitest run lib/google-workspace-preview-verify-auth.test.ts lib/google-calendar.test.ts lib/google-meet.test.ts lib/google-workspace-events-subscriptions.test.ts lib/google-workspace-directory-readonly.test.ts lib/google-workspace-auth.test.ts`
  → 6 files, 45 tests, 전부 통과.
- `npx vitest run`(전체) → 154 files, 913 tests, 전부 통과(기존 통과
  스위트 포함, 회귀 없음).
- `npx tsc --noEmit` → 에러 없음.
- `npx next build` → 성공(31개 라우트 정상 컴파일, 신규 API 라우트 없음 —
  이번 변경은 라우트를 추가하지 않았다).

### 12.4 제품 오너 승인 후 진행 순서(요청서 형태)

**아래는 계획 제시일 뿐 — 이 세션은 실행하지 않는다.**

1. **GCP 프로젝트 확인**: `alton-integration-sandbox`(R3와 동일 Sandbox
   프로젝트, 프로젝트 번호 `590621873979`)에 아래를 생성한다.
   1. WIF pool `vercel`(R3와 공유, 이미 존재)에 provider
      `vercel-m4-calendar-preview-verify` 추가 — issuer는 Vercel OIDC
      (`https://oidc.vercel.com/<team-slug>`), attribute mapping은 R3
      provider와 동일한 필드(`google.subject`, `attribute.owner`,
      `attribute.project`, `attribute.environment` 등 R3 provider 실제
      설정값을 그대로 조회해 복사), **allowed audiences**는
      `https://vercel.com/<team-slug>` 단일 값(R3와 동일 방식 — Vercel
      OIDC 토큰을 커스텀 audience 없이 그대로 검증하는 기존 프로젝트 관례
      유지).
   2. 서비스 계정 `m4-calendar-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com`
      생성, 장기 키(JSON key) 발급 금지.
   3. `roles/iam.workloadIdentityUser`를 이 서비스 계정에
      `principalSet://iam.googleapis.com/projects/590621873979/locations/global/workloadIdentityPools/vercel/attribute.environment/preview`
      (가능하면 `attribute.<branch-related-field>/preview/m4-integration-verification`
      까지 추가 제한 — R3 provider의 실제 attribute mapping 필드명을 먼저
      확인해야 정확한 조건 문자열을 확정할 수 있다) 조건으로 바인딩.
   4. 같은 서비스 계정에 `roles/iam.serviceAccountTokenCreator`를 **자기
      자신**에 바인딩(self signJwt 허용).
2. **Google Workspace Admin Console**: `official@alton.education`
   도메인에서 이 서비스 계정의 client ID로 Domain-wide delegation 등록,
   허용 scope는 12.1의 4개 scope 문자열만 콤마로 이어붙여 등록(그 외 추가
   금지).
3. **Vercel 프로젝트 설정**(Preview 환경 변수, Production/Development에는
   추가하지 않음):
   - `GOOGLE_WORKSPACE_M4_PREVIEW_VERIFY_ALLOW=true`
   - `GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_VERCEL_ORG_ID=<실제 team id>`
   - `GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_VERCEL_PROJECT_ID=<실제 project id>`
   - `GOOGLE_WORKSPACE_M4_PREVIEW_EXPECTED_BRANCH=preview/m4-integration-verification`
   (team id/project id는 Vercel 프로젝트 설정 화면에서 직접 복사 — 이
   세션은 실제 값을 모른다.)
4. **검증 브랜치 배포**: `preview/m4-integration-verification` 브랜치를
   Preview로 배포(§1 계획 그대로, main push 아님).
5. **짧은 실제 검증**: §5 범위(Calendar 이벤트 최대 2개, Meet/Smart Notes
   1회 20분 이내, Workspace Events 신규 구독만)를 §7 UAT 순서대로 진행.
6. **즉시 폐기**: 검증 완료 직후 —
   - Vercel Preview 환경변수 4개 전부 삭제(또는
     `GOOGLE_WORKSPACE_M4_PREVIEW_VERIFY_ALLOW`만 삭제해도 코드 경로는
     즉시 다시 차단되지만, 나머지 3개도 함께 지워 흔적을 남기지 않는다).
   - Admin Console에서 이 서비스 계정의 Domain-wide delegation 항목 삭제.
   - IAM에서 이 서비스 계정과 WIF provider 바인딩 삭제, 서비스 계정 자체도
     삭제(재사용하지 않음 — R3 패턴과 동일하게 "검증 1회용"으로 취급).
   - §9(정리·원복 절차)의 Calendar/Meet/Smart Notes/Workspace Events 정리
     항목을 그대로 수행.

이 순서 전체(1~4)는 제품 오너가 직접 실행하거나, 이 계획에 서면 승인 후
별도 세션에 "12.4의 1~4번을 실행해도 좋다"는 명시적 지시로만 진행한다.
5~6은 그 이후 제품 오너가 직접 진행하거나 재승인 후 이어간다.

---

**이 요청서에 대한 승인·실행은 제품 오너의 몫이다.** 이 세션은 위 계획을
작성·정정만 했으며, Preview 브랜치 push·Preview 생성·원격 DB 반영·실제
Google/DocuSign/Stripe 호출·실제 이메일 발송 중 어떤 것도 실행하지 않았다.
§12의 코드(신규 Preview 인증 경로)는 로컬에서 구현·테스트했지만, 실제 GCP
WIF provider·서비스 계정·IAM 바인딩·Domain-wide delegation·Vercel 환경변수
중 어떤 것도 실제로 생성·설정하지 않았다.
