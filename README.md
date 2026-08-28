# Alton Education — Claude Code 개발 킷

이 폴더는 목업(HTML 프로토타입)을 실제 코드로 옮기기 위해 Claude Code와 작업할 때 쓰는 킷입니다.

## 폴더 구조

```
alton-claudecode-kit/
  CLAUDE.md                  ← Claude Code가 세션마다 자동으로 읽는 파일 (프로젝트 컨텍스트)
  README.md                  ← 이 파일
  docs/
    tickets.md               ← 작업 목록 (우선순위 순서대로 정렬됨)
    prompts/
      00-init-project.md     ← 1번째로 실행
      01-schema-design.md    ← 2번째 — 사람 검토 필수 단계
      02-migrate-and-auth.md ← 3번째
      03-session-view.md     ← 4번째 — 세션뷰 (가장 중요, 여러 세션에 걸쳐 진행)
      04-portals-recurring-pattern.md ← 5번째 이후 반복 사용
    spec/
      mockups/                ← 여기에 기존 목업 HTML 7개를 넣는다 (아래 참고)
      schema-draft.md         ← 01 단계에서 Claude Code가 생성, 사람이 검토
```

## 시작하는 법

1. 이 킷 전체를 새 프로젝트 폴더로 복사
2. `docs/spec/mockups/`에 다음 7개 목업 HTML 파일을 그대로 넣는다:
   - alton_landing_v5.html
   - alton_auth_v3.html
   - alton_admin_portal_v6.html
   - alton_teacher_portal_v12.html
   - alton_student_portal_v16.html
   - alton_parent_portal_v9.html
   - alton_material_viewer_prototype.html
3. 그 폴더에서 터미널 열고 `claude` 실행
4. `docs/prompts/00-init-project.md`를 열어서 안의 프롬프트를 그대로 복사해 Claude Code에 붙여넣기
5. 이후 01 → 02 → 03 → 04 순서로 진행 (각 파일 안에 "완료 후 체크리스트"가 있으니 다음 단계로 넘어가기 전에 확인)

## 진행 원칙 (꼭 지킬 것)

- **한 세션 = 티켓 1~3개.** 스코프를 넓게 잡지 않는다. "오늘은 세션뷰의 교재 탭만 만든다"처럼 명확히 자른다.
- **01(스키마)은 반드시 사람이 검토한 뒤에 다음으로 넘어간다.** 여기서 잘못되면 전체에 영향을 준다.
- **매번 목업을 먼저 읽게 시킨다.** "이 화면 만들어줘"가 아니라 "이 목업 파일의 이 부분을 분석하고, 그대로 옮겨줘"라고 요청한다.
- **완료했다는 보고를 받으면, 실제로 테스트가 통과했는지 먼저 확인한 뒤 다음으로 넘어간다.**
- **세션뷰의 "레이어 분리" 원칙**(수업 세션 vs 순수 교재 라이브러리)을 모든 포털 작업에서 계속 상기시킨다 — 목업 단계에서 이게 제일 자주 무너졌던 부분이다.
- 티켓 완료마다 `docs/tickets.md`에 체크하고 git commit. 이게 있어야 나중에 "어디까지 했더라"를 Claude Code에게 다시 설명 안 해도 된다.

## 막혔을 때

- Claude Code가 목업 스펙과 다르게 이해하고 있는 것 같으면, 관련 목업 HTML의 정확한 함수/라인을 짚어서 다시 확인시킨다.
- 스코프가 커서 세션이 끊기면, 다음 세션 시작할 때 "CLAUDE.md와 docs/tickets.md를 읽고, 지금까지 뭐가 완료됐는지 git log로 확인한 다음 이어서 진행해줘"로 시작한다.
