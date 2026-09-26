# Alton Education

Alton Education의 미오픈 개발본이다. 현재 목표는 파일럿 최소 기능이 아니라 정식 오픈 전 고객 여정·수업 운영·결제·정산·권한의 완성도를 갖추는 것이다.

## 현재 단계

- Gate A 제품 승인: 완료 (2026-08-29)
- Gate B 개발 설계 리뷰: 대기
- Gate C Google Workspace Sandbox 기술 검증: 대기
- R1 구현 착수: Gate B 승인 및 Gate C blocker 확인 후

Claude Code로 작업할 때는 먼저 `CLAUDE.md`를 읽고, 문서 분류와 우선순위는 `docs/README.md`를 따른다. 기존 `docs/tickets.md`와 `docs/prompts/`는 초기 개발 이력이며 실행 목록이 아니다.

## 기술 스택

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase Postgres/Auth/실시간·임시 데이터
- Google Workspace Calendar/Meet/Drive
- Stripe
- Vercel
- Vitest, Playwright

## 핵심 원칙

- Alton/Supabase가 업무 상태의 원본이다.
- Google Workspace와 Stripe는 외부 실행 수단이다.
- 계약, 과목 수강, 선생님 배정, 예약, 수업, 수업권, 정산을 분리한다.
- 현재 기본 정규 수업권 1장은 120분 수업 1회다.
- 서비스는 아직 오픈 전이므로 불필요한 운영용 dual-write를 만들지 않는다.
