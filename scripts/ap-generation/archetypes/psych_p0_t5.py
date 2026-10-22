"""AP Psychology 원형 — PS3~PS5 5세트 채우기용 신규 단독 문항(2026-10-21). 구조 기준(오너 정리): 공개 문항과 자료·조건·과제가 달라야 하며 숫자·이름·문장만 바꾼 변형은 새 문항이 아니다.
원형마다 변형 2개(서로 다른 질문·정답 개념). 시나리오는 모두 가상이다. 선택지 문장은 서로 다른 오개념을 가진다. 정답은 가장 긴 선택지가 아니도록 쓴다."""
from psych_common import *  # noqa: F401,F403
from psych_common import register

ITEMS = [
 # ---------------- 단원 1 ----------------
 ("t5_sleep_myths", "1.5", "1.A", "common sleep misconceptions", "1.5.A", [
  ("Which statement about sleep is best supported by sleep research?",
   "Brain activity during REM sleep resembles waking brain activity, and vivid dreams are common then.", "REM sleep is marked by fast, irregular brain waves like those of an awake person, and dreams in this stage are usually vivid.",
   [("The brain shuts down during sleep, so no mental activity occurs until morning.", "The brain remains active throughout sleep, and some stages are as active as waking."), ("Every adult needs exactly eight hours of sleep to function normally.", "Sleep needs vary from person to person, so no single number fits everyone."), ("A sleeping person cannot respond to meaningful sounds such as their own name.", "Sleepers can respond to meaningful stimuli, which is why a familiar voice can wake them.")]),
  ("Which statement about dreaming is accurate?",
   "Dreams can occur in non-REM stages, although dreams in REM sleep tend to be more vivid.", "Dreaming is not limited to REM sleep, although REM dreams are typically longer and more vivid.",
   [("Dreams occur only in REM sleep and never in any other stage.", "Dreams have been reported after awakenings from non-REM stages as well."), ("A person who cannot remember a dream did not dream that night.", "People dream whether or not they remember the dream after waking."), ("Research has proven that every dream reveals a hidden wish.", "The idea that dreams are hidden wishes is a theory, not a proven finding.")])]),
 ("t5_heritability_confusion", "1.1", "1.A", "heritability confusions", "1.1.A", [
  ("A news article reports that the heritability of a trait in a studied population is 60 percent and concludes that 60 percent of each person's trait is caused by genes. What is the best correction?",
   "Heritability describes how much of the variation among people in a group is linked to genetic differences, not how much of one person's trait is due to genes.", "Heritability is a group statistic about variation; it cannot be applied to a single individual.",
   [("A heritability of 60 percent means the trait cannot be changed by the environment.", "Even highly heritable traits can be influenced by the environment."), ("Heritability can be calculated only from studies of identical twins raised together.", "Heritability estimates can also come from adoption and family studies."), ("A heritability of 60 percent shows that the trait is controlled by one gene.", "Most psychological traits involve many genes together with environmental influences.")]),
  ("Identical twins who were adopted into different families are more alike on a trait than unrelated children adopted into the same family. Which conclusion is best supported?",
   "Genetic similarity contributes to the trait, though the environment may also play a role.", "Greater similarity in people who share genes, even in different homes, points to a genetic contribution without ruling out the environment.",
   [("The environment has no effect on the trait.", "The result shows a genetic contribution but does not show that environment has no effect."), ("The trait is determined entirely by genes.", "Similarity is not perfect evidence of complete genetic determination, and environmental effects remain possible."), ("Twin and adoption studies cannot be used to study the influence of genes.", "Comparing relatives who differ in genetic similarity and home environment is a standard way to study genetic influence.")])]),
 # ---------------- 단원 3 ----------------
 ("t5_maturation_motor", "3.2", "1.A", "maturation and motor milestones", "3.2.B", [
  ("Parents notice that all of their children began to walk at about the same age despite very different amounts of practice. Which concept best explains this pattern?",
   "Maturation", "Maturation is the biologically driven sequence of growth that unfolds largely on its own timetable.",
   [("Accommodation", "Accommodation is the adjustment of a mental schema to fit new information."), ("Scaffolding", "Scaffolding is guided support from a more skilled helper, not an internal timetable."), ("Shaping", "Shaping is reinforcing successive approximations of a behavior.")]),
  ("A pediatrician explains that an infant will roll over, then sit, then crawl in a predictable order. This description most directly illustrates",
   "a developmental sequence guided by biological readiness", "Motor milestones tend to appear in a typical order because the nervous system and muscles mature in sequence.",
   [("a critical flaw in the design of cross-sectional research", "The sequence is a developmental pattern, not a flaw in a research design."), ("the zone of proximal development", "The zone of proximal development concerns tasks a learner can do with help."), ("the effects of a teratogen", "A teratogen is a harmful prenatal agent, which the description does not mention.")])]),
 ("t5_gender_socialization", "3.3", "1.B", "gender socialization", "3.3.A", [
  ("A toy store arranges building sets in an aisle with pictures of boys and dolls in an aisle with pictures of girls, and children tend to ask for the toys shown for their gender. Which concept does this most clearly illustrate?",
   "Gender socialization", "Gender socialization is the process by which society's messages teach children expectations about gender.",
   [("Sexual orientation", "Sexual orientation refers to whom a person is attracted to, not to learned expectations about toys."), ("Gender identity", "Gender identity is a person's internal sense of being male, female, or another gender."), ("Object permanence", "Object permanence is a cognitive milestone about objects continuing to exist.")]),
  ("A teacher praises boys for being brave and girls for being quiet and helpful, even when they behave in the same way. These responses most directly teach children",
   "gender roles, which are society's expectations for behavior", "Different treatment based on gender communicates culturally shaped expectations, called gender roles.",
   [("sex differences that are determined by chromosomes", "The teacher's responses are social messages, not biological sex differences."), ("an attachment style", "An attachment style describes patterns in emotional bonds with caregivers."), ("an implicit attitude toward the teacher", "The scenario describes what children learn from the teacher, not their attitudes toward the teacher.")])]),
 ("t5_sex_gender_terms", "3.3", "1.A", "sex, gender identity, and sexual orientation", "3.3.A", [
  ("Which statement correctly distinguishes between the terms sex, gender identity, and sexual orientation?",
   "Gender identity is a person's internal sense of gender, while sexual orientation concerns the people to whom a person is attracted.", "These terms refer to different concepts: biological sex, internal sense of gender, and attraction.",
   [("Gender identity and sexual orientation both refer to a person's chromosomes.", "Chromosomes relate to biological sex, not to either of these terms."), ("Sexual orientation describes how a person was taught to behave as a boy or a girl.", "Learned expectations about behavior are gender roles, not sexual orientation."), ("Sex and gender identity always match in every person.", "A person's gender identity may or may not match the sex assigned at birth.")]),
  ("A psychologist explains that a person's attraction to others of the same gender or a different gender is a separate matter from that person's sense of being male or female. The psychologist is separating",
   "sexual orientation from gender identity", "Sexual orientation is about attraction, and gender identity is about an internal sense of gender.",
   [("gender roles from gender stereotypes", "The psychologist is separating attraction from internal sense of gender, not roles from stereotypes."), ("sex-linked genes from learned behavior", "Genes and learning are not the contrast being drawn."), ("assimilation from accommodation", "Assimilation and accommodation are cognitive processes in Piaget's theory.")])]),
 ("t5_assimilation_accommodation", "3.4", "1.A", "schema processes", "3.4.A", [
  ("A toddler who knows the word 'doggie' for her family's pet calls a cat 'doggie.' Her mother points out the cat's face and sound, and later the child calls it 'kitty.' The child's change from 'doggie' to 'kitty' illustrates",
   "accommodation", "The child changed her existing schema to take in new information, which is accommodation.",
   [("assimilation", "Assimilation is fitting new information into an existing schema, as when she first called the cat 'doggie.'"), ("object permanence", "Object permanence is understanding that objects exist when out of sight."), ("conservation", "Conservation is understanding that quantity stays the same despite a change in appearance.")]),
  ("A child who has only seen sparrows calls an eagle 'bird' without changing what she knows about birds. Her response illustrates",
   "assimilation", "She fit the new example into her existing bird schema without changing the schema.",
   [("accommodation", "Accommodation would require her to revise her schema for birds."), ("egocentrism", "Egocentrism is difficulty taking another person's perspective."), ("the zone of proximal development", "The zone of proximal development concerns what a child can do with guidance.")])]),
 ("t5_temperament", "3.6", "1.A", "temperament", "3.6.B", [
  ("A newborn cries often, is hard to soothe, and reacts strongly to new sounds. Which concept best describes these early, biologically based differences in emotional reactivity?",
   "Temperament", "Temperament refers to biologically based differences in emotional reactivity that appear early in life.",
   [("Authoritative parenting", "Authoritative parenting is a caregiving style, not an infant's emotional reactivity."), ("A zone of proximal development", "That is a range of tasks a learner can do with help."), ("Identity formation", "Identity formation is an adolescent task, not a newborn characteristic.")]),
  ("Which statement about temperament and attachment is best supported by developmental research?",
   "A child's temperament can influence how caregivers respond, which may affect the attachment relationship.", "Early temperament and caregiver responses interact as an attachment relationship develops.",
   [("Temperament is determined entirely by the parenting style a child receives.", "Temperament is biologically based and appears before parenting can shape it."), ("Temperament changes dramatically with every stage of development, so it cannot be studied.", "Temperament shows moderate stability across development and is studied."), ("Attachment style is the same thing as temperament.", "Attachment describes a bond with a caregiver, while temperament is a child's characteristic reactivity.")])]),
 ("t5_habituation", "3.7", "1.A", "habituation", "3.7.C", [
  ("A family moves next to a train line. At first, the passing trains wake everyone up, but after several weeks they no longer notice the noise. This decreasing response to a repeated, harmless stimulus is called",
   "habituation", "Habituation is a decrease in response to a repeated stimulus that is not important.",
   [("extinction", "Extinction is the weakening of a conditioned response when the conditioned stimulus is no longer paired with the unconditioned stimulus."), ("spontaneous recovery", "Spontaneous recovery is the return of an extinguished conditioned response after a rest period."), ("stimulus discrimination", "Stimulus discrimination is responding differently to different stimuli.")]),
  ("A baby looks longer at a new picture than at a picture she has already seen many times. Researchers use this pattern to infer that she can tell the pictures apart. This method relies on",
   "habituation to the familiar picture", "Declining attention to a repeated picture, and renewed attention to a new one, shows the infant notices the difference.",
   [("positive reinforcement of looking", "No reward is described as following looking."), ("observational learning from an adult model", "No model is described in the scenario."), ("operant punishment of looking away", "Nothing is described as discouraging looking away.")])]),
 ("t5_taste_aversion_prep", "3.7", "1.A", "taste aversion and preparedness", "3.7.C", [
  ("After becoming ill hours after eating a new casserole, a man avoids the taste of casserole, even though he knows the illness was caused by a virus. Which principle best explains the avoidance?",
   "Conditioned taste aversion after a single pairing with illness", "Taste aversion is a conditioned response that can form after one pairing, even with a delay of hours.",
   [("Spontaneous recovery of a response that had been extinguished", "Nothing was extinguished earlier in the scenario."), ("Operant punishment that follows the act of eating the casserole", "Punishment is a consequence that follows a behavior and is arranged to reduce it; here the taste became linked with illness."), ("Insight learning that produces a sudden new solution to a problem", "Insight learning is a sudden solution to a problem.")]),
  ("Humans acquire fears of snakes and heights more easily than fears of flowers or cell phones. Which concept best explains this?",
   "Preparedness, an inborn readiness to learn some associations", "Biological preparedness makes some associations, such as fear of snakes, easier to learn.",
   [("Latent learning, which shows up only when a reason to show it appears", "Latent learning is learning that is not shown until there is a reason to show it."), ("Shaping, which rewards successive steps toward a target behavior", "Shaping is reinforcing successive approximations toward a target behavior."), ("A variable-ratio schedule of reinforcement for fearful responses", "A reinforcement schedule is not part of this explanation.")])]),
 ("t5_vicarious_reinforcement", "3.9", "1.A", "observational learning and vicarious consequences", "3.9.A", [
  ("A child sees a classmate receive extra recess for sharing crayons and soon begins to share crayons more often. Which concept best explains the child's change in behavior?",
   "Vicarious reinforcement within observational learning", "The child saw a model rewarded and was more likely to imitate the behavior.",
   [("Classical conditioning of a reflex", "No reflex or neutral stimulus pairing is described."), ("Negative punishment of the child", "The child lost nothing; the child observed another child receive a reward."), ("Latent learning", "Latent learning occurs without observed reinforcement and appears when motivated.")]),
  ("A teenager watches an online video in which an influencer is mocked for a risky stunt, and the teenager decides not to try it. Which concept best explains the decision?",
   "Observational learning from a model's negative consequence", "Seeing a model suffer a negative consequence can make an observer less likely to copy the behavior.",
   [("Positive reinforcement of the teenager's own behavior", "The teenager was not given any reward or consequence directly."), ("Spontaneous recovery of an extinguished response", "No earlier conditioned response is returning."), ("Shaping through reinforcement of successive steps", "Shaping reinforces successive approximations by the learner, which is not described.")])]),
 # ---------------- 단원 4 ----------------
 ("t5_facial_feedback", "4.7", "1.A", "facial-feedback hypothesis", "4.7.A", [
  ("In a study, volunteers hold a pen between their teeth, which makes their faces form a smile-like expression, while rating cartoons. They rate the cartoons as slightly funnier. Which hypothesis does this result support?",
   "The facial-feedback hypothesis", "The hypothesis proposes that facial expressions can influence the emotional experience.",
   [("The broaden-and-build theory", "That theory proposes that positive emotions widen attention and build resources."), ("The display rules of a culture", "Display rules are cultural norms about expressing emotion."), ("The fundamental attribution error", "That error is a tendency to overestimate dispositional causes of behavior.")]),
  ("A coach tells a nervous player to stand tall and smile, hoping to feel more confident. The coach's advice is based most directly on the idea that",
   "facial expressions and body signals can feed back to influence emotional experience", "The facial-feedback idea suggests that expressions can shape how emotions are felt.",
   [("emotions are caused only by thoughts and not at all by the body", "That rejects the idea that expressions feed back to emotional experience."), ("people should hide emotions in every culture", "Hiding emotions is not what the advice proposes."), ("the nervous player has an external locus of control", "Locus of control concerns beliefs about control, not facial expressions.")])]),
 ("t5_compliance_techniques", "4.3", "1.A", "compliance techniques", "4.3.B", [
  ("A neighbor first asks a homeowner to sign a petition for safer crosswalks and a week later asks the same person to put a large lawn sign in the yard. Which compliance technique is the neighbor using?",
   "Foot-in-the-door technique", "Agreeing to a small request first makes a person more likely to agree to a larger one later.",
   [("Door-in-the-face technique", "That technique begins with a large request that is likely to be refused."), ("Central-route persuasion", "Central-route persuasion relies on careful thinking about arguments."), ("Groupthink", "Groupthink is a group's desire for harmony overriding critical thinking.")]),
  ("A salesperson asks a customer to buy an expensive warranty. After the customer declines, the salesperson asks for a smaller purchase of a basic cover, which the customer accepts. Which technique is the salesperson using?",
   "Door-in-the-face technique", "A large request that is refused is followed by a smaller request that is more likely to be accepted.",
   [("Foot-in-the-door technique", "That technique starts with a small request before a larger one."), ("Peripheral-route persuasion", "Peripheral-route persuasion relies on cues such as attractiveness rather than the request sequence."), ("Social loafing", "Social loafing is reduced effort when working in a group.")])]),
 # ---------------- 단원 5 (개념) ----------------
 ("t5_therapeutic_alliance", "5.5", "1.A", "therapeutic alliance", "5.5.A", [
  ("A review of many studies finds that clients improve more when they feel understood by and in agreement about goals with their therapist, regardless of the specific therapy used. This finding highlights the importance of",
   "the therapeutic alliance", "The therapeutic alliance is the collaborative bond between client and therapist, and it is linked to better outcomes.",
   [("a placebo control group", "A placebo control group is a research design feature, not a client–therapist bond."), ("systematic desensitization", "Systematic desensitization is a specific behavioral technique."), ("a mental status diagnosis", "A diagnosis does not describe the quality of the client–therapist relationship.")]),
  ("Which practice best illustrates evidence-based treatment?",
   "A therapist selects a treatment method that research has shown to be effective for the client's condition and adjusts it with the client's preferences.", "Evidence-based practice integrates research evidence, clinical expertise, and client characteristics and preferences.",
   [("A therapist uses only the method that the therapist personally prefers, whatever the research shows.", "Evidence-based practice relies on research, not only on personal preference."), ("A therapist avoids discussing treatment options so that the client does not become biased.", "Clients' preferences are part of evidence-based practice."), ("A therapist chooses the newest therapy because it is newest.", "Novelty is not evidence of effectiveness.")])]),
 ("t5_dsm_icd", "5.3", "1.A", "DSM and ICD classification", "5.3.B", [
  ("Clinicians in many countries use the DSM or the ICD when diagnosing a client. What is the main purpose of these systems?",
   "To describe disorders by shared symptoms so clinicians can communicate and plan care", "Classification systems give clinicians and researchers a common language for describing disorders.",
   [("To prove the biological cause of each disorder before it can be treated", "These systems describe symptoms and patterns; they do not establish causes."), ("To measure a client's intelligence and aptitude before any therapy", "Intelligence testing is separate from diagnostic classification."), ("To replace the clinical interview with a fixed checklist of scores", "Diagnosis depends on clinical assessment using the criteria.")]),
  ("Critics of diagnostic classification sometimes argue that labeling a person with a disorder can lead others to treat the person differently. Which concern is this?",
   "A diagnostic label may create stigma that affects how a person is treated", "Stigma is a recognized concern about diagnostic labels.",
   [("A label always reflects a single biological cause", "Labels do not require a single cause."), ("Classification systems never change over time", "Classification systems are revised periodically."), ("Diagnosis is possible without any information about symptoms", "Symptoms are the basis for diagnosis.")])]),
 ("t5_unconditional_regard", "5.5", "1.A", "humanistic therapy", "5.5.B", [
  ("A therapist listens without judging, reflects the client's feelings back, and accepts the client no matter what the client says. Which approach is the therapist most clearly using?",
   "Humanistic therapy emphasizing unconditional positive regard", "Humanistic therapy offers acceptance and empathy to support a person's growth.",
   [("Systematic desensitization of fears through gradual exposure", "That behavioral technique gradually pairs relaxation with feared stimuli."), ("Cognitive restructuring of unhelpful thought patterns", "That technique challenges and changes unhelpful thought patterns."), ("Psychodynamic interpretation of unconscious conflicts", "That approach interprets unconscious conflicts and past experiences.")]),
  ("A client says that she feels she must be perfect to be loved. Which response best reflects a humanistic therapist's approach?",
   "Reflecting her feelings and expressing acceptance of her as she is", "Humanistic therapy relies on empathy and unconditional acceptance.",
   [("Telling her what her dream symbols mean", "Interpreting symbols is characteristic of psychodynamic approaches."), ("Assigning a schedule of rewards for relaxation", "Reward schedules are used in behavioral approaches."), ("Teaching her to replace each thought with a rule", "Rule-based thought replacement is more typical of cognitive approaches.")])]),
]

NAMES = register(globals(), ITEMS)
