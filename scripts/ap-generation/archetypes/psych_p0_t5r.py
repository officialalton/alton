"""AP Psychology 원형 — PS3~PS5 5세트 채우기용 연구 방법(Practice 2) 신규 단독 문항(2026-10-21). 단원 5·3 맥락. 2.A 설계 판별, 2.B 실험 요소, 2.C 비실험 요소, 2.D 윤리.
변형마다 질문·정답 개념이 다르다(숫자·이름만 바꾼 변형 금지). 시나리오는 모두 가상이다."""
from psych_common import *  # noqa: F401,F403
from psych_common import register

ITEMS = [
 # ---------------- 단원 5 연구 방법 ----------------
 ("r5_stress_opdef", "5.1", "2.B", "operational definitions of stress", "5.1.A", [
  ("A researcher wants to study whether a stress-management class lowers students' stress. She defines stress as the total score on a 20-item stress questionnaire given before and after the class. This definition of stress is best described as",
   "an operational definition", "An operational definition states exactly how a variable will be measured in the study.",
   [("a confounding variable", "A confounding variable is an uncontrolled variable that varies along with the independent variable."), ("a hypothesis", "A hypothesis is a testable prediction, not a statement of how a variable is measured."), ("a placebo", "A placebo is an inactive treatment given to a comparison group.")]),
  ("One team measures exam stress with a heart-rate monitor, and another team measures exam stress with a self-report rating from 1 to 10. Why might the teams reach different conclusions about the same students?",
   "They used different operational definitions, so they measured different aspects of stress.", "Different ways of measuring a variable can produce different results.",
   [("Operational definitions are needed only in correlational research, so one team made an error.", "Operational definitions are needed in every kind of research."), ("Heart rate and self-report ratings are both confounding variables.", "A measurement of a variable is not a confound; both are ways of measuring stress."), ("Self-report ratings are always more valid than physiological measures.", "Neither type of measure is always more valid; each has strengths and limits.")])]),
 ("r5_hassles_correlation", "5.1", "2.C", "correlation and causation in health research", "5.1.B", [
  ("Researchers survey 300 adults and find that adults who report more daily hassles also report more frequent colds. Which conclusion is best supported?",
   "Daily hassles and colds are associated, but the study cannot show that hassles cause colds.", "A correlation shows a relationship but does not by itself establish a cause.",
   [("Daily hassles cause colds, because the two measures are related.", "A correlation does not establish causation."), ("Colds cause daily hassles, because sick adults would report more problems.", "The data also cannot show that colds cause hassles."), ("Daily hassles and colds are unrelated, because a survey cannot measure two variables.", "A survey can measure more than one variable and relate them.")]),
  ("A study finds that people who exercise more hours per week report lower stress. Which is a plausible third-variable explanation of this correlation?",
   "People with more free time may both exercise more and feel less stressed.", "A third variable can produce an association between two variables without either causing the other.",
   [("Stress causes people to stop exercising.", "That is a possible reverse direction, not a third variable."), ("Exercise directly lowers stress in every person.", "That is a causal claim, not an alternative explanation."), ("The correlation coefficient must have been calculated incorrectly.", "Nothing in the scenario suggests a calculation error.")])]),
 ("r5_exercise_experiment", "5.1", "2.B", "variables in an experiment", "5.1.C", [
  ("Researchers randomly assign 60 students to a 20-minute daily walking program or a 20-minute daily stretching program for four weeks and then measure stress scores. What is the independent variable?",
   "The type of daily activity assigned", "The independent variable is the factor the researchers manipulate, here the activity to which students are assigned.",
   [("The students' stress scores", "Stress scores are the dependent variable that is measured."), ("The length of the program, four weeks", "The four weeks are the same for all students, so they are held constant."), ("The number of students, 60", "The number of students is the sample size.")]),
  ("In the walking-versus-stretching study, which feature best allows the researchers to conclude that differences in stress were caused by the type of activity?",
   "Random assignment of students to the two programs", "Random assignment makes the groups similar at the start so differences are more likely due to the program.",
   [("Measuring stress with a questionnaire after the study ended", "How stress is measured does not by itself support a causal conclusion."), ("Surveying students about whether they enjoy exercise", "Enjoyment does not create comparable groups."), ("Using a sample of volunteers", "Volunteer samples do not support causal conclusions.")])]),
 ("r5_gratitude_design", "5.2", "2.A", "identifying research designs in positive psychology", "5.2.A", [
  ("Participants are randomly assigned to write weekly gratitude letters or weekly neutral diary entries. After eight weeks, researchers compare well-being scores of the two groups. Which research design is this?",
   "Experiment", "The researchers manipulated the writing task and randomly assigned participants to conditions.",
   [("Correlational study", "A correlational study measures existing variables without manipulating one."), ("Case study", "A case study examines one individual or a very small group in depth."), ("Naturalistic observation", "Naturalistic observation records behavior without intervening.")]),
  ("Researchers ask 500 adults how often they express gratitude and how satisfied they are with their lives, and then examine the relationship between the two answers. Which research design is this?",
   "Correlational study", "The researchers measured two existing variables and related them without manipulation.",
   [("Experiment", "No independent variable was manipulated and no one was assigned to conditions."), ("Case study", "A case study focuses on one person or a few people."), ("Meta-analysis", "A meta-analysis combines the results of many earlier studies.")])]),
 ("r5_growth_designs", "5.2", "2.A", "case studies and longitudinal designs in growth research", "5.2.B", [
  ("A psychologist interviews one survivor of a major hardship in depth about the growth she experienced and writes a detailed report. What is the main limitation of this research approach?",
   "Findings from one person may not apply to other people.", "A case study offers depth but limited generalizability.",
   [("The data cannot include any information about the person's experiences.", "Case studies can include rich information about experiences."), ("It must use random assignment to be a case study.", "Random assignment is not part of a case study."), ("It always involves a large, representative sample.", "A case study involves one individual or a small group.")]),
  ("A researcher measures the personal growth of 50 survivors at the end of each year for five years. This design is best described as",
   "longitudinal", "A longitudinal design follows the same participants over time.",
   [("cross-sectional", "A cross-sectional design compares different groups at one point in time."), ("a double-blind experiment", "No treatment is manipulated and blinded."), ("a naturalistic observation", "Participants are measured repeatedly rather than observed in a natural setting.")])]),
 ("r5_prevalence_bias", "5.3", "2.C", "bias in surveys about disorders", "5.3.C", [
  ("A survey asks 1,000 adults whether they have ever experienced symptoms of a mental disorder, and some respondents under-report because they fear being judged. This problem is best described as",
   "social desirability bias", "Respondents may answer in the way they think looks acceptable rather than honestly.",
   [("experimenter bias", "Experimenter bias is when researchers' expectations influence the results."), ("confirmation bias", "Confirmation bias is favoring information that confirms existing beliefs."), ("a placebo effect", "A placebo effect is a change due to expectation of benefit from a treatment.")]),
  ("A clinic invites only people who are already seeking treatment to complete a survey about depression symptoms, and then reports the results as the rate of depression among all adults. What is the main problem?",
   "The sample is not representative of the population.", "Clients seeking treatment are likely to differ from the general population, so results cannot be generalized to all adults.",
   [("The survey is an experiment without random assignment.", "The study does not manipulate a variable, so it is not an experiment."), ("The survey lacks an operational definition because it uses symptoms.", "Using symptoms can be a valid operational definition; the sampling is the problem."), ("The researchers violated confidentiality by using a survey.", "Surveys do not by themselves violate confidentiality.")])]),
 ("r5_attrition", "5.5", "2.B", "attrition and group comparability", "5.5.A", [
  ("In a therapy trial, 40 percent of participants in an intensive therapy condition drop out before the final assessment, while few participants in the comparison condition drop out. Why is this a problem for interpreting the results?",
   "Those who remain may differ from those who left, so the groups may no longer be comparable.", "Uneven dropout can change who remains in each group and bias the comparison.",
   [("Dropouts prove that the therapy has no effect.", "Dropout rates do not show whether the therapy works."), ("Random assignment becomes impossible once anyone leaves.", "Random assignment happens at the start and is not undone by dropout."), ("Participants are not allowed to leave a study once they begin.", "Participants have the right to withdraw at any time.")]),
  ("In a study comparing two therapies, clients choose which therapy to receive. What is the main weakness of this design?",
   "Outcome differences could come from differences that existed before treatment.", "Self-selected groups may differ in motivation or severity before treatment, so the cause of the difference is unclear.",
   [("Clients should not be told which therapies are available before choosing.", "Informed choice is ethically appropriate; the weakness is in the comparability of groups."), ("A comparison of two therapies can never be an experiment of any kind.", "A comparison of therapies can be an experiment if clients are randomly assigned."), ("The two therapies must have exactly the same effect on clients.", "Nothing in the design shows that effects are equal.")])]),
 ("r5_group_comparison", "5.3", "2.A", "non-experimental comparison of existing groups", "5.3.D", [
  ("Researchers compare nightly hours of sleep in adults who have been diagnosed with depression and adults with no diagnosis. They do not assign anyone to a group. Which statement is accurate?",
   "It is not an experiment, because the researchers did not manipulate an independent variable.", "Groups were formed by existing characteristics, not by manipulation or assignment.",
   [("It is an experiment, because it has two groups.", "Having two groups is not enough; an experiment requires manipulation and random assignment."), ("It is a case study, because the participants have a diagnosis.", "A case study examines one individual or a very small group in depth."), ("It is a double-blind experiment, because participants did not know the hypothesis.", "Without manipulation of a variable, there is no experiment of any kind.")]),
  ("A researcher interviews a patient with obsessive-compulsive symptoms every week for a year and writes a detailed description of the patient's thoughts and progress. Which research design is this?",
   "Case study", "A case study examines one individual in depth over time.",
   [("Cross-sectional design", "A cross-sectional design compares different groups at one time."), ("Experiment", "No variable was manipulated across groups."), ("Survey", "A survey collects responses from many people, usually with fixed questions.")])]),
 ("r5_dependent_confound", "5.5", "2.B", "dependent variables and confounds in treatment trials", "5.5.A", [
  ("In a trial of cognitive-behavioral therapy for panic attacks, researchers compare a therapy group with a no-treatment group and record the number of panic attacks each participant has per week. What is the dependent variable?",
   "The number of panic attacks per week", "The dependent variable is the outcome the researchers measure.",
   [("Whether participants received therapy or no treatment", "That is the independent variable."), ("The cognitive-behavioral therapy method", "The therapy method is the treatment being tested."), ("The researchers' hypothesis", "A hypothesis is a prediction, not a variable measured in the study.")]),
  ("In the panic-attack trial, the therapy group also received weekly encouraging phone calls from a coach, while the no-treatment group did not. The phone calls are best described as",
   "a confounding variable", "The calls differ between groups along with the treatment, so their effect cannot be separated from the therapy's effect.",
   [("the dependent variable", "The dependent variable is the outcome being measured."), ("an operational definition", "An operational definition specifies how a variable is measured."), ("a random sample", "A random sample is a method of choosing participants from a population.")])]),
 ("r5_selfselection", "5.5", "2.C", "self-selection in group comparisons", "5.5.B", [
  ("Researchers find that people who chose to join a support group report higher well-being than people who did not join. Which alternative explanation should the researchers consider?",
   "People who join may already differ in motivation or well-being.", "Self-selection means the groups may have differed before the support group began.",
   [("Support groups always lower well-being.", "That contradicts the observed result and is not an alternative explanation of it."), ("Well-being cannot be measured.", "Well-being can be measured with questionnaires and other tools."), ("The study must have used a double-blind procedure.", "Blinding is not the issue in a comparison of self-selected groups.")]),
  ("Which change in design would best let the researchers conclude that a support group causes higher well-being?",
   "Randomly assigning volunteers to join the group or to a waiting list", "Random assignment makes the groups comparable at the start, allowing causal conclusions.",
   [("Surveying more members of the support group", "A larger sample of members does not create a comparison group."), ("Asking members how much they like the group", "Satisfaction ratings do not show causes of well-being."), ("Interviewing the group leader about its effects", "A leader's opinion is not a comparison of outcomes.")])]),
 ("r5_irb_withdraw", "5.1", "2.D", "ethical review and the right to withdraw", "5.1.D", [
  ("Researchers plan a study in which volunteers give a speech in front of evaluators to induce mild stress. Before beginning, a committee at the university reviews the plan to protect participants. What is this committee called?",
   "An institutional review board", "An institutional review board reviews proposed research to protect participants.",
   [("A peer review board of journal editors", "Peer review of journal articles occurs after a study is completed."), ("A control group", "A control group is a comparison condition in an experiment."), ("A debriefing panel", "Debriefing is a post-study explanation to participants, not a review committee.")]),
  ("During the speech study, a participant becomes very upset and asks to leave. The researcher says she must finish so that the data will be complete. Which ethical guideline is the researcher violating?",
   "The right to withdraw from the study without penalty", "Participants can leave at any time, and the researcher must respect that.",
   [("Confidentiality of records", "Nothing in the scenario concerns who can see participants' records."), ("Debriefing after the study", "Debriefing occurs after the study and is not the issue here."), ("Random assignment to conditions", "Random assignment is a design technique, not an ethical guideline.")])]),
 # ---------------- 단원 3 연구 방법 ----------------
 ("r5_modeling_experiment", "3.9", "2.B", "variables in an observational-learning experiment", "3.9.A", [
  ("Children are randomly assigned to watch a video in which an adult is rewarded after building a tower of blocks, or a video in which the adult is scolded after building it. Later, observers record how many towers each child builds in free play. What is the independent variable?",
   "Whether the adult in the video was rewarded or scolded", "The researchers manipulated the consequence that the model received.",
   [("The number of towers each child built", "The number of towers is the dependent variable."), ("The age of the children", "Children's age is not described as manipulated."), ("The color of the blocks", "Nothing indicates that block color varied.")]),
  ("In the tower study, the observers who counted towers did not know which video each child had watched. This feature helps control for",
   "observer bias", "Keeping observers unaware of the condition prevents their expectations from influencing their counts.",
   [("sampling bias", "Sampling bias concerns who is chosen for the study."), ("social desirability bias", "Social desirability bias concerns participants' answers to questions."), ("the placebo effect", "A placebo effect concerns participants' expectation of treatment benefit.")])]),
 ("r5_parenting_correlation", "3.6", "2.C", "interpreting correlational findings about parenting", "3.6.A", [
  ("A study of 400 families finds that children of authoritative parents have higher grades than children of other parents. Which statement is not justified by the study?",
   "Authoritative parenting causes children to earn higher grades.", "A correlational finding cannot show that one variable causes the other.",
   [("Authoritative parenting is associated with higher grades.", "This is the pattern the study found."), ("Other factors, such as family income, might relate to both variables.", "A third variable is a reasonable consideration."), ("Children's grades might influence how parents respond to them.", "The direction of the relationship might run the other way.")]),
  ("In the parenting study, researchers rated each parent's style from a home visit and collected grades from school records. Why is it a strength that the researchers did not rely only on parents' own descriptions of their style?",
   "Observed ratings can reduce bias from parents describing themselves in a favorable way.", "Independent ratings are less affected by social desirability than self-descriptions.",
   [("Observation makes the study an experiment.", "Observing does not turn a study into an experiment."), ("Observers do not need operational definitions of parenting style.", "Operational definitions are always needed."), ("Home visits ensure that the sample is random.", "A home visit does not determine how the sample was selected.")])]),
 ("r5_gender_play_opdef", "3.3", "2.B", "operational definitions in gender development research", "3.3.A", [
  ("A researcher wants to study how much toddlers play with gender-typed toys. She defines this as the number of minutes a toddler spends with toys from a preselected list during a 20-minute free-play session. This definition is best described as",
   "an operational definition", "The definition states exactly how the variable is measured.",
   [("a hypothesis", "A hypothesis is a testable prediction."), ("a random assignment procedure", "Random assignment places participants in conditions by chance."), ("a debriefing", "Debriefing is an explanation given to participants after a study.")]),
  ("In the toddler play study, observers rate play minutes while sitting in the room, and toddlers seem to change their behavior when observed. What is the problem?",
   "Participants may behave differently because they know they are being observed.", "Awareness of being observed can change behavior and reduce validity.",
   [("The observers' presence is a violation of random sampling.", "Random sampling is about how participants are chosen."), ("Observation always makes the study an experiment.", "Observation does not require manipulating a variable."), ("The study has no dependent variable.", "Minutes of play is a measured outcome.")])]),
 ("r5_helplessness_debrief", "3.8", "2.D", "debriefing in learning research", "3.8.A", [
  ("In a study of persistence, volunteers are told that a set of puzzles is solvable, although some puzzles are actually unsolvable. After the session, the researcher explains the real purpose and the reason for the unsolvable puzzles. This explanation is called",
   "debriefing", "Debriefing explains the purpose and procedures of a study to participants afterward.",
   [("informed consent", "Informed consent occurs before the study."), ("random assignment", "Random assignment is a design technique."), ("replication", "Replication is repeating a study to check results.")]),
  ("Researchers who use unsolvable tasks to study frustration must protect participants from lasting distress. Which action best follows ethical guidelines?",
   "Monitoring participants and ending the task if someone becomes seriously distressed", "Researchers must protect participants from harm.",
   [("Keeping participants unaware of any risk", "Participants must be informed of risks that could affect their decision to take part."), ("Requiring participants to continue so that data are complete", "Participants can withdraw at any time."), ("Sharing individual results with their classmates", "Individual results should be kept confidential.")])]),
]

NAMES = register(globals(), ITEMS)
