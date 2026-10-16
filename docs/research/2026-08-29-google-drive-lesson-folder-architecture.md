# ALTON Google Drive 수업자료 폴더 아키텍처 조사

- 조사일: 2026-08-29
- 조사 범위: Google Drive·Google Meet·Google Calendar·Google Identity의 공식 문서만 사용
- 목적: ALTON 수업자료를 회사 소유 Google Shared Drive에 안전하게 저장하고, 선생님 변경·퇴사 및 Gemini Smart Notes 자동 수집까지 처리할 수 있는 구조를 결정한다.

## 결론

기술적으로는 `선생님 → 학생 → 과목 → 일자별 수업` 폴더를 API로 만들 수 있다. 그러나 **선생님을 최상위 원본 소유축으로 두는 구조는 권장하지 않는다.** 선생님이 변경되거나 퇴사할 때 원본 폴더를 이동하고 권한을 다시 계산해야 하며, 한 학생이 여러 과목·선생님과 연결될 때 중복과 분산이 발생하기 때문이다.

ALTON에는 다음 구조가 가장 적합하다.

1. 회사 소유 Shared Drive에 **학생 중심의 단일 원본 구조**를 둔다.
2. 학생 아래에 과목 수강과 일자별 수업 폴더를 생성한다.
3. 선생님은 Shared Drive 전체 구성원이 아니라, 현재 배정된 과목 폴더에만 직접 접근 권한을 받는다.
4. 선생님용 폴더에는 원본을 복제하지 않고 원본 과목 폴더를 가리키는 Drive 바로가기를 둔다.
5. 선생님 변경 시 원본은 그대로 유지하고 이전 선생님의 과목 폴더 권한과 바로가기만 회수한 뒤 새 선생님에게 부여한다.
6. Gemini Smart Notes 원본은 주최자의 My Drive에 생성된 후 같은 파일을 해당 수업 폴더로 **이동**한다. 복사는 기본 방식으로 사용하지 않는다.
7. 학생과 학부모에게는 Drive 권한을 직접 부여하지 않고 ALTON 앱이 인증·인가 후 필요한 자료를 전달한다.

Shared Drive의 파일은 개인이 아니라 조직이 소유하므로 구성원이 퇴사해도 남는다. Shared Drive 안의 파일은 정확히 하나의 부모 폴더만 가질 수 있지만, 바로가기는 다른 위치에서 같은 원본을 가리킬 수 있다. [Shared drives 개요](https://developers.google.com/workspace/drive/api/guides/about-shareddrives) [Drive 파일·폴더 개요](https://developers.google.com/workspace/drive/api/guides/about-files) [Drive 바로가기 생성](https://developers.google.com/workspace/drive/api/guides/shortcuts)

## 1. 권장 원본 폴더 구조

```text
Shared Drive: ALTON Learning Records
├── 00_System
├── 10_Students
│   └── STU_<student_id>
│       └── ENR_<subject_enrollment_id>_<subject>
│           ├── 00_Course_Materials
│           └── 10_Sessions
│               └── 2026
│                   └── 2026-08-29_SES_<session_id>
│                       ├── lesson-material.pdf
│                       ├── whiteboard-final.pdf
│                       ├── gemini-smart-notes.gdoc
│                       └── final-review.gdoc
└── 20_Teacher_Portals
    └── TCH_<teacher_id>
        ├── STU_<student_id>_<subject> → 원본 과목 폴더 바로가기
        └── STU_<student_id>_<subject> → 원본 과목 폴더 바로가기
```

### 구조 원칙

- 원본의 최상위 키는 선생님 이름이 아니라 변경되지 않는 `student_id`다.
- 과목 폴더는 과목명만으로 식별하지 않고 `subject_enrollment_id`를 포함한다. 같은 학생이 같은 과목을 중단했다가 다시 시작해도 과거 수강과 혼동하지 않기 위해서다.
- 일자별 폴더에는 `session_id`를 포함한다. 이름은 표시용이며 시스템의 진짜 연결 키는 Drive `fileId`와 ALTON DB의 `session_id`다.
- 일자별 폴더 내부에 자료 종류별 하위 폴더를 추가로 만들지 않는다. 현재 필요한 파일 수가 적으므로 깊이와 항목 수를 줄이는 편이 낫다.
- 폴더와 파일에 `appProperties`로 `alton_student_id`, `alton_enrollment_id`, `alton_session_id`, `artifact_type`을 기록한다. Drive는 외부 데이터 저장소의 ID를 사용자 정의 속성에 저장하고 검색하는 방식을 공식 지원한다. [사용자 정의 파일 속성](https://developers.google.com/workspace/drive/api/guides/properties) [파일 검색](https://developers.google.com/workspace/drive/api/guides/search-files)
- 폴더 이름은 고유하지 않을 수 있으므로 이름 검색만으로 수업을 연결하지 않는다. Drive 파일 ID는 파일 수명 동안 안정적이다. [Drive Files 리소스](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) [파일·폴더 개요](https://developers.google.com/workspace/drive/api/guides/about-files)

Shared Drive는 최대 500,000개 항목과 최대 100단계 폴더 깊이 제한이 있다. ALTON의 구조는 깊이 제한과는 거리가 멀지만, 수업마다 폴더와 여러 파일을 생성하므로 항목 수를 모니터링해야 한다. 규모가 커지면 연도 또는 운영 단위별로 Shared Drive를 분리할 수 있다. [Shared Drive 제한](https://support.google.com/a/users/answer/7338880?hl=en)

## 2. API로 폴더를 만들고 권한을 상속하는 방법

### 2.1 폴더 생성

Drive API에서 폴더는 MIME type이 `application/vnd.google-apps.folder`인 파일이다. `files.create` 요청에 대상 부모 폴더 ID를 `parents`로 지정하면 해당 Shared Drive 위치에 생성된다. Shared Drive 작업에는 `supportsAllDrives=true`를 사용해야 한다. [폴더 생성·구성](https://developers.google.com/workspace/drive/api/guides/folder) [Shared Drive 지원 구현](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives)

개념적 요청은 다음과 같다.

```http
POST /drive/v3/files?supportsAllDrives=true
Content-Type: application/json

{
  "name": "2026-08-29_SES_<session_id>",
  "mimeType": "application/vnd.google-apps.folder",
  "parents": ["<sessions_year_folder_id>"],
  "appProperties": {
    "alton_session_id": "<session_id>",
    "artifact_type": "lesson_folder"
  }
}
```

Shared Drive 작업에서 `files.get/list/create/update/copy/delete`와 `permissions.*` 등은 `supportsAllDrives=true`가 필요하다. 검색은 `corpora=drive`, `driveId=<shared_drive_id>`, `includeItemsFromAllDrives=true`를 사용해 한 Shared Drive 안으로 범위를 제한하는 편이 효율적이다. [Shared Drive 지원 구현](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives)

재시도 중 같은 폴더가 중복 생성되지 않도록 ALTON DB에 생성된 `fileId`를 저장한다. 폴더는 미리 생성한 ID를 사용할 수 있고, 같은 ID로 재시도하면 성공 이후 `409 Conflict`가 반환되므로 멱등성 구현에도 활용할 수 있다. [파일 생성 및 ID 사전 생성](https://developers.google.com/workspace/drive/api/guides/create-file)

### 2.2 권한 상속과 제약

폴더의 권한은 모든 하위 폴더와 파일에 재귀적으로 상속된다. 상속된 권한은 자식 파일에서 임의로 낮추거나 제거할 수 없고, 권한이 시작된 부모에서 수정해야 한다. 동시 권한 변경도 지원되지 않아 같은 파일에 대한 여러 권한 요청을 직렬화해야 한다. [파일·폴더·드라이브 공유](https://developers.google.com/workspace/drive/api/guides/manage-sharing)

따라서 선생님 권한은 개별 일자 폴더가 아니라 **과목 수강 폴더**에 부여한다.

- 배정 시작: `ENR_<subject_enrollment_id>` 폴더에 선생님 `writer` 권한 생성
- 배정 중: 이후 생성되는 일자별 수업 폴더와 파일이 자동 상속
- 배정 종료: 해당 과목 폴더의 직접 권한을 삭제
- 과거 자료 열람이 필요한 인수인계 기간이 있으면 권한 종료 시각을 별도로 관리한 뒤 회수

Shared Drive 구성원 권한은 기본적으로 드라이브 전체에 적용되고 하위에서 축소하기 어렵다. 제한 접근 폴더는 예외적으로 `inheritedPermissionsDisabled=true`를 설정해 직접 추가된 사람만 내용에 접근하도록 만들 수 있지만, Shared Drive에서 이 설정을 켜거나 끄려면 `organizer`(Manager) 권한이 필요하다. [제한·확장 접근 폴더](https://developers.google.com/workspace/drive/api/guides/limited-expansive-access) [Shared Drive 접근 구조](https://developers.google.com/workspace/drive/api/guides/about-shareddrives)

**권장:** 일반 선생님을 중앙 Shared Drive 전체 구성원으로 추가하지 않는다. 운영 관리자와 자동화 계정만 드라이브 구성원으로 두고, 선생님에게는 배정된 과목 폴더에만 직접 권한을 부여한다. 선생님을 전체 구성원으로 둬야 한다면 각 학생 또는 과목 폴더를 제한 접근 폴더로 만들어야 하며, 이 방식은 권한 운영과 감사 부담이 더 크다.

## 3. 선생님 최상위 원본 구조의 문제와 바로가기 구조

### 3.1 `선생님 → 학생 → 과목 → 수업`을 원본으로 두면 생기는 문제

- 선생님 변경 시 같은 학생·과목의 원본 폴더를 새 선생님 아래로 이동하거나 복제해야 한다.
- 이동하면 폴더 위치와 상속 권한이 바뀌고, 복사하면 어느 쪽이 원본인지 모호해진다.
- 한 학생이 여러 과목을 여러 선생님에게 배우면 학생 기록이 여러 선생님 트리에 분산된다.
- 선생님이 퇴사했을 때 회사 Shared Drive의 파일 소유권은 안전하지만, 최상위 분류와 접근권한을 대규모로 재구성해야 한다.
- 과거 수업자료의 장기 보존 주체가 학생·수강이 아니라 당시 선생님처럼 보이게 된다.

Shared Drive가 조직 소유이므로 선생님 퇴사로 파일 자체가 삭제되지는 않는다. 그러나 폴더 구조와 권한 변경 부담은 남는다. [Shared Drive 개요](https://support.google.com/a/users/answer/7212025?hl=en)

### 3.2 학생 중심 원본 + 선생님 바로가기

Drive 바로가기는 대상 파일 또는 폴더의 `targetId`를 가진 메타데이터 파일이다. 바로가기 자체의 ACL은 부모에서 상속되지만, 사용자가 원본을 열려면 대상 원본에 대한 권한도 있어야 한다. 하나의 바로가기는 부모를 하나만 가질 수 있으며 필요하면 다른 위치에 바로가기를 추가로 만들 수 있다. [Drive 바로가기 생성](https://developers.google.com/workspace/drive/api/guides/shortcuts)

ALTON에서는 다음 방식이 가능하다.

1. 원본 과목 폴더는 `10_Students` 아래에 유지한다.
2. 선생님 배정 시 해당 과목 폴더에 직접 권한을 부여한다.
3. `20_Teacher_Portals/TCH_<teacher_id>` 아래에 과목 폴더 바로가기를 생성한다.
4. 선생님 변경 시 이전 선생님의 원본 권한을 회수하고 해당 바로가기를 삭제한다.
5. 새 선생님에게 원본 권한과 새 바로가기를 생성한다.

다만 같은 Shared Drive의 `20_Teacher_Portals`를 여러 선생님이 볼 수 있게 하면 다른 선생님 폴더 이름이나 바로가기가 보일 수 있다. 이를 피하는 방법은 두 가지다.

- **권장 A:** 선생님용 포털을 Drive가 아니라 ALTON 앱 화면으로 제공하고, 필요한 원본 폴더 링크만 보여준다.
- **대안 B:** 각 `TCH_<teacher_id>` 폴더를 제한 접근 폴더로 만들고 해당 선생님만 직접 추가한다. 이 경우 자동화 계정에 Manager 권한이 필요하고, 권한 설정 실패를 별도로 감시해야 한다.

Drive UI 접근이 꼭 필요하지 않다면 A가 더 단순하고 안전하다. 바로가기는 편의 기능일 뿐 권한 모델의 근거로 사용하면 안 된다.

## 4. Gemini Meet Smart Notes의 Shared Drive 수업 폴더 이동·복사

### 4.1 생성 위치와 식별

`Take notes for me` 문서는 회의 종료 후 주최자의 My Drive `Google Meet` 폴더와 회의별 하위 폴더에 생성되고 Calendar 이벤트에 자동 첨부된다. Meet API의 `SmartNote.docsDestination.document`는 Google Docs 문서 ID이며, `exportUri`는 문서 링크다. `google.workspace.meet.smartNote.v2.fileGenerated` 이벤트로 생성 완료를 받을 수 있다. [Take notes for me](https://support.google.com/meet/answer/14754931?hl=en) [Meet 산출물 처리](https://developers.google.com/workspace/meet/api/guides/artifacts) [Meet API 릴리스 노트](https://developers.google.com/workspace/meet/release-notes)

### 4.2 이동

일반 Drive 파일은 `files.update`에서 `addParents=<수업 폴더 ID>`와 `removeParents=<기존 Google Meet 폴더 ID>`를 사용해 이동한다. Shared Drive 대상 작업에는 `supportsAllDrives=true`가 필요하다. 파일 ID는 파일 수명 동안 안정적이며, 이동은 새 파일을 만드는 것이 아니라 같은 `fileId`의 부모를 변경하는 작업이다. [폴더 간 파일 이동](https://developers.google.com/workspace/drive/api/guides/folder) [파일 ID 특성](https://developers.google.com/workspace/drive/api/guides/about-files)

My Drive에서 Shared Drive로 파일을 옮기면 소유권은 조직으로 넘어간다. 파일에 직접 설정된 공유 권한은 유지될 수 있지만, 이전 부모 폴더에서 상속된 권한은 복사되지 않고 Shared Drive의 제한과 새 부모 권한이 적용된다. [Shared Drive 파일 접근](https://support.google.com/a/users/answer/12380484?hl=en)

Calendar 첨부는 Drive 파일의 `fileId`를 참조한다. 따라서 **같은 파일을 이동하면 파일 ID가 유지되어 기존 Calendar 첨부가 같은 문서를 계속 가리키는 것으로 판단된다.** 다만 이동 후 새 ACL에 따라 초대자의 실제 열람 가능 여부는 달라질 수 있다. 이 문장은 Drive의 안정적 file ID와 Calendar의 `attachments[].fileId` 정의를 결합한 아키텍처 추론이며, Smart Notes 전용 이동 보장 문구는 공식 문서에 없다. 출시 전 실제 Workspace 테넌트에서 반드시 통합 테스트해야 한다. [Calendar Events 첨부](https://developers.google.com/workspace/calendar/api/v3/reference/events) [Drive 파일 ID](https://developers.google.com/workspace/drive/api/guides/about-files)

### 4.3 복사

`files.copy`로 Shared Drive 수업 폴더에 복사할 수도 있다. 그러나 복사본은 새 파일이며 새 파일 ID를 가진다. 원본 공유 설정은 복제되지 않고 목적지 폴더의 권한을 상속한다. Calendar 이벤트는 기존 원본의 파일 ID를 계속 참조하므로 복사본을 첨부하려면 Calendar 이벤트를 `supportsAttachments=true`로 별도 수정해야 한다. [파일 복사](https://developers.google.com/workspace/drive/api/guides/create-file) [Calendar Events 첨부](https://developers.google.com/workspace/calendar/api/v3/reference/events)

복사는 다음 문제를 만든다.

- 주최자 My Drive 원본과 Shared Drive 복사본 중 어느 것이 공식 원본인지 구분해야 한다.
- 이후 원본 수정이 복사본에 반영되지 않는다.
- Calendar는 원본, ALTON은 복사본을 가리키는 이중 연결이 생길 수 있다.
- 보존·삭제 정책을 두 파일에 모두 적용해야 한다.

**권장 방식:** `fileGenerated` 이벤트 수신 → SmartNote 문서 ID 확인 → ALTON 세션 폴더 준비 → 원본 파일 이동 → 이동된 동일 `fileId`를 ALTON DB에 저장 → 권한·Calendar 첨부·Docs 조회를 검증한다. 이동이 권한 또는 조직 정책 때문에 실패할 때만 복사본을 만들고, 이 경우 원본·복사본 ID와 동기화 상태를 모두 기록한다.

### 4.4 권장 실패 처리

- 이벤트가 중복되어도 같은 SmartNote `document` ID는 한 번만 처리한다.
- 대상 세션을 찾지 못하면 임의 폴더에 넣지 않고 `reconciliation_needed`로 보낸다.
- 이동 전 현재 `parents`, `permissions`, `capabilities.canMoveItemIntoTeamDrive` 또는 관련 capability를 확인한다.
- 이동 후 `files.get`으로 `driveId`, `parents`, `webViewLink`를 재검증한다.
- Calendar 이벤트의 `attachments[].fileId`가 같은 ID인지 확인한다.
- 이벤트 누락에 대비해 Meet `smartNotes.list` 정기 대조 작업을 둔다.

## 5. 서비스 계정, 도메인 전체 위임과 최소 권한

### 5.1 인증 선택지

서비스 계정은 Workspace 도메인 구성원이 아니며 저장용량이 없어 파일을 소유할 수 없다. Google은 서비스 계정이 Shared Drive에 업로드하거나, 도메인 전체 위임으로 사람 사용자를 가장해 파일을 생성하도록 안내한다. 도메인 전체 위임은 서비스 계정에 모든 데이터를 무조건 공개하는 것이 아니라, 요청마다 지정한 사용자의 권한과 승인된 OAuth scope의 교집합으로 작동한다. [Shared Drive 개요](https://developers.google.com/workspace/drive/api/guides/about-shareddrives) [서비스 계정과 도메인 전체 위임](https://developers.google.com/identity/protocols/oauth2/service-account)

가능한 방식은 다음 두 가지다.

1. 서비스 계정 이메일을 Shared Drive 또는 대상 폴더에 직접 추가
2. 서비스 계정에 domain-wide delegation을 부여하고 `drive-automation@alton.education` 같은 전용 내부 사용자를 가장함

ALTON에는 2번을 권장한다. 서비스 계정은 도메인 사용자가 아니어서 도메인 전체 공유가 자동 적용되지 않고, 외부 공유 제한과 조직 정책의 적용 방식도 내부 사용자와 다를 수 있기 때문이다. Google도 Shared Drive를 관리할 때 서비스 계정이 인증된 관리자를 가장해야 할 수 있다고 안내한다. [Shared Drive 관리](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives) [서비스 계정 OAuth](https://developers.google.com/identity/protocols/oauth2/service-account)

### 5.2 Shared Drive 역할

Google의 Shared Drive 역할은 API에서 대략 다음과 대응한다.

| UI 역할 | API role | 주요 용도 |
|---|---|---|
| Viewer | `reader` | 읽기 |
| Commenter | `commenter` | 댓글 |
| Contributor | `writer` | 파일·폴더 생성 및 파일 편집 |
| Content manager | `fileOrganizer` | Shared Drive 내부 이동·휴지통 및 폴더 공유 |
| Manager | `organizer` | 구성원·제한·제한 접근 폴더 포함 전체 관리 |

실제 동작은 각 파일의 `capabilities`로 확인해야 한다. 역할표와 작업 가능 범위는 Google의 Shared Drive 접근 안내에 정리되어 있다. [Shared Drive 파일 접근](https://support.google.com/a/users/answer/12380484?hl=en) [파일 capabilities](https://developers.google.com/workspace/drive/api/guides/file-metadata)

**권장 권한 분리:**

- `drive-provisioner`: Manager. Shared Drive 초기 설정, 제한 접근 폴더 생성, 선생님 폴더 권한 부여·회수만 수행. 일반 요청 경로에서는 사용하지 않는다.
- `drive-ingestor`: Content manager 또는 필요한 작업이 가능하다면 Contributor. 수업 폴더 생성, 파일 업로드, Smart Notes 이동, 최종 산출물 정리 수행.
- `drive-reader`: 읽기 전용. ALTON 앱에서 승인된 파일을 읽어 사용자에게 전달.
- 사람 관리자: 최소 2명의 회사 계정을 Manager로 유지해 관리자 부재 상태를 방지.

제한 접근 폴더를 API로 켜고 끄는 작업은 `organizer`가 필요하므로, 이 기능을 쓰지 않으면 런타임 계정의 Manager 권한을 피할 수 있다. [제한 접근 폴더](https://developers.google.com/workspace/drive/api/guides/limited-expansive-access)

### 5.3 OAuth scope

Google은 필요한 작업에 맞는 최소 scope를 요청하라고 권고한다. `drive.file`은 앱이 만들었거나 앱을 통해 열린·공유된 파일에 한정되므로, Meet가 자동 생성한 Smart Notes 원본을 임의로 이동하는 요구에는 충분하지 않을 수 있다. 반면 전체 `drive` scope는 모든 Drive 파일의 조회·수정을 허용하는 restricted scope다. [Drive API scope 선택](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)

권장 분리는 다음과 같다.

- Meet Smart Notes 발견: `meetings.space.readonly`
- Meet 생성 Drive 파일 읽기: 가능하면 `drive.meet.readonly`
- Docs 내용 읽기: Docs 읽기 전용 scope 또는 필요한 Drive 읽기 scope
- Smart Notes 원본 이동 및 부모·권한 수정: 전용 작업자에 한해 `drive`
- Calendar 첨부 확인: Calendar 이벤트 읽기 scope
- Calendar 첨부 수정이 필요한 복사 폴백에만 Calendar 이벤트 쓰기 scope

도메인 전체 위임의 full Drive scope는 영향 범위가 크므로, 별도 Google Cloud 프로젝트 또는 별도 서비스 계정, 비밀키 없는 실행 환경, 호출 감사, 가장 가능한 사용자 제한을 적용해야 한다. 공식 문서도 DWD에는 최소 권한 원칙을 강조한다. [서비스 계정과 DWD](https://developers.google.com/identity/protocols/oauth2/service-account)

## 6. 학생·학부모에게 Drive 권한을 주지 않는 앱 전달 구조

학생과 학부모를 Shared Drive 구성원이나 파일 ACL에 추가할 필요는 없다. Drive API는 권한 있는 서버가 파일 메타데이터를 가져오고, 바이너리를 다운로드하거나 Google Workspace 문서를 내보내도록 지원한다. [파일 다운로드·내보내기](https://developers.google.com/workspace/drive/api/guides/manage-downloads) [Drive Files API](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)

권장 흐름은 다음과 같다.

```text
학생/학부모 로그인
  → ALTON이 가족·학생·세션 접근권한 확인
  → DB에서 해당 artifact의 Drive fileId 조회
  → 백엔드가 Google 자격증명으로 Drive/Docs 조회
  → ALTON 화면에 렌더링하거나 서버를 통해 파일 전달
  → 열람·다운로드 감사 기록 저장
```

이 구조의 원칙:

- `anyone`, `domain`, 외부 사용자 직접 권한을 생성하지 않는다.
- Drive `webViewLink`를 학생에게 기본 전달하지 않는다. 사용자는 Google ACL이 없으므로 열리지 않으며, ACL을 추가하면 ALTON의 계약·가족 권한과 Drive 권한을 이중 관리해야 한다.
- ALTON DB의 현재 사용자·자녀 관계, 세션 관계, 공개 상태를 매 요청마다 검사한다.
- 선생님 검토 전 Smart Notes 원문은 학생·학부모에게 노출하지 않는다.
- 다운로드가 허용된 최종 파일만 ALTON 서버가 스트리밍한다. Google의 단기 `thumbnailLink` 같은 값을 공개 URL로 저장하지 않는다.
- Google Docs를 앱 안에 표시할 때는 Docs 내용을 읽어 ALTON 리뷰 모델로 변환하거나 승인된 형식으로 내보낸다.

Drive 링크는 파일 ID 기반의 고정 링크지만, 실제 접근은 Drive ACL로 판정된다. 권한을 회수하면 같은 링크로도 접근이 거부된다. [Drive 링크와 ACL](https://developers.google.com/workspace/drive/api/guides/manage-sharing)

## 7. Google Drive와 Supabase의 역할 분리 권고

이 절은 Google Drive의 공식 기능·제약을 바탕으로 한 ALTON 아키텍처 권고다. Supabase 기능에 대한 외부 사실을 인용하지 않는다.

### Google Drive: 사람에게 의미 있는 원본·완성 산출물

- 회사 소유 수업자료 원본
- 교재 PDF 및 선생님이 수업에 사용할 문서
- Gemini Smart Notes 원본 Google Docs
- 확정된 화이트보드 PDF·이미지 스냅샷
- 확정 수업 리뷰 문서
- 장기 보존이 필요한 회사 문서

Shared Drive가 조직 소유권, 폴더 계층, 권한 상속, Workspace 문서와 Meet 산출물 연결을 제공하므로 이 역할에 적합하다. [Shared Drive 개요](https://developers.google.com/workspace/drive/api/guides/about-shareddrives)

### Supabase Database: 제품의 진짜 상태와 접근권한

- 학생·보호자·선생님·과목 배정 관계
- 예약·수업·수업권·정산 상태
- Drive `driveId`, `fileId`, `parentId`, MIME type, artifact 상태와 버전
- 파일과 학생·과목·세션의 연결
- Smart Notes 수집·이동·검토·공개 상태
- 접근 감사, 관리자 예외, 재처리 상태

Drive 폴더 이름이나 위치를 제품 상태의 진짜 원장으로 사용하지 않는다. 이동해도 안정적인 Drive 파일 ID를 DB에서 참조한다. [Drive 파일 ID](https://developers.google.com/workspace/drive/api/guides/about-files)

### Supabase Storage: 고빈도·앱 전용·임시 데이터

- 실시간 화이트보드 이벤트와 중간 체크포인트
- 재시도 가능한 업로드 임시본
- 앱 내부에서만 쓰는 변환 캐시와 미리보기
- 아직 확정되지 않은 세션 보충자료

수업 종료 후 확정된 결과물만 Drive에 내보낸다. 실시간 이벤트마다 Drive 파일을 만들면 Shared Drive의 500,000개 항목 제한과 API 호출 비용, 폴더 가독성에 불리하다. [Shared Drive 제한](https://support.google.com/a/users/answer/7338880?hl=en) [Drive API 사용 제한](https://developers.google.com/workspace/drive/api/guides/limits)

### 최종 소유권 규칙

- **업무 상태의 원장:** Supabase Database
- **실시간 협업 상태의 원장:** Supabase의 앱 데이터 계층
- **사람이 읽는 회사 소유 문서와 확정 산출물의 원본:** Google Shared Drive
- **ALTON 사용자에게 보이는 접근권한의 원장:** ALTON DB와 애플리케이션 권한 검사
- **Drive ACL:** 회사 내부 운영자와 현재 담당 선생님을 위한 보조 접근통제

## 8. 권장 구현 순서

1. `ALTON Learning Records` Shared Drive를 회사 계정으로 생성한다.
2. 운영 관리자 그룹과 자동화 전용 내부 계정의 역할을 분리한다.
3. Shared Drive의 외부 공유, 비구성원 공유, 다운로드 제한 정책을 확정한다.
4. 학생·과목 수강·세션 폴더 프로비저닝을 멱등하게 구현하고 모든 Drive ID를 DB에 저장한다.
5. 선생님에게 과목 폴더만 직접 공유하는 권한 부여·회수 흐름을 구현한다.
6. 선생님 포털은 우선 ALTON 앱으로 제공하고, 필요할 때만 Drive 바로가기를 추가한다.
7. 테스트 수업에서 Smart Notes 생성 → 이벤트 수신 → Shared Drive 이동 → Calendar 첨부 → Docs 읽기를 종단 간 검증한다.
8. 복사 폴백과 `reconciliation_needed` 운영함을 구현한다.
9. 학생·학부모 앱 전달 경로에서 Drive ACL 없이 리뷰와 파일을 조회하는지 검증한다.
10. 권한 회수, 선생님 변경, 선생님 계정 삭제, Smart Notes 이동 실패, 중복 이벤트를 자동 테스트한다.

## 9. 승인 권고안

다음 항목을 ALTON의 기본 설계로 승인하는 것을 권장한다.

- 회사 소유 Shared Drive 사용
- `학생 → 과목 수강 → 연도 → 일자별 세션` 중심 원본 구조
- 선생님 최상위 폴더는 원본 저장소가 아니라 바로가기 또는 앱 탐색용 포털로만 사용
- 선생님은 Shared Drive 전체가 아니라 현재 배정된 과목 폴더에만 직접 접근
- Smart Notes는 생성 후 원본 파일을 세션 폴더로 이동하고 동일 file ID 유지
- 학생·학부모에게 Drive 직접 권한을 부여하지 않고 ALTON 앱을 통해 제공
- Drive는 확정 문서, Supabase는 제품 상태·실시간 데이터·임시 데이터 담당
- Manager 권한의 프로비저닝 계정과 일상 수집·조회 계정을 분리

### 반드시 출시 전 통합 테스트로 검증할 Google 동작

공식 문서의 일반 Drive 규칙으로는 설계가 성립하지만, 다음 세부 동작은 Smart Notes 전용 보장으로 명시되어 있지 않으므로 실제 `alton.education` Workspace에서 검증해야 한다.

- Smart Notes Google Docs를 주최자 My Drive에서 Shared Drive로 API 이동할 수 있는지
- 이동 뒤 SmartNote `docsDestination.document`와 Calendar `attachments[].fileId`가 같은 문서를 계속 가리키는지
- 이동 뒤 호스트·공동 호스트·초대자의 공유 권한이 정확히 어떻게 재평가되는지
- Meet가 이후 해당 문서를 수정하거나 후처리할 일이 있는지
- `drive.file`, `drive.meet.readonly`, 전체 `drive` scope 중 실제 이동에 필요한 최소 조합

이 검증이 통과하면 학생 중심 원본 + 선생님 포털 구조는 ALTON의 선생님 변경·퇴사·권한 회수 요구를 가장 단순하게 충족한다.
