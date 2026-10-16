# ALTON 에이전트 작업 기준

새 세션은 `CLAUDE.md`와 `docs/CURRENT.md`만 먼저 읽는다. 현재 단계와 완료 상태는 항상 `docs/CURRENT.md`를 따른다. 해당 업무에 필요할 때만 로드맵의 관련 절과 직접 연관된 설계 문서를 추가로 읽고, `docs/README.md`는 문서 위치를 찾을 때만 사용한다.

사용자가 지정한 세션 역할(기획·개발·계약 문안)을 벗어나지 않는다. 역할별 작업·승인·보고 방식은 `CLAUDE.md`의 「세션 역할과 효율적 전달 방식」을 따른다. 구형 티켓, 프롬프트, 스키마 초안과 `docs/superpowers/`의 기존 계획은 신규 구현 지시로 실행하지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
