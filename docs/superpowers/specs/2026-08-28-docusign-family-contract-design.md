# 072-docusign: 학부모/학생 계약서 서명 (Family Contract) — 설계

## 배경

`docs/tickets.md`의 072번 티켓. 기능 명세(`docs/spec/functional-spec.md` §2)상 고객 여정은 "상담 → 제안서 발송 → **DocuSign 계약 서명** → Stripe 결제 → 튜터 매칭"이고, 스키마(`docs/spec/schema-draft.md` §3, §4a)에는 이미 다음이 확정돼 있다:

- `contracts` 테이블: `parent_id`/`student_id`가 **NOT NULL** — 즉 계약 발송 시점에 이미 부모/학생 계정이 존재해야 한다.
- **계정 생성 시점은 계약 체결(발송) 시점** — 상담 신청(`consult_requests`)엔 계정이 없고, 계약을 진행하는 순간 `parents`/`students` 계정이 만들어진다.
- 자녀별 개별 계약(`contracts.student_id` 직접 FK, join 테이블 없음) — 한 상담 건(=한 자녀)당 계약 1건.

이번 스코프는 **학부모/학생 계약만** 다룬다. 선생님 계약(`teacher_contracts`, W-8BEN 포함)은 별도 후속 티켓.

## 목표

관리자가 상담이 끝난 신청 건에 대해 "계약서 발송" 버튼을 누르면:
1. 학부모/학생 계정이 자동 생성(초대 이메일 발송)되고
2. DocuSign으로 표준 계약서가 학부모 이메일로 발송되고
3. 학부모가 서명을 완료하면 웹훅으로 우리 시스템이 자동으로 계약 상태를 갱신한다

## 인증 방식 — DocuSign JWT Grant

사람 개입 없이 서버가 자동으로 API를 호출해야 하므로(웹훅 트리거 등) JWT Grant를 쓴다.

- 이미 확보한 값: `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_BASE_URI`(`https://na4.docusign.net`), `DOCUSIGN_INTEGRATION_KEY`
- 추가로 필요: RSA 키페어(Claude Code가 생성 → 공개키는 DocuSign 앱 설정에 등록, 개인키는 `DOCUSIGN_PRIVATE_KEY` 환경변수로만 보관) + 최초 1회 사용자 동의(consent) — 브라우저로 한 번 열어서 승인
- 액세스 토큰은 만료 시간(보통 1시간) 전까지 메모리에 캐싱해 재사용

## 계약서 발송 방식 — 문서 직접 전송 (템플릿 미사용)

DocuSign 콘솔에 별도 템플릿을 만들지 않는다. 계약서 전문을 이 저장소 안의 파일(`lib/contracts/family-contract-template.ts`)에 템플릿 문자열로 두고, 발송 시점에 이름만 채워 HTML 문서를 만들어 API로 직접 봉투(envelope)를 생성·전송한다.

- 이렇게 하면 계약서 문구를 고칠 일이 생겨도 이 파일 하나만 수정하면 되고 DocuSign 콘솔 설정을 건드릴 필요가 없다.
- 서명란 위치는 좌표 대신 **anchor 문자열**(예: 본문에 `/sig1/`이라는 텍스트를 심어두고 API가 그 위치를 찾아 서명 탭을 배치)로 지정 — 좌표 계산이 필요 없어 문구가 바뀌어도 안전하다.
- 문서는 HTML로 만들어 그대로 전송(DocuSign eSignature API가 HTML 문서를 지원, 내부적으로 PDF로 변환) — 별도 PDF 생성 라이브러리가 필요 없다.

계약서 내용(1차 스코프): 목업(`alton_admin_portal_v6.html`의 `CONTRACTS_T` 샘플)에 나온 제1조(목적)/제2조(수업권)/제3조(취소정책) 뼈대를 기반으로 한 표준 약관만 포함. 가격/패키지 등 개별 조건은 넣지 않는다(그건 계약 이후 Stripe 결제 화면에서 다룸). **주의: 이 초안은 법적 검토를 거치지 않은 플레이스홀더 문구다. 실제 고객에게 발송하기 전 반드시 변호사 검토가 필요하다.**

## 데이터 흐름

1. **발송**: 관리자가 `ContractsTab`의 "발송 대기" 목록(아직 계약이 안 걸린 `consult_requests`)에서 한 건을 골라 "계약서 발송" 클릭
   → 서버 액션 `sendFamilyContract(consultRequestId)`:
   - `consult_requests`에서 `person_name`/`email`/`student_grade` 조회
   - 기존 `inviteParent`/`inviteStudent`(`app/admin/users-actions.ts`) 로직 재사용해 부모/학생 계정 생성(초대 메일 발송, `students.status='pending'`)
   - `contracts` 행 생성: `parent_id`, `student_id`, `status='sent'`
   - `lib/docusign.ts`의 `createEnvelope()` 호출 → `docusign_envelope_id` 저장
   - `consult_requests.converted_student_id`/`converted_parent_id` 갱신, `status`를 `'completed'`로 전환
2. **서명**: 학부모가 이메일의 DocuSign 링크에서 서명 완료
3. **완료 통지**: DocuSign Connect가 `/api/webhooks/docusign`으로 envelope completed 이벤트 전송
   → `docusign_envelope_id`로 `contracts` 행을 찾아 `status='signed'`, `signed_at=now()` 갱신, 연결된 `students.status='active'`로 전환
4. **조회**: `ContractsTab`의 "발송된 계약" 목록이 `contracts` 테이블 상태를 그대로 보여줌(목업의 계약 탭과 동일한 레이아웃)

## 구성 요소

| 파일 | 역할 |
|---|---|
| `lib/docusign.ts` | JWT 인증(토큰 캐싱) + `createEnvelope(params)` |
| `lib/contracts/family-contract-template.ts` | 계약서 HTML 템플릿 함수 |
| `app/admin/contracts-actions.ts` | `sendFamilyContract(consultRequestId)` 서버 액션 |
| `app/admin/contracts-data.ts` | 발송 대기 상담 건 + 발송된 계약 목록 조회 |
| `app/admin/ContractsTab.tsx` | 관리자 UI (목업의 "계약" 탭) |
| `app/api/webhooks/docusign/route.ts` | 서명 완료 웹훅 |

## 에러 처리

- DocuSign 발송(`createEnvelope`) 실패 시: 이미 만든 초대 계정은 롤백하지 않는다(계정 자체는 무해하고, 관리자가 나중에 재시도하면 됨). 대신 `contracts` 행을 아직 만들지 않은 시점에 실패하게 해서 재시도 가능한 상태로 남긴다.
- 웹훅이 모르는 `envelope_id`를 받으면 조용히 200 응답 + 로그만 남기고 무시(재시도 폭주 방지).
- 웹훅 서명 검증(HMAC, DocuSign Connect의 `X-DocuSign-Signature-1`)은 환경변수(`DOCUSIGN_WEBHOOK_HMAC_KEY`) 설정 시에만 활성화 — 070(Calendly) 웹훅과 동일한 패턴.

## 테스트

- `lib/docusign.ts`: JWT 토큰 캐싱/재발급 분기, `createEnvelope` 요청 바디 구성 유닛 테스트
- `contracts-actions.ts`: 정상 발송 흐름(계정 생성 + contracts insert + envelope 생성 호출 검증), DocuSign 실패 시 contracts 행이 안 만들어지는지
- 웹훅 라우트: envelope completed 처리, 모르는 envelope_id 무시, 서명 검증 분기(070 패턴 재사용)
- `ContractsTab`: 발송 대기/발송된 계약 렌더링, 발송 버튼 클릭 시 액션 호출

## 스코프 밖 (후속)

- 선생님 계약(`teacher_contracts`, W-8BEN) — 다음 티켓
- 계약서 법률 검토 — 사람이 별도로 진행
- 다자녀 가정의 여러 계약을 한 번에 묶어 보내는 UX — 필요해지면 별도 확인
