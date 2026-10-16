# 대학 진학 DB Part 3 — 학교 상세 화면 확장 범위 (2026-09-19)

제품 오너가 CollegeVine 학교 상세 페이지 스크린샷을 참고 자료로 제시하며, 현재
`universities` / `university_admission_cycles` 스키마(Part 2, 이미 병합됨)로는
빠진 항목을 다음 라운드에서 채우라고 지시함. **확률/Chancing 계산은 제외** —
그 외 정보 항목만 반영한다.

## 이미 있는 것 (Part 2, `20261421000000_college_db_p2_universities_foundation.sql`)

시험 정책·점수 25/75분위, GPA 25/75/평균, 지원 일정(ED/EA/RD), 서류 요건(에세이
수/추천서 수/포트폴리오/인터뷰), acceptance_rate, CDS 요소 비중(jsonb).

## 추가 필요 (Part 3, 다음 마이그레이션)

CollegeVine 학교 상세 탭 구조를 참고한 항목:

1. **전공 목록(Majors 탭)**: 학교별 제공 전공 리스트, 카테고리 그룹(Art/Business/
   Health/Humanities/Law and Politics/STEM/Social Science 등)까지는 필요 없고
   전공명 + 대분류 정도만. 신규 테이블 `university_majors(university_id, name,
   category)` 검토.
2. **비용과 장학금(Cost & scholarships 탭)**: in-state/out-of-state 총비용,
   Pell grant 수혜 비율, merit scholarship 유무(자유 텍스트), 연방 학자금 대출
   수혜 비율/평균액. `university_admission_cycles`에 컬럼 추가(연도별 가변값이므로
   Part 2의 사이클 테이블이 맞는 위치).
3. **재학생·학사 통계(Academics/Students 섹션)**: 신입생 수, 4년/6년 졸업률,
   재학 유지율(retention), 학생 대 교수 비율, 성비, 인종·민족 다양성 비율,
   국제학생 비율, 학사력(quarter/semester). 이것도 연도별로 바뀔 수 있으므로
   `university_admission_cycles`에 추가하거나 별도 `university_stats` 테이블로
   분리 — 다음 설계 시 결정.
4. **입시 지원자 통계**: 총 지원자 수, 성별 지원자·합격자 비율, yield rate(등록률).

## 의도적으로 제외

- CollegeVine의 "Your chances: N%", "Reach/Target/Safety" 자동 분류, Profile
  simulator(GPA/SAT 슬라이더로 확률 재계산) — 로드맵 정책상 합격 가능성 예측은
  금지.
- "Similar schools" 추천 알고리즘, "Request to connect"(대학 관계자 연결) 기능 —
  V1 범위 밖.

## 다음 단계

이 문서는 결정 기록이며 착수 지시가 아니다. 실제 구현은 이 브랜치(또는 후속
college-db 세션)에서 위 "새 기능 착수 전 1장 정리" 형식으로 데이터 소스(어느
필드를 어떤 사이트에서 가져올지, 200개교 전체 재조사 필요 여부)와 마이그레이션
범위를 확정한 뒤 진행한다.
