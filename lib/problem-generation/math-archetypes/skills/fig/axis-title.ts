// 축 제목 "이름 (단위)" 조립 — 이름 안에 단위 단어가 이미 있으면 괄호 단위 대신 "Number of …" 로 단위(셈 대상)를 이름에 싣는다.
// 예: "Workouts (workouts)" → "Number of workouts", "Number of people (people)" → "Number of people". G8 검사(titleNamesUnit)는 이 형태를 단위가 있는 제목으로 인정한다.
export const titleWith = (name: string, unit: string): string => {
  const n = name.toLowerCase(), u = unit.trim().toLowerCase();
  if (!u || !(n.includes(u) || n.includes(u.replace(/s$/, "")))) return `${name} (${unit})`;
  if (/^(number|count|amount) of /i.test(name)) return name;
  return `Number of ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
};
/** G8: 축 제목이 단위를 말하는가 — "이름 (단위)" 괄호가 있거나, "Number of …" 처럼 셈 대상을 제목이 직접 말한다. "Time"·"Visitors" 처럼 단위 없는 이름은 거부. */
export const titleNamesUnit = (t: string): boolean => /\([^)]+\)/.test(t) || /^(number|count|amount) of \w/i.test(t.trim());
