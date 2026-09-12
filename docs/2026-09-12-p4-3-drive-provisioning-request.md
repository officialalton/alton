# P4-3 4단계 — 회사 문서 Drive 연결에 필요한 외부 준비

코드로 해결되지 않는 항목만 모았다. **개발자가 임의로 만들거나 권한을 부여하지
않는다.** 아래를 승인·생성해 주시면 4단계 구현을 시작한다.

3단계(교사 서류)까지는 이 준비 없이 완료된다.

## 1. 전용 Shared Drive 1개 — **지금은 더미 문서 전용**

| 항목 | 값 |
| --- | --- |
| 이름(예) | `ALTON Company Documents (Preview 검증용)` |
| 유형 | 공유 드라이브(Shared Drive) — 개인 드라이브 폴더 아님 |
| 내용물 | **더미 문서만.** 실제 법인 서류·계약서를 넣지 않는다 |

검증용 `ALTON Integration Sandbox`는 **재사용하지 않는다**(확정 정책).

### 자원 분리 (2026-09-12 확정)

| 자원 | 용도 | 서비스 계정 초대 |
| --- | --- | --- |
| 더미 문서 전용 Drive | Preview 연결 검증 | Preview 검증 서비스 계정 **여기만** |
| 실제 회사 문서 Drive | 향후 실제 보관 | 이번에 만들지 않는다. Preview 검증 계정을 초대하지 않는다 |

Production 연결은 **별도 단계**다. 이번 검증이 통과해도 Production 환경변수를
설정하지 않는다.

**왜 전용 드라이브인가**: 대상이 법인 기초 서류라 권한 격리가 운영 편의보다
우선한다. 서비스 계정을 이 드라이브에만 초대하면 자격이 유출돼도 노출 범위가
이 드라이브로 한정된다. 기존 드라이브 안의 폴더로 두면 상위 드라이브 멤버십이
상속돼 격리가 깨질 수 있다.

## 2. 폴더 구조 (1차)

```
ALTON Company Documents/
├── 법인 서류/
├── 계약서 양식/
└── 교사 제출 양식/      ← 빈 양식(W-9 등)을 여기 둔다
```

`교사 제출 양식/`은 교사가 내려받아 작성할 **빈 서식** 자리다. 교사가 제출한
파일은 여기 오지 않는다 — 그쪽은 비공개 Storage 버킷에 따로 보관된다.

## 3. 서비스 계정 초대

| 항목 | 값 |
| --- | --- |
| 대상 | `r3-drive-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com` |
| 권한 | **뷰어(Viewer)** — 읽기 전용 |
| 범위 | **위 더미 문서 전용 Drive 하나만.** 다른 드라이브·폴더에 초대하지 않는다 |

업로드·수정을 하지 않으므로 콘텐츠 관리자 권한이 필요 없다. 최소권한으로 준다.

새 인증 체인은 만들지 않는다. 기존 Drive 토큰 경로를 그대로 쓴다
(Preview는 별도 최소권한 서비스 계정을 쓰는 기존 분기 유지).

## 4. 환경변수 3개

| 이름 | 값 | 비고 |
| --- | --- | --- |
| `COMPANY_DOCUMENTS_DRIVE_ID` | 위 Shared Drive의 id | **이름이 아니라 id로 고정한다** — 이름으로 찾다가 대소문자 불일치로 깨진 전례가 있다 |
| `COMPANY_DOCUMENTS_ROOT_FOLDER_ID` | 루트로 보여줄 폴더 id | 드라이브 루트를 그대로 쓰면 위 값과 같다 |
| `COMPANY_DOCUMENTS_ENABLED` | 기본 `false` | `true`가 아니면 Drive를 호출하지 않고 빈 상태를 돌려준다. 기존 안전 플래그 관례와 동일 |

기존 변수는 재사용한다(추가 불필요): `GOOGLE_WORKLOAD_IDENTITY_AUDIENCE`,
`GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL`,
`GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL`.

설정 대상 환경: Preview 먼저, Production은 별도 승인 후.

## 5. 접근 권한 — **관리자 전용** (2026-09-12 확정)

| 항목 | 내용 |
| --- | --- |
| 조회 범위 | 위 Shared Drive 안의 **파일 목록과 파일 내용 열람·다운로드**. 업로드·수정·삭제는 이번 범위에 없다 |
| 적용 지점 | `문서 > 회사 문서` 서버 진입점 전부 + `/api/admin/company-documents-preflight` |
| 게이트 | `requireAdmin()` — 서버에서 **관리자 자격을 명시적으로 확인한다** |

**비관리자는 어떤 capability를 가졌더라도 거부된다.** capability를 OR로 함께
받는 게이트는 쓰지 않는다. 그런 게이트는 "지금은 그 capability를 가진 사람이
없으니 사실상 관리자 전용"이라는 우연에 기대는 것이라, 누군가에게 capability가
부여되는 순간 정책이 조용히 뚫린다.

계정 id는 코드에 박지 않는다. 공통 권한 검사 함수 하나(`requireAdmin`)만 쓴다.

`manage_company_documents`라는 이름은 **지금 쓰이지 않는다.** 나중에 중간
관리자에게 업무별로 권한을 나눌 때 그 자리에서 게이트를 다시 정한다(§7).

검증: `app/admin/company-documents-actions.test.ts`,
`app/api/admin/company-documents-preflight/route.test.ts` — 거부 시 Drive를
호출하지 않는 것과 capability OR 게이트를 쓰지 않는 것을 함께 확인한다.

## 6. 준비되기 전까지의 화면

`COMPANY_DOCUMENTS_ENABLED`가 꺼져 있으면 빈 상태를 보여준다. 빈 상태는 세
가지를 **구분해서** 표시한다 — 뭉뚱그리면 운영자가 설정 문제인지 자료가 없는
건지 알 수 없다.

1. 권한 없음
2. 아직 연결되지 않음(플래그 꺼짐)
3. 폴더가 비어 있음

Drive 호출이 실패하면 "회사 문서 Drive에 연결하지 못했습니다"와 재시도만
보여준다. Drive API 오류 원문에는 파일 경로가 섞여 나올 수 있어 화면에 그대로
노출하지 않는다.


## 7. 후속 계획 — 마스터 관리자 / 중간 관리자 권한 배분

**이번 범위가 아니다.** 역할 체계나 권한 배분 UI를 추가하지 않는다.

현재 상태(2026-09-12 확정):

| 대상 | 누가 볼 수 있나 |
| --- | --- |
| 회사 문서 | 관리자 **전용**(`requireAdmin`) |
| 계약 | 관리자 |
| 교사 제출 서류 | 관리자(정산 capability 부여는 필수 조건이 아니다) |
| 교사 본인의 제출 서류 | 그 교사 본인 |
| 학생·보호자 | 위 어느 것도 볼 수 없다 |

향후 마스터 관리자 아래 중간 관리자를 두게 되면 아래를 업무별로 나눈다.

- 회사 문서 열람 → `manage_company_documents`
- 계약 조회·다운로드 → 별도 capability 신설 검토
  (현재 `contracts` RLS에는 `manage_consultations`가 없어 비대칭이 있다 —
  설계 §3.2 열린 항목. 그때 함께 정리한다)
- 교사 제출 서류 → `정산권한`
- 정산 실행 → `정산권한`

게이트 함수는 이미 공통이라, 그때 문자열과 검사 함수만 바꾸면 된다. 계정 id를
코드에 박아둔 곳이 없다는 것은 테스트로 고정돼 있다.


## 8. 제품 오너가 할 일 — 절차

1. Google Drive에서 **공유 드라이브 만들기** → 이름 `ALTON Company Documents (Preview 검증용)`.
2. 그 안에 폴더 셋을 만든다: `법인 서류`, `계약서 양식`, `교사 제출 양식`.
3. 아무 파일이나 **더미 문서** 몇 개를 넣는다(빈 문서·샘플 PDF면 충분하다).
   실제 법인 서류·계약서는 넣지 않는다.
4. 드라이브 우측 상단 **멤버 관리**에서 아래 주소를 **뷰어**로 추가한다.
   `r3-drive-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com`
5. 브라우저 주소창의 **Drive URL을 그대로 전달**해 주시면 된다
   (`https://drive.google.com/drive/folders/...` 형태).

id 추출과 Preview 환경변수 설정, preflight 실행·판독은 개발자가 처리한다.
**비밀번호나 서비스 계정 키는 요청하지 않는다.** preflight 결과를 직접 복사해
달라고 요청하는 것은 개발자가 Preview에서 확인하지 못하는 경우로 한정한다.
