// 선생님 시간대 온보딩 — 저장된 profiles.timezone 이 없으면 모든 화면이 LA 로 폴백해
// 가능 시간 입력이 조용히 어긋난다. 안내 문구·판정을 서버 액션과 화면이 함께 쓴다.

export const TEACHER_TIMEZONE_REQUIRED_MESSAGE =
  "가능 시간을 저장하려면 먼저 내 시간대를 설정해 주세요. (계정 메뉴 > 시간대 설정) 시간대가 없으면 입력한 시각이 잘못된 시간대로 저장될 수 있습니다.";

export const TEACHER_TIMEZONE_BANNER_TEXT =
  "시간대가 아직 설정되지 않았습니다. 지금은 임시로 로스앤젤레스 시간으로 표시됩니다. 가능 시간을 등록하려면 먼저 시간대를 저장해 주세요.";
