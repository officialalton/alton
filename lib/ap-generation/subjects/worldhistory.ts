// AP World History: Modern 생성 가이드(2026-10-15): 단원 라벨·MC 스킬·오답 분류. 근거: docs/ap/worldhistory-facts.md (CED effective Fall 2026).
// US History 와 달리 **모든 자료는 실제 사료·이미지·통계**이고 ALTON 이 쓰지 않는다(오너 정책 2026-10-15). 문항·정답·오답 근거는 고정된 자료에서 설계한다.
export const WH_UNITS: Record<number, { label: string; years: string; era: number }> = {
  1: { label: "Unit 1: The Global Tapestry", years: "c. 1200 to c. 1450", era: 1 }, 2: { label: "Unit 2: Networks of Exchange", years: "c. 1200 to c. 1450", era: 1 },
  3: { label: "Unit 3: Land-Based Empires", years: "c. 1450 to c. 1750", era: 2 }, 4: { label: "Unit 4: Transoceanic Interconnections", years: "c. 1450 to c. 1750", era: 2 },
  5: { label: "Unit 5: Revolutions", years: "c. 1750 to c. 1900", era: 3 }, 6: { label: "Unit 6: Consequences of Industrialization", years: "c. 1750 to c. 1900", era: 3 },
  7: { label: "Unit 7: Global Conflict", years: "c. 1900 to the present", era: 4 }, 8: { label: "Unit 8: Cold War and Decolonization", years: "c. 1900 to the present", era: 4 }, 9: { label: "Unit 9: Globalization", years: "c. 1900 to the present", era: 4 },
};
export const WH_ERA_LABEL: Record<number, string> = { 1: "c. 1200 to c. 1450", 2: "c. 1450 to c. 1750", 3: "c. 1750 to c. 1900", 4: "c. 1900 to the present" };
/** MC 스킬(논증 6.x 제외; CED p.199). */
export const WH_MC_SKILLS = ["1.A", "1.B", "2.A", "2.B", "2.C", "3.A", "3.B", "3.C", "3.D", "4.A", "4.B", "5.A", "5.B"] as const;
export const WH_DISTRACTOR_LABELS = ["wrong_period", "reversal", "too_broad", "true_but_not_responsive", "unrelated_development", "misattributed", "unsupported_by_source", "overstated"] as const;
export const WH_OPTION_COUNT = 4;
export const WH_BANNED_PHRASES = ["delve", "tapestry", "testament to", "pivotal moment", "rich tapestry", "in today's fast-paced", "plays a crucial role", "navigate the complexities", "a double-edged sword", "it is important to note"];
export const WH_SOURCE_MARKER = "Historical source (real document)";
