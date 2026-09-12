# P4-3 4단계 — 회사 문서 Drive 연결에 필요한 외부 준비

코드로 해결되지 않는 항목만 모았다. **개발자가 임의로 만들거나 권한을 부여하지
않는다.** 아래를 승인·생성해 주시면 4단계 구현을 시작한다.

3단계(교사 서류)까지는 이 준비 없이 완료된다.

## 1. 전용 Shared Drive 1개

| 항목 | 값 |
| --- | --- |
| 이름(예) | `ALTON Company Documents` |
| 유형 | 공유 드라이브(Shared Drive) — 개인 드라이브 폴더 아님 |

검증용 `ALTON Integration Sandbox`는 **재사용하지 않는다**(확정 정책).

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
| 대상 | 기존 Workspace 서비스 계정(`GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL`) |
| 권한 | **뷰어(Viewer)** — 읽기 전용 |

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

## 5. `manage_company_documents` capability

| 항목 | 내용 |
| --- | --- |
| 이름 | `manage_company_documents` |
| 조회 범위 | 위 Shared Drive 안의 **파일 목록과 파일 내용 열람·다운로드**. 업로드·수정·삭제는 이번 범위에 없다 |
| 적용 지점 | `문서 > 회사 문서` 서브탭의 모든 서버 진입점(폴더 목록·파일 목록·다운로드) |
| 다른 권한과의 관계 | 계약 조회(`문서 > 계약`)와 **분리**된다. 계약 권한이 있다고 회사 문서가 열리지 않고, 그 반대도 아니다 |
| 부여 대상 | **별도 확정 필요 — 개발자가 임의로 부여하지 않는다** |

> 주의: 기존 `requireAdminOrCapability()`는 `role='admin'`이면 capability 없이
> 통과시킨다. 회사 문서를 관리자 전원에게 열 것인지, 교사 서류처럼 부여받은
> 사람에게만 열 것인지 결정해 주셔야 한다. 결정에 따라 게이트 함수가 달라진다.
>
> - 관리자 전원 허용 → `requireAdminOrCapability("manage_company_documents")`
> - 부여받은 사람만 → `requireCapabilityOnly("manage_company_documents")`
>   (교사 서류에서 쓰는 것과 같은 함수)

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
