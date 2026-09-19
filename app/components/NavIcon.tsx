// 2026-09-19(UI 통일화, UAT 반영) — Acely 레퍼런스: 좌측 네비 아이콘을 컬러
// 이모지에서 심플한 라인 아이콘으로 교체한다. 색은 항상 currentColor를 써서
// 비활성(text-grey-300)·활성(text-white) 상태를 부모의 text color만으로 따라간다.
export type NavIconName =
  | "home"
  | "roadmap"
  | "courses"
  | "classes"
  | "teacher"
  | "assignments"
  | "practice"
  | "vocabulary"
  | "materials"
  | "credits"
  | "performance"
  | "mockExam"
  | "students"
  | "matching"
  | "onboarding"
  | "inquiries"
  | "curriculum"
  | "questionBank"
  | "legacyCredits"
  | "entitlements"
  | "schedule"
  | "bookings"
  | "payouts"
  | "documents"
  | "workspace"
  | "availability"
  | "consultations"
  | "users"
  | "settings";

const PATHS: Record<NavIconName, string> = {
  home: "M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9",
  roadmap: "M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1 7 17M17 7l2.1-2.1M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  courses: "M4 6.5A2.5 2.5 0 0 1 6.5 4H14v15H6.5A2.5 2.5 0 0 0 4 21.5v-15ZM14 4h3.5A2.5 2.5 0 0 1 20 6.5v15A2.5 2.5 0 0 0 17.5 19H14",
  classes: "M4.5 5.5h15v14h-15v-14ZM4.5 9.5h15M8 3.5v3M16 3.5v3",
  teacher: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5",
  assignments: "M7.5 4h9a1.5 1.5 0 0 1 1.5 1.5v15L15 18l-3 2.5-3-2.5-3 2.5v-15A1.5 1.5 0 0 1 7.5 4ZM9 8.5h6M9 12h6",
  practice: "M5 4.5h11l3 3v12H5v-15ZM16 4.5v3h3M9 13.5l2 2 4-4.5",
  vocabulary: "M5 4.5h11.5A2.5 2.5 0 0 1 19 7v13H7.5A2.5 2.5 0 0 1 5 17.5v-13ZM8.5 9h6.5M8.5 12.5h6.5",
  materials: "M4 6.2A2.2 2.2 0 0 1 6.2 4H11v16H6.2A2.2 2.2 0 0 1 4 17.8V6.2ZM13 4h4.8A2.2 2.2 0 0 1 20 6.2v11.6a2.2 2.2 0 0 1-2.2 2.2H13",
  credits: "M3.5 6.5h17v11h-17v-11ZM3.5 10h17M7 15h4",
  performance: "M4.5 20v-7M11 20V6M17.5 20v-4",
  mockExam: "M6 3.5h9l3.5 3.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5A1 1 0 0 1 6 3.5ZM15 3.5V7h3.5M8.5 13.5l2 2 4-4.5",
  students: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 19.5c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5M16 10.5a2.75 2.75 0 1 0 0-5.5M18 14.3c2 .5 3 1.9 3 3.7",
  matching: "M8.5 7.5a3.5 3.5 0 1 1 0 7M15.5 16.5a3.5 3.5 0 1 1 0-7M8.5 11h7",
  onboarding: "M12 3.5c-4.7 0-8.5 1.6-8.5 3.5v10c0 1.9 3.8 3.5 8.5 3.5s8.5-1.6 8.5-3.5V7c0-1.9-3.8-3.5-8.5-3.5ZM3.5 7c0 1.9 3.8 3.5 8.5 3.5S20.5 8.9 20.5 7M3.5 12c0 1.9 3.8 3.5 8.5 3.5s8.5-1.6 8.5-3.5",
  inquiries: "M4 5.5h16v11H9l-4 3.5v-3.5h-1v-11ZM8 9.5h8M8 12.5h5",
  curriculum: "M4 5.2A2.2 2.2 0 0 1 6.2 3H19v16.5H6.2A2.2 2.2 0 0 0 4 21.5V5.2ZM4 17.7A2.2 2.2 0 0 1 6.2 15.5H19M8 8h7M8 11h5",
  questionBank: "M5 4.5h14v13l-4 3v-3H5v-13ZM10 9.2a2 2 0 1 1 3 1.7c-.8.5-1 .9-1 1.6M12 15.2h.01",
  legacyCredits: "M3.5 6.5h17v11h-17v-11ZM3.5 10h17M7 15h4",
  entitlements: "M4 8.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 3v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-3v-2ZM9 6.5v11",
  schedule: "M4.5 5.5h15v14h-15v-14ZM4.5 9.5h15M8 3.5v3M16 3.5v3M8 13h2M8 16h2M14 13h2M14 16h2",
  bookings: "M4.5 6.5h15v13h-15v-13ZM4.5 10.5h15M8 4.5v3M16 4.5v3M9.5 15.5l2 2 3.5-4",
  payouts: "M12 3.5v17M16.5 6.8c0-1.5-2-2.3-4.5-2.3s-4.5.9-4.5 2.6c0 3.4 9 1.7 9 5.4 0 1.8-2.1 2.7-4.5 2.7s-4.7-.9-4.9-2.6",
  documents: "M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5A1 1 0 0 1 7 3.5ZM14 3.5V8h4M9 12.5h6M9 16h6",
  workspace: "M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 3.5v2M12 18.5v2M4.6 6.1l1.4 1.4M18 16.5l1.4 1.4M3.5 12h2M18.5 12h2M4.6 17.9l1.4-1.4M18 7.5l1.4-1.4",
  availability: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2",
  consultations: "M4.5 6.5h15v11h-9l-3.5 3v-3h-2.5v-11ZM8 10.5h8M8 13.5h5",
  users: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 19.5c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5M16.2 10.5a2.6 2.6 0 1 0 0-5.2M18.5 14c1.8.5 3 1.9 3 3.8",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5a1.65 1.65 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.65 1.65 0 0 0-1.8-.3 1.65 1.65 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.65 1.65 0 0 0-1.1-1.5 1.65 1.65 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.65 1.65 0 0 0 .3-1.8 1.65 1.65 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.65 1.65 0 0 0 1.5-1 1.65 1.65 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.65 1.65 0 0 0 1.8.3H10a1.65 1.65 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.65 1.65 0 0 0 1 1.5 1.65 1.65 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.65 1.65 0 0 0-.3 1.8V10c.2.7.8 1.2 1.5 1.4h.2a2 2 0 1 1 0 4h-.1a1.65 1.65 0 0 0-1.5 1Z",
};

export default function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "w-[19px] h-[19px]"}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
