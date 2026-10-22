"""AP Psychology 공유 자료 세트(문항 3개, 단원 5) — PS5 의 마지막 세트 대체(2026-10-22): 운영 보고에서 light_therapy 세트의 첫 문항이 공개 Exam 4 의 이중맹검 약물 시험 문항과 쌍둥이로 판정됐다.
새 세트는 실험 결과표가 아니라 진료 접수 기록(증상·기간·빈도)이라는 다른 자료로, 진단 범주 판별·치료 접근 연결·감별 진단을 묻는다. 시나리오·수치는 모두 원본(가상 사례)이다."""
from psych_common import *  # noqa: F401,F403
from psych_common import register_sets

SETS = [
 ("t5d_u5_worry_intake", "5.3", "3.C", "intake record of an adult with long-lasting excessive worry", "5.3.B",
  "A clinician records the following information during an intake visit with a 34-year-old adult who sought help because of constant worry.",
  tbl("Intake record", ["Item", "Report"], [["Main complaint", "Worries about money, health, and work almost every day"], ["Duration", "More than 8 months"], ["Physical symptoms", "Muscle tension, restlessness, trouble sleeping"], ["Sudden episodes of intense fear", "None reported"], ["Avoids specific places or objects", "No"], ["Repeated unwanted thoughts that are neutralized by rituals", "No"]]),
  [("5.3", "3.C", "Which diagnostic category best fits the information in the intake record?", "Generalized anxiety disorder, because the worry is excessive, long-lasting, and accompanied by tension and sleep problems", "Persistent worry about many topics with physical symptoms and no panic attacks or rituals points to generalized anxiety.",
    [("Panic disorder, because the person experiences frequent physical symptoms", "The record shows no sudden episodes of intense fear, which panic disorder requires."), ("Obsessive-compulsive disorder, because the person experiences repeated worry", "The record shows no rituals performed to neutralize unwanted thoughts."), ("Specific phobia, because the worry is linked to health and work", "The record shows no avoidance of specific places or objects, and the worry covers many topics.")], 75),
   ("5.5", "1.A", "The therapist wants a first technique that directly targets the physical symptoms listed in the record. Which technique is most appropriate?", "Progressive muscle relaxation to reduce tension and improve sleep", "Relaxation training addresses muscle tension and sleep problems directly.",
    [("Systematic desensitization to a specific feared object or place", "The record shows that the person does not avoid any specific places or objects."), ("Flooding with imagined sensations of sudden panic", "The record shows no sudden episodes of intense fear to rehearse."), ("Free association about early childhood memories", "This psychodynamic method does not target the listed physical symptoms.")], 70),

   ("5.3", "2.C", "A researcher wants to use this intake record as evidence about adults with excessive worry in general. Which limitation of the record is most important?", "It describes only one person, so the findings may not apply to adults in general", "A single case cannot show what is typical of a larger population.",
    [("It has no control group, so it cannot describe this person's symptoms accurately", "A control group is needed to test causes, not to describe one person's symptoms."), ("It is based on reported symptoms, which makes the record worthless for any purpose", "Reported symptoms are an ordinary part of clinical records and are useful for diagnosis."), ("It includes too many symptoms for the clinician to make a diagnosis", "Several related symptoms are what make a diagnosis possible.")], 70)]),
]

NAMES = register_sets(globals(), SETS)
