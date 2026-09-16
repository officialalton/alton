# DocuSign Support 문의 자료 — 초대 이메일 미전달

## 요약
동일 계정(Alton Education, account id 919e8493-2043-48e4-89c6-fc8c91cf7c24, demo/sandbox)에서
API로 생성한 특정 envelope의 초대 이메일이 수신자에게 전달되지 않음(DocuSign 자체 상태는
"Sent"로 남고 Delivered/Opened로 전이한 적이 없음). 같은 계정·같은 발송자로 생성된 다른
envelope들은 정상적으로 전달·열람·서명 완료됨 — 계정 자체 문제가 아니라 이 특정 수신자
주소(또는 유사 패턴)에 대한 이메일 처리(억제/반송/지연) 문제로 추정.

## 실패 사례
- Envelope ID: `e5642671-ad51-8342-8015-b1a3cd9710f5`
- 수신자: 테스트 학부모 13 <matchbox512+alton-uat-p13@gmail.com>
- 발송: API, 2026-09-16 16:09:56.207 UTC (Sent Invitations 로그)
- 재발송: 웹 UI, 2026-09-16 17:19:32 UTC
- 상태: 두 번의 발송 모두 "Sent"에서 멈춤 — Delivered/Opened 이벤트가 audit_events에 전혀 없음
- deliveredDateTime: 없음(recipient 객체, envelope 객체 모두)

## 성공 사례(같은 계정·같은 발송자, 비교 기준)
- Envelope ID: `268f24d5-994c-8cb1-8107-e02e5d92059a`
- 수신자: 이명희 <matchbox512@snu.ac.kr>
- 발송: API, 2026-09-05 08:46:12.677 UTC
- Delivered: 2026-09-05 08:46:38.753 UTC(발송 26초 후)
- Opened: 2026-09-05 08:46:34 UTC(수신자 실제 열람)
- Completed: 2026-09-05 08:47:10.363 UTC

같은 subject("Alton Education 서비스 이용 계약서")로 같은 계정에서 완료된 사례가 이 외에도
2건 더 있음: `b8ab20c2-aa93-8b4e-8177-0cb9349c05f6`(2026-09-05), `832b2860-eda8-8d6f-80f5-b800bc940749`(2026-09-07).

## 확인 요청 사항(DocuSign Support)
1. Envelope `e5642671-ad51-8342-8015-b1a3cd9710f5`에 대해 실제 이메일 발송 시도가 있었는지,
   있었다면 수신 측(Gmail)에서 반송(bounce)·억제(suppression)·지연(deferral) 처리됐는지 확인.
2. 두 envelope(`e5642671...` 실패 / `268f24d5...` 성공)의 실제 발송 로그(SMTP 레벨)를 비교해
   무엇이 다른지 확인 — 계정·발송자·notification 설정은 API로 조회한 결과 동일함을 이미 확인함.
3. (참고, 미확정 가설) 실패 사례의 수신자 이메일이 Gmail plus-addressing(`+alton-uat-p13`)
   형식이라는 점이 유일하게 눈에 띄는 차이 — 이 형식이 발송 처리에 영향을 주는지 확인 요청.

## 확인된 것(추가 조사로 배제한 가설)
- 계정 플랜/과금: Developer/Demo, envelope 13/Unlimited — 쿼터 문제 아님.
- 수신자가 계정 내부 사용자(member)인지: 계정 전체 사용자 1명(Do Kyung Kim)뿐 — 수신자는
  계정 멤버 아님. recipient 객체의 userId 필드는 비회원 수신자에게도 DocuSign이 부여하는
  내부 식별자(DocuSign 개발자 지원 확인)이며 계정 멤버십을 의미하지 않음.
- 스팸함: 확인함, 없음.
- 발송 요청 자체의 오류: 없음(API가 200/201 정상 응답, envelopeId 정상 발급, status="sent" 정상 반영).

## 추가 조치 금지
원인 확인 전까지 이 envelope에 대한 추가 재발송·신규 계약 생성은 하지 않음.
