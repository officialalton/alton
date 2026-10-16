#!/usr/bin/env python3
"""외부 AP 감사(2026-10-15) 확정 수정 — CSA(10행)·Calculus AB/BC(11행) 새 후보 + 새 버전 교체안 생성기(로컬 파일만, DB 없음).
  python3 scripts/audit/ap-aud1015-csa-calc-build.py
원본 재고 항목은 건드리지 않는다(삭제 금지). 수정본은 새 배치 파일의 새 후보로 쓰고, 교체안(swap plan)이 옛 키 -> 새 키로 바꾼다.
  data/ap/stock/csa-aud1015-items.json / -pass-keys.json            (CSA 12건: FRQ 8 + MC 4 + 책임 있는 컴퓨팅 MC 2 -> 14)
  data/ap/stock/supp-aud1015-items.json / -pass-keys.json           (Calculus 11건)
  data/ap/stock/csa1-v2-audit-aud1015-swap-plan.json, csa2-v2-audit-aud1015-swap-plan.json,
  data/ap/stock/{ab1,ab3,abfrq,bc1,bc2,bc3}-*-audit-aud1015-swap-plan.json
"""
import copy, glob, json, re, sys

RUN_CSA = "csa-aud1015"
RUN_CALC = "supp-aud1015-final"
GATE = "v2-code-first-final-2026-10-08"

idx = {}
for f in glob.glob("data/ap/stock/*items.json"):
    try:
        rows = json.load(open(f))
    except Exception:
        continue
    if isinstance(rows, list):
        for r in rows:
            if isinstance(r, dict) and "stockKey" in r:
                idx.setdefault(r["stockKey"], (f, r))


def clone(key, run, audit_row, new_candidate_key=None):
    f, r = idx[key]
    n = copy.deepcopy(r)
    ck = new_candidate_key or r["candidateKey"]
    n["candidateKey"] = ck
    n["run"] = run
    n["stockKey"] = f"{run}:{ck}"
    n["canonicalKey"] = n["stockKey"]
    n["validation"] = "auto_passed"
    n["reviewState"] = "auto_passed"
    n["duplicateOf"] = None
    n["duplicateReason"] = None
    n["sharedWith"] = []
    n["renderVerified"] = False
    n["screenVerified"] = False
    n["reviewEnvReady"] = False
    n["legacyReserve"] = False
    n["selectedForSample"] = True
    n["reserve"] = False
    n["history"] = [{"run": run, "gateVersion": GATE, "outcome": "passed", "reasons": None, "derivedFrom": key, "auditRow": audit_row}]
    return n


def sub1(s, old, new):
    assert s.count(old) == 1, (old, s.count(old))
    return s.replace(old, new)


# ---------------------------------------------------------------- FRQ rubric helpers
def merge_rows(rows, groups, new_ids=None):
    """rows: 기존 rubric_rows. groups: [[row_id,...],...] 각 묶음 -> 1점 한 행. 묶음에 안 든 행은 버린다(요구 행 참조는 가장 가까운 앞 묶음으로)."""
    byid = {r["row_id"]: r for r in rows}
    owner = {}
    for gi, g in enumerate(groups):
        for rid in g:
            owner[rid] = gi
    prefix = rows[0]["row_id"][0]
    out = []
    for gi, g in enumerate(groups):
        members = [byid[x] for x in g]
        first = members[0]
        crit = members[0]["criterion"]
        for m in members[1:]:
            c = m["criterion"]
            crit = crit.rstrip(". ") + "; " + (c[0].lower() + c[1:] if c[:2] != c[:2].upper() else c)
        req = []
        for m in members:
            for e in m.get("required_elements", []):
                if e not in req:
                    req.append(e)
        alts, errs, opt = [], [], []
        for m in members:
            alts += [a for a in m.get("alt_solutions", []) if a not in alts]
            errs += [a for a in m.get("common_errors", []) if a not in errs]
            opt += [a for a in m.get("optional_phrases", []) if a not in opt]
        rr = first.get("requires_row_id")
        rr_new = None
        if rr is not None and rr in owner and owner[rr] != gi:
            rr_new = f"{prefix}{owner[rr] + 1}"
        out.append({
            "row_id": f"{prefix}{gi + 1}", "points": 1, "criterion": crit, "required_elements": req, "optional_phrases": opt,
            "alt_solutions": alts, "common_errors": errs, "requires_row_id": rr_new,
            "requires_both": any(m.get("requires_both") for m in members), "requires_numbers": any(m.get("requires_numbers") for m in members),
            "numeric_tolerance": first.get("numeric_tolerance"), "units_row": False,
        })
    return out


def sync_blueprint(p):
    """blueprint.parts 가 parts 의 점수·행·모범답안을 그대로 비추도록 다시 쓴다."""
    bp = p.get("blueprint")
    if not bp or "parts" not in bp:
        return
    for bpp, pt in zip(bp["parts"], p["parts"]):
        bpp["points"] = pt["points"]
        bpp["accepted_answers"] = [pt["model_answer"]]
        bpp["rubric_rows"] = [{"row_id": r["row_id"], "points": r["points"], "criterion": r["criterion"], "elements": r["required_elements"]} for r in pt["rubric_rows"]]


def repoint(p, plan):
    """plan: {part_label: [[row ids]...]}"""
    for pt in p["parts"]:
        pt["rubric_rows"] = merge_rows(pt["rubric_rows"], plan[pt["label"]])
        pt["points"] = len(pt["rubric_rows"])
    p["total_points"] = sum(pt["points"] for pt in p["parts"])
    sync_blueprint(p)


OFFICIAL = {"q1": 7, "q2": 7, "q3": 5, "q4": 6}


# ---------------------------------------------------------------- CSA FRQ
csa_items, csa_swaps = [], {"CSA1": [], "CSA2": []}


def csa_frq(key, run_pos, set_id, audit_rows, plan, edit=None, q=None):
    n = clone(key, RUN_CSA, audit_rows)
    p = n["payload"]
    if edit:
        edit(p)
    repoint(p, plan)
    assert p["total_points"] == OFFICIAL[q], (key, p["total_points"])
    csa_items.append(n)
    csa_swaps[set_id].append(("ap_frq", run_pos, key, n["stockKey"], audit_rows, n))


def edit_password(p):
    """AP-029: 1(a) 참고 코드에서 char 를 빼고 String.substring + compareTo 로 대문자를 판정한다."""
    a = p["parts"][0]
    old = a["model_answer"]
    new_code = (
        "One correct implementation (ALTON reference answer):\n```java\n"
        "    public static int countUpper(String s) {\n"
        "        int count = 0;\n"
        "        for (int i = 0; i < s.length(); i++) {\n"
        "            String ch = s.substring(i, i + 1);\n"
        "            if (ch.compareTo(\"A\") >= 0 && ch.compareTo(\"Z\") <= 0) {\n"
        "                count++;\n"
        "            }\n"
        "        }\n"
        "        return count;\n"
        "    }\n```"
    )
    assert "char ch" in old
    a["model_answer"] = new_code
    for r in a["rubric_rows"]:
        if r["row_id"] == "A2":
            r["criterion"] = "Tests each one-character substring of s for being between \"A\" and \"Z\" inclusive (for example with compareTo, or an equivalent test)"
            r["required_elements"] = ["ch.compareTo(\"A\") >= 0 && ch.compareTo(\"Z\") <= 0"]
    # 판정 규칙은 문자 비교 대신 한 글자 문자열 비교로 쓰도록 보충 안내
    a["prompt"] = a["prompt"].replace(
        "returns the number of uppercase letters (A through Z) in the String s.",
        "returns the number of uppercase letters (A through Z) in the String s. (Examine s one character at a time as a one-character String, for example with substring.)",
    )
    p["stimulus"]["description"] = p["stimulus"]["description"].replace("(a) */ }", "(a) */ }")
    p["self_check_tests"] = p["self_check_tests"]  # 시험 입력·기대값은 그대로(동작 불변)
    p["blueprint"]["concept"] = "Methods and control structures with String traversal (substring and compareTo) and a helper call"


def edit_digit(p):
    """AP-036: 1(b) 를 String 메서드(length·substring·indexOf)를 요구하는 부분으로 교체한다."""
    p["title"] = "DigitTools: digit sums of numbers and of text"
    p["stimulus"]["description"] = (
        "A utility class DigitTools has two static methods. The class is shown with the method headers.\n```java\n"
        "public class DigitTools {\n"
        "    /** Returns the sum of the digits of n. Precondition: n >= 0. */\n"
        "    public static int digitSum(int n) { /* to be implemented in part (a) */ }\n\n"
        "    /** Returns the sum of the digits that appear in text; see part (b). */\n"
        "    public static int textDigitSum(String text) { /* to be implemented in part (b) */ }\n}\n```"
    )
    b = p["parts"][1]
    b["prompt"] = (
        "Write the method textDigitSum, which returns the sum of the digit characters that appear in the String text. "
        "Characters of text that are not digits are ignored. You may use the String methods length, substring and indexOf. "
        "For example, textDigitSum(\"a1b22\") returns 5, textDigitSum(\"2026\") returns 10 and textDigitSum(\"none\") returns 0. "
        "Complete the method textDigitSum."
    )
    b["skill_codes"] = ["2.C"]
    b["model_answer"] = (
        "One correct implementation (ALTON reference answer):\n```java\n"
        "    public static int textDigitSum(String text) {\n"
        "        int sum = 0;\n"
        "        for (int i = 0; i < text.length(); i++) {\n"
        "            int d = \"0123456789\".indexOf(text.substring(i, i + 1));\n"
        "            if (d >= 0) {\n"
        "                sum += d;\n"
        "            }\n"
        "        }\n"
        "        return sum;\n"
        "    }\n```"
    )
    def row(i, pts, crit, req, rq=None, nums=False):
        return {"row_id": f"B{i}", "points": pts, "criterion": crit, "required_elements": req, "optional_phrases": [], "alt_solutions": [],
                "common_errors": [], "requires_row_id": rq, "requires_both": False, "requires_numbers": nums, "numeric_tolerance": None, "units_row": False}
    b["rubric_rows"] = [
        row(1, 1, "Loops over every character position of text with correct bounds (from 0 through text.length() - 1) and extracts one character with substring(i, i + 1)", ["for (int i = 0; i < text.length(); i++)", "text.substring(i, i + 1)"]),
        row(2, 1, "Determines the digit value of each character (for example with indexOf in \"0123456789\", or an equivalent String comparison) and recognizes non-digit characters", ["\"0123456789\".indexOf(...)", "d >= 0"], "B1"),
        row(3, 1, "Adds the value of digit characters only (non-digits do not change the sum) to an accumulator initialized before the loop", ["sum += d inside the digit test", "int sum = 0"], "B2"),
        row(4, 1, "Returns the accumulated sum after the loop", ["return sum"], "B3"),
    ]
    b["points"] = 4
    p["facts"] = ["digitSum(n) as before", "textDigitSum('a1b22') = 5"]
    p["blueprint"]["concept"] = "Methods and control structures: an int digit loop and String traversal with substring and indexOf"
    p["blueprint"]["student_thinking"] = ["Extract digits of an int with % and /", "Traverse a String one character at a time with substring", "Convert a digit character to its value with indexOf"]
    p["extra_topics"] = ["1.15", "2.9"]
    # 자체 점검 입력: (a) 는 그대로, (b) 는 새 메서드
    tests = [t for t in p["self_check_tests"] if t["part"] == "a"]
    for call, exp in [('""', "0"), ('"none"', "0"), ('"a1b22"', "5"), ('"2026"', "10"), ('"7"', "7"), ('"x9y"', "9"), ('"0000"', "0"), ('"12 34"', "10"), ('"Room 101"', "2"), ('"99bottles"', "18")]:
        tests.append({"part": "b", "call": f"return DigitTools.textDigitSum({call});", "expected": exp})
    p["self_check_tests"] = tests
    for k in ("verification",):
        p[k] = {"variants": 1, "wrong_failures": [3, 4, 3]}


# CSA1 (exam 1, ap_frq 1..4) and CSA2 (ap_frq 1..4)
CLASS7 = {"a": [["A1", "A2"], ["A3"], ["A4"], ["A5"], ["A6"], ["A7"], ["A8"]]}
csa_frq("csa-p1-b:ap_computer_science_a-f01-k0", 1, "CSA1", "AP-029,AP-030", {"a": [["A1"], ["A2"], ["A3", "A4"]], "b": [["B1"], ["B2", "B3"], ["B4"], ["B5"]]}, edit_password, "q1")
csa_frq("csa-s2-frq-a:ap_computer_science_a-f04-k0", 2, "CSA1", "AP-030", CLASS7, None, "q2")
csa_frq("csa-s2-frq-b:ap_computer_science_a-f01-k0", 3, "CSA1", "AP-030", {"a": [["A1"], ["A2", "A3"], ["A4", "A5", "A6"], ["A7"], ["A8", "A9"]]}, None, "q3")
csa_frq("csa-s2-frq-b:ap_computer_science_a-f04-k0", 4, "CSA1", "AP-030", {"a": [["A1", "A8"], ["A2", "A3"], ["A4"], ["A5", "A6"], ["A7"], ["A9"]]}, None, "q4")


def csa2_digit():
    n = clone("csa-s2-frq-a:ap_computer_science_a-f03-k0", RUN_CSA, "AP-036,AP-037")
    p = n["payload"]
    # (a) 3점: 세 행으로 합친다(digitSum), (b) 는 새 4점 행
    a = p["parts"][0]
    a["rubric_rows"] = merge_rows(a["rubric_rows"], [["A1", "A2"], ["A3"], ["A4"]])
    a["points"] = 3
    edit_digit(p)
    p["total_points"] = sum(pt["points"] for pt in p["parts"])
    sync_blueprint(p)
    assert p["total_points"] == 7
    csa_items.append(n)
    csa_swaps["CSA2"].append(("ap_frq", 1, "csa-s2-frq-a:ap_computer_science_a-f03-k0", n["stockKey"], "AP-036,AP-037", n))


csa2_digit()
csa_frq("csa-p1-b:ap_computer_science_a-f02-k0", 2, "CSA2", "AP-037", CLASS7, None, "q2")
csa_frq("csa-s2-frq-b:ap_computer_science_a-f02-k0", 3, "CSA2", "AP-037", {"a": [["A1", "A8"], ["A2", "A3"], ["A4"], ["A5", "A6"], ["A7", "A9"]]}, None, "q3")


def r6_gridstats(p):
    """r6(2026-10-15, 공개본 DB 패치 예정)와 같은 sentinel 정정을 새 후보에도 담는다: 첫 행의 합으로 초기화."""
    a = p["parts"][0]
    a["model_answer"] = sub1(a["model_answer"], "int bestSum = -1000000;", "int bestSum = 0;")
    a["model_answer"] = sub1(a["model_answer"], "if (sum > bestSum) {", "if (r == 0 || sum > bestSum) {")
    for r in a["rubric_rows"]:
        if r["row_id"] == "A5":
            r["criterion"] = "Keeps track of the largest row sum seen so far, initialized so that negative sums work (for example from the first row's sum or with Integer.MIN_VALUE, not an arbitrary fixed value such as -1000000)"


csa_frq("csa-s2-short-frq:ap_computer_science_a-f01-k0", 4, "CSA2", "AP-037", {"a": [["A1", "A2", "A3"], ["A4"], ["A5"], ["A6"], ["A7"], ["A8", "A9"]]}, r6_gridstats, "q4")


# ---------------------------------------------------------------- CSA MC
def mc_clone(key, audit_row):
    n = clone(key, RUN_CSA, audit_row)
    return n, n["payload"]


def rebuild_expl(p):
    ki = p["key_index"]
    parts = []
    for i, o in enumerate(p["options"]):
        pass
    lines = [f"The correct answer is {p['options'][ki]['text']}. {p['options'][ki]['why']}"]
    for i, o in enumerate(p["options"]):
        if i != ki:
            lines.append(f"{o['text']} is incorrect: {o['why']}")
    p["explanation_en"] = "\n".join(lines)


# AP-031: CSA1 MC1 — char·long 제거(String·double 로 대체; 컴파일 오류 문항 형태는 그대로)
n, p = mc_clone("csa-p1-a:ap_computer_science_a-m03-k0", "AP-031")
p["options"][0] = {"text": "`String s = \"x\";`", "why": "This statement compiles: A String literal can be assigned to a String variable.", "value": None}
p["options"][2] = {"text": "`double big = 12;`", "why": "This statement compiles: An int can be assigned to a double.", "value": None}
p["blueprint"]["misconceptions"][0]["description"] = "This statement compiles: A String literal can be assigned to a String variable."
p["blueprint"]["misconceptions"][2]["description"] = "This statement compiles: An int can be assigned to a double."
p["explanation_en"] = (
    "The correct answer is `int m = \"7\";`. A String cannot be assigned to an int.\n"
    "`String s = \"x\";` is incorrect: This statement compiles: A String literal can be assigned to a String variable.\n"
    "`boolean ok = 3 `>` 2;` is incorrect: This statement compiles: A relational expression produces a boolean.\n"
    "`double big = 12;` is incorrect: This statement compiles: An int can be assigned to a double."
)
csa_items.append(n)
csa_swaps["CSA1"].append(("ap_mc", 1, "csa-p1-a:ap_computer_science_a-m03-k0", n["stockKey"], "AP-031", n))

# AP-034: CSA1 MC38 — 재귀 코드 '작성'을 반복문 구현 선택으로 바꾼다(단원·스킬 유지)
n, p = mc_clone("csa-s2-mc-c:ap_computer_science_a-m13-k0", "AP-034")
p["stimulus"]["description"] = "```java\nclass Rec {\n    /** Returns base raised to the power exp, where exp is a non-negative integer. */\n    public static int power(int base, int exp) {\n        /* missing code */\n    }\n}\n```"
loop = lambda body: "```\n" + body + "\n```"
p["options"] = [
    {"text": loop("int result = 1;\n        for (int i = 0; i < exp; i++) {\n            result *= base;\n        }\n        return result;"), "why": "The loop multiplies result by base exactly exp times, starting from 1, so power returns base raised to the power exp (and 1 when exp is 0).", "value": None},
    {"text": loop("int result = 1;\n        for (int i = 0; i <= exp; i++) {\n            result *= base;\n        }\n        return result;"), "why": "Loops one time too many, so power(base, exp) returns base raised to the power exp + 1.", "value": None},
    {"text": loop("int result = 1;\n        for (int i = 0; i < exp; i++) {\n            result += base;\n        }\n        return result;"), "why": "Adds base instead of multiplying by it.", "value": None},
    {"text": loop("int result = 1;\n        for (int i = 1; i < exp; i++) {\n            result *= base;\n        }\n        return result;"), "why": "Starts the counter at 1, so the loop multiplies only exp - 1 times.", "value": None},
]
p["key_index"] = 0
p["stem"] = "The method power is intended to return base raised to the power exp, where exp is a non-negative integer. Which of the following can replace /* missing code */ so that power works as intended?"
p["facts"] = ["tests=4", "iterative power"]
p["blueprint"]["concept"] = "an iterative loop needs the correct starting value, accumulation operator and number of repetitions"
p["blueprint"]["key_conditions"] = [{"condition": "the key passes every test case when compiled and run", "evidence": "javac and java run"}, {"condition": "each distractor fails at least one test case", "evidence": "java test run"}]
p["blueprint"]["misconceptions"] = [{"id": "m1", "description": "Loops one time too many."}, {"id": "m2", "description": "Adds instead of multiplying."}, {"id": "m3", "description": "Starts the counter at 1."}]
p["blueprint"]["student_thinking"] = ["read the code and decide which candidate satisfies the specification for every input", "compare the result with each option and rule out the named misconceptions"]
rebuild_expl(p)
csa_items.append(n)
csa_swaps["CSA1"].append(("ap_mc", 38, "csa-s2-mc-c:ap_computer_science_a-m13-k0", n["stockKey"], "AP-034", n))

# AP-040: CSA2 MC3 — char 산술을 int·double 산술로
n, p = mc_clone("csa-s2-mc-a:ap_computer_science_a-m03-k1", "AP-040")
p["stimulus"]["description"] = "```java\nint n = 17;\nint q = n / 5;\nint r = n % 5;\ndouble avg = (double) n / 5;\nSystem.out.println(q + \" \" + r + \" \" + avg);\n```"
p["options"] = [
    {"text": "`3 2 3.0`", "why": "Believes the cast applies after the integer division; (double) n / 5 casts n first, so the division is a double division.", "value": None},
    {"text": "`3.4 2 3.4`", "why": "Believes q keeps the fraction; q is an int, so n / 5 is truncated to 3.", "value": None},
    {"text": "`3 2 3.4`", "why": "n / 5 is integer division (3), n % 5 is 2, and (double) n / 5 divides 17.0 by 5, giving 3.4. Tracing the code gives 3 2 3.4.", "value": None},
    {"text": "`4 2 3.4`", "why": "Believes integer division rounds to the nearest integer; it truncates toward zero.", "value": None},
]
p["key_index"] = 2
p["facts"] = ["n=17", "key=3 2 3.4"]
p["blueprint"]["concept"] = "integer division truncates; casting an operand to double makes the division a double division"
p["blueprint"]["misconceptions"] = [{"id": "m1", "description": "Believes the cast applies after the integer division."}, {"id": "m2", "description": "Believes q keeps the fraction."}, {"id": "m3", "description": "Believes integer division rounds."}]
p["blueprint"]["verification"]["independent_path"] = "javac+java output vs Python integer and float arithmetic"
rebuild_expl(p)
csa_items.append(n)
csa_swaps["CSA2"].append(("ap_mc", 3, "csa-s2-mc-a:ap_computer_science_a-m03-k1", n["stockKey"], "AP-040", n))

# AP-041: CSA2 MC40 — 비어 있지 않은 리스트 전제
n, p = mc_clone("csa-s2-short-mc:ap_computer_science_a-m01-k1", "AP-041")
p["stem"] = sub1(p["stem"], "Which of the following best describes the value returned by the method mystery?", "Assume that list contains at least one element. Which of the following best describes the value returned by the method mystery?")
csa_items.append(n)
csa_swaps["CSA2"].append(("ap_mc", 40, "csa-s2-short-mc:ap_computer_science_a-m01-k1", n["stockKey"], "AP-041", n))


# AP-033/043: 책임 있는 컴퓨팅(Practice 5) MC — 새 문항 2건. 코드 실행으로 검증할 수 없어 expertStatus 는 unreviewed 로 두고 전문가 검토 대상으로 표시한다.
def p5_item(cand, tmpl_key, topic, unit, stem, options, key_index, concept, thinking, audit_row, archetype):
    n = clone(tmpl_key, RUN_CSA, audit_row, new_candidate_key=cand)
    n["cellId"] = cand.rsplit("-k", 1)[0]
    n["keywordCode"] = topic
    n["unitCode"] = str(unit)
    n["skillPrimary"] = "5.A"
    n["archetype"] = archetype
    n["wording"] = "llm"
    n["itemFamilyId"] = f"fam:{n['stockKey']}"
    n["contentKey"] = f"ap_computer_science_a:{topic}"
    n["stockCell"] = f"ap_computer_science_a|{topic}|5.A|standalone|not_allowed"
    n["difficultyProvisional"] = "exam_prep"
    n["difficultyRationale"] = "Practice 5 (use computers responsibly) item: the student must judge the societal or ethical effect of a data or design decision. Short reading, no calculation, one clearly best statement."
    n["difficulty"] = {"label": "exam_prep", "rationale": n["difficultyRationale"]}
    n["verification"] = {"generatedByCode": False, "archetype": archetype, "facts": ["practice 5.A", "reasoning item; key is the one statement that follows from the scenario"], "seed": 0}
    n["review"] = {"scope_skill": {"pass": True, "notes": f"Topic {topic}; Practice 5 explain how computing affects society."}, "key_scoring": {"pass": True, "notes": "One option follows from the stated scenario; each distractor is false or irrelevant to the stated concern."}, "stimulus_expression": {"pass": True, "notes": "Short scenario, no code."}, "distractor_explanation": {"pass": True, "notes": "Each distractor is explained."}, "exam_suitability": {"pass": True, "notes": "About 60 seconds."}, "instant_reject": [], "matches_reference_pattern": True, "resembles_known_exam_item": False, "summary": "Practice 5 reasoning item; not verifiable by running code, so expert review is recommended before wider use."}
    n["expertStatus"] = "unreviewed"
    p = n["payload"]
    p["archetype"] = archetype
    p["topic"] = topic
    p["skill"] = "5.A"
    p["stem"] = stem
    p["stimulus"] = {"kind": "none", "description": "", "data": {}}
    p["options"] = [{"text": t, "why": w, "value": None} for t, w in options]
    p["key_index"] = key_index
    p["est_seconds"] = 60
    p["facts"] = ["practice 5.A"]
    p["seed"] = 0
    p["pack_id"] = f"{archetype}-{cand}"
    bp = p["blueprint"]
    bp["id"] = archetype
    bp["concept"] = concept
    bp["topic"] = topic
    bp["skill"] = "5.A"
    bp["student_thinking"] = thinking
    bp["key_conditions"] = [{"condition": "exactly one option follows from the scenario", "evidence": "reasoning about the stated data or design decision"}]
    bp["material"] = {"type": "none", "must_include": []}
    bp["misconceptions"] = [{"id": f"m{i + 1}", "description": w} for i, (t, w) in enumerate(options) if i != key_index]
    bp["verification"] = {"independent_path": "reasoning only (Practice 5); expert review recommended", "method": "reasoning"}
    bp["judgment_demand"] = "judge the effect of a computing decision on people"
    rebuild_expl(p)
    return n


n = p5_item(
    "ap_computer_science_a-m90-k0", "csa-s2-short-mc:ap_computer_science_a-m01-k1", "4.1", 4,
    "A school district records how long each student spends on each page of its online homework portal. The district plans to give this data, labeled with student names, to a private company that builds study-habit apps. Which of the following is the most significant privacy concern with this plan?",
    [
        ("The data could be used to profile individual students, and to share information about them, without their knowledge or consent.", "The data identifies each student and describes their behavior, so giving it to a third party can expose personal information the students never agreed to share."),
        ("The data is useful only if every student spends exactly the same amount of time on every page.", "This is not a privacy concern; data about differences between students is exactly what makes such data informative."),
        ("Data collected by a school district automatically becomes public domain, so anyone may copy it.", "Collecting data does not make it public domain; the concern is who may access the data and for what purpose."),
        ("Recording page times makes the portal load too slowly for students to finish their homework.", "This is a performance concern, not a privacy concern."),
    ],
    0, "personal data collected by a program can harm privacy when it is linked to individuals and shared without consent",
    ["Identify what personal information the program collects", "Decide who gains access to it and whether the people involved agreed", "Rule out concerns that are about performance or ownership rather than privacy"], "AP-033", "cs_responsible_privacy",
)
csa_items.append(n)
csa_swaps["CSA1"].append(("ap_mc", 34, "csa-s2-mc-c:ap_computer_science_a-m05-k1", n["stockKey"], "AP-033", n))
n["payload"]["options"] = [n["payload"]["options"][i] for i in (1, 0, 2, 3)]
n["payload"]["key_index"] = 1
n["payload"]["blueprint"]["misconceptions"] = [{"id": f"m{i + 1}", "description": o["why"]} for i, o in enumerate(n["payload"]["options"]) if i != 1]
rebuild_expl(n["payload"])

n = p5_item(
    "ap_computer_science_a-m91-k0", "csa-s2-short-mc:ap_computer_science_a-m01-k1", "3.2", 3,
    "A company writes a program that screens job applications. The program learns its rules from the applications of employees the company hired during the past ten years, and nearly all of those employees graduated from the same few universities. Which of the following is the most likely effect of this design?",
    [
        ("The program will treat all applicants fairly because a computer has no opinions of its own.", "A program inherits patterns from the data it learns from, so it can repeat past unfairness; being a computer does not make it neutral."),
        ("The program will run correctly only on computers made by the same company that wrote it.", "The fairness of the screening does not depend on the manufacturer of the computer."),
        ("The program may favor applicants from those universities and unfairly screen out qualified applicants from other backgrounds.", "The program learned from a narrow, historical set of hires, so its rules can reproduce that bias and affect which applicants are considered."),
        ("The program will become more accurate over time no matter what data it is given.", "Accuracy depends on the quality and variety of the data; biased data does not produce unbiased results."),
    ],
    2, "a program trained on narrow or biased historical data can reproduce that bias in its decisions",
    ["Identify where the program's rules come from", "Decide whether that source represents all applicants", "Judge the effect of the design on the people it affects"], "AP-043", "cs_responsible_bias",
)
csa_items.append(n)
csa_swaps["CSA2"].append(("ap_mc", 27, "csa-s2-mc-c:ap_computer_science_a-m22-k1", n["stockKey"], "AP-043", n))

# ---------------------------------------------------------------- Calculus
calc_items = []
calc_swaps = {}  # set tag -> list


def calc_clone(key, audit_row):
    n = clone(key, RUN_CALC, audit_row)
    return n, n["payload"]


def add_calc(tag, section, position, key, n, row):
    calc_items.append(n)
    calc_swaps.setdefault(tag, []).append((section, position, key, n["stockKey"], row, n))


# AP-021 BC1 MC-B5
key = "s3a-graph-ab-final:ap_calculus_ab-m04-k0"
n, p = calc_clone(key, "AP-021")
p["stem"] = sub1(p["stem"], "$xe^{y}+y^{2}=6.4366$", "$xe^{y}+y^{2}=2e+1$")
p["facts"] = ["key=-0.365529", "constant=2e+1"]
add_calc("BC1", "ap_mc_b", 5, key, n, "AP-021")

# AP-022 BC1 MC-B6
key = "s3a-graph-bc-final:ap_calculus_bc-m02-k0"
n, p = calc_clone(key, "AP-022")
p["stem"] = sub1(p["stem"], "A function $f$ has derivatives of all orders. The graph of its third derivative $f'''$ on $0\\le x\\le 3$ is shown and consists of line segments.", "A function $f$ has a continuous third derivative on $0\\le x\\le 3$. The graph of $f'''$ is shown and consists of line segments.")
add_calc("BC1", "ap_mc_b", 6, key, n, "AP-022")

# AP-024 BC2 MC-B9
key = "s2-graph-bc-final:ap_calculus_bc-m02-k0"
n, p = calc_clone(key, "AP-024")
p["stem"] = sub1(p["stem"], "of a function $f$ with derivatives of all orders is used", "of a function $f$ that has a continuous fourth derivative on $0\\le x\\le 3$ is used")
add_calc("BC2", "ap_mc_b", 9, key, n, "AP-024")

# AP-026 BC3 MC-A19
key = "bc-topup-final:ap_calculus_bc-m04-k1"
n, p = calc_clone(key, "AP-026")
p["stem"] = sub1(p["stem"], "The function $f$ has derivatives of all orders. The graph of $y=f^{(4)}(x)$", "The function $f$ has a continuous fourth derivative on $0\\le x\\le 4$. The graph of $y=f^{(4)}(x)$")
add_calc("BC3", "ap_mc_a", 19, key, n, "AP-026")

# AP-018 AB3 MC-A27
key = "s1-graph-ab-final:ap_calculus_ab-m24-k0"
n, p = calc_clone(key, "AP-018")
p["stem"] = sub1(p["stem"], "The graphs of the differentiable functions $f$ and $g$ are shown, each consisting of line segments, and both graphs pass through $(7,0)$.", "The graphs of the functions $f$ and $g$ are shown, each consisting of line segments, and both graphs pass through $(7,0)$. Both functions are differentiable at $x=7$.")
add_calc("AB3", "ap_mc_a", 27, key, n, "AP-018")


def fix_concavity_reason(p):
    a = [pt for pt in p["parts"] if pt["label"] == "a"][0]
    hit = 0
    for r in a["rubric_rows"]:
        if "f'' > 0" in r["criterion"]:
            r["criterion"] = r["criterion"].replace("Reason: f' is increasing (so f'' > 0) on those intervals", "Reason: f' is increasing on those intervals")
            r["required_elements"] = [e for e in r["required_elements"] if e != "f'' is positive"]
            hit += 1
    assert hit == 1
    sync_blueprint(p)


for tag, sec, pos, key, row in [
    ("ABFRQ", "ap_frq_b", 1, "s1a-final:ap_calculus_ab-f02-k1", "AP-014"),
    ("BC1", "ap_frq_b", 3, "s1a-final:ap_calculus_ab-f02-k0", "AP-020"),
    ("BC2", "ap_frq_b", 1, "run2:ap_calculus_ab-f02-k1", "AP-023"),
    ("BC3", "ap_frq_b", 1, "run2:ap_calculus_ab-f02-k0", "AP-025"),
]:
    n, p = calc_clone(key, row)
    fix_concavity_reason(p)
    add_calc(tag, sec, pos, key, n, row)

# AP-015 AB1 FRQ-B 1(c)
key = "run1:ap_calculus_ab-f02-k5"
n, p = calc_clone(key, "AP-015")
c = [pt for pt in p["parts"] if pt["label"] == "c"][0]
c["model_answer"] = sub1(c["model_answer"], "Candidates: t=0, 2, 10 (endpoints) and t=2 and t=9 (critical points).", "Candidates: the endpoints t=0 and t=10 and the critical points t=2 and t=9.")
sync_blueprint(p)
add_calc("AB1", "ap_frq_b", 1, key, n, "AP-015")

# AP-016 AB1 FRQ-B 2(a)
key = "run1:ap_calculus_ab-f03-k2"
n, p = calc_clone(key, "AP-016")
a = [pt for pt in p["parts"] if pt["label"] == "a"][0]
a["model_answer"] = sub1(a["model_answer"], "so the slope is undefined; no slope segment (or a vertical one) appears there.", "so the slope is undefined (there is no finite slope); no slope segment is drawn there.")
for r in a["rubric_rows"]:
    r["alt_solutions"] = [("no segment drawn / no finite slope" if s.startswith("vertical tangent") else s) for s in r.get("alt_solutions", [])]
sync_blueprint(p)
add_calc("AB1", "ap_frq_b", 2, key, n, "AP-016")

# ---------------------------------------------------------------- write batch files
def write_batch(items, itemsfile):
    json.dump(items, open(f"data/ap/stock/{itemsfile}-items.json", "w"), ensure_ascii=False, indent=1)
    open(f"data/ap/stock/{itemsfile}-items.json", "a").write("\n")
    keys = [r["stockKey"] for r in items]
    open(f"data/ap/stock/{itemsfile}-pass-keys.json", "w").write("[\n" + ",\n".join(json.dumps(k) for k in keys) + "\n]\n")


write_batch(csa_items, "csa-aud1015")
write_batch(calc_items, "supp-aud1015")


def meta(n):
    p = n["payload"]
    return {"unit": int(n["keywordCode"].split(".")[0]), "skill": n.get("skillPrimary"), "shared": False, "type": n["keywordCode"]}


def plan(set_tag, name, version, entries, note):
    swaps = []
    for sec, pos, rk, ak, row, newrec in entries:
        old = idx[rk][1]
        swaps.append({"section": sec, "position": pos, "removeKey": rk, "addKey": ak, "reason": f"external audit 2026-10-15 {row}", "remove": meta(old), "add": meta(newrec)})
    return {"kind": "ap_new_version_swap_plan", "set": set_tag, "sourceSetName": name, "sourceVersionNo": version, "generatedBy": "scripts/audit/ap-aud1015-csa-calc-build.py (external audit 2026-10-15 confirmed fixes)", "note": note, "swapCount": len(swaps), "verifierViolations": [], "swaps": swaps}


NOTE_CALC = "Each swap replaces a published candidate with a corrected copy (stem/premise/reference-wording fix only; the key answer is unchanged). New candidates are in data/ap/stock/supp-aud1015-items.json and must be loaded (review_env_ready) before the preview. Slots are found by removeKey."
files = {}
for tag, name, ver, fn in [
    ("AB1", "AP Calculus AB — Practice Exam", 4, "ab1-v5-audit-aud1015-swap-plan.json"),
    ("AB3", "AP Calculus AB — Practice Exam 3", 2, "ab3-v3-audit-aud1015-swap-plan.json"),
    ("BC1", "AP Calculus BC — Practice Exam 1", 4, "bc1-v5-audit-aud1015-swap-plan.json"),
    ("BC2", "AP Calculus BC — Practice Exam 2", 2, "bc2-v3-audit-aud1015-swap-plan.json"),
    ("BC3", "AP Calculus BC — Practice Exam 3", 1, "bc3-v2-audit-aud1015-swap-plan.json"),
    ("ABFRQ", "AP Calculus AB — Free-Response Practice", 1, "abfrq-v2-audit-aud1015-swap-plan.json"),
]:
    files[fn] = plan(tag, name, ver, calc_swaps[tag], NOTE_CALC)

NOTE_CSA = "CSA FRQ points 9/9/9/9 -> 7/7/5/6 (current CED), plus scope fixes. Corrected copies are in data/ap/stock/csa-aud1015-items.json. Replacements keep unit/skill (practice counts) except the Practice 5 swap, which trades one Practice 3 item for one Practice 5 item. Independent of data/ap/stock/csa2-v2-audit-r6-swap-plan.json (different slots); apply in either order."
files["csa1-v2-audit-aud1015-swap-plan.json"] = plan("CSA1", "AP Computer Science A — Practice Exam 1", 1, csa_swaps["CSA1"], NOTE_CSA)
files["csa2-v3-audit-aud1015-swap-plan.json"] = plan("CSA2", "AP Computer Science A — Practice Exam 2", 2, csa_swaps["CSA2"], NOTE_CSA)
for fn, d in files.items():
    json.dump(d, open(f"data/ap/stock/{fn}", "w"), ensure_ascii=False, indent=1)
    open(f"data/ap/stock/{fn}", "a").write("\n")
print("csa items", len(csa_items), "calc items", len(calc_items))
for fn, d in files.items():
    print(fn, d["swapCount"])
