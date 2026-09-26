# 프롬프트 00 — 프로젝트 초기화

> **문서 상태: 실행 금지·초기 구축 이력.** 프로젝트는 이미 초기화됐고 이 프롬프트의 작업 순서는 폐기됐다. 신규 작업은 `../2026-08-29-master-roadmap-v3.md`와 `../2026-08-29-developer-handoff-v3.md`를 따른다.

## 사전 준비 (Claude Code 실행 전)
1. 새 폴더를 만들고 그 안에 이 킷 전체를 넣는다 (`CLAUDE.md`, `docs/` 등)
2. `docs/spec/mockups/`를 만들고 기존 목업 HTML 7개를 그대로 복사해 넣는다
   - alton_landing_v5.html
   - alton_auth_v3.html
   - alton_admin_portal_v6.html
   - alton_teacher_portal_v12.html
   - alton_student_portal_v16.html
   - alton_parent_portal_v9.html
   - alton_material_viewer_prototype.html
3. 그 폴더에서 터미널 열고 `claude` 실행

## Claude Code에 붙여넣을 프롬프트

```
CLAUDE.md를 읽고 프로젝트 컨텍스트를 파악해줘.

이제 프로젝트를 초기화하려고 해:

1. Next.js (App Router, TypeScript) 프로젝트를 이 폴더에 초기화해줘 (이미 있는 CLAUDE.md, docs/ 폴더는 유지)
2. Tailwind CSS 설정
3. docs/spec/mockups/ 안의 HTML 파일들을 열어서 CSS 변수(:root에 정의된 --ink, --grey-500, --red, --green 등)를 전부 찾아서, 이걸 그대로 Tailwind 커스텀 테마(tailwind.config.ts)로 옮겨줘. 임의로 다른 색을 쓰지 말고 목업에 있는 값 그대로.
4. Supabase 프로젝트 연결을 위한 기본 설정 파일(.env.example 포함)만 만들어줘 — 실제 Supabase 프로젝트는 아직 안 만들었으니 연결은 다음 단계에서 할 거야.
5. Vitest + Playwright 기본 설정
6. package.json에 lint/typecheck/test 스크립트 확인

작업 끝나면 폴더 구조를 트리로 보여주고, 다음에 뭘 하면 되는지 알려줘. 이 단계에서는 화면을 만들지 마.
```

## 완료 후 체크리스트
- [ ] `npm run dev`로 빈 Next.js 앱이 뜨는지 확인
- [ ] Tailwind 테마 색상이 목업과 일치하는지 `tailwind.config.ts` 눈으로 확인
- [ ] git init + 첫 커밋
