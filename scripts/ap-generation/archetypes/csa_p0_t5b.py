"""AP Computer Science A 원형 — CS4·CS5 5세트 채우기용 신규 문항 2부(2026-10-21): 단원 1·2 코드 완성, 단원 1·2·3 실행 추적, 단원 2·3 코드 이해(전제·설명).
정답은 모두 Java 로 컴파일·실행한 결과이고, 추적 문항은 독립 Python 참조가 값을 다시 계산한다. 같은 개념이라도 자료·조건·요구 과제가 공개 문항과 달라야 한다."""
import math
from csa_common import *  # noqa: F401,F403
from common import Opt  # noqa: F401
from csa_p0_a import pick, STEM_OUT
from csa_p0_e import retry_any
from csa_p0_x1 import _text_item
from csa_p0_t5a import _comp, _add
import csa_java as J


def _show(call):
    """클래스 추적 문항의 본문에 보여 줄 호출 코드: 마지막 return 문을 출력 문으로 바꾼다(문제 본문에 코드 표기, 검토기 지적)."""
    lines = call.strip().split("\n")
    last = lines[-1]
    if last.startswith("return "):
        lines[-1] = "System.out.println(" + last[len("return "):].rstrip(";") + ");"
    return "```java\n" + "\n".join(lines) + "\n```"


STEM_SHOW = "What is printed as a result of executing the following code segment?\n"


# ===================== 단원 1 코드 완성 (Practice 2) =====================
_add("cs_str_initials", "1.15",
     "class NameTools {\n    /** Returns the initials of first and last, each followed by a period, for example \"J.S.\". Assume both Strings are not empty and begin with an uppercase letter. */\n    public static String initials(String first, String last) {\n/*BODY*/\n    }\n}",
     "The method initials is intended to return the first letter of first and the first letter of last, each followed by a period. Which of the following can replace /* missing code */ so that initials works as intended?",
     [("return first.substring(0, 1) + \".\" + last.substring(0, 1) + \".\";", True, None),
      ("return first.substring(0) + \".\" + last.substring(0) + \".\";", False, "substring(0) returns the whole String, not just the first letter."),
      ("return first.substring(1, 2) + \".\" + last.substring(1, 2) + \".\";", False, "Takes the second letter of each name instead of the first."),
      ("return last.substring(0, 1) + \".\" + first.substring(0, 1) + \".\";", False, "Reverses the order of the two initials.")],
     [("return NameTools.initials(\"Jane\", \"Smith\");", "J.S."), ("return NameTools.initials(\"Al\", \"Wu\");", "A.W."), ("return NameTools.initials(\"Maria\", \"Lopez\");", "M.L.")],
     "extract the first letter of a String with substring", "substring(0, 1) returns the first character as a String, and the initials are joined in the required order.", "each candidate compiled and run on three name pairs")
_add("cs_math_distance", "1.11",
     "class GeoTools {\n    /** Returns the distance between the points (x1, y1) and (x2, y2). */\n    public static double distance(int x1, int y1, int x2, int y2) {\n/*BODY*/\n    }\n}",
     "The method distance is intended to return the straight-line distance between the points (x1, y1) and (x2, y2). Which of the following can replace /* missing code */ so that distance works as intended?",
     [("return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));", True, None),
      ("return Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);", False, "Returns the squared distance because the square root is missing."),
      ("return Math.sqrt(Math.pow(x2 - x1 + y2 - y1, 2));", False, "Adds the differences before squaring, so it returns the absolute value of the sum of the differences."),
      ("return Math.sqrt(Math.abs(x2 - x1) + Math.abs(y2 - y1));", False, "Takes the square root of the sum of the absolute differences instead of the sum of their squares.")],
     [("return GeoTools.distance(0, 0, 3, 4);", "5.0"), ("return GeoTools.distance(1, 1, 4, 5);", "5.0"), ("return GeoTools.distance(2, 3, 2, 3);", "0.0"), ("return GeoTools.distance(0, 0, 6, 8);", "10.0")],
     "use Math.sqrt and Math.pow to compute a distance", "The distance is the square root of the sum of the squared coordinate differences.", "each candidate compiled and run on points with distances 0, 5 and 10")
_add("cs_round_tenth", "1.7",
     "class NumTools {\n    /** Returns x rounded to the nearest tenth, for example 2.36 gives 2.4. Assume x is positive. */\n    public static double roundTenth(double x) {\n/*BODY*/\n    }\n}",
     "The method roundTenth is intended to return the positive value x rounded to the nearest tenth. Which of the following can replace /* missing code */ so that roundTenth works as intended?",
     [("return Math.round(x * 10) / 10.0;", True, None),
      ("return Math.round(x) / 10.0;", False, "Rounds to a whole number first and then divides by 10."),
      ("return (int) (x * 10) / 10.0;", False, "A cast to int truncates instead of rounding."),
      ("return Math.round(x * 10) / 10;", False, "Dividing a long by the int 10 is integer division, so the tenths are lost.")],
     [("return NumTools.roundTenth(2.36);", "2.4"), ("return NumTools.roundTenth(5.0);", "5.0"), ("return NumTools.roundTenth(3.14);", "3.1"), ("return NumTools.roundTenth(0.96);", "1.0")],
     "round to a decimal place with Math.round and a double divisor", "Scaling by 10, rounding, and dividing by 10.0 keeps one decimal place.", "each candidate compiled and run on values that distinguish rounding from truncation")
_add("cs_tens_digit", "1.9",
     "class NumTools {\n    /** Returns the tens digit of n, where n is a non-negative integer. For example, the tens digit of 345 is 4 and of 7 is 0. */\n    public static int tensDigit(int n) {\n/*BODY*/\n    }\n}",
     "The method tensDigit is intended to return the tens digit of the non-negative integer n. Which of the following can replace /* missing code */ so that tensDigit works as intended?",
     [("return (n / 10) % 10;", True, None),
      ("return n % 10;", False, "Returns the ones digit."),
      ("return n / 10;", False, "Returns all digits except the ones digit."),
      ("return (n % 100) / 100;", False, "Divides a number less than 100 by 100, which is always 0 in integer arithmetic.")],
     [("return NumTools.tensDigit(345);", "4"), ("return NumTools.tensDigit(7);", "0"), ("return NumTools.tensDigit(1234);", "3"), ("return NumTools.tensDigit(90);", "9")],
     "extract a digit with integer division and remainder", "Dividing by 10 drops the ones digit, and the remainder by 10 then isolates the tens digit.", "each candidate compiled and run on numbers with one to four digits")
# ===================== 단원 2 코드 완성 (Practice 2) =====================
_add("cs_count_multiples", "2.9",
     "class LoopTools {\n    /** Returns how many of the integers from 1 through n (inclusive) are multiples of k. Assume n >= 0 and k > 0. */\n    public static int countMultiples(int n, int k) {\n        int count = 0;\n/*BODY*/\n        return count;\n    }\n}",
     "The method countMultiples is intended to return how many of the integers from 1 through n, inclusive, are multiples of k. Which of the following can replace /* missing code */ so that countMultiples works as intended?",
     [("for (int i = 1; i <= n; i++) {\n    if (i % k == 0) {\n        count++;\n    }\n}", True, None),
      ("for (int i = 1; i < n; i++) {\n    if (i % k == 0) {\n        count++;\n    }\n}", False, "Stops before n, so n is not counted when it is a multiple of k."),
      ("for (int i = 1; i <= n; i++) {\n    if (i % k == 1) {\n        count++;\n    }\n}", False, "Counts values that leave a remainder of 1 instead of a remainder of 0."),
      ("for (int i = 1; i <= n; i++) {\n    if (i % k == 0) {\n        count += i;\n    }\n}", False, "Adds the multiples to count instead of counting them.")],
     [("return LoopTools.countMultiples(10, 3);", "3"), ("return LoopTools.countMultiples(12, 4);", "3"), ("return LoopTools.countMultiples(0, 5);", "0"), ("return LoopTools.countMultiples(7, 1);", "7")],
     "count values that satisfy a divisibility condition in an inclusive range", "The loop must include n and test i % k == 0.", "each candidate compiled and run with n as a multiple of k and with k = 1")
_add("cs_vowel_count", "2.10",
     "class WordTools {\n    /** Returns the number of lowercase vowels (a, e, i, o, u) in s. */\n    public static int countVowels(String s) {\n        int count = 0;\n/*BODY*/\n        return count;\n    }\n}",
     "The method countVowels is intended to return the number of lowercase vowels (a, e, i, o, u) in the String s. Which of the following can replace /* missing code */ so that countVowels works as intended?",
     [("for (int i = 0; i < s.length(); i++) {\n    char c = s.charAt(i);\n    if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u') {\n        count++;\n    }\n}", True, None),
      ("for (int i = 0; i < s.length(); i++) {\n    char c = s.charAt(i);\n    if (c == 'a' && c == 'e' && c == 'i' && c == 'o' && c == 'u') {\n        count++;\n    }\n}", False, "Uses && so a character would have to equal every vowel at once, and nothing is counted."),
      ("for (int i = 0; i < s.length(); i++) {\n    char c = s.charAt(i);\n    if (c != 'a' && c != 'e' && c != 'i' && c != 'o' && c != 'u') {\n        count++;\n    }\n}", False, "Counts the characters that are not vowels."),
      ("for (int i = 1; i < s.length(); i++) {\n    char c = s.charAt(i);\n    if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u') {\n        count++;\n    }\n}", False, "Starts at index 1, so a vowel at index 0 is skipped.")],
     [("return WordTools.countVowels(\"education\");", "5"), ("return WordTools.countVowels(\"xyz\");", "0"), ("return WordTools.countVowels(\"aeiou\");", "5"), ("return WordTools.countVowels(\"apple\");", "2"), ("return WordTools.countVowels(\"\");", "0")],
     "traverse a String and test a character against several values", "Each character is compared with each vowel using ||, and every index from 0 is examined.", "each candidate compiled and run with a leading vowel, no vowels and an empty String")
_add("cs_gcd_loop", "2.10",
     "class LoopTools {\n    /** Returns the greatest common divisor of a and b, where a >= 0 and b >= 0 and they are not both 0. */\n    public static int gcd(int a, int b) {\n/*BODY*/\n    }\n}",
     "The method gcd is intended to return the greatest common divisor of the non-negative ints a and b. Which of the following can replace /* missing code */ so that gcd works as intended?",
     [("while (b != 0) {\n    int r = a % b;\n    a = b;\n    b = r;\n}\nreturn a;", True, None),
      ("while (b != 0) {\n    a = b;\n    b = a % b;\n}\nreturn a;", False, "Overwrites a before computing a % b, so the remainder is always 0 after one pass."),
      ("while (b != 0) {\n    int r = a % b;\n    a = b;\n    b = r;\n}\nreturn b;", False, "Returns b, which is always 0 when the loop ends."),
      ("while (a != 0) {\n    int r = a % b;\n    a = b;\n    b = r;\n}\nreturn a;", False, "Tests the wrong variable, so it divides by zero or ends early.")],
     [("return LoopTools.gcd(12, 18);", "6"), ("return LoopTools.gcd(7, 13);", "1"), ("return LoopTools.gcd(20, 5);", "5"), ("return LoopTools.gcd(9, 0);", "9")],
     "complete the loop of Euclid's algorithm", "Each pass replaces (a, b) with (b, a % b) using a temporary remainder, and a holds the result when b is 0.", "each candidate compiled and run on coprime, multiple and zero inputs")
_add("cs_terms_before_limit", "2.9",
     "class LoopTools {\n    /** Adds 1, 2, 3, ... in order and returns how many numbers can be added before the running total would exceed limit. Assume limit >= 0. */\n    public static int termsWithin(int limit) {\n        int total = 0;\n        int next = 1;\n/*BODY*/\n    }\n}",
     "The method termsWithin is intended to add the numbers 1, 2, 3, ... in order and return how many numbers can be added before the running total would exceed limit. Which of the following can replace /* missing code */ so that termsWithin works as intended?",
     [("while (total + next <= limit) {\n    total += next;\n    next++;\n}\nreturn next - 1;", True, None),
      ("while (total + next < limit) {\n    total += next;\n    next++;\n}\nreturn next - 1;", False, "Stops when the total would equal limit, which is still allowed."),
      ("while (total <= limit) {\n    total += next;\n    next++;\n}\nreturn next - 1;", False, "Adds one term after the total has already reached the limit, so the total can exceed it."),
      ("while (total + next <= limit) {\n    total += next;\n    next++;\n}\nreturn next;", False, "Returns the next number to add instead of the count of numbers added.")],
     [("return LoopTools.termsWithin(10);", "4"), ("return LoopTools.termsWithin(0);", "0"), ("return LoopTools.termsWithin(1);", "1"), ("return LoopTools.termsWithin(15);", "5"), ("return LoopTools.termsWithin(14);", "4")],
     "write a while loop whose condition looks ahead to the next addition", "The condition must test total + next so the limit is not exceeded, and next - 1 is the number of terms added.", "each candidate compiled and run with limits equal to and just below a triangular number")
_add("cs_repeat_each_char", "2.10",
     "class WordTools {\n    /** Returns a String in which each character of s appears n times in a row, for example repeatEach(\"ab\", 3) returns \"aaabbb\". */\n    public static String repeatEach(String s, int n) {\n        String r = \"\";\n/*BODY*/\n        return r;\n    }\n}",
     "The method repeatEach is intended to return a String in which each character of s is repeated n times in a row. Which of the following can replace /* missing code */ so that repeatEach works as intended?",
     [("for (int i = 0; i < s.length(); i++) {\n    for (int k = 0; k < n; k++) {\n        r += s.charAt(i);\n    }\n}", True, None),
      ("for (int k = 0; k < n; k++) {\n    r += s;\n}", False, "Repeats the whole String n times instead of repeating each character."),
      ("for (int i = 0; i < s.length(); i++) {\n    for (int k = 1; k < n; k++) {\n        r += s.charAt(i);\n    }\n}", False, "The inner loop runs n - 1 times, so each character appears one time too few."),
      ("for (int i = 0; i < s.length(); i++) {\n    for (int k = 0; k < n; k++) {\n        r = s.charAt(i) + r;\n    }\n}", False, "Adds each character at the front, which reverses the order of the characters.")],
     [("return WordTools.repeatEach(\"ab\", 3);", "aaabbb"), ("return WordTools.repeatEach(\"x\", 1);", "x"), ("return WordTools.repeatEach(\"hi\", 2);", "hhii"), ("return WordTools.repeatEach(\"abc\", 2);", "aabbcc")],
     "nested loops that build a String", "The outer loop visits each character and the inner loop appends it n times.", "each candidate compiled and run on several strings and repeat counts")
_add("cs_grade_letter", "2.4",
     "class GradeTools {\n    /** Returns \"A\" if score is at least 90, \"B\" if it is at least 80, \"C\" if it is at least 70, and \"F\" otherwise. */\n    public static String grade(int score) {\n/*BODY*/\n    }\n}",
     "The method grade is intended to return \"A\" for a score of at least 90, \"B\" for at least 80, \"C\" for at least 70, and \"F\" otherwise. Which of the following can replace /* missing code */ so that grade works as intended?",
     [("if (score >= 90) {\n    return \"A\";\n} else if (score >= 80) {\n    return \"B\";\n} else if (score >= 70) {\n    return \"C\";\n}\nreturn \"F\";", True, None),
      ("if (score > 90) {\n    return \"A\";\n} else if (score > 80) {\n    return \"B\";\n} else if (score > 70) {\n    return \"C\";\n}\nreturn \"F\";", False, "Uses > so a score exactly on a boundary receives the lower grade."),
      ("if (score >= 70) {\n    return \"C\";\n} else if (score >= 80) {\n    return \"B\";\n} else if (score >= 90) {\n    return \"A\";\n}\nreturn \"F\";", False, "Tests the lowest cutoff first, so every score of 70 or more returns \"C\"."),
      ("if (score >= 90) {\n    return \"A\";\n} else if (score >= 80) {\n    return \"B\";\n}\nreturn \"C\";", False, "Has no case for scores below 70, which should return \"F\".")],
     [("return GradeTools.grade(95);", "A"), ("return GradeTools.grade(90);", "A"), ("return GradeTools.grade(89);", "B"), ("return GradeTools.grade(80);", "B"), ("return GradeTools.grade(75);", "C"), ("return GradeTools.grade(69);", "F")],
     "order and boundaries of a multiway selection", "Testing from the highest cutoff down with >= gives each score exactly one grade.", "each candidate compiled and run on scores at and just below each cutoff")


# ===================== 실행 추적 (Practice 3) =====================
def _pyint(a):
    return int(a)


@retry_any
def cs_compound_chain(rng):
    a, p, q, r, s = rng.randint(10, 30), rng.randint(2, 6), rng.randint(2, 4), rng.randint(3, 9), rng.randint(2, 5)
    code = f"int a = {a};\na += {p};\na *= {q};\na -= {r};\na /= {s};\na %= 5;\nSystem.out.println(a);"
    v = a + p; v *= q; v -= r
    if v <= 0:
        raise ValueError("ambiguous")
    v //= s; v %= 5
    muts = [{"why": "Reads a compound multiplication as an addition.", "swap": (f"a *= {q};", f"a += {q};")},
            {"why": "Reads a %= 5 as a division by 5.", "swap": ("a %= 5;", "a /= 5;")},
            {"why": "Reads a -= r as a = r - a (reversed subtraction).", "swap": (f"a -= {r};", f"a = {r} - a;")},
            {"why": "Reads a /= s as a multiplication.", "swap": (f"a /= {s};", f"a *= {s};")}]
    return mk(rng, "cs_compound_chain", "1.6", "3.A", STEM_OUT, code, muts=muts, py=str(v), concept="a sequence of compound assignment operators, including integer division and remainder",
              path="javac+java output vs Python integer arithmetic", kwhy="Each compound assignment updates a using its old value; /= truncates and %= keeps the remainder.")


@retry_any
def cs_incr_decr(rng):
    x = rng.randint(3, 9)
    code = f"int x = {x};\nint y = x++ + ++x;\nx--;\nSystem.out.println(x + \" \" + y);"
    y = x + (x + 2)
    py = f"{x + 1} {y}"
    muts = [{"why": "Believes x++ and ++x give the same value in an expression and the order does not matter.", "swap": ("int y = x++ + ++x;", "int y = ++x + x++;")},
            {"why": "Ignores the final decrement.", "swap": ("x--;", "")},
            {"why": "Believes the increments are applied after the expression, so y is x + x.", "swap": ("int y = x++ + ++x;", "int y = x + x; x += 2;")},
            {"why": "Reads x-- as subtracting 2.", "swap": ("x--;", "x -= 2;")}]
    return mk(rng, "cs_incr_decr", "1.6", "3.A", STEM_OUT, code, muts=muts, py=py, concept="post-increment and pre-increment inside one expression",
              path="javac+java output vs Python evaluation order", kwhy=f"x++ yields {x} and then x becomes {x + 1}; ++x makes x {x + 2} and yields {x + 2}; so y is {y}; x-- leaves {x + 1}.")


@retry_any
def cs_math_functions(rng):
    b, c, d = rng.randint(2, 4), rng.randint(2, 4), rng.choice([16, 25, 36, 49, 64])
    if b == c:
        raise ValueError("ambiguous")
    n = rng.randint(2, 9)
    code = f"int a = -{n};\nint b = {b};\nint c = {c};\nint d = {d};\nSystem.out.println(Math.abs(a) + \" \" + Math.pow(b, c) + \" \" + Math.sqrt(d));"
    py = f"{n} {float(b ** c)} {float(math.isqrt(d))}"
    muts = [{"why": "Believes Math.pow returns an int, so no decimal point is printed.", "swap": ("Math.pow(b, c)", "(int) Math.pow(b, c)")},
            {"why": "Believes Math.abs leaves a negative number unchanged.", "swap": ("Math.abs(a)", "a")},
            {"why": "Reads Math.sqrt(d) as d divided by 2.", "swap": ("Math.sqrt(d)", "d / 2.0")},
            {"why": "Swaps the base and the exponent in Math.pow.", "swap": ("Math.pow(b, c)", "Math.pow(c, b)")}]
    return mk(rng, "cs_math_functions", "1.11", "3.A", STEM_OUT, code, muts=muts, py=py, concept="Math.abs, Math.pow and Math.sqrt return values and their double results",
              path="javac+java output vs Python math", kwhy=f"Math.abs(-{n}) is {n}; Math.pow({b}, {c}) is the double {float(b ** c)}; Math.sqrt({d}) is the double {float(math.isqrt(d))}.")


@retry_any
def cs_concat_numbers(rng):
    a, b, c, d = rng.randint(1, 9), rng.randint(1, 9), rng.randint(1, 9), rng.randint(1, 9)
    code = f"System.out.println({a} + {b} + \"x\" + {c} + {d});"
    py = f"{a + b}x{c}{d}"
    muts = [{"why": "Believes the numbers before the String are joined as text instead of added.", "swap": (f"{a} + {b} + \"x\"", f"\"\" + {a} + {b} + \"x\"")},
            {"why": "Believes the numbers after the String are added before they are joined.", "swap": (f"{c} + {d});", f"({c} + {d}));")},
            {"why": "Believes the numbers on both sides of the String are added.", "swap": (f"{a} + {b} + \"x\" + {c} + {d}", f"{a} + {b} + \"x\" + ({c} + {d})")},
            {"why": "Believes the String is ignored when the operands are numbers.", "swap": (f"{a} + {b} + \"x\" + {c} + {d}", f"{a} + {b} + {c} + {d}")}]
    return mk(rng, "cs_concat_numbers", "1.3", "3.A", STEM_OUT, code, muts=muts, py=py, concept="the + operator adds two ints but concatenates once an operand is a String (left to right)",
              path="javac+java output vs Python left-to-right evaluation", kwhy=f"{a} + {b} is {a + b} because both are ints; then the String is attached, and each later number is appended as text.")


@retry_any
def cs_int_double_mix(rng):
    b = rng.choice([2, 4, 5])
    a = rng.randint(7, 29)
    if a % b == 0:
        raise ValueError("ambiguous")
    code = f"int a = {a};\nint b = {b};\ndouble d = a / b;\ndouble e = (double) a / b;\ndouble f = (double) (a / b);\nSystem.out.println(d + \" \" + e + \" \" + f);"
    py = f"{float(a // b)} {a / b} {float(a // b)}"
    muts = [{"why": "Believes storing the result in a double makes the division exact.", "swap": ("double d = a / b;", "double d = (double) a / b;")},
            {"why": "Believes the cast to double is applied after the integer division, so e is the truncated value.", "swap": ("double e = (double) a / b;", "double e = (double) (a / b);")},
            {"why": "Believes the cast in (double) (a / b) makes the division exact.", "swap": ("double f = (double) (a / b);", "double f = (double) a / b;")},
            {"why": "Reads the first division as a remainder.", "swap": ("double d = a / b;", "double d = a % b;")}]
    return mk(rng, "cs_int_double_mix", "1.5", "3.A", STEM_OUT, code, muts=muts, py=py, concept="integer division happens before widening to double unless an operand is cast first",
              path="javac+java output vs Python // and /", kwhy=f"a / b is integer division giving {a // b}, widened to {float(a // b)}; (double) a / b is exact: {a / b}; casting the result of a / b gives {float(a // b)} again.")


def _cmp(a, b):
    for x, y in zip(a, b):
        if x != y:
            return ord(x) - ord(y)
    return len(a) - len(b)


@retry_any
def cs_compare_to_trace(rng):
    pairs = [("apple", "apricot"), ("cat", "car"), ("dog", "dogs"), ("zebra", "zoo"), ("Bird", "bird"), ("mango", "melon"), ("pen", "pencil"), ("sun", "sea")]
    x, y = pick(rng, pairs)
    code = f"String a = \"{x}\";\nString b = \"{y}\";\nSystem.out.println(a.compareTo(b));"
    v = _cmp(x, y)
    if v == 0:
        raise ValueError("ambiguous")
    muts = [{"why": "Believes compareTo returns only -1, 0 or 1.", "swap": ("a.compareTo(b)", "Integer.signum(a.compareTo(b))")},
            {"why": "Reverses the order of the Strings in the comparison.", "swap": ("a.compareTo(b)", "b.compareTo(a)")},
            {"why": "Believes compareTo returns the difference in the lengths of the Strings.", "swap": ("a.compareTo(b)", "a.length() - b.length()")},
            {"why": "Believes compareTo returns the index of the first difference.", "call": f"String a = \"{x}\";\nString b = \"{y}\";\nint i = 0;\nwhile (i < a.length() && i < b.length() && a.charAt(i) == b.charAt(i)) {{\n    i++;\n}}\nSystem.out.println(i);"}]
    return mk(rng, "cs_compare_to_trace", "1.15", "3.A", STEM_OUT, code, muts=muts, py=str(v), concept="String.compareTo returns the difference of the first differing characters, or of the lengths",
              path="javac+java output vs Python lexicographic difference", kwhy="compareTo subtracts the character codes at the first position where the Strings differ; if one is a prefix of the other it returns the difference of the lengths.")


@retry_any
def cs_char_arith_cast(rng):
    ch = chr(ord("a") + rng.randint(0, 20))
    k = rng.randint(2, 5)
    code = f"char c = '{ch}';\nint n = c - 'a' + 1;\nchar d = (char) (c + {k});\nSystem.out.println(n + \" \" + d + \" \" + (int) c);"
    py = f"{ord(ch) - ord('a') + 1} {chr(ord(ch) + k)} {ord(ch)}"
    muts = [{"why": "Believes c - 'a' + 1 is the position counted from 0.", "swap": ("c - 'a' + 1", "c - 'a'")},
            {"why": "Believes adding an int to a char still prints a number when it is cast.", "swap": (f"char d = (char) (c + {k});", f"int d = c + {k};")},
            {"why": "Believes (int) c gives the position of the letter in the alphabet.", "swap": ("(int) c", "(c - 'a' + 1)")},
            {"why": "Believes the shift k is subtracted from the letter.", "swap": (f"(char) (c + {k})", f"(char) (c - {k})")}]
    return mk(rng, "cs_char_arith_cast", "1.5", "3.A", STEM_OUT, code, muts=muts, py=py, concept="char values are integer codes: subtraction gives an int, and a cast converts an int back to a char",
              path="javac+java output vs Python ord/chr", kwhy=f"'{ch}' - 'a' + 1 is {ord(ch) - ord('a') + 1}; adding {k} to the code and casting gives '{chr(ord(ch) + k)}'; (int) c is the code {ord(ch)}.")


@retry_any
def cs_nested_loop_count(rng):
    a, b, m = rng.randint(3, 6), rng.randint(5, 8), rng.randint(2, 4)
    code = f"int count = 0;\nfor (int i = 1; i <= {a}; i++) {{\n    for (int j = i; j <= {b}; j++) {{\n        if ((i + j) % {m} == 0) {{\n            count++;\n        }}\n    }}\n}}\nSystem.out.println(count);"
    v = sum(1 for i in range(1, a + 1) for j in range(i, b + 1) if (i + j) % m == 0)
    muts = [{"why": "Starts the inner loop at 1 instead of at i.", "swap": ("int j = i;", "int j = 1;")},
            {"why": "Tests the product instead of the sum.", "swap": ("(i + j) % " + str(m), "(i * j) % " + str(m))},
            {"why": "Stops the inner loop one value early.", "swap": (f"j <= {b}", f"j < {b}")},
            {"why": "Adds i instead of counting one.", "swap": ("count++;", "count += i;")}]
    return mk(rng, "cs_nested_loop_count", "2.12", "3.A", STEM_OUT, code, muts=muts, py=str(v), concept="counting iterations of nested loops whose inner start depends on the outer variable",
              path="javac+java output vs Python brute force", kwhy="For each i the inner loop runs j from i to the limit, and the count rises whenever i + j is a multiple of the modulus.")


@retry_any
def cs_while_digit_product(rng):
    n = rng.choice([1052, 2034, 3071, 4506, 7083, 9120, 1306, 5072, 8041])
    code = f"int n = {n};\nint p = 1;\nwhile (n > 0) {{\n    int d = n % 10;\n    if (d != 0) {{\n        p *= d;\n    }}\n    n /= 10;\n}}\nSystem.out.println(p);"
    p = 1
    for ch in str(n):
        if ch != "0":
            p *= int(ch)
    muts = [{"why": "Multiplies by every digit, including 0, so the product becomes 0.", "swap": ("if (d != 0) {\n        p *= d;\n    }", "p *= d;")},
            {"why": "Adds each digit to the starting value 1 instead of multiplying by it.", "swap": ("p *= d;", "p += d;")},
            {"why": "Uses the quotient instead of the last digit.", "swap": ("int d = n % 10;", "int d = n / 10 % 10;")},
            {"why": "Starts the product at 0.", "swap": ("int p = 1;", "int p = 0;")}]
    return mk(rng, "cs_while_digit_product", "2.10", "3.A", STEM_OUT, code, muts=muts, py=str(p), concept="a while loop that extracts digits and skips zeros",
              path="javac+java output vs Python digit product", kwhy="Each pass takes the last digit with n % 10, multiplies it in unless it is 0, and removes it with n /= 10.")


@retry_any
def cs_for_step_down(rng):
    a, bnd, c = rng.randint(20, 40), rng.randint(2, 8), rng.randint(3, 6)
    code = f"int total = 0;\nint i;\nfor (i = {a}; i > {bnd}; i -= {c}) {{\n    total += i;\n}}\nSystem.out.println(total + \" \" + i);"
    t, i = 0, a
    while i > bnd:
        t += i; i -= c
    muts = [{"why": "Believes the loop variable is not available after the loop.", "call": f"int total = 0;\nfor (int i = {a}; i > {bnd}; i -= {c}) {{\n    total += i;\n}}\nSystem.out.println(total);"},
            {"why": "Believes the loop stops at the last value that was added, so i keeps that value.", "call": f"int total = 0;\nint i;\nint last = 0;\nfor (i = {a}; i > {bnd}; i -= {c}) {{\n    total += i;\n    last = i;\n}}\nSystem.out.println(total + \" \" + last);"},
            {"why": "Includes the bound in the loop condition.", "swap": (f"i > {bnd}", f"i >= {bnd}")},
            {"why": "Steps by one instead of by the given amount.", "swap": (f"i -= {c}", "i--")}]
    return mk(rng, "cs_for_step_down", "2.8", "3.A", STEM_OUT, code, muts=muts, py=f"{t} {i}", concept="a counting-down for loop with a step, and the value of the loop variable after the loop ends",
              path="javac+java output vs Python while loop", kwhy=f"The loop adds {a}, {a - c}, ... while i > {bnd}; when it stops, i has already been decreased to {i}.")


@retry_any
def cs_boolean_logic_eval(rng):
    a, b, c = rng.sample(range(1, 10), 3)
    code = f"int a = {a};\nint b = {b};\nint c = {c};\nboolean r1 = a > b && b > c || c > a;\nboolean r2 = !(a > b || b > c);\nboolean r3 = !(a > c) && !(b > c);\nSystem.out.println(r1 + \" \" + r2 + \" \" + r3);"
    r1 = (a > b and b > c) or c > a
    r2 = not (a > b or b > c)
    r3 = (not (a > c)) and (not (b > c))
    py = f"{str(r1).lower()} {str(r2).lower()} {str(r3).lower()}"
    muts = [{"why": "Believes || binds tighter than && in the first expression.", "swap": ("a > b && b > c || c > a", "a > b && (b > c || c > a)")},
            {"why": "Applies the ! to only the first comparison in the second expression.", "swap": ("!(a > b || b > c)", "!(a > b) || b > c")},
            {"why": "Reads the && in the third expression as ||.", "swap": ("!(a > c) && !(b > c)", "!(a > c) || !(b > c)")},
            {"why": "Reads the ! in the third expression as having no effect.", "swap": ("!(a > c) && !(b > c)", "(a > c) && (b > c)")}]
    return mk(rng, "cs_boolean_logic_eval", "2.6", "3.A", STEM_OUT, code, muts=muts, py=py, concept="operator precedence of !, &&, and || and negating comparisons",
              path="javac+java output vs Python boolean evaluation", kwhy=f"&& binds tighter than ||, so r1 is {str(r1).lower()}; the ! applies to the whole parenthesized condition in r2, giving {str(r2).lower()}; r3 negates each comparison separately, giving {str(r3).lower()}.")


@retry_any
def cs_string_filter_trace(rng):
    w = pick(rng, ["MarkEt", "bAnana", "kiTcHen", "lemOn", "pLaNeT", "garDEn", "oCean"])
    code = f"String s = \"{w}\";\nString r = \"\";\nfor (int i = 0; i < s.length(); i++) {{\n    char c = s.charAt(i);\n    if (c >= 'a' && c <= 'm') {{\n        r += c;\n    }} else {{\n        r += \"*\";\n    }}\n}}\nSystem.out.println(r);"
    r = "".join(ch if "a" <= ch <= "m" else "*" for ch in w)
    muts = [{"why": "Excludes the letter m from the range.", "swap": ("c <= 'm'", "c < 'm'")},
            {"why": "Replaces the whole result with a star instead of appending one.", "swap": ("r += \"*\";", "r = \"*\";")},
            {"why": "Believes uppercase letters fall inside the lowercase range.", "swap": ("c >= 'a' && c <= 'm'", "c >= 'A' && c <= 'm'")},
            {"why": "Reads the condition with || so every character is kept.", "swap": ("c >= 'a' && c <= 'm'", "c >= 'a' || c <= 'm'")}]
    return mk(rng, "cs_string_filter_trace", "2.10", "3.A", STEM_OUT, code, muts=muts, py=r, concept="traversing a String and testing each char against a character range",
              path="javac+java output vs Python string filter", kwhy="Only lowercase letters from a through m are copied; every other character, including uppercase letters, becomes a star.")


# ---- 단원 3 클래스 추적 ----
@retry_any
def cs_tally_state_trace(rng):
    a = rng.randint(2, 6)
    shown = "class Tally {\n    private int count;\n    private int step;\n    public Tally(int s) {\n        step = s;\n    }\n    public void hit() {\n        count += step;\n        step++;\n    }\n    public int get() {\n        return count;\n    }\n}"
    call = f"Tally t = new Tally({a});\nt.hit();\nt.hit();\nt.hit();\nreturn t.get();"
    v = a + (a + 1) + (a + 2)
    muts = [{"why": "Believes step is not changed by hit, so the same amount is added each time.", "swap": ("step++;", "")},
            {"why": "Believes count is replaced by step instead of increased.", "swap": ("count += step;", "count = step;")},
            {"why": "Believes step decreases after each hit.", "swap": ("step++;", "step--;")},
            {"why": "Believes the constructor also adds the starting step to count.", "swap": ("step = s;", "step = s;\n        count = s;")}]
    return mk(rng, "cs_tally_state_trace", "3.5", "3.B", STEM_SHOW + _show(call), shown, call=call, muts=muts, py=str(v), concept="instance variables keep their updated values across method calls",
              path="javac+java output vs Python state simulation", kwhy=f"The three calls add {a}, {a + 1} and {a + 2} to count, giving {v}.")


@retry_any
def cs_static_counter_trace(rng):
    a = rng.randint(3, 9)
    shown = f"class Ticket {{\n    private static int next = {a};\n    private int id;\n    public Ticket() {{\n        id = next;\n        next++;\n    }}\n    public int getId() {{\n        return id;\n    }}\n    public static int peek() {{\n        return next;\n    }}\n}}"
    call = "Ticket p = new Ticket();\nTicket q = new Ticket();\nTicket r = new Ticket();\nreturn p.getId() + \" \" + r.getId() + \" \" + Ticket.peek();"
    py = f"{a} {a + 2} {a + 3}"
    muts = [{"why": "Believes next is separate for every object, so each id is the starting value.", "swap": ("next++;", "id++;")},
            {"why": "Believes next is increased by 2 for each new object.", "swap": ("next++;", "next += 2;")},
            {"why": "Believes the id is assigned after the shared counter is increased.", "swap": ("id = next;\n        next++;", "next++;\n        id = next;")},
            {"why": "Believes peek returns the id of the last ticket.", "swap": ("return next;", "return next - 1;")}]
    return mk(rng, "cs_static_counter_trace", "3.7", "3.B", STEM_SHOW + _show(call), shown, call=call, muts=muts, py=py, concept="a static variable is shared by all objects of the class",
              path="javac+java output vs Python simulation of a shared counter", kwhy=f"The ids are {a}, {a + 1} and {a + 2}, and the shared counter ends at {a + 3}.")


@retry_any
def cs_alias_box_trace(rng):
    a, b = rng.randint(2, 7), rng.randint(2, 6)
    shown = "class Box {\n    public int v;\n    public Box(int x) {\n        v = x;\n    }\n}"
    call = f"Box a = new Box({a});\nBox b = a;\nb.v += {b};\nBox c = new Box(a.v);\nc.v *= 2;\nreturn a.v + \" \" + b.v + \" \" + c.v;"
    py = f"{a + b} {a + b} {(a + b) * 2}"
    muts = [{"why": "Believes Box b = a creates an independent copy.", "call": f"Box a = new Box({a});\nBox b = new Box(a.v);\nb.v += {b};\nBox c = new Box(a.v);\nc.v *= 2;\nreturn a.v + \" \" + b.v + \" \" + c.v;"},
            {"why": "Believes new Box(a.v) is another reference to a.", "call": f"Box a = new Box({a});\nBox b = a;\nb.v += {b};\nBox c = a;\nc.v *= 2;\nreturn a.v + \" \" + b.v + \" \" + c.v;"},
            {"why": "Believes b is a separate copy of a but builds c from b.", "call": f"Box a = new Box({a});\nBox b = new Box(a.v);\nb.v += {b};\nBox c = new Box(b.v);\nc.v *= 2;\nreturn a.v + \" \" + b.v + \" \" + c.v;"},
            {"why": "Reads c.v *= 2 as adding 2.", "call": f"Box a = new Box({a});\nBox b = a;\nb.v += {b};\nBox c = new Box(a.v);\nc.v += 2;\nreturn a.v + \" \" + b.v + \" \" + c.v;"}]
    return mk(rng, "cs_alias_box_trace", "3.6", "3.B", STEM_SHOW + _show(call), shown, call=call, muts=muts, py=py, concept="two variables can refer to the same object, while new creates a separate object",
              path="javac+java output vs Python reference semantics", kwhy="b is another name for the object that a refers to, so the change appears through both; c is a separate object created from a's value.")


@retry_any
def cs_param_pass_trace(rng):
    a, b = rng.randint(3, 9), rng.randint(2, 8)
    shown = "class Calc {\n    public static int twice(int x) {\n        x = x * 2;\n        return x;\n    }\n    public static void bump(int[] arr) {\n        arr[0]++;\n    }\n}"
    call = f"int n = {a};\nint m = Calc.twice(n);\nint[] arr = {{{b}}};\nCalc.bump(arr);\nreturn n + \" \" + m + \" \" + arr[0];"
    py = f"{a} {a * 2} {b + 1}"
    muts = [{"why": "Believes the method changes the caller's int variable n.", "call": f"int n = {a};\nint m = Calc.twice(n);\nn = m;\nint[] arr = {{{b}}};\nCalc.bump(arr);\nreturn n + \" \" + m + \" \" + arr[0];"},
            {"why": "Believes the method cannot change the contents of an array that is passed to it.", "call": f"int n = {a};\nint m = Calc.twice(n);\nint[] arr = {{{b}}};\nreturn n + \" \" + m + \" \" + arr[0];"},
            {"why": "Believes the call to twice returns the unchanged argument.", "call": f"int n = {a};\nint m = n;\nint[] arr = {{{b}}};\nCalc.bump(arr);\nreturn n + \" \" + m + \" \" + arr[0];"},
            {"why": "Believes bump doubles the element instead of increasing it by one.", "call": f"int n = {a};\nint m = Calc.twice(n);\nint[] arr = {{{b}}};\nCalc.bump(arr);\nreturn n + \" \" + m + \" \" + (arr[0] * 2 - 2);"}]
    return mk(rng, "cs_param_pass_trace", "3.8", "3.B", STEM_SHOW + _show(call), shown, call=call, muts=muts, py=py, concept="a primitive argument is copied, while an array argument shares its contents with the caller",
              path="javac+java output vs Python semantics of pass-by-value", kwhy=f"twice changes only its own copy of n, so n stays {a} and m is {a * 2}; bump changes the shared array element to {b + 1}.")


@retry_any
def cs_constructor_chain_trace(rng):
    a, b = rng.randint(2, 7), rng.randint(2, 9)
    shown = "class Player {\n    private String name;\n    private int pts;\n    public Player(String n) {\n        this(n, 10);\n    }\n    public Player(String n, int p) {\n        name = n;\n        pts = p;\n    }\n    public void award(int d) {\n        pts += d;\n    }\n    public String show() {\n        return name + \":\" + pts;\n    }\n}"
    call = f"Player p = new Player(\"ann\");\np.award({a});\nPlayer q = new Player(\"bo\", {b});\nq.award({a});\nreturn p.show() + \" \" + q.show();"
    py = f"ann:{10 + a} bo:{b + a}"
    muts = [{"why": "Believes the one-argument constructor starts with 0 points.", "swap": ("this(n, 10);", "this(n, 0);")},
            {"why": "Believes award replaces the points instead of adding to them.", "swap": ("pts += d;", "pts = d;")},
            {"why": "Believes the two-argument constructor ignores its second parameter.", "swap": ("pts = p;", "pts = 10;")},
            {"why": "Believes the name and the points are separated by a space in show.", "swap": ("name + \":\" + pts", "name + \" \" + pts")}]
    return mk(rng, "cs_constructor_chain_trace", "3.5", "3.B", STEM_SHOW + _show(call), shown, call=call, muts=muts, py=py, concept="a constructor calling another constructor with this(...), and updating instance state",
              path="javac+java output vs Python simulation", kwhy=f"The one-argument constructor passes 10 points, so ann has {10 + a} after the award; bo starts with {b} and has {b + a}.")


# ===================== 코드 이해: 전제·설명 (Practice 4) =====================
def cs_precondition_middle_two(rng):
    cls = "class Probe {\n    public static String middleTwo(String s) {\n        return s.substring(s.length() / 2 - 1, s.length() / 2 + 1);\n    }\n}"
    res = J.java_eval(cls, [("ret", "return Probe.middleTwo(\"\");"), ("ret", "return Probe.middleTwo(\"a\");"), ("ret", "return Probe.middleTwo(\"ab\");"), ("ret", "return Probe.middleTwo(\"abc\");"), ("ret", "return Probe.middleTwo(\"abcd\");")])
    if "EXC:" not in res[0] or "EXC:" not in res[1] or any("EXC:" in r for r in res[2:]):
        raise ValueError("expectation_failed")
    key = ("s.length() is at least 2.", "Strings of length 0 and 1 make the first index negative or too large, and every String of length 2 or more works.")
    wrongs = [("s.length() is even.", "This is stronger than needed: a String of odd length such as \"abc\" also works."),
              ("s.length() is greater than 2.", "This is stronger than needed: a String of length exactly 2 works."),
              ("s is not the empty String.", "This is necessary but not sufficient: a String of length 1 still throws an exception.")]
    stem = "Which of the following is the weakest precondition (the least restrictive condition) that guarantees the method middleTwo will not throw an exception?"
    return _text_item(rng, "cs_precondition_middle_two", "2.10", "4.B", stem, cls, key, wrongs, "a precondition names the inputs for which the method works", "java runs on Strings of length 0 to 4", ["method=middleTwo"])


def cs_describe_divisors(rng):
    cls = "class Probe {\n    public static int mystery(int n) {\n        int c = 0;\n        for (int i = 1; i <= n; i++) {\n            if (n % i == 0) {\n                c++;\n            }\n        }\n        return c;\n    }\n}"
    vals = [12, 7, 1, 16]
    res = J.java_eval(cls, [("ret", f"return Probe.mystery({v});") for v in vals])
    exp = [sum(1 for i in range(1, v + 1) if v % i == 0) for v in vals]
    if [J.tidy(r) for r in res] != [str(e) for e in exp]:
        raise ValueError("expectation_failed")
    key = ("It returns the number of positive integers that divide n evenly.", f"For n = 12, 7, 1 and 16 it returns {exp[0]}, {exp[1]}, {exp[2]} and {exp[3]}, the counts of divisors.")
    wrongs = [("It returns the sum of the positive integers that divide n evenly.", "For n = 12 the divisors add to 28, but the method returns 6."),
              ("It returns true only when n is prime, as an int.", "A prime n such as 7 returns 2, and a composite n returns a larger number; the method counts divisors."),
              ("It returns the number of digits in n.", "For n = 12 it returns 6, not 2.")]
    stem = "Which of the following best describes the value returned by the method mystery for a positive integer n?"
    return _text_item(rng, "cs_describe_divisors", "2.9", "4.A", stem, cls, key, wrongs, "describe what a counting loop computes", "java runs on 12, 7, 1 and 16", ["method=mystery"])


def cs_describe_even_index_reverse(rng):
    cls = "class Probe {\n    public static String mystery(String s) {\n        String r = \"\";\n        for (int i = s.length() - 1; i >= 0; i--) {\n            if (i % 2 == 0) {\n                r += s.charAt(i);\n            }\n        }\n        return r;\n    }\n}"
    vals = ["abcdef", "hello", "x", ""]
    res = J.java_eval(cls, [("ret", f"return Probe.mystery(\"{v}\");") for v in vals])
    exp = ["".join(v[i] for i in range(len(v) - 1, -1, -1) if i % 2 == 0) for v in vals]
    if [J.tidy(r) for r in res] != exp:
        raise ValueError("expectation_failed")
    key = ("It returns the characters at the even indexes of s, in reverse order.", f"For \"abcdef\" it returns \"{exp[0]}\" and for \"hello\" it returns \"{exp[1]}\".")
    wrongs = [("It returns the characters at the even indexes of s, in their original order.", f"For \"abcdef\" that would be \"ace\", but the method returns \"{exp[0]}\" because the loop runs backward."),
              ("It returns all the characters of s in reverse order.", f"For \"abcdef\" that would be \"fedcba\", but only the characters at even indexes are kept."),
              ("It returns the characters at the odd indexes of s, in reverse order.", f"For \"abcdef\" that would be \"fdb\", but the method keeps the even indexes.")]
    stem = "Which of the following best describes the String returned by the method mystery?"
    return _text_item(rng, "cs_describe_even_index_reverse", "2.10", "4.A", stem, cls, key, wrongs, "describe what a backward traversal with a condition builds", "java runs on four Strings", ["method=mystery"])


def cs_describe_pair_count(rng):
    cls = "class Probe {\n    public static int mystery(int n) {\n        int c = 0;\n        for (int i = 1; i <= n; i++) {\n            for (int j = i + 1; j <= n; j++) {\n                if ((i + j) % 2 == 0) {\n                    c++;\n                }\n            }\n        }\n        return c;\n    }\n}"
    vals = [4, 5, 6, 1]
    res = J.java_eval(cls, [("ret", f"return Probe.mystery({v});") for v in vals])
    exp = [sum(1 for i in range(1, v + 1) for j in range(i + 1, v + 1) if (i + j) % 2 == 0) for v in vals]
    if [J.tidy(r) for r in res] != [str(e) for e in exp]:
        raise ValueError("expectation_failed")
    key = ("It returns the number of pairs i < j between 1 and n whose sum is even.", f"For n = 4, 5, 6 and 1 it returns {exp[0]}, {exp[1]}, {exp[2]} and {exp[3]}.")
    wrongs = [("It returns the number of pairs i < j between 1 and n whose sum is odd.", f"For n = 4 there are 4 such pairs, but the method returns {exp[0]}."),
              ("It returns the number of even numbers between 1 and n.", f"For n = 6 that would be 3, but the method returns {exp[2]}."),
              ("It returns the number of pairs i and j, with i allowed to equal j, whose sum is even.", f"Because j starts at i + 1, pairs with i equal to j are never counted; for n = 4 that count would be 8, not {exp[0]}.")]
    stem = "Which of the following best describes the value returned by the method mystery for a positive integer n?"
    return _text_item(rng, "cs_describe_pair_count", "2.12", "4.A", stem, cls, key, wrongs, "describe what nested loops with a condition count", "java runs on 1, 4, 5 and 6", ["method=mystery"])


def cs_precondition_stack_pop(rng):
    cls = "class Stack {\n    private ArrayList<Integer> items = new ArrayList<Integer>();\n    public void push(int v) {\n        items.add(v);\n    }\n    public int pop() {\n        return items.remove(items.size() - 1);\n    }\n}"
    res = J.java_eval(cls, [("ret", "Stack s = new Stack(); return s.pop();"), ("ret", "Stack s = new Stack(); s.push(4); return s.pop();"), ("ret", "Stack s = new Stack(); s.push(4); s.push(6); return s.pop();"), ("ret", "Stack s = new Stack(); s.push(4); s.pop(); return s.pop();")])
    if "EXC:" not in res[0] or "EXC:" in res[1] or "EXC:" in res[2] or "EXC:" not in res[3]:
        raise ValueError("expectation_failed")
    key = ("The stack contains at least one value.", "pop removes the last element, so it fails only on an empty stack, including after the last value has been popped.")
    wrongs = [("The stack contains at least two values.", "This is stronger than needed: a stack with exactly one value can be popped."),
              ("The stack has had at least one push call.", "This is not enough: after one push and one pop, the stack is empty and a second pop throws an exception."),
              ("The stack contains an even number of values.", "A stack with one value can be popped, and a stack with zero values (an even number) cannot.")]
    stem = "Which of the following is the weakest precondition (the least restrictive condition) that guarantees a call to the method pop will not throw an exception?"
    return _text_item(rng, "cs_precondition_stack_pop", "3.5", "4.B", stem, cls, key, wrongs, "a precondition for a method that depends on object state", "java runs on empty, one-value, two-value and emptied stacks", ["method=pop"])
