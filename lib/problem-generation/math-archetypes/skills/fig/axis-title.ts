// 축 제목 "이름 (단위)" 조립 — 이름 안에 단위 단어가 이미 있으면 괄호 단위를 붙이지 않는다(예: "Workouts (workouts)", "Number of people (people)" 방지).
export const titleWith = (name: string, unit: string): string => {
  const n = name.toLowerCase(), u = unit.trim().toLowerCase();
  if (!u || n.includes(u) || n.includes(u.replace(/s$/, ""))) return name;
  return `${name} (${unit})`;
};
