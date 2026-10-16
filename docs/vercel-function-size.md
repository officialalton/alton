# Vercel 함수 크기 절감 (2026-10-14)

## 문제
Vercel 무료 팀의 Function Storage(10 GB) 100% 도달. 배포 1회당 약 170개 람다 x 약 11.7 MB(압축) = 약 2 GB.

## 원인 (로컬 `next build` 후 `.next/server/**/*.nft.json` 실측)
| 원인 | 영향 |
|---|---|
| `outputFileTracingIncludes["/**"]`가 `pdfjs-dist/legacy/build/**`(.map 포함 약 14.5 MB)를 **모든 라우트**에 포함 | 라우트당 +13.7 MB. 대부분 람다의 크기 전부 |
| `"/admin"` include 키가 **부분 일치(contains)** 로 비교됨 | `/admin/*`, `/api/admin/*`, `/auth/admin-*` 14개 라우트에 AP 재고 JSON(약 45 MB)이 번짐 |
| `lib/ap-admin/batches.ts` 등의 `path.join(process.cwd(), 동적경로)` fs 호출 | 추적기가 프로젝트 디렉터리 전체를 끌어와 `/admin` 한 람다가 **829 MB**(data/ap 270 MB, mock-exam-generation 230 MB, docs/ap 183 MB 스크린샷 JPG, rw-generation 42 MB, docs/assets 14 MB, supabase/migrations 등) |

playwright / typescript / vitest / sharp 는 어느 서버 trace에도 없음(누수 없음). `@anthropic-ai/sdk`는 4개 라우트만.

## 변경
1. `next.config.ts` pdf.js: 전체 include 제거. 서버에서 PDF를 읽는 코드(`lib/curriculum-assets/pdf.ts`, `lib/universities/crawler.ts`)를 번들에 가진 7개 엔트리(`/admin`, `/admin/universities`, `/admin/students/*/roadmap`, `/consultant`, `/parent`, `/student`, `/teacher`, `/teacher/student/*/roadmap`)에만 워커 파일 1개를 명시 include. pdf.mjs 본체는 추적기가 이미 따라간다.
2. 워커를 `pdf.worker.mjs`(2.4 MB + 5.5 MB .map, include 시 .map까지 딸려옴) → `pdf.worker.min.mjs`(1.3 MB, .map 없음)로 교체. pdf.ts / crawler.ts의 `req.resolve` 경로 1줄씩 변경. 동작 동일(같은 pdf.js 의 minified 워커).
3. include 키를 `"/…/page"` 형태로 정확히 지정(Turbopack은 엔트리 경로 `/admin/page`와 contains 비교; `"/admin"`은 13개 라우트로 번짐).
4. `outputFileTracingExcludes["/**"]`: docs 이미지/sql/csv, docs/ap/screen-evidence, docs/assets, docs/qa, scripts, supabase, data의 이미지·html·jsonl, data/audit, explanation-en, rw-generation, ap/sample-2027, ap 하위 스크린샷 디렉터리, mock-exam-generation 중 figure-qa 이외 전부. **남긴 것**: docs/tickets.md(관리자 개발 로그), data/ap/stock·render-check/report.json·screen-evidence/*.json·curriculum-2027(AP 재고 패널), data/mock-exam-generation/figure-qa/*.json 과 lib/problem-generation/math-archetypes(그림 검수 해시).

## 전/후 (람다 79개 nft 기준, 압축 전 바이트, 라우트별 중복 포함 합계)
| | 전 | 후 |
|---|---|---|
| 합계 | 2,677 MB | 359 MB (-87%) |
| 중앙값 | 16.1 MB | 2.3 MB |
| 일반 라우트(예: /set-password) | 16.1 MB | 2.5 MB |
| pdf 사용 페이지(/student 등) | 약 19 MB | 약 8.8 MB (pdf 청크 자체가 큼) |
| /admin | 829 MB | 131 MB |
| /admin/*, /api/admin/*, /auth/admin-* (14개) | 약 57 MB | 2~6 MB |

## 검증
- `next build` 성공, `tsc --noEmit` 오류 없음.
- vitest unit(`lib/curriculum-assets`, `lib/universities`, `lib/ap-admin`): 182 테스트 통과. 실패 2개 파일(assemble-bio/csa-draft)은 로컬 python `numpy` 부재(HiGHS)로 변경과 무관.
- `/teacher` trace에 적힌 파일만 별도 폴더에 복사(11 MB, 심볼릭 제외)해 pdf.mjs + pdf.worker.min.mjs 로 PDF 파싱: 페이지 수·텍스트 추출 성공 -> include 한 두 파일만으로 해결됨.
- `/admin` trace에 docs/tickets.md, data/ap/stock(defect-scan·assembled), render-check/report.json, curriculum-2027, figure-qa(606), coverage-gate-report.json 모두 포함 확인.
- `next start`: `/`, `/login`, `/terms` 200, `/admin`·`/teacher`·`/student` 로그인 리다이렉트(307).
- **미검증**: 인증이 필요한 관리자 화면에서 실제 PDF 업로드·AP 재고 패널 클릭(공유 DB 미사용 원칙). Preview 배포 후 확인 필요.

## 남은 위험
- Turbopack의 `outputFileTracingExcludes`는 `node_modules` 경로 제외가 적용되지 않음(실측). 그래서 워커를 `.min`으로 바꿔 우회. 새 서버측 의존성이 `.map` 등을 끌어오면 직접 확인 필요.
- 새 `process.cwd()` + 동적 경로 fs 읽기는 다시 디렉터리 전체 추적을 유발한다. 빌드 후 `.next/server/app/**/*.nft.json` 크기를 확인하거나 excludes에 걸러낼 디렉터리를 추가할 것.
- `/admin`은 data/ap/stock 약 64 MB 때문에 여전히 131 MB(압축 후 약 20 MB 내외 추정). 더 줄이려면 재고 JSON을 Supabase Storage/DB로 이전하거나 패널이 읽는 필드만 담은 요약 JSON으로 교체.
- include 키 `"/student/page"` 등은 contains 매칭이라 `/signup/student` 에도 걸려 1.3 MB가 추가됨(무해).
- Vercel의 람다 압축 크기/개수는 로컬에서 재현 불가(`vercel build` 미실행). 배포 후 `vercel inspect`로 확인.
- 람다 통합 옵션은 App Router에 없음(라우트별 1람다). 개수는 줄지 않고 크기만 감소.

## 권장 Vercel 프로젝트 설정
- Settings > General > **Deployment Retention**: Preview 30일 이하(권장 7~14일), Production 유지 개수/기간 단축. 보존 기간이 지난 배포는 Function Storage에서 해제됨.
- 오래된 Preview 배포 수동 삭제(Deployments 목록 또는 `vercel remove`) — 이번 정리로 가장 빠르게 용량이 확보됨.
- Settings > Git: 사용하지 않는 브랜치의 Preview 자동 배포 끄기(Ignored Build Step 또는 "Preview 배포는 특정 브랜치만").
- 동일 커밋 재배포/수동 `vercel deploy` 남발 자제. 필요 시 `vercel deploy --prebuilt` 대신 Git 통합 하나로 통일.
- Hobby 크론은 하루 1회 초과 시 배포 실패(MEMORY 참고) — 크론 표현식 확인.

## 2026-10-15 추가: /admin 99.3 MB -> 37.5 MB (.nft 중복 제거 실측)
앞 표의 131 MB 는 nft 목록의 중복 경로를 두 번 센 값이다. 같은 방법으로 다시 재면 이번 작업 전 /admin 은 **99.3 MB**(data/ap/stock 36.5 + screen-evidence 10.0 + render-check 2.1 등), 이후 **37.5 MB**. 전체 79개 람다 합계 274 MB.
- 재고 JSON(원본 약 49 MB)을 `.json.gz`(약 6 MB)로 보낸다. `scripts/pack-ap-data.cjs` 가 빌드 때 만들고(`npm run build`·`next build` 모두; .gitignore), `lib/ap-generation/data-fs.ts`(readFileSync·existsSync·readdirSync 대체)가 **원본이 없을 때만** .gz 를 읽는다 → 로컬·스크립트 동작은 그대로. /admin 추적에서는 원본 JSON·public/**·app/admin 소스·docs/*.md(tickets.md 만 includes)·테스트 파일(figure-qa-snapshot.test.ts 만 includes — figure-qa-hash.ts 가 해시에 넣는다)을 뺀다.
- 새 AP 재고 읽기 코드는 `node:fs` 대신 `lib/ap-generation/data-fs` 를 import 해야 /admin 에서 동작한다(원본이 번들에 없다). 그렇지 않으면 배포에서만 ENOENT.
- 검증: `scripts/dev/admin-data-parity.ts` 를 저장소와 .gz 만 있는 폴더에서 각각 실행해 22개 섹션(배치 레지스트리·적재 항목·배정 보고서·스왑 계획·12개 과목 풀) 해시가 동일함을 확인. `scripts/dev/admin-ap-smoke.ts` 를 .gz 전용 폴더에서 격리 스택에 실행해 적재(import→render→screen→convert)·load check·batch status·초안 세트 저장·새 버전 미리보기/초안·launch gate 통과. PDF 는 `scripts/verify-pdf-trace.ts`(빌드 후)로 7개 PDF 라우트의 .nft 파일만 복사한 폴더에서 pdf.worker.min.mjs 를 찾아 2쪽 PDF 의 쪽수·텍스트를 읽음.
