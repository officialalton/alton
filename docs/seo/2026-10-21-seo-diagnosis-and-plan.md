# SEO 진단·키워드 전략·실행 계획 (2026-10-21)

## 1. 현재 상태 (라이브 curl + Search Console 오너 확인)
- 홈 `URL is on Google / indexed`. 사이트맵 Success, `Discovered pages 8`(10/19 마지막 읽기 — 이후 사이트맵 증가). **색인 자체는 동작한다.** 문제는 "색인 → 노출 순위"다.
- robots.txt·sitemap.xml·canonical·title/description·H1 정상, www는 308. 4xx·리다이렉트 체인·noindex 없음. 응답 0.1~0.3초.
- 공개 페이지는 서버 렌더(JS 없이 본문 존재): 홈 약 1,500단어, `/practice-tests` 약 290, 과목 상세 약 400~460단어. JSON-LD는 홈 4개, 과목 6개(Course·Breadcrumb·FAQPage).
- 공개 URL은 과목 상세 19개 + 일반 8개뿐이었다. 시험(세트)별 URL, 샘플 문항, 허브 구조가 없었다. 사이트맵에 신규 4과목(Physics C 2, Precalculus, European History)은 이미 반영돼 있음(라이브 확인).
- 시험 본문은 로그인 뒤에 있고, 공개 쪽에는 문항이 전혀 없었다 → 검색엔진이 볼 "실제 콘텐츠"가 얇았다.

## 2. 왜 안 뜨는가 (정직한 진단)
1. **신규 도메인 + 경쟁 극심 키워드.** "free SAT practice test" 류는 College Board·Khan Academy·Princeton Review 등 오래된 고권위 도메인이 차지한다. 신규 도메인이 상위에 오르려면 콘텐츠 깊이, 롱테일 페이지 수, 외부 링크, 도메인 신뢰, 시간이 모두 필요하다. 코드만으로 단기에 해결되지 않는다.
2. **얇은 공개 콘텐츠.** 키워드를 겨냥한 URL이 과목당 1개, 본문 400단어 안팎이었다.
3. **외부 링크 0에 가까움**(오너 확인 필요). 링크가 없으면 크롤 빈도·신뢰가 낮다.
4. **브랜드 신호 약함.** 홈 title에 "Education"이 없었고 sameAs(공식 프로필)가 없다. "alton education"은 동명 기관이 있을 수 있어 경쟁이 있다.
5. 색인이 막힌 것은 아니다. "Discovered"는 구글이 URL을 알지만 아직 충분히 크롤·평가하지 않은 상태일 수 있다.

## 3. 기대치 (약속 아님)
- 브랜드 검색("ALTON Education", 도메인명)은 신규 도메인에서 보통 몇 주 걸린다. 동명 사이트가 있으면 더 걸릴 수 있다.
- 롱테일(과목·시험별)이 먼저 노출될 가능성이 크다. 핵심 키워드(free SAT practice test)는 수개월~그 이상, 외부 링크가 확보돼야 가능성이 생긴다. 순위·기간은 보장할 수 없다.

## 4. 키워드 클러스터와 대상 URL (한 키워드 = 한 페이지)
검색량 수치는 쓰지 않는다. 기준은 ALTON이 실제로 충족하는 콘텐츠와 의도 일치다.

| 클러스터 | 대표 키워드 | 대상 URL | 상태 |
|---|---|---|---|
| A 핵심 | free SAT practice test, free digital SAT practice test, SAT practice test online free with answers, full-length SAT practice test free | `/practice-tests/sat` (SAT 허브: 30개 시험 링크) | 기존 강화 |
| A 보조 | free SAT practice test 1 … 30 | `/practice-tests/sat/sat-practice-test-N` | 신규(시험별) |
| B 수학 | SAT math practice test free, SAT math practice with explanations | `/sat-math-practice` | 신규 |
| B 영어 | SAT reading and writing practice test | `/sat-reading-and-writing-practice` | 신규 |
| B 적응형 | SAT adaptive module practice | `/practice-tests/sat` 본문에서 설명(별도 페이지 없음, 카니발리제이션 방지) | 기존 |
| C 허브 | free AP practice tests by subject | `/ap-practice-tests` | 신규 |
| C 과목 | free AP Calculus AB practice exam (및 BC, Statistics, Biology, Chemistry, Physics 1, Physics C Mechanics, Physics C E&M, Precalculus, CS A, Microeconomics, Macroeconomics, Psychology, U.S. History, World History, European History, English Language, English Literature) | `/practice-tests/ap-<과목>` (18개 각 1개) | 기존 강화(소개 문단·샘플 문항) |
| C 시험별 | "<과목> practice test N" | `/practice-tests/ap-<과목>/<시험 slug>` | 신규(공개 세트 있을 때) |
| 브랜드 | ALTON Education, alton.education, ALTON Education SAT | `/` | title·JSON-LD 정비 |
| 국제학교 롱테일 | SAT practice for international school students | Insights 글(Sanity 활성화 후) → `/practice-tests/sat` 링크 | 계획 |

제외: SAT vs ACT(우리는 ACT 미제공), SAT score calculator(점수 환산 미제공 — 근거 없는 약속 금지), AP 점수 예측.

## 5. 구현 내역 (이번 1차)
- **시험별 공개 페이지** `app/practice-tests/[subject]/[test]/page.tsx`: 공개 세트(free·published)마다 URL. 고유 title/description/H1, 시험 구성 집계(섹션·영역/단원·난이도별 문항 수 — 세트마다 다른 실제 데이터), 형식·시간 표, 이전/다음/과목 링크, FAQPage·Course·Breadcrumb JSON-LD, "Start free test" CTA. 문항 본문·정답은 DB에서 읽지 않는다. 목록은 요청 시 생성(빌드에 DB 불필요), ISR 1시간.
- **과목 페이지 강화**: 과목별 직접 쓴 소개 문단(`lib/landing/samples.ts`), 자체 제작 샘플 문항 + 정답·해설(SAT 2, AP 14과목 각 1), 시험 링크화, 영어 title에 키워드와 `| ALTON Education`.
- **SAT 섹션 페이지 2개**(`/sat-math-practice`, `/sat-reading-and-writing-practice`): 4개 영역 설명·비중, 샘플 문항 2개씩, FAQ, 내부 링크.
- **AP 허브** `/ap-practice-tests`: 18과목 목록과 한 줄 소개.
- **사이트맵**: 허브·섹션 페이지·시험별 URL 자동 반영, `lastmod`는 `CONTENT_LASTMOD` 상수(콘텐츠 변경 시 갱신; 요청 시각을 쓰지 않음).
- **브랜드**: 홈 title `ALTON Education | Free SAT & AP Practice Tests`, 나머지 `… | ALTON Education`. Organization을 EducationalOrganization으로(name·alternateName·legalName·logo·contactPoint·주 단위 주소), WebSite(alternateName 포함). About에 운영 주체·소재지(캘리포니아) 명시. 주소는 개인 주거 가능성이 있어 도시·번지를 공개하지 않았다. sameAs는 확인된 URL만 넣는다(현재 없음, 아래 체크리스트).
- 테스트: `lib/landing/test-pages.test.ts`(slug·집계·DB 실패), `app/sitemap.test.ts`. 이 워크트리에는 sanity 패키지가 없어 `next build`와 sanity를 import하는 페이지 테스트(legal-pages)는 실행하지 못했다 → 총괄이 Preview 빌드에서 확인.

### 남은 계획 (우선순위)
| 순위 | 항목 | 비고 |
|---|---|---|
| 1 | SAT 영역별 개별 페이지(8개) | 영역별 샘플 문항 확충 필요 |
| 2 | AP 과목별 샘플 문항 추가(역사·영어 포함) | 지문 필요, 검수 필요 |
| 3 | 공개 샘플을 DB 문항에서 자동 선정 | 수식·그림 렌더링 검토 필요 |
| 4 | Insights(Sanity) 글 | 오너 계정 단계 필요 |
| 5 | 이미지 alt·성능(OG 이미지 1장 외 이미지 없음) | 현재 위험 낮음 |

## 6. 오너 체크리스트
**Search Console**
1. 도메인 속성 확인(DNS 인증)과 URL 접두사 속성 중 어느 것인지 확인.
2. 배포 후 사이트맵 `sitemap.xml` **재제출**하고 상태가 Success, 발견된 페이지 수가 증가하는지 확인.
3. URL 검사 → "색인 생성 요청" 우선순위: ① `/` ② `/practice-tests/sat` ③ `/ap-practice-tests` ④ `/sat-math-practice` ⑤ `/sat-reading-and-writing-practice` ⑥ `/practice-tests/sat/sat-practice-test-1` ⑦ `/practice-tests/ap-calculus-ab` ⑧ `/practice-tests/ap-statistics` ⑨ `/practice-tests/ap-biology`. 하루 요청 수 제한이 있다.
4. 색인 > 페이지 보고서에서 "크롤링됨 – 현재 색인 안 됨", "발견됨 – 현재 색인 안 됨" 건수를 기록. 경험 > 핵심 성능 보고서는 URL이 쌓인 뒤에 표시된다.
5. 향상 > 사이트 이름/로고(또는 홈의 WebSite 구조화 데이터 검사)로 "ALTON Education" 인식 확인. 리치 결과 테스트로 FAQPage·Breadcrumb 확인.

**브랜드 신호**
6. 공식 프로필 개설 후 URL을 알려주면 홈에서 링크하고 `sameAs`에 반영: LinkedIn 회사 페이지, Instagram, YouTube, 네이버 블로그 등. 확인되지 않은 URL은 넣지 않는다.
7. Google Business Profile: 온라인 전용 교육업은 매장·서비스 지역 요건을 충족해야 하며 우편 인증이 필요하다. 소재지가 개인 주거면 공개 주소 노출을 피하고(서비스 지역 비즈니스로 주소 숨김) 가능 여부를 확인.
8. "alton education" 동명 기관이 있으면 도메인 검색 "alton.education"과 "ALTON Education SAT" 조합을 먼저 노린다.

**백링크(현실적 후보, 대량 구매·스팸 금지)**
- 학부모·학생 커뮤니티의 자연스러운 소개(규칙 준수, 홍보 글 반복 금지), 국제학교·학원 협력 페이지, 교육 블로그 게스트 기고, 대학 입시 리소스 디렉터리(무료 등록만), 학생 파트너가 쓰는 후기·리소스 목록.
- 링크 구매, 상호 링크 대량 교환, 자동 댓글·포럼 스팸은 구글 정책 위반으로 역효과 가능.

**Insights(Sanity)**: sanity.io에서 프로젝트 "ALTON Insights" 생성 → `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET=production`을 Vercel Production·Preview에 설정 → 스튜디오에서 첫 글 게시(코드는 값 없으면 빈 상태). 첫 글 후보: international school 학생용 SAT 준비 가이드, 디지털 SAT 형식 설명.

**공유 메타 점검**: 모든 공개 페이지에 OG 이미지(`/opengraph-image`, 텍스트 기반 1장)와 페이지별 title이 설정돼 있다. 시험별·과목별 전용 OG 이미지는 후속(영향 낮음). 공유 시 미리보기 확인은 총괄 Preview에서.

## 7. 측정 방법
- Search Console > 실적: 기간 4주 단위로 비교. 필터 "페이지"에 URL 포함 조건을 걸어 클러스터별로 본다 — 시험별 `/practice-tests/sat/`, 과목 `/practice-tests/ap-`, 섹션 `/sat-math-practice`·`/sat-reading`, 브랜드는 쿼리에 `alton` 포함.
- 지표: 색인된 URL 수(색인 > 페이지), 노출수, 클릭수, 평균 순위(방향만 본다), 쿼리 수.
- **4주 점검**: 새 URL 대부분이 색인됐는가(미색인이면 콘텐츠 보강·링크 점검), 노출수가 0에서 벗어났는가, 브랜드 쿼리 노출이 생겼는가.
- **8주 점검**: 롱테일 쿼리에서 노출·클릭이 늘고 평균 순위가 개선되는 방향인가, 어떤 클러스터가 노출을 만드는지 보고 그쪽 콘텐츠를 늘린다. 노출이 없는 클러스터는 문서의 남은 계획 순서대로 보강한다.
- 순위 보장은 하지 않는다. 방향성과 색인 수가 판단 기준이다.
