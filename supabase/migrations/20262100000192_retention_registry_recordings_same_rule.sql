-- Retention registry wording after the 2026-10-07 directive: video/audio recordings (if ever offered), transcripts and AI
-- notes/summaries are the SAME rule: eligible for deletion one year after the end date of each lesson or consultation, not
-- extended by continued enrolment or re-enrolment. Recordings stay "no_feature" (nothing is recorded today); when the feature
-- exists its artifacts plug into the same retention_deletion_targets queue, and the DB row is never deleted before the
-- external-storage file linkage has been handled (failures are tracked and retried by the existing worker).
update retention_policies
   set description = '수업·상담 전사, AI 노트·요약(Smart Notes) — Drive 산출물',
       start_event = '각 수업 또는 상담 종료일(현재 구현: 수업 sessions.actual_end_at)',
       legal_note = '수강 지속·재수강으로 연장하지 않음. Drive 삭제 큐 경유, 파일 삭제 성공 후에만 DB 행 정리. 상담 Smart Notes 산출물은 기능이 생기면 같은 큐에 연결'
 where class_key = 'lesson_ai_artifacts';

update retention_policies
   set description = '수업·상담 영상·음성 녹화(제공 시) — 전사·Smart Notes와 같은 규칙의 산출물 유형(video_recording, audio_recording)',
       start_event = '각 수업 또는 상담 종료일',
       legal_note = '현재 녹화 기능 없음(등록만). 기능 추가 시 같은 retention_deletion_targets 큐(category=lesson_recording)에 연결, 외부 저장소 삭제 실패는 추적·재시도, 파일 연결 처리 전 DB 행 삭제 금지. 활성화 전 해당 동의 확인(recording gate)'
 where class_key = 'lesson_recordings';
