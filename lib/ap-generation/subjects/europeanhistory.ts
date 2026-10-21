// AP European History 생성 가이드(2026-10-20): 단원 라벨·MC 스킬·오답 분류. 근거: data/ap/curriculum-2027/ap_european_history.json(AP Central CED·시험 페이지, 2026-10-20 조회).
// World History 와 같이 **모든 자료는 실제 사료·이미지·통계**이고 ALTON 이 쓰지 않는다(오너 정책 2026-10-15). 문항·정답·오답 근거는 고정된 자료에서 설계한다.
export const EURO_UNITS: Record<number, { label: string; years: string; era: number }> = {
  1: { label: "Unit 1: Renaissance and Exploration", years: "c. 1450 to c. 1648", era: 1 }, 2: { label: "Unit 2: Age of Reformation", years: "c. 1450 to c. 1648", era: 1 },
  3: { label: "Unit 3: Absolutism and Constitutionalism", years: "c. 1648 to c. 1815", era: 2 }, 4: { label: "Unit 4: Scientific, Philosophical, and Political Developments", years: "c. 1648 to c. 1815", era: 2 },
  5: { label: "Unit 5: Conflict, Crisis, and Reaction in the Late 18th Century", years: "c. 1648 to c. 1815", era: 2 }, 6: { label: "Unit 6: Industrialization and Its Effects", years: "c. 1815 to c. 1914", era: 3 },
  7: { label: "Unit 7: 19th-Century Perspectives and Political Developments", years: "c. 1815 to c. 1914", era: 3 }, 8: { label: "Unit 8: 20th-Century Global Conflicts", years: "c. 1914 to the present", era: 4 },
  9: { label: "Unit 9: Cold War and Contemporary Europe", years: "c. 1914 to the present", era: 4 },
};
export const EURO_ERA_LABEL: Record<number, string> = { 1: "c. 1450 to c. 1648", 2: "c. 1648 to c. 1815", 3: "c. 1815 to c. 1914", 4: "c. 1914 to the present" };
/** MC 스킬(논증 6.x 제외; CED). */
export const EURO_MC_SKILLS = ["1.A", "1.B", "2.A", "2.B", "2.C", "3.A", "3.B", "3.C", "3.D", "4.A", "4.B", "5.A", "5.B"] as const;
export const EURO_DISTRACTOR_LABELS = ["wrong_period", "reversal", "too_broad", "true_but_not_responsive", "unrelated_development", "misattributed", "unsupported_by_source", "overstated"] as const;
export const EURO_OPTION_COUNT = 4;
export const EURO_BANNED_PHRASES = ["delve", "tapestry", "testament to", "pivotal moment", "rich tapestry", "in today's fast-paced", "plays a crucial role", "navigate the complexities", "a double-edged sword", "it is important to note"];
export const EURO_SOURCE_MARKER = "Historical source (real document)";
