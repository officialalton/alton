// US History Stage F LEQ 저점 샘플 교체본(2026-10-21): 기존 r19-f LEQ 의 저점 샘플은 독립 채점기가 4·3점(대역 1-3 초과)으로 매겼다. 질문·루브릭·상·중 샘플은 그대로 두고 저점 샘플만 더 약한 답안으로 바꾼다.
import type { SaqSample } from "./ush-real-a-content";

export const LEQ_LOW: SaqSample = {
  tier: "low",
  essay: `The American Revolution changed political life more than it changed social life. Americans got rid of a king and created governments based on the people, but many groups still did not get equal rights. So the Revolution was a big political change but only a small social change.

After the Revolution the states wrote their own constitutions. This was a big change because before the war the colonies had a king. The new national government also did not have a king, and a lot of people were excited about liberty and about governing themselves.

However, social life did not change as much for many people. Slavery kept going in the South and many African Americans stayed enslaved. Women were mostly expected to stay at home, and other groups also saw little change.

In conclusion, the Revolution changed the way the country was governed, but it did not change society as much because many people were left out of the new freedoms. The political change was large and the social change was limited.`,
  annotations: [
    { quote: "The American Revolution changed political life more than it changed social life.", comment: "Defensible claim about the extent of change that separates political change from social change and sets up a line of reasoning. Earns the thesis point.", row_id: "a" },
    { quote: "After the Revolution the states wrote their own constitutions.", comment: "Names state constitutions only in general terms, with no specific state or provision, so it is not developed evidence.", row_id: "a" },
    { quote: "a lot of people were excited about liberty and about governing themselves", comment: "A vague statement, not a described historical context. There is no mention of British policies after 1763, Enlightenment ideas, or colonial assemblies, so contextualization earns nothing.", row_id: "a" },
    { quote: "Slavery kept going in the South and many African Americans stayed enslaved.", comment: "Notes continuity but only states it. It does not explain why change was limited or how groups differed, so reasoning stays at a basic level.", row_id: "a" },
  ],
};
