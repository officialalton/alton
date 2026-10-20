"""AP Computer Science A 확대 CS3 — 신규 원형 X2(단원 2: 조건·반복). 2026-10-19. 공개 세트 CS1·CS2 의 원형·코드 모양과 겹치지 않는다."""
import math
from csa_common import *  # noqa: F401,F403
from common import Opt  # noqa: F401
from csa_p0_a import client, pick, STEM_OUT
from csa_p0_e import retry_any
from csa_p0_x1 import _text_item
import csa_java as J


def _completion(rng, arch, topic, tpl, cands, tests, stem, concept, path, kwhy):
    options = [{"text": f"`{c}`", "source": tpl.replace("/* missing code */", c), "why": w, "key": k} for c, k, w in cands]
    return mk_tests(rng, arch, topic, "2.A", stem, tpl, options, tests, concept=concept, path=path, kwhy_by_key=kwhy)


# ======================= 2.7 sentinel while (3.A) =======================
@retry_any
def cs_while_sentinel_trace(rng):
    vals = [rng.randint(2, 9) for _ in range(5)]
    stop = rng.randint(1, 3)
    vals[stop + 1] = -1
    code = "int[] a = {" + ", ".join(map(str, vals)) + "};\nint i = 0;\nint total = 0;\nwhile (i < a.length && a[i] != -1) {\n    total += a[i];\n    i++;\n}\nSystem.out.println(total + \" \" + i);"
    t = 0; i = 0
    while i < len(vals) and vals[i] != -1:
        t += vals[i]; i += 1
    muts = [{"why": "Includes the sentinel value -1 in the total before stopping.", "swap": ("while (i < a.length && a[i] != -1) {\n    total += a[i];\n    i++;\n}", "while (i < a.length) {\n    total += a[i];\n    i++;\n    if (a[i - 1] == -1) {\n        break;\n    }\n}")},
            {"why": "Reports the index of the sentinel plus one.", "swap": ('total + " " + i', 'total + " " + (i + 1)')},
            {"why": "Adds the sentinel position instead of the values.", "swap": ("total += a[i];", "total += i;")},
            {"why": "Reads the whole array and ignores the sentinel.", "swap": ("while (i < a.length && a[i] != -1)", "while (i < a.length)")}]
    return mk(rng, "cs_while_sentinel_trace", "2.7", "3.A", "What is printed as a result of executing the following code segment, which adds array values until a sentinel value is found?", code, muts=muts, py=f"{t} {i}", concept="a while loop with a sentinel condition stops before processing the sentinel", path="javac+java output vs Python loop", kwhy="The loop adds values until it meets -1; total is the sum of the values before it and i is the index of the sentinel.", facts=[f"vals={vals}"])


# ======================= 2.6 동치 불린 식 (3.A) =======================
def cs_bool_equiv_expr(rng):
    forms = [
        ("!(a && !b)", [("!a || b", True), ("!a && b", False), ("a || !b", False), ("a && b", False)], lambda a, b: not (a and not b)),
        ("!(a || b) || b", [("!a || b", True), ("!a && b", False), ("a && !b", False), ("!b", False)], lambda a, b: (not (a or b)) or b),
        ("!(!a && b)", [("a || !b", True), ("a && !b", False), ("!a || b", False), ("a && b", False)], lambda a, b: not ((not a) and b)),
        ("!(a && b) && (a || b)", [("a != b", True), ("a == b", False), ("a && !b", False), ("!a && !b", False)], lambda a, b: (not (a and b)) and (a or b)),
    ]
    given, opts, ref = pick(rng, forms)
    combos = [(a, b) for a in (False, True) for b in (False, True)]
    # 독립 경로 1: 파이썬 진리표. 독립 경로 2: 자바로 각 식을 네 조합에 실행.
    def table_java(expr):
        bodies = [("ret", f"boolean a = {str(a).lower()}; boolean b = {str(b).lower()}; return {expr};") for a, b in combos]
        return [J.tidy(r) for r in J.java_eval("", bodies)]
    ref_vals = [str(ref(a, b)).lower() for a, b in combos]
    if table_java(given) != ref_vals:
        raise ValueError("java_python_disagree")
    truth = []
    for text, is_key in opts:
        same = table_java(text) == ref_vals
        if same != is_key:
            raise ValueError("equivalence_expectation_failed")
        truth.append(same)
    key = [t for t, k in opts if k][0]
    why_by_expr = {"!a && b": "Applies De Morgan's law without switching the operator and negating b, so it differs when a is true and b is false.", "a || !b": "Negates the wrong operand; compare the values when a is false and b is true.", "a && b": "Treats the negation as removed; compare the values when both are false.",
                   "!b": "Keeps only part of the condition; compare the values when a is true and b is true.", "a && !b": "Keeps the conjunction without negating the whole expression; compare when both are true.", "!a || b": "", "a != b": "", "a == b": "Reverses the exclusive-or relationship; compare when a and b differ.", "!a && !b": "Describes only the case where both are false; compare when exactly one is true.", "a || !b": ""}
    keyo = Opt(f"`{key}`", True, "A truth table over the four combinations of a and b shows the same values for the original expression and this one.", None)
    ds = [Opt(f"`{t}`", False, why_by_expr[t] or "A truth table shows a different value for at least one combination of a and b.", None) for t, k in opts if not k]
    stem = f"Which of the following boolean expressions is equivalent to {given} for all boolean values of a and b?"
    p = pack("cs_bool_equiv_expr", "2.6", "3.A", "not_allowed", stem, keyo, ds, rng, stimulus={"kind": "none", "description": "", "data": {}}, est=75, facts=[f"given={given}"])
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate([o for j, o in enumerate(p["options"]) if j != p["key_index"]])]
    p["blueprint"] = mc_blueprint("cs_bool_equiv_expr", SUB, "2.6", "3.A", "not_allowed", "equivalent boolean expressions via De Morgan's laws", "build a truth table for the given expression and for each option", [("equivalence was checked on all four combinations in Python and in Java", "python truth table and java run")], mis, "truth table in Python vs java evaluation of each expression",
                                  material={"type": "none", "must_include": []}, method="python truth table + javac/java evaluation", extra={"judgment_demand": "apply De Morgan's laws or a truth table"})
    return p


# ======================= 2.8 for 와 같은 출력의 while (3.C) =======================
def cs_loop_equiv_while(rng):
    a = rng.randint(1, 4); b = rng.choice([9, 11, 13]); st = rng.choice([2, 3])
    given = f"for (int i = {a}; i < {b}; i += {st}) {{\n    System.out.print(i + \" \");\n}}"
    good = f"int i = {a};\nwhile (i < {b}) {{\n    System.out.print(i + \" \");\n    i += {st};\n}}"
    bad = [(f"int i = {a};\nwhile (i < {b}) {{\n    i += {st};\n    System.out.print(i + \" \");\n}}", "Increments the loop variable before printing, so the first value printed is wrong and the sequence shifts."),
           (f"int i = {a};\nwhile (i <= {b}) {{\n    System.out.print(i + \" \");\n    i += {st};\n}}", "Uses <= in the condition, so it can print one more value than the for loop."),
           (f"int i = {a};\nwhile (i < {b}) {{\n    System.out.print(i + \" \");\n    i++;\n}}", f"Adds 1 instead of {st} each pass, so it prints every integer in the range."),
           (f"int i = {a + st};\nwhile (i < {b}) {{\n    System.out.print(i + \" \");\n    i += {st};\n}}", "Starts the loop variable one step late, so the first value is missing.")]
    outs = [J.tidy(r) for r in J.java_eval("", [("out", given), ("out", good)] + [("out", b_[0]) for b_ in bad])]
    py = " ".join(str(v) for v in range(a, b, st))
    if outs[0] != py or outs[1] != py:
        raise ValueError("java_python_disagree")
    for o, (_c, _w) in zip(outs[2:], bad):
        if o == py:
            raise ValueError("distractor_equals_key")
    if len(set(outs[2:])) < 3:
        raise ValueError("ambiguous")
    lab = lambda c: "`" + c.replace("\n", " ") + "`"  # noqa: E731
    stem = "Which of the following while loops produces exactly the same output as the for loop shown?"
    key = (lab(good), f"The initialization, the condition i < {b}, the print, and the update i += {st} are all kept in the same order as in the for loop, so the same values are printed.")
    wrongs = [(lab(c), w) for c, w in bad]
    return _text_item(rng, "cs_loop_equiv_while", "2.8", "3.C", stem, given, key, wrongs, "rewrite a for loop as an equivalent while loop", "java output of each loop vs Python range", [f"a={a}", f"b={b}", f"step={st}"], method="javac+java execution of every loop")


# ======================= 2.8 조건부 누적 (3.A) =======================
@retry_any
def cs_loop_accumulate_cond(rng):
    m = rng.choice([3, 4, 5]); r = rng.randint(0, m - 1); hi = rng.randint(14, 24)
    code = f"int sum = 0;\nfor (int i = 1; i <= {hi}; i++) {{\n    if (i % {m} == {r}) {{\n        sum += i;\n    }}\n}}\nSystem.out.println(sum);"
    py = sum(i for i in range(1, hi + 1) if i % m == r)
    muts = [{"why": "Uses < in the loop condition, so the last value is left out.", "swap": (f"i <= {hi}", f"i < {hi}")},
            {"why": "Starts the loop at 0, which only matters if the remainder is 0, so it adds the wrong set of values.", "swap": ("int i = 1;", "int i = 0;")},
            {"why": "Adds the loop variable to the sum only when the remainder differs from the target.", "swap": (f"i % {m} == {r}", f"i % {m} != {r}")},
            {"why": "Counts the matching values instead of adding them.", "swap": ("sum += i;", "sum++;")}]
    return mk(rng, "cs_loop_accumulate_cond", "2.8", "3.A", "What is printed as a result of executing the following code segment, which adds the values that leave a given remainder?", code, muts=muts, py=str(py), concept="accumulate values that satisfy a remainder condition", path="javac+java output vs Python comprehension", kwhy="The loop adds the values from 1 through the limit whose remainder equals the target.", facts=[f"m={m}", f"r={r}", f"hi={hi}"])


# ======================= 2.10 문자열 패턴 개수 (3.C) =======================
@retry_any
def cs_string_count_pattern(rng):
    pat = pick(rng, ["ab", "an", "to"])
    s = "".join(rng.choice([pat[0], pat[1], "x", pat[0]]) for _ in range(rng.randint(9, 12)))
    cnt = sum(1 for i in range(len(s) - 1) if s[i:i + 2] == pat)
    if cnt < 2:
        raise ValueError("ambiguous")
    code = f"String s = \"{s}\";\nint count = 0;\nfor (int i = 0; i < s.length() - 1; i++) {{\n    if (s.substring(i, i + 2).equals(\"{pat}\")) {{\n        count++;\n    }}\n}}\nSystem.out.println(count);"
    muts = [{"why": "Stops one position early, so a pattern at the very end is not counted.", "swap": ("i < s.length() - 1", "i < s.length() - 2")},
            {"why": "Counts the positions where the first character of the pattern appears.", "swap": (f"s.substring(i, i + 2).equals(\"{pat}\")", f"s.substring(i, i + 1).equals(\"{pat[0]}\")")},
            {"why": "Compares with == between String objects, which is not guaranteed to match equal text; here the substring is a new object so nothing is counted.", "swap": (f"s.substring(i, i + 2).equals(\"{pat}\")", f"s.substring(i, i + 2) == \"{pat}\"")},
            {"why": "Skips ahead a character after each match, so overlapping matches are missed.", "swap": ("count++;", "count++;\n        i++;")}]
    return mk(rng, "cs_string_count_pattern", "2.10", "3.C", "What is printed as a result of executing the following code segment, which counts the occurrences of a two-character pattern in a String?", code, muts=muts, py=str(cnt), concept="scan a String with substring and equals to count a pattern", path="javac+java output vs Python slicing count", kwhy="The loop examines every pair of adjacent characters and counts each pair equal to the pattern.", facts=[f"s={s}", f"pat={pat}"])


# ======================= 2.7 자릿수 뒤집기 (3.A) =======================
@retry_any
def cs_digit_reverse_trace(rng):
    n = rng.choice([1204, 3050, 4781, 9206, 5130, 7640, 2908])
    code = f"int n = {n};\nint rev = 0;\nwhile (n > 0) {{\n    rev = rev * 10 + n % 10;\n    n /= 10;\n}}\nSystem.out.println(rev);"
    py = int(str(n)[::-1])
    muts = [{"why": "Believes the leading zeros of the reversed number are printed.", "call": None} if False else {"why": "Adds the digits instead of building a reversed number.", "swap": ("rev = rev * 10 + n % 10;", "rev = rev + n % 10;")},
            {"why": "Builds the number from the leading digits (using integer division) instead of the last digit.", "swap": ("rev = rev * 10 + n % 10;", "rev = rev * 10 + n / 1000;")},
            {"why": "Stops the loop one pass early.", "swap": ("while (n > 0)", "while (n > 10)")},
            {"why": "Does not shift the previous digits before adding the next one.", "swap": ("rev = rev * 10 + n % 10;", "rev = rev + 10 * (n % 10);")}]
    return mk(rng, "cs_digit_reverse_trace", "2.7", "3.A", "What is printed as a result of executing the following code segment, which builds a new number from the digits of n?", code, muts=muts, py=str(py), concept="reverse the digits of an int with remainder and integer division", path="javac+java output vs Python string reversal", kwhy="Each pass moves the last digit of n to the end of rev; leading zeros of the reversed digits disappear because rev is an int.", facts=[f"n={n}"])


# ======================= 2.9 가장 큰 자릿수 완성 (2.A) =======================
@retry_any
def cs_largest_digit_completion(rng):
    tpl = "class Digits {\n    /** Returns the largest digit of n. Precondition: n >= 0. */\n    public static int largest(int n) {\n        int best = 0;\n        while (n > 0) {\n            int d = n % 10;\n/* missing code */\n            n /= 10;\n        }\n        return best;\n    }\n}"
    cands = [("if (d > best) { best = d; }", True, None), ("if (d < best) { best = d; }", False, "Keeps the smaller digit, which stays at 0 because best starts at 0."), ("best += d;", False, "Adds the digits instead of keeping the largest."),
             ("best = d;", False, "Keeps the last examined digit, which is the leading digit, not the largest."), ("if (d > n) { best = d; }", False, "Compares a digit with the remaining number, which is almost never smaller than the digit.")]
    tests = [(f"return Digits.largest({v});", str(max(int(ch) for ch in str(v)))) for v in (0, 7, 3501, 4821, 9990, 1234, 80605)]
    options = [{"text": f"`{c}`", "source": tpl.replace("/* missing code */", "            " + c), "why": w, "key": k} for c, k, w in cands]
    stem = "The method largest is intended to return the largest digit of the nonnegative int n. Which of the following can replace /* missing code */ so that largest works as intended?"
    shown = tpl.replace("/* missing code */", "            /* missing code */")
    return mk_tests(rng, "cs_largest_digit_completion", "2.9", "2.A", stem, shown, options, tests, concept="track the maximum while extracting digits", path="each candidate compiled and run on a set of ints vs Python max digit", kwhy_by_key="The statement updates best only when the current digit is larger, so best ends as the largest digit.")


# ======================= 2.9 약수 개수 완성 (2.A) =======================
@retry_any
def cs_count_divisors_completion(rng):
    tpl = "class Factors {\n    /** Returns the number of positive divisors of n. Precondition: n > 0. */\n    public static int countDivisors(int n) {\n        int count = 0;\n        for (int d = 1; d <= n; d++) {\n/* missing code */\n        }\n        return count;\n    }\n}"
    cands = [("if (n % d == 0) { count++; }", True, None), ("if (d % n == 0) { count++; }", False, "Reverses the operands, so only d equal to n (and nothing smaller) passes."), ("if (n / d == 0) { count++; }", False, "Uses integer division, which is 0 only when d exceeds n, so no loop value passes."),
             ("if (n % d != 0) { count++; }", False, "Counts the values that do not divide n."), ("count = d;", False, "Stores the last value of d instead of counting divisors.")]
    tests = [(f"return Factors.countDivisors({v});", str(sum(1 for d in range(1, v + 1) if v % d == 0))) for v in (1, 2, 7, 12, 16, 30, 36)]
    options = [{"text": f"`{c}`", "source": tpl.replace("/* missing code */", "            " + c), "why": w, "key": k} for c, k, w in cands]
    stem = "The method countDivisors is intended to return the number of positive divisors of n. Which of the following can replace /* missing code */ so that countDivisors works as intended?"
    shown = tpl.replace("/* missing code */", "            /* missing code */")
    return mk_tests(rng, "cs_count_divisors_completion", "2.9", "2.A", stem, shown, options, tests, concept="count the values of d for which n % d is 0", path="each candidate compiled and run on a set of ints vs Python divisor count", kwhy_by_key="n % d == 0 holds exactly when d divides n, so counting those d gives the number of divisors.")


# ======================= 2.10 문자 제거 완성 (2.A) =======================
@retry_any
def cs_remove_char_completion(rng):
    ch = pick(rng, ["a", "e", "s", "t"])
    tpl = f"class Clean {{\n    /** Returns s with every occurrence of the character \"{ch}\" removed. */\n    public static String strip(String s) {{\n        String result = \"\";\n        for (int i = 0; i < s.length(); i++) {{\n/* missing code */\n        }}\n        return result;\n    }}\n}}"
    cands = [(f"if (!s.substring(i, i + 1).equals(\"{ch}\")) {{ result += s.substring(i, i + 1); }}", True, None), (f"if (s.substring(i, i + 1).equals(\"{ch}\")) {{ result += s.substring(i, i + 1); }}", False, "Keeps only the character that should be removed."),
             (f"if (!s.substring(i, i + 1).equals(\"{ch}\")) {{ result = s.substring(i, i + 1); }}", False, "Replaces the result on every pass instead of appending, so only the last kept character remains."),
             (f"if (!s.substring(i, i + 1).equals(\"{ch}\")) {{ result += s.substring(i); }}", False, "Appends the whole rest of the String each time, which repeats characters."),
             (f"if (!s.substring(i, i + 1).equals(\"{ch}\")) {{ result = s.substring(i, i + 1) + result; }}", False, "Prepends each kept character, which reverses their order.")]
    words = ["", ch, "banana", "state", "seats", "tests", "xyz", "stone", ch * 3]
    tests = [(f'return Clean.strip("{w}");', w.replace(ch, "")) for w in words]
    options = [{"text": f"`{c}`", "source": tpl.replace("/* missing code */", "            " + c), "why": w, "key": k} for c, k, w in cands]
    stem = f"The method strip is intended to return a String with every occurrence of the character \"{ch}\" removed from s. Which of the following can replace /* missing code */ so that strip works as intended?"
    shown = tpl.replace("/* missing code */", "            /* missing code */")
    return mk_tests(rng, "cs_remove_char_completion", "2.10", "2.A", stem, shown, options, tests, concept="build a new String from the characters that pass a test", path="each candidate compiled and run on Strings vs Python replace", kwhy_by_key="The statement appends exactly the characters that differ from the removed character, in their original order.")


# ======================= 2.7 음수 전까지 합 완성 (2.A) =======================
@retry_any
def cs_sum_until_negative_completion(rng):
    tpl = "class Totals {\n    /** Returns the sum of the values in a before the first negative value, or the sum of all values if none is negative. */\n    public static int sumBeforeNegative(int[] a) {\n        int sum = 0;\n        int i = 0;\n/* missing code */\n        return sum;\n    }\n}"
    cands = [("while (i < a.length && a[i] >= 0) { sum += a[i]; i++; }", True, None), ("while (a[i] >= 0 && i < a.length) { sum += a[i]; i++; }", False, "Tests a[i] before checking i, so an array with no negative value throws an ArrayIndexOutOfBoundsException."),
             ("while (i < a.length && a[i] > 0) { sum += a[i]; i++; }", False, "Stops at the first zero as well as at the first negative value."), ("while (i < a.length) { if (a[i] >= 0) { sum += a[i]; } i++; }", False, "Skips negative values but keeps adding the values after them."),
             ("while (i < a.length && a[i] >= 0) { sum += a[i]; }", False, "Never changes i, so the loop does not end for a nonempty array of nonnegative values.")]
    cases = [[3, 4, -1, 9], [5, 6, 7], [-2, 8], [0, 3, -4, 6], [1, 0, 2]]
    tests = [(f"return Totals.sumBeforeNegative(new int[] {{{', '.join(map(str, c))}}});", str(sum(v for v in c[:next((k for k, x in enumerate(c) if x < 0), len(c))]))) for c in cases]
    # 마지막 선택지는 무한 루프가 될 수 있어 실행이 시간 초과이면 시드를 버린다(java_eval 이 ValueError) — 대신 변형이 종료되는 입력만 쓴다
    cands[4] = ("while (i < a.length && a[i] >= 0) { sum += a[i]; i += 2; }", False, "Skips every other value because the index moves by 2 each pass.")
    options = [{"text": f"`{c}`", "source": tpl.replace("/* missing code */", "        " + c), "why": w, "key": k} for c, k, w in cands]
    stem = "The method sumBeforeNegative is intended to return the sum of the values before the first negative value (the sum of all values if there is no negative value). Which of the following can replace /* missing code */ so that the method works as intended?"
    shown = tpl.replace("/* missing code */", "        /* missing code */")
    return mk_tests(rng, "cs_sum_until_negative_completion", "2.7", "2.A", stem, shown, options, tests, concept="stop a while loop at a sentinel while keeping the index in bounds", path="each candidate compiled and run on arrays vs Python slice sum", kwhy_by_key="The condition checks the index first and then the value, and the loop stops at the first negative value without going past the end.")


# ======================= 2.11 쌍 개수 (3.A) =======================
@retry_any
def cs_nested_loop_pairs_trace(rng):
    n = rng.randint(5, 7); k = rng.randint(n + 1, 2 * n - 1)
    code = f"int count = 0;\nfor (int i = 1; i <= {n}; i++) {{\n    for (int j = i + 1; j <= {n}; j++) {{\n        if (i + j == {k}) {{\n            count++;\n        }}\n    }}\n}}\nSystem.out.println(count);"
    py = sum(1 for i in range(1, n + 1) for j in range(i + 1, n + 1) if i + j == k)
    muts = [{"why": "Starts the inner loop at i, so pairs with equal values are also counted.", "swap": ("int j = i + 1;", "int j = i;")},
            {"why": "Starts the inner loop at 1, so each pair is counted in both orders.", "swap": ("int j = i + 1;", "int j = 1;")},
            {"why": "Stops the outer loop one value early.", "swap": (f"i <= {n}; i++", f"i < {n}; i++")},
            {"why": "Counts the pairs whose sum is at most the target, not equal to it.", "swap": (f"i + j == {k}", f"i + j <= {k}")}]
    return mk(rng, "cs_nested_loop_pairs_trace", "2.11", "3.A", "What is printed as a result of executing the following code segment, which counts pairs of different values that have a given sum?", code, muts=muts, py=str(py), concept="count pairs of distinct values with nested loops", path="javac+java output vs Python double comprehension", kwhy="The inner loop starts after i, so each pair of different values is considered once.", facts=[f"n={n}", f"k={k}"])


# ======================= 2.3 if-else if 반환 (3.C) =======================
@retry_any
def cs_grade_branches_trace(rng):
    t1, t2, t3 = rng.choice([(90, 75, 60), (85, 70, 55), (80, 65, 50)])
    xs = [t1, t2, t3]
    cls =f"class Grader {{\n    public static String level(int score) {{\n        if (score >= {t1}) {{\n            return \"high\";\n        }} else if (score >= {t2}) {{\n            return \"mid\";\n        }} else if (score >= {t3}) {{\n            return \"low\";\n        }}\n        return \"none\";\n    }}\n}}"
    lv = lambda v: "high" if v >= t1 else "mid" if v >= t2 else "low" if v >= t3 else "none"  # noqa: E731
    py = " ".join(lv(v) for v in xs)
    call = f"return Grader.level({xs[0]}) + \" \" + Grader.level({xs[1]}) + \" \" + Grader.level({xs[2]});"
    muts = [{"why": "Treats >= as > in the first branch, so the boundary value falls to the next branch.", "swap": (f"score >= {t1}", f"score > {t1}")},
            {"why": "Treats >= as > in the second branch, so the boundary value falls to the next branch.", "swap": (f"score >= {t2}", f"score > {t2}")},
            {"why": "Treats >= as > in the third branch, so the boundary value falls to the last return.", "swap": (f"score >= {t3}", f"score > {t3}")},
            {"why": "Swaps the labels of the two lower branches.", "swap": ('return "mid";', 'return "low";')}]
    stem = f"Consider the class Grader. What is returned by the code segment return Grader.level({xs[0]}) + \" \" + Grader.level({xs[1]}) + \" \" + Grader.level({xs[2]});?"
    return mk(rng, "cs_grade_branches_trace", "2.3", "3.C", stem, cls, call=call, muts=muts, py=py, concept="trace an if / else if chain with boundary values and early returns", path="javac+java return value vs Python chain", kwhy="The first test that is true decides the returned value; the remaining branches are skipped.", facts=[f"xs={xs}", f"t={t1},{t2},{t3}"])
