"""AP Psychology 원형 — PS5 마지막 칸(단원 2 연구 방법, Practice 2) 신규 단독 문항(2026-10-21). 변형마다 질문·정답 개념이 다르다. 시나리오는 모두 가상이다."""
from psych_common import *  # noqa: F401,F403
from psych_common import register

ITEMS = [
 ("r5_study_confound", "2.4", "2.B", "confounding variables in a memory experiment", "2.4.C", [
  ("A teacher tests whether flashcards help memory more than rereading notes. Students who chose flashcards studied in the morning, and students who chose rereading studied late at night; the flashcard group then scored higher on a quiz. Which variable most directly threatens the conclusion that flashcards caused the higher scores?",
   "Time of day of studying", "Time of day differed between the groups along with the study method, so it is a confound.",
   [("The number of quiz questions", "All students answered the same quiz, so the number of questions did not vary between groups."), ("The dependent variable of quiz score", "The quiz score is the outcome being measured, not a confound."), ("The students' enjoyment of the teacher", "Nothing in the description suggests that enjoyment differed between groups.")]),
  ("Researchers want to test whether spacing out study sessions improves memory. They randomly assign students to study a word list in one 60-minute session or in three 20-minute sessions on different days, and test everyone one week later. What is the dependent variable?",
   "The number of words each student recalled on the test", "The dependent variable is the outcome the researchers measure.",
   [("The schedule of study sessions", "The schedule is the independent variable that the researchers manipulate."), ("The length of the word list", "The word list was the same for everyone, so it is held constant."), ("The one-week delay before testing", "The delay was the same for all students, so it is held constant.")])]),
 ("r5_misinformation_design", "2.7", "2.B", "variables in a misinformation experiment", "2.7.C", [
  ("Participants watch a short video of a minor traffic accident. Half are asked how fast the cars were going when they 'smashed' into each other, and half are asked how fast the cars were going when they 'bumped' into each other. A week later, all are asked whether there was broken glass in the video. What is the independent variable?",
   "The verb used in the question about speed", "The researchers manipulated the wording of the question that participants were asked.",
   [("The participants' reports about broken glass", "Reports about broken glass are the dependent variable."), ("The video of the accident", "All participants saw the same video, so it is held constant."), ("The one-week delay", "The delay was the same for everyone, so it is held constant.")]),
  ("In the accident study, the researchers randomly assigned participants to the two question wordings. Why is this useful for the researchers' conclusion?",
   "It makes the groups similar before the manipulation, so differences in later reports are more likely due to the wording.", "Random assignment helps control preexisting differences between groups.",
   [("It ensures that all participants remember the video equally well", "Random assignment does not equalize memory for the video."), ("It allows the researchers to generalize to all witnesses of accidents", "Generalization depends on how participants were sampled."), ("It prevents participants from knowing the purpose of the study", "Random assignment does not hide the purpose from participants.")])]),
 ("r5_test_reliability", "2.8", "2.C", "reliability of tests", "2.8.B", [
  ("A school gives the same student the same vocabulary test twice, one week apart, and gets scores of 62 and 91. Which quality of the test is most clearly in question?",
   "Reliability", "A test that gives very different scores to the same person under similar conditions lacks reliability.",
   [("Validity", "Validity concerns whether the test measures what it is intended to measure."), ("Standardization", "Standardization concerns uniform procedures and norms for a test."), ("Predictive power for achievement", "Predictive power is evaluated by comparing scores with later outcomes.")]),
  ("A company develops a test of creativity and finds that scores on the test are nearly the same when students take it twice. However, the scores are unrelated to any other measure of creative work. Which statement best describes the test?",
   "It appears reliable but its validity is in doubt.", "Consistent scores show reliability, but unrelated results suggest the test may not measure creativity.",
   [("It is valid but not reliable.", "Validity requires consistency, and here the scores are consistent."), ("It is neither reliable nor standardized.", "The consistent scores indicate reliability."), ("It is reliable and therefore valid.", "Reliability does not guarantee validity.")])]),
 ("r5_test_validity", "2.8", "2.C", "validity of tests", "2.8.B", [
  ("A college uses an admissions test to predict first-year grades. Researchers find that students' test scores are strongly related to their first-year grades. Which quality of the test does this finding support?",
   "Predictive validity", "A test that predicts later outcomes shows predictive validity.",
   [("Test-retest reliability", "Test-retest reliability concerns consistency across repeated testing."), ("Standardization sample", "A standardization sample refers to the group used to set norms."), ("Content validity", "Content validity concerns whether test items cover the full domain being measured.")]),
  ("A test of musical aptitude was normed on students from one city. Researchers discover that students from other cultures score lower even when they play instruments equally well. Which concern does this raise about the test?",
   "Possible test bias", "Group differences unrelated to the ability being measured raise concerns of test bias.",
   [("The test must have high reliability", "Differences between groups do not show that reliability is high."), ("The test is not standardized, because it was normed in a city", "Norming on a group is part of standardization; the concern is that the norm group may not represent others."), ("The test measures intelligence rather than aptitude", "The scenario does not indicate that the test measures intelligence.")])]),
 ("r5_testing_effect_opdef", "2.6", "2.B", "operational definitions in retrieval practice research", "2.6.C", [
  ("Researchers study whether taking practice tests helps students remember a lecture. They define 'retrieval practice' as completing a 10-question short-answer quiz on the lecture without notes. This definition is best described as",
   "an operational definition", "The definition states exactly how the practice will be carried out and measured.",
   [("a testable hypothesis about learning", "A hypothesis is a testable prediction."), ("a random sample of students", "A random sample is a way of selecting participants."), ("a placebo control condition", "A placebo is an inactive treatment given to a comparison group.")]),
  ("In the retrieval practice study, students in the quiz group scored 18 percentage points higher on a final test than students who reread notes. The researchers say that retrieval practice improved memory. Which feature of the design most directly allows that causal conclusion?",
   "Random assignment of students to the quiz and reread conditions", "Random assignment makes the groups comparable at the start.",
   [("Using a short-answer test as the final measure", "The type of test does not by itself support a causal conclusion."), ("Testing all students on the same day", "Testing on the same day controls timing but does not make the groups comparable at the start."), ("Reporting the difference in percentage points", "How a difference is reported does not support a causal conclusion.")])]),
]

NAMES = register(globals(), ITEMS)
