# My Notebook (학생 포털 오답노트 개편) — 설계 메모 2026-10-08

**사용자·흐름.** 학생(무료 회원 포함)이 사이드바 "My Notebook"을 연다. 상단 서브탭 `All` / `My Notebook` / `Mistake Notebook`.
`Mistake Notebook` = 채점 결과가 오답·부분 정답인 문제(모의고사·수업·과제). `My Notebook` = 학생이 "문제 저장"으로 직접 담은 문제 중 오답이 아닌 것(두 서브탭은 겹치지 않고 `All` = 합집합).
폴더 칩(All / Unfiled / 폴더들)으로 개인 폴더를 고른다. 폴더 만들기·이름 바꾸기·삭제, 문제의 폴더 이동/해제는 문제 카드 안에서. 폴더를 지워도 문제는 삭제되지 않고 Unfiled로 돌아간다.
오른쪽 정렬 필터 묶음: Section(R&W/Math) → Main category(SAT domain) → Sub-category(skill). 학생이 가진 문제에 실제로 있는 값만 보이고, 상위를 바꾸면 하위는 초기화된다. `Clear`로 한 번에 해제. 기존 Grade/Format 필터는 제거(Source 필터는 유지). 문제별 해설·재풀이 동작은 그대로.

**데이터·RLS.** 문제 자체(수업/과제/모의고사 저장 상태)는 기존 원본을 그대로 쓴다(새 원본 없음).
- `student_notebook_folders(id, student_id, name, is_default, position, created_at)` — unique(student_id, lower(name)), 학생당 기본 폴더 1개(부분 유니크), 폴더 30개 상한 트리거.
- `student_notebook_assignments(student_id, problem_key, folder_id)` — PK(student_id, problem_key). `problem_key`는 노트 항목 ID(`workId`: work uuid, `hw:<batch>:<problem>`, `mock:<attempt>:<item>`). 원본이 서로 달라 FK 없음. `folder_id` FK는 on delete cascade → 폴더 삭제 시 배정 행만 지워져 문제는 Unfiled.
- RLS: 본인 학생 + 관리자만 조회·쓰기. 기존 노트북도 학생 본인 화면에서만 노출되므로(교사·보호자 화면 없음) 같은 가시성. 배정은 본인 소유 폴더에만 가능(WITH CHECK). 기본 폴더는 직접 INSERT 불가, `ensure_default_notebook_folder()`(security definer)만 생성, 이름 변경·삭제 불가.

**UI 상태.** 로딩: 목록 스켈레톤. 빈 상태: 서브탭/폴더/필터 조합별 안내 문구. 오류: 폴더 작업 실패 시 인라인 `role="alert"`, 낙관적 갱신은 롤백. 모바일: 필터 묶음은 줄바꿈(오른쪽 정렬 → 좁은 폭에서는 전체 폭), 폴더 칩 가로 스크롤 없이 wrap, 이동·이름 변경은 `<select>`/인라인 `<input>`(Enter 저장·Esc 취소)로 키보드·터치 모두 가능. 폴더 삭제는 확인 단계 1회.
