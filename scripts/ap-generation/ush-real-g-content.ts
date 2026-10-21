// US History Stage G 콘텐츠(2026-10-21, US3 MC 전환): US3 의 ALTON 작성 MC 14세트를 실제 사료 세트로 교체하는 문항 정의(순수 데이터).
// 설계 순서: 자료(레지스트리 data/ap/ush-sources/registry.json)를 먼저 고정 → 스킬 → 정답 근거(자료 안 증거) → 오답 근거(오답마다 틀린 이유) → 확인할 역사 사실.
// 칸 크기·시대(단원)·스킬 범주·난이도 라벨은 교체되는 세트와 같다(원본 u201 등의 문항별 skill 범주와 topic 단원을 유지). 자료 유형은 1차 11 · 2차 2(Beard, Turner) · 짝 1(Nullification) · 정량 1(도시 인구)로 시험 구성 최소를 지킨다.
// 학생 화면 자료 문안은 코드(lib/ap-generation/ush-real-saq.ts realSaqPassage)가 레지스트리에서 만든다 — 여기에는 자료 순서와 ALTON 이 쓴 한 줄 context(사실만)만 둔다.
import type { McItem, Opt } from "./ush-real-c-content";
export type McSetG = {
  slot: string; cell: string; theme: string; title: string; period: number; topic: string; stim: "primary_text" | "secondary_text" | "paired_text" | "quantitative";
  order: { id: string; context: string }[]; difficulty: ("basic_learning" | "exam_prep")[]; keyAt: number[]; items: McItem[];
};
const o = (text: string, why: string, label: string): Opt => ({ text, why, label });

export const MC_SETS_G: McSetG[] = [
  // ───── u201 · 시대 2 · Franklin on Whitefield ─────
  {
    slot: "US3 u201", cell: "real_g_whitefield", theme: "Whitefield and the Great Awakening in Philadelphia", title: "Benjamin Franklin on George Whitefield, 1739", period: 2, topic: "2.7", stim: "primary_text",
    order: [{ id: "txt-franklin-whitefield-1771", context: "Franklin recalled Whitefield's 1739 visit to Philadelphia in an autobiography he wrote decades later; Whitefield actually arrived from England, not Ireland as Franklin writes." }],
    difficulty: ["basic_learning", "exam_prep", "exam_prep"], keyAt: [1, 3, 0],
    items: [
      { skill: "3.B", topic: "2.7", tag: "3B", stem: "Which of the following claims about George Whitefield's preaching does Franklin make in the excerpt?",
        options: [
          o("Whitefield's audiences came from many denominations and his preaching changed religious habits in the town.", "Franklin says crowds of all sects and denominations attended and that the town changed from indifference to religion to families singing psalms in the evening.", "key"),
          o("Whitefield's preaching failed to draw listeners once the town's clergy refused him the use of their pulpits.", "Franklin says the clergy refused him their pulpits and he then preached in the fields to enormous multitudes, so the refusal did not end his audience.", "reversal"),
          o("Whitefield's sermons persuaded Franklin to leave his printing work and to join the ministry in Philadelphia.", "The excerpt reports Franklin as an observer among the crowd and says nothing about any change in his own work or career.", "unsupported_by_source"),
          o("Whitefield's preaching united every Christian church in Philadelphia into a single denomination under one pulpit.", "Franklin describes people of all sects attending but never says the churches merged; the excerpt reports a change in manners, not a union of churches.", "overstated"),
        ], key: 0, facts: ["George Whitefield was an Anglican minister and itinerant preacher who toured the colonies in 1739-1741.", "Whitefield preached outdoors to large crowds when many established clergy refused him their pulpits.", "Franklin's Autobiography was written between 1771 and 1790."],
        evidence: "'The multitudes of all sects and denominations that attended his sermons were enormous'; 'one could not walk thro' the town in an evening without hearing psalms sung'" },
      { skill: "4.A", topic: "2.7", tag: "4A", stem: "Which of the following developments in the 1730s and 1740s provides the best historical context for the excerpt?",
        options: [
          o("The Salem witch trials, which had made colonists distrust itinerant preachers and emotional religion", "The Salem witch trials took place in 1692, decades before Whitefield's tour, and they did not shape colonists' reception of revival preaching in 1739.", "wrong_period"),
          o("The Stamp Act protests, which had united the colonies in opposition to British taxes on printed materials", "The Stamp Act protests came in the 1760s, more than twenty years after the events Franklin describes.", "wrong_period"),
          o("A wave of religious revivals, later called the Great Awakening, that spread through the British colonies", "Whitefield's tour in 1739-1741 was one of the main events of the Great Awakening, a wave of emotional religious revivals in the colonies.", "key"),
          o("The Second Great Awakening, which spread across the Northeast and the western frontier after 1800", "The Second Great Awakening began around 1800, long after Whitefield's 1739 visit.", "wrong_period"),
        ], key: 2, facts: ["The First Great Awakening was a series of religious revivals in the British colonies in the 1730s and 1740s.", "The Second Great Awakening began around 1800."],
        evidence: "(context; the excerpt places Whitefield's arrival in 1739 and describes crowds and a sudden growth of religious practice)" },
      { skill: "1.B", topic: "2.7", tag: "1B", stem: "Which of the following was an effect of the religious movement that Franklin describes?",
        options: [
          o("Colonists divided over whether the authority of established clergy should be challenged, and new congregations grew.", "Franklin shows established clergy refusing Whitefield their pulpits while crowds of all sects came; historians add that revival preaching divided congregations into supporters and opponents and increased the growth of Baptist, Presbyterian and other new congregations.", "key"),
          o("Colonial governments ended all public support for churches throughout British North America before 1750.", "Several colonies kept established churches after the revivals, and no colony ended all public support for religion by 1750.", "overstated"),
          o("Most colonists abandoned religious worship in favor of Enlightenment reasoning about the natural world.", "The excerpt describes a rise in religious practice, and the revivals increased church membership rather than reducing worship.", "reversal"),
          o("The British government created a single established church to govern the religious life of every one of its colonies in America.", "Britain did not create one established church for all the colonies, and the revivals encouraged religious variety instead of uniformity.", "unrelated_development"),
        ], key: 0, facts: ["The Great Awakening divided congregations into 'New Lights' who supported revivals and 'Old Lights' who opposed them.", "Revivals contributed to the growth of Baptist and Presbyterian churches."],
        evidence: "the clergy 'soon refus'd him their pulpits' and he 'was oblig'd to preach in the fields'; 'multitudes of all sects and denominations' attended (the excerpt shows established clergy resisting the revival)" },
    ],
  },
  // ───── u309 · 시대 3 · Northwest Ordinance ─────
  {
    slot: "US3 u309", cell: "real_g_nworder", theme: "The Northwest Ordinance and slavery", title: "The Northwest Ordinance, 1787", period: 3, topic: "3.7", stim: "primary_text",
    order: [{ id: "txt-nworder-1787", context: "Passed by the Confederation Congress on July 13, 1787, while the Constitutional Convention met in Philadelphia; it set rules for governing the territory north of the Ohio River." }],
    difficulty: ["exam_prep", "basic_learning", "exam_prep", "exam_prep"], keyAt: [3, 0, 2, 1],
    items: [
      { skill: "2.B", topic: "3.7", tag: "2B", stem: "Which of the following best explains why Article 6 provides limited evidence of a national consensus against slavery?",
        options: [
          o("It applied only to one territory, and it also allowed fugitives from the original states to be reclaimed.", "Article 6 banned slavery only in the territory northwest of the Ohio and included a clause allowing fugitives from the original states to be reclaimed and conveyed to the person claiming their labor, so it was a limited step.", "key"),
          o("It was written after the Constitution had been ratified, when many states had already abolished slavery.", "The Ordinance was passed in July 1787, before the Constitution was ratified, and most states still allowed slavery in 1787.", "wrong_period"),
          o("It was drafted by delegates from slaveholding states who wanted to encourage the spread of slavery north of the Ohio.", "Article 6 prohibits slavery in the territory, which opposes that purpose, and the excerpt does not identify its drafters.", "misattributed"),
          o("It allowed settlers in each new state to vote on whether slavery should be permitted after statehood.", "Article 6 as excerpted contains no vote by settlers; it states that there shall be neither slavery nor involuntary servitude in the territory.", "reversal"),
        ], key: 0, facts: ["The Northwest Ordinance of 1787 banned slavery in the territory northwest of the Ohio River.", "Article 6 allowed escaped enslaved people to be reclaimed by claimants from the original states."],
        evidence: "Art. 6: 'neither slavery nor involuntary servitude in the said territory' with the proviso on fugitives from 'any one of the original States'" },
      { skill: "3.B", topic: "3.7", tag: "3B", stem: "Which of the following claims is supported by evidence in the excerpt?",
        options: [
          o("Congress pledged good faith toward Native Americans and promised not to take their lands without their consent.", "Article 3 says the utmost good faith shall always be observed towards the Indians and that their lands and property shall never be taken from them without their consent.", "key"),
          o("Congress required each new state to build public schools paid for by a federal tax.", "Article 3 says schools and education 'shall forever be encouraged'; it does not require them or create a federal tax to pay for them.", "overstated"),
          o("Congress gave Native Americans a share in governing the new territory through a standing council of their own chiefs.", "The excerpt describes obligations toward Native Americans and says nothing about giving them a role in government.", "unsupported_by_source"),
          o("Congress allowed slavery in the territory as long as a majority of its white settlers approved it.", "Article 6 prohibits slavery and involuntary servitude in the territory, and no vote of settlers is mentioned.", "reversal"),
        ], key: 0, facts: ["Article 3 of the Northwest Ordinance encouraged schools and promised good faith toward Native Americans.", "Despite the pledge, the United States took much of the Native lands in the Northwest Territory through war and treaties."],
        evidence: "Art. 3: 'The utmost good faith shall always be observed towards the Indians; their lands and property shall never be taken from them without their consent'" },
      { skill: "4.B", topic: "3.7", tag: "4B", stem: "The provisions in the excerpt are best understood in the context of which of the following?",
        options: [
          o("The Louisiana Purchase, which doubled the size of the United States", "The Ordinance was passed in 1787, sixteen years before the Louisiana Purchase of 1803, and it applied to land north of the Ohio River.", "wrong_period"),
          o("Southern demands for stronger enforcement of the Fugitive Slave Act of 1850", "The Fugitive Slave Act of 1850 came more than sixty years later; Article 6's fugitive clause belongs to the 1780s.", "wrong_period"),
          o("The need to organize and govern the western lands that the United States claimed after the Revolution", "After the Treaty of Paris of 1783 the new nation claimed land west of the Appalachians, and Congress needed rules for governing it and creating new states.", "key"),
          o("The Missouri Compromise, which set a line dividing the free and slave areas of the Louisiana Territory in the 1820s", "The Missouri Compromise was reached in 1820, more than thirty years after the Ordinance.", "wrong_period"),
        ], key: 2, facts: ["The Treaty of Paris of 1783 recognized U.S. claims west to the Mississippi River.", "The Northwest Ordinance set out a process by which territories could become states."],
        evidence: "(context; the document sets out rules for governing 'the said territory')" },
      { skill: "5.B", topic: "4.12", tag: "5B", stem: "Which of the following later developments most directly built on the approach that Article 6 took toward slavery in new territory?",
        options: [
          o("The Dred Scott decision, which held that Congress could not ban slavery in the territories", "The Dred Scott decision of 1857 reached the opposite conclusion, denying Congress the power that Article 6 exercised.", "reversal"),
          o("The Missouri Compromise, which banned slavery in most of the Louisiana Territory north of a set line", "The Missouri Compromise used congressional power to bar slavery in part of the western territory, as Article 6 had done for the Northwest Territory.", "key"),
          o("The Emancipation Proclamation, which freed all enslaved people everywhere in the United States at once in 1863", "The Emancipation Proclamation applied only to areas in rebellion in 1863 and did not free all enslaved people in the nation.", "overstated"),
          o("The Compromise of 1877, which ended federal efforts to protect Black voters in the South", "The Compromise of 1877 concerned the end of Reconstruction, not the status of slavery in new territories.", "unrelated_development"),
        ], key: 1, facts: ["The Missouri Compromise of 1820 banned slavery in the Louisiana Territory north of latitude 36 degrees 30 minutes, except Missouri.", "The Supreme Court decided Dred Scott v. Sandford in 1857."],
        evidence: "Art. 6: slavery barred 'in the said territory' by act of Congress" },
    ],
  },
  // ───── u310 · 시대 3 · Beard (2차) ─────
  {
    slot: "US3 u310", cell: "real_g_beard", theme: "Beard and the economic interpretation of the Constitution", title: "Charles Beard on the Making of the Constitution, 1913", period: 3, topic: "3.8", stim: "secondary_text",
    order: [{ id: "txt-beard-1913", context: "From the conclusion of a book published in 1913 by a Columbia University political scientist and historian; later historians disputed parts of its evidence." }],
    difficulty: ["basic_learning", "exam_prep", "exam_prep", "exam_prep"], keyAt: [0, 2, 1, 3],
    items: [
      { skill: "3.A", topic: "3.8", tag: "3A", stem: "Which of the following best states Beard's main argument in the excerpt?",
        options: [
          o("The Constitution was shaped largely by delegates with property interests that it protected, not by the will of the whole people.", "Beard says the framers were personally interested in the economic advantages of the new system and that the Constitution was not created by 'the whole people.'", "key"),
          o("The Constitution was written mainly to protect the interests of small farmers and debtors against the demands of wealthy creditors.", "Beard argues the opposite: he says the Constitution rests on the idea that property rights are beyond the reach of popular majorities and that the framers derived economic advantages from it.", "reversal"),
          o("The Constitution was created by the states acting as independent sovereign governments joining a compact.", "Beard rejects this view, stating that the Constitution was not created by 'the states' as Southern nullifiers contended.", "misattributed"),
          o("The delegates to the Philadelphia Convention had little personal stake in the economic effects of the document.", "Beard says the delegates were, with few exceptions, directly and personally interested in the economic advantages of the new system.", "reversal"),
        ], key: 0, facts: ["Charles Beard published An Economic Interpretation of the Constitution of the United States in 1913.", "Beard's interpretation was widely debated and later challenged by other historians."],
        evidence: "'immediately, directly, and personally interested in, and derived economic advantages from, the establishment of the new system'; 'not created by \"the whole people\"'" },
      { skill: "3.D", topic: "3.8", tag: "3D", stem: "Which of the following does Beard offer as evidence for his claim about how the Constitution was ratified?",
        options: [
          o("A majority of the voters in every one of the state convention elections voted against ratification of the Constitution in 1788.", "Beard does not make this claim; he says about three-fourths of adult males did not vote, and he describes the elections' outcomes only in terms of who participated.", "overstated"),
          o("Delegates to the state conventions were chosen in elections open to all adult men and women.", "Beard says many adult men were disfranchised by property qualifications, so the elections were not open to all adults.", "reversal"),
          o("Most adult men did not vote for convention delegates, because they stayed away or were excluded by property qualifications.", "Beard says about three-fourths of adult males failed to vote, either from indifference or because property qualifications disfranchised them.", "key"),
          o("Congress ratified the Constitution by its own vote without any elections or conventions in the states.", "The excerpt describes elections for state conventions, so ratification did not occur by a vote of Congress alone.", "unsupported_by_source"),
        ], key: 2, facts: ["The Constitution was ratified by conventions in the states, not by Congress or by a direct national vote.", "Most states limited voting to men who owned property or paid taxes in the 1780s."],
        evidence: "'about three-fourths of the adult males failed to vote ... either on account of their indifference or their disfranchisement by property qualifications'" },
      { skill: "4.B", topic: "3.8", tag: "4B", stem: "Beard's interpretation is best understood in the context of which of the following?",
        options: [
          o("The Cold War, when many historians stressed American unity and a consensus about liberty", "The Cold War began after World War II, decades after Beard published in 1913.", "wrong_period"),
          o("The debates of 1787 and 1788, when Federalists and Anti-Federalists argued over whether to ratify the Constitution", "Beard wrote in 1913, not during the ratification debates, although he wrote about those debates.", "wrong_period"),
          o("The Progressive Era, when reformers and scholars questioned how business interests influenced government", "Beard wrote in 1913, during the Progressive Era, when reformers and scholars were examining the influence of economic interests on politics.", "key"),
          o("Reconstruction, when Congress argued over the rights of formerly enslaved people", "Reconstruction ended in 1877, decades before Beard's book appeared.", "wrong_period"),
        ], key: 2, facts: ["The Progressive Era (about 1890-1920) was a period of reform that criticized the power of business over politics.", "Beard published his book in 1913."],
        evidence: "(context; the book is dated 1913 and argues that economic interests shaped the framers' choices)" },
      { skill: "5.B", topic: "3.8", tag: "5B", stem: "Which of the following arguments is most similar in method to Beard's way of explaining the Constitution?",
        options: [
          o("An argument that the Dust Bowl was caused mainly by drought and poor farming practices", "That argument concerns an environmental disaster and does not explain political action by pointing to the economic interests of those involved.", "unrelated_development"),
          o("An argument that trusts and railroads controlled state legislatures through their money and influence", "Like Beard, this argument explains political outcomes by the economic interests influencing officeholders, a common approach in the Progressive Era.", "key"),
          o("An argument that the Pilgrims came to Plymouth mainly to escape religious persecution", "That argument explains an event by religious motives, not by the economic interests of those involved.", "unrelated_development"),
          o("An argument that Lincoln issued the Emancipation Proclamation to hold the support of the European powers in the war", "That argument explains a decision by wartime diplomacy and military needs rather than by the economic interests of a particular group.", "unrelated_development"),
        ], key: 1, facts: ["Progressive Era writers such as muckrakers argued that business interests controlled many legislatures."],
        evidence: "Beard explains the framers' actions by their economic interests" },
    ],
  },
  // ───── u420 · 시대 4 · Northup ─────
  {
    slot: "US3 u420", cell: "real_g_northup", theme: "Cotton and enslaved labor in the Deep South", title: "Solomon Northup on a Day in the Cotton Field", period: 4, topic: "4.13", stim: "primary_text",
    order: [{ id: "txt-northup-1853", context: "Northup, born free in New York, was kidnapped in 1841 and held in slavery in Louisiana until 1853; his narrative, published that year, was written with the help of a white lawyer and writer." }],
    difficulty: ["exam_prep", "basic_learning", "exam_prep", "exam_prep"], keyAt: [2, 0, 3, 1],
    items: [
      { skill: "2.A", topic: "4.13", tag: "2A", stem: "The narrative from which the excerpt comes was most likely published in order to",
        options: [
          o("defend slavery by showing that enslaved workers were treated fairly", "The excerpt describes fear, long hours and the threat of suffering for a shortfall, which condemn slavery rather than defend it.", "reversal"),
          o("advise planters on how to raise the amount of cotton produced in each field", "The excerpt describes the experience of enslaved workers and offers no advice to planters on increasing output.", "unsupported_by_source"),
          o("inform Northern readers about enslaved life and build opposition to slavery", "A free-born man's account of his enslavement, published in 1853, was addressed to readers outside the South and exposed the brutality of the system.", "key"),
          o("describe his experiences as a free farmer who had moved to Louisiana", "Northup was kidnapped and held in slavery in Louisiana; he did not live there as a free farmer.", "unsupported_by_source"),
        ], key: 2, facts: ["Solomon Northup was kidnapped in 1841 and freed in 1853.", "Slave narratives published in the 1840s and 1850s helped build Northern opposition to slavery."],
        evidence: "the excerpt details the fear, long hours and threat of suffering for enslaved cotton pickers" },
      { skill: "3.B", topic: "4.12", tag: "3B", stem: "Which detail in the excerpt best supports the claim that enslaved workers worked under constant pressure and threat of punishment?",
        options: [
          o("Workers approached the gin-house with fear because a shortfall in the day's weight meant suffering.", "Northup says a slave never approaches the gin-house with his basket without fear because he knows that if he has not performed the full task, he must suffer.", "key"),
          o("Workers were given a full hour at midday to rest and eat their meal in the quarters.", "The excerpt says workers had only ten or fifteen minutes at noon to swallow cold bacon.", "reversal"),
          o("Workers were measured by the number of hours they worked rather than by the weight of the cotton picked.", "The excerpt describes weighing each worker's basket at the gin-house to see whether the full task was done.", "unsupported_by_source"),
          o("Workers were allowed to leave the field as soon as they finished their own tasks for the day.", "The excerpt says workers did not dare stop or leave until the driver gave the order to halt.", "reversal"),
        ], key: 0, facts: ["Cotton pickers on large plantations were often assigned daily quotas measured by weight.", "Overseers and drivers used whipping to enforce work."],
        evidence: "'a slave never approaches the gin-house with his basket of cotton but with fear. If it falls short in weight ... he knows that he must suffer'" },
      { skill: "4.B", topic: "4.5", tag: "4B", stem: "The conditions described in the excerpt are best understood in the context of which of the following developments?",
        options: [
          o("The decline of slavery in the South after the end of the legal Atlantic slave trade in 1808, as planters moved to free labor", "Slavery grew rather than declined in the South after 1808, as cotton production expanded.", "reversal"),
          o("The adoption of wage labor in Southern cotton fields after the Civil War", "Wage and sharecropping arrangements in cotton fields came after 1865, after Northup's account.", "wrong_period"),
          o("The settlement of small family farms across the Southwest during the colonial period", "The Louisiana cotton plantations in the excerpt developed in the nineteenth century, not in the colonial period.", "wrong_period"),
          o("The expansion of cotton production in the Deep South, which increased the demand for enslaved labor", "The cotton gin and rising world demand for cotton made large cotton plantations in the Deep South profitable and increased demand for enslaved workers.", "key"),
        ], key: 3, facts: ["Eli Whitney patented the cotton gin in 1794.", "Cotton production spread across the Deep South in the first half of the nineteenth century.", "The importation of enslaved people from abroad was banned in 1808."],
        evidence: "(context; cotton picking, gin-house, plantation labor in Louisiana in the 1840s)" },
      { skill: "1.B", topic: "4.13", tag: "1B", stem: "Which of the following was a result of the system of labor described in the excerpt?",
        options: [
          o("A domestic slave trade that moved large numbers of enslaved people from the Upper South to the Deep South", "Demand for labor on cotton plantations in the Deep South led slaveholders in the Upper South to sell enslaved people southward, separating many families.", "key"),
          o("A shortage of cotton that led the British government to stop buying cotton from the American South well before 1860", "British mills continued to buy large amounts of Southern cotton until the Civil War.", "reversal"),
          o("The gradual end of slavery in Louisiana through state laws passed in the 1840s", "Louisiana did not pass laws ending slavery in the 1840s; slavery there continued until the Civil War.", "reversal"),
          o("A large movement of white Southerners out of the cotton states into the industrial North", "The cotton economy kept most white Southerners in the South, and many moved west within the region.", "unrelated_development"),
        ], key: 0, facts: ["Hundreds of thousands of enslaved people were sold from the Upper South to the Deep South between 1800 and 1860."],
        evidence: "the plantation work described depends on a large enslaved labor force" },
    ],
  },
  // ───── u422 · 시대 4 · Nullification (짝) ─────
  {
    slot: "US3 u422", cell: "real_g_nullification", theme: "The Nullification Crisis", title: "South Carolina and President Jackson on Nullification, 1832", period: 4, topic: "4.8", stim: "paired_text",
    order: [
      { id: "txt-sc-ordinance-1832", context: "Adopted by a convention in South Carolina on November 24, 1832, in response to the federal tariffs of 1828 and 1832; the titles of the two tariff acts have been omitted from the middle of the excerpt." },
      { id: "txt-jackson-proclamation-1832", context: "Issued by President Jackson on December 10, 1832, sixteen days after the South Carolina convention acted." },
    ],
    difficulty: ["exam_prep", "exam_prep", "basic_learning"], keyAt: [2, 0, 3],
    items: [
      { skill: "3.C", topic: "4.8", tag: "3C", stem: "Which of the following best describes a major difference between Source A and Source B?",
        options: [
          o("Source A defends the tariff of 1832 as constitutional, while Source B attacks the tariff as unfair to the South.", "Source A attacks the tariffs as unconstitutional and Source B does not defend or attack the tariff in the excerpt; it addresses the power to annul laws.", "reversal"),
          o("Source A claims a state may declare a federal law void within its borders, while Source B says no state has such a power.", "Source A declares the tariff acts 'null, void, and no law' in South Carolina; Source B calls the power of one state to annul a federal law incompatible with the Union.", "key"),
          o("Source A describes the Union as a perpetual bond among the people, while Source B argues that states may leave the Union.", "The excerpts show the reverse: Source A claims a state's power to nullify, and Source B argues that such a power destroys the Union.", "reversal"),
          o("Source A argues that the tariffs violate the Constitution, while Source B argues that the tariffs are constitutional and should be repealed.", "Source B does not argue for repealing the tariffs in the excerpt; it rejects the power of a state to annul any federal law.", "overstated"),
        ], key: 1, facts: ["South Carolina's convention declared the tariffs of 1828 and 1832 null and void within the state.", "Jackson's proclamation rejected the right of a state to nullify federal law."],
        evidence: "A: 'are null, void, and no law, nor binding upon this State'; B: 'the power to annul a law of the United States, assumed by one State, incompatible with the existence of the Union'" },
      { skill: "3.D", topic: "4.8", tag: "3D", stem: "In Source B, Jackson supports his claim about nullification by arguing that it is",
        options: [
          o("justified whenever three-fourths of the states approve a state convention's action", "Source B contains no such rule; it denies that one state may annul a federal law.", "unsupported_by_source"),
          o("a fair response to an unfair tax if a state convention approves it", "That is the argument of Source A; Jackson rejects it.", "misattributed"),
          o("contradicted by the letter of the Constitution and destructive of the purpose for which the Union was formed", "Jackson says the power is 'contradicted expressly by the letter of the Constitution' and 'destructive of the great object for which it was formed.'", "key"),
          o("a power that the Constitution gives only to the federal courts in cases involving the collection of tariffs from the states", "The excerpt does not mention federal courts or give them a special power over tariffs.", "unsupported_by_source"),
        ], key: 2, facts: ["Jackson issued the Proclamation to South Carolina on December 10, 1832.", "Congress passed the Force Bill in early 1833 authorizing the president to use force to enforce the tariff."],
        evidence: "'contradicted expressly by the letter of the Constitution, unauthorized by its spirit ... destructive of the great object for which it was formed'" },
      { skill: "4.B", topic: "4.8", tag: "4B", stem: "The disagreement between Source A and Source B is best understood in the context of which of the following?",
        options: [
          o("A dispute over the admission of Missouri as a slave state", "That dispute ended in 1820, twelve years before these documents.", "wrong_period"),
          o("Southern objections to federal tariffs that many believed favored Northern manufacturers", "South Carolina's ordinance attacks the tariffs of 1828 and 1832 as laws meant to protect manufacturing at the expense of other classes.", "key"),
          o("A debate over whether to go to war with Mexico over the Texas border", "The Mexican-American War came in the 1840s, after the documents.", "wrong_period"),
          o("A conflict over the rights of formerly enslaved people during the years of Reconstruction after the Civil War", "Reconstruction followed the Civil War, more than thirty years after these documents.", "wrong_period"),
        ], key: 1, facts: ["Congress passed protective tariffs in 1828 and 1832.", "South Carolina's leaders, including John C. Calhoun, argued that states could nullify federal laws they judged unconstitutional."],
        evidence: "A: the acts are 'intended for the protection of domestic manufactures' (as the ordinance's own words show before the segment cut)" },
    ],
  },
  // ───── u529 · 시대 5 · Fourteenth Amendment ─────
  {
    slot: "US3 u529", cell: "real_g_14th", theme: "The Fourteenth Amendment", title: "The Fourteenth Amendment, 1868", period: 5, topic: "5.10", stim: "primary_text",
    order: [{ id: "txt-14th-amendment-1868", context: "Proposed by Congress in June 1866 and ratified in July 1868; the excerpt gives parts of Sections 1 and 2." }],
    difficulty: ["basic_learning", "exam_prep", "exam_prep", "exam_prep"], keyAt: [0, 2, 3, 1],
    items: [
      { skill: "3.B", topic: "5.10", tag: "3B", stem: "Which of the following provisions appears in Section 1 as excerpted?",
        options: [
          o("A guarantee that no state may deny any person within its jurisdiction the equal protection of the laws", "Section 1 states that no State shall 'deny to any person within its jurisdiction the equal protection of the laws.'", "key"),
          o("A guarantee that no state may deny male citizens the right to vote because of their race or because of their color", "The excerpt does not contain this provision; a ban on racial discrimination in voting appears in the Fifteenth Amendment.", "unsupported_by_source"),
          o("A prohibition on slavery and involuntary servitude anywhere in the United States", "The excerpt does not contain this provision; it appears in the Thirteenth Amendment.", "unsupported_by_source"),
          o("A requirement that every new state enter the Union as a free state", "The excerpt contains no rule about admitting new states or about slavery in new states.", "unsupported_by_source"),
        ], key: 0, facts: ["The Thirteenth Amendment (1865) abolished slavery.", "The Fifteenth Amendment (1870) barred denying the vote because of race.", "The Fourteenth Amendment (1868) defined citizenship and guaranteed equal protection and due process."],
        evidence: "Section 1: 'nor deny to any person within its jurisdiction the equal protection of the laws'" },
      { skill: "3.D", topic: "5.10", tag: "3D", stem: "Which of the following best describes the effect of Section 2 as written?",
        options: [
          o("It counted each enslaved person as three-fifths of a person when apportioning seats in the House.", "Section 2 says representatives are apportioned by counting the whole number of persons in each state, replacing the three-fifths rule.", "reversal"),
          o("It forbade former Confederate officials from holding any federal or state office after the war.", "The excerpt does not contain this rule; a restriction on office-holding by some former Confederate officials appears in Section 3, which is not excerpted.", "unsupported_by_source"),
          o("It reduced a state's representation if the state denied the vote to eligible adult male citizens.", "Section 2 says that when the vote is denied to adult male citizens, the basis of representation shall be reduced in proportion to the number denied.", "key"),
          o("It guaranteed the vote to all women who were citizens of the United States and over twenty-one.", "Section 2 refers to male inhabitants and male citizens; women did not receive a national guarantee of the vote until later.", "reversal"),
        ], key: 2, facts: ["The three-fifths clause in the original Constitution counted three-fifths of enslaved people for representation.", "Section 2 of the Fourteenth Amendment threatened to reduce a state's representation if it denied the vote to adult male citizens."],
        evidence: "Section 2: 'the basis of representation therein shall be reduced in the proportion which the number of such male citizens shall bear to the whole number of male citizens twenty-one years of age'" },
      { skill: "4.B", topic: "5.10", tag: "4B", stem: "The amendment is best understood in the context of which of the following developments?",
        options: [
          o("Efforts by Congress in 1820 to balance the number of free and slave states in the Union", "Those efforts occurred nearly fifty years before the amendment was ratified in 1868.", "wrong_period"),
          o("Efforts by Progressive reformers after 1900 to regulate large corporations and protect consumers and workers from abuse", "Progressive reform came decades after the amendment.", "wrong_period"),
          o("Efforts by the Confederacy to win diplomatic recognition from Britain and France during the war", "The amendment followed the Civil War and concerned citizenship and rights, not Confederate diplomacy.", "unrelated_development"),
          o("Efforts by Congress after the Civil War to protect freed people after Southern states passed the Black Codes", "Black Codes passed in 1865 and 1866 limited the rights of freed people, and Congress responded with the Fourteenth Amendment and other Reconstruction measures.", "key"),
        ], key: 3, facts: ["The Black Codes of 1865-1866 restricted the rights and labor choices of freed people.", "Congress passed the Civil Rights Act of 1866 and proposed the Fourteenth Amendment in 1866."],
        evidence: "(context; Section 1 defines citizenship and equal protection after the end of slavery)" },
      { skill: "5.A", topic: "6.4", tag: "5A", stem: "Which of the following later developments most clearly shows a limit on the protections in Section 1 in the late nineteenth century?",
        options: [
          o("The Supreme Court's Plessy v. Ferguson decision, which upheld segregated railroad cars as separate but equal", "Plessy v. Ferguson (1896) held that state laws requiring separate facilities did not violate the equal protection clause, which limited its reach for Black Americans.", "key"),
          o("The Fifteenth Amendment, which barred states from denying the vote because of race", "The Fifteenth Amendment expanded protection for voting rights; it did not limit the Fourteenth Amendment.", "true_but_not_responsive"),
          o("The Emancipation Proclamation, which declared enslaved people in the areas in rebellion to be free in January 1863 during the war", "The Emancipation Proclamation of 1863 came before the Fourteenth Amendment.", "wrong_period"),
          o("The Supreme Court's decision in Brown v. Board of Education, which ended school segregation", "Brown v. Board of Education was decided in the mid-twentieth century and applied the amendment to end school segregation, so it expanded rather than limited the protection.", "wrong_period"),
        ], key: 0, facts: ["Plessy v. Ferguson (1896) upheld 'separate but equal' public facilities.", "Brown v. Board of Education (1954) held that segregated public schools were unconstitutional."],
        evidence: "Section 1: 'equal protection of the laws' (the limit appears in later Court rulings)" },
    ],
  },
  // ───── u509 · 시대 5 · Hayes inaugural ─────
  {
    slot: "US3 u509", cell: "real_g_hayes", theme: "Hayes and the end of Reconstruction", title: "President Hayes on the South, 1877", period: 5, topic: "5.10", stim: "primary_text",
    order: [{ id: "txt-hayes-inaugural-1877", context: "Delivered on March 5, 1877, after an election in 1876 whose result was disputed and settled by an electoral commission." }],
    difficulty: ["basic_learning", "exam_prep", "exam_prep"], keyAt: [1, 3, 0],
    items: [
      { skill: "3.B", topic: "5.10", tag: "3B", stem: "Which of the following claims about the South is made in the excerpt?",
        options: [
          o("The South had fully recovered from the war and no longer needed attention from the national government.", "Hayes says the people of those states are still impoverished and that wise, honest and peaceful local self-government is not fully enjoyed.", "reversal"),
          o("The South needs a local government that guards the interests of both races carefully and equally.", "Hayes says the government in those states must be one that 'guards the interests of both races carefully and equally.'", "key"),
          o("Federal troops should remain in the South for many years until local governments there are firmly controlled by the Republican party.", "The excerpt mentions no troops and calls for a local government that protects both races; it does not call for Republican control.", "unsupported_by_source"),
          o("The South could protect the rights of Black citizens only by passing new federal laws every year.", "Hayes calls for local governments that protect everyone's rights; he does not call for yearly federal laws.", "overstated"),
        ], key: 1, facts: ["Rutherford B. Hayes became president in March 1877 after the disputed election of 1876.", "Hayes withdrew the last federal troops from the South in April 1877."],
        evidence: "'it must be a government which guards the interests of both races carefully and equally'; 'The people of those States are still impoverished'" },
      { skill: "4.B", topic: "5.11", tag: "4B", stem: "The excerpt is best understood in the context of which of the following?",
        options: [
          o("The adoption of the Thirteenth Amendment at the end of the Civil War", "The Thirteenth Amendment was ratified in 1865, twelve years before Hayes's address.", "wrong_period"),
          o("The impeachment of President Andrew Johnson by the House of Representatives", "Johnson was impeached in 1868, nine years before this address.", "wrong_period"),
          o("The challenge of the Populist party to both of the major parties in the national elections of the 1890s, decades after Hayes spoke", "The Populist challenge came in the 1890s, long after 1877.", "wrong_period"),
          o("A disputed presidential election and the end of federal military support for Reconstruction governments", "Hayes spoke after the disputed 1876 election, and the removal of federal troops in 1877 ended military support for Reconstruction governments in the South.", "key"),
        ], key: 3, facts: ["The 1876 election between Hayes and Tilden was settled by an electoral commission in 1877.", "Federal troops left the last Southern state capitals in 1877."],
        evidence: "(context; the address is dated March 5, 1877 and calls for 'the permanent pacification of the country' and local self-government in the South)" },
      { skill: "5.B", topic: "6.4", tag: "5B", stem: "Which of the following later developments most clearly shows the limits of the goal Hayes describes for 'both races' in the South?",
        options: [
          o("Southern states passed Jim Crow laws and disfranchised Black voters in the late nineteenth century.", "Southern legislatures and constitutional conventions segregated public life and removed most Black voters from the rolls after 1877, which denied equal protection to Black Southerners.", "key"),
          o("Congress passed the Civil Rights Act of 1875 to guarantee all citizens equal access to inns, theaters and public accommodations.", "That act passed in 1875, before Hayes took office, and it did not limit the goal Hayes described.", "wrong_period"),
          o("Black Southerners won majorities in most Southern legislatures by 1890.", "Black officeholding declined sharply after 1877 rather than rising to majorities by 1890.", "reversal"),
          o("The Supreme Court struck down school segregation in the 1890s.", "The Court upheld segregation in 1896 and did not strike down school segregation until 1954.", "reversal"),
        ], key: 0, facts: ["Southern states adopted Jim Crow segregation laws and disfranchising devices such as poll taxes and literacy tests from the 1880s and 1890s."],
        evidence: "Hayes: 'a government which guards the interests of both races carefully and equally' (compare with later segregation and disfranchisement)" },
    ],
  },
  // ───── u634 · 시대 6 · Turner (2차) ─────
  {
    slot: "US3 u634", cell: "real_g_turner", theme: "Turner and the frontier thesis", title: "Frederick Jackson Turner on the Frontier, 1893", period: 6, topic: "6.2", stim: "secondary_text",
    order: [{ id: "txt-turner-1893", context: "From an essay read in July 1893 by a University of Wisconsin historian at a meeting of the American Historical Association during the World's Columbian Exposition in Chicago." }],
    difficulty: ["exam_prep", "basic_learning", "exam_prep"], keyAt: [2, 0, 3],
    items: [
      { skill: "2.B", topic: "6.11", tag: "2B", stem: "Which of the following is a limitation on using the excerpt as evidence for the experience of all people in the West?",
        options: [
          o("Turner wrote as an eyewitness and settler who took part in the settlement of the Great Plains during the 1860s.", "Turner was born in 1861 in Wisconsin and wrote as a professional historian, not as a participant in Plains settlement.", "unsupported_by_source"),
          o("Turner was a government official who wrote to promote the sale of public land to new settlers.", "Turner was a university historian, and the excerpt is an argument about American development, not a land-sale document.", "unsupported_by_source"),
          o("Turner centers the story on white settlers' adaptation and treats Native peoples as part of the landscape.", "The excerpt describes settlers fitting themselves into the 'Indian clearings' and 'Indian trails' and does not discuss Native peoples' own history or views, so it cannot show their experience.", "key"),
          o("Turner's essay focuses on the experience of immigrants who stayed in eastern cities.", "The excerpt concerns the frontier and westward movement, not eastern cities.", "reversal"),
        ], key: 2, facts: ["Frederick Jackson Turner was born in Wisconsin in 1861 and taught at the University of Wisconsin.", "Historians later criticized the frontier thesis for neglecting Native Americans, women, and other groups."],
        evidence: "'he fits himself into the Indian clearings and follows the Indian trails' (told from the settler's side)" },
      { skill: "3.B", topic: "6.2", tag: "3B", stem: "Which of the following does Turner use to support his claim that the frontier produced something new in American life?",
        options: [
          o("Settlers adapted to new conditions, such as using Native clearings and trails, and the result was not a copy of Europe.", "Turner says the settler must accept the conditions the frontier furnishes, fits into the Indian clearings and trails, and produces 'a new product that is American.'", "key"),
          o("Settlers carried European institutions across the continent unchanged and kept them in the West just as they had been in Europe.", "Turner argues the reverse: the outcome is not the old Europe.", "reversal"),
          o("The federal government planned and directed the movement of settlers across the continent.", "The excerpt describes settlers adapting to the environment and does not mention any federal plan.", "unsupported_by_source"),
          o("Eastern banks and railroads supplied the capital that made western settlement possible.", "That may be true historically, but the excerpt does not mention banks or railroads.", "unsupported_by_source"),
        ], key: 0, facts: ["Turner presented his frontier thesis in 1893.", "Turner argued that the availability of free land shaped American democracy and institutions."],
        evidence: "'he fits himself into the Indian clearings and follows the Indian trails ... a new product that is American'" },
      { skill: "5.B", topic: "6.13", tag: "5B", stem: "Which of the following developments most directly prompted Turner's focus on the end of the frontier?",
        options: [
          o("The passage of the Homestead Act, which offered free land to settlers", "The Homestead Act of 1862 encouraged settlement, but it was passed three decades before Turner wrote and did not report that the frontier had closed.", "true_but_not_responsive"),
          o("The Spanish-American War, which led the United States to acquire overseas territory and to debate the meaning of expansion", "The Spanish-American War took place in 1898, after Turner's essay of 1893.", "wrong_period"),
          o("The Louisiana Purchase, which added land west of the Mississippi River", "The Louisiana Purchase occurred in 1803, ninety years before Turner's essay.", "wrong_period"),
          o("The announcement that the census of 1890 no longer showed a continuous frontier line of settlement", "The Superintendent of the Census reported after the 1890 census that a continuous line of frontier settlement could no longer be traced, which Turner took as the opening for his essay.", "key"),
        ], key: 3, facts: ["The Superintendent of the Census reported in 1890 that a continuous frontier line no longer existed.", "Turner read his essay in July 1893."],
        evidence: "Turner's essay begins from the census statement on the frontier's end (not in the excerpt); the excerpt itself speaks of 'the continuous recession' of free land" },
    ],
  },
  // ───── u612 · 시대 6 · 도시 인구 표(정량) ─────
  {
    slot: "US3 u612", cell: "real_g_cities", theme: "The growth of large American cities, 1850-1890", title: "Population of Six Large Cities, 1850-1890", period: 6, topic: "6.8", stim: "quantitative",
    order: [{ id: "stat-city-population-1850-1890", context: "Counts from the Census Bureau for each city as it was bounded at each census; New York here is the city before the 1898 consolidation and does not include Brooklyn, which was a separate city until 1898." }],
    difficulty: ["basic_learning", "exam_prep", "exam_prep", "exam_prep"], keyAt: [1, 3, 0, 2],
    items: [
      { skill: "1.A", topic: "6.8", tag: "1A", stem: "Which of the following developments most directly contributed to the growth of Chicago shown in the table?",
        options: [
          o("Railroads made the city a hub linking western farms with eastern markets and drew workers and migrants.", "Railroad lines from the East and West met at Chicago, which became a center for shipping grain, meat and lumber and for manufacturing and attracted workers.", "key"),
          o("The discovery of gold near the city in the 1850s drew large numbers of prospectors.", "Gold was discovered in California and in the Rocky Mountains, not near Chicago.", "unrelated_development"),
          o("Chinese immigration through the city's busy port after the Gold Rush brought most of the city's new residents each year.", "Chicago is not a Pacific port; its growth drew on European immigrants and migrants from the American countryside.", "unrelated_development"),
          o("The relocation of the national capital from Washington to the city in the 1870s.", "The national capital remained in Washington, D.C.", "unsupported_by_source"),
        ], key: 0, facts: ["Chicago became the major railroad hub of the Midwest in the second half of the nineteenth century.", "Chicago's stockyards and grain markets processed products from the Great Plains."],
        evidence: "Chicago: 29,963 (1850), 298,977 (1870), 1,099,850 (1890)" },
      { skill: "3.A", topic: "6.8", tag: "3A", stem: "Which of the following claims is best supported by the data in the table?",
        options: [
          o("New York's population grew by a larger factor between 1850 and 1890 than that of any of the other cities shown.", "New York grew from 515,547 to 1,515,301, less than a threefold increase, which was slower than every other city shown.", "reversal"),
          o("By 1890, St. Louis had a larger population than Philadelphia.", "In 1890 Philadelphia had 1,046,964 people and St. Louis had 451,770.", "reversal"),
          o("Detroit had more people in 1870 than Cleveland had in 1890.", "Detroit had 79,577 people in 1870, and Cleveland had 261,353 in 1890.", "reversal"),
          o("Chicago's population grew by a larger factor than that of any other city shown between 1850 and 1890.", "Chicago grew from 29,963 to 1,099,850, about thirty-seven times, while Cleveland, the next fastest, grew about fifteen times.", "key"),
        ], key: 3, facts: ["The table reports census counts of each city's population for 1850, 1870 and 1890."],
        evidence: "Chicago 29,963 to 1,099,850 (about 37 times) versus Cleveland 17,034 to 261,353 (about 15 times); New York 515,547 to 1,515,301" },
      { skill: "4.B", topic: "6.6", tag: "4B", stem: "The population changes shown in the table are best understood in the context of which of the following?",
        options: [
          o("Industrialization and immigration in the late nineteenth century, which drew workers to cities", "Factory growth and large-scale immigration from Europe provided jobs and new residents in cities such as Chicago and Cleveland after the Civil War.", "key"),
          o("The Second Great Awakening, which encouraged many American families to settle in rural communities rather than in cities", "The Second Great Awakening was a religious revival of the early nineteenth century and did not drive city growth after the Civil War.", "unrelated_development"),
          o("The growth of colonial port towns before the American Revolution", "The table covers 1850 to 1890, after the colonial period.", "wrong_period"),
          o("The Dust Bowl migrations of the 1930s toward cities in the West", "The Dust Bowl occurred in the 1930s, after the years shown.", "wrong_period"),
        ], key: 0, facts: ["Millions of immigrants arrived in the United States between 1865 and 1890, many settling in industrial cities.", "Industrial growth after the Civil War created large demand for factory labor in cities."],
        evidence: "rapid growth of the Midwestern cities (Chicago, Cleveland, Detroit) between 1850 and 1890" },
      { skill: "5.A", topic: "7.8", tag: "5A", stem: "Which of the following developments in the early twentieth century continued the trend toward urban growth shown in the table?",
        options: [
          o("A national decline in factory jobs that sent most workers back to farms in the 1920s", "The census of 1920 showed that more Americans lived in cities than in rural areas, and factory employment remained high in the 1920s.", "reversal"),
          o("The Homestead Act, which offered farmland to settlers on the Great Plains", "The Homestead Act of 1862 encouraged rural settlement, and it came before the early twentieth century.", "wrong_period"),
          o("The Great Migration of Black Southerners to northern cities during and after World War I", "Hundreds of thousands of Black Southerners moved to cities such as Chicago and Detroit between 1915 and 1930, adding to urban growth.", "key"),
          o("The restriction of immigration in the 1920s, which caused most city residents to leave for rural areas", "Immigration restriction slowed immigration but did not cause large movements back to rural areas.", "overstated"),
        ], key: 2, facts: ["The 1920 census was the first to show more Americans living in urban than in rural areas.", "The Great Migration moved large numbers of Black Southerners to northern cities starting around 1915."],
        evidence: "continued growth of Chicago and Detroit beyond 1890 (context outside the table's years)" },
    ],
  },
  // ───── u742 · 시대 7 · Bryan ─────
  {
    slot: "US3 u742", cell: "real_g_bryan", theme: "Bryan, evolution and fundamentalism", title: "William Jennings Bryan on Evolution, 1922", period: 7, topic: "7.8", stim: "primary_text",
    order: [{ id: "txt-bryan-1922", context: "From a book of lectures that Bryan, a former presidential candidate and Secretary of State, gave in 1921 and published in 1922." }],
    difficulty: ["exam_prep", "basic_learning", "exam_prep", "exam_prep"], keyAt: [0, 2, 1, 3],
    items: [
      { skill: "2.A", topic: "7.8", tag: "2A", stem: "Bryan most likely wrote the passage in order to",
        options: [
          o("persuade readers that teaching evolution threatened religious faith and morality", "Bryan calls evolution a menace to fundamental morality and a doctrine with a demoralizing influence.", "key"),
          o("defend evolution as consistent with a literal reading of the account of creation in Genesis", "Bryan attacks the theory of evolution, so he does not defend it.", "reversal"),
          o("propose a federal law banning the teaching of all science in public schools", "The excerpt criticizes one scientific theory and proposes no law, and it does not call for banning all science.", "overstated"),
          o("report the findings of a scientific study of the origins of human beings", "The excerpt is an argument about morality and religion, not a report on scientific research.", "misattributed"),
        ], key: 0, facts: ["William Jennings Bryan was the Democratic presidential nominee in 1896, 1900 and 1908.", "Bryan assisted the prosecution in the Scopes trial in 1925."],
        evidence: "'I believe there is such a menace to fundamental morality ... the demoralizing influence exerted by this doctrine'" },
      { skill: "3.B", topic: "7.8", tag: "3B", stem: "Which of the following claims does Bryan make about the theory associated with Darwin?",
        options: [
          o("It has been accepted by nearly all religious leaders as a basis for stronger faith in God.", "Bryan says the theory is obscuring God and weakening the virtues that rest on religious faith.", "reversal"),
          o("It has damaged the economy by weakening public confidence in banks and in business.", "The excerpt concerns morality and religion and does not mention banks, business or the economy.", "unsupported_by_source"),
          o("It weakens morality by obscuring God and the religious tie between God and human beings.", "Bryan says the hypothesis is 'obscuring God and weakening all the virtues that rest upon the religious tie between God and man.'", "key"),
          o("It cannot be reconciled with any scientific evidence that has been gathered by scientists.", "Bryan makes a moral and religious argument in the excerpt and does not discuss scientific evidence.", "overstated"),
        ], key: 2, facts: ["Charles Darwin published On the Origin of Species in 1859.", "Fundamentalists in the 1920s opposed the teaching of evolution on religious grounds."],
        evidence: "'is obscuring God and weakening all the virtues that rest upon the religious tie between God and man'" },
      { skill: "4.B", topic: "7.8", tag: "4B", stem: "The ideas in the excerpt are best understood in the context of which of the following?",
        options: [
          o("The debate in the 1930s over relief and recovery programs for the unemployed during the Great Depression and the New Deal", "The excerpt dates from 1922, before the Great Depression began.", "wrong_period"),
          o("The conflict in the 1920s between religious fundamentalists and modernists over science and traditional values", "In the 1920s fundamentalists campaigned against teaching evolution and modernist ideas, a conflict that Bryan's lectures reflect.", "key"),
          o("The Progressive campaign of the 1910s to win women the right to vote", "The excerpt is about evolution and religion and does not concern suffrage.", "unrelated_development"),
          o("The Gilded Age debate over trusts and monopolies in the late nineteenth century", "The excerpt dates from 1922, long after the Gilded Age debate over trusts.", "wrong_period"),
        ], key: 1, facts: ["Fundamentalism was a movement among conservative Protestants in the 1920s that stressed a literal reading of the Bible.", "Several Southern states passed laws against teaching evolution in public schools in the 1920s."],
        evidence: "(context; the passage attacks evolution on religious and moral grounds and is dated 1922)" },
      { skill: "1.B", topic: "7.8", tag: "1B", stem: "Which of the following was a direct result of the controversy over evolution in the 1920s?",
        options: [
          o("The Supreme Court ended racial segregation in public schools.", "The Court did not end school segregation until 1954 and the ruling was not related to the evolution controversy.", "wrong_period"),
          o("The ratification of the Eighteenth Amendment banning the sale of alcohol.", "The Eighteenth Amendment was ratified in 1919 and arose from the temperance movement, not the evolution controversy.", "unrelated_development"),
          o("A federal law that required all public schools in the nation to teach the Bible as if it were science.", "No federal law of this kind was passed; the controversy led to state laws against teaching evolution.", "overstated"),
          o("The trial of John Scopes in Tennessee in 1925 for teaching evolution in a public school.", "Tennessee's Butler Act banned teaching evolution, and Scopes was tried in 1925 for violating it, with Bryan assisting the prosecution.", "key"),
        ], key: 3, facts: ["Tennessee passed the Butler Act in 1925 banning the teaching of human evolution in public schools.", "John Scopes was tried in Dayton, Tennessee, in July 1925."],
        evidence: "(context; the excerpt's argument against teaching evolution)" },
    ],
  },
  // ───── u718 · 시대 7 · EO 8802 ─────
  {
    slot: "US3 u718", cell: "real_g_eo8802", theme: "Executive Order 8802 and fair employment in World War II", title: "Executive Order 8802, 1941", period: 7, topic: "7.12", stim: "primary_text",
    order: [{ id: "txt-eo8802-1941", context: "Signed by President Roosevelt on June 25, 1941, after A. Philip Randolph and other Black leaders planned a march on Washington to protest discrimination in defense jobs." }],
    difficulty: ["exam_prep", "basic_learning", "exam_prep", "exam_prep"], keyAt: [2, 0, 3, 1],
    items: [
      { skill: "1.B", topic: "7.12", tag: "1B", stem: "Which of the following developments most directly led President Roosevelt to issue the order?",
        options: [
          o("The attack on Pearl Harbor, which brought the United States into World War II and ended its policy of neutrality", "The attack on Pearl Harbor occurred in December 1941, after the order was issued in June.", "wrong_period"),
          o("The return of millions of veterans after the end of the war", "Veterans returned after 1945, years after the order.", "wrong_period"),
          o("A planned march on Washington to protest discrimination against Black workers in defense industries", "A. Philip Randolph and others threatened a mass march in 1941, and Roosevelt issued the order to persuade them to cancel it.", "key"),
          o("The passage of the Civil Rights Act of 1964 banning employment discrimination", "That law was passed in 1964, more than twenty years after the order.", "wrong_period"),
        ], key: 2, facts: ["A. Philip Randolph, president of the Brotherhood of Sleeping Car Porters, planned a march on Washington in 1941.", "Roosevelt issued Executive Order 8802 on June 25, 1941."],
        evidence: "(context; the order responds to evidence that workers 'have been barred from employment in industries engaged in defense production')" },
      { skill: "3.A", topic: "7.12", tag: "3A", stem: "Which of the following claims does the order make about discrimination in defense industries?",
        options: [
          o("Barring workers from defense jobs because of race or origin harmed the morale of workers and national unity.", "The order states that workers have been barred 'to the detriment of workers' morale and of national unity.'", "key"),
          o("Defense industries should hire only workers who already belong to labor unions.", "The excerpt does not mention union membership as a condition of employment.", "unsupported_by_source"),
          o("Employers and unions have no responsibility for ending discrimination in defense work.", "The order declares it the duty of employers and labor organizations to provide full and equitable participation without discrimination.", "reversal"),
          o("The government will cancel every defense contract held by any employer who has discriminated against workers in the past.", "The order declares a policy, states the duty of employers and unions and creates a committee; it does not announce the cancellation of any existing contracts.", "overstated"),
        ], key: 0, facts: ["Executive Order 8802 created the Committee on Fair Employment Practice.", "The committee had limited enforcement power."],
        evidence: "'solely because of considerations of race, creed, color, or national origin, to the detriment of workers' morale and of national unity'" },
      { skill: "4.A", topic: "8.4", tag: "4A", stem: "Which of the following later presidential actions extended the policy of nondiscrimination to another area of federal responsibility?",
        options: [
          o("Truman's 1948 order requiring equal treatment and opportunity in the armed forces", "President Truman ordered equality of treatment and opportunity in the armed services in 1948, extending a policy of nondiscrimination to the military.", "key"),
          o("Johnson's launch of the Great Society's programs to fight poverty and improve education in the 1960s", "The antipoverty programs of the 1960s concerned poverty and opportunity, not extending this specific policy of nondiscrimination.", "unrelated_development"),
          o("Nixon's opening of diplomatic relations with China in the early 1970s", "The opening to China was a foreign policy initiative unrelated to discrimination in employment.", "unrelated_development"),
          o("Reagan's cuts in income tax rates in the early 1980s", "The tax cuts of the 1980s concerned taxation, not nondiscrimination policy.", "unrelated_development"),
        ], key: 0, facts: ["President Truman signed an order in July 1948 calling for equality of treatment and opportunity in the armed services.", "The armed forces were largely desegregated during the Korean War."],
        evidence: "the order's policy 'that there shall be no discrimination in the employment of workers in defense industries or government'" },
      { skill: "5.B", topic: "7.6", tag: "5B", stem: "Which of the following New Deal measures is most similar to the order in that it used federal authority to set rules for private employers?",
        options: [
          o("The Tennessee Valley Authority, which built dams and produced electric power", "The Tennessee Valley Authority was a federal development project and did not set rules for private employers.", "unrelated_development"),
          o("The National Labor Relations Act, which required employers to bargain with their workers' unions", "The Wagner Act of 1935 used federal law to set rules that private employers had to follow in dealing with workers, as the order declared a duty of employers and unions in defense industries.", "key"),
          o("The Civilian Conservation Corps, which gave young men jobs on conservation projects", "The Civilian Conservation Corps was a federal jobs program and did not set rules for private employers.", "unrelated_development"),
          o("The Federal Deposit Insurance Corporation, which insured the savings that people had deposited in banks across the nation", "The FDIC insured bank deposits and did not set employment rules for private employers.", "unrelated_development"),
        ], key: 1, facts: ["The National Labor Relations Act (Wagner Act) was passed in 1935 and guaranteed workers' right to organize and bargain collectively."],
        evidence: "the clause declaring 'the duty of employers and of labor organizations ... to provide for the full and equitable participation of all workers in defense industries' (federal rules for private employers)" },
    ],
  },
  // ───── u849 · 시대 8 · Truman Doctrine ─────
  {
    slot: "US3 u849", cell: "real_g_truman", theme: "The Truman Doctrine", title: "President Truman's Address to Congress, 1947", period: 8, topic: "8.2", stim: "primary_text",
    order: [{ id: "txt-truman-1947", context: "Delivered on March 12, 1947, when Truman asked Congress for aid to Greece, where a civil war was under way, and to Turkey." }],
    difficulty: ["basic_learning", "exam_prep", "exam_prep"], keyAt: [3, 1, 0],
    items: [
      { skill: "3.A", topic: "8.2", tag: "3A", stem: "Which of the following claims is made in the excerpt?",
        options: [
          o("The United States should avoid any involvement in the affairs of other nations in order to protect its own freedom and its own security.", "Truman argues the opposite: that the policy of the United States must be to support free peoples who are resisting subjugation.", "reversal"),
          o("Economic aid alone is unlikely to help free peoples work out their own destinies.", "Truman says that help should be primarily through economic and financial aid, which is essential to economic stability.", "reversal"),
          o("The freedom of nations can be protected only by the long-term military occupation of other countries.", "The excerpt calls for support and aid, primarily economic and financial, and does not call for military occupation.", "overstated"),
          o("The United States should support free peoples who are resisting attempted subjugation by armed minorities or by outside pressures.", "Truman says, 'I believe that it must be the policy of the United States to support free peoples who are resisting attempted subjugation by armed minorities or by outside pressures.'", "key"),
        ], key: 3, facts: ["The Truman Doctrine was announced on March 12, 1947.", "Congress approved aid to Greece and Turkey in May 1947."],
        evidence: "'it must be the policy of the United States to support free peoples who are resisting attempted subjugation by armed minorities or by outside pressures'" },
      { skill: "4.A", topic: "8.2", tag: "4A", stem: "Which of the following developments in the mid-1940s provides the best historical context for the speech?",
        options: [
          o("Japan's attack on Pearl Harbor, which brought the United States into the Second World War in December 1941, years before the speech", "That attack occurred in 1941, before the end of World War II and well before the speech.", "wrong_period"),
          o("Soviet influence expanding in Eastern Europe and a civil war in Greece after World War II", "After 1945 the Soviet Union dominated Eastern Europe, and Greece faced a civil war in which Britain could no longer provide support.", "key"),
          o("The collapse of the stock market and the onset of the Great Depression", "That occurred in 1929, long before the speech.", "wrong_period"),
          o("The discovery of Soviet missiles in Cuba and the crisis that followed", "The Cuban missile crisis occurred in 1962, fifteen years after the speech.", "wrong_period"),
        ], key: 1, facts: ["Britain told the United States in early 1947 that it could no longer support Greece and Turkey.", "The Soviet Union established communist governments across much of Eastern Europe after World War II."],
        evidence: "'One way of life is based upon the will of the majority ... the second ... upon the will of a minority forcibly imposed upon the majority' (the contrast shaped by postwar events)" },
      { skill: "5.B", topic: "8.2", tag: "5B", stem: "Which of the following later policies most directly continued the approach outlined in the excerpt?",
        options: [
          o("The Marshall Plan, which provided large-scale economic aid to Western European countries", "The Marshall Plan gave economic aid to rebuild Western European economies and strengthen them against communism, extending the approach in the speech.", "key"),
          o("The Neutrality Acts, which limited American aid to nations at war and kept the United States out of foreign wars in the 1930s", "The Neutrality Acts belonged to the 1930s and limited rather than expanded American aid abroad.", "reversal"),
          o("The Monroe Doctrine's warning to European powers not to colonize the Americas", "The Monroe Doctrine of the early nineteenth century concerned the Western Hemisphere and came more than a century before the speech.", "wrong_period"),
          o("The Open Door policy toward China, which asked powers to keep trade open", "The Open Door policy dates from the turn of the twentieth century and addressed trade in China, not aid to resist subversion.", "wrong_period"),
        ], key: 0, facts: ["The Marshall Plan provided about 13 billion dollars in aid to Western Europe from 1948 to 1952."],
        evidence: "'our help should be primarily through economic and financial aid' to free peoples" },
    ],
  },
  // ───── u851 · 시대 8 · Civil Rights Act of 1964 ─────
  {
    slot: "US3 u851", cell: "real_g_cra", theme: "The Civil Rights Act of 1964", title: "The Civil Rights Act of 1964", period: 8, topic: "8.8", stim: "primary_text",
    order: [{ id: "txt-cra-1964", context: "Signed by President Johnson on July 2, 1964; the excerpt gives the first sentence of Title II on public accommodations and Section 703(a) of Title VII on employment." }],
    difficulty: ["basic_learning", "exam_prep", "exam_prep", "exam_prep"], keyAt: [1, 3, 0, 2],
    items: [
      { skill: "3.B", topic: "8.8", tag: "3B", stem: "Which of the following does Section 201(a) of the excerpt prohibit?",
        options: [
          o("Charging higher fees to members of private social clubs that serve only their members", "The excerpt speaks of places of public accommodation and says nothing about fees charged by private clubs.", "unsupported_by_source"),
          o("Discrimination or segregation in places of public accommodation because of race, color, religion, or national origin", "Section 201(a) gives all persons the full and equal enjoyment of places of public accommodation without discrimination or segregation on those grounds.", "key"),
          o("Discrimination in the sale of homes, which is the only form of discrimination that the Act covers, according to the excerpt", "The excerpt covers public accommodations and employment, and it says nothing about home sales.", "overstated"),
          o("Travel between states by anyone who cannot show proof of residence", "The excerpt contains no rule about interstate travel or proof of residence.", "unsupported_by_source"),
        ], key: 1, facts: ["Title II of the Civil Rights Act of 1964 banned discrimination in hotels, restaurants and other public accommodations.", "Title VII banned employment discrimination and created the Equal Employment Opportunity Commission."],
        evidence: "Section 201(a): 'full and equal enjoyment ... without discrimination or segregation on the ground of race, color, religion, or national origin'" },
      { skill: "3.B", topic: "8.8", tag: "3B2", stem: "Which of the following protected characteristics is listed in Section 703(a) but not in Section 201(a) of the excerpt?",
        options: [
          o("Discrimination because of color", "Color is listed in both Section 201(a) and Section 703(a).", "true_but_not_responsive"),
          o("Discrimination because of religion", "Religion is listed in both Section 201(a) and Section 703(a).", "true_but_not_responsive"),
          o("Discrimination because of national origin", "National origin is listed in both Section 201(a) and Section 703(a).", "true_but_not_responsive"),
          o("Discrimination because of sex", "Section 703(a) lists race, color, religion, sex and national origin, while Section 201(a) lists only race, color, religion and national origin.", "key"),
        ], key: 3, facts: ["Title VII of the Civil Rights Act of 1964 prohibited employment discrimination on the basis of sex as well as race, color, religion and national origin."],
        evidence: "Section 703(a): 'race, color, religion, sex, or national origin'; Section 201(a): 'race, color, religion, or national origin'" },
      { skill: "4.A", topic: "8.8", tag: "4A", stem: "Which of the following developments in the early 1960s provides the best historical context for the Act?",
        options: [
          o("Protests and campaigns against segregation, such as sit-ins and the 1963 March on Washington", "Nonviolent protests, sit-ins and the 1963 March on Washington built public and congressional support for a federal ban on segregation and job discrimination.", "key"),
          o("The Freedmen's Bureau's efforts to educate formerly enslaved people", "The Freedmen's Bureau operated in the 1860s, a century before the Act.", "wrong_period"),
          o("The Red Scare of 1919 and 1920 and the arrests and deportations of suspected radicals and foreign-born agitators in many cities", "The Red Scare of 1919-1920 occurred decades before the Act.", "wrong_period"),
          o("The New Deal's relief programs for unemployed workers in the 1930s", "The New Deal occurred in the 1930s and did not prompt this Act.", "wrong_period"),
        ], key: 0, facts: ["The March on Washington for Jobs and Freedom was held in August 1963.", "Lunch-counter sit-ins began in Greensboro, North Carolina, in 1960."],
        evidence: "(context; the Act bans segregation in public accommodations and employment discrimination)" },
      { skill: "1.B", topic: "8.9", tag: "1B", stem: "Which of the following was an effect of the Act in the years after it was signed?",
        options: [
          o("Segregation in every Southern school and workplace ended within a year.", "Compliance was uneven, and segregation in many places continued for years after the Act.", "overstated"),
          o("The Supreme Court struck down the Act's public accommodations provisions as unconstitutional soon after the Act was passed in 1964.", "The Court upheld the public accommodations provisions in 1964 in Heart of Atlanta Motel v. United States.", "reversal"),
          o("A new commission and federal courts gained powers to enforce bans on segregation and on job discrimination.", "The Act let the Justice Department sue to end segregation and created the Equal Employment Opportunity Commission to handle job discrimination complaints.", "key"),
          o("Congress repealed the Act's employment provisions in the following year.", "Congress did not repeal the employment provisions, and Title VII remains law.", "reversal"),
        ], key: 2, facts: ["Heart of Atlanta Motel v. United States (1964) upheld Title II.", "The Equal Employment Opportunity Commission began operating in 1965."],
        evidence: "Section 703(a): an 'unlawful employment practice' (enforced through the new Equal Employment Opportunity Commission)" },
    ],
  },
  // ───── u960 · 시대 9 · Bush 1991 ─────
  {
    slot: "US3 u960", cell: "real_g_gulf", theme: "The Persian Gulf War", title: "President Bush's Address on the Gulf War, 1991", period: 9, topic: "9.3", stim: "primary_text",
    order: [{ id: "txt-bush-gulf-1991", context: "Delivered from the Oval Office on January 16, 1991, as air attacks on Iraq began; Congress had authorized the use of force four days earlier." }],
    difficulty: ["exam_prep", "basic_learning", "exam_prep", "exam_prep"], keyAt: [0, 2, 3, 1],
    items: [
      { skill: "2.A", topic: "9.3", tag: "2A", stem: "Which of the following best describes the purpose and audience of the address?",
        options: [
          o("The president explained to the American public why the United States and its allies had begun military action against Iraq.", "Bush reports that allied air forces had begun attacks and explains that the coalition had exhausted diplomatic efforts to end Iraq's occupation of Kuwait.", "key"),
          o("The president asked Congress to declare war on Iraq and to approve the first deployment of American troops to the Persian Gulf.", "Bush says the action was taken with the consent of Congress, so he was not asking for approval.", "reversal"),
          o("The president announced to the nation that the fighting in the Gulf had ended in victory.", "The address announces the start of military action and says the attacks continue as he speaks.", "reversal"),
          o("The president outlined a plan to withdraw all American forces from the Middle East.", "The address describes the start of military action against Iraq, not a plan to withdraw forces.", "unsupported_by_source"),
        ], key: 0, facts: ["Operation Desert Storm began with air attacks on Iraq on January 16-17, 1991.", "Congress passed a resolution authorizing the use of force on January 12, 1991."],
        evidence: "'Just 2 hours ago, allied air forces began an attack on military targets in Iraq and Kuwait.'" },
      { skill: "3.B", topic: "9.3", tag: "3B", stem: "Which of the following evidence does Bush offer to support his claim that force was used only after peaceful efforts failed?",
        options: [
          o("A vote of the American public approving the use of force against Iraq", "The excerpt mentions no public vote or poll.", "unsupported_by_source"),
          o("Reports that Iraq had attacked American ships in the Persian Gulf", "The excerpt describes allied air attacks on Iraq and does not mention attacks on American ships.", "unsupported_by_source"),
          o("Months of diplomatic efforts by the United Nations, the United States and other countries that Saddam Hussein rejected", "Bush says the action followed months of constant diplomatic activity by the United Nations, the United States and many other countries, and that the 28 coalition countries had exhausted all reasonable efforts to reach a peaceful resolution.", "key"),
          o("Evidence that economic sanctions imposed by the United Nations had already completely destroyed the economy of Iraq and its army", "The excerpt does not mention sanctions or claim that they had destroyed the Iraqi economy.", "unsupported_by_source"),
        ], key: 2, facts: ["Iraq invaded Kuwait on August 2, 1990.", "The United Nations Security Council authorized the use of force against Iraq if it did not withdraw by January 15, 1991."],
        evidence: "'follows months of constant and virtually endless diplomatic activity'; 'the 28 countries with forces in the Gulf area have exhausted all reasonable efforts to reach a peaceful resolution'" },
      { skill: "4.B", topic: "9.3", tag: "4B", stem: "The address is best understood in the context of which of the following developments?",
        options: [
          o("The attacks of September 11, 2001, and the war on terrorism that the United States began in response to them", "Those events occurred a decade after the address.", "wrong_period"),
          o("The Vietnam War and the Gulf of Tonkin Resolution of 1964", "Those events occurred in the 1960s, more than twenty-five years before the address.", "wrong_period"),
          o("The Iran hostage crisis of 1979 and 1980", "That crisis ended in January 1981 and was not the setting for this address.", "wrong_period"),
          o("Iraq's invasion of Kuwait in 1990 and the formation of a coalition backed by United Nations resolutions", "The address says allied forces must drive Saddam from Kuwait and that the action was taken by a coalition of 28 countries in accord with United Nations resolutions, which followed Iraq's invasion of Kuwait in August 1990.", "key"),
        ], key: 3, facts: ["Iraq invaded Kuwait on August 2, 1990.", "A coalition of 28 countries joined the military effort."],
        evidence: "'drive Saddam from Kuwait by force'; 'in accord with United Nations resolutions'; 'the 28 countries with forces in the Gulf area'" },
      { skill: "1.B", topic: "9.7", tag: "1B", stem: "Which of the following was a later development connected to the military action described in the address?",
        options: [
          o("Saddam Hussein was removed from power in Iraq within a few weeks in 1991.", "Saddam Hussein remained in power after the 1991 war and was removed only after the 2003 invasion.", "reversal"),
          o("Tension with Iraq continued, including sanctions and weapons inspections, and a second war in 2003.", "After 1991 the United States and the United Nations kept sanctions and inspections on Iraq, and the United States invaded in 2003.", "key"),
          o("The United States withdrew from the region and ended all of its involvement in Middle Eastern affairs after 1991 entirely.", "The United States kept forces and bases in the region after 1991.", "reversal"),
          o("The Soviet Union and the United States formed a permanent military alliance against Iraq.", "The Soviet Union cooperated with the United Nations resolutions but did not form a permanent alliance and dissolved in December 1991.", "overstated"),
        ], key: 1, facts: ["The Persian Gulf War ended in February 1991 with a ceasefire.", "The United States invaded Iraq in March 2003."],
        evidence: "(context; the military action against Iraq described in the address and its aftermath)" },
    ],
  },
];
