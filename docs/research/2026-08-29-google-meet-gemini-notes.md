# Google Meet Gemini 회의록의 ALTON 수업 리뷰 연동 조사

- 조사일: 2026-08-29
- 조사 범위: Google Workspace·Google Meet·Google Workspace API의 공식 문서만 사용
- 목적: 영상·음성 녹화 없이 Gemini의 `Take notes for me` 산출물을 ALTON 수업 리뷰에 자동 연결할 수 있는지 검토
- 실측 보충(2026-08-29): `alton.education` Business Plus에서 별도 Meet 전사와 녹화를 끈 상태로 수동 테스트. Smart Notes Docs가 생성됐고 문서에 텍스트 전사 탭이 함께 나타남. 아래 공식 문서 기반 구분과 별개로, 제품 정책은 이 테넌트 실측 동작을 기준으로 정정한다.

## 결론

**가능하다.** 현재 Google은 Gemini 회의록을 `SmartNote`라는 공식 Meet 산출물로 제공하며, Meet REST API v2의 `conferenceRecords.smartNotes.get/list`와 Google Workspace Events API의 `google.workspace.meet.smartNote.v2.fileGenerated` 이벤트가 2026-04-02부터 정식 제공(GA)된다. 따라서 ALTON은 수업 종료 후 생성된 Google Docs 회의록의 문서 ID와 링크를 공식 API로 받아 수업 리뷰에 연결할 수 있다. [Meet API 릴리스 노트](https://developers.google.com/workspace/meet/release-notes) [SmartNote API](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.smartNotes)

공식 API에서 `SmartNote`와 별도 Meet `Transcripts`는 서로 다른 산출물로 정의된다. 그러나 `alton.education` 실측에서는 별도 `Transcribe the meeting`을 끈 상태에서도 Smart Notes 결과 문서 안에 텍스트 전사 탭이 생성됐다. 따라서 ALTON은 별도 Meet 전사 기능은 켜지 않되, Smart Notes에 수반되는 텍스트 전사는 실제 산출물 일부로 허용하고 제한 접근·보관 대상으로 관리한다. [자동 산출물 구성 및 차이](https://developers.google.com/workspace/meet/api/guides/meeting-spaces-configuration) [Meet 산출물 처리](https://developers.google.com/workspace/meet/api/guides/artifacts)

ALTON에는 다음 형태가 가장 적절하다.

1. 성인인 선생님 또는 회사 관리 Workspace 계정을 회의 주최자로 사용한다.
2. 각 수업 Calendar 이벤트에 고유한 Meet 회의를 생성하고, ALTON 수업 ID와 Calendar 이벤트 ID·Meet 공간 ID·회의 코드를 저장한다.
3. 영상·원본 음성 녹화와 별도 Meet 전사는 끄고, `autoSmartNotesGeneration`만 켠다. Smart Notes 문서에 수반되는 텍스트 전사는 허용한다.
4. `smartNote.v2.fileGenerated` 이벤트를 받은 뒤 SmartNote의 `docsDestination.document`와 `exportUri`를 수업에 연결한다.
5. 회의록은 학생에게 즉시 확정본으로 공개하지 않고 선생님의 검토·수정 후 수업 리뷰로 확정한다.
6. 이벤트 누락에 대비해 Meet API 정기 대조 작업을 운영한다.

## 1. `Take notes for me`가 생성하는 산출물

### 1.1 회의 중 산출물

- 회의 중 늦게 참여한 사용자는 `Summary so far`로 현재까지의 요약을 볼 수 있다.
- 회의록 언어, 수신자, 길이(Standard 또는 Longer), 포함할 섹션을 설정할 수 있다.
- 공식 도움말에 제시된 섹션은 Summary, Decisions, Next steps, Details다. 일부 세부 설정은 베타 사용자에게만 제공될 수 있다.
- 관리자가 허용하면 Gemini가 화면에 10초 이상 표시된 프레젠테이션 등 시각 자료의 스크린샷을 회의록에 포함할 수 있다.
- 회의록 작성을 늦게 시작하면 이전 내용까지 소급해 작성하지 않는다.

출처: [Google Meet의 Take notes for me](https://support.google.com/meet/answer/14754931?hl=en), [관리자의 AI 회의록 설정](https://knowledge.workspace.google.com/admin/meet/let-google-meet-ai-take-notes-for-my-users)

### 1.2 회의 종료 후 산출물과 저장 위치

- 회의 종료 후 Google Docs 회의록이 생성된다.
- 문서는 주최자의 My Drive에 있는 `Google Meet` 폴더와 해당 회의 하위 폴더에 저장된다.
- 주최자는 이메일로 회의록 링크, 회의 요약, 제안된 다음 단계를 받는다.
- 예약된 회의라면 회의록 문서가 Calendar 이벤트에 자동 첨부된다.
- 공유 대상은 모든 초대자, 조직 내부 초대자, 호스트·공동 호스트만 중 선택할 수 있다. Calendar에 첨부파일이 보이는 것과 실제 Docs 접근 권한은 별개다.
- 회의록 문서는 조직의 Meet/Drive 보존 정책을 따른다.

출처: [Google Meet의 Take notes for me](https://support.google.com/meet/answer/14754931?hl=en), [Calendar 및 Meet 회의록 설정](https://support.google.com/meet/answer/16909639?hl=en), [관리자의 AI 회의록 설정](https://knowledge.workspace.google.com/admin/meet/let-google-meet-ai-take-notes-for-my-users)

### 1.3 회의록과 전사본의 차이

| 구분 | Gemini Smart Notes | Meet Transcripts |
|---|---|---|
| 목적 | 핵심 내용·결정·할 일 요약 | 발언의 축어 기록 |
| 산출물 | Google Docs 회의록 | 별도의 Google Docs 전사본 |
| 상세도 | 고수준 요약 | 발언자별 텍스트와 시간 정보 |
| 영상 녹화 필요 | 없음 | 없음 |
| API | `conferenceRecords.smartNotes` | `conferenceRecords.transcripts` 및 `entries` |

두 기능을 함께 켜고 회의 동안 유지하면 상호 연결된 클릭 가능한 인용을 생성할 수 있지만, 결과 문서는 서로 별개다. 전사 API 항목은 발언자, 텍스트, 언어 코드, 시작·종료 시간을 제공한다. Meet REST API의 전사 항목 데이터는 회의 종료 후 30일 동안만 제공된다. [자동 산출물 구성 및 차이](https://developers.google.com/workspace/meet/api/guides/meeting-spaces-configuration) [TranscriptEntry 리소스](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.transcripts.entries) [Meet 산출물 보존](https://developers.google.com/workspace/meet/api/guides/artifacts)

**ALTON 판단(실측 후 개정):** 별도 Meet `Transcripts`는 기본 활성화하지 않는다. 다만 Smart Notes 결과 문서에 수반되는 텍스트 전사는 허용하고, 담당 선생님·권한 있는 관리자/QC만 접근하며 학생·보호자에게는 확정 요약만 제공한다.

## 2. 지원 에디션과 설정·제약

### 2.1 지원 Workspace 에디션

2026-08-29 현재 공식 비교표에서 `Take notes for me`를 지원하는 비즈니스용 에디션은 다음과 같다.

- Business Standard
- Business Plus
- Enterprise Standard
- Enterprise Plus
- Frontline Plus

Education 계정에서는 현재 기본 Education Fundamentals·Standard·Plus 또는 Teaching and Learning 라이선스가 아니라 **Google AI Pro for Education 부가 라이선스**가 표시된다. 개인 계정은 Google AI Pro 또는 Ultra가 지원되지만, ALTON의 중앙 운영 구조에는 관리형 Workspace 계정이 더 적합하다. 회의 주최자에게 지원 에디션이 있어야 한다. [Workspace Gemini 기능 비교](https://support.google.com/meet/answer/13952129) [Education 기능 비교](https://support.google.com/meet/answer/13952129?co=DASHER._Family%3DEducation&hl=en) [Meet 프리미엄 기능 비교](https://support.google.com/meet/answer/10459644?hl=en)

**ALTON 권장:** `alton.education`의 회의 주최자 계정에는 최소 Business Standard를 배정한다. 학생의 개인 Google 계정이나 학교 계정의 라이선스에 의존하지 않는다.

### 2.2 관리자 설정

관리자는 Admin console의 `Apps > Google Workspace > Google Meet > Gemini settings`에서 다음을 관리할 수 있다.

- `Google AI note-taking`: 사용 허용 여부
- 조직 단위 또는 그룹별 적용
- 기본 공유 범위
- 호스트가 공유 범위를 변경할 수 있는지
- 회의록에 발표 자료 스크린샷을 포함할 수 있는지
- 자동 회의 산출물 기본 설정

Google은 설정 변경 반영에 최대 24시간이 걸릴 수 있다고 안내한다. 또한 사용자의 Workspace 스마트 기능 설정이 꺼져 있으면 회의록 기능을 사용할 수 없다. [관리자의 AI 회의록 설정](https://knowledge.workspace.google.com/admin/meet/let-google-meet-ai-take-notes-for-my-users) [Google Meet의 Take notes for me](https://support.google.com/meet/answer/14754931?hl=en)

**ALTON 권장 설정:**

- Google AI note-taking: 선생님·운영 계정 조직 단위에만 허용
- 기본 공유: `Hosts and co-hosts only`
- 호스트의 임의 공유 변경: 초기에는 비허용
- Visual content in notes: 초기에는 비허용하거나, 교재 화면 캡처까지 보존할 정책을 별도로 확정한 후 허용
- Host management: 활성화하여 호스트와 공동 호스트만 시작·중지 가능하게 설정

### 2.3 호스트 조건

- Host management가 켜져 있으면 호스트와 공동 호스트만 회의록 작성을 시작·중지할 수 있다.
- 꺼져 있으면 주최자 조직의 내부 참가자도 시작·중지할 수 있다.
- 자동 생성으로 설정해도 권한 있는 호스트 또는 공동 호스트가 웹에서 회의에 참여하기 전에는 시작되지 않는다.
- 자동 회의록은 회의 공간별 설정이며 녹화·전사 설정과 독립적이다.

출처: [Google Meet의 Take notes for me](https://support.google.com/meet/answer/14754931?hl=en), [Meet 공간의 자동 산출물 구성](https://developers.google.com/workspace/meet/api/guides/meeting-spaces-configuration)

### 2.4 언어 및 회의 길이 제약

- 지원 음성 언어: 영어, 프랑스어, 독일어, 이탈리아어, 일본어, 한국어, 포르투갈어, 스페인어
- 한 회의에서는 한 언어만 지원하며 다국어 혼용은 현재 지원하지 않는다.
- 권장 회의 길이는 최소 15분부터 최대 8시간이다.
- 발화가 50단어 미만이면 회의록이 생성되지 않을 수 있다.
- 연결 문제나 부적절한 콘텐츠로 인해 회의록이 부정확하거나 생성되지 않을 수 있다.
- Gemini 출력은 불완전하거나 부정확할 수 있다.

ALTON의 60분 체험 및 120분 정규 수업은 권장 길이 범위 안에 있다. 한국어와 영어가 섞이는 수업은 한 언어를 기준으로 지정해야 하며, 혼용 수업의 품질은 별도 테스트가 필요하다. [Google Meet의 Take notes for me](https://support.google.com/meet/answer/14754931?hl=en) [관리자의 AI 회의록 설정](https://knowledge.workspace.google.com/admin/meet/let-google-meet-ai-take-notes-for-my-users)

### 2.5 미성년자 관련 제약

Google의 Workspace with Gemini 안내는 AI 기반 기능 사용 요건으로 **18세 이상**을 명시한다. 공식 문서는 미성년 참가자가 포함된 회의에서 성인 호스트가 `Take notes for me`를 사용하는 것 자체를 금지한다고 명시하지는 않지만, 미성년 학생 본인을 기능 사용자·주최자·활성화 주체로 설계해서는 안 된다. [Workspace with Gemini 시작 요건](https://support.google.com/meet/answer/13952129)

**ALTON 적용 해석:**

- 회의 주최자와 회의록 활성화 주체는 18세 이상 선생님 또는 운영 계정으로 제한한다.
- 학생 계정의 Gemini 라이선스나 기능 접근에 의존하지 않는다.
- 미성년 학생의 발화가 처리되고 문서로 남는다는 사실은 보호자 동의 및 개인정보 고지에 포함한다.
- Google의 계정 연령 제한과 별개로, ALTON은 서비스 제공 지역의 미성년자 개인정보·통신 기록 관련 요건을 별도 검토해야 한다.

마지막 두 항목은 Google 문서에 기초한 ALTON의 제품·운영 해석이며 법률 결론은 아니다.

## 3. ALTON 수업 리뷰로 자동 연결하는 공식 방법

### 3.1 전용 API 존재 여부

전용 API가 **있다**. Meet REST API v2의 `SmartNote` 리소스는 다음을 제공한다.

- `name`: `conferenceRecords/{conferenceRecord}/smartNotes/{smartNote}`
- `state`: `STARTED`, `ENDED`, `FILE_GENERATED`
- `startTime`, `endTime`
- `docsDestination.document`: Google Docs 문서 ID
- `docsDestination.exportUri`: 문서를 열거나 가져올 수 있는 URI
- `smartNotes.get`, `smartNotes.list`

필요 OAuth 범위는 `meetings.space.created` 또는 `meetings.space.readonly`다. Google의 릴리스 노트는 2026-04-02부터 SmartNote 조회와 이벤트 구독을 GA로 선언한다. 일부 가이드의 예제 URL에는 아직 `v2beta`가 남아 있지만, 현재 REST 참조와 GA 발표는 `v2` 엔드포인트를 제시하므로 구현은 v2를 기준으로 하고 실제 Workspace 테넌트에서 통합 테스트해야 한다. [SmartNote 리소스](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.smartNotes) [SmartNote get](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.smartNotes/get) [Meet API 릴리스 노트](https://developers.google.com/workspace/meet/release-notes) [Meet 산출물 처리](https://developers.google.com/workspace/meet/api/guides/artifacts)

SmartNote API는 문서의 구조화된 Summary·Decisions 필드를 직접 반환하는 API가 아니라 **Google Docs 목적지 메타데이터**를 반환한다. ALTON에서 문서 내용을 화면에 표시하려면 `docsDestination.document`를 Google Docs API의 `documents.get`에 전달해 내용을 읽고 필요한 섹션을 파싱해야 한다. [Google Docs documents.get](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/get)

### 3.2 권장 자동 연결 흐름

1. ALTON이 Calendar API로 수업 이벤트와 매 수업별 고유 Google Meet 회의를 만든다.
2. ALTON DB에 `lesson_id`, `calendar_event_id`, `organizer_email`, `meeting_code`, `meet_space_name`을 저장한다.
3. Meet API로 해당 공간의 `smartNotesConfig.autoSmartNotesGeneration=ON`을 설정한다. 녹화와 자동 전사는 `OFF`로 둔다.
4. 주최자 사용자 또는 개별 Meet 공간을 대상으로 Google Workspace Events API 구독을 만든다.
5. `google.workspace.meet.smartNote.v2.fileGenerated` 이벤트를 받는다.
6. 이벤트의 SmartNote 리소스 이름으로 `smartNotes.get`을 호출한다.
7. `docsDestination.document`와 `exportUri`를 ALTON 수업에 저장한다.
8. Docs API로 내용을 읽어 수업 리뷰 초안을 만들고, 선생님이 검토·수정·확정한다.
9. 학생·학부모에게는 ALTON 권한 체계를 거쳐 확정된 리뷰만 노출한다.

Google Workspace Events API는 스마트 노트의 시작·종료·파일 생성 이벤트를 공식 지원한다. 사용자 단위 구독은 해당 사용자가 소유한 모든 Meet 공간의 이벤트를 받을 수 있으므로 선생님 수가 늘어날 때 공간별 구독보다 관리가 단순할 수 있다. [Meet 이벤트 구독](https://developers.google.com/workspace/events/guides/events-meet)

Calendar API에서는 이벤트의 `conferenceData.conferenceId`와 `entryPoints[].meetingCode`를 저장할 수 있다. Google은 서로 다른 Calendar 이벤트에서 Meet 회의 정보를 재사용하면 접근 문제와 정보 노출 위험이 있으므로 이벤트마다 고유한 회의를 생성하라고 명시한다. [Calendar Events 리소스](https://developers.google.com/workspace/calendar/api/v3/reference/events)

### 3.3 인증 구조

공식 Meet 산출물 문서는 사용자 OAuth 자격 증명과 도메인 전체 위임(domain-wide delegation)을 모두 지원한다고 설명한다. ALTON에는 다음 구조를 권장한다.

- 모든 회의 주최자를 `alton.education` 관리 계정으로 제한한다.
- 백엔드 서비스 계정에 필요한 최소 범위만 도메인 전체 위임하고 회의 주최자를 가장해 조회한다.
- Meet 조회, Meet 설정, Docs 읽기 범위를 분리해 최소 권한으로 승인한다.
- 외부 개인 계정이나 학생 계정을 가장하지 않는다.
- 모든 자동 조회와 관리자 열람을 감사 로그로 남긴다.

출처: [Meet 산출물 인증 방식](https://developers.google.com/workspace/meet/api/guides/artifacts), [Meet API 인증 및 승인](https://developers.google.com/workspace/meet/api/guides/authenticate-authorize), [Docs API 권한 범위](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/get)

### 3.4 이벤트 누락 또는 API 장애에 대한 안정적 대안

전용 API가 있으므로 Drive 파일명 검색을 기본 경로로 사용할 이유는 없다. 다음 순서의 복구 경로가 안정적이다.

1. **주 경로:** Workspace Events API의 `smartNote.v2.fileGenerated` 이벤트
2. **대조 작업:** 수업 종료 후 일정 시간 뒤 `conferenceRecords.list`를 회의 코드와 시간대로 필터링하고 `smartNotes.list` 실행
3. **Calendar 보조 경로:** Calendar 이벤트의 `attachments[]`에서 Google Docs 첨부파일 확인
4. **운영 폴백:** 관리자가 Calendar 또는 Drive의 회의록 링크를 수업에 수동 연결

Meet API의 `conferenceRecords.list`는 `space.meeting_code`, `space.name`, 시작·종료 시간 필터를 지원한다. Google도 이벤트 구독에서 누락된 이벤트를 보완하기 위해 Meet REST API를 주기적으로 조회할 수 있다고 안내한다. [conferenceRecords.list](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords/list) [Meet 이벤트 구독](https://developers.google.com/workspace/events/guides/events-meet)

**피해야 할 방법:**

- 이메일 본문을 파싱해 링크 추출
- `Google Meet` 폴더의 최신 파일을 수업과 매칭
- 언어별·시기별로 바뀔 수 있는 파일명 규칙에 의존
- Calendar 이벤트 하나의 Meet 링크를 여러 수업에서 재사용

## 4. 녹화 없이 회의록을 사용하는 경우의 데이터·동의 고려사항

### 4.1 “녹화하지 않음”과 “수집하지 않음”은 다르다

영상 MP4나 원본 음성 파일을 저장하지 않더라도, `Take notes for me`는 회의의 음성 내용을 처리해 요약 문서를 생성한다. 시각 콘텐츠 설정이 켜져 있으면 교재·화면 공유의 스크린샷도 포함될 수 있다. 따라서 개인정보 처리방침과 보호자 고지에서 단순히 “수업을 녹화하지 않는다”라고만 쓰면 부족하다.

권장 고지 방향:

> ALTON은 수업 영상과 원본 음성을 녹화·보관하지 않습니다. 다만 수업 리뷰 작성을 위해 Google Meet의 AI 회의록 기능이 수업 중 발화를 처리하여 요약 문서와 이에 수반되는 텍스트 전사를 생성할 수 있습니다. 원본은 제한된 권한으로 보관하며, 담당 선생님이 검토한 확정 요약만 학생·보호자에게 수업 리뷰로 제공합니다. 보호자는 자녀별로 이 처리를 사전에 거부할 수 있습니다.

이는 법률 문안이 아니라 제품 고지 초안이며 출시 전 관할 지역 검토가 필요하다.

### 4.2 참가자 알림과 동의

- Meet는 회의록 작성이 시작되면 모든 참가자 화면에 알림과 아이콘을 표시한다.
- 관리자는 회의록·녹화·전사 기능 사용 전에 모든 참가자의 명시적 동의를 요구하도록 설정할 수 있다.
- 활성 기능이 있는 회의에 참여하거나 기능이 시작된 후 계속 머무르는 과정에서 참가자는 동의 화면을 받으며, 원하지 않으면 나갈 수 있다.
- Google의 화면 알림만으로 ALTON의 미성년자 보호자 동의를 대체해서는 안 된다.

출처: [Google Meet의 Take notes for me](https://support.google.com/meet/answer/14754931?hl=en), [Meet 전사 및 동의 설정](https://support.google.com/meet/answer/12849897?hl=en)

**ALTON 권장:**

- 계약·개인정보 동의 단계에서 보호자에게 AI 회의록 생성 목적, 처리 업체, 보관기간, 열람 범위를 고지한다.
- 보호자의 사전 거부를 저장하고, 거부된 수업은 참가자가 입장하기 전에 Smart Notes를 끈다. Meet 입장 시 명시적 동의 화면은 이 사전 거부권을 대체하지 않는다.
- 수업 시작 화면에도 “AI 회의록 생성 중” 상태를 표시한다.
- 학생 또는 보호자가 거부할 수 있는 운영 절차와 회의록 없는 수업 리뷰 대안을 둔다.
- 민감한 대화를 회의록에서 제외해야 할 때 호스트가 즉시 중지할 수 있게 한다.

### 4.3 공유와 접근 권한

Google의 기본 공유 대상은 조직 내부 초대자일 수 있으며, 초대된 외부 참가자까지 공유하도록 설정할 수도 있다. ALTON은 Google Docs를 학생에게 직접 광범위하게 공유하기보다 다음 방식이 안전하다.

- Google 회의록 원본: 호스트·공동 호스트와 승인된 운영 관리자만 접근
- ALTON 리뷰 초안: 담당 선생님과 승인된 관리자만 접근
- 확정 수업 리뷰: 해당 학생, 연결된 보호자, 담당 선생님, 관리자만 접근
- 선생님 변경 후: 과거 원본 회의록은 새 선생님에게 자동 공개하지 않고 필요한 확정 리뷰만 인계
- 관리자의 원본 열람·내보내기: 감사 로그 기록

### 4.4 정확성과 책임

Google은 회의 요약이 불완전하거나 부정확하거나 생성되지 않을 수 있다고 안내한다. 따라서 Smart Notes를 다음 판정의 자동 근거로 쓰면 안 된다.

- 수업 완료·취소·노쇼 확정
- 수업권 소진
- 선생님 정산
- 학생 성취도에 대한 확정 평가
- 분쟁의 단독 증거

ALTON에서는 `AI 생성 초안 → 선생님 검토 → 확정 리뷰`의 상태를 분리하고, AI 생성 여부와 최종 수정자를 기록해야 한다.

### 4.5 보존과 삭제

Google Docs 회의록은 Drive 규칙을 따르며, Google Vault에서는 Gemini 회의록을 포함한 Meet 데이터에 보존 규칙을 적용할 수 있다. 회의록 문서는 Meet 전용 규칙을 쓰더라도 Drive 보존 규칙의 적용도 받을 수 있으므로 두 설정을 함께 검토해야 한다. [Google Vault의 Meet 보존](https://knowledge.workspace.google.com/vault/retention/retain-google-meet-data-with-vault)

ALTON의 승인된 보존 방향과 맞추려면 다음처럼 분리하는 것이 적절하다.

- 미검토 Gemini 원본 회의록: 원시 산출물로 분류하여 수업 후 12개월
- 선생님이 확정한 수업 리뷰: 교육 기록으로 분류하여 마지막 수업 후 3년
- 별도 전사를 향후 활성화하는 경우: 원시 전사 데이터는 12개월 이하로 제한하고 목적을 별도 고지
- 삭제 요청·계약 종료 시: ALTON DB뿐 아니라 주최자 Drive·Vault 정책까지 연결해 처리

이 보존 구분은 Google의 제품 동작을 설명하는 사실이 아니라 ALTON의 기존 보존정책에 맞춘 제품 권고다.

### 4.6 Google Workspace의 Gemini 데이터 보호

Google은 Workspace의 Gemini 기능에 기존 조직 보안·데이터 처리 통제가 적용되고, Workspace에서 생성된 콘텐츠가 조직 외부에 공유되거나 조직 외부 모델 학습에 사용되지 않는다고 설명한다. 다만 이 보호는 ALTON이 자체적으로 적용해야 하는 접근 통제, 보호자 고지, 최소 수집, 삭제 절차를 대신하지 않는다. [Workspace with Gemini 데이터 보호](https://support.google.com/meet/answer/13952129)

## 5. 구현 전 검증 체크리스트

- [x] `alton.education` Workspace Business Plus 확인(2026-08-29 Admin Console 실측)
- [ ] 선생님·운영 계정만 Gemini note-taking 허용하는 조직 단위 구성
- [ ] 모든 회의 주최자가 18세 이상 관리 계정인지 확인
- [ ] 호스트·공동 호스트 전용 공유와 Host management 강제
- [x] Calendar 생성 회의에 `autoSmartNotesGeneration=ON`, 영상·원본 음성 녹화와 별도 Meet 전사 `OFF` 적용 수동 테스트. Smart Notes 수반 텍스트 전사 탭 생성도 확인
- [ ] 한국어 60분·120분 수업에서 회의록 품질 테스트
- [ ] 한국어·영어 혼용 수업 실패 및 품질 저하 처리 테스트
- [ ] `smartNote.v2.fileGenerated` 이벤트 수신과 중복 처리 테스트
- [ ] Events API 누락 후 Meet API 대조 작업 복구 테스트
- [ ] SmartNote v2에서 Docs 문서 ID·링크 조회 테스트
- [ ] Docs API로 회의록 내용을 읽고 섹션을 추출하는 테스트
- [ ] 선생님 검토 전 학생·학부모에게 노출되지 않는지 권한 테스트
- [ ] 회의록 생성 실패 시 선생님 수동 리뷰 입력 흐름 제공
- [ ] 보호자 고지·동의 및 학생 거부 시 대체 절차 확정
- [ ] Drive·Vault와 ALTON의 12개월/3년 삭제 정책 연동 테스트

## 6. 최종 권고

ALTON은 **영상·원본 음성 녹화와 별도 Meet 전사 없이 Gemini Smart Notes를 기본 활성화**하고 이를 수업 리뷰의 AI 초안으로 연결한다. Smart Notes 문서에 수반되는 텍스트 전사는 허용하되 제한 접근·보관 대상으로 관리한다. 현재는 공식 SmartNote API와 파일 생성 이벤트가 정식 제공되므로 기술적으로 무리한 우회가 필요하지 않다.

제품 기준선은 다음으로 제안한다.

- 필수: 성인 선생님/회사 계정이 주최, Business Standard 이상, Smart Notes 자동 활성화
- 기본 비활성: 영상·원본 음성 녹화, 별도 Meet 축어 전사. 시각 자료 스크린샷은 `녹화 시에만 허용`으로 설정해 정상 수업에서는 비활성
- 제한 허용: Smart Notes 문서에 수반되는 텍스트 전사(원본 회의록과 동일한 접근·12개월 보관정책)
- 공개 방식: Google 원본 직접 공유가 아니라 선생님 검토 후 ALTON 리뷰로 제공
- 자동화: Events API 우선, Meet REST API 대조 작업 필수
- 판정 제한: AI 회의록은 출석·수업권·정산의 자동 근거로 사용하지 않음
- 개인정보: “녹화 없음”과 별도로 AI 발화 처리·요약 문서·수반 텍스트 전사 생성을 보호자에게 명시하고 사전 거부권과 Meet 입장 시 명시적 동의를 함께 제공

이 방식이면 현재의 “영상·음성 녹화 없음” 원칙을 유지하면서도, 수업 리뷰 작성 부담을 크게 줄이고 학생·학부모에게 일관된 수업 요약을 제공할 수 있다.
