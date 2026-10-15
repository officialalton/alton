// US History Stage D(2026-10-15): 게시 US1·US2 의 ALTON 작성 2차 자료(텍스트) MC 세트 중 실제 공개 도메인 지도·만평으로 정말 맞는 3개를 비텍스트 세트로 바꾸는 문항 정의(순수 데이터).
// 설계 순서: 이미지(레지스트리, 눈으로 읽은 것만 사용)를 먼저 고정 → 스킬 → 정답 근거(그림 안 증거) → 오답 근거 → 확인할 역사 사실. 칸 크기·시대·스킬 범주·토픽·난이도 라벨은 교체되는 세트와 같다.
// 현대 학술 서술(저작권)은 쓰지 않았다. 해당 시대의 공개 도메인 시각 자료를 찾지 못한 US2 u617(짝지은 2차 자료 · 짐 크로)은 변환하지 않았다(보고서 참고).
import type { McSet } from "./ush-real-c-content";
const o = (text: string, why: string, label: string) => ({ text, why, label });

export const MC_SETS_D: McSet[] = [
  {
    slot: "US2 u527", exam: "US2", cell: "real_d_reynolds", theme: "The 1856 political map of free and slave territory", title: "A Political Map of the United States, 1856", period: 5, topic: "5.6", sourceId: "map-reynolds-1856", kind: "image",
    intro: "An 1856 printed map. Free states, slave states and the western territories are shown in different colors; the printed title explains the purpose of the map.",
    stimDescription: "An 1856 political map of the United States with its printed title, portraits of two men at the top corners, colored free states, slave states and western territories, and statistical tables below the map.",
    difficulty: ["basic_learning", "exam_prep", "exam_prep", "exam_prep"], keyAt: [2, 0, 1, 3],
    items: [
      { skill: "3.A", topic: "5.6", tag: "3A", stem: "Which of the following best describes the main claim the mapmakers express in the printed title of the map?",
        options: [
          o("The repeal of the Missouri Compromise opened much western territory to the spread of slavery", "The title says the map shows 'the territory open to slavery or freedom by the repeal of the Missouri Compromise', and a wide green region lies west of the slave states.", "key"),
          o("Popular sovereignty had finally settled the question of slavery in all of the western territories for good", "The title stresses how much territory was now 'open to slavery', which presents the repeal as unsettling the question, not settling it.", "reversal"),
          o("Slavery already existed in every one of the western territories shown on the map", "The map colors the territories differently from the slave states and calls them 'open to slavery or freedom', not already slave.", "overstated"),
          o("The Missouri Compromise line should be extended to the Pacific Ocean", "The title describes the effect of repealing the line and does not propose extending it.", "unsupported_by_source")],
        key: 0, facts: ["The Kansas-Nebraska Act of 1854 repealed the Missouri Compromise ban on slavery north of 36 degrees 30 minutes in most of the Louisiana Purchase."], evidence: "Printed title: 'designed to exhibit the comparative area of the free and slave states, and the territory open to slavery or freedom by the repeal of the Missouri Compromise'." },
      { skill: "3.D", topic: "5.7", tag: "3D", stem: "Which of the following developments of 1855 and 1856 would best support the mapmakers' concern about the spread of slavery into the territories?",
        options: [
          o("Violent clashes in Kansas between proslavery and antislavery settlers", "Kansas was organized under popular sovereignty in 1854, and armed conflict there in 1855 and 1856 showed slavery's status in a territory being fought over.", "key"),
          o("The Gadsden Purchase of land from Mexico for a southern railroad route in 1853", "The purchase was made chiefly to secure a southern railroad route and did not itself raise the question of slavery's status in a territory.", "true_but_not_responsive"),
          o("The Supreme Court's Dred Scott decision on slavery in the territories in 1857", "The ruling came after the map's 1856 date and would be later evidence, not a development the mapmakers could cite.", "wrong_period"),
          o("The Homestead Act of 1862, which offered western land to small farmers", "The act came six years after the map and concerned land for settlers, after Southern opposition had ended in secession.", "wrong_period")],
        key: 0, facts: ["Violence in Kansas, including the sack of Lawrence in May 1856, led to the label 'Bleeding Kansas'."], evidence: "The map highlights 'Kansas' and 'Nebraska' territories in a region colored differently from free and slave states." },
      { skill: "4.B", topic: "5.4", tag: "4B", stem: "The map is best understood in the context of which of the following developments?",
        options: [
          o("Sectional conflict over extending slavery into land the nation had acquired in the West", "After the Mexican Cession and the Kansas-Nebraska Act, the future of slavery in the territories divided North and South and shaped the 1856 campaign.", "key"),
          o("Jacksonian opposition to the Second Bank of the United States and to federal internal improvements", "The Bank War was fought in the 1830s and did not concern western territory in 1856.", "wrong_period"),
          o("Federal removal of Native American nations from the Southeast to the West", "Removal took place mostly in the 1830s and is unrelated to the question of slavery in the territories.", "wrong_period"),
          o("The growth of factories and railroads in the Old Northwest and the Northeast", "Industrial growth affected the North, but the map's subject is the extension of slavery.", "true_but_not_responsive")],
        key: 0, facts: ["The Compromise of 1850 and the Kansas-Nebraska Act each revisited slavery in the territories."], evidence: "The map divides the country into free states, slave states and territories 'open to slavery or freedom'." },
      { skill: "5.B", topic: "5.7", tag: "5B", stem: "The political conflict reflected on the map most directly contributed to which of the following later developments?",
        options: [
          o("Republican gains in the North culminating in Lincoln's election as president in 1860", "The party formed in 1854 to oppose slavery's spread, ran Fremont in 1856, and won the presidency with Lincoln in 1860.", "key"),
          o("The end of sectional disagreement after Kansas entered the Union as a slave state in 1857", "Kansas entered as a free state in 1861, and sectional disagreement continued to deepen.", "reversal"),
          o("A Democratic Party landslide in every free state in 1856", "James Buchanan won the 1856 election, but Fremont carried most free states, and the Democrats did not sweep them.", "overstated"),
          o("The ratification of the Fifteenth Amendment", "That amendment was ratified in 1870 and followed the Civil War and Reconstruction.", "wrong_period")],
        key: 0, facts: ["The Republican Party nominated John C. Fremont and William L. Dayton in 1856.", "Kansas was admitted as a free state in January 1861."], evidence: "The portraits at the top corners are labeled 'John C. Fremont' and 'Wm. L. Dayton'." },
    ],
  },
  {
    slot: "US2 u720", exam: "US2", cell: "real_d_school", theme: "Cartoon on U.S. rule of the new possessions of 1898", title: "'School Begins,' a Puck Cartoon of 1899", period: 7, topic: "7.2", sourceId: "img-school-begins-1899", kind: "image",
    intro: "A color cartoon published in the magazine Puck on January 25, 1899, a few weeks after the Treaty of Paris ending the Spanish-American War was signed. The caption beneath the picture and the writing on the blackboard are part of the cartoon.",
    stimDescription: "A 1899 Puck cartoon: Uncle Sam as a teacher stands over four seated children labeled Philippines, Hawaii, Porto Rico and Cuba, with older pupils at the rear and a lesson on the blackboard.",
    difficulty: ["exam_prep", "exam_prep", "basic_learning", "exam_prep"], keyAt: [1, 2, 3, 0],
    items: [
      { skill: "3.B", topic: "7.2", tag: "3B", stem: "Which of the following details of the cartoon best supports the cartoonist's argument that earlier territorial acquisitions had been successfully absorbed?",
        options: [
          o("Older pupils labeled with western states and territories read quietly at the back of the room", "The older class is labeled with earlier acquisitions and is shown calm and attentive while the new students look unhappy, which supports the claim of successful absorption.", "key"),
          o("Uncle Sam leans over the desk and holds a long pointer toward the four new students on the bench", "This detail shows authority over the new students, not the success of earlier acquisitions.", "true_but_not_responsive"),
          o("A globe stands at the lower left of the room", "The globe suggests worldwide reach but says nothing about how earlier territories were absorbed.", "true_but_not_responsive"),
          o("Four children labeled with new possessions sit together on a front bench", "These children represent the new possessions, not the earlier acquisitions.", "misattributed")],
        key: 0, facts: ["Texas, California, New Mexico, Arizona and Alaska were acquired earlier in the nineteenth century and were labeled on the older pupils' books."], evidence: "Older students at the rear hold books labeled with western states and territories and read calmly; the four new students labeled Philippines, Hawaii, Porto Rico and Cuba look unhappy." },
      { skill: "3.D", topic: "7.3", tag: "3D", stem: "The cartoonist's message about governing the new possessions is best supported by which of the following policies?",
        options: [
          o("The Platt Amendment, which tied the end of U.S. occupation of Cuba to U.S. rights to intervene", "The Platt Amendment of 1901 limited Cuban independence and kept U.S. oversight, as the blackboard's lesson says the United States would govern until they can govern themselves.", "key"),
          o("The Teller Amendment of 1898, which disclaimed any U.S. intention to annex or permanently govern Cuba", "That 1898 resolution promised Cuban self-government and does not reflect the cartoon's message of rule 'with or without their consent'.", "reversal"),
          o("The Open Door notes to China", "The notes of 1899 asked for equal trading access in China and did not concern governing new possessions.", "true_but_not_responsive"),
          o("The Treaty of Paris of 1898 recognizing Philippine independence", "The treaty transferred the Philippines to the United States and did not recognize their independence.", "reversal")],
        key: 0, facts: ["The Platt Amendment was added to Cuba's constitution in 1901.", "Under the Treaty of Paris, Spain ceded the Philippines, Puerto Rico and Guam to the United States."], evidence: "Blackboard lesson: the United States must govern its new territories 'with or without their consent until they can govern themselves'." },
      { skill: "4.A", topic: "7.2", tag: "4A", stem: "The ideas on the blackboard are best understood in the context of which of the following?",
        options: [
          o("U.S. imperialism around 1900, defended by claims of racial superiority and a civilizing mission", "Supporters of overseas expansion in 1898 and 1899 often argued that the United States had a duty to civilize and govern peoples they judged unfit for self-rule.", "key"),
          o("Progressive Era efforts to regulate large corporations and to protect consumers and workers at home", "Regulation of business was a domestic reform effort and not the subject of a cartoon on overseas rule.", "unrelated_development"),
          o("Isolationist opposition to overseas commitments after World War I", "That movement of the 1920s and 1930s came decades after the cartoon.", "wrong_period"),
          o("Reconstruction policy toward freedpeople in the South", "Reconstruction ended in 1877, and the cartoon concerns overseas possessions acquired in 1898.", "wrong_period")],
        key: 0, facts: ["The United States annexed Hawaii in 1898 and took Puerto Rico, Guam and the Philippines from Spain."], evidence: "The caption 'Uncle Sam (to his new class in Civilization)' and the blackboard lesson." },
      { skill: "5.B", topic: "7.3", tag: "5B", stem: "The acquisition of the Philippines that the cartoon portrays most directly led to which of the following?",
        options: [
          o("A war between the United States and Filipino nationalists who sought independence", "Filipino forces under Emilio Aguinaldo fought the United States from February 1899 in the Philippine-American War.", "key"),
          o("The admission of the Philippines as a state in 1900", "The Philippines were never admitted as a state and were a territory until independence in 1946.", "reversal"),
          o("A U.S. war with Japan over control of the islands in 1900", "No U.S.-Japanese war occurred then; war with Japan began in 1941.", "wrong_period"),
          o("Immediate independence for the Philippines under a guarantee from the United States", "The United States kept control, and independence was granted in 1946.", "reversal")],
        key: 0, facts: ["The Philippine-American War began in February 1899 and the Philippines gained independence in 1946."], evidence: "A child labeled 'Philippines' is shown as an unwilling pupil among the new possessions." },
    ],
  },
  {
    slot: "US1 u616", exam: "US1", cell: "real_d_reserv", theme: "Indian reservations in 1892", title: "A Federal Map of Indian Reservations, 1892", period: 6, topic: "6.3", sourceId: "map-indian-reservations-1892", kind: "image",
    intro: "A map of the United States printed in 1892 under the direction of the Commissioner of Indian Affairs. The reservations are the areas shaded orange and red.",
    stimDescription: "An 1892 map of the United States on which Indian reservations are shaded orange and red, with the largest in Indian Territory, the Dakotas, Montana, Arizona and New Mexico.",
    difficulty: ["basic_learning", "exam_prep", "basic_learning", "basic_learning"], keyAt: [0, 3, 2, 1],
    items: [
      { skill: "3.A", topic: "6.3", tag: "3A", stem: "Which of the following best describes the main idea that the map conveys?",
        options: [
          o("The federal government had set aside defined reservations for Native peoples across the nation", "The map is titled as showing Indian reservations and marks them in a distinct color within the nation's borders, as a federal record of reservation lands.", "key"),
          o("Native American nations still held most of the land in the states and territories of the West in 1892", "The shaded reservations cover only parts of the western states, and the rest of each state is shown as non-reservation land.", "overstated"),
          o("Reservations were located only in the former Confederate states", "The largest reservations lie in the West, and none of the large ones lie in the former Confederacy.", "reversal"),
          o("Native Americans had been relocated entirely east of the Mississippi River", "The reservations are shown mostly west of the Mississippi River.", "reversal")],
        key: 0, facts: ["The Office of Indian Affairs, part of the Interior Department, administered reservations and published maps of them."], evidence: "Title cartouche: 'Map showing Indian Reservations within the limits of the United States ... compiled under the direction of the Hon. T. J. Morgan, Commissioner of Indian Affairs, 1892'." },
      { skill: "3.D", topic: "6.3", tag: "3D", stem: "A historian argues that by 1892 the federal government had confined many Native American peoples to limited areas. Which of the following features of the map best supports that argument?",
        options: [
          o("Reservations appear as colored tracts covering only part of each state or territory", "Most orange and red tracts are small areas set apart within larger states, which supports the claim of confinement to limited lands.", "key"),
          o("Reservations appear in every state and territory of the Union, including the Southeast", "Many states, including most of the Southeast and the Atlantic coast, have no shaded reservation, so the map does not show this.", "overstated"),
          o("The map was drawn in 1892 by a private mapmaker with no connection to the government", "It was compiled under the Commissioner of Indian Affairs, so authorship does not support the argument.", "unsupported_by_source"),
          o("The reservations cover most of the land west of the Rocky Mountains", "The shaded tracts cover only small portions of the Pacific and Mountain states.", "reversal")],
        key: 0, facts: ["By 1892 the federal government had placed most Native peoples of the West on reservations."], evidence: "The map shades small reservations inside large states such as Washington, Montana, Nevada and Arizona; the surrounding land is shown without reservation shading." },
      { skill: "4.A", topic: "6.2", tag: "4A", stem: "The creation of many of the western reservations on the map was most directly connected to which of the following?",
        options: [
          o("Conflict as settlers, miners and railroads spread across the West after the Civil War", "Settlement and railroads pushed into Native lands after 1865, and wars and treaties confined many nations to reservations.", "key"),
          o("The Indian Removal Act of 1830, which moved Southeastern nations west of the Mississippi", "The Removal Act led to the removal of Southeastern nations to Indian Territory, but most western reservations on the map were created decades later.", "wrong_period"),
          o("The Louisiana Purchase of 1803, which brought the Great Plains into the United States", "The purchase transferred sovereignty claims from France and did not directly create the later reservations.", "wrong_period"),
          o("A federal policy of preserving Native lands from non-Native settlement", "The reservations were created as settlement expanded, and federal policy opened much land to settlers.", "reversal")],
        key: 0, facts: ["The Plains wars, including the Sioux wars and the Battle of Little Bighorn (1876), took place between 1860 and 1890.", "The Indian Removal Act was passed in 1830."], evidence: "Large reservations are shown in the Dakotas, Montana, the Southwest and Indian Territory." },
      { skill: "5.A", topic: "7.10", tag: "5A", stem: "Which of the following later developments most directly changed the policy of dividing reservations like those on the map into individual allotments?",
        options: [
          o("The Indian Reorganization Act of 1934", "The act ended the allotment of reservation lands and encouraged tribal self-government.", "key"),
          o("The Indian Citizenship Act of 1924", "The act granted citizenship to Native Americans but did not end allotment.", "true_but_not_responsive"),
          o("The federal termination policy of the 1950s", "Termination ended federal recognition of some tribes and continued assimilation instead of reversing it.", "reversal"),
          o("The occupation of Wounded Knee in 1973", "The occupation was a protest by the American Indian Movement and not a federal policy change.", "unrelated_development")],
        key: 0, facts: ["The Dawes Act of 1887 authorized dividing reservation land into individual allotments.", "The Indian Reorganization Act of 1934 ended allotment."], evidence: "The map marks the reservations as tracts of land held by Native nations, the lands later divided under allotment." },
    ],
  },
];
