# AI instruction + human coach 모델 조사

- 조사 기준일: 2026-08-30 (America/Los_Angeles)
- 목적: SAT·AP 교육에서 설명·연습·피드백은 AI/영상/자체 교재가 담당하고, 사람은 질의응답·마일스톤·동기·관계·책임관리를 담당하는 ALTON 대안 모델의 타당성 검토
- 출처 원칙: 회사 공식 사이트·공식 채용공고·공시·학술 논문 등 1차 출처만 사용했다. 회사가 공개한 성과 수치는 독립 검증값이 아니라 **회사의 자기 주장**으로 구분한다.

## 1. 결론

이 구조는 **말이 된다.** 더 정확히는 이미 세 가지 형태로 검증되고 있다.

1. **교육 전달 자동화:** Speak와 Duolingo는 설명·연습·즉시 피드백·대화 연습을 AI와 콘텐츠로 제공하며 대규모 유료 구독을 만들었다. Speak는 2024년 1,000만 학습자, Duolingo는 2025년 말 1,220만 유료 구독자를 공식 발표했다. [Speak 발표](https://www.speak.com/blog/series-b-3) [Duolingo 2025 10-K](https://investors.duolingo.com/static-files/f19d76fb-dee4-4f13-96ae-138ebfd0f2d3)
2. **AI 학업 + 인간 동기관리:** Alpha School은 적응형 소프트웨어가 학업을 담당하고, Guide가 목표·집중·회복탄력성·관계를 관리하는 거의 정확히 같은 모델을 오프라인 학교로 운영한다. Khan World School은 이를 보다 보수적으로 구현해, 비동기 콘텐츠·AI tutor에 인간 Guide·멘토·소그룹 튜토리얼을 함께 둔다. [Alpha 프로그램](https://alpha.school/the-program/) [Alpha Guide 채용](https://www.crossover.com/jobs/education/t-a0sfv00000C3uZuAAJ/alpha-learning-guide) [Khan World School](https://asuprep.asu.edu/khan-world-school/about-us/)
3. **AI가 낮은 숙련도의 튜터를 보강:** Tutor CoPilot 무작위 실험에서 AI 지원을 받은 튜터의 학생은 수업 직후 평가 통과율이 62%에서 66%로 올랐고, 낮은 평가를 받던 튜터의 학생은 56%에서 65%로 올랐다. 연간 추정 API 비용은 튜터당 약 $20이었다. 다만 이는 초등 수학의 단기 exit ticket 결과이며 SAT/AP 장기 성과를 직접 증명하지 않는다. [J-PAL 연구 요약 및 원 논문 링크](https://www.povertyactionlab.org/evaluation/human-ai-cooperation-improve-tutoring-united-states?lang=en)

그러나 현재 가설에서 한 부분은 수정해야 한다.

> **교과 강사의 역할은 축소할 수 있지만, 인간 역할 자체를 저숙련 노동으로 취급하면 안 된다.**

Alpha는 교사 자격증을 요구하지 않지만 Guide에게 아동·청소년과 직접 일한 경력, 집단 장악력, 어려운 목표를 달성하게 만든 증거를 요구하고 시작 보수를 연 $100,000로 제시한다. Testive의 과거 코칭형 모델도 코치에게 SAT/ACT 99백분위를 요구했다. Khan World School Guide는 교사 자격을 요구하고 연 $57,500부터다. 즉 시장의 선례는 **교수 자격을 완화하되 코칭·관계·판단 역량은 오히려 엄격하게 본다.** [Alpha 공고](https://www.crossover.com/jobs/education/t-a0sfv00000C3uZuAAJ/alpha-learning-guide) [Testive 공식 회사 소개](https://www.linkedin.com/company/testive-inc) [ASU Prep 급여표](https://asuprep.asu.edu/careers/)

ALTON에는 한 사람이 모든 것을 하는 `튜터` 대신 다음 3층이 가장 적합하다.

1. **Learning Coach:** 주간 목표, 실행, 관계, 부모 커뮤니케이션, 기본 질문의 triage
2. **검증된 AI·콘텐츠:** 개념 설명, 단계별 힌트, 반복연습, 오답, 모의고사, 학습경로
3. **Subject Expert Pool:** AI가 불확실하거나 AP 심화·서술형·고난도 질문인 경우 짧고 빠르게 에스컬레이션

이 모델은 프리미엄 1:1의 저가 복제품보다 **관리되는 SAT/AP 학습 멤버십**으로 정의하는 편이 낫다.

## 2. 직접 유사 및 인접 모델

### 2.1 가장 직접적인 선례

| 회사·모델 | AI·콘텐츠 역할 | 사람 역할 | 공개 가격·운영 | ALTON에 주는 신호 |
|---|---|---|---|---|
| **Alpha School** | 적응형 앱이 학생별 학업경로와 core academics를 담당하고 Coachbot이 학습 데이터를 Guide에게 제공 | Guide는 강의·채점·교안 작성 대신 1:1/소그룹 코칭, 동기·집중·회복탄력성, 주간 목표, life-skill workshop을 담당 | 학비 연 $40,000 이상. Guide 시작 보수 연 $100,000; 학사 필요, 교사자격 불필요, 아동과 직접 일한 3년 경력 요구 | 제안 모델의 가장 직접적인 proof of concept. 동시에 인간 코치는 싸구려 인력이 아니라 핵심 제품임을 보여준다. [프로그램](https://alpha.school/the-program/) [학비](https://alpha.school/application-fs/) [Guide 공고](https://www.crossover.com/jobs/education/t-a0sfv00000C3uZuAAJ/alpha-learning-guide) |
| **Khan World School @ ASU Prep** | Canvas·Khan Academy 기반 자기주도 mastery 학습, AI tutor, 독립 학습 | Learning Guide, House mentorship, 매일 live component, 4–8명 Squad/튜토리얼, office hour, 대학 준비·목표 설정 | 미국 타주 $10,500/년, 국제학생 $13,700/년. KWS Guide 시작 연 $57,500, 교사자격 필요 | 완전한 teacherless 모델보다 규제·학부모 신뢰에 안전한 혼합형. 인간의 교과 에스컬레이션을 남긴다. [구조·학비](https://asuprep.asu.edu/khan-world-school/about-us/) [Guide 급여](https://asuprep.asu.edu/careers/) |
| **Testive — 과거 thin-coach 모델** | 무료 적응형 SAT/ACT 소프트웨어가 약점을 찾고 설명 영상·반복 문제 제공 | 유료 코치가 진도를 매일 보고 매주 영상으로 만나 실행과 준비를 관리. 회사 소개상 코치는 시험 99백분위 | 과거 공식 회사 소개는 thin-coach 구조를 설명하지만 현재 가격은 남아 있지 않음 | SAT에서 이미 정확히 시도된 모델. [공식 회사 소개](https://www.linkedin.com/company/testive-inc) |
| **Testive — 현재 상품** | 온라인 practice platform, 수백 문항, 모의고사·리포트 | Self-Guided $399에도 전문가 세션 1회. 핵심 유료 단계는 16시간 live class $950 또는 class+1:1 7회 $1,950 | 공개 정가 왼쪽 참조 | 현재 상품이 얇은 coaching보다 다시 전문가 수업을 강조한다. 원인은 공개되지 않아 실패로 단정할 수 없지만, **thin coach만으로 SAT 구매 신뢰·성과를 만들기 어려웠을 가능성**을 검증해야 한다. [현재 공식 가격](https://testive.com/sat-prep-classes/) |

### 2.2 강력한 대체재와 인접 모델

| 회사·모델 | 구조·가격 | 해석 |
|---|---|---|
| **Khan Academy + Schoolhouse.world** | College Board 공식 SAT 영상·레슨·수천 문항은 무료. Schoolhouse는 인증된 peer tutor가 5–10명에게 주 2회 75분씩 4주 무료 부트캠프 제공. 2022년 이후 pilot 등록자는 118,000명 | 콘텐츠와 인간 소그룹 지원까지 가격이 0이다. ALTON이 받을 돈은 설명 자체보다 지속적인 실행, 개인별 계획, 부모 가시성, 안정된 코치, AP/SAT 장기관리에 대한 대가여야 한다. [Khan Academy](https://www.khanacademy.org/digital-sat?authuser=0) [College Board 발표](https://newsroom.collegeboard.org/free-peer-to-peer-sat-tutoring-schoolhouse-world) |
| **Speak** | 영상·자체 콘텐츠 → 반복 발화 → AI Tutor 대화·즉시 피드백. 미국 gift 페이지 기준 Premium $83.99/년, Premium Plus $164.99/년 | 특정 기능영역의 teaching을 인간 없이 매우 낮은 marginal cost로 공급할 수 있음을 보여준다. 그러나 학습자가 실제로 매주 실행하게 만드는 인간 accountability는 없다. [구조](https://www.speak.com/) [가격](https://app.speak.com/us-en/gift) |
| **Duolingo Max** | AI Video Call, Explain My Answer, Roleplay를 상위 구독에 포함. 2025년 말 MAU의 약 9%가 유료, 유료 구독자 1,220만 | AI는 콘텐츠 제작 속도와 speaking practice의 공급 제약을 크게 낮춘다. 반면 freemium의 낮은 유료전환은 콘텐츠 접근과 고관여 coaching 상품이 다른 사업임을 보여준다. [전략](https://investors.duolingo.com/company-strategy-overview-0) [10-K](https://investors.duolingo.com/static-files/f19d76fb-dee4-4f13-96ae-138ebfd0f2d3) |
| **Preply** | 인간 1:1 언어수업이 중심이고 AI가 수업 요약, 개인 피드백, 연습문제 등 반복 업무를 자동화 | 2026년 공식 사례에서 70%+ 튜터가 AI Lesson Insights를 사용하고 만족도 4.7/5. 인간을 제거하기보다 인간에게 관계·동기·문화적 맥락을 남기는 반대 방향의 증거다. [공식 사례](https://openai.com/index/preply/) |
| **BetterUp** | 개인 Coach 세션과 학습 라이브러리·평가·AI Coach를 한 구독에 묶음. Plus는 월 30분 human coaching 2회, Premium은 4회 | 교육 밖에서도 `always-on AI + 희소한 human touch`가 자연스러운 상품 구조다. 코칭 세션을 수업처럼 길게 잡을 필요가 없다는 신호다. [공식 플랜 설명](https://support.betterup.com/hc/en-us/articles/5023276679835-Plan-Subscription-Management) |

## 3. C2 Education 기준선

C2는 AI-first 회사가 아니다. 오히려 ALTON이 어떤 노동과 비용을 제거하려는지 보여주는 기준선이다.

### 현재 공개된 구조

- 진단 → Education Director의 개인별 계획·스케줄 → 3:1 환경의 수업 → 정기 평가·모의고사·피드백 → 계획 조정 구조다. SAT는 보통 주 2–3회를 권장한다. [C2 FAQ](https://www.c2educate.com/faqs/)
- 강사는 자체 커리큘럼을 학생별로 조정하고 최대 3명을 직접 가르치며 진도를 추적한다. 별도 운영진이 스케줄과 학부모 커뮤니케이션을 맡는다. [공식 채용공고](https://www.paycomonline.net/v4/ats/web.php/jobs/ViewJobDetails?clientkey=F96D9FAC89ED258689D6F6DF44DFB0B2&job=275690)
- C2도 튜터를 단순 설명자가 아니라 동기·질문·학습습관을 돕는 mentor로 판매한다. 따라서 “사람이 멘토다”만으로는 차별화가 아니다. [C2 tutoring](https://www.c2educate.com/tutoring/)
- 공식 자료상 대면·온라인·hybrid를 모두 제공하지만 온라인 역시 Zoom 기반 live instruction이다. AI tutor 사용은 공식 자료에서 확인되지 않는다. [C2 회사 소개](https://www.c2educate.com/our-story/) [SAT 페이지](https://www.c2educate.com/test-prep/sat-prep/)

### 가격과 인력

- C2는 고정 정찰가를 공개하지 않으며, 공식 FAQ는 센터·과목·기간별로 달라지는 다개월 프로그램에 대부분 **$2,000–$6,000+**를 투자한다고 밝힌다. [공식 FAQ](https://www.c2educate.com/faqs/)
- Virginia의 AP Chemistry/DSAT Math 공식 파트타임 공고는 **시급 $21–30**, 학사, C2 시험 95백분위를 요구하고 교사 자격은 요구하지 않는다. [공식 공고](https://www.paycomonline.net/v4/ats/web.php/jobs/ViewJobDetails?clientkey=F96D9FAC89ED258689D6F6DF44DFB0B2&job=275690)
- 3명 정원이 모두 차면 직접 강사비는 학생 contact-hour당 단순 계산으로 $7–10이다. 이는 임대료·Director·판매·훈련·공석 시간 등을 제외한 값이며 C2의 실제 마진은 공개되지 않았다.

**ALTON의 기회:** C2의 `전문강사 live teaching + 센터 + 다층 운영`을 `비동기/AI teaching + Learning Coach + 중앙 expert escalation`으로 unbundle하는 것이다. C2보다 코치에게 높은 시급을 지급하면서도 학생당 human time을 크게 줄이면 더 낮은 소비자가격과 더 높은 확장성을 동시에 만들 수 있다.

## 4. 성공 신호와 실패·위험 신호

### 성공 가능성을 높이는 근거

1. **잘 설계된 AI tutor는 실제 학습을 만들 수 있다.** Harvard 물리 수업의 무작위 실험에서 연구용 AI tutor 사용 학생은 동일 콘텐츠의 active-learning 수업보다 적은 시간에 더 많이 학습했고 동기·참여도도 높게 보고했다. 다만 대상은 자기주도성이 높은 대학생이고, 연구팀이 교육원칙을 반영해 만든 tutor라는 한계가 있다. [Scientific Reports 논문](https://www.nature.com/articles/s41598-025-97652-6)
2. **human coaching은 ‘알지만 하지 않는 문제’를 개선한다.** 대학생 대상 무작위 실험에서 coach는 목표를 명확히 하고 일상 행동을 장기목표에 연결하며 시간관리·학습기술을 지원했고, 배정 학생은 처치 기간과 종료 1년 뒤 모두 재학 지속 가능성이 높았다. 대상이 SAT 학생은 아니지만 인간 coach의 독립적 가치를 뒷받침한다. [NBER 원 논문](https://www.nber.org/papers/w16881)
3. **AI는 저경력 tutor의 품질 편차를 일부 줄일 수 있다.** Tutor CoPilot 효과가 낮은 평가·저경력 tutor에게 더 컸다. ALTON이 coach에게 실시간 질문 유형, Socratic hint, 다음 행동을 제안하는 구조는 근거가 있다. [J-PAL](https://www.povertyactionlab.org/evaluation/human-ai-cooperation-improve-tutoring-united-states?lang=en)
4. **무료 peer tutor도 accountability를 만든다.** Schoolhouse는 SAT peer tutoring이 학생을 동기부여하고 책임감을 높인다고 명시하며, 4주·주 2회·5–10명이라는 낮은 인간투입 구조를 대규모로 운영했다. [College Board](https://newsroom.collegeboard.org/free-peer-to-peer-sat-tutoring-schoolhouse-world)

### 구조적 위험

1. **일반 챗봇은 학습이 아니라 답 복사를 만들 수 있다.** 약 1,000명의 고교 수학 학생을 대상으로 한 PNAS 무작위 실험에서 unrestricted GPT는 연습 성과를 48% 높였지만 AI 없이 본 시험 성적은 대조군보다 17% 낮았다. 교사가 만든 정답·오류유형을 넣고 답 대신 힌트를 주는 guardrail tutor는 이 손상을 거의 제거했지만, 대조군보다 시험 성적을 높이지는 못했다. [PNAS/PMC 원문](https://pmc.ncbi.nlm.nih.gov/articles/PMC12232635/)
2. **AI가 낮은 교과 지식을 완전히 대체하지는 않는다.** Tutor CoPilot에서도 일부 제안은 학년에 맞지 않아 인간이 단순화해야 했다. 같은 연구의 실제 tutoring provider FEV Tutor는 효과가 있었음에도 2025년 1월 더 이상 운영되지 않았다. 교육효과가 사업 생존을 보장하지 않는다는 경고다. [J-PAL](https://www.povertyactionlab.org/evaluation/human-ai-cooperation-improve-tutoring-united-states?lang=en)
3. **코칭은 별도의 고숙련 직무다.** Alpha 사례는 교사자격을 제거했을 뿐 선발 난이도와 보수를 낮추지 않았다. 관계 형성, 엄격한 기대, 집단 에너지, 저항하는 학생의 행동변화는 표준 script만으로 만들기 어렵다. [Alpha 공고](https://www.crossover.com/jobs/education/t-a0sfv00000C3uZuAAJ/alpha-learning-guide)
4. **SAT/AP는 결국 도움 없이 시험을 봐야 한다.** AI 사용 중 정답률이 아니라 Bluebook/AP 형식의 무지원 timed mastery가 핵심 KPI여야 한다. AI 의존도가 높을수록 가짜 진전(false mastery)을 별도로 측정해야 한다.
5. **AP의 과목 폭이 운영을 복잡하게 한다.** AP Calculus, Chemistry, Biology, English의 질의는 generalist coach가 안정적으로 처리하기 어렵다. 모든 코치를 모든 과목 전문가로 만들면 원래의 확장성 이점이 사라진다.
6. **미성년자 관계 서비스는 안전·교체·기록이 제품이다.** 코치-학생 개인 연락, 정서적 의존, 부적절한 조언, coach 이탈에 대비해 모든 접촉 기록, 공개 채널, supervisor review, 인수인계가 필요하다.

## 5. 권장 ALTON 상품 구조

### 역할을 명확히 나눈다

| 계층 | 담당 | 담당하지 않음 |
|---|---|---|
| AI·콘텐츠 | 진단 후 학습경로, 5–12분 micro-lesson, 예제, 단계별 hint, spaced practice, 오답복습, AI 문제 생성, timed mock, 기본 Q&A | 검증되지 않은 자유답변, 최종 성취 판정, 정서적 개입 |
| Learning Coach | 주간 목표 합의, 일정 분해, 출석·과제·집중 확인, 학습 데이터 해석, 동기·관계, 부모 리포트, 질문 triage | 긴 개념 강의, 모든 AP 심화질문 해결, 콘텐츠 즉석 제작 |
| Subject Expert | 고난도 질문 clinic, FRQ/essay 검수, AI 답변 승인·수정, content QA, coach 교육 | 모든 학생의 반복적 주간관리 |
| Academic Lead | 진단·목표점수·시험일 결정, 월간 milestone audit, 위험학생 개입, 품질·안전 supervisor | 일상 reminder와 단순 문의 |

### 학생 경험

1. 진단과 목표시험일을 기준으로 주 단위 milestone을 자동 생성한다.
2. 학생은 매일 30–60분 콘텐츠·문제·오답을 수행한다.
3. AI는 정답을 바로 주지 않고 `학생 시도 → 오류 분류 → 최소 힌트 → 유사문제 → 무지원 재시험` 순서를 강제한다.
4. Coach는 주 1회 20–30분 1:1로 지난주 증거를 보고 다음 주 commitment를 정한다.
5. 주 1–2회 45–60분, 과목별 6–10명 Q&A clinic은 Subject Expert가 맡는다. 질문을 미리 제출해 expert 시간을 압축한다.
6. 2주마다 무지원 timed quiz, 4주마다 Bluebook/AP mock으로 AI 도움 없는 실력을 판정한다.
7. 부모에게는 학습시간이 아니라 `계획 대비 완료율, 무지원 점수, 반복 오답, 다음 milestone, 위험경보`를 보낸다.

### 고객 세그먼트를 나눈다

- **Core mass:** 1100–1400 SAT 또는 AP 3→4 목표. 표준 콘텐츠와 generalist coach의 효율이 높다.
- **Advanced:** 1450+ 또는 AP 5 목표. expert clinic·FRQ 검수가 더 많이 필요하므로 별도 가격을 받는다.
- **High-risk:** 스스로 전혀 시작하지 못하거나 ADHD/정서·행동 이슈가 큰 학생. 더 많은 human touch가 필요해 mass 상품에 억지로 넣으면 경제성이 무너진다.

처음부터 모든 AP 과목을 열지 말고 SAT Math/R&W와 AP Calculus AB·Statistics처럼 검증·채점이 상대적으로 구조화된 영역부터 시작하는 편이 안전하다. AP English essay와 AP Sciences FRQ는 expert layer가 안정화된 뒤 확장한다.

## 6. 단위경제성

### 핵심 공식

학생 1인당 월 직접 인건비:

`Coach wage × (1:1 시간 + 비동기 관리시간 + group coach 시간/그룹인원) + Expert wage × expert 시간/그룹인원`

월 공헌이익률:

`(가격 - 직접 인건비 - AI/콘텐츠 변동비 - 결제수수료 - 학생지원 변동비) / 가격`

반드시 추적할 변수:

- 코치 완전원가 시급과 실제 학생 응대 외 유급시간
- coach당 active students, 주당 1:1 분, no-show와 reschedule
- 학생당 asynchronous review·부모 연락 분
- 질문 중 AI self-serve 해결률, coach 해결률, expert escalation률
- expert clinic fill rate와 과목별 수요 변동
- AI inference·콘텐츠 라이선스·문항 검수비
- CAC, 첫 유료 전환율, 월 churn, 평균 유지개월, 환불률
- 계획 완료율, 무지원 mock 향상, 시험 목표 달성률

### 가설적 월 멤버십 시나리오

아래는 시장 가격 주장이 아니라 **ALTON이 검증할 운영 가정**이다.

가정:

- Coach 완전원가 $45/시간 — C2 공식 공고 $21–30보다 높은 비대면 기회를 제공한다.
- 주 1회 25분 1:1 = 월 1.80시간
- 학생별 비동기 관리·부모 리포트 월 0.75시간
- 주 1회 60분 coach group check-in, 8명 = 학생당 월 0.54시간
- 주 1회 60분 Subject Expert clinic, expert $80/시간, 8명 = 학생당 월 $10.83
- AI/플랫폼 변동비 $20, 학생지원 $15, 결제수수료 3%

| 항목 | 학생당 월 |
|---|---:|
| Coach 시간 | 3.09시간 |
| Coach 직접비 | $139.05 |
| Expert 직접비 | $10.83 |
| AI/플랫폼 + 지원 | $35.00 |
| 가격 $349일 때 결제수수료 | $10.47 |
| **총 변동비** | **$195.35** |
| **$349 가격 공헌이익 / 공헌이익률** | **$153.65 / 44.0%** |
| **$449 가격 공헌이익 / 공헌이익률** | **$250.65 / 55.8%** |

이 계산의 시사점은 명확하다.

- 코치에게 C2보다 더 주면서 $300대 상품을 만들 수는 있지만, 1:1 coaching 외 업무가 늘면 마진이 빠르게 사라진다.
- $349에서 장기적으로 60%+ 공헌이익률을 원하면 coach time을 약 2시간/월로 낮추거나 그룹 비중을 높여야 한다.
- $449–599는 강한 accountability와 expert access를 포함할 때 더 현실적인 출발점이다. 여전히 시간당 $150–200의 전통 1:1보다 월 총액이 낮다.
- “질문을 얼마든지 받는다”는 약속은 위험하다. 응답 SLA와 월 expert allowance를 정하고 초과 사용은 별도 credit로 받아야 한다.

### 가장 먼저 해야 할 경제성 실험

제품 전체를 만들기 전에 20–30명으로 8주 concierge pilot을 한다.

- 같은 콘텐츠를 제공하고 무작위 또는 순차 cohort로 `주 25분 1:1` 대 `격주 25분 1:1 + 주간 그룹`을 비교한다.
- 코치는 타이머로 1:1 외 업무를 모두 기록한다.
- 모든 질문을 AI 해결 / coach 해결 / expert escalation으로 태깅한다.
- 매 2주 무지원 quiz와 완료율, 8주 유지의향, 부모 NPS가 아니라 실제 다음 달 결제를 본다.
- 통과 기준 예시: 주간 계획 완료율 75%+, 8주 유지 70%+, expert escalation 15% 이하, coach 총시간 2.5시간/학생/월 이하, 가격 $399 이상에서 공헌이익률 50%+.

## 7. 최종 판단

이 방향은 기존 프리미엄 1:1 모델보다 확장성이 높고, ALTON의 세션·과제·리포트·AI 기능과도 더 잘 맞는다. 특히 미국식 콘텐츠와 한국어 부모관리를 결합하면 Speak/Duolingo 같은 pure AI와 C2 같은 teacher-heavy 학원 사이에 분명한 자리가 있다.

하지만 경쟁우위의 문장은 다음이어야 한다.

> **AI가 가르치고, 사람이 학생을 움직이며, 전문가는 필요한 순간에만 개입한다.**

“낮은 레벨 선생님을 싸게 쓴다”는 구조는 품질·브랜드·이직 문제를 만든다. 대신 `교과전문가가 아니어도 되는 높은 수준의 Learning Coach`를 C2보다 잘 보상하고, 한 coach가 더 많은 학생을 책임지게 해야 한다. 절감은 사람의 단가가 아니라 **학생당 필요한 전문가 시간**에서 만들어야 한다.

현재 가장 큰 미검증 가설은 AI의 설명 능력이 아니라, SAT/AP 고관여 고객이 주 20–30분의 human coaching을 “충분한 인간 서비스”로 느끼며 매달 $399–599를 실제 결제하는지다. 다음 단계는 소프트웨어 개발보다 이 가격·human-touch 조합을 concierge pilot으로 검증하는 것이다.
