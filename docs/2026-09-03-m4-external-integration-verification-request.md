# M4 외부 통합 검증 요청서 (실행 금지 — 문서만, 제품 오너 승인·실행 대상)

이 문서는 **요청서**다. 이 문서에 적힌 어떤 외부 호출·이메일 발송·Preview 배포도
이 세션에서 실행하지 않았다. 실제 실행은 제품 오너가 아래 내용을 검토·승인한
뒤 직접(또는 명시적으로 재지시한 별도 세션에서) 수행해야 한다.

## 0. 배경

M4(상담→체험→정규 전환 통합)는 로컬 코드·DB·E2E·UI 폴리싱까지 완료됐다
(`docs/CURRENT.md`/`docs/2026-08-29-master-roadmap-v3.md` M4 절,
`docs/2026-09-03-m4-migration-execution-log.md` 참고). 남은 것은 실제
Google/DocuSign/Stripe와 Preview 환경을 이용한 종단 통합 검증뿐이다.

## 1. 안전한 Preview 배포 방법 + Production 무영향 근거

- **배포 방법**: 이 브랜치(`main`, 로컬 커밋만 존재, `push` 안 됨)를 push해
  Vercel Preview 배포를 새로 만든다. **Production 브랜치(`main`)로의 배포
  승격은 별도로, 이 검증이 전부 끝나고 제품 오너가 명시적으로 승인한 뒤에만
  한다.**
- **Production 무영향 근거**:
  - Preview 배포는 Vercel의 별도 URL(`*.vercel.app` 또는 프로젝트 Preview
    도메인)에서 돌고, Production 도메인(`app.alton.education`)의 트래픽·DNS·
    캐시에 영향을 주지 않는다.
  - Preview 환경변수는 Vercel 프로젝트 설정에서 Production과 분리해서 관리한다
    — 이번 검증에 필요한 `*_ALLOW_REAL_CALLS` 플래그, Stripe/DocuSign TEST
    키는 **Preview 환경에만** 설정하고 Production 환경변수는 건드리지 않는다.
  - DB는 로컬 개발 DB가 아니라 **원격 Supabase 프로젝트**(현재 R4/R5 검증 때
    쓴 것과 동일한 비운영 프로젝트, `docs/CURRENT.md`의 "배포" 절 참고)를
    그대로 재사용한다 — 실제 운영 고객 데이터가 없는 프로젝트라는 점을
    재확인한다(서비스 오픈 전, `CLAUDE.md` "현재 작업 기준" 참고).
  - `CALENDAR_SYNC_ALLOW_REAL_CALLS`/`WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`/
    `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS`/`DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS`
    는 전부 기본값 `false`다 — 검증 시작 시점에 필요한 것만 일시적으로 `true`로
    켜고, 검증이 끝나면 즉시 `false`로 되돌린다(§8 정리 절차).

## 2. 테스트 계정

| 역할 | 용도 | 비고 |
|---|---|---|
| 관리자 | `admin@alton.education`(기존 계정 재사용) | 신규 생성 불필요 |
| 선생님 | `seoyeon@example.com`(박서연, 기존 시드 계정 재사용) | 신규 생성 불필요 |
| 보호자(신규) | **결정 필요** — 새로 만들 실제 이메일 주소가 필요함(§3 참고) | 이 세션이 임의로 만들거나 발송하지 않음 |
| 학생(신규) | **결정 필요** — 위 보호자와 마찬가지로 새 이메일 주소 필요 | 위와 동일 |
| 보호자(기존, 선택) | 기존 보호자 경로(`link_existing_guardian_to_trial_onboarding`)도 검증하려면 기존 로그인 계정 1개 필요 | 이번 요청서는 신규 경로를 기본 시나리오로 삼고, 기존 경로는 시간이 되면 추가로 검증 |

**결정 필요**: 신규 보호자·학생 역할에 실제로 수신 가능한 이메일 주소(제품
오너 본인 소유 또는 별도 지정) 2개를 알려주시면 그 주소로만 검증을
진행합니다. 이 세션은 임의의 이메일 주소를 만들어 실제로 메일을 보내지
않습니다.

## 3. 외부 이메일 수신자·예상 메일 종류·최대 발송 수

이번 M4 라운드는 온보딩 링크 자체를 **이메일로 보내지 않고 관리자 화면에
직접 노출**하는 구조로 구현했다(로컬 검증 전용) — 따라서 실제 이메일 발송은
DocuSign/Supabase Auth 표준 메일뿐이다.

| 메일 종류 | 발신 주체 | 수신자 | 최대 발송 수 |
|---|---|---|---|
| Supabase Auth 신규 계정 확인/recovery 메일 | Supabase(GoTrue) | §2의 신규 보호자·학생 이메일 | 각 1건(재시도 포함 최대 2건) |
| DocuSign 봉투 발송 메일 | DocuSign Sandbox | 위 신규 보호자 이메일 | 1건(정상 발송 1회만 검증, 재발송 테스트는 하지 않음) |
| DocuSign 서명 완료 확인 메일 | DocuSign Sandbox | 위와 동일 | 1건 |
| Stripe 결제 영수증(TEST 모드) | Stripe | 위와 동일 | 1건(TEST 모드는 실제 청구서 이메일이 발송되지 않는 경우가 많음 — 발송되면 1건으로 간주) |

**총 예상 발송 수: 최대 6건, 전부 §2에서 지정한 테스트 계정 주소로만.**
그 외 실제 고객·임의 주소로는 어떤 메일도 발송하지 않는다.

## 4. Google Calendar·Meet·Smart Notes·Workspace Events 검증 객체와 최대 생성 수

| 객체 | 최대 생성 수 | 정리 방법 |
|---|---|---|
| Calendar 이벤트(체험 60분) | 1개 | 검증 후 즉시 삭제(`deleteCalendarEvent` 재사용 또는 Calendar UI에서 수동 삭제) |
| Meet space(Smart Notes 대상) | 1개(위 이벤트에 연결) | 이벤트 삭제 시 함께 정리됨 |
| Workspace Events 구독(선생님 조직 계정 기준) | 기존 구독 재사용 우선, 없으면 1개 신규 | 검증 후 `disableSubscriptionForOrganizer()`로 정지(기존 UI 버튼 재사용) |
| Smart Notes 자동 생성 문서(Drive) | 1개(위 Meet space 기준) | 검증 후 Drive에서 수동 삭제 또는 R8 이관 전이므로 보관 후 별도 정리 |

Directory API/IAM 변경은 **하지 않는다** — 기존에 이미 구성된 DWD(Domain-Wide
Delegation) 위임 범위를 그대로 쓰고, 새 서비스 계정·새 IAM 바인딩은 만들지
않는다.

## 5. DocuSign Sandbox envelope 최대 생성·발송 수

- 정규 계약 발송(원클릭) 1회 → envelope 1개 생성·발송.
- 보호자 서명 완료까지 진행(제품 오너가 실제로 서명) → 같은 envelope 1개로
  완결.
- **재발송·중복 클릭 검증은 이미 로컬에서 mock 경로로 확인 완료**(§`app/admin/
  trial-onboarding-actions.test.ts` "실패 후 재처리→성공" 테스트) — Sandbox
  에서는 재발송 케이스를 별도로 만들지 않는다(불필요한 envelope 증가 방지).
- **총 envelope 생성 수: 최대 1개.**

## 6. Stripe TEST 결제·웹훅·환불 검증 건수 + 실제 금전 청구 없다는 근거

- Stripe **TEST 모드** API 키만 사용(Live 키는 절대 입력하지 않음 — `CLAUDE.md`
  §"제한" 및 기존 R4 정책과 동일).
- 검증 시나리오: 정규상품(단건 또는 10회) 구매 1건 → 웹훅 수신 확인 1건 →
  (선택) 환불 요청·승인 1건.
- **실제 금전 청구 없음 근거**: Stripe TEST 모드는 테스트 카드 번호
  (`4242 4242 4242 4242` 등)로만 결제가 성공하고, 실제 은행 계좌·카드가
  청구되는 일이 구조적으로 불가능하다(Stripe TEST 모드의 표준 동작). 이번
  검증에서 Live 모드 전환은 하지 않는다.
- **총 결제 건수: 최대 1건 + 환불 1건(선택).**

## 7. 전체 종단 UAT 순서

1. Preview 배포 확인(§1) → 필요한 `*_ALLOW_REAL_CALLS` 플래그를 Preview
   환경변수에서만 `true`로 전환.
2. 관리자: 상담 seed(기존 방식대로 psql 또는 홈페이지 폼) → 체험 진행 확정 →
   온보딩 링크 발급(§2의 신규 보호자·학생 이메일 입력).
3. 신규 보호자: 실제 수신한 온보딩 링크로 계정 생성(Supabase Auth 실제 메일
   확인) → 로그인.
4. 관리자: 과목 수강 + 선생님 배정.
5. 보호자: Smart Notes 동의 → 체험수업권 자동 지급 확인.
6. 보호자 또는 관리자: 체험 예약(배정된 선생님의 실제 가능 시간, 24시간 이상
   뒤) → 실제 Calendar 이벤트·Meet 링크 생성 확인.
7. **제품 오너가 실제로 Meet에 잠깐 접속·퇴장**(Smart Notes/Workspace Events
   실제 트리거를 위해 필요 — 이 세션은 이 단계를 실행할 수 없음).
8. Workspace Events 웹훅 수신 → Smart Notes 자동 연결 확인(관리자 화면의
   "Smart Notes 연결" 단계가 자동으로 완료로 바뀌는지).
9. 선생님: 체험 리뷰 작성 → 미리보기 확인 → 공개 확정.
10. 보호자: 확정 리뷰 확인 → 정규 진행 희망.
11. 관리자: 정규 계약 발송(확인 다이얼로그 → 실행) → 실제 DocuSign envelope
    생성·발송 확인.
12. **제품 오너가 실제로 DocuSign 이메일을 받아 서명 완료.**
13. DocuSign 웹훅 수신 → 계약 `active` 전환 확인.
14. 보호자: 정규상품(단건 또는 10회) 구매(Stripe TEST 카드) → 결제 완료·
    영수증 확인.
15. 관리자: 과목 활성화 → 학생/선생님 화면에서 정규 예약(120분)이 같은
    `teacher_assignment`로 바로 가능한지 확인.
16. (선택) 환불 요청 1건 처리.

## 8. 실패 즉시 중단 조건

다음 중 하나라도 발생하면 **즉시 중단**하고 제품 오너에게 보고, 원인 파악 전
다음 단계로 진행하지 않는다:

- Production 도메인(`app.alton.education`)에 어떤 형태로든 트래픽·설정 변경이
  발생한 것으로 보이는 경우.
- 지정된 테스트 계정 이외의 실제 이메일 주소로 메일이 발송된 경우.
- Stripe가 TEST 모드가 아니라 Live 모드로 동작하는 것으로 보이는 경우(결제
  성공 후 Stripe 대시보드에서 반드시 모드 확인).
- DocuSign이 Sandbox가 아닌 Production 계정으로 발송된 경우(`assertDocusignSandboxBaseUri()`
  가 이미 코드 레벨에서 막지만, 이중 확인).
- 원격 DB에서 이 검증과 무관한 기존 데이터(다른 R의 시드 데이터, 실제 상담
  기록 등)가 예기치 않게 변경·삭제된 경우.
- 위 §4~§6에서 정한 최대 생성/발송 수를 초과하려는 상황이 발생한 경우.

## 9. 생성 객체·테스트 데이터·임시 IAM·환경변수·Preview의 정리·원복 절차

1. **환경변수 원복**: 검증 시작 전 켠 모든 `*_ALLOW_REAL_CALLS`/`*_ALLOW_REAL_READS`
   플래그를 검증 종료 즉시 `false`로 되돌린다(Preview 환경변수만 — Production은
   애초에 건드리지 않음).
2. **Google 객체 정리**: §4의 Calendar 이벤트·Meet space·Workspace Events
   구독을 정리(삭제/정지).
3. **DocuSign**: 발송된 envelope 1개는 완결(서명 완료)되므로 별도 취소 불필요
   — Sandbox 계정이라 실제 정리 의무는 없다.
4. **Stripe**: TEST 모드 결제·환불 기록은 Stripe TEST 대시보드에 남아도
   무해하다(실제 청구가 아니므로) — 원하면 TEST 데이터 삭제 도구로 정리 가능.
5. **DB 테스트 데이터**: 이번 검증으로 생성된 신규 보호자·학생 계정, 상담,
   과목 수강, 계약, 구매, entitlement 행은 **삭제하지 않고 유지**하되(불변
   테이블이 섞여 있어 완전 삭제가 애초에 어렵다 — M3/M4 로컬 통합 테스트에서도
   동일하게 처리), `docs/CURRENT.md`에 "M4 실제 Sandbox 검증용 테스트 데이터"
   로 남아있다는 점만 기록한다.
6. **Preview 배포**: 검증이 끝나면 이 Preview 배포는 그대로 두거나(다음 라운드
   재검증에 재사용) Vercel에서 삭제 — Production 승격은 이 요청서와 무관하게
   별도로 승인받는다.
7. **임시 IAM**: 이번 요청서는 새 서비스 계정·새 IAM 바인딩을 만들지 않으므로
   해당 없음.

## 10. 예상 소요 시간 + 제품 오너가 직접 확인해야 하는 화면

- **예상 소요 시간**: 준비(Preview 배포·환경변수) 30분 + 종단 흐름 실행
  (§7의 16단계) 약 1~1.5시간 = 총 2시간 내외(중간에 실제 이메일 확인·서명
  대기 시간 포함하면 반나절 정도로 여유 있게 잡는 것을 권장).
- **제품 오너가 직접 확인해야 하는 화면(이 세션이 대신 클릭할 수 없는 지점)**:
  1. 실제 이메일함에서 온보딩 링크·DocuSign 서명 요청·서명 완료·Stripe 영수증
     수신 확인.
  2. 실제 Google Meet 접속·퇴장(Smart Notes 트리거를 위해 필요).
  3. 실제 DocuSign 서명 완료 페이지.
  4. 실제 Stripe TEST 카드 입력 화면.
  5. 관리자 화면의 파이프라인 단계 표시가 각 단계마다 실제로 자동 갱신되는지
     (이 세션이 로컬에서 이미 확인한 것과 Preview에서 다시 한번 확인).

## 11. 법률 placeholder·테스트 계정 확인

- 이 검증 전체에서 노출되는 Smart Notes 동의 문구, 계약서 템플릿은 **확정
  법률 문구가 아닌 placeholder**다 — 화면에도 이미 "확정 전 초안" 안내가
  붙어있다(`app/consult/trial-onboarding/page.tsx`). 이 검증으로 이 문구가
  실제 고객에게 노출되는 일은 없다 — §2에서 지정한 테스트 계정 이외의 누구도
  이 흐름에 접근하지 않는다.
- 계약·법률 문서 자체는 이번 검증에서 수정하지 않는다.

---

**이 요청서에 대한 승인·실행은 제품 오너의 몫이다.** 이 세션은 위 계획을
작성만 했으며, Preview 생성을 포함한 어떤 항목도 실행하지 않았다.
