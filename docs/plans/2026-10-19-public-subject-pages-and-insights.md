# 공개 과목 소개 페이지 + Insights(블로그, Sanity) 1장 정리 (2026-10-19, 오너 승인: 방향 확정)

## 목적
구글 검색 유입을 늘린다. 방문자가 "AP Calculus AB practice test" 같은 검색어로 들어와 과목 소개를 보고 무료 연습시험으로 이어지게 한다. 블로그(Insights)는 같은 방식으로 꾸준히 검색 면을 늘린다. 참고 구현: `~/Developer/college-essay-embassy`(Next.js + next-sanity, `src/app/insights`, `sanity/`, `sanity.config.ts`) — 같은 패턴을 ALTON 디자인으로 이식한다.

## 1. 사용자 흐름
- 방문자 → 검색 → `/practice-tests/[subject]`(AP 14과목 + SAT, 소개: 시험 구성, 단원/영역, 공개 연습시험 개수와 이름, 문항 유형, 소요 시간, 계산기 여부) → "Start free practice" CTA → 로그인/가입 → 기존 학생 포털.
- 방문자 → `/insights`(목록) → `/insights/[slug]`(글) → 관련 과목 페이지·연습시험 CTA.
- 실패·빈 상태: Sanity 프로젝트 ID 미설정 또는 글 0개면 Insights 목록은 "Coming soon" 빈 상태(404 아님), 메뉴 노출은 글이 있을 때만. 과목 페이지는 DB 조회 실패 시 정적 메타데이터만으로도 렌더.
## 2. 데이터와 권한
- 과목 페이지 데이터 원본: 저장소 정적 메타데이터(`lib/ap-exam/layouts.ts` 시험 구성, 커리큘럼 단원 `data/ap/curriculum-2027`·ap_skills) + 공개 세트 수·이름(서버에서 읽기 전용, 캐시 ISR 1시간). **문항 본문·정답·해설은 공개하지 않는다.** 미리보기 범위(오너 확정 기본안): 시험 구성·단원·세트 목록·"문항 유형 설명"까지, 실제 문제 일부 노출은 하지 않는다(콘텐츠 보호·저작권·로그인 전환).
- Insights: Sanity가 유일한 CMS. 새 Sanity 프로젝트 "ALTON Insights"(오너가 sanity.io에서 생성 후 `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET=production`을 Vercel Production·Preview에 설정 — 코드는 값이 없으면 빈 상태로 안전하게 동작). DB 새 표·마이그레이션 없음. 공개 읽기 전용.
- 색인: `sitemap.ts`에 과목 페이지와 Insights 글 URL 추가, `robots.ts` 유지. 영어(미국 타겟) 문구. 법적 고지(TRADEMARK_NOTICE) 푸터 유지.
## 3. UAT 데이터
- 실제 고객 데이터 쓰기 없음. Sanity는 테스트 글 1~2개로 확인 후 삭제(오너가 스튜디오에서).
## 4. UI 기준
- 과목 페이지: 히어로(과목명·한 줄 설명·CTA), 시험 구성 표, 단원 목록(가중치), 공개 연습시험 카드(이름·문항 수, 클릭 시 로그인), FAQ 3~4개(JSON-LD FAQPage 가능), 푸터. Insights: 목록 카드, 글 페이지(제목·날짜·본문·관련 CTA). 모바일 우선, 키보드 접근성, 이미지 alt.
- 헤더/푸터에 "Insights" 링크(글이 있을 때) 추가. 마일스톤 종료 때 폴리싱 라운드에서 일괄 정리.
## 5. 검증과 성능
- 단위 테스트(메타데이터 생성·sitemap·빈 상태), `next build` 통과, Preview에서 대표 3개 과목·Insights 빈 상태 확인, 쿼리 수 확인(과목 페이지는 ISR, 요청당 DB 호출 0~1). SEO 기본: canonical, og:image(텍스트 기반 대표 이미지 1장, `app/opengraph-image.tsx`), Organization·WebSite JSON-LD(홈), Course/BreadcrumbList(과목), Article(Insights).
## 범위 밖
Sanity 스튜디오 호스팅 배포(오너가 `sanity deploy` 또는 별도), 댓글, 뉴스레터.
