// US History Stage C(2026-10-15): 게시 US1·US2 의 ALTON 작성 1차 자료 MC 세트 4개를 실제 1차 자료로 교체하는 문항 정의(순수 데이터).
// 설계 순서: 자료(레지스트리, data/ap/ush-sources/registry.json)를 먼저 고정 → 스킬 → 정답 근거(자료 안 증거) → 오답 근거(오답마다 틀린 이유) → 확인할 역사 사실.
// 칸 크기·시대·스킬·토픽·난이도 라벨은 교체되는 세트와 같다(원본 u526/u408/u528/u531 의 문항별 skill·topic 을 그대로 유지).
export type Opt = { text: string; why: string; label: string };
export type McItem = { skill: string; topic: string; stem: string; options: Opt[]; key: number; facts: string[]; evidence: string; tag: string };
export type McSet = { slot: string; exam: "US1" | "US2"; cell: string; theme: string; title: string; period: number; topic: string; sourceId: string; kind: "text" | "image"; intro: string; stimDescription?: string; difficulty: ("basic_learning" | "exam_prep")[]; keyAt: number[]; items: McItem[] };
const o = (text: string, why: string, label: string): Opt => ({ text, why, label });

export const MC_SETS_C: McSet[] = [
  {
    slot: "US2 u526", exam: "US2", cell: "real_c_emanc", theme: "The Emancipation Proclamation", title: "The Emancipation Proclamation, January 1, 1863", period: 5, topic: "5.9", sourceId: "txt-emancipation-1863", kind: "text",
    intro: "Excerpts from the proclamation Lincoln issued on January 1, 1863; the third segment comes from the list of exempted places that follows the main text.",
    difficulty: ["basic_learning", "exam_prep", "basic_learning"], keyAt: [2, 0, 3],
    items: [
      { skill: "2.A", topic: "5.9", tag: "2A", stem: "In the excerpt, Lincoln most directly justifies the proclamation as",
        options: [
          o("an exercise of his powers as commander in chief against states in rebellion", "Lincoln cites his power as Commander-in-Chief of the Army and Navy and calls the order 'a fit and necessary war measure for suppressing said rebellion'.", "key"),
          o("the enforcement of a constitutional amendment that had already abolished slavery", "No amendment had abolished slavery in January 1863; the Thirteenth Amendment was ratified in December 1865 and the excerpt cites no amendment.", "wrong_period"),
          o("a ruling by the Supreme Court that slavery could not exist in rebelling states", "The excerpt rests the order on presidential war powers, not on any court ruling, and no such ruling existed.", "unsupported_by_source"),
          o("a request from the legislatures of the Union border states that they be freed from slavery first", "The border states are not mentioned as a source of the order, and slavery was left in place in the exempted areas.", "unsupported_by_source")],
        key: 0, facts: ["The Emancipation Proclamation took effect January 1, 1863, and applied to areas in rebellion.", "The Thirteenth Amendment was ratified in December 1865."], evidence: "'by virtue of the power in me vested as Commander-in-Chief ... as a fit and necessary war measure for suppressing said rebellion'." },
      { skill: "4.B", topic: "5.9", tag: "4B", stem: "The proclamation is best understood in the context of which of the following developments?",
        options: [
          o("A shift in Union war aims toward ending slavery as well as restoring the Union", "By 1863 the war's length and the flight of enslaved people to Union lines pushed the Union to make emancipation a war aim alongside restoring the Union.", "key"),
          o("Northern demands to repeal the Fugitive Slave Act and the Compromise of 1850", "Opposition to those laws was not the immediate setting of a wartime order issued under presidential war powers against states in rebellion.", "wrong_period"),
          o("The Radical Republican plan to readmit the Southern states during Reconstruction", "Reconstruction plans came later; in January 1863 the Confederate states were in rebellion and the war was undecided.", "wrong_period"),
          o("A decline in Northern support for the war that led Lincoln to seek a negotiated peace", "The proclamation committed the Union to a harder war; Lincoln did not seek a negotiated peace with the Confederacy.", "reversal")],
        key: 0, facts: ["Enslaved people fleeing to Union lines and Congress's Confiscation Acts preceded the proclamation.", "Lincoln announced the policy in a preliminary proclamation in September 1862."], evidence: "The text applies to 'all persons held as slaves' in areas 'in rebellion' under war powers, a wartime step beyond preserving the Union." },
      { skill: "1.A", topic: "5.8", tag: "1A", stem: "Besides the effects the excerpt describes, the proclamation contributed most directly to which of the following during the Civil War?",
        options: [
          o("The enlistment of African American men in the Union army and navy", "The full proclamation announced that freed men would be received into armed service, and about 180,000 Black men served in the Union army.", "key"),
          o("The immediate end of slavery in the Union border states", "The border states were left outside the proclamation, and slavery there ended later by state action and the Thirteenth Amendment.", "reversal"),
          o("British and French diplomatic recognition of the Confederacy", "The proclamation made recognition of the Confederacy harder for Britain and France, which did not recognize it.", "reversal"),
          o("A pause in Confederate military operations in the eastern theater of the war", "The proclamation did not halt Confederate offensives; the war continued for more than two years.", "unrelated_development")],
        key: 0, facts: ["About 180,000 African American men served in the Union army during the war, and thousands more in the navy.", "Britain and France never recognized the Confederacy."], evidence: "The excerpt commits 'the military and naval authority' to 'recognize and maintain the freedom of such persons'." },
    ],
  },
  {
    slot: "US2 u408", exam: "US2", cell: "real_c_monroe", theme: "The Monroe Doctrine", title: "Monroe's Message to Congress, December 1823", period: 4, topic: "4.4", sourceId: "txt-monroe-1823", kind: "text",
    intro: "Excerpts from the President's annual message to Congress; the segments appear in the order in which they occur in the message.",
    difficulty: ["exam_prep", "basic_learning", "exam_prep", "basic_learning"], keyAt: [1, 3, 0, 2],
    items: [
      { skill: "2.B", topic: "4.4", tag: "2B", stem: "Monroe's statements in the excerpt were most likely shaped by which of the following concerns?",
        options: [
          o("That European powers might intervene against the newly independent American governments", "Monroe says the United States could not view any interposition by a European power to oppress the independent governments 'in any other light than as the manifestation of an unfriendly disposition'.", "key"),
          o("That Congress would refuse to fund the purchase of Florida from Spain", "The Florida purchase was settled by the Adams-Onis Treaty of 1819 and ratified in 1821, and the excerpt does not mention it.", "wrong_period"),
          o("That Great Britain planned to ally with Russia against the United States in North America", "The excerpt states a policy toward all European powers and mentions no alliance directed against the United States.", "unsupported_by_source"),
          o("That the former Spanish colonies were asking the United States to send troops to defend them", "The excerpt says nothing about requests from those governments; the policy is stated as a U.S. position.", "unsupported_by_source")],
        key: 0, facts: ["By 1823 most Spanish American colonies had won or were fighting for independence, and the United States had recognized several in 1822.", "Monroe delivered the message December 2, 1823."], evidence: "'we could not view any interposition for the purpose of oppressing them ... by any European power in any other light than as the manifestation of an unfriendly disposition toward the United States'." },
      { skill: "3.A", topic: "4.4", tag: "3A", stem: "Which of the following best describes a claim Monroe makes in the excerpt?",
        options: [
          o("The United States would leave existing colonies alone but oppose European oppression of new American states", "He says the United States 'shall not interfere' with existing colonies while European oppression of independent governments would be viewed as unfriendly.", "key"),
          o("The United States would join the wars of European powers whenever American shipping and overseas trade was threatened", "Monroe says the nation has 'never taken any part' in the wars of the European powers and that it does not comport with its policy to do so.", "reversal"),
          o("European colonies in the Western Hemisphere should be freed by American military force", "He states that the United States has not interfered and will not interfere with the existing colonies or dependencies.", "overstated"),
          o("European governments were better suited than republics to protect liberty in the Americas", "The excerpt warns against extending the European system to the hemisphere and nowhere praises European governments.", "reversal")],
        key: 0, facts: ["The message addressed European colonization and intervention in the Americas and the U.S. stance of non-involvement in Europe's affairs."], evidence: "'With the existing colonies or dependencies of any European power we have not interfered and shall not interfere.'" },
      { skill: "4.B", topic: "4.4", tag: "4B", stem: "The concerns expressed in the excerpt are best understood in the context of which of the following?",
        options: [
          o("Latin American independence movements and European monarchies' interest in restoring control", "Spain's colonies were winning independence while European monarchies, which had put down a revolution in Spain in 1823, were seen as a danger to the new republics.", "key"),
          o("The war with Mexico that followed the annexation of Texas and the dispute over its border in the 1840s", "That war began in 1846, more than two decades after the message.", "wrong_period"),
          o("The nullification crisis in South Carolina over federal tariffs and states' rights in the early 1830s", "The crisis arose in 1832 over tariffs and states' rights, not over European intervention in the hemisphere.", "unrelated_development"),
          o("American settlement of the Great Plains and the building of transcontinental railroads after the Civil War", "Large-scale settlement of the Plains came after 1865, long after the message.", "wrong_period")],
        key: 0, facts: ["Spain's colonies on the mainland won independence mainly between 1810 and 1825.", "France intervened militarily in Spain in 1823 to restore its king."], evidence: "Monroe refers to 'those Governments who have declared their independence and maintain it' and to 'oppressing them' by European powers." },
      { skill: "5.A", topic: "3.10", tag: "5A", stem: "The excerpt's statement about the wars of the European powers most directly reflects continuity with which earlier development?",
        options: [
          o("Washington's Neutrality Proclamation of 1793 and his advice to avoid European conflicts", "Monroe's statement that the United States had never taken part in European wars follows the neutrality policy Washington announced in 1793 and urged in 1796.", "key"),
          o("The Alien and Sedition Acts of 1798, which restricted foreign residents and criticism of the government", "These laws restricted foreign residents and criticism of the government and did not set a policy toward European wars.", "unrelated_development"),
          o("The Louisiana Purchase of 1803, which brought the Great Plains into the United States", "The purchase expanded U.S. territory and was not a statement about taking sides in European wars.", "unrelated_development"),
          o("The Hartford Convention of 1814, a New England protest during the War of 1812", "The convention was a New England protest during the War of 1812 and did not concern a general policy toward Europe.", "unrelated_development")],
        key: 0, facts: ["Washington issued the Neutrality Proclamation in 1793 and warned against permanent alliances in his 1796 Farewell Address."], evidence: "'In the wars of the European powers in matters relating to themselves we have never taken any part, nor does it comport with our policy to do so.'" },
    ],
  },
  {
    slot: "US1 u528", exam: "US1", cell: "real_c_fsa", theme: "The Fugitive Slave Act", title: "The Fugitive Slave Act of 1850", period: 5, topic: "5.4", sourceId: "txt-fugitive-slave-act-1850", kind: "text",
    intro: "Excerpts from four sections of the act, which Congress passed in September 1850 as part of a group of laws on slavery and the territories; the segments appear in the order in which they occur in the act.",
    difficulty: ["basic_learning", "basic_learning", "basic_learning", "exam_prep"], keyAt: [3, 1, 2, 0],
    items: [
      { skill: "2.A", topic: "5.4", tag: "2A", stem: "Congress most likely included the provisions in the excerpt in order to",
        options: [
          o("make it easier for slaveholders to recover people who had escaped to free states", "The sections require citizens to assist, bar the testimony of the accused, penalize obstruction and pay commissioners more when they rule for the claimant.", "key"),
          o("protect the legal rights of accused fugitives by guaranteeing them a hearing before a federal jury", "The excerpt bars the accused from testifying and favors the claimant, which weakens rather than protects the accused.", "reversal"),
          o("limit the spread of slavery into the territories acquired from Mexico", "That issue was handled in other parts of the Compromise of 1850; these sections concern people who escaped from slavery.", "unrelated_development"),
          o("leave the return of fugitives to the discretion of each state government", "The act gives federal commissioners, marshals and courts the authority and requires private citizens to assist.", "reversal")],
        key: 0, facts: ["The Fugitive Slave Act of 1850 strengthened the federal enforcement of the Constitution's fugitive-slave clause."], evidence: "'all good citizens are hereby commanded to aid and assist in the prompt and efficient execution of this law'; 'In no trial or hearing under this act shall the testimony of such alleged fugitive be admitted'." },
      { skill: "3.A", topic: "5.4", tag: "3A", stem: "Which of the following best describes a provision of the law as the excerpt states it?",
        options: [
          o("Citizens could be required to help capture alleged fugitives, and aiding an escape was punishable", "The excerpt commands good citizens to assist and sets a fine of up to a thousand dollars and imprisonment up to six months for obstructing or aiding escape.", "key"),
          o("Alleged fugitives had the right to testify and to a jury trial in the state where they were arrested", "The excerpt states that the alleged fugitive's testimony could not be admitted, and it provides for hearings before commissioners.", "reversal"),
          o("State governors were to decide whether to return alleged fugitives who reached their states", "The excerpt gives the process to federal officers and commissioners and says nothing about governors deciding.", "unsupported_by_source"),
          o("Slaveholders had to prove their claim in federal district court before any arrest could be made", "The act allowed claimants to seize and arrest fugitives without process and to take them before a commissioner.", "overstated")],
        key: 0, facts: ["Commissioners under the 1850 act were paid ten dollars when they certified a claim and five dollars when they did not."], evidence: "The excerpt's penalty clause (a fine 'not exceeding one thousand dollars, and imprisonment not exceeding six months') and the command to citizens." },
      { skill: "4.A", topic: "5.3", tag: "4A", stem: "The law was adopted most directly in the context of which of the following?",
        options: [
          o("Sectional conflict over slavery after the Mexican Cession and the Compromise of 1850", "The acquisition of Mexican territory reopened the dispute over slavery's extension, and Congress passed a package of laws in 1850, including this act.", "key"),
          o("Debates over the Constitution's three-fifths clause at the Philadelphia Convention of 1787", "That debate occurred in 1787 and was not the immediate setting of an 1850 statute.", "wrong_period"),
          o("The Missouri Compromise's ban on slavery north of 36 30 in the Louisiana Purchase", "That compromise dates from 1820; the laws of 1850 dealt with the Mexican Cession and with fugitives.", "wrong_period"),
          o("Southern secession and the outbreak of the Civil War at Fort Sumter in 1861", "Secession began in 1860 and 1861, ten years after the act was passed.", "wrong_period")],
        key: 0, facts: ["The United States gained California and the Southwest from Mexico in 1848.", "Congress passed the Compromise of 1850 in September of that year."], evidence: "The act was part of the Compromise of 1850 (registry note); the excerpt itself concerns enforcement of the fugitive-slave clause." },
      { skill: "1.B", topic: "5.6", tag: "1B", stem: "Northern reaction to this law contributed most directly to which of the following developments in the 1850s?",
        options: [
          o("Growing Northern antislavery sentiment, including personal liberty laws and Uncle Tom's Cabin", "The act brought the enforcement of slavery into Northern communities, and resistance and antislavery writing, including Stowe's 1852 novel, grew.", "key"),
          o("A decline in Northern support for the Underground Railroad and for other aid to people escaping slavery", "Aid to escaping people increased after 1850, and the Underground Railroad's activity grew as a response to the law.", "reversal"),
          o("The end of the sectional dispute over slavery in the territories", "The dispute intensified in the 1850s, notably with the Kansas-Nebraska Act of 1854.", "reversal"),
          o("Federal repeal of the law before the Civil War", "The law remained in force until Congress repealed it in 1864.", "wrong_period")],
        key: 0, facts: ["Several Northern states passed personal liberty laws after 1850.", "Harriet Beecher Stowe published Uncle Tom's Cabin in 1852.", "Congress repealed the Fugitive Slave Act in June 1864."], evidence: "Effects of the enforcement provisions shown in the excerpt (commanding citizens to assist; barring testimony) provoked resistance." },
    ],
  },
  {
    slot: "US1 u531", exam: "US1", cell: "real_c_jones", theme: "Wartime shortages and exemptions in the Confederacy", title: "Hunger and Exemptions in Richmond, 1863", period: 5, topic: "5.9", sourceId: "txt-jones-diary-1863", kind: "text",
    intro: "Diary entries by a clerk in the Confederate War Department, written in Richmond, Virginia, in the spring of 1863 and published in 1866. 'Aliens' here means foreign residents. The segments appear in the order of the entries.",
    difficulty: ["basic_learning", "basic_learning", "basic_learning", "basic_learning"], keyAt: [0, 2, 1, 3],
    items: [
      { skill: "2.A", topic: "5.9", tag: "2A", stem: "Which of the following best describes the author's point of view about the women and boys who gathered in the Capitol Square?",
        options: [
          o("He sympathizes with their hunger and blames extortioners for the shortages", "He tells a young woman he hopes the crowd will find food and remarks that plenty lies 'in the hands of the extortioners'.", "key"),
          o("He supports calling out troops to disperse the crowd as soon as it gathered", "He expresses the hope that they might succeed and does not call for troops; the governor, not the author, summoned the military.", "reversal"),
          o("He believes the Union blockade was the only cause of the shortages", "He points to extortioners rather than to a blockade, which the excerpt does not mention.", "unsupported_by_source"),
          o("He is indifferent to events that did not involve his own department", "He describes the scene closely and says he could not refrain from voicing hope for the crowd.", "reversal")],
        key: 0, facts: ["The Richmond bread riot occurred on April 2, 1863; the governor called out the militia."], evidence: "'I could not, for the life of me, refrain from expressing the hope that they might be successful; and I remarked they were going in the right direction to find plenty in the hands of the extortioners.'" },
      { skill: "3.A", topic: "5.9", tag: "3A", stem: "Which of the following claims does the author make about military exemptions?",
        options: [
          o("Foreign residents holding exemptions from military duty were in the crowd and encouraged looting", "He says most of the few men in the crowd were foreign residents 'with exemptions in their pockets' and that aliens exempted from duty incited pillage of valuables.", "key"),
          o("Exemptions had been granted only to the poorest Confederate families and to soldiers' widows and orphans", "The excerpt ties exemptions to foreign residents and to Judge Campbell's decision, not to poor families.", "unsupported_by_source"),
          o("The Confederate Congress had abolished all exemptions from military service", "The author criticizes an exemption ruling by Judge Campbell and describes exempted residents in the crowd, which shows that exemptions still existed.", "reversal"),
          o("Women were exempt from the draft and used that status to lead the protest", "The author writes of men with exemptions among the crowd and says nothing about a draft of women.", "unsupported_by_source")],
        key: 0, facts: ["The Confederacy enacted conscription in April 1862 with exemptions for certain occupations."], evidence: "'these were mostly foreign residents, with exemptions in their pockets'; 'the class of residents (aliens) exempted from military duty by Judge Campbell'." },
      { skill: "4.A", topic: "5.8", tag: "4A", stem: "The economic conditions the author describes were most directly shaped by which of the following?",
        options: [
          o("Shortages and inflation from the Union blockade, army demand, and paper money", "The Union blockade, army needs for food and rapid issuing of Confederate paper money drove prices up and goods short in Richmond.", "key"),
          o("A surge of Northern investment in Southern railroads, cotton mills and coal mines", "Northern capital did not flow into the Confederacy during the war, and the diary describes scarcity, not growth.", "reversal"),
          o("The Southern shift from cotton to manufacturing before the war", "The Confederacy remained a mostly agricultural economy with limited industry, and the diary does not describe a shift.", "reversal"),
          o("Federal tariffs that had raised the cost of imported goods before 1861", "Tariff policy is not the cause of the wartime price spikes in Richmond in 1863.", "unrelated_development")],
        key: 0, facts: ["The Union blockade reduced Confederate trade; the Confederacy financed the war largely by issuing paper money, causing severe inflation."], evidence: "Prices in the excerpt: 'corn-meal is selling for $17 per bushel ... Coal at $20.50 per ton, and wood at $30 per cord ... tallow candles ... $1 per pound'." },
      { skill: "5.A", topic: "5.9", tag: "5A", stem: "The grievance about exemptions in the excerpt is most similar to which of the following developments in the North during the Civil War?",
        options: [
          o("Resentment of substitute and commutation fees in the North, as in the New York City draft riots", "In the North, men could hire a substitute or pay a 300-dollar commutation fee to avoid service, and poorer men resented it, as in the July 1863 riots.", "key"),
          o("Wage increases in Northern factories and shipyards supplying the Union army and navy", "Rising wages in some war industries are a different development and did not involve resentment of exemptions from service.", "true_but_not_responsive"),
          o("The passage of the Homestead Act, which offered western land to settlers", "The Homestead Act offered western land to settlers and was unrelated to a draft grievance.", "unrelated_development"),
          o("The surge of volunteer enthusiasm in the North after the Confederate attack on Fort Sumter in April 1861", "That enthusiasm in 1861 involved willing enlistment, not resentment of exemptions, and came earlier.", "wrong_period")],
        key: 0, facts: ["The Union Enrollment Act of March 1863 allowed a 300-dollar commutation fee or a substitute.", "The New York City draft riots took place July 13-16, 1863."], evidence: "'foreign residents, with exemptions in their pockets' and exempted aliens in a crowd of the hungry." },
    ],
  },
];
