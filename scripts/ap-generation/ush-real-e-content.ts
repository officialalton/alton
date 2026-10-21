// US History Stage E(2026-10-19, US3): US3 의 Period 1 공급 부족을 메우는 실제 1차 자료 MC 세트 2개(Harriot 1588 · Treaty of Tordesillas 1494)의 문항 정의(순수 데이터).
// 설계 순서: 자료(레지스트리, data/ap/ush-sources/registry.json)를 먼저 고정 → 스킬 → 정답 근거(자료 안 증거) → 오답 근거(오답마다 틀린 이유) → 확인할 역사 사실.
import type { McSet, Opt } from "./ush-real-c-content";
const o = (text: string, why: string, label: string): Opt => ({ text, why, label });

export const MC_SETS_E: McSet[] = [
  {
    slot: "US3 P1 (new)", exam: "US1", cell: "real_e_harriot", theme: "Native crops and English colonization at Roanoke", title: "Thomas Harriot on Native uses of tobacco, 1588", period: 1, topic: "1.6", sourceId: "txt-harriot-1588", kind: "text",
    intro: "Excerpt from a report published in 1588 by a member of the English expedition that tried to found a colony on Roanoke Island (in present-day North Carolina); the spelling is that of the original printing.",
    difficulty: ["basic_learning", "exam_prep", "exam_prep", "basic_learning"], keyAt: [2, 0, 3, 1],
    items: [
      { skill: "3.A", topic: "1.6", tag: "3A", stem: "Which of the following claims about Vppówoc (tobacco) is made in the excerpt?",
        options: [
          o("The inhabitants valued it for its effects on the body and used it in rituals meant to please their gods.", "The author says the inhabitants dried the leaves and smoked them for health, and that they cast the powder into fires and the air as offerings to their gods.", "key"),
          o("The inhabitants grew it only as a food crop for their villages and never burned or smoked any of it, according to the author.", "The excerpt says the plant was sowed apart and smoked through clay pipes, and describes burning the powder as an offering, so it was not only a food crop.", "reversal"),
          o("The Spaniards of the West Indies had never seen the plant before the English expedition arrived.", "The excerpt says the Spaniards generally call it Tobacco and that it is used in the West Indies, so Europeans already knew it.", "unsupported_by_source"),
          o("Its use was forbidden to ordinary people and reserved for a small group of priests in each village.", "The author says the inhabitants as a whole took the smoke for their health and that the English themselves smoked it; no restriction to priests is mentioned.", "overstated"),
        ], key: 0, facts: ["Thomas Harriot took part in the English expedition to Roanoke Island in 1585-1586 and published A Briefe and True Report in 1588.", "Native peoples of the Americas cultivated and smoked tobacco before European contact."],
        evidence: "dried leaves smoked in clay pipes; precious in esteem because their gods are delighted; powder cast into fires and the air as sacrifice" },
      { skill: "2.A", topic: "1.6", tag: "2A", stem: "The author most likely wrote the report from which the excerpt comes in order to",
        options: [
          o("encourage English investors and settlers to support colonies in North America", "The report describes plants, foods and goods of the region in a favorable way for English readers and was published to build support for colonizing Virginia.", "key"),
          o("persuade the English government to give up its plans for colonizing North America and to concentrate its efforts on trade with the West Indies", "The report praises the region's resources and the author took part in an expedition to settle it, so its purpose was to promote, not end, colonization.", "reversal"),
          o("record the religious beliefs and ceremonies of Spanish settlers living in the West Indies", "The excerpt is about the inhabitants of the region around Roanoke and mentions the Spaniards only to give their name for the plant.", "true_but_not_responsive"),
          o("teach English farmers how to grow and prepare tobacco in the fields of England", "The excerpt describes how the inhabitants use the plant and says nothing about instructions for growing it in England.", "unsupported_by_source"),
        ], key: 0, facts: ["Harriot's report was published in 1588 to promote English colonization of Virginia."],
        evidence: "title and content: a report on the products of the New Found Land of Virginia; favorable description of a valued plant" },
      { skill: "4.A", topic: "1.6", tag: "4A", stem: "Which of the following developments provides the best historical context for the excerpt?",
        options: [
          o("English efforts in the 1580s to found a colony on Roanoke Island, which did not last", "Walter Raleigh sponsored colonies on Roanoke Island in 1585 and 1587; the author took part in the first expedition, and the colony had disappeared by 1590.", "key"),
          o("The founding of the Jamestown settlement in 1607 by the Virginia Company of London, after the Roanoke colonies had failed", "Jamestown was founded in 1607, nearly twenty years after this report was published in 1588.", "wrong_period"),
          o("The arrival of the Pilgrims at Plymouth in 1620 in search of religious freedom for their congregation", "The Pilgrims arrived in 1620, long after the 1588 report.", "wrong_period"),
          o("The Dutch purchase of Manhattan Island from Native Americans in the year 1626", "The Dutch settlement of New Netherland began in the 1620s, decades after the report.", "wrong_period"),
        ], key: 0, facts: ["Roanoke colonies were founded in 1585 and 1587 under Walter Raleigh's patent.", "Jamestown was founded in 1607; Plymouth in 1620."],
        evidence: "(context; the report is dated 1588 and the author describes the inhabitants he met during his stay)" },
      { skill: "1.B", topic: "1.6", tag: "1B", stem: "The excerpt best illustrates which of the following developments in the Atlantic world in the sixteenth century?",
        options: [
          o("Europeans learned about and adopted plants and practices that Native Americans had developed.", "The author reports that the English tried the smoke 'after their maner' and that Spaniards already called the plant Tobacco, showing Europeans adopting a Native American crop and custom.", "key"),
          o("Native Americans adopted European crops and gave up the plants they had grown for many centuries before contact.", "The excerpt describes Europeans taking up a Native American plant, not Native Americans adopting European crops.", "reversal"),
          o("European livestock quickly replaced Native American farming in the region around Roanoke.", "The excerpt mentions no livestock and describes a plant grown by the inhabitants.", "unsupported_by_source"),
          o("Native American religious practices came to an end soon after contact with the English.", "The excerpt describes religious uses of the plant continuing during the author's stay and says nothing about their end.", "overstated"),
        ], key: 0, facts: ["The Columbian Exchange moved crops, animals and diseases between the Americas and Europe; tobacco became an important export crop after English settlement in Virginia."],
        evidence: "the English tried the smoke after the inhabitants' manner; the Spaniards call the plant Tobacco" },
    ],
  },
  {
    slot: "US3 P1 (new)", exam: "US1", cell: "real_e_tordesillas", theme: "Spain, Portugal and the division of newly encountered lands", title: "The Treaty of Tordesillas, 1494", period: 1, topic: "1.3", sourceId: "txt-tordesillas-1494", kind: "text",
    intro: "Excerpt from a treaty between the crowns of Spain and Portugal signed in 1494, after Columbus's first voyage; leagues are units of distance.",
    difficulty: ["basic_learning", "exam_prep", "exam_prep", "basic_learning"], keyAt: [1, 3, 0, 2],
    items: [
      { skill: "3.A", topic: "1.3", tag: "3A", stem: "Which of the following does the treaty provide?",
        options: [
          o("Lands found east of a north-south line in the Atlantic would belong to Portugal, and those west of it to Castile and Aragon.", "The treaty sets a straight line 370 leagues west of the Cape Verde Islands and says lands discovered east of it belong to Portugal and lands west of it to the Spanish crowns.", "key"),
          o("The two crowns would divide all of the lands in the Americas equally between them without drawing any boundary line.", "The treaty relies on a drawn boundary line, not an equal division, and does not mention the Americas by name.", "unsupported_by_source"),
          o("Lands west of the line would belong to Portugal and lands east of it to Castile and Aragon, as the two crowns agreed in the treaty.", "The treaty states the opposite: lands on the eastern side go to Portugal and lands on the western side to Castile and Aragon.", "reversal"),
          o("The native rulers in the lands discovered would decide for themselves which crown they would join.", "The treaty makes the decision between the two crowns and does not mention the wishes of the peoples already living in the lands.", "unsupported_by_source"),
        ], key: 0, facts: ["The Treaty of Tordesillas (1494) drew a north-south line 370 leagues west of the Cape Verde Islands.", "Portugal claimed lands to the east of the line and Spain lands to the west."],
        evidence: "a boundary or straight line... three hundred and seventy leagues west of the Cape Verde Islands; east to Portugal, west to Castile" },
      { skill: "2.A", topic: "1.3", tag: "2A", stem: "The agreement stated in the excerpt most directly reflects which of the following purposes?",
        options: [
          o("To open the newly found lands to settlement and trade by merchants from every kingdom of Europe", "The treaty gives each crown exclusive rights on its own side of the line and does not open the lands to others.", "reversal"),
          o("To spread Protestant teachings to the peoples living on the islands of the Atlantic Ocean", "The treaty is an agreement between two Catholic monarchies about territory, and the Protestant Reformation began only in the next century.", "wrong_period"),
          o("To prevent conflict by settling the competing claims of two crowns to newly found lands", "The text says the controversy over which lands belong to each side is settled 'for the sake of peace and concord' between the two rulers.", "key"),
          o("To set up a trading company that would be owned and run jointly by Spain and Portugal", "The excerpt creates no company; it fixes a boundary and assigns lands to each crown separately.", "unsupported_by_source"),
        ], key: 2, facts: ["Spain and Portugal were rival maritime powers in the late fifteenth century.", "The treaty was an agreement between the two crowns, not a trading company charter."],
        evidence: "for the sake of peace and concord... a boundary or straight line be determined and drawn north and south" },
      { skill: "4.A", topic: "1.3", tag: "4A", stem: "Which of the following developments in the late fifteenth century most directly led to the agreement described in the excerpt?",
        options: [
          o("Portuguese voyages along the coast of Africa and Columbus's Spanish-sponsored voyage created overlapping claims.", "Portuguese exploration of Africa and Columbus's 1492 voyage under the Spanish crowns each opened lands the two kingdoms might claim, which created the dispute the treaty addresses.", "key"),
          o("The founding of English colonies along the Atlantic coast of North America in the late sixteenth century and the early seventeenth century", "English colonies were founded in the late 1500s and 1600s, long after 1494.", "wrong_period"),
          o("The establishment of French fur-trading posts along the St. Lawrence River in the early seventeenth century", "French posts on the St. Lawrence began in the early 1600s, long after 1494.", "wrong_period"),
          o("The growth of the Atlantic slave trade to supply sugar plantations in the Caribbean during the 1700s", "The expansion of the slave trade for Caribbean plantations came in the 1600s and 1700s, long after the treaty.", "wrong_period"),
        ], key: 0, facts: ["Portugal explored the West African coast through the fifteenth century.", "Columbus's first voyage under the Spanish crowns was in 1492."],
        evidence: "the treaty states the dispute concerns lands 'discovered in the ocean sea' up to the date of the treaty, June 7, 1494" },
      { skill: "5.A", topic: "1.3", tag: "5A", stem: "Which of the following later developments is most clearly connected to the arrangement described in the excerpt?",
        options: [
          o("Portugal's colonization of Brazil, east of the line, while Spain colonized much of the rest of Latin America", "Brazil lies partly east of the line, which supported Portugal's claim, while most of the rest of the Americas fell on the western side claimed by Spain.", "key"),
          o("The English decision to honor the line when the Virginia colony was founded in the early 1600s and to avoid Spanish lands", "England was not a party to the treaty, and its colonization of Virginia did not rest on the line.", "misattributed"),
          o("Spain's transfer of the conquered lands of Mexico to Portugal during the sixteenth century", "Spain colonized Mexico after 1519 and kept it; there was no transfer to Portugal.", "unrelated_development"),
          o("France's exclusive right to trade with Native American peoples in the interior of North America", "France was not a party to the treaty and never gained an exclusive trading right in North America.", "misattributed"),
        ], key: 0, facts: ["Portugal claimed Brazil after 1500 and colonized it from the 1530s.", "Spain conquered Mexico in 1519-1521 and colonized much of Central and South America."],
        evidence: "lands east of the line to Portugal; lands west of the line to Castile and Aragon" },
    ],
  },
];
