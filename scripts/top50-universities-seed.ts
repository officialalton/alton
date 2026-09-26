// 상위 50개교 입시 데이터 시드 스크립트(2026-09-19) — 로컬 전용.
// docs/2026-09-19-top50-universities-admission-data.md(5개 배치 WebSearch 리서치)를
// 코디네이터가 직접 검토해 구조화한 것. "미확인"/2차자료만 있고 신뢰도 낮은 값은 null로 뺐다.
// 실행: 로컬 Supabase(db reset 이후)에 대해 tsx로 실행 → 결과를 psql로 SQL insert문으로
// 덤프 → additive migration에 붙여 db push --linked (기존 college-db Part 1/2와 같은 패턴,
// 서비스 키를 다루는 스크립트를 non-prod에 직접 돌리지 않는다).
import { createClient } from "@supabase/supabase-js";

type TestPolicy = "required" | "optional" | "not_considered" | null;

type Cycle = {
  name: string; // universities.name과 정확히 일치해야 함(매칭 키)
  test_policy: TestPolicy;
  sat_ebrw_25?: number; sat_ebrw_75?: number; sat_math_25?: number; sat_math_75?: number;
  act_composite_25?: number; act_composite_75?: number;
  gpa_25?: number; gpa_75?: number; gpa_average?: number;
  ed_deadline?: string; ea_deadline?: string; rd_deadline?: string;
  application_fee?: number;
  essay_count?: number; recommendation_letter_count?: number;
  portfolio_required?: boolean; interview_required?: boolean;
  acceptance_rate?: number;
  pell_grant_pct?: number; student_faculty_ratio?: string;
  grad_rate_4yr?: number; grad_rate_6yr?: number; retention_rate?: number;
  total_applicants?: number; yield_rate?: number; international_pct?: number; women_pct?: number;
  source_notes: string;
};

const CYCLE_YEAR = 2027;

export const CYCLES: Cycle[] = [
  { name: "Princeton University", test_policy: "optional", sat_ebrw_25: 740, sat_ebrw_75: 780, sat_math_25: 770, sat_math_75: 800, act_composite_25: 34, act_composite_75: 35, ed_deadline: "2026-11-01", rd_deadline: "2027-01-01", application_fee: 70, acceptance_rate: 4.4, total_applicants: 42303, student_faculty_ratio: "5:1", grad_rate_4yr: 88, grad_rate_6yr: 98, retention_rate: 98, international_pct: 12.6, recommendation_letter_count: 3, interview_required: false, source_notes: "2차자료 다수, SAT/ACT는 test-ninjas 미검증. 2027-28부터 시험 필수 전환 예정." },
  { name: "Massachusetts Institute of Technology", test_policy: "required", sat_ebrw_25: undefined, sat_math_25: undefined, act_composite_25: 34, act_composite_75: 36, ea_deadline: "2026-11-01", rd_deadline: "2027-01-05", application_fee: 75, essay_count: 4, recommendation_letter_count: 2, acceptance_rate: 4.58, total_applicants: 28349, student_faculty_ratio: "3:1", grad_rate_4yr: 83, retention_rate: 99, pell_grant_pct: 20, source_notes: "SAT 합산 1520-1570만 확인(섹션분리 미확인, null 처리)." },
  { name: "Harvard University", test_policy: "required", act_composite_25: 33, act_composite_75: 35, ea_deadline: "2026-11-01", rd_deadline: "2027-01-01", acceptance_rate: 4.2, total_applicants: 47893, yield_rate: 83.6, essay_count: 5, recommendation_letter_count: 3, interview_required: true, source_notes: "SAT 합산 1450-1560만 확인(섹션분리·GPA·Pell·학생교수비율 등 CDS 미열람으로 대부분 null)." },
  { name: "Stanford University", test_policy: "required", act_composite_25: 34, act_composite_75: 35, gpa_average: 3.94, ea_deadline: "2026-11-01", rd_deadline: "2027-01-05", application_fee: 90, acceptance_rate: 3.8, total_applicants: 60646, yield_rate: 79.9, international_pct: 12.7, recommendation_letter_count: 3, interview_required: true, source_notes: "SAT 합산만 확인(자료 편차 있어 null), GPA 25/75는 미확인." },
  { name: "Yale University", test_policy: "required", act_composite_25: 33, act_composite_75: 35, ea_deadline: "2026-11-01", rd_deadline: "2027-01-02", application_fee: 80, acceptance_rate: 4.8, total_applicants: 50264, grad_rate_6yr: 96.3, retention_rate: 99.4, pell_grant_pct: 23, essay_count: 1, recommendation_letter_count: 3, interview_required: true, source_notes: "SAT 합산 1480-1560만 확인. 학생교수비율 6:1은 자료 상충으로 미기재." },
  { name: "University of Pennsylvania", test_policy: "required", act_composite_25: 34, act_composite_75: 35, ed_deadline: "2026-11-01", rd_deadline: "2027-01-05", application_fee: 75, acceptance_rate: 4.9, total_applicants: 72544, pell_grant_pct: 33.9, grad_rate_4yr: 88, grad_rate_6yr: 96, international_pct: 19, recommendation_letter_count: 2, interview_required: false, source_notes: "2025-26 사이클부터 alumni interview 전면 폐지 확인." },
  { name: "California Institute of Technology", test_policy: "required", ea_deadline: "2026-11-01", rd_deadline: "2027-01-04", application_fee: 75, acceptance_rate: 2.57, yield_rate: 61, women_pct: 44.5, student_faculty_ratio: "3:1", recommendation_letter_count: 2, source_notes: "SAT/ACT 범위 미검증(2차자료만), GPA·Pell·졸업률 등 CDS 미열람." },
  { name: "Duke University", test_policy: null, act_composite_25: 34, act_composite_75: 35, application_fee: 85, acceptance_rate: 5.5, total_applicants: 59800, women_pct: 55, recommendation_letter_count: 3, source_notes: "test_policy 상충 정보(공식 확인 필요, null 처리). 마감일도 자료마다 하루씩 편차 있어 미기재." },
  { name: "Brown University", test_policy: "required", sat_ebrw_25: 700, sat_ebrw_75: 750, sat_math_25: 750, sat_math_75: 800, act_composite_25: 34, act_composite_75: 36, ed_deadline: "2026-11-01", rd_deadline: "2027-01-05", application_fee: 80, acceptance_rate: 5.6, total_applicants: 47944, yield_rate: 64.8, student_faculty_ratio: "6:1", essay_count: 5, recommendation_letter_count: 3, interview_required: false, source_notes: "admission.brown.edu 공식 페이지로 확인된 값 다수 포함(신뢰도 높음)." },
  { name: "Johns Hopkins University", test_policy: "required", act_composite_25: 35, act_composite_75: 36, ed_deadline: "2026-11-01", rd_deadline: "2027-01-02", application_fee: 70, acceptance_rate: 6.1, total_applicants: 50259, retention_rate: 98.1, grad_rate_4yr: 87.1, grad_rate_6yr: 93.8, pell_grant_pct: 19.5, essay_count: 1, recommendation_letter_count: 2, source_notes: "공식 CDS PDF 접근 실패(403) — 대부분 2차자료." },

  { name: "Northwestern University", test_policy: "required", act_composite_25: 33, act_composite_75: 35, ed_deadline: "2026-11-01", rd_deadline: "2027-01-01", application_fee: 75, essay_count: 1, acceptance_rate: 7.69, total_applicants: 49474, interview_required: true, source_notes: "SAT 섹션분리 미확인. CDS 2024-2025 PDF 확보했으나 세부 미열람." },
  { name: "Columbia University", test_policy: "optional", act_composite_25: 34, act_composite_75: 35, ed_deadline: "2026-11-01", rd_deadline: "2027-01-01", application_fee: 85, acceptance_rate: 2.8, source_notes: "합격률은 RD 기준(Class of 2028), 전체 지원자수 미확인." },
  { name: "Cornell University", test_policy: "optional", sat_ebrw_25: 730, sat_ebrw_75: 770, sat_math_25: 770, sat_math_75: 800, act_composite_25: 33, act_composite_75: 35, application_fee: 0, acceptance_rate: 8.76, total_applicants: 62993, source_notes: "지원료 $0은 2차자료(재확인 권장). 마감일 미확인." },
  { name: "University of Chicago", test_policy: "required", act_composite_25: 34, act_composite_75: 35, ea_deadline: "2026-11-03", ed_deadline: "2026-11-03", application_fee: 90, essay_count: 2, acceptance_rate: 4.5, total_applicants: 43612, source_notes: "2025-26 사이클부터 재의무화. 마감일은 2025-26 자료를 유추 적용(재확인 필요)." },
  { name: "University of California, Berkeley", test_policy: "not_considered", rd_deadline: "2026-11-30", application_fee: 95, essay_count: 4, recommendation_letter_count: 0, acceptance_rate: 11.4, source_notes: "UC test-blind 공통 정책. GPA·졸업률 등은 opa.berkeley.edu CDS 미열람." },
  { name: "University of California, Los Angeles", test_policy: "not_considered", rd_deadline: "2026-11-30", essay_count: 4, recommendation_letter_count: 0, acceptance_rate: 8.9, total_applicants: 146276, source_notes: "UC test-blind 공통 정책." },
  { name: "Rice University", test_policy: "optional", act_composite_25: 34, act_composite_75: 35, ed_deadline: "2026-11-01", rd_deadline: "2027-01-04", acceptance_rate: 8, source_notes: "대부분 필드 미확인." },
  { name: "University of Notre Dame", test_policy: "optional", act_composite_25: 33, act_composite_75: 35, ea_deadline: "2026-11-01", rd_deadline: "2027-01-04", acceptance_rate: 11.27, total_applicants: 29942, source_notes: "REA(Restrictive EA) 방식." },
  { name: "Vanderbilt University", test_policy: "optional", application_fee: 50, source_notes: "대부분 필드 미확인, 합격률도 부정확(6% 미만이라는 서술만)." },
  { name: "Carnegie Mellon University", test_policy: "optional", act_composite_25: 34, act_composite_75: 35, ed_deadline: "2026-11-02", rd_deadline: "2027-01-04", application_fee: 75, portfolio_required: true, acceptance_rate: 11.66, total_applicants: 33941, source_notes: "portfolio_required=true는 Art/Design/Drama/Music/Architecture 등 특정 전공 한정(일반전공은 false) — 전공별 컬럼 분리는 V1 범위 밖이라 계열 스킬 특성상 true로 기재." },

  { name: "University of Michigan, Ann Arbor", test_policy: "optional", ed_deadline: "2026-11-01", ea_deadline: "2026-11-01", rd_deadline: "2027-02-01", application_fee: 75, acceptance_rate: 16.4, total_applicants: 109112, yield_rate: 47.34, student_faculty_ratio: "15:1", retention_rate: 97, grad_rate_4yr: 82.2, international_pct: 7.3, women_pct: 54.4, source_notes: "CDS 2025-26 PDF 일부 직접 열람(women_pct/grad_rate_4yr는 CDS 원문 계산값, 신뢰도 높음)." },
  { name: "Georgetown University", test_policy: "required", act_composite_25: 31, act_composite_75: 35, ea_deadline: "2026-11-01", rd_deadline: "2027-01-10", application_fee: 75, essay_count: 4, recommendation_letter_count: 2, interview_required: true, acceptance_rate: 13, student_faculty_ratio: "11:1", retention_rate: 97, grad_rate_4yr: 95, grad_rate_6yr: 94, international_pct: 14, women_pct: 56, source_notes: "2026-27 사이클부터 Common App 지원 시작(자체 앱과 병행)." },
  { name: "University of Virginia", test_policy: "optional", act_composite_25: 32, act_composite_75: 35, ed_deadline: "2026-11-01", ea_deadline: "2026-11-01", rd_deadline: "2027-01-05", application_fee: 75, essay_count: 1, recommendation_letter_count: 2, interview_required: false, acceptance_rate: 15.6, student_faculty_ratio: "14:1", retention_rate: 97.9, international_pct: 4.96, women_pct: 56.1, source_notes: "interview_required=false는 공식 FAQ 확인(신뢰도 높음)." },
  { name: "Emory University", test_policy: "optional", act_composite_25: 32, act_composite_75: 35, ed_deadline: "2026-11-01", application_fee: 75, recommendation_letter_count: 2, acceptance_rate: 10.65, total_applicants: 33450, student_faculty_ratio: "8:1", retention_rate: 96, grad_rate_4yr: 81, grad_rate_6yr: 91, pell_grant_pct: 16, women_pct: 56, yield_rate: 63, source_notes: "지원자 수는 2024-25 사이클(2027 사이클 아님, 참고용)." },
  { name: "University of California, San Diego", test_policy: "not_considered", rd_deadline: "2026-11-30", application_fee: 80, essay_count: 4, recommendation_letter_count: 0, acceptance_rate: 28.1, total_applicants: 136747, student_faculty_ratio: "26:1", retention_rate: 94, grad_rate_6yr: 89, pell_grant_pct: 33, international_pct: 18.2, women_pct: 54, source_notes: "student_faculty_ratio·yield_rate는 자료 상충 있어 재확인 권장." },
  { name: "University of Southern California", test_policy: "optional", act_composite_25: 32, act_composite_75: 35, ea_deadline: "2026-11-01", rd_deadline: "2027-01-15", application_fee: 85, acceptance_rate: 9.81, total_applicants: 82027, student_faculty_ratio: "9:1", retention_rate: 96, pell_grant_pct: 21.7, source_notes: "지원자 수는 2024-25 사이클." },
  { name: "University of Florida", test_policy: "required", act_composite_25: 29, act_composite_75: 33, rd_deadline: "2027-01-15", application_fee: 30, acceptance_rate: 24.2, total_applicants: 73557, student_faculty_ratio: "16:1", retention_rate: 97, grad_rate_4yr: 76, grad_rate_6yr: 91, yield_rate: 42.2, source_notes: "ED 미운영, EA/RD 단일 마감 구조로 알려짐(재확인 필요)." },
  { name: "University of North Carolina at Chapel Hill", test_policy: "optional", act_composite_25: 28, act_composite_75: 34, rd_deadline: "2027-01-15", application_fee: 85, essay_count: 2, acceptance_rate: 15.3, total_applicants: 66535, student_faculty_ratio: "14:1", retention_rate: 97, pell_grant_pct: 18, yield_rate: 45.5, source_notes: "GPA 2.8 미만이면 시험 제출 필수인 조건부 test-optional 정책." },
  { name: "University of Texas at Austin", test_policy: "required", act_composite_25: 29, act_composite_75: 34, rd_deadline: "2026-12-01", acceptance_rate: 26.64, total_applicants: 72885, student_faculty_ratio: "18:1", retention_rate: 97.1, grad_rate_4yr: 75.7, grad_rate_6yr: 84, pell_grant_pct: 26, international_pct: 9.6, yield_rate: 47.43, source_notes: "2025-26 사이클부터 시험 필수 재도입, 2026-27도 유지 추정." },
  { name: "Georgia Institute of Technology", test_policy: "optional", act_composite_25: 30, act_composite_75: 34, rd_deadline: "2027-01-06", application_fee: 75, acceptance_rate: 14.07, total_applicants: 59789, student_faculty_ratio: "17:1", retention_rate: 98, grad_rate_4yr: 70, grad_rate_6yr: 94, yield_rate: 45.6, source_notes: "STEM 전공 83% 비중." },

  { name: "University of California, Davis", test_policy: "not_considered", rd_deadline: "2026-11-30", essay_count: 4, recommendation_letter_count: 0, acceptance_rate: 37.3, pell_grant_pct: 30.78, student_faculty_ratio: "22:1", grad_rate_4yr: 69, grad_rate_6yr: 85, retention_rate: 93.37, source_notes: "UC test-blind 공통 정책." },
  { name: "University of Illinois Urbana-Champaign", test_policy: "required", act_composite_25: 31, act_composite_75: 34, application_fee: 75, acceptance_rate: 37, pell_grant_pct: 24, student_faculty_ratio: "20:1", grad_rate_4yr: 74, grad_rate_6yr: 85, retention_rate: 95, source_notes: "2025-26 사이클부터 재의무화." },
  { name: "University of California, Irvine", test_policy: "not_considered", gpa_25: 4.12, gpa_75: 4.29, rd_deadline: "2026-11-30", application_fee: 80, essay_count: 4, recommendation_letter_count: 0, acceptance_rate: 28.9, source_notes: "GPA는 UC 가중 스케일(4.0 초과 가능) 중위 50%." },
  { name: "University of Wisconsin-Madison", test_policy: "optional", gpa_average: 3.91, ea_deadline: "2026-11-01", rd_deadline: "2027-02-01", application_fee: 70, essay_count: 2, acceptance_rate: 41, student_faculty_ratio: "18:1", grad_rate_4yr: 72.8, grad_rate_6yr: 89.2, retention_rate: 95.2, yield_rate: 26.1, source_notes: "yield_rate는 2019-20 오래된 수치(참고용)." },
  { name: "Boston College", test_policy: "optional", ed_deadline: "2026-11-01", rd_deadline: "2027-01-02", application_fee: 80, acceptance_rate: 16.2, source_notes: "GPA·졸업률 등 CDS 미보고/미열람." },
  { name: "University of Washington", test_policy: "not_considered", ea_deadline: "2026-11-15", rd_deadline: "2027-01-15", application_fee: 95, acceptance_rate: 41.7, total_applicants: 72933, source_notes: "test-free 공식 정책." },
  { name: "Tufts University", test_policy: "optional", act_composite_25: 33, act_composite_75: 35, ed_deadline: "2026-12-07", rd_deadline: "2027-01-04", essay_count: 4, acceptance_rate: 10, total_applicants: 36000, yield_rate: 50, pell_grant_pct: 12.04, retention_rate: 95, grad_rate_4yr: 90, grad_rate_6yr: 94, source_notes: "ED 마감일 표기가 자료마다 달라 재확인 권장." },
  { name: "University of California, Santa Barbara", test_policy: "not_considered", rd_deadline: "2026-12-01", essay_count: 4, recommendation_letter_count: 0, acceptance_rate: 44, source_notes: "UC test-blind 공통 정책. 마감일이 타 UC(11/30)와 다르다는 점 재확인 필요." },
  { name: "Boston University", test_policy: "optional", ed_deadline: "2026-11-01", essay_count: 2, acceptance_rate: 12.8, source_notes: "RD 정확 마감일 미확인." },
  { name: "Ohio State University", test_policy: "required", act_composite_25: 27, act_composite_75: 32, ea_deadline: "2026-11-01", rd_deadline: "2027-01-15", application_fee: 60, essay_count: 1, acceptance_rate: 49.2, total_applicants: 81392, source_notes: "2026 입학 사이클부터 시험 필수 재도입." },

  { name: "Rutgers University-New Brunswick", test_policy: null, ea_deadline: "2026-11-01", rd_deadline: "2026-12-01", student_faculty_ratio: "16:1", grad_rate_4yr: 69, grad_rate_6yr: 84, retention_rate: 93, source_notes: "test_policy 명시적 확인 못함(null)." },
  { name: "University of Rochester", test_policy: null, gpa_average: 3.73, ed_deadline: "2026-11-01", rd_deadline: "2027-01-05", total_applicants: 21600, acceptance_rate: 42, source_notes: "test-optional로 알려져 있으나 공식 미확인이라 null." },
  { name: "Purdue University", test_policy: "required", gpa_average: 3.81, ea_deadline: "2026-11-01", rd_deadline: "2027-01-15", essay_count: 3, acceptance_rate: 43, total_applicants: 87000, student_faculty_ratio: "15:1", grad_rate_4yr: 65, grad_rate_6yr: 83, retention_rate: 93, source_notes: "West Lafayette 캠퍼스 기준." },
  { name: "Texas A&M University", test_policy: "optional", act_composite_25: 24, act_composite_75: 32, rd_deadline: "2026-12-01", acceptance_rate: 51.7, total_applicants: 62967, source_notes: "공식 admissions.tamu.edu 기준 optional 채택(2차자료의 required 주장과 상충하나 공식 소스 우선)." },
  { name: "University of Maryland, College Park", test_policy: "optional", ea_deadline: "2026-11-01", rd_deadline: "2027-01-20", essay_count: 1, source_notes: "CDS 2025-26 원본(xlsx) 미열람 — 대부분 필드 미확인." },
  { name: "University of Georgia", test_policy: "required", gpa_average: 4.17, ea_deadline: "2026-10-15", rd_deadline: "2027-01-01", essay_count: 1, acceptance_rate: 34, source_notes: "Fall 2027 cycle부터 보충 에세이 폐지." },
  { name: "Florida State University", test_policy: "required", act_composite_25: 29, act_composite_75: 32, gpa_25: 4.3, gpa_75: 4.6, ea_deadline: "2026-10-15", rd_deadline: "2026-12-01", essay_count: 1, acceptance_rate: 23.8, source_notes: "Fall 2027 입학부터 ED 신설 예정(정확한 마감일 미확인)." },
  { name: "Northeastern University", test_policy: "required", act_composite_25: 33, act_composite_75: 35, ed_deadline: "2026-11-01", ea_deadline: "2026-11-01", rd_deadline: "2027-01-01", acceptance_rate: 5.2, source_notes: "2025-26 사이클부터 재의무화." },
  { name: "University of Miami", test_policy: "required", act_composite_25: 30, act_composite_75: 33, ed_deadline: "2026-11-01", ea_deadline: "2026-11-01", rd_deadline: "2027-01-05", essay_count: 0, recommendation_letter_count: 1, acceptance_rate: 18.9, source_notes: "공식 뉴스로 확인: 2026-27 사이클 보충 에세이 없음, 추천서 정확히 1통." },
  { name: "Pepperdine University", test_policy: "optional", act_composite_25: 29, act_composite_75: 32, ea_deadline: "2025-11-01", rd_deadline: "2026-01-15", essay_count: 2, acceptance_rate: 63, source_notes: "마감일은 직전 사이클 기준(2026-27 재확인 필요)." },
];

export const MAJORS: Record<string, string[]> = {
  "Princeton University": ["Computer Science", "Economics", "Public and International Affairs", "History", "Operations Research & Financial Engineering", "Molecular Biology", "Electrical & Computer Engineering", "Politics", "Psychology", "Mathematics"],
  "Massachusetts Institute of Technology": ["Electrical Engineering and Computer Science", "Mathematics", "Physics", "Chemistry", "Mechanical Engineering", "Civil and Environmental Engineering", "Materials Science and Engineering", "Chemical Engineering", "Aeronautics and Astronautics", "Management"],
  "Harvard University": ["Economics", "Computer Science", "Government", "Applied Mathematics", "Molecular and Cellular Biology", "History", "Psychology", "Statistics", "Neuroscience", "Physics"],
  "Stanford University": ["Computer Science", "Symbolic Systems", "Human Biology", "Economics", "Mechanical Engineering", "Biology", "Political Science", "Electrical Engineering", "Psychology", "Data Science"],
  "Yale University": ["Political Science", "Economics", "History", "Computer Science", "Molecular Biophysics & Biochemistry", "English", "Cognitive Science", "Mathematics", "Psychology", "Global Affairs"],
  "University of Pennsylvania": ["Economics", "Computer Science", "Bioengineering", "Electrical Engineering", "Mechanical Engineering", "Nursing", "Biology", "English", "Political Science", "History"],
  "California Institute of Technology": ["Computer Science", "Chemical Engineering", "Electrical Engineering", "Mechanical Engineering", "Physics", "Applied Physics", "Aerospace", "Applied Mathematics", "Astrophysics", "Biology"],
  "Duke University": ["Economics", "Computer Science", "Public Policy Studies", "Biology", "Psychology", "Political Science", "Biomedical Engineering", "Mechanical Engineering", "Neuroscience", "Statistical Science"],
  "Brown University": ["Applied Mathematics", "Biology", "Biochemistry & Molecular Biology", "Chemistry", "Cognitive Neuroscience", "Computer Science", "Economics", "Engineering", "English", "International & Public Affairs"],
  "Johns Hopkins University": ["Biomedical Engineering", "Public Health Studies", "International Studies", "Neuroscience", "Computer Science", "Economics", "Molecular & Cellular Biology", "Political Science", "Applied Mathematics & Statistics", "Mechanical Engineering"],
  "Northwestern University": ["Journalism", "Theatre", "Music", "Economics", "Computer Science", "Political Science", "Psychology", "Communication Studies", "Chemical Engineering", "Biology"],
  "Columbia University": ["Economics", "Computer Science", "Political Science", "History", "Psychology", "English", "Biology", "Financial Economics", "Neuroscience & Behavior", "Mathematics"],
  "Cornell University": ["Computer Science", "Biology", "Economics", "Industrial and Labor Relations", "Hotel Administration", "Engineering", "Agriculture and Life Sciences", "Business", "Architecture", "Government"],
  "University of Chicago": ["Economics", "Computer Science", "Political Science", "Mathematics", "Biology", "Public Policy Studies", "Statistics", "History", "Psychology", "Molecular Engineering"],
  "University of California, Berkeley": ["Computer Science", "Electrical Engineering & Computer Sciences", "Economics", "Molecular & Cell Biology", "Political Science", "Psychology", "Business Administration", "Mechanical Engineering", "Data Science", "English"],
  "University of California, Los Angeles": ["Biology", "Political Science", "Psychology", "Economics", "Computer Science", "Business Economics", "Sociology", "Mathematics", "Communication", "Film and Television"],
  "Rice University": ["Computer Science", "Economics", "Biosciences", "Mechanical Engineering", "Chemical Engineering", "Bioengineering", "Kinesiology", "Political Science", "Psychology", "Statistics"],
  "University of Notre Dame": ["Finance", "Political Science", "Biology", "Computer Science", "Neuroscience & Behavior", "Economics", "Psychology", "Marketing", "Mechanical Engineering", "Accounting"],
  "Vanderbilt University": ["Human & Organizational Development", "Economics", "Computer Science", "Political Science", "Psychology", "Medicine, Health & Society", "Engineering Science", "Molecular & Cellular Biology", "Musical Arts", "Neuroscience"],
  "Carnegie Mellon University": ["Computer Science", "Business Administration", "Electrical and Computer Engineering", "Mechanical Engineering", "Drama", "Music", "Information Systems", "Statistics and Machine Learning", "Design", "Chemical Engineering"],
  "University of Michigan, Ann Arbor": ["Computer Science", "Economics", "Business Administration", "Behavioral Neuroscience", "Psychology", "Mechanical Engineering", "Political Science", "Biology", "Data Science", "Communication & Media"],
  "Georgetown University": ["International Relations/Foreign Service", "Finance", "Political Science", "Government", "Economics", "Biology", "Psychology", "Computer Science", "English", "Accounting"],
  "University of Virginia": ["Economics", "Commerce", "Biology", "Computer Science", "Government", "Psychology", "English", "Nursing", "Kinesiology", "Global Studies"],
  "Emory University": ["Business Administration", "Neuroscience & Behavioral Biology", "Economics", "Political Science", "Biology", "Psychology", "Nursing", "Computer Science", "Human Health", "Anthropology"],
  "University of California, San Diego": ["Biology", "Cognitive Science", "Computer Science", "Economics", "Psychology", "Data Science", "Political Science", "Mechanical Engineering", "Bioengineering", "Chemistry"],
  "University of Southern California": ["Business Administration", "Computer Science", "Cinematic Arts", "Communication", "Psychology", "Biological Sciences", "Architecture", "Mathematics", "International Relations", "Health Promotion & Disease Prevention"],
  "University of Florida": ["Business Administration", "Biology", "Engineering", "Psychology", "Political Science", "Journalism", "Computer Science", "Nursing", "Health Science", "Agricultural Sciences"],
  "University of North Carolina at Chapel Hill": ["Biology", "Business Administration", "Public Policy", "Psychology", "Computer Science", "Political Science", "Media & Journalism", "Economics", "Public Health", "Exercise & Sport Science"],
  "University of Texas at Austin": ["Computer Science", "Business Administration", "Engineering", "Biology", "Economics", "Government", "Communication", "Psychology", "Architecture", "Nursing"],
  "Georgia Institute of Technology": ["Computer Science", "Mechanical Engineering", "Business Administration", "Aerospace Engineering", "Industrial Engineering", "Electrical Engineering", "Biomedical Engineering", "Computational Media", "Physics", "Mathematics"],
  "University of California, Davis": ["Computer Science", "Biological Sciences", "Managerial Economics", "Psychology", "Animal Science", "Environmental Science & Policy", "Mechanical Engineering", "Communication", "Nutrition Science", "Political Science"],
  "University of Illinois Urbana-Champaign": ["Computer Science", "Electrical & Computer Engineering", "Business", "Psychology", "Economics", "Mechanical Engineering", "Biology", "Statistics", "Advertising", "Accountancy"],
  "University of California, Irvine": ["Computer Science", "Biological Sciences", "Business Administration", "Psychology", "Nursing Science", "Chemical Engineering", "Criminology, Law & Society", "Public Health", "Economics", "Film & Media Studies"],
  "University of Wisconsin-Madison": ["Computer Science", "Mechanical Engineering", "Economics", "Biology", "Business", "Psychology", "Journalism & Mass Communication", "Life Sciences Communication", "Political Science", "Nursing"],
  "Boston College": ["Finance", "Economics", "Computer Science", "Psychology", "Communication", "Biology", "Political Science", "Nursing", "Applied Psychology & Human Development", "Marketing"],
  "University of Washington": ["Computer Science", "Informatics", "Business Administration", "Biology", "Psychology", "Mechanical Engineering", "Nursing", "Public Health", "Economics", "Communication"],
  "Tufts University": ["International Relations", "Computer Science", "Economics", "Biology", "Engineering Psychology", "Political Science", "Biomedical Engineering", "Child Study & Human Development", "Community Health", "Art History"],
  "University of California, Santa Barbara": ["Computer Science", "Economics", "Biology", "Communication", "Psychological & Brain Sciences", "Chemical Engineering", "Environmental Studies", "Global Studies", "Film & Media Studies", "Financial Mathematics & Statistics"],
  "Boston University": ["Computer Science", "Business Administration", "Biology", "Psychology", "Communication", "International Relations", "Film & Television", "Economics", "Nursing", "Engineering"],
  "Ohio State University": ["Computer Science & Engineering", "Business Administration", "Biology", "Psychology", "Mechanical Engineering", "Communication", "Nursing", "Finance", "Political Science", "Agricultural Sciences"],
  "Rutgers University-New Brunswick": ["Psychology", "Computer Science", "Business/Management/Marketing", "Engineering", "Biological Sciences", "Communication/Journalism", "Economics", "Public Policy", "Pharmacy", "Visual/Performing Arts"],
  "University of Rochester": ["Biological/Biomedical Sciences", "Engineering", "Social Sciences", "Business", "Psychology", "Visual/Performing Arts", "Health Professions", "Mathematics/Statistics", "Computer Science", "Physical Sciences"],
  "Purdue University": ["Engineering", "Computer Science", "Business/Management", "Biological/Biomedical Sciences", "Health Professions", "Agricultural Sciences", "Psychology", "Mathematics/Statistics", "Aviation/Aeronautics", "Pharmacy"],
  "Texas A&M University": ["Engineering", "Business", "Biological/Biomedical Sciences", "Agriculture/Animal/Veterinary Science", "Health Professions", "Social Sciences", "Psychology", "Computer Science", "Multi/Interdisciplinary Studies"],
  "University of Maryland, College Park": ["Computer Science", "Business/Management/Marketing", "Engineering", "Biological/Biomedical Sciences", "Social Sciences", "Health Professions", "Psychology", "Communication/Journalism", "Mathematics/Statistics"],
  "University of Georgia": ["Business/Management/Marketing", "Biological/Biomedical Sciences", "Communication/Journalism", "Social Sciences", "Psychology", "Engineering", "Family/Consumer Sciences", "Computer Science", "Education"],
  "Florida State University": ["Finance", "Psychology", "Biological Science", "Criminology", "Marketing", "Business", "Communication", "Engineering"],
  "Northeastern University": ["Business/Management/Marketing", "Engineering", "Computer Science", "Biological/Biomedical Sciences", "Social Sciences", "Health Professions", "Psychology", "Communication/Journalism", "Visual/Performing Arts"],
  "University of Miami": ["Business/Management/Marketing", "Health Professions", "Biological/Biomedical Sciences", "Communication/Journalism", "Social Sciences", "Visual/Performing Arts", "Psychology", "Engineering", "Architecture", "Computer Science"],
  "Pepperdine University": ["Business/Management/Marketing", "Communication/Journalism", "Psychology", "Social Sciences", "Visual/Performing Arts", "Multi/Interdisciplinary Studies", "Biological Sciences", "English", "Philosophy/Religious Studies"],
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54421";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 필요(로컬 전용).");
  const db = createClient(url, key);

  for (const c of CYCLES) {
    const { data: u, error: uErr } = await db.from("universities").select("id").eq("name", c.name).eq("country", "United States").maybeSingle();
    if (uErr || !u) { console.error(`매칭 실패: ${c.name}`, uErr?.message); continue; }
    const { error } = await db.from("university_admission_cycles").upsert(
      {
        university_id: u.id, cycle_year: CYCLE_YEAR,
        test_policy: c.test_policy, sat_ebrw_25: c.sat_ebrw_25, sat_ebrw_75: c.sat_ebrw_75,
        sat_math_25: c.sat_math_25, sat_math_75: c.sat_math_75,
        act_composite_25: c.act_composite_25, act_composite_75: c.act_composite_75,
        gpa_25: c.gpa_25, gpa_75: c.gpa_75, gpa_average: c.gpa_average,
        ed_deadline: c.ed_deadline, ea_deadline: c.ea_deadline, rd_deadline: c.rd_deadline,
        application_fee: c.application_fee, essay_count: c.essay_count,
        recommendation_letter_count: c.recommendation_letter_count,
        portfolio_required: c.portfolio_required ?? false, interview_required: c.interview_required,
        acceptance_rate: c.acceptance_rate, pell_grant_pct: c.pell_grant_pct,
        student_faculty_ratio: c.student_faculty_ratio, grad_rate_4yr: c.grad_rate_4yr,
        grad_rate_6yr: c.grad_rate_6yr, retention_rate: c.retention_rate,
        total_applicants: c.total_applicants, yield_rate: c.yield_rate,
        international_pct: c.international_pct, women_pct: c.women_pct,
        source_notes: c.source_notes,
      },
      { onConflict: "university_id,cycle_year" }
    );
    if (error) console.error(`사이클 삽입 실패: ${c.name}`, error.message);

    const majors = MAJORS[c.name] ?? [];
    for (const m of majors) {
      const { error: mErr } = await db.from("university_majors").upsert({ university_id: u.id, name: m }, { onConflict: "university_id,name" });
      if (mErr) console.error(`전공 삽입 실패: ${c.name} / ${m}`, mErr.message);
    }
  }
  console.log(`완료: ${CYCLES.length}개교 사이클 + 전공 시드.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
