# 오너 확정 결정 — 채팅에서 생긴 정정·예외·번복만 (정책 전체는 복제하지 않음)

우선순위: 계약·법적 문서 > 이 대장의 최신 정정 > CURRENT.md > 로드맵 > 코드(구현 결과일 뿐 정책 출처 아님).
줄 형식: 결정 — 출처 — guard: 테스트(없으면 "리뷰"). 출처 불명은 `확인 필요`. 번복은 줄 끝에 "폐기 날짜".
가드 테스트는 결제·동의·권한·개인정보·언어 노출처럼 코드로 확인 가능한 것만. 문구 뉘앙스·운영 방식은 PR 리뷰 항목.

- 동의는 4개만: 가입·비번설정 약관/개인정보 체크, 13세 미만 보호자 동의, 계약서 서명, 랜딩 상담 폼 개인정보 동의. 나머지 제거 — 09-28, 10-06 채팅 정정 — guard: app/ConsultForm.test.tsx(상담 폼분)
- Smart Notes = 계약서 필수 조항(선택·별도 동의 없음). 계약서 자동발송 기본 ON, 관리자 토글 — 10-05 채팅 — guard: lib/contract-dispatch-toggle-rls.integration.test.ts(토글분)
- 보호자는 개별 답안 열람 가능, 개인 노트·화이트보드 불가 — 10-05 채팅 — guard: lib/problem-note-strokes.integration.test.ts
- 무료 회원: 자가가입 → 모의고사·단어·오답노트 → 상담 → 보호자 초대 → 예약 → 같은 계정이 수업 전환. 모의고사·공개 자료 전부 무료 — 10-05 채팅 — guard: free-member 통합 테스트
- "50 Free SAT & AP Practice Tests", AP 문구 그대로, 안전장치 추가 금지 — 10-05 채팅 — guard: 리뷰
- 회사명 Alton Education LLC, 이메일 official@alton.education, 원장 Chrisy Kim 15년 — 10-05/06 채팅 — guard: 리뷰
- 관리자 포털 제외 전부 영어(미국 타겟). 해설은 영어 기본+한국어 토글 — 10-05 채팅 — guard: lib/no-implicit-timezone-format.test.ts(날짜분), 나머지 리뷰
- 범위 축소·제약은 조용히 하지 말고 먼저 묻기. UAT·구글 로그인은 Claude가 진행 — 10-06 채팅 — guard: 리뷰
- 13세 미만 가입 경로는 시스템상 존재(보호자 동의 별도 수집 유지), 운영상 거의 허용하지 않음. 나이·학년 일괄 가입 차단 추가 금지 — 10-06 채팅 확정 — guard: 없음(보호자 동의 게이트는 app/parent/consent-actions.test.ts)
- 계약서·약관·고객 서비스 전부 영어. 회사 소재지 California 기준으로 하되 미국 전역·한국 등 해외 수강을 고려. 계약 문안은 기획자 작업본 기준, 실제 발송 전 승인 — 10-06 채팅 확정 — guard: 리뷰
- 기존 계약자·고객 없음(재동의·변경합의서 불필요). 수업별 동의 확인 단계는 폐지·추가 금지 — 동의는 계약서 서명으로만 — 10-06 채팅 — guard: 리뷰
- 녹화·VOD는 계획에서 제외(백로그 삭제). 계약서·약관엔 동의 문안만 존재, 화면 녹화는 별도 언급 안 함 — 10-06 채팅 — guard: 리뷰
- 13세 미만: 가입 화면은 13세 이상만, 13세 미만은 보호자 상담 요청 경로(운영상 거의 미허용). 회사 통지 주소 Sunnyvale·서명자 Do Kyung Kim/CEO 확정 — 10-06 채팅 — guard: 리뷰
- 선생님·컨설턴트 정산은 월 2회 지급(1~15일분→같은 달 26일, 16일~말일분→다음 달 10일; 종전 20일/5일은 폐기), 기간·지급일은 회사 시간대 America/Los_Angeles 기준(코드 단일 상수 COMPANY_TIME_ZONE), 해외 송금 수수료는 회사 부담, 선생님 계약 종료 통지 30일 — 10-06 채팅 — guard: 정산 일정 단위 테스트
- 예약 시점 Smart Notes 거부 DB 함수는 정리(삭제) — 10-06 채팅 — guard: 없음
- 보관기간은 하나로 통일(기존 시스템 정책 기준): 계약·결제·정산 7년, 출결·학습 이력 3년, 녹화·전사·AI 미팅록·수업자료 1년(마지막 수업 후), 채팅·상담 2년, 보안 로그 1년, 알림 90일, 폐쇄 유예 30일·백업 35일 — 10-06 채팅(추천안+기존 v3 정책 대조) — guard: retention 배치 테스트
- 정산 기간·지급일은 회사 시간대(America/Los_Angeles) 기준 — 10-06 채팅 — guard: 정산 일정 단위 테스트
- 지급일이 주말·미국 연방 은행 휴일이면 직전 영업일 지급(휴일 표 2026–2030, 이후 연장 필요) — 10-06 권장안 적용 — guard: lib/payout/payout-schedule.test.ts
- 선생님 정산 지급 기한: 1~15일분은 당월 26일, 16일~말일분은 다음 달 10일(주말·미국 연방 은행휴일이면 직전 영업일, America/Los_Angeles). 송금·환전 수수료 회사 부담, 종료 통지 30일 — 10-06 채팅(기획자 기준 반영) — guard: lib/payout/payout-schedule.test.ts
- 계약 보관 파일명 {contract_type}_{contract_id}_{version}_{signed_date}.pdf(이름·이메일·생년월일·계좌 금지), 폴더에 서명본+DocuSign 완료 증명서+변경합의서, 원본 덮어쓰기 금지, 중복 업로드 방지·재시도 — 10-06 기획자 기준 — guard: lib/drive 테스트
- 지급 예정일 변경(관리자): 사유 필수, 과거 날짜 차단, 송금 처리 중·완료는 변경 금지, 주말·휴일은 직전 영업일 제안 후 확인, 법정 기한 초과 차단, 변경 이력 기록·선생님 알림 — 10-06 기획자 기준(오너 위임) — guard: 정산 통합 테스트
- 선생님 계약서 미서명이어도 수업 배정은 막지 않음(나중에 운영 보며 결정). 해외 선생님 수업 외 업무 보수는 해당 선생님의 시급과 연동 — 10-06 채팅 — guard: 리뷰
- 모든 선생님(한국·캘리포니아·그 외 미국)은 독립 계약자(프리랜서) 계약. 한국=원화 시급, 미국=달러 시급, 모두 시스템 시급 연동. 캘리포니아 고용계약 양식은 기본 미사용 보관 — 10-06 채팅 — guard: lib/teacher-agreements 양식 선택 테스트
- 지급 기한(26일·10일) 준수 기준은 지급 완료 시점. 송금 요청은 기한보다 영업일 기준 앞당겨 실행(기본 3영업일, 설정값) — 10-06 채팅 — guard: lib/payout/payout-schedule.test.ts
- 수취 계좌(교사·컨설턴트): 결제 수단은 은행 송금뿐. 본인은 첫 로그인 뒤 최초 1회만 등록(이후 읽기 전용·마스킹), 변경은 정산권한·마스터가 대신 입력(이력+본인 영문 알림), 전체 번호는 정산권한·마스터가 감사되는 '전체 번호 보기'로만 열람, 번호는 암호화 저장 — 10-06 채팅(종전 "관리자도 마스킹만" 정책 폐기) — guard: lib/payout/*-payout-account.integration.test.ts
- 지급 기한 위험 경보는 화면·감사 로그까지만, 송금 요청 앞당김 N=3영업일(USD ACH; KRW는 한·미 공통 영업일 기준 N=5, 첫 지급 실측 뒤 재조정), 기한 지난 뒤 승인된 묶음은 선생님에게 지연 안내 알림 기록 — 10-06 채팅(권장안 3건 승인) — guard: lib/payout 통합 테스트
- 선생님 지급 방식은 계좌 이체 하나. 수취 계좌는 선생님이 첫 로그인 후 한 번 입력하고 이후 읽기 전용, 변경은 관리자만(변경 시 선생님에게 알림·이력 기록). 정산 권한자는 수동 송금을 위해 전체 계좌·라우팅 번호 조회 가능(조회마다 감사 기록) — 기존 "관리자는 마스킹만" 정책 폐기 — 10-06 채팅 — guard: 계좌 조회 감사·권한·선생님 수정 차단 테스트
- 컨설턴트도 선생님과 동일: 수취 계좌는 첫 로그인 후 1회 입력→읽기 전용→변경은 관리자만(알림·이력), 정산 권한자 전체 번호 조회(감사). 컨설턴트 계약서 필요(문안은 기획자, 발송 경로는 선생님 계약 경로 재사용) — 10-06 채팅 — guard: 계좌 권한 테스트
- 수취 계좌 전체 번호 보기는 사유 필수(5자 이상, 감사 행에 저장), USD는 ABA 라우팅 체크섬 검증, 암호화 키는 Supabase Vault만(Vault를 보장할 수 없는 환경이면 마이그레이션 112가 중단되고 키를 설정값·환경변수로 대체하지 않는다) — 10-06 채팅 — guard: lib/payout/*-payout-account.integration.test.ts, account-validation.test.ts
- 전체 테스트는 마일스톤 종료 시 새 DB 1회만(중간 병합은 대상 테스트·tsc). 3회 반복은 프로덕션 배포 직전에만 — 10-07 채팅 — guard: 리뷰
- 계약서 회사 서명자 직함은 Member(Do Kyung Kim, Member) — 구성원 관리 LLC. 회사: Alton Education LLC, California LLC, 등기 주소 1055 Stewart Drive Apt 537 Sunnyvale CA 94085, 법인 설립 완료(10-05)·Mercury 계좌 개설 — 10-07 채팅 — guard: lib/contracts 테스트
- 첫 상담 AI 회의록(Smart Notes)은 상담 신청 시 기존 개인정보 동의 체크박스 1개(문구 확장: 개인정보 수집·이용 + 첫 상담 AI 회의록, 관리자 전용 열람, 상담 종료 +1년 삭제 대상, 영상·음성 녹화·보관 전사 없음, 13세 미만은 보호자 동의)로 갈음. 동의 문구 버전·시각을 consultations.ai_notes_consent_version/at에 저장하고, 그 값이 있을 때만 생성·연결 — 10-07 오너 결정(이전 "현행 유지" 줄 대체) — guard: lib/consultation/calendar-sync.test.ts, app/api/webhooks/workspace-events/route.test.ts, app/ConsultForm.test.tsx
- 체험 수업은 계약 서명 후에도 녹화·전사·AI 노트 전부 제외. 첫 상담은 영상·음성 녹화와 보관 전사 제외(AI 노트만 위 동의로). 녹화 게이트(lib/legal/recording-gate.ts)의 범위는 정규 수업·후속 상담 — 10-07 오너 결정 — guard: lib/legal/recording-gate.test.ts, lib/legal/legal-documents.test.ts
- 첫 상담 동의: 일정 링크 체크박스는 필수 유지, 보호자 포털에는 첫 상담(consultations) 신청 경로가 없어 체크박스 불필요(포털 상담 신청은 후속 상담 meeting_requests, 향후 첫 상담 경로를 만들면 같은 문구 필수) — 10-07 오너 결정 — guard: app/schedule
- 교사·컨설턴트 지급은 Mercury(미국 USD=ACH 기본·예외는 관리자 사유 기록, 한국 KRW=Mercury 국제송금)로 하고 Wise 계획은 폐기. 회계는 Mercury Books(Stripe는 Books 공식 연결로만 연동, ALTON이 중복 기록하지 않음). 정산 승인→Mercury 지급→결과 확인→Books 대사 순서, ALTON은 회계 프로그램이 아니라 정산 보조원장만 보유. 이 지급·회계 관리자 화면은 영어 — 10-07 채팅 — guard: lib/payout/payout-attempts.integration.test.ts, lib/payout/providers/mercury.test.ts
- KRW 정산 금액을 USD로 임의 환산해 API로 보내지 않는다(Mercury API 문서상 USD 금액만 정의). KRW는 ALTON 승인 → 입력표 → 관리자가 Mercury 화면에서 KRW 송금 → ALTON에 거래 ID 연결. Mercury의 sent/processed는 수취 확인이 아니며 증빙과 함께 receipt_confirmed를 기록해야 지급 완료. 첫 한국 지급 전에는 실제 수취액·수수료·소요 시간 미확인(문구에서 "전액 KRW 수령" 단정 금지) — 10-07 채팅 — guard: lib/payout/attempts.test.ts, payout-attempts.integration.test.ts
- Mercury 지급: KRW 선행 5영업일 확정, 수취 확인 단계 폐지(Mercury 거래 sent/completed=지급 완료, 반환 시에만 기록), 정산·지급 승인은 마스터 1명이 모두 수행(직무 분리 해제, 감사 기록 유지, 설정으로 복원 가능), 한국 은행 휴일 2026~2030 공식 월력요항 대조 입력, 자동 송금 크론은 닫아 둠 — 10-07 오너 결정 — guard: lib/payout/payout-attempts.integration.test.ts
- 문항 1,019건(부족 칸 보충 140+그림 유형 879) 비프로덕션 임포트와 초안 세트 4개 저장 승인 — 10-07 오너 승인 — guard: 임포트 감사 스크립트
- 모의고사 세트는 당분간 전부 free 공개 범위(tutoring 전용 세트 없음) — 10-07 오너 결정(튜터링 세트 질문에 '일단 다 프리로') — guard: 리뷰
