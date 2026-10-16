# Google Slides 교재 전환 — 기술 검토와 Spike 인수 기준

검토일: 2026-09-14. 상태: **코드·공식 문서 조사 완료 / 실제 Slides 연결·브라우저 Spike 미실행 / 스펙 전환 미확정**.

## 1. 판단

ALTON이 범용 교재 저작도구를 계속 확장할 필요는 낮다. Google Slides를 저작 원본으로 쓰는 방향은 타당하다. 다만 **Google Slides iframe 위에 현재 필기 컴포넌트를 얹기만 하면 요구사항이 충족된다는 결론은 내릴 수 없다.**

추천 검증안은 Google Slides에서 제작하고, Publish 때 슬라이드 이미지·텍스트·영상 메타데이터를 버전별로 준비하여 ALTON의 페이지 뷰어에서 사용하는 방식이다. 편집기 개발은 줄지만 가져오기·배포 버전·뷰어·영상 재생 어댑터는 필요하다. 실제 절감량은 Spike에서 구현 범위와 유지보수 대상을 비교해야 한다.

이번 요청의 우선 범위인 기술 가능성과 기존 개발 영향 조사만 수행했다. 실제 교재 링크를 요청했으며 아직 연결·재생·필기 UAT는 하지 않았다. 기존 코드·DB·배포·Google 파일은 변경하지 않았다. 이 문서는 승인된 제품 정책을 대체하지 않는다.

## 2. 일곱 가지 질문에 대한 답

| 질문 | 조사 판단 | 남은 검증 |
| --- | --- | --- |
| ALTON 안에 표시 | 공식 웹 게시 embed 가능. 인증된 서버가 API로 페이지 이미지를 준비하는 대안도 가능 | 실제 계정 권한, 브라우저, 로딩·재시도, 화질 |
| 기존 Teacher/Student 필기 | 펜·좌표 변환·역할 구분·저장 이벤트 구조 재사용 가능. 무수정 적용은 불가 | 페이지·버전 식별, 영상 입력 충돌, 레이어별 지우개 |
| 페이지별 저장/복원 | ALTON이 현재 페이지를 소유하면 구현 가능 | 빠른 이동, 저장 도중 이동, 새로고침, 재접속, 서로 다른 페이지 |
| 삽입 영상 | Slides 자체는 YouTube/Drive 영상 지원. 이미지 변환 결과에는 재생 기능이 없음 | 별도 영상 플레이어·권한·소리·탐색·전체화면·동기화 |
| 단원→키워드 연결 | 기존 curriculum_docs와 대표 키워드 관계를 유지하고 외부 원본·배포 버전을 연결 가능 | 자동 구성·수동 선택·과거 수업 회귀 검증 |
| 기존 개발 유지/제거 | 수업·문제·커리큘럼·필기·버전 구조 유지. 본문 저작 UI 확대는 보류 가능 | 아래 파일별 영향 참조. 즉시 삭제 금지 |
| AI 자동 생성/수정 | Slides API의 create 및 batchUpdate로 가능 | 템플릿 품질, 검수, 재시도 중복 방지, 관리자 수정 충돌 |

위 표의 ‘가능’은 문서와 코드에 근거한 설계 판단이며 실제 ALTON 통합 성공을 의미하지 않는다.

## 3. 표시 방식 비교

| 방식 | 장점 | 제약 | 권장 용도 |
| --- | --- | --- | --- |
| Google Slides iframe + 필기 | 원본 표현·영상 재생을 Google에 위임, 초기 표시가 간단 | cross-origin으로 내부 DOM·현재 페이지를 직접 읽을 수 없음. 검토한 공식 API에서 발표 플레이어의 페이지 변경·seek 이벤트 계약을 확인하지 못함. 필기와 내부 클릭 경합, 원본 변경에 따른 필기 어긋남 | 비교용 Spike |
| 배포된 슬라이드 이미지 + ALTON 필기 + 영상 플레이어 | ALTON이 페이지·좌표·버전·동기화를 직접 관리 | 이미지 준비·영상 메타데이터 추출 필요. 애니메이션·전환·텍스트 선택은 그대로 보존되지 않음 | 우선 검증안 |
| Native 교재 유지 | 기존 동작·콘텐츠 활용 | 저작 범위 확대 부담 유지 | Spike 실패 시 유지 |

브라우저의 동일 출처 정책 때문에 iframe 위의 투명 필기판은 만들 수 있어도 내부의 모든 이동·키보드·영상 이벤트를 ALTON이 자동으로 알 수 있는 것은 아니다. URL로 최초 페이지를 지정하는 것과 이후 내부 탐색을 신뢰성 있게 추적하는 것은 별개다. 비공식 postMessage 이벤트나 iframe DOM 접근에 핵심 수업 기능을 의존하지 않는다.[1][2]

필기 모드에서는 캔버스가 입력을 받고, 영상 조작 모드에서는 플레이어가 입력을 받도록 분리한다. 영상 자체를 전체화면으로 전환하면 외부 필기 레이어가 함께 표시되지 않을 수 있으므로 ALTON 컨테이너 전체화면과 비교한다. iPad/Safari에서는 실제 검증이 필요하다.

## 4. 현재 코드에서 확인한 영향

CURRENT.md 상단의 초기 P2/P3 요약만으로 판단하면 현재 구현을 과소평가한다. 후속 상태와 실제 파일에는 공유 필기 레이어·문제은행·교재 단위 선택이 존재한다.

| 파일/영역 | 실제 확인 내용 | 전환 시 처리 |
| --- | --- | --- |
| `app/session/[id]/MaterialAnnotationLayers.tsx` | student_shared / teacher_shared 표시·작성 구분, 좌표 변환, 미저장 임시보관, 이벤트 저장, Realtime broadcast | 렌더링·입력 로직 재사용. 현재 680px 문서 레이아웃에서 슬라이드 비율 기반 좌표계로 변경. 저장·복구·채널에 페이지와 버전 추가 |
| `app/session/[id]/annotation-events-actions.ts` | session + curriculumDoc + scope로 저장·조회, RPC로 서버 작성자 결정 | 조회·RPC·DB 인덱스·권한 검사에 페이지/버전 범위 추가. 클라이언트의 임의 페이지·버전 쓰기 거부 |
| `app/session/[id]/MaterialTab.tsx` | HTML 섹션 스크롤/목차, v3는 MaterialAnnotationLayers, legacy는 CanvasOverlay | 교재 유형에 따른 Slides 페이지 뷰어 분기. legacy 과거 기록 읽기 유지 |
| `app/session/[id]/material-data.ts` | session_content_manifest와 curriculum_doc_versions snapshot으로 시작 시점 자료 읽기 | URL만 저장하지 말고 외부 교재 배포 스냅샷을 읽는 어댑터 추가 |
| `app/admin/CurriculumDocEditor.tsx` | HTML 본문·섹션 순서·teaching tip·섹션 문제 생성·배포 | Slides 교재에는 연결·Google에서 편집·가져오기·검수·배포 상태 UI. 기존 Native 편집기는 검증 후 축소 |
| `app/admin/curriculum-doc-actions.ts` | 교재 생성·배포 RPC·섹션 편집 | 교재 식별·배포 정책 유지, Slides import/publish 별도 처리 |
| `lib/unit-composition.ts`, 대표 키워드·자동/수동 구성 | 기존 교재 ID를 커리큘럼과 수업 준비에 연결 | 교재 ID를 유지해 변경 범위 제한. 현재 사용자 미커밋 수정 있음 |
| 문제은행·Practice·답안·문제별 필기 | 교재 외 독립 구조와 공유 레이어 정책 존재 | 유지. 교재 내 예제와 채점 가능한 문제를 구분 |

추가 영향: 기존 HTML의 단어 클릭(`VocabClickLayer`), 본문 검색·선택, 섹션별 사용 기록은 이미지 교재에서 그대로 작동하지 않는다. 텍스트 추출을 검색/AI 입력에 쓰는 것과 화면의 정확한 위치에 선택 가능한 텍스트를 얹는 작업은 다르다. Spike에서 손실 항목을 명시하고, 전체 Slides DOM 렌더러를 새로 만드는 방향으로 확대하지 않는다.

teaching tip과 교사 준비 메모는 학생용 Slides에 섞으면 안 된다. 기존 역할별 메모를 ALTON에 유지한다. 학생 필기는 현재 확정 정책상 학생·교사 등이 함께 보는 student_shared이며, 이를 새 ‘비공개 학생 필기’ 정책으로 바꾸지 않는다. 과거 student_private 기록은 기존 권한 그대로 보존한다.

## 5. 최소 데이터·배포 설계 제안

기존 교재 ID와 대표 키워드를 유지하고, 아래 정보를 교재 소스와 배포 버전에 추가한다. 실제 컬럼/테이블 이름은 구현 때 기존 스키마와 정합성을 확인한다.

- 소스: `provider`, `presentation_id`.
- 불변 배포 버전: ALTON `material_version_id`, 원본 revision, 슬라이드 순서·pageObjectId, 페이지 크기, 보존 이미지 참조, 추출 텍스트, 영상 소스·ID·위치·크기·재생 설정.
- 필기 대상: `session_id + material_version_id + slide_id + scope`, 작성자/학생 소유자는 서버에서 결정. 순서 번호만 페이지 ID로 쓰지 않는다.
- 수업 화면 상태: 현재 페이지, 교사 따라가기 여부, 상태 순번. 학생 개인 탐색은 필기 공개 범위와 별개다.

Google 원본 편집 → ALTON 가져오기 → 검수 → 배포 버전 생성 → 다음 수업에서 선택. 기존 수업은 시작 때 고정된 버전을 계속 읽는다. 원본 페이지 삭제·재정렬·본문 수정 뒤에도 과거 교재와 필기 위치가 유지되어야 한다.

Publish 중에는 원본을 고정한 작업 사본 또는 변경 감지·재시도로 한 버전의 자산만 수집한다. 모든 페이지/영상 준비가 성공하기 전에는 배포 포인터를 바꾸지 않는다. Google revision 문자열이나 공유 URL만 저장해 과거 화면이 보존된다고 가정하지 않는다. 영상도 같은 Drive 파일의 내용을 나중에 바꾸면 과거 수업이 달라지므로 버전별 자산 보존이 필요하다.

getThumbnail은 최신 페이지 PNG를 제공하며 LARGE는 폭 1600px이다. 수식·작은 글씨를 확대했을 때 충분한지 검증한다. 반환 URL은 기본 30분 유효하고 요청자 권한을 전달하므로 영구 자산 주소로 저장하거나 공개 로그에 남기지 않는다. 기존 회사 Shared Drive 원칙에 맞춰 배포 자산을 보존하고, ALTON 권한 검사를 거쳐 제공한다. 실제 수업 중 매번 thumbnail API에 의존하지 않는다.[3]

ALTON의 Publish와 Google의 ‘웹에 게시’는 다른 동작이다. 보호된 교재를 표시하기 위해 자동으로 웹 공개하지 않는다. Slides 원본 권한과 삽입된 Drive 영상의 권한도 별도로 확인해야 한다.[4][5]

## 6. 영상·AI 확장

Google Slides는 YouTube/Drive 영상을 삽입할 수 있고 API에도 CreateVideoRequest가 있다. 이는 AI 영상을 생성하는 API라는 뜻은 아니다. 영상 생성 → 파일 저장/권한 설정 → Slides에 삽입 → 관리자 검수 단계가 별도로 필요하다.[5][6]

이미지 뷰어에서는 해당 슬라이드의 영상 메타데이터로 플레이어를 배치한다. 첫 Spike는 회전·그룹화 없는 사각 영상 한 개 또는 전용 영상 페이지로 제한한다. 일반적인 도형/효과를 모두 재현하는 엔진으로 키우지 않는다. 화면 내 재생과 양쪽 기기의 동시 재생은 별도 검증 항목이다.

YouTube IFrame Player API는 재생·정지·seek·상태 이벤트를 제공한다. Slides 안에 중첩된 YouTube 플레이어를 제어한다는 뜻은 아니며 ALTON이 직접 임베드하는 경우에 적용한다. Drive 미리보기에는 같은 제어 계약이 있다고 가정하지 않는다. 동시 재생이 필요하면 플레이어 선택, 사용자 최초 클릭, 시각 보정·재접속을 추가 설계한다.[7]

AI 생성은 템플릿 기반 create/batchUpdate로 텍스트·도형·이미지·영상을 조립할 수 있다. 관리자가 수정한 원본에 무조건 덮어쓰지 않고 새 초안/버전을 만들거나 requiredRevisionId로 충돌을 감지한다. AI 결과는 자동 공개하지 않는다. 작업 ID로 중복 생성·부분 실패를 추적하고 검수 후 ALTON Publish를 거친다.[6][8][9]

## 7. 실제 교재 1개 Spike 실행 계약

첫 입력: 접근 가능한 테스트 Slides 링크 1개. 텍스트·수식·Diagram·영상이 포함된 5~7페이지 권장. 영상 소스와 시청 권한 확인 필요. 권한을 임의로 공개 변경하지 않는다.

독립 테스트 경로/기능 플래그에서 동일 교재로 iframe안과 이미지+영상안을 비교한다. 본 시스템 전환·기존 편집기 삭제는 하지 않는다. 가짜 이미지나 localStorage만으로 확인한 데모를 실제 다중 사용자 저장/공유 성공으로 보고하지 않는다.

| 시나리오 | 합격 기준 |
| --- | --- |
| 연결·표시 | 교재 순서·비율·수식/Diagram 확인, 실패·재시도 표시, 허용된 학생 계정에서 열림 |
| 교사·학생 필기 | 서로 다른 로그인에서 자신의 레이어만 쓰고 상대 필기 수신. 보기 토글은 자기 화면만 변경 |
| 지우개 | 자기 레이어만 지워지며 상대 레이어는 즉시 화면과 새로고침 후 모두 유지 |
| 페이지 이동 | 페이지 1·2에 다른 필기 후 반복 이동·새로고침해 각각 동일하게 복원 |
| 저장 도중 이동 | 600ms 저장 지연 전에 이동/닫기·통신 실패 후 재접속해도 다른 페이지에 저장되거나 조용히 손실되지 않음 |
| 실시간·권한 | 서로 다른 페이지의 필기가 섞이지 않음. 제3학생은 DB 조회/쓰기와 Realtime 수신·송신 모두 차단. Broadcast를 RLS로 자동 보호된다고 가정하지 않음 |
| 재연결 | 서버 저장 이벤트를 기준으로 누락을 보충하고 중복 스트로크가 생기지 않음 |
| 영상 | 사용자가 화면 내 재생·정지·탐색·소리를 조작, 필기 모드 전환 가능, 외부 새 탭으로 열리는 것으로 대체하지 않음 |
| 화면 크기 | 데스크톱 Chrome·Safari 및 iPad Safari에서 확대/회전/전체화면 후 좌표 확인 |
| 배포 버전 | 원본 수정·슬라이드 순서 변경 후 기존 수업의 교재·필기가 그대로 재현 |
| 기존 기능 | 별도 문제 탭, 수업 준비 교재 선택, 자동 구성, 과거 Native 교재 조회 유지 |

제안 측정 목표(제품 확정값 아님): 캐시 준비된 교재 첫 표시 3초 이내, 페이지 전환 300ms 이내, 상대 필기 표시 500ms 이내. 네트워크·기기를 함께 기록한다. 보안·저장 무결성·페이지 분리·과거 버전 재현은 속도 평균으로 상쇄할 수 없는 필수 조건이다.

결과에는 실제 URL/실행 ID, 브라우저·계정 역할, 통과·실패·미실행, 영상 권한 조건, 변경 파일/스키마 규모, 남는 운영 작업을 남긴다. iframe 실패만으로 Slides 저작 방식 전체를 기각하지 않는다. 반대로 이미지 뷰어가 복잡한 Slides 재현 엔진을 요구하거나 필수 필기·영상 요건을 만족하지 못하면 전환을 보류하고 Native를 유지한다.

## 8. 지금의 개발 범위 권고

스펙 변경 전까지 **교재 레이아웃 편집·영상 배치·범용 Diagram 저작 기능 신규 확대를 보류**한다. 커리큘럼·문제은행·수업·필기 저장 신뢰성 등 공통 기능은 계속 활용할 수 있다. Spike 통과 후 Slides 교재 유형 추가와 관리자 연결/배포 UI를 먼저 적용하고, Native 저작 UI 제거는 기존 콘텐츠 사용 현황과 기능 손실을 검토한 뒤 별도로 결정한다.

현재 코드에서 확인한 것은 재사용 가능성과 변경 지점이다. 기존 테스트 파일의 존재를 이번 실행의 통과 결과로 보고하지 않으며, 개발 일정·비용 절감 비율도 아직 산정하지 않았다.

## 공식 근거

1. [Slides API 개요](https://developers.google.com/workspace/slides/api/guides/overview)
2. [MDN 동일 출처 정책](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)
3. [Slides getThumbnail](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages/getThumbnail)
4. [Google 문서 웹 게시 및 embed](https://support.google.com/docs/answer/183965)
5. [Slides 영상 삽입·재생·공유](https://support.google.com/docs/answer/97447)
6. [Slides API Requests / CreateVideoRequest](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/request)
7. [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
8. [Slides batchUpdate / WriteControl](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/batchUpdate)
9. [Google Slides 자동 생성 Codelab](https://codelabs.developers.google.com/codelabs/slides-api)
