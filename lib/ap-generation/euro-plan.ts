// AP European History 고정 계획(2026-10-20): 자료를 먼저 고정(data/ap/euro-sources/registry.json)하고, 세트·FRQ 는 그 자료에 맞춰 배치한다(자료 → 스킬 → 문항 → 정답·오답 근거). World History(wh-plan.ts)와 같은 구조.
// 이 파일은 동결 구성 해시 대상이다. 각 자료의 context 는 ALTON 이 쓴 한 줄(사건·청중, 사실만)이며 학생 화면에 자료 출처 표기와 함께 표시된다.
// 시험 구성(AP Central 시험 페이지, 2026-10-20 조회): MC 55/55분(3–4문항 세트), SAQ 3/40분(q1 2차 텍스트·q2 1차 텍스트·q3 비텍스트, 서로 다른 시대), DBQ(문서 7)+LEQ 100분. 2027 개편(SAQ 전부 자료 포함, LEQ 필수 1문항 선택 없음, DBQ 넓은 연대)은 이미 이 구성에 반영돼 있다.
export type EuroSrcRef = { id: string; context: string };
export type EuroStim = "primary_text" | "secondary_text" | "paired_text" | "quantitative" | "image";
export type EuroSetSpec = { id: string; exam: "EU1" | "EU2"; unit: number; stim: EuroStim; theme: string; sources: EuroSrcRef[]; skills: string[]; nItems: number; seed: number };
export type EuroFrqSpec = { id: string; exam: "EU1" | "EU2"; template: "saq1" | "saq2" | "saq3" | "dbq" | "leq"; era: number; units: number[]; focus: string; sources: EuroSrcRef[]; seed: number };

/** 자료별 한 줄 맥락(사실만). */
export const CTX: Record<string, string> = {
  "eu-txt-prince-1532": "Niccolo Machiavelli was a Florentine writer and former government official; he wrote this treatise on rulers in 1513, and it was first printed in 1532.",
  "eu-img-waldseemuller-1507": "This world map was printed in 1507 in Saint-Die, in Lorraine, by the mapmaker Martin Waldseemuller; the only known surviving copy is in the Library of Congress.",
  "eu-txt-luther95-1517": "Martin Luther was a German monk and professor of theology at Wittenberg; in 1517 he wrote 95 propositions in Latin for debate about indulgences.",
  "eu-txt-acton-counterref": "Lord Acton was a British historian who taught at Cambridge; he delivered these lectures around 1899 and they were published in 1906.",
  "eu-txt-bor-1689": "The English Parliament drew up this declaration in early 1689 and presented it to William of Orange and Mary after King James II left England.",
  "eu-txt-hobbes-1651": "Thomas Hobbes was an English philosopher; he published this book in 1651, a few years after the English Civil War.",
  "eu-txt-locke-1690": "John Locke was an English philosopher; he published this book in 1689-1690, soon after the Glorious Revolution.",
  "eu-txt-rousseau-1762": "Jean-Jacques Rousseau was a writer born in Geneva who lived mostly in France; he published this book in 1762.",
  "eu-txt-acton-frederick": "Lord Acton was a British historian who taught at Cambridge; in this lecture of about 1899 he describes events of 1740.",
  "eu-txt-burke-1790": "Edmund Burke was a member of the British Parliament; he published this book in 1790 about the French Revolution of 1789.",
  "eu-txt-paine-1791": "Thomas Paine was an English-born writer who supported the American and French revolutions; he published this book in 1791 as a reply to Burke.",
  "eu-txt-acton-revolution": "Lord Acton was a British historian who taught at Cambridge; he lectured on the French Revolution in the 1890s.",
  "eu-tab-pigiron-1907": "The Encyclopaedia Britannica published this table in 1911 in its article on iron and steel; the figures are thousands of long tons of pig iron.",
  "eu-txt-mill-1859": "John Stuart Mill was an English philosopher; he published this essay in 1859.",
  "eu-txt-darwin-1871": "Charles Darwin was an English naturalist; he published this book on the origin of human beings in 1871.",
  "eu-txt-headlam-1899": "James Headlam was a British historian; he wrote this book in 1899 about Bismarck and the creation of the German Empire.",
  "eu-txt-sassoon-1917": "Siegfried Sassoon was a British army officer who served on the Western Front; he wrote this poem during the First World War.",
  "eu-img-leete-kitchener-1914": "This cover of a London magazine was printed in September 1914, soon after Britain entered the First World War.",
  "eu-txt-nato-1949": "Twelve countries of Western Europe and North America signed this treaty in Washington in April 1949.",
  "eu-txt-cs-hungary-1990": "This reference book was written for the U.S. government; this part describes events in Eastern Europe in 1989.",
  // EU2
  "eu-txt-utopia-1516": "Thomas More was an English lawyer and writer; he published this book in Latin in 1516, and the passage is spoken by a traveler in the story.",
  "eu-txt-acton-newworld": "Lord Acton was a British historian who taught at Cambridge; in this lecture of about 1899 he describes the Portuguese and Spanish voyages of exploration.",
  "eu-txt-folly-1511": "Erasmus was a Dutch scholar and priest; he wrote this satire in 1509 and had it printed in 1511, and the speaker is a character named Folly.",
  "eu-txt-motley-1566": "John Lothrop Motley was an American historian; he published this history of the Netherlands in 1856.",
  "eu-txt-westphalia-1648": "Representatives of the Holy Roman Empire, Sweden and the German states agreed to this treaty in October 1648, ending the Thirty Years' War in Germany.",
  "eu-txt-acton-absolutism": "Lord Acton was a British historian who taught at Cambridge; in this lecture of about 1899 he discusses Peter the Great of Russia and Frederick William I of Prussia.",
  "eu-txt-voltaire-1763": "Voltaire was a French writer; he published this treatise in 1763, after the execution of Jean Calas, a Protestant, in Toulouse.",
  "eu-txt-rousseau-civilreligion": "Jean-Jacques Rousseau was a writer born in Geneva who lived mostly in France; he published this book in 1762.",
  "eu-txt-malthus-1798": "Thomas Malthus was an English clergyman and scholar; he published this essay anonymously in 1798.",
  "eu-txt-bourrienne-1829": "Bourrienne was Napoleon's private secretary until 1802; he published his memoirs in 1829, after Napoleon's death, and this passage describes events of 1801.",
  "eu-txt-cs-poland-1994": "This reference book was written for the U.S. government; the passage describes Poland-Lithuania between the first partition of 1772 and the constitution of 1791.",
  "eu-tab-vital-rates-1901": "The Encyclopaedia Britannica published this table in 1911 in its article on population; it gives estimates by the Swedish statistician Gustav Sundbarg for regions of Europe.",
  "eu-img-father-thames-1858": "This cartoon appeared in the British magazine Punch on July 3, 1858, in a summer when the smell from the River Thames was a public problem in London.",
  "eu-txt-dualalliance-1879": "Germany and Austria-Hungary signed this treaty on October 7, 1879, and kept its text secret at the time.",
  "eu-txt-entente-1904": "Britain and France signed this declaration on April 8, 1904; it was published together with secret articles that were not made public.",
  "eu-img-dropping-pilot-1890": "This cartoon by John Tenniel appeared in the British magazine Punch on March 29, 1890.",
  "eu-txt-keynes-1919": "John Maynard Keynes was a British economist who worked for the British Treasury at the 1919 Paris Peace Conference; he published this book in December 1919.",
  "eu-txt-cs-germany-1996": "This reference book was written for the U.S. government; the passage describes Germany from 1929 to 1933.",
  "eu-txt-yalta-1945": "The leaders of the Soviet Union, the United Kingdom and the United States issued this statement on February 11, 1945, at the end of a conference at Yalta.",
  "eu-txt-cs-soviet-gorbachev": "This reference book was written for the U.S. government in the late 1980s; the passage describes Soviet policy toward Eastern Europe under Mikhail Gorbachev.",
  // FRQ
  "eu-txt-cs-czech-1989": "This reference book was written for the U.S. government in the 1980s; the passage describes the spring of 1968 in Czechoslovakia.",
  "eu-txt-kant-1795": "Immanuel Kant was a German philosopher who taught at the University of Konigsberg in Prussia; he published this essay in 1795.",
  "eu-img-durer-rhinoceros-1515": "Albrecht Durer was a German artist from Nuremberg; he made this print in 1515 after hearing about an Indian rhinoceros sent to the king of Portugal.",
  "eu-txt-threeemperors-1881": "Germany, Austria-Hungary and Russia signed this secret treaty in June 1881.",
  "eu-txt-francorussian-1892": "French and Russian army officers signed this secret military convention in August 1892.",
  "eu-txt-anglorussian-1907": "Britain and Russia signed this agreement in August 1907 about Persia, Afghanistan and Tibet.",
  "eu-txt-versailles231-1919": "Germany and the Allied and Associated Powers signed this treaty on June 28, 1919, at Versailles, France.",
  "eu-img-orpen-versailles-1919": "William Orpen was a British painter who served as an official war artist; he painted this scene of the signing of the Versailles treaty in 1919.",
  "eu-txt-kaiser-1922": "Wilhelm II was German emperor from 1888 until he abdicated in November 1918; he wrote his memoirs in exile in the Netherlands.",
  "eu-txt-locarno-1925": "Germany, France, Belgium, Britain and Italy initialed this treaty at Locarno, Switzerland, in October 1925.",
  "eu-txt-cs-soviet-emancipation": "This reference book was written for the U.S. government in the late 1980s; the passage describes Russia in 1861.",
  "eu-txt-columbus-1493": "Christopher Columbus was an Italian-born navigator sailing for the Spanish crown; he wrote this letter in 1493 on the voyage home from his first voyage across the Atlantic.",
  "eu-img-checkpoint-charlie-1961": "A U.S. Army photographer took this picture in June 1961 at a crossing point between the American sector of West Berlin and East Berlin.",
  "eu-txt-emile-1762": "Jean-Jacques Rousseau was a writer born in Geneva who lived mostly in France; he published this book on education in 1762.",
  "eu-txt-wollstonecraft-1792": "Mary Wollstonecraft was an English writer; she published this book in 1792.",
  "eu-txt-mill-subjection-1869": "John Stuart Mill was an English philosopher and, from 1865 to 1868, a member of Parliament; he published this book in 1869.",
  "eu-txt-engels-1884": "Friedrich Engels was a German socialist who lived in England; he published this book in 1884, the year after the death of Karl Marx.",
  "eu-img-lowndes-suffrage-1909": "Mary Lowndes designed this poster in 1909 for a British women's suffrage organization.",
  "eu-txt-fawcett-1912": "Millicent Garrett Fawcett was president of the National Union of Women's Suffrage Societies, a British group that used peaceful methods; she published this book in 1912.",
  "eu-txt-pankhurst-1914": "Emmeline Pankhurst founded the Women's Social and Political Union in Manchester in 1903; she published this autobiography in 1914.",
};
const S = (id: string): EuroSrcRef => ({ id, context: CTX[id] });
const set = (id: string, exam: "EU1" | "EU2", unit: number, stim: EuroStim, theme: string, srcs: string[], skills: string[], seed: number): EuroSetSpec => ({ id, exam, unit, stim, theme, sources: srcs.map(S), skills, nItems: skills.length, seed });

export const EURO_SETS: EuroSetSpec[] = [
  // ── EU1 ──
  set("e101", "EU1", 1, "primary_text", "Machiavelli on whether a ruler should be loved or feared", ["eu-txt-prince-1532"], ["2.B", "3.A", "5.B"], 1101),
  set("e102", "EU1", 1, "image", "A printed world map of 1507 that shows Ptolemy, Vespucci and the lands across the Atlantic", ["eu-img-waldseemuller-1507"], ["2.A", "4.B", "1.A"], 1102),
  set("e103", "EU1", 2, "primary_text", "Luther's theses on indulgences and works of mercy", ["eu-txt-luther95-1517"], ["3.A", "4.A", "5.B"], 1103),
  set("e104", "EU1", 2, "secondary_text", "A historian on the Catholic response to the Reformation and the finances of Rome", ["eu-txt-acton-counterref"], ["3.A", "3.B", "4.B"], 1104),
  set("e105", "EU1", 3, "primary_text", "Limits on royal power in the English Bill of Rights of 1689", ["eu-txt-bor-1689"], ["1.B", "4.A", "5.B"], 1105),
  set("e106", "EU1", 3, "paired_text", "Hobbes and Locke on the state of nature", ["eu-txt-hobbes-1651", "eu-txt-locke-1690"], ["3.C", "3.A", "5.A"], 1106),
  set("e107", "EU1", 4, "primary_text", "Rousseau on the social compact and the general will", ["eu-txt-rousseau-1762"], ["3.A", "2.B", "5.B"], 1107),
  set("e108", "EU1", 4, "secondary_text", "A historian on Frederick II of Prussia and the seizure of Silesia", ["eu-txt-acton-frederick"], ["3.A", "1.B", "5.A"], 1108),
  set("e109", "EU1", 5, "paired_text", "Burke and Paine on the French Revolution", ["eu-txt-burke-1790", "eu-txt-paine-1791"], ["3.C", "2.B", "5.B"], 1109),
  set("e110", "EU1", 5, "secondary_text", "A historian on the French Declaration of Rights and the danger of majority rule", ["eu-txt-acton-revolution"], ["3.A", "3.B", "4.B"], 1110),
  set("e111", "EU1", 6, "quantitative", "Pig iron production in the United States, Britain and Germany, 1865-1907", ["eu-tab-pigiron-1907"], ["1.A", "3.B", "4.B"], 1111),
  set("e112", "EU1", 6, "primary_text", "Mill on the limits of power over the individual", ["eu-txt-mill-1859"], ["3.A", "4.A", "5.B"], 1112),
  set("e113", "EU1", 7, "primary_text", "Darwin on human origins and the place of humankind in nature", ["eu-txt-darwin-1871"], ["1.B", "2.B", "4.B"], 1113),
  set("e114", "EU1", 7, "secondary_text", "A historian on Bismarck's speech about blood and iron", ["eu-txt-headlam-1899"], ["3.A", "3.D", "5.A"], 1114),
  set("e115", "EU1", 8, "primary_text", "A British officer's poem about generals and staff officers in the First World War", ["eu-txt-sassoon-1917"], ["2.B", "3.A", "4.A"], 1115),
  set("e116", "EU1", 8, "image", "A British magazine cover that became a recruiting appeal, 1914", ["eu-img-leete-kitchener-1914"], ["2.A", "1.B", "4.B"], 1116),
  set("e117", "EU1", 9, "primary_text", "Consultation and collective defense in the North Atlantic Treaty", ["eu-txt-nato-1949"], ["1.B", "2.B", "3.A", "5.B"], 1117),
  set("e118", "EU1", 9, "secondary_text", "Reform movements and the Warsaw Pact in 1989", ["eu-txt-cs-hungary-1990"], ["3.A", "4.A", "5.A"], 1118),
  // ── EU2 ──
  set("e201", "EU2", 1, "primary_text", "More's traveler on sheep, enclosure and the poor in England", ["eu-txt-utopia-1516"], ["2.B", "3.A", "4.A"], 1201),
  set("e202", "EU2", 1, "secondary_text", "A historian on Portuguese exploration and the role of the state", ["eu-txt-acton-newworld"], ["3.A", "1.B", "5.A"], 1202),
  set("e203", "EU2", 2, "primary_text", "Erasmus's satire of pardoners and popular devotion", ["eu-txt-folly-1511"], ["2.B", "3.A", "4.B"], 1203),
  set("e204", "EU2", 2, "secondary_text", "A historian on the image-breaking in the Netherlands in 1566", ["eu-txt-motley-1566"], ["3.A", "3.B", "5.B"], 1204),
  set("e205", "EU2", 3, "primary_text", "The rights of the German states in the Peace of Westphalia", ["eu-txt-westphalia-1648"], ["1.B", "2.B", "5.B"], 1205),
  set("e206", "EU2", 3, "secondary_text", "A historian on military monarchy in Russia and Prussia", ["eu-txt-acton-absolutism"], ["3.A", "4.B", "5.A"], 1206),
  set("e207", "EU2", 4, "paired_text", "Voltaire and Rousseau on toleration", ["eu-txt-voltaire-1763", "eu-txt-rousseau-civilreligion"], ["3.C", "4.A", "5.B"], 1207),
  set("e208", "EU2", 4, "primary_text", "Malthus on population and food", ["eu-txt-malthus-1798"], ["3.A", "3.B", "4.B"], 1208),
  set("e209", "EU2", 5, "primary_text", "Napoleon's reasons for the Concordat as reported by his secretary", ["eu-txt-bourrienne-1829"], ["2.C", "3.A", "5.B"], 1209),
  set("e210", "EU2", 5, "secondary_text", "Reform and partition in Poland-Lithuania in the late eighteenth century", ["eu-txt-cs-poland-1994"], ["1.B", "3.A", "4.B"], 1210),
  set("e211", "EU2", 6, "quantitative", "Birth and death rates in European regions, 1801-1900", ["eu-tab-vital-rates-1901"], ["1.A", "3.B", "5.B"], 1211),
  set("e212", "EU2", 6, "image", "A cartoon about the polluted River Thames and the health of London, 1858", ["eu-img-father-thames-1858"], ["2.A", "4.B", "1.B"], 1212),
  set("e213", "EU2", 7, "paired_text", "The Dual Alliance of 1879 and the Entente Cordiale of 1904", ["eu-txt-dualalliance-1879", "eu-txt-entente-1904"], ["3.C", "4.A", "5.A"], 1213),
  set("e214", "EU2", 7, "image", "A British cartoon on Bismarck leaving office in 1890", ["eu-img-dropping-pilot-1890"], ["2.A", "4.B", "5.B"], 1214),
  set("e215", "EU2", 8, "primary_text", "Keynes on reparations and the economic problems of Europe after 1919", ["eu-txt-keynes-1919"], ["2.B", "3.A", "4.B"], 1215),
  set("e216", "EU2", 8, "secondary_text", "The Great Depression and the Nazi rise to power in Germany", ["eu-txt-cs-germany-1996"], ["1.B", "3.B", "5.B"], 1216),
  set("e217", "EU2", 9, "primary_text", "The Yalta Declaration on Liberated Europe", ["eu-txt-yalta-1945"], ["1.B", "2.B", "4.A", "5.B"], 1217),
  set("e218", "EU2", 9, "secondary_text", "Gorbachev's policies and the East European leaders in the 1980s", ["eu-txt-cs-soviet-gorbachev"], ["3.A", "4.B", "5.A"], 1218),
];

const F = (id: string, exam: "EU1" | "EU2", template: EuroFrqSpec["template"], era: number, units: number[], focus: string, srcs: string[], seed: number): EuroFrqSpec => ({ id, exam, template, era, units, focus, sources: srcs.map(S), seed });
export const EURO_FRQS: EuroFrqSpec[] = [
  F("eu1_saq1", "EU1", "saq1", 4, [9], "Reform and Soviet control in Eastern Europe in the 1960s (the Prague Spring of 1968)", ["eu-txt-cs-czech-1989"], 2101),
  F("eu1_saq2", "EU1", "saq2", 2, [5], "Ideas about war, peace and the power of states in Europe in the late eighteenth century (the document is a philosopher's proposal, not a description of events)", ["eu-txt-kant-1795"], 2102),
  F("eu1_saq3", "EU1", "saq3", 1, [1], "Portuguese overseas expansion, long-distance trade and the spread of information through printing around 1500 (the image is a print with a caption; make no claims about details the caption does not state)", ["eu-img-durer-rhinoceros-1515"], 2103),
  F("eu1_dbq", "EU1", "dbq", 3, [7, 8], "Evaluate the extent to which diplomatic agreements between 1881 and 1925 were aimed at preserving peace and security rather than at advancing the interests of individual states", ["eu-txt-threeemperors-1881", "eu-txt-francorussian-1892", "eu-txt-anglorussian-1907", "eu-txt-versailles231-1919", "eu-img-orpen-versailles-1919", "eu-txt-kaiser-1922", "eu-txt-locarno-1925"], 2104),
  F("eu1_leq", "EU1", "leq", 2, [3, 4, 5, 6, 7], "Changes and continuities in the relationship between rulers and their subjects in Europe, c. 1648 to c. 1914 (state power, individual rights and political participation)", [], 2105),
  F("eu2_saq1", "EU2", "saq1", 3, [6], "Russia's reforms after the Crimean War and their consequences for the peasantry and the state", ["eu-txt-cs-soviet-emancipation"], 2201),
  F("eu2_saq2", "EU2", "saq2", 1, [1], "European exploration and the creation of Atlantic empires in the late fifteenth century (the author is an explorer reporting to his sponsors)", ["eu-txt-columbus-1493"], 2202),
  F("eu2_saq3", "EU2", "saq3", 4, [9], "The division of Berlin and the confrontation between the United States and the Soviet Union in 1961 (the sign in the photograph is not readable; make no claims about its words)", ["eu-img-checkpoint-charlie-1961"], 2203),
  F("eu2_dbq", "EU2", "dbq", 3, [4, 5, 6, 7, 9], "Evaluate the extent to which ideas and political movements changed the legal and social position of women in Europe between 1762 and 1914", ["eu-txt-emile-1762", "eu-txt-wollstonecraft-1792", "eu-txt-mill-subjection-1869", "eu-txt-engels-1884", "eu-img-lowndes-suffrage-1909", "eu-txt-fawcett-1912", "eu-txt-pankhurst-1914"], 2204),
  F("eu2_leq", "EU2", "leq", 1, [1, 2, 3, 4], "The effects of religious change and religious conflict on European politics and society, c. 1450 to c. 1789", [], 2205),
];
export const euroSetsOf = (exam?: string) => EURO_SETS.filter((s) => !exam || s.exam === exam);
export const euroPlanSummary = () => ({ sets: EURO_SETS.length, items: EURO_SETS.reduce((a, s) => a + s.nItems, 0), byExam: Object.fromEntries(["EU1", "EU2"].map((e) => [e, { sets: euroSetsOf(e).length, items: euroSetsOf(e).reduce((a, s) => a + s.nItems, 0), units: euroSetsOf(e).reduce<Record<string, number>>((o, s) => { o[s.unit] = (o[s.unit] ?? 0) + s.nItems; return o; }, {}), stim: euroSetsOf(e).reduce<Record<string, number>>((o, s) => { o[s.stim] = (o[s.stim] ?? 0) + 1; return o; }, {}), skillCats: euroSetsOf(e).reduce<Record<string, number>>((o, s) => { for (const k of s.skills) o[k[0]] = (o[k[0]] ?? 0) + 1; return o; }, {}) }])) });
