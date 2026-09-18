# 대학 입시요강 데이터베이스 — Part 1 (미국 대학 목록 + 소스 레지스트리)

작성일: 2026-09-19 · 작업 브랜치: `feature/college-admissions-data` (연구/문서 전용, 코드/DB/배포 변경 없음)

## 1. 사용한 랭킹 기준

- U.S. News & World Report **"Best National Universities" 2024 edition**(2023년 9월 발표, 2024학년도 기준)을 주 기준으로 삼았다.
- 이 세션에는 라이브 웹 접근(WebSearch/WebFetch)이 제공되어 상위권 일부는 실시간으로 재확인했지만, USNWR 전체 표(약 400개 대학의 정확한 번호)를 이 세션에서 페이지 단위로 통째로 긁어오지는 않았다 — 유료/저작권 랭킹 콘텐츠 스크래핑 금지 지침에 따라, 학습 데이터 기반 지식 + 공식 대학(.edu) 소스 확인만 사용했다.
- **결과적으로 순번은 "정확한 2024 공식 순위 번호"가 아니라 근사치다.** 아래 3번 항목에서 신뢰도 구간을 명시한다.

## 2. 최종 스코프: 400 → 실제 306개

- 최초 요청은 top 200 → top 500 → 최종 top 400으로 조정되었다.
- USNWR은 실제로 National Universities 카테고리 내에서도 약 390~440개 선까지만 고유 번호(동점 포함)를 매기고, 그 이후는 "Unranked"로 분류한다. 이는 코디네이터가 지적한 대로다.
- 그런데 이번 산출물의 실제 병목은 USNWR의 공식 컷오프가 아니라 **이 세션(학습 데이터)의 신뢰 가능한 개별 대학 식별 한계**였다. 실제로 이름·도시·주·공사립 구분까지 합리적으로 자신 있게 나열할 수 있었던 학교는 **306개**였고, 400개를 채우기 위해 순위나 학교명을 지어내지 않았다.
- 즉 파일명은 `top400-...csv`이지만 실제 행 수는 306개다. 400 – 306 = 94개는 **채우지 않고 공란으로 남김** (사용자 지시대로 "부풀리지 않음").

## 3. 순위 신뢰도 구간 (CSV의 `rank_confidence` 컬럼과 동일)

| 구간 | 학교 수(대략) | 신뢰도 | 설명 |
|---|---|---|---|
| 1–100 | 100 | 높음(학습데이터 기반, 라이브 미검증) | 개별 순위·동점 구조까지 비교적 확신 있음. 다만 이 세션에서 100개 전부를 라이브 재확인하지는 않았음. |
| 101–150 | ~55 | 중간 | 정확한 순번보다는 "이 범위 근처"라는 확신. 학교명 자체는 비교적 확실. |
| 150–199 | ~65 | 낮음 | `rank_approx=140`으로 동일 값을 부여한 하나의 큰 묶음 — 실제 USNWR에 이 정도 규모의 동점 그룹이 존재한다는 뜻이 아니라, "대략 이 구간대 국공립/사립 종합대"라는 근사 표기다. |
| 200+ | ~86 | 매우 낮음 | `rank_approx=200`으로 동일 표기. 이 구간은 학교명 나열 자체의 정확도(오탈자·폐교·통합 여부)도 낮고, 일부(예: 온라인/영리 목적 대학 일부)는 USNWR National Universities 카테고리가 아니라 Regional University나 별도 카테고리로 분류될 수도 있어 **카테고리 적합성 자체가 불확실**하다. |

**결론: 순번(`rank_approx`)은 참고용 근사치이며, 실제 서비스에 반영하기 전 반드시 USNWR 공식 사이트에서 재확인이 필요하다.** 100위 밖으로 갈수록 신뢰도가 급격히 떨어진다는 점을 개발자/기획자 모두 인지해야 한다.

## 4. URL 검증 현황

- 이 세션은 WebSearch 도구를 사용할 수 있었다 (WebFetch도 로드됨, 이번엔 WebSearch만 사용).
- **라이브로 실제 검증한 학교: 5곳** (Princeton, MIT, Harvard, Stanford, Yale) — 각 학교의 공식 Admissions 홈페이지, Common Data Set(또는 이에 준하는 Institutional Research 공개 페이지), 학사요람/전공 페이지, 마감일 페이지 URL을 WebSearch로 확인해 CSV에 반영했다(`url_verification_status = "라이브 검증(2026-09-19, WebSearch)"`).
- **나머지 301개 학교의 4개 URL 컬럼은 전부 `"미검증(추정)"`으로 채워져 있다** — 즉 이번 산출물은 URL 값을 채워 넣지 않고, "URL을 찾아야 한다"는 사실과 검증 상태 플래그만 정직하게 표시했다. 학교별 실제 URL을 학습 지식만으로 나열하면 도메인 오탈자·페이지 개편으로 틀린 링크를 자신 있게 제시하는 위험이 크다고 판단해, Part 2(개발자가 학교별 상세 데이터를 수집하는 단계)에서 학교마다 실제로 WebSearch/WebFetch로 확인하며 채우도록 비워두었다.
- CDS 링크는 학교마다 호스팅 구조가 다르다(Institutional Research 부서 도메인, Registrar, Provost office 등 제각각) — 검증한 5개 학교에서도 이미 `ir.<school>.edu`, `oir.<school>.edu`, `irds.<school>.edu` 등 패턴이 전부 달랐다. 이는 "학교명 + common data set 페이지 URL 패턴을 일반화할 수 없다"는 근거이며, Part 2 보고서에도 반영했다.

## 5. 파일

- `docs/2026-09-19-top400-us-universities-source-registry.csv` — 306행, 컬럼: `rank_approx, school_name, city, state, public_private, admissions_homepage_url, common_data_set_url, catalog_programs_url, deadlines_url, url_verification_status, rank_confidence`
- 본 보고서: `docs/2026-09-19-college-database-part1-report.md`

## 6. Part 2(학교별 상세 입시요강 수집)를 위한 다음 단계 가이드

1. **소스 URL 채우기가 최우선.** 이 레지스트리의 4개 URL 컬럼은 대부분 비어 있다(미검증 표시). 학교 단위로 실제 WebSearch/WebFetch를 이용해 (a) undergraduate admissions 홈페이지, (b) Common Data Set 페이지, (c) catalog/전공 페이지, (d) 마감일 페이지를 하나씩 채우고 `url_verification_status`를 갱신하는 배치 작업이 먼저다.
2. **순위 재검증.** `rank_approx`는 근사치이므로, 서비스에 순위를 노출하려면 USNWR 공식 사이트(또는 라이선스 데이터)에서 최신 edition 기준으로 재확인해야 한다. 특히 100위 밖은 통째로 재작업이 필요할 수 있다.
3. **200위 이후 구간은 카테고리 재검증 필요.** 일부 학교(온라인/영리 대학 등)가 실제로 National Universities 카테고리에 속하는지부터 재확인. 아니라면 리스트에서 제외.
4. **Part 2에서 수집할 필드**(이번 레지스트리는 다루지 않음): 테스트 정책(test-optional/required), GPA 분포, 지원 마감일 상세(ED/EA/RD), 에세이 요건, 국제학생 특이사항 등 — 각 학교의 CDS(주로 C 섹션·표 10)와 admissions 페이지를 소스로 사용.
5. **동시성/중복 방지**: 학교명을 유니크 키로 쓰되, 동일 학교의 캠퍼스 분교(예: UC 계열, Texas A&M 계열, SUNY 계열)를 별도 행으로 유지할지 통합할지 Part 2 착수 전에 정책으로 확정할 것 — 현재 레지스트리는 분교를 별도 행으로 나열했다.

## 7. 확인 사항 요약

- (a) 랭킹 edition: U.S. News "Best National Universities" 2024 edition (근사 기준, 이번 세션에서 전체 재확인 안 함)
- (b) 306/400 — 실제 신뢰 가능한 개별 학교 306개 확보, 94개는 채우지 않음(부풀리지 않음)
- (c) 라이브 검증 URL: 5개 학교 × 4개 URL = 20개 링크. 나머지는 전부 "미검증(추정)"
- (d) 파일: 위 5번 항목 참고. 커밋 해시는 커밋 후 별도 보고.
- (e) 사용 도구: WebSearch 사용(가능했음). WebFetch도 로드는 했으나 이번엔 WebSearch만으로 충분해 실제 호출은 안 함.
- (f) 이 저장소의 다른 파일(앱 코드, DB, 배포 설정)은 전혀 건드리지 않았다.
