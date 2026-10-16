# 프롬프트 01 — 데이터 스키마 설계 (사람 검토 필수 단계)

> **문서 상태: 실행 금지·초기 구축 이력.** 이 프롬프트가 만든 `schema-draft.md`는 v3로 폐기됐다. 신규 스키마 작업은 `../2026-08-29-r0-approval-and-technical-validation-package.md`의 Gate B 제출부터 시작한다.

**중요**: 이 단계는 코드를 짜기 전에 반드시 사람이 스키마를 직접 읽고 승인해야 한다. 여기서 잘못 정하면 이후 모든 티켓에 영향을 준다.

## Claude Code에 붙여넣을 프롬프트

```
docs/spec/mockups/ 안의 HTML 파일 7개를 전부 열어서, 각 파일의 <script> 안에 있는 하드코딩된 데이터 구조를 전부 찾아줘. 예를 들면 CURRICULUM_DOCS_T, MY_SUBJECTS_T, STUDENT_PROBLEM_LOG, ASSIGNMENTS, SCHEDULE_T, CATALOG_SUBJECTS_T, STUDENT_VOCAB_S 같은 것들이야. 이런 게 있으면 다 나열해줘.

그걸 바탕으로 실제 Postgres(Supabase) 스키마 초안을 docs/spec/schema-draft.md 파일로 작성해줘. 형식은:

## 테이블명
- 필드명: 타입, 설명, (FK면 참조 테이블)
...
왜 이렇게 설계했는지 한 줄 설명

특히 이 부분을 신경써서 설계해줘:
1. "수업 세션"(session) 테이블은 반드시 student_id, teacher_id, subject, session_number(회차)로 유니크하게 식별되어야 해. 목업에서는 이게 잘 안 지켜져서, 세션마다 다른 데이터가 안 나오는 문제가 있었어.
2. "교재"(curriculum_docs)와 "세션"은 완전히 분리된 테이블이어야 해. 세션은 교재를 참조(FK)만 하지, 교재 내용을 복사해서 갖고 있으면 안 돼.
3. 과목 템플릿(subject_templates)이 다른 곳(교재 생성 폼 등)에서 참조하는 단일 진실 소스여야 해.

스키마 초안만 작성하고, 아직 마이그레이션 파일이나 코드는 만들지 마. 다 쓰고 나면 내가 검토할 수 있게 요약해서 알려줘.
```

## 완료 후 체크리스트 (사람이 직접 확인)
- [ ] `docs/spec/schema-draft.md`를 처음부터 끝까지 읽는다
- [ ] 빠진 테이블/필드가 없는지 목업과 대조 (특히 세션뷰의 문제기록/단어장/과제 구조)
- [ ] 세션-교재 분리가 제대로 되어 있는지 확인
- [ ] 이상하면 이 단계에서 계속 수정 요청 — 다음 단계로 넘어가지 않는다
