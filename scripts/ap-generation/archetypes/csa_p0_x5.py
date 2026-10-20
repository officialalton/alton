"""AP Computer Science A 확대 CS3 — 신규 원형 X5(보충: 도우미 메서드를 쓰는 코드 완성 3, 단원 2 사전·사후조건 2). 2026-10-19."""
from csa_common import *  # noqa: F401,F403
from common import Opt  # noqa: F401
from csa_p0_a import pick
from csa_p0_e import retry_any
from csa_p0_x1 import _text_item
import csa_java as J


def _helper_completion(rng, arch, topic, skill, tpl, cands, tests, stem, concept, path, kwhy, indent="            "):
    options = [{"text": f"`{c}`", "source": tpl.replace("/* missing code */", indent + c), "why": w, "key": k} for c, k, w in cands]
    shown = tpl.replace("/* missing code */", indent + "/* missing code */")
    return mk_tests(rng, arch, topic, skill, stem, shown, options, tests, concept=concept, path=path, kwhy_by_key=kwhy)


@retry_any
def cs_helper_prime_count_completion(rng):
    tpl = "class Primes {\n    /** Returns true if n is a prime number. Precondition: n >= 2. */\n    public static boolean isPrime(int n) {\n        for (int d = 2; d * d <= n; d++) {\n            if (n % d == 0) {\n                return false;\n            }\n        }\n        return true;\n    }\n\n    /** Returns the number of primes in the range from lo through hi, inclusive. Precondition: 2 <= lo <= hi. */\n    public static int countPrimes(int lo, int hi) {\n        int count = 0;\n        for (int n = lo; n <= hi; n++) {\n/* missing code */\n        }\n        return count;\n    }\n}"
    cands = [("if (isPrime(n)) { count++; }", True, None), ("if (isPrime(count)) { count++; }", False, "Tests the running count instead of the loop value n."), ("if (isPrime(n)) { count = n; }", False, "Stores the last prime instead of counting the primes."),
             ("if (!isPrime(n)) { count++; }", False, "Counts the numbers that are not prime."), ("count += isPrime(n);", False, "Does not compile: a boolean cannot be added to an int.")]
    # 마지막 후보는 컴파일이 안 되므로 시험 가능한 다른 오답으로 바꾼다
    cands[4] = ("if (isPrime(n)) { count++; }\n            n++;", False, "Skips the value after each prime, so primes that follow a prime directly are never tested.")
    cases = [(2, 10), (2, 2), (8, 8), (10, 30), (14, 16), (2, 20)]
    py = lambda lo, hi: sum(1 for n in range(lo, hi + 1) if n > 1 and all(n % d for d in range(2, int(n ** 0.5) + 1)))  # noqa: E731
    tests = [(f"return Primes.countPrimes({lo}, {hi});", str(py(lo, hi))) for lo, hi in cases]
    stem = "The method countPrimes is intended to return the number of prime numbers from lo through hi, inclusive, using the helper method isPrime. Which of the following can replace /* missing code */ so that countPrimes works as intended?"
    return _helper_completion(rng, "cs_helper_prime_count_completion", "2.9", "2.C", tpl, cands, tests, stem, "call a boolean helper method inside a loop to count the values that satisfy it", "each candidate compiled and run on ranges vs Python prime count",
                              "The loop tests each value n with the helper and adds one to count exactly when the helper returns true.")


@retry_any
def cs_helper_digit_match_completion(rng):
    k = rng.choice([6, 7, 8, 9, 10])
    tpl = f"class Numbers {{\n    /** Returns the sum of the digits of n. Precondition: n >= 0. */\n    public static int digitSum(int n) {{\n        int s = 0;\n        while (n > 0) {{\n            s += n % 10;\n            n /= 10;\n        }}\n        return s;\n    }}\n\n    /** Returns the first value from start upward whose digits add up to {k}. Precondition: start >= 0. */\n    public static int firstWithDigitSum(int start) {{\n        int n = start;\n/* missing code */\n        return n;\n    }}\n}}"
    cands = [(f"while (digitSum(n) != {k}) {{ n++; }}", True, None), (f"while (digitSum(n) == {k}) {{ n++; }}", False, f"Loops while the digit sum equals {k}, so it returns the first value that does not have that digit sum."), (f"while (n != {k}) {{ n++; }}", False, "Compares the number itself with the target instead of its digit sum."),
             (f"while (digitSum(n) < {k}) {{ n++; }}", False, f"Stops at the first value whose digit sum is at least {k}, which can be greater than {k}."), (f"while (digitSum(start) != {k}) {{ n++; }}", False, "Tests the digit sum of start in every pass, so the condition never changes and the loop does not end unless start already matches.")]
    cands[4] = (f"while (digitSum(n) != {k}) {{ n += 2; }}", False, "Skips every other value, so it can step over the first match.")
    tests = [(f"return Numbers.firstWithDigitSum({s});", str(next(v for v in range(s, s + 500) if sum(int(c) for c in str(v)) == k))) for s in (0, 1, 15, 28, 91, 100)]
    stem = f"The method firstWithDigitSum is intended to return the first value, starting at start and counting upward, whose digits add up to {k}, using the helper method digitSum. Which of the following can replace /* missing code */ so that firstWithDigitSum works as intended?"
    return _helper_completion(rng, "cs_helper_digit_match_completion", "2.7", "2.C", tpl, cands, tests, stem, "use a helper method in a while loop condition to search upward", "each candidate compiled and run on start values vs Python search",
                              "The loop keeps increasing n until the helper reports the target digit sum, so n is the first matching value.", indent="        ")


@retry_any
def cs_helper_array_count_completion(rng):
    m = rng.choice([3, 4, 5])
    tpl = f"class Tally {{\n    /** Returns true if v is a multiple of {m}. */\n    public static boolean multiple(int v) {{\n        return v % {m} == 0;\n    }}\n\n    /** Returns the number of elements of a that are multiples of {m}. */\n    public static int countMultiples(int[] a) {{\n        int count = 0;\n        for (int v : a) {{\n/* missing code */\n        }}\n        return count;\n    }}\n}}"
    cands = [("if (multiple(v)) { count++; }", True, None), ("if (multiple(a)) { count++; }", False, "Passes the whole array to a method that expects an int, which does not compile."), ("if (multiple(v)) { count = v; }", False, "Stores the last multiple instead of counting them."),
             ("if (!multiple(v)) { count++; }", False, "Counts the elements that are not multiples."), ("if (multiple(v)) { count += v; }", False, "Adds the multiples themselves instead of counting them.")]
    cands[1] = ("if (multiple(v)) { count++; }\n            count++;", False, "Counts every element once more, so the result is larger than the number of multiples.")
    cases = [[3, 4, 5, 6, 9], [1, 2], [m * 2, m, m * 5], [7, 8, 10, 11], [0, m, 2 * m + 1]]
    tests = [(f"return Tally.countMultiples(new int[] {{{', '.join(map(str, c))}}});", str(sum(1 for v in c if v % m == 0))) for c in cases]
    stem = f"The method countMultiples is intended to return the number of elements of a that are multiples of {m}, using the helper method multiple. Which of the following can replace /* missing code */ so that countMultiples works as intended?"
    return _helper_completion(rng, "cs_helper_array_count_completion", "4.4", "2.C", tpl, cands, tests, stem, "call a helper method on each element in an enhanced for loop", "each candidate compiled and run on arrays vs Python count",
                              "Each element v is passed to the helper, and count increases only when the helper returns true.")


def cs_precondition_string(rng):
    cases = [
        ("public static String initials(String first, String last) {\n        return first.substring(0, 1) + last.substring(0, 1);\n    }", "initials", "Neither first nor last is the empty string.", 'return Probe.initials("", "Lee");', 'return Probe.initials("Ana", "Lee");',
         [("Only first is not the empty string.", "A call such as initials(\"Ana\", \"\") still throws an exception because last has no character at index 0."), ("Both first and last have at least two characters.", "This is stronger than needed: one character in each String already works, so it is not the weakest condition."),
          ("first and last contain only letters.", "The characters are never examined, only the positions, so the kind of character does not matter.")]),
        ("public static String firstTwo(String s) {\n        return s.substring(0, 2);\n    }", "firstTwo", "s has at least two characters.", 'return Probe.firstTwo("a");', 'return Probe.firstTwo("ab");',
         [("s has at least one character.", "A one-character String such as \"a\" still throws an exception because substring(0, 2) needs two characters."), ("s has more than two characters.", "This is stronger than needed: a String with exactly two characters already works, so it is not the weakest condition."),
          ("s contains only letters.", "The characters are never examined, only the positions, so the kind of character does not matter.")]),
    ]
    code, name, pre, bad_call, good_call, wrongs = pick(rng, cases)
    cls = f"class Probe {{\n    {code}\n}}"
    res = J.java_eval(cls, [("ret", bad_call), ("ret", good_call)])
    if "EXC:" not in res[0] or "EXC:" in res[1]:
        raise ValueError("precondition_expectation_failed")
    key = (pre, "When this condition is false substring asks for characters that are not there and throws a StringIndexOutOfBoundsException; when it is true every call works.")
    stem = "Which of the following is the weakest precondition (the least restrictive condition) that guarantees the method will not throw an exception?"
    return _text_item(rng, "cs_precondition_string", "2.10", "4.B", stem, cls, key, wrongs, "a precondition states what must hold on entry for the method to work", "java runs on a failing and a working call", [f"method={name}"])


def cs_postcondition_loop(rng):
    k = rng.choice([3, 4, 5])
    cls = f"class Count {{\n    /** Precondition: n >= 0. */\n    public static int steps(int n) {{\n        int c = 0;\n        while (n >= {k}) {{\n            n -= {k};\n            c++;\n        }}\n        return c;\n    }}\n}}"
    res = J.java_eval(cls, [("ret", f"return Count.steps({v});") for v in (0, k - 1, k, 3 * k + 1, 7 * k)])
    exp = [0, 0, 1, 3, 7]
    if [J.tidy(r) for r in res] != [str(e) for e in exp]:
        raise ValueError("expectation_failed")
    key = (f"It returns the quotient n / {k}, the number of times {k} can be subtracted from n.", f"The loop subtracts {k} until fewer than {k} remain and counts the subtractions, which equals n / {k} using integer division.")
    wrongs = [(f"It returns the remainder of n divided by {k}, the value left in n when the loop ends.", "The loop counts subtractions in c and returns c; the remainder is the final value of n, which is not returned."),
              (f"It returns the number of digits that are needed to write n in base {k}.", "The loop does not divide repeatedly; it subtracts a fixed amount once per pass, which is not a digit count."),
              (f"It returns n minus {k}, the value of n after one subtraction of {k}.", f"The loop keeps subtracting while at least {k} remain, and the method returns the count rather than the value of n.")]
    stem = "Which of the following best describes the postcondition of the method steps (what is true about the returned value when the method finishes)?"
    return _text_item(rng, "cs_postcondition_loop", "2.9", "4.B", stem, cls, key, wrongs, "a postcondition states what the returned value means", "java runs on several inputs vs Python integer division", [f"k={k}"])


def cs_postcondition_char_count(rng):
    ch = pick(rng, ["a", "e", "t", "s"])
    cls = "class Probe {\n    /** Precondition: s is not null and c has exactly one character. */\n    public static int mystery(String s, String c) {\n        int n = 0;\n        for (int i = 0; i < s.length(); i++) {\n            if (s.substring(i, i + 1).equals(c)) {\n                n++;\n            }\n        }\n        return n;\n    }\n}"
    words = ["banana", "state", "seats", "xyz", "tests", "treat"]
    res = J.java_eval(cls, [("ret", f'return Probe.mystery("{w}", "{ch}");') for w in words])
    if [J.tidy(r) for r in res] != [str(w.count(ch)) for w in words]:
        raise ValueError("expectation_failed")
    if len({w.count(ch) for w in words}) < 3 or len({w.find(ch) for w in words}) < 3:
        raise ValueError("ambiguous")
    key = ("It returns the number of times the character c appears in s.", "The loop examines every one-character piece of s and increases n whenever the piece equals c, so n counts the appearances.")
    wrongs = [("It returns the position of the first appearance of c in s, or -1 if c does not appear.", "The method never returns a position; the loop continues after a match and returns the count n."),
              ("It returns true if s contains c at least once and false otherwise.", "The return type is int, so the method returns a count, not a boolean."),
              ("It returns the number of characters of s that are different from c.", "The loop increases n when a piece equals c, so it counts the matches rather than the non-matches.")]
    stem = "Which of the following best describes the postcondition of the method mystery (what is true about the returned value)?"
    return _text_item(rng, "cs_postcondition_char_count", "2.10", "4.B", stem, cls, key, wrongs, "a postcondition states what the returned value means", "java runs on several Strings vs Python count", [f"ch={ch}"])


def cs_precondition_division(rng):
    cls = "class Probe {\n    public static int perItem(int total, int count) {\n        return total / count;\n    }\n}"
    res = J.java_eval(cls, [("ret", "return Probe.perItem(12, 0);"), ("ret", "return Probe.perItem(0, 4);"), ("ret", "return Probe.perItem(-9, 3);"), ("ret", "return Probe.perItem(12, -3);")])
    if "EXC:" not in res[0] or any("EXC:" in r for r in res[1:]):
        raise ValueError("expectation_failed")
    key = ("count is not 0.", "Integer division by 0 throws an ArithmeticException, and every other value of count (including negative ones) works.")
    wrongs = [("count is greater than 0.", "This is stronger than needed: a negative count such as -3 also works, so it is not the weakest precondition."),
              ("total is greater than 0.", "The value of total does not matter; total can be 0 or negative without any exception."),
              ("total is divisible by count.", "The division of ints never throws an exception when there is a remainder; the remainder is simply dropped.")]
    stem = "Which of the following is the weakest precondition (the least restrictive condition) that guarantees the method perItem will not throw an exception?"
    return _text_item(rng, "cs_precondition_division", "1.9", "4.B", stem, cls, key, wrongs, "a precondition names the inputs for which the method works", "java runs on zero, positive, and negative divisors", ["method=perItem"])


STAGE_X_E = ["cs_postcondition_char_count", "cs_precondition_division"]
STAGE_X_C =["cs_helper_prime_count_completion", "cs_helper_digit_match_completion", "cs_helper_array_count_completion", "cs_precondition_string", "cs_postcondition_loop"]
STAGE_X_D = ["cs_precondition_string", "cs_postcondition_loop"]
