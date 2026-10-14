"""AP Computer Science A P0 원형 E — 두 번째 풀 모의고사(겹침 0)를 위한 새 구조: 단원 1(Using Objects and Methods)·2(Selection and Iteration) 단독 22개 + 문자열 루프 2문항 세트 1개.
규칙은 csa_common.py 와 같다: 정답은 javac/java 실행 결과, 독립 Python 참조가 같은 값을 내야 하고, 오답은 이름 붙은 오개념을 코드 변형으로 실제 실행한 값이다. 코드 완성은 후보를 전부 컴파일·실행해 경계 테스트로 판정한다.
기존 원형(csa_p0_a~d)과 겹치지 않는 구조만 둔다(같은 코드 모양에 숫자만 바꾼 것은 새 원형이 아니다). 코드·선택지에 달러·밑줄 두 개·백슬래시를 넣지 않는다."""
import functools
import math
from csa_common import *  # noqa: F401,F403
from csa_p0_a import client, pick, STEM_OUT
import csa_p0_b as B
import csa_java as J


def retry_any(fn):
    """오답 변형이 정답과 겹치거나 선택지 간격이 모자라면 같은 rng 로 다시 뽑는다(결정적)."""
    @functools.wraps(fn)
    def w(rng):
        last = None
        for _ in range(60):
            try:
                return fn(rng)
            except ValueError as e:
                if not any(t in str(e) for t in ("not_enough_separated", "not_enough_distinct", "mutant_pattern_missing_retry", "ambiguous")):
                    raise
                last = e
        raise last
    return w


# ======================= 1.4 대입 순서 (3.A) =======================
@retry_any
def cs_assign_swap_bug(rng):
    a, b, k = rng.randint(3, 15), rng.randint(3, 15), rng.randint(2, 6)
    if a == b:
        raise ValueError("ambiguous")
    code = f"int x = {a};\nint y = {b};\nx = y;\ny = x + {k};\nSystem.out.println(x + \" \" + y);"
    py = f"{b} {b + k}"
    head = f"int x = {a};\nint y = {b};\n"
    muts = [{"why": "Believes x keeps its original value after x = y, so y is computed from the old x.", "call": head + f"x = y;\ny = {a} + {k};\nSystem.out.println(x + \" \" + y);"},
            {"why": "Reads x = y as copying x into y, so the direction of the assignment is reversed.", "swap": ("x = y;", "y = x;")},
            {"why": "Applies the addition to x instead of to y.", "swap": (f"y = x + {k};", f"x = y + {k};")},
            {"why": "Believes y = x + k also stores the new value back into x.", "swap": (f"y = x + {k};", f"y = x + {k};\nx = y;")}]
    return mk(rng, "cs_assign_swap_bug", "1.4", "3.A", STEM_OUT, code, muts=muts, py=py, concept="assignment copies the right-hand value into the left-hand variable, in statement order",
              path="javac+java output vs Python sequential assignment", kwhy=f"After x = y both variables hold {b}; then y becomes x + {k}, which is {b + k}.", facts=[f"a={a}", f"b={b}", f"k={k}", f"key={py}"])


# ======================= 1.3 문자열 연결·덧셈 우선순위 (3.A) =======================
@retry_any
def cs_string_concat_prec(rng):
    a, b, c, d = (rng.randint(2, 9) for _ in range(4))
    code = f"int a = {a};\nint b = {b};\nint c = {c};\nint d = {d};\nSystem.out.println(a + b + \"-\" + c + d);"
    py = f"{a + b}-{c}{d}"
    muts = [{"why": "Believes the last two numbers are added before they are joined to the text.", "swap": (" + \"-\" + c + d", " + \"-\" + (c + d)")},
            {"why": "Believes every + in a println argument joins text, so a and b are written next to each other.", "swap": ("a + b + \"-\"", "\"\" + a + b + \"-\"")},
            {"why": "Reads the quoted dash as a minus sign.", "swap": (" + \"-\" + c + d", " - c + d")},
            {"why": "Believes the numbers on both sides of the text are added to one total.", "swap": ("a + b + \"-\" + c + d", "a + b + (c + d)")}]
    return mk(rng, "cs_string_concat_prec", "1.3", "3.A", STEM_OUT, code, muts=muts, py=py, concept="left-to-right evaluation: numbers are added until the first String operand turns + into concatenation",
              path="javac+java output vs Python str() joins", kwhy=f"a + b is evaluated first as the int {a + b}; once the String \"-\" is reached each + joins text, so c and d are written one after the other: {py}.", facts=[f"key={py}"])


# ======================= 1.5 char 산술 (3.A) =======================
@retry_any
def cs_char_arith(rng):
    ch = pick(rng, list("bcdefghij")); k = rng.randint(2, 5)
    code = f"char ch = '{ch}';\nint n = ch - 'a';\nchar next = (char) (ch + {k});\nSystem.out.println(n + \" \" + next + \" \" + (ch + 1));"
    py = f"{ord(ch) - 97} {chr(ord(ch) + k)} {ord(ch) + 1}"
    muts = [{"why": "Believes ch + 1 is still a char, so the next letter is printed.", "swap": ("(ch + 1)", "(char) (ch + 1)")},
            {"why": "Counts the position of the letter from 1 instead of 0.", "swap": ("ch - 'a';", "ch - 'a' + 1;")},
            {"why": "Believes the cast is not needed and prints the numeric code of the shifted letter.", "swap": (f"char next = (char) (ch + {k});", f"int next = ch + {k};")},
            {"why": "Believes a char behaves like the number of its position in the alphabet.", "swap": ("(ch + 1)", "(n + 1)")}]
    return mk(rng, "cs_char_arith", "1.5", "3.A", STEM_OUT, code, muts=muts, py=py, concept="char arithmetic yields an int; a cast converts the code back to a char",
              path="javac+java output vs Python ord() and chr()", kwhy=f"'{ch}' - 'a' is {ord(ch) - 97}; the cast turns the code {ord(ch) + k} back into the letter {chr(ord(ch) + k)}; ch + 1 is an int, {ord(ch) + 1}.", facts=[f"ch={ch}", f"k={k}", f"key={py}"])


# ======================= 1.5 int 오버플로 (3.A) =======================
@retry_any
def cs_int_overflow(rng):
    k = rng.randint(1, 9)
    code = f"int big = Integer.MAX_VALUE;\nbig += {k};\nlong wide = (long) Integer.MAX_VALUE + {k};\nSystem.out.println((big < 0) + \" \" + wide);"
    mx = 2 ** 31 - 1
    wrapped = (mx + k + 2 ** 31) % 2 ** 32 - 2 ** 31
    py = f"{'true' if wrapped < 0 else 'false'} {mx + k}"
    muts = [{"why": "Believes an int stops at its largest value instead of wrapping around to a negative value.", "swap": (f"big += {k};", "big = Integer.MAX_VALUE;")},
            {"why": "Believes the cast applies to the whole sum, so the addition overflows before it is widened.", "swap": (f"(long) Integer.MAX_VALUE + {k}", f"(long) (Integer.MAX_VALUE + {k})")},
            {"why": "Believes an overflow in int arithmetic throws an exception.", "swap": (f"big += {k};", f"big = Math.addExact(big, {k});")},
            {"why": "Believes the long variable is limited to the largest int.", "swap": (f"long wide = (long) Integer.MAX_VALUE + {k};", "long wide = Integer.MAX_VALUE;")}]
    return mk(rng, "cs_int_overflow", "1.5", "3.A", STEM_OUT, code, muts=muts, py=py, concept="int overflow wraps around; widening to long before the addition avoids it",
              path="javac+java output vs Python big integers wrapped to 32 bits", kwhy=f"Adding {k} to the largest int wraps to the negative value {wrapped}, so big < 0 is true; the long sum is computed without overflow: {mx + k}.", facts=[f"k={k}", f"key={py}"])


# ======================= 1.11 Math.random 범위 완성 (2.A) =======================
def cs_random_range(rng):
    lo = rng.randint(2, 6); n = rng.randint(4, 8); hi = lo + n - 1
    tpl = "class Dice {\n    public static int roll(double r) {\n        return /*BODY*/;\n    }\n}"
    shown = f"class Dice {{\n    /** Returns a random integer from {lo} through {hi}, inclusive, with every value equally likely. */\n    public static int roll() {{\n        return /* missing code */;\n    }}\n}}"
    cands = [(f"(int) (Math.random() * {n}) + {lo}", True, None),
             (f"(int) (Math.random() * {n - 1}) + {lo}", False, f"Multiplies by one less than the number of values, so {hi} is never produced."),
             (f"(int) (Math.random() * {hi}) + {lo}", False, "Multiplies by the largest value instead of the number of values, so results can be above the range."),
             (f"(int) (Math.random() * {n}) + {lo - 1}", False, f"Adds one less than the smallest value, so the lowest result is {lo - 1}."),
             (f"(int) (Math.random() + {lo}) * {n}", False, "Applies the cast to the sum so the random part is cut to zero, then multiplies.")]
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", c.replace("Math.random()", "r")), "why": w, "key": k} for c, k, w in cands]
    tests = [("return Dice.roll(0.0);", str(lo)), ("return Dice.roll(0.999999);", str(hi)), ("return Dice.roll(0.5);", str(int(0.5 * n) + lo)), ("return Dice.roll(0.34);", str(int(0.34 * n) + lo)), ("return Dice.roll(0.8);", str(int(0.8 * n) + lo))]
    return mk_tests(rng, "cs_random_range", "1.11", "2.A", f"The method roll is intended to return a random integer from {lo} through {hi}, inclusive, with every value equally likely. Which of the following can replace /* missing code */ so that roll works as intended?", shown, options, tests,
                    concept="scale and shift Math.random() to a range of integers", path="each expression run with fixed random values at both ends of [0, 1) and in the middle; expected results from Python floor arithmetic",
                    kwhy_by_key=f"Math.random() * {n} is in [0, {n}); the cast truncates it to 0 through {n - 1}; adding {lo} shifts it to {lo} through {hi}.")


# ======================= 1.9 오버로딩 (3.C) =======================
OVL = "class Show {\n    public static String f(int n) { return \"I\"; }\n    public static String f(double d) { return \"D\"; }\n    public static String f(String s) { return \"S\"; }\n    public static String f(int a, double b) { return \"ID\"; }\n    public static String f(double a, int b) { return \"DI\"; }\n}"
OVL_CALLS = [("5", "I", "5.0", "Believes an int argument is converted to double even though an int version exists."),
             ("5.0", "D", "5", "Believes a double argument can be narrowed to match the int version."),
             ("\"5\"", "S", "5", "Believes a String made of digits is converted to an int."),
             ("7 / 2", "I", "7 / 2.0", "Believes dividing two int values produces a double and picks the double version."),
             ("2 + 3", "I", "2 + 3.0", "Believes adding two int values gives a double."),
             ("2, 3.0", "ID", "2.0, 3", "Believes the first argument decides the overload regardless of the second."),
             ("2.0, 3", "DI", "2, 3.0", "Believes the int argument always comes first in the matching method.")]


@retry_any
def cs_overload_resolution(rng):
    ch = rng.sample(OVL_CALLS, 3)
    stm = "System.out.println(" + " + ".join(f"Show.f({c[0]})" for c in ch) + ");"
    py = "".join(c[1] for c in ch)
    muts = []
    for i, c in enumerate(ch):
        s = "System.out.println(" + " + ".join(f"Show.f({(c2[2] if j == i else c2[0])})" for j, c2 in enumerate(ch)) + ");"
        muts.append({"why": c[3] + f" In this code Show.f({c[0]}) actually matches the version that returns {c[1]}.", "call": s})
    muts.append({"why": "Believes the overloaded methods cannot be told apart, so the first one declared (the int version, which returns I) is used for every call.", "call": "System.out.println(" + " + ".join('Show.f(5)' for _ in ch) + ");"})
    return mk(rng, "cs_overload_resolution", "1.9", "3.C", STEM_OUT, OVL, call=stm, muts=muts, py=py, stim_code=OVL + "\n\n" + client(stm), concept="overload resolution by the number and static types of the arguments",
              path="javac+java output vs Python table of the matching signature", kwhy="Each call selects the overload whose parameter types match the argument types exactly; an int expression selects the int version and a double expression selects the double version.", facts=[f"key={py}"])


# ======================= 1.15 String 비교 (3.B) =======================
@retry_any
def cs_string_equals_compare(rng):
    w, p = pick(rng, [("apple", "app"), ("banner", "ban"), ("camera", "cam"), ("planet", "plan"), ("garden", "gar"), ("market", "mar"), ("window", "win")])
    code = f"String a = \"{w}\";\nString b = \"{p}\";\nString c = b + \"{w[len(p):]}\";\nSystem.out.println(a.equals(c) + \" \" + (a == c) + \" \" + a.compareTo(b));"
    d = len(w) - len(p)
    py = f"true false {d}"
    muts = [{"why": "Believes == compares the characters of two Strings, so the built String is == to the literal.", "swap": ("(a == c)", "(a.equals(c))")},
            {"why": "Believes equals compares object references, so a String built with + is not equal.", "swap": ("a.equals(c)", "(a == c)")},
            {"why": "Believes compareTo returns only -1, 0 or 1.", "swap": ("a.compareTo(b)", "Integer.signum(a.compareTo(b))")},
            {"why": "Believes compareTo subtracts in the other direction.", "swap": ("a.compareTo(b)", "b.compareTo(a)")}]
    return mk(rng, "cs_string_equals_compare", "1.15", "3.B", STEM_OUT, code, muts=muts, py=py, concept="equals versus == on Strings; compareTo returns a length difference when one String is a prefix",
              path="javac+java output vs Python equality, identity of separately built strings and length difference", kwhy=f"The built String has the same characters as a, so equals is true; it is a different object, so == is false; a.compareTo(b) is the length difference {d} because b is a prefix of a.", facts=[f"key={py}"])


# ======================= 1.11 Math 완성 (2.A) =======================
def cs_math_completion(rng):
    tpl = "class Geometry {\n    /** Returns the distance between the points (x1, y1) and (x2, y2). */\n    public static double distance(double x1, double y1, double x2, double y2) {\n        return /*BODY*/;\n    }\n}"
    shown = tpl.replace("/*BODY*/", "/* missing code */")
    cands = [("Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))", True, None),
             ("Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)", False, "Leaves the sum of the squares without taking the square root."),
             ("Math.sqrt(Math.pow(x2 - x1, 2)) + Math.sqrt(Math.pow(y2 - y1, 2))", False, "Takes a square root of each squared difference separately, which adds the absolute differences."),
             ("Math.sqrt((x2 - x1) * 2 + (y2 - y1) * 2)", False, "Doubles the differences instead of squaring them.")]
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", c), "why": w, "key": k} for c, k, w in cands]
    pts = [(0, 0, 3, 4), (1, 1, 1, 1), (0, 0, 0, 5), (-1, -1, 2, 3), (2, 3, 8, 11), (5, 5, 5, 12)]
    tests = [(f"return Geometry.distance({a}, {b}, {c}, {d});", str(math.sqrt((c - a) ** 2 + (d - b) ** 2))) for a, b, c, d in pts]
    return mk_tests(rng, "cs_math_completion", "1.11", "2.A", "The method distance is intended to return the distance between two points. Which of the following can replace /* missing code */ so that distance works as intended?", shown, options, tests,
                    concept="combine Math.pow and Math.sqrt in the distance formula", path="each candidate compiled and run on points whose distances are exact; expected values from Python math.sqrt",
                    kwhy_by_key="It squares each coordinate difference with Math.pow, adds the two squares and takes the square root of the sum, which is the distance formula.")


# ======================= 1.15 String 완성 (2.A) =======================
def cs_string_method_completion(rng):
    tpl = "class Initials {\n    /** Returns a String made of the first character of s followed by the last character of s. Precondition: s has at least 2 characters. */\n    public static String ends(String s) {\n        return /*BODY*/;\n    }\n}"
    shown = tpl.replace("/*BODY*/", "/* missing code */")
    cands = [("s.substring(0, 1) + s.substring(s.length() - 1)", True, None),
             ("s.substring(0, 1) + s.substring(s.length())", False, "The substring that starts at the length is empty, so the last character is missing."),
             ("s.substring(0, 1) + s.substring(s.length() - 2)", False, "Starts one position too early and returns the last two characters."),
             ("s.substring(s.length() - 1) + s.substring(0, 1)", False, "Puts the last character before the first character.")]
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", c), "why": w, "key": k} for c, k, w in cands]
    tests = [(f'return Initials.ends("{w}");', w[0] + w[-1]) for w in ["ab", "hello", "abc", "xyzzy", "cs", "computer"]]
    return mk_tests(rng, "cs_string_method_completion", "1.15", "2.A", "The method ends is intended to return a String with the first character of s followed by its last character. Which of the following can replace /* missing code */ so that ends works as intended?", shown, options, tests,
                    concept="substring with one and two arguments to select the first and last characters", path="each candidate compiled and run on strings of length 2 and more; expected values from Python indexing",
                    kwhy_by_key="substring(0, 1) is the first character and substring(s.length() - 1) is the one-character String that starts at the last index.")


# ======================= 2.8 for 반복 횟수 (3.A) =======================
@retry_any
def cs_for_iter_count(rng):
    a, s, m = rng.randint(2, 6), rng.randint(3, 5), rng.randint(4, 8)
    b = a + s * m
    code = f"int count = 0;\nint i;\nfor (i = {a}; i < {b}; i += {s}) {{\n    count++;\n}}\nSystem.out.println(count + \" \" + i);"
    py = f"{m} {b}"
    muts = [{"why": "Treats the test as i <= bound, so the body runs one more time when i reaches the bound.", "swap": (f"i < {b}", f"i <= {b}")},
            {"why": "Believes the value of i after the loop is the last value used inside the body.", "swap": ('count + " " + i', f'count + " " + (i - {s})')},
            {"why": "Believes the update adds 1 instead of the step size.", "swap": (f"i += {s}", "i++")},
            {"why": "Believes the starting value is not counted as an iteration.", "swap": ('count + " " + i', 'count - 1 + " " + i')}]
    return mk(rng, "cs_for_iter_count", "2.8", "3.A", STEM_OUT, code, muts=muts, py=py, concept="iteration count and the final value of a loop variable declared outside the for statement",
              path="javac+java output vs Python simulation of the loop", kwhy=f"i takes the values {a}, {a + s}, ... up to {b - s}, which is {m} iterations; the test i < {b} first fails when i is {b}, and that value remains after the loop.", facts=[f"key={py}"])


# ======================= 2.2 관계·논리 식 (3.A) =======================
@retry_any
def cs_boolean_expr_trace(rng):
    a = rng.randint(3, 9); b = a; c = rng.randint(1, 11)
    if c in (a, a + 1, a - 1):
        raise ValueError("ambiguous")
    code = f"int a = {a};\nint b = {b};\nint c = {c};\nSystem.out.println((a > b) + \" \" + (b != c && c >= a) + \" \" + !(a == b || c < b));"
    t = lambda x: "true" if x else "false"  # noqa: E731
    py = f"{t(a > b)} {t(b != c and c >= a)} {t(not (a == b or c < b))}"
    muts = [{"why": "Treats > as at least, so two equal values compare as greater.", "swap": ("(a > b)", "(a >= b)")},
            {"why": "Reads != as ==.", "swap": ("b != c", "b == c")},
            {"why": "Uses OR where the expression requires both conditions.", "swap": ("b != c && c >= a", "b != c || c >= a")},
            {"why": "Applies the ! only to the first condition inside the parentheses.", "swap": ("!(a == b || c < b)", "(!(a == b) || c < b)")}]
    return mk(rng, "cs_boolean_expr_trace", "2.2", "3.A", STEM_OUT, code, muts=muts, py=py, concept="relational operators on equal values and the precedence of ! over || in a printed boolean expression",
              path="javac+java output vs Python boolean operators", kwhy=f"With a = b = {a} and c = {c}: a > b is {t(a > b)}; b != c && c >= a is {t(b != c and c >= a)}; the negation of (a == b || c < b) is {t(not (a == b or c < b))}.", facts=[f"key={py}"])


# ======================= 2.3 독립 if + else-if 사슬 (3.A) =======================
@retry_any
def cs_else_if_chain(rng):
    s = pick(rng, [95, 90, 85, 80, 75, 70, 65, 60])
    code = f"int score = {s};\nString result = \"\";\nif (score >= 90) {{\n    result += \"A\";\n}}\nif (score >= 80) {{\n    result += \"B\";\n}} else if (score >= 70) {{\n    result += \"C\";\n}} else {{\n    result += \"D\";\n}}\nSystem.out.println(result);"
    r = "A" if s >= 90 else ""
    r += "B" if s >= 80 else ("C" if s >= 70 else "D")
    muts = [{"why": "Believes the two decisions form a single else-if chain, so only one letter is added.", "swap": ("}\nif (score >= 80)", "} else if (score >= 80)")},
            {"why": "Believes every test is an independent if statement, so the else belongs to the last one only.", "swap": ("else if (score >= 70)", "if (score >= 70)")},
            {"why": "Reads score >= 80 as score > 80.", "swap": ("score >= 80", "score > 80")},
            {"why": "Believes the else branch also runs after a branch that was chosen.", "swap": ("} else {\n    result += \"D\";\n}", "}\nresult += \"D\";")},
            {"why": "Reads score >= 70 as score > 70.", "swap": ("score >= 70", "score > 70")}]
    return mk(rng, "cs_else_if_chain", "2.3", "3.A", STEM_OUT, code, muts=muts, py=r, concept="an if statement followed by a separate if/else-if/else chain: the first test is independent of the chain",
              path="javac+java output vs Python conditional chain", kwhy=f"The first if is independent, so it adds A only when the score is at least 90; the second statement is one chain that adds exactly one of B, C or D. For {s} the result is {r}.", facts=[f"score={s}", f"key={r}"])


# ======================= 2.11 중첩 반복 합계 (3.A) =======================
@retry_any
def cs_nested_triangle(rng):
    n = rng.randint(4, 6)
    code = f"int count = 0;\nfor (int r = 1; r <= {n}; r++) {{\n    for (int c = r; c <= {n}; c++) {{\n        count += r;\n    }}\n}}\nSystem.out.println(count);"
    py = str(sum(r * (n - r + 1) for r in range(1, n + 1)))
    muts = [{"why": "Starts the inner loop at 1 on every pass, so the inner loop always runs the full number of times.", "swap": ("c = r;", "c = 1;")},
            {"why": "Stops the inner loop one value early.", "swap": (f"c <= {n};", f"c < {n};")},
            {"why": "Adds 1 for each inner pass instead of the value of r.", "swap": ("count += r;", "count++;")},
            {"why": "Stops the outer loop one value early.", "swap": (f"r <= {n}; r++", f"r < {n}; r++")}]
    return mk(rng, "cs_nested_triangle", "2.11", "3.A", STEM_OUT, code, muts=muts, py=py, concept="a nested loop whose inner start depends on the outer variable, with a weighted accumulation",
              path="javac+java output vs Python nested sums", kwhy=f"For each r from 1 to {n} the inner loop runs {n} - r + 1 times and adds r each time; the total is {py}.", facts=[f"n={n}", f"key={py}"])


# ======================= 2.11 중첩 반복 시작값 완성 (2.A) =======================
def cs_nested_completion(rng):
    tpl = "class Pairs {\n    /** Returns the number of pairs of positions i < j such that a[i] equals a[j]. */\n    public static int countEqualPairs(int[] a) {\n        int count = 0;\n        for (int i = 0; i < a.length; i++) {\n            for (int j = /*BODY*/; j < a.length; j++) {\n                if (a[i] == a[j]) {\n                    count++;\n                }\n            }\n        }\n        return count;\n    }\n}"
    shown = tpl.replace("/*BODY*/", "/* missing code */")
    cands = [("i + 1", True, None), ("i", False, "Starts at i, so every element is compared with itself and counted."), ("0", False, "Starts at 0, so each pair is counted twice and each element is also compared with itself."), ("1", False, "Starts every inner loop at 1, so pairs are repeated and an element can be compared with itself.")]
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", c), "why": w, "key": k} for c, k, w in cands]
    arrs = [[1, 2, 1], [3, 3, 3], [], [5], [1, 2, 3], [2, 2, 3, 3], [1, 1, 1, 1], [4, 9, 4, 9, 4]]
    tests = [("return Pairs.countEqualPairs(new int[] { " + ", ".join(map(str, a)) + " });", str(sum(1 for i in range(len(a)) for j in range(i + 1, len(a)) if a[i] == a[j]))) for a in arrs]
    return mk_tests(rng, "cs_nested_completion", "2.11", "2.A", "The method countEqualPairs is intended to return the number of pairs of positions i and j, with i < j, whose elements are equal. Which of the following can replace /* missing code */ so that countEqualPairs works as intended?", shown, options, tests,
                    concept="the start value of an inner loop that visits each pair of positions once", path="each candidate compiled and run on arrays with repeated values, an empty array and a one-element array; expected values from Python combinations",
                    kwhy_by_key="Starting the inner index at i + 1 visits every later position once, so each pair is compared exactly once and an element is never compared with itself.")


# ======================= 2.11 반복 시작 횟수 (3.A) =======================
@retry_any
def cs_halving_count(rng):
    n = pick(rng, [16, 32, 64])
    code = f"int count = 0;\nfor (int i = {n}; i >= 1; i /= 2) {{\n    for (int j = 0; j < i; j++) {{\n        count++;\n    }}\n}}\nSystem.out.println(count);"
    py = str(sum(n >> k for k in range(n.bit_length())))
    muts = [{"why": "Believes the outer variable decreases by 1 each pass instead of being halved.", "swap": ("i /= 2", "i--")},
            {"why": "Believes the inner loop runs the starting number of times on every pass.", "swap": ("j < i;", f"j < {n};")},
            {"why": "Counts only the passes of the outer loop.", "swap": ("for (int j = 0; j < i; j++) {\n        count++;\n    }", "count++;")},
            {"why": "Believes the outer loop starts at half of the given value.", "swap": (f"int i = {n};", f"int i = {n // 2};")}]
    return mk(rng, "cs_halving_count", "2.12", "3.A", "How many times is the statement count++ executed as a result of executing the code segment?", code, muts=muts, py=py, concept="statement execution count of a loop whose variable is halved and whose inner loop depends on it",
              path="javac+java output vs Python geometric sum", kwhy=f"The inner loop runs {n}, {n // 2}, ... , 1 times as i is halved; the total is {py}.", facts=[f"n={n}", f"key={py}"])


# ======================= 2.3 조기 반환 (3.C) =======================
SCAN = "class Scan {\n    public static int firstDivisible(int[] a, int k) {\n        for (int i = 0; i < a.length; i++) {\n            if (a[i] % k == 0) {\n                return i;\n            }\n        }\n        return -1;\n    }\n}"


@retry_any
def cs_return_early(rng):
    a = [rng.randint(1, 20) for _ in range(rng.randint(5, 6))]
    k1 = pick(rng, [2, 3, 5]); k2 = pick(rng, [7, 11, 13])
    py_f = lambda k: next((i for i, v in enumerate(a) if v % k == 0), -1)  # noqa: E731
    if py_f(k1) in (-1, 0) or py_f(k2) != -1:
        raise ValueError("ambiguous")
    arr = "{ " + ", ".join(map(str, a)) + " }"
    stm = f"int[] a = {arr};\nSystem.out.println(Scan.firstDivisible(a, {k1}) + \" \" + Scan.firstDivisible(a, {k2}));"
    py = f"{py_f(k1)} {py_f(k2)}"
    muts = [{"why": "Believes the method returns the matching element instead of its index.", "swap": ("return i;", "return a[i];")},
            {"why": "Believes the value returned when nothing matches is 0.", "swap": ("return -1;", "return 0;")},
            {"why": "Reads a[i] % k == 0 as a test for elements that are not divisible.", "swap": ("% k == 0", "% k != 0")},
            {"why": "Believes the loop continues after the return statement and the last match is returned.", "swap": ("for (int i = 0; i < a.length; i++) {\n            if (a[i] % k == 0) {\n                return i;\n            }\n        }\n        return -1;", "int last = -1;\n        for (int i = 0; i < a.length; i++) {\n            if (a[i] % k == 0) {\n                last = i;\n            }\n        }\n        return last;")}]
    return mk(rng, "cs_return_early", "2.3", "3.C", STEM_OUT, SCAN, call=stm, muts=muts, py=py, stim_code=SCAN + "\n\n" + client(stm), concept="a return statement inside a loop ends the method at the first match; the fall-through return gives the default",
              path="javac+java output vs Python next() over the first matching index", kwhy=f"For {k1} the first divisible element is at index {py_f(k1)}, and the method returns at once; no element is divisible by {k2}, so the loop ends and -1 is returned.", facts=[f"a={a}", f"key={py}"])


# ======================= 2.7 while + 나머지 연산 완성 (2.A) =======================
def cs_digit_completion(rng):
    k = rng.randint(3, 5)
    tpl = f"class Digits {{\n    /** Returns the number of digits of n that are greater than {k}. Precondition: n is positive. */\n    public static int countLarge(int n) {{\n        int count = 0;\n        while (n > 0) {{\n/*BODY*/\n        }}\n        return count;\n    }}\n}}"
    shown = tpl.replace("/*BODY*/", "            /* missing code */")
    cands = [(f"if (n % 10 > {k}) {{ count++; }}\n            n /= 10;", True, None),
             (f"if (n > {k}) {{ count++; }}\n            n /= 10;", False, "Compares the whole remaining number with the threshold instead of its last digit."),
             (f"if (n % 10 >= {k}) {{ count++; }}\n            n /= 10;", False, f"Also counts a digit equal to {k}."),
             (f"if (n / 10 > {k}) {{ count++; }}\n            n /= 10;", False, "Tests the number without its last digit instead of the last digit.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "            " + c), "why": w, "key": kk} for c, kk, w in cands]
    ns = [k, k + 1, int(f"{k}{k + 1}{k - 1}"), 9, 1020, 56789, 40404, 900]
    tests = [(f"return Digits.countLarge({n});", str(sum(1 for d in str(n) if int(d) > k))) for n in ns]
    return mk_tests(rng, "cs_digit_completion", "2.7", "2.A", f"The method countLarge is intended to return the number of digits of n that are greater than {k}. Which of the following can replace /* missing code */ so that countLarge works as intended?", shown, options, tests,
                    concept="test the last digit with % 10 and remove it with / 10 inside a while loop", path="each candidate compiled and run on numbers that contain the threshold digit, zeros and several digits; expected values from Python digit scans",
                    kwhy_by_key=f"n % 10 is the last digit, which is counted only when it is strictly greater than {k}; n /= 10 then removes that digit so the loop ends.")


# ======================= 2.10 팰린드롬 완성 (2.A) =======================
def cs_palindrome_completion(rng):
    tpl = "class Words {\n    /** Returns true if s reads the same forward and backward. */\n    public static boolean isPalindrome(String s) {\n        for (int i = 0; i < s.length() / 2; i++) {\n/*BODY*/\n        }\n        return true;\n    }\n}"
    shown = tpl.replace("/*BODY*/", "            /* missing code */")
    same = "s.substring(i, i + 1).equals(s.substring(s.length() - 1 - i, s.length() - i))"
    cands = [(f"if (!{same}) {{ return false; }}", True, None),
             ("if (!s.substring(i, i + 1).equals(s.substring(s.length() - i, s.length() - i + 1))) { return false; }", False, "Compares with the substring that starts at index length - i, which is out of range for i = 0."),
             (f"if ({same}) {{ return false; }}", False, "Returns false when the characters match, which is the opposite of the test."),
             ("if (!s.substring(i, i + 1).equals(s.substring(i + 1, i + 2))) { return false; }", False, "Compares neighboring characters instead of characters at mirrored positions."),
             (f"if (!{same}) {{ return true; }}", False, "Returns true at the first mismatch instead of false.")]
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", "            " + c), "why": w, "key": k} for c, k, w in cands]
    words = ["", "a", "aa", "ab", "level", "abca", "abba", "noon", "abcd", "racecar"]
    tests = [(f'return Words.isPalindrome("{w}");', "true" if w == w[::-1] else "false") for w in words]
    return mk_tests(rng, "cs_palindrome_completion", "2.10", "2.A", "The method isPalindrome is intended to return true if s reads the same forward and backward, and false otherwise. Which of the following can replace /* missing code */ so that isPalindrome works as intended?", shown, options, tests,
                    concept="compare characters at mirrored positions and return false at the first mismatch", path="each candidate compiled and run on palindromes and non-palindromes of even and odd length; expected values from Python reversal",
                    kwhy_by_key="It compares the character at index i with the character at index length - 1 - i, and returns false as soon as they differ; if the loop finishes, every mirrored pair matched.")


# ======================= 2.9 유클리드 호제법 완성 (2.A) =======================
def cs_gcd_completion(rng):
    tpl = "class Numbers {\n    /** Returns the greatest common divisor of a and b. Precondition: a and b are not both 0 and are not negative. */\n    public static int gcd(int a, int b) {\n        while (b != 0) {\n/*BODY*/\n        }\n        return a;\n    }\n}"
    shown = tpl.replace("/*BODY*/", "            /* missing code */")
    cands = [("int t = b;\n            b = a % b;\n            a = t;", True, None),
             ("a = b;\n            b = a % b;", False, "Overwrites a before the remainder is computed, so b becomes 0 after one pass."),
             ("b = a % b;\n            a = b;", False, "Copies the new remainder into a, so the value to return is lost."),
             ("a = a % b;\n            b = a;", False, "Replaces both values with the remainder.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "            " + c), "why": w, "key": k} for c, k, w in cands]
    pairs = [(12, 8), (7, 3), (9, 9), (0, 5), (18, 12), (5, 0), (100, 75)]
    tests = [(f"return Numbers.gcd({a}, {b});", str(math.gcd(a, b))) for a, b in pairs]
    return mk_tests(rng, "cs_gcd_completion", "2.9", "2.A", "The method gcd is intended to return the greatest common divisor of a and b using repeated remainders. Which of the following can replace /* missing code */ so that gcd works as intended?", shown, options, tests,
                    concept="Euclid's algorithm: replace (a, b) with (b, a % b) using a temporary variable", path="each candidate compiled and run on coprime, equal, zero and ordinary pairs; expected values from Python math.gcd",
                    kwhy_by_key="The old b is saved in t, b becomes the remainder of a divided by b, and a becomes the saved b; the loop ends with the greatest common divisor in a.")


# ======================= 2.8 반복 경계 오류 수정 (3.D) =======================
def cs_loop_bug_fix(rng):
    tpl = "class Series {\n    /** Returns the sum of the integers from lo through hi, inclusive. Precondition: lo <= hi. */\n    public static int sumRange(int lo, int hi) {\n        int sum = 0;\n/*BODY*/\n        return sum;\n    }\n}"
    buggy = "        for (int i = lo; i < hi; i++) {\n            sum += i;\n        }"
    shown = tpl.replace("/*BODY*/", buggy)
    cands = [("        for (int i = lo; i <= hi; i++) {\n            sum += i;\n        }", True, None),
             ("        for (int i = lo; i <= hi + 1; i++) {\n            sum += i;\n        }", False, "Runs one value too far and also adds hi + 1."),
             ("        for (int i = lo + 1; i < hi; i++) {\n            sum += i;\n        }", False, "Skips both ends of the range."),
             ("        for (int i = lo; i < hi; i++) {\n            sum += i + 1;\n        }", False, "Adds one more than each value, so the sum starts at lo + 1 instead of lo.")]
    options = [{"text": f"```\n{c.strip(chr(10))}\n```", "source": tpl.replace("/*BODY*/", c), "why": w, "key": k} for c, k, w in cands]
    pairs = [(1, 5), (3, 3), (0, 4), (-2, 2), (5, 6)]
    tests = [(f"return Series.sumRange({a}, {b});", str(sum(range(a, b + 1)))) for a, b in pairs]
    chk = J.java_eval(tpl.replace("/*BODY*/", buggy), [("ret", c) for c, _ in tests])
    if all(J.tidy(r) == e for r, (_, e) in zip(chk, tests)):
        raise ValueError("buggy_original_passes_all_tests")
    return mk_tests(rng, "cs_loop_bug_fix", "2.8", "3.D", "The method sumRange is intended to return the sum of the integers from lo through hi, inclusive. The method does not work as intended. Which of the following replaces the loop in the method so that it works as intended?", shown, options, tests,
                    concept="correct an off-by-one loop bound for an inclusive range", path="the shown buggy method fails the tests; each candidate fix compiled and run, only one passes all",
                    kwhy_by_key="Using <= makes the loop include hi, so every integer from lo through hi is added exactly once.")


# ======================= 2.10 문자열 반복 추적 (3.C) =======================
SPLIT = "class Splitter {\n    public static String split(String s) {\n        String front = \"\";\n        String back = \"\";\n        for (int i = 0; i < s.length(); i++) {\n            String ch = s.substring(i, i + 1);\n            if (\"aeiou\".indexOf(ch) >= 0) {\n                front += ch;\n            } else {\n                back += ch;\n            }\n        }\n        return front + \"-\" + back;\n    }\n}"


@retry_any
def cs_string_loop_trace(rng):
    w = pick(rng, ["education", "calendar", "algebra", "banana", "computer", "variable", "alphabet", "database"])
    fr = "".join(c for c in w if c in "aeiou"); bk = "".join(c for c in w if c not in "aeiou")
    py = f"{fr}-{bk}"
    muts = [{"why": "Believes += on a String puts the new character in front of the existing text.", "swap": ("front += ch;", "front = ch + front;")},
            {"why": "Uses > 0 for the indexOf test, so the vowel a, which is at index 0 of the vowel list, is treated as a consonant.", "swap": ('indexOf(ch) >= 0', 'indexOf(ch) > 0')},
            {"why": "Believes the consonants are collected in reverse order.", "swap": ("back += ch;", "back = ch + back;")},
            {"why": "Reads the returned expression as the consonants followed by the vowels.", "swap": ('return front + "-" + back;', 'return back + "-" + front;')}]
    return mk(rng, "cs_string_loop_trace", "2.10", "3.C", f"What is returned by the call Splitter.split(\"{w}\")?", SPLIT, call=f'return Splitter.split("{w}");', muts=muts, py=py, concept="a String loop that appends each character to one of two accumulators and the order of the pieces",
              path="javac+java return value vs Python vowel and consonant filters", kwhy=f"The vowels of {w}, in order, are {fr}; the other letters, in order, are {bk}; the method joins them with a dash.", facts=[f"w={w}", f"key={py}"])


# ======================= 2문항 세트: 문자열 루프 (추적 + 동작 설명) =======================
B.FAMILIES["first_char"] = ("public static int mystery(String s) {\n        int c = 0;\n        for (int i = 1; i < s.length(); i++) {\n            if (s.substring(i, i + 1).equals(s.substring(0, 1))) {\n                c++;\n            }\n        }\n        return c;\n    }", "String",
                           [("the number of characters after the first that are equal to the first character", lambda s: sum(1 for ch in s[1:] if ch == s[0]) if s else 0, None),
                            ("the number of times the first character appears in s", lambda s: s.count(s[0]) if s else 0, "Believes the loop also counts the character at index 0."),
                            ("the number of characters that are different from the first character", lambda s: sum(1 for ch in s[1:] if ch != s[0]) if s else 0, "Believes the condition is true when the characters differ."),
                            ("the number of different characters in s", lambda s: len(set(s)), "Believes the counter increases for each new letter it meets.")],
                           ["abaca", "xyz", "aaaa", "", "a", "tattoo", "level", "mississippi"])


@retry_any
def css_loop_set(rng):
    """세트: 같은 문자열 메서드 — (1) 구체적 문자열의 반환값, (2) 동작 설명."""
    code, kind, descs, tests = B.FAMILIES["first_char"]
    cls = f"class Probe {{\n    {code}\n}}"
    w = "".join(rng.choice("abc") for _ in range(rng.randint(6, 8)))
    py = str(sum(1 for ch in w[1:] if ch == w[0]))
    if not 1 <= int(py) <= 4:
        raise ValueError("ambiguous")
    muts = [{"why": "Counts the occurrences of the first character including the one at index 0.", "call": f'return Probe.mystery("{w}") + 1;'},
            {"why": "Counts the characters that differ from the first character.", "call": f'return {len(w) - 1} - Probe.mystery("{w}");'},
            {"why": "Counts the other characters that equal the last character, instead of those that equal the first character.", "call": f'return Probe.mystery(new StringBuilder("{w}").reverse().toString());'},
            {"why": "Stops counting at the first character that differs from the first character.", "call": f'String w = "{w}"; int c = 0; for (int i = 1; i < w.length(); i++) {{ if (w.substring(i, i + 1).equals(w.substring(0, 1))) {{ c++; }} else {{ break; }} }} return c;'}]
    q1 = mk(rng, "css_loop_set_q1", "2.10", "3.C", f"What is returned by the call Probe.mystery(\"{w}\")?", cls, call=f'return Probe.mystery("{w}");', muts=muts, py=py, stim_code=False, concept="trace a String scan on a concrete string", path="javac+java return value vs Python count",
            kwhy=f"The loop starts at index 1 and counts each character equal to the first character, which is {w[0]}; there are {py} of them.", facts=[f"w={w}", f"key={py}"])
    q2 = B._describe(rng, "first_char", "css_loop_set_q2", stim=False, topic="2.10", skill="4.A")
    return set_pack("css_loop_set", "Consider the following method, which examines a String and returns an int result.", cls, [q1, q2], "2.10", "3.C")
