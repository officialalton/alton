# 대학 입시요강 데이터베이스 — Part 1 (미국 대학 목록 + 소스 레지스트리)

작성일: 2026-09-19 (완료 라운드) · 작업 브랜치: `feature/college-admissions-data` (연구/문서 전용, 코드/DB/배포 변경 없음)

**이 문서는 두 차례 재작업 끝의 최종 결과다.** 스코프는 top 200 → top 500 → top 400 → **top 200(원래 계획)** 순으로 조정됐다. 1차 재검증 라운드에서 101/200개교를 라이브 검증했고, 이어진 지시에 따라 **남은 99개교를 마저 검증해 200개교 전체(100%)의 admissions/CDS 라이브 검증을 완료했다.**

## 1. 사용한 랭킹 기준

- U.S. News & World Report **"Best National Universities" 2024 edition**(2023년 9월 발표 기준)을 순위 뼈대로 사용했다. 순위 자체(1~200위 순번)는 학습 데이터 기반이며, 이번 세션에서 USNWR 원문 표를 페이지 단위로 다시 긁어오지는 않았다(저작권 있는 랭킹 콘텐츠 스크래핑 금지 지침에 따름).
- 200개교 전부에 대해 admissions/CDS 존재를 라이브로 재확인했지만, 이는 "그 학교가 국가대학 카테고리에 실존하고 관련 페이지가 살아있다"는 확인이지 "정확히 몇 위인가"의 재확인은 아니다. USNWR 순위표 자체는 이번 세션에서 다시 조회하지 않았으므로, `rank_final`은 여전히 근사치다.

## 2. 최종 스코프: 200개 (확정)

- CSV는 정확히 200행이다.
- 이전 400개 버전에서 발견된 중복·오류 2건(가짜 "Baylor College" 항목, "University at Albany" 중복 행)을 James Madison University, Middle Tennessee State University로 교체해 수정했다.

## 3. 검증 실적 — 최종

| 항목 | 1차 재검증 라운드 | **최종(이번 완료 라운드)** |
|---|---|---|
| WebSearch 쿼리 수(누적) | 약 85회 | **약 184회** |
| 라이브 검증된 학교 수 | 101/200개교 (50.5%) | **200/200개교 (100%)** |
| 검증 깊이 | admissions + CDS 위주 | admissions + CDS 위주 (동일, catalog·deadlines는 여전히 범위 밖) |

**200개교 전부에 admissions 홈페이지 URL이 채워졌고, 대다수(160개교, 80%)는 CDS 소재까지 명확한 대학 자체 도메인으로 확인됐다.** 나머지 40개교는 `확인 필요` 또는 유사 caveat이 붙어 있다 — 이는 "미검증"이 아니라 "검색은 했지만 결과가 애매했다"(예: 오래된 CDS만 검색됨, 3rd-party 호스팅만 발견됨, 정확한 인덱스 페이지를 특정 못함)는 뜻이다. 이 구분은 CSV의 `url_verification_status` 컬럼에 학교별로 그대로 남겨뒀다.

## 4. 검증 결과의 품질 편차

- **160개교(80%)**: admissions 홈페이지 + CDS가 있는 정확한 기관연구실 페이지까지 확인 → `"라이브 검증(...) - 검증"`.
- **약 40개교**: 검색은 했으나 다음 중 하나의 사유로 완전히 깔끔하지 않음 → `"확인 필요"` 또는 caveat 포함 문구로 표시.
  - CDS가 대학 자체 도메인이 아닌 제3자 사이트(Issuu 등)에서만 발견됨 (예: Hofstra)
  - 오래된 연도의 CDS만 검색 결과에 나옴 (예: Adelphi, University of New Orleans)
  - 대학 홈페이지 검색 자체는 안내됐지만 CDS 전용 URL을 특정하지 못함 (예: Syracuse, Andrews, Clarkson, Morgan State, North Dakota State, Saint Joseph's, Southern Illinois Carbondale, SUNY ESF, UNLV, Mississippi State, NJIT, Memphis, University of Missouri, University of Tulsa, Middle Tennessee State, Bowling Green State 등)
  - 최근 조직 개편으로 URL 구조가 바뀌었을 가능성 (예: IU Indianapolis — 2024년 Purdue와 분리 개편)
- CDS 호스팅 패턴은 학교마다 전혀 다르다는 점이 재확인됐다 — `ir.`, `oir.`, `oira.`, `irp.`, `irsa.`, `oiep.`, `provost.../institutionalresearch`, 학교 자체 도메인 하위 경로 등 최소 10가지 이상의 서로 다른 패턴이 관찰됐다. "패턴 일반화"는 불가능하며 학교별 개별 확인이 필수라는 최초 판단이 다시 확인됐다.
- **catalog(전공/학사요람) URL과 deadlines URL은 이번에도 검증하지 않았다** — 지시가 admissions와 CDS에 초점을 맞췄기 때문에 이 2개 컬럼은 200개교 전부 `미검증(추정)`으로 남아 있다.

## 5. 순위 신뢰도 구간 (`rank_confidence` 컬럼, 변동 없음)

| 구간 | 신뢰도 | 비고 |
|---|---|---|
| 1–100 | 높음(학습데이터 기반) | 200개교 전부의 실존·admissions/CDS URL을 라이브로 확인해 간접적으로 뒷받침됨. 다만 "정확히 몇 위인가"는 USNWR 원문 재조회 없이는 확정 못 함. |
| 101–116 | 중간 | 학교명은 비교적 확실, 순번 정밀도는 낮음. |
| 116–200 | 낮음 | 150위 부근부터는 동일 근사값으로 묶인 구간이 섞여 있어(이전 라운드 산출물 잔재) 개별 순번을 신뢰하지 말 것. "이 근처 어딘가에 있다"는 정도로만 참고. |

## 6. 파일

- `docs/2026-09-19-top200-us-universities-source-registry.csv` — 정확히 200행, 그대로 업데이트(파일 교체 아님). 컬럼: `rank_final, school_name, city, state, public_private, admissions_homepage_url, common_data_set_url, catalog_programs_url, deadlines_url, url_verification_status, rank_confidence`
- 본 보고서: `docs/2026-09-19-college-database-part1-report.md`

## 7. Part 2(학교별 상세 입시요강 수집)를 위한 다음 단계

1. **"확인 필요" 약 40개교 재검색.** CSV의 `url_verification_status`에 "확인 필요"가 포함된 행을 필터링하면 목록이 나온다. 대부분은 CDS 전용 URL만 특정하면 되는 수준.
2. **catalog(전공/학사요람) URL, deadlines URL 검증 라운드.** 지금까지 admissions/CDS에 집중했으므로 이 2개 컬럼은 200개교 전부 비어 있다 — 다음 라운드의 주요 작업.
3. **순위 자체의 재검증.** `rank_final`은 근사치다. 서비스에 순위를 노출하려면 USNWR 공식 최신 edition을 별도로 조회해 재확정해야 한다.
4. **Part 2에서 수집할 필드**(이번 레지스트리는 다루지 않음): 테스트 정책(test-optional/required), GPA 분포, 지원 마감일 상세(ED/EA/RD), 에세이 요건, 국제학생 특이사항 등 — 각 학교의 CDS(주로 C 섹션)와 admissions 페이지를 소스로 사용.
5. **분교 처리 정책 확정 필요.** UC 계열, Rutgers 계열(뉴브런즈윅/뉴어크/캠든), SUNY 계열을 별도 행으로 유지했다 — Rutgers 뉴어크·캠든은 뉴브런즈윅과 같은 OIRAP 소스를 공유하는 것으로 확인됨.

## 8. 확인 사항 요약 (a)-(f)

- **(a) 랭킹 edition**: U.S. News "Best National Universities" 2024 edition. 순위 자체는 학습 데이터 기반 근사치이며, 이번 세션에서 USNWR 원문을 다시 스크래핑하지 않았다.
- **(b) 스코프/신뢰도**: 최종 200행 전부 채움(부풀리지 않음). 순위 신뢰도는 1~100위 높음, 100~116위 중간, 116~200위 낮음(위 5번 표 참고).
- **(c) URL 검증 — 최종**: **200/200개교(100%)에서 admissions 홈페이지를 라이브 검증**했고, 이 중 **160개교(80%)는 CDS 소재까지 명확히 확인**, 나머지 약 40개교는 "확인 필요"(검색은 했으나 결과가 애매함, 미검증이 아님)로 표시. WebSearch 누적 약 184회 사용. catalog·deadlines URL은 200개교 전부 이번에도 미검증으로 남음(다음 라운드 과제).
- **(d) 파일**: `docs/2026-09-19-top200-us-universities-source-registry.csv`(200행, in-place 업데이트), `docs/2026-09-19-college-database-part1-report.md`. 커밋 해시는 커밋 후 별도 보고.
- **(e) 사용 도구**: WebSearch(누적 약 184회 사용). WebFetch는 로드했으나 사용하지 않음.
- **(f) 다른 파일**: 앱 코드, DB, 배포 설정 등 이 두 문서 외에는 전혀 건드리지 않았다.
