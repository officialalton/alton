"""AP Computer Science A 원형 — CS5 가상 5칸 대체 2부(2026-10-21): 단원 4 재귀·선택 정렬 실행 추적 4개, 단원 2 반복문 추적 1개. 정답은 Java 실행 결과와 독립 Python 계산이 같아야 한다."""
from csa_common import *  # noqa: F401,F403
from common import Opt  # noqa: F401
from csa_p0_a import pick, STEM_OUT
from csa_p0_e import retry_any
from csa_p0_t5b import _show, STEM_SHOW
import csa_java as J  # noqa: F401


@retry_any
def cs_fib_calls_trace(rng):
    n = rng.randint(4, 6)
    shown = "class Fib {\n    public static int calls = 0;\n    public static int f(int n) {\n        calls++;\n        if (n <= 1) {\n            return n;\n        }\n        return f(n - 1) + f(n - 2);\n    }\n}"
    call = f"int v = Fib.f({n});\nreturn v + \" \" + Fib.calls;"
    fib = lambda k: k if k <= 1 else fib(k - 1) + fib(k - 2)
    cnt = lambda k: 1 if k <= 1 else 1 + cnt(k - 1) + cnt(k - 2)
    muts = [{"why": "Believes the base case returns 1 for n = 0.", "swap": ("return n;", "return 1;")},
            {"why": "Believes the call counter is not incremented in the recursive calls.", "swap": ("calls++;\n        if (n <= 1) {", "if (n <= 1) {\n            calls++;")},
            {"why": "Believes the recursion stops one value earlier.", "swap": ("if (n <= 1)", "if (n <= 2)")},
            {"why": "Believes the two recursive calls are added with a doubled second term.", "swap": ("f(n - 1) + f(n - 2)", "f(n - 1) + 2 * f(n - 2)")}]
    return mk(rng, "cs_fib_calls_trace", "4.16", "3.C", STEM_SHOW + _show(call), shown, call=call, muts=muts, py=f"{fib(n)} {cnt(n)}", concept="a recursive method with two recursive calls and a counter of how many times it was called",
              path="javac+java output vs Python recursion", kwhy="Each call adds f(n - 1) and f(n - 2) until n is 1 or 0, and calls is incremented once per call, including the base cases.")


@retry_any
def cs_reverse_digits_trace(rng):
    n = rng.randint(1000, 9899)
    n = n if n % 10 and n % 100 // 10 else n + 11
    shown = "class Digits {\n    public static int rev(int n, int acc) {\n        if (n == 0) {\n            return acc;\n        }\n        return rev(n / 10, acc * 10 + n % 10);\n    }\n}"
    call = f"return Digits.rev({n}, 0) + \" \" + Digits.rev({n // 10}, 7);"

    def rev(k, acc):
        return acc if k == 0 else rev(k // 10, acc * 10 + k % 10)
    muts = [{"why": "Believes the accumulator is added instead of shifted left before adding the digit.", "swap": ("acc * 10 + n % 10", "acc + n % 10")},
            {"why": "Believes the recursion stops before the last digit is used.", "swap": ("if (n == 0)", "if (n < 10)")},
            {"why": "Believes the next digit is taken from the quotient instead of the remainder.", "swap": ("acc * 10 + n % 10", "acc * 10 + n / 10")},
            {"why": "Believes the starting accumulator is ignored.", "swap": ("return rev(n / 10, acc * 10 + n % 10);", "return rev(n / 10, n % 10);")}]
    return mk(rng, "cs_reverse_digits_trace", "4.17", "3.C", STEM_SHOW + _show(call), shown, call=call, muts=muts, py=f"{rev(n, 0)} {rev(n // 10, 7)}", concept="a recursive method with an accumulator parameter that builds a number digit by digit",
              path="javac+java output vs Python recursion", kwhy="Each call moves the last digit of n onto the end of acc, so the digits come out in reverse order, and a starting acc of 7 stays in front.")


@retry_any
def cs_array_max_from_trace(rng):
    a = [rng.randint(1, 30) for _ in range(5)]
    shown = "class Scan {\n    public static int maxFrom(int[] a, int i) {\n        if (i == a.length - 1) {\n            return a[i];\n        }\n        int m = maxFrom(a, i + 1);\n        if (a[i] > m) {\n            return a[i];\n        }\n        return m;\n    }\n}"
    call = f"int[] v = {{{', '.join(map(str, a))}}};\nreturn Scan.maxFrom(v, 0) + \" \" + Scan.maxFrom(v, 2) + \" \" + Scan.maxFrom(v, 4);"
    if len(set(a)) < 5 or max(a) == max(a[2:]):
        raise ValueError("ambiguous")
    muts = [{"why": "Believes the method returns the first value of the range.", "swap": ("if (a[i] > m) {\n            return a[i];\n        }\n        return m;", "return a[i];")},
            {"why": "Believes the method returns the smallest value instead of the largest.", "swap": ("if (a[i] > m)", "if (a[i] < m)")},
            {"why": "Believes the base case is the first element of the range instead of the last element of the array.", "swap": ("if (i == a.length - 1)", "if (i == 0)")},
            {"why": "Believes the recursive call looks at the same index again.", "swap": ("maxFrom(a, i + 1)", "maxFrom(a, i + 2 > a.length - 1 ? a.length - 1 : i + 2)")}]
    return mk(rng, "cs_array_max_from_trace", "4.17", "3.C", STEM_SHOW + _show(call), shown, call=call, muts=muts, py=f"{max(a)} {max(a[2:])} {a[4]}", concept="a recursive method that finds the largest value in the part of an array starting at an index",
              path="javac+java output vs Python max", kwhy="Each call compares a[i] with the largest value of the rest of the array, so maxFrom(v, k) is the largest value from index k to the end.")


@retry_any
def cs_selection_two_passes_trace(rng):
    a = rng.sample(range(2, 40), 6)
    code = f"int[] v = {{{', '.join(map(str, a))}}};\nfor (int p = 0; p < 2; p++) {{\n    int m = p;\n    for (int j = p + 1; j < v.length; j++) {{\n        if (v[j] < v[m]) {{\n            m = j;\n        }}\n    }}\n    int t = v[p];\n    v[p] = v[m];\n    v[m] = t;\n}}\nString out = \"\";\nfor (int x : v) {{\n    out += x + \" \";\n}}\nSystem.out.println(out.trim());"
    w = list(a)
    for p in range(2):
        m = min(range(p, 6), key=lambda i: w[i]); w[p], w[m] = w[m], w[p]
    muts = [{"why": "Runs only one pass of the outer loop.", "swap": ("p < 2", "p < 1")},
            {"why": "Selects the largest value of the remaining part instead of the smallest.", "swap": ("v[j] < v[m]", "v[j] > v[m]")},
            {"why": "Starts each search at p instead of p + 1 but ignores the swap.", "swap": ("int t = v[p];\n    v[p] = v[m];\n    v[m] = t;", "int t = v[p];\n    v[p] = v[m];")},
            {"why": "Swaps with the position of the last comparison instead of the position of the minimum.", "swap": ("v[p] = v[m];\n    v[m] = t;", "v[p] = v[v.length - 1];\n    v[v.length - 1] = t;")}]
    return mk(rng, "cs_selection_two_passes_trace", "4.15", "3.A", STEM_OUT, code, muts=muts, py=" ".join(map(str, w)), concept="the state of an array after the first two passes of selection sort",
              path="javac+java output vs Python selection passes", kwhy="Each pass finds the smallest value in the unsorted part and swaps it into position p, so after two passes the two smallest values are at the front.")


@retry_any
def cs_odd_digit_sum_trace(rng):
    n = rng.randint(10000, 99999)
    code = f"int n = {n};\nint total = 0;\nint count = 0;\nwhile (n > 0) {{\n    int d = n % 10;\n    if (d % 2 == 1) {{\n        total += d;\n        count++;\n    }}\n    n /= 10;\n}}\nSystem.out.println(total + \" \" + count);"
    ds = [int(c) for c in str(n)]
    od = [d for d in ds if d % 2]
    if len(od) < 2 or len(od) == len(ds):
        raise ValueError("ambiguous")
    muts = [{"why": "Tests the even digits instead of the odd digits.", "swap": ("d % 2 == 1", "d % 2 == 0")},
            {"why": "Adds the number of odd digits instead of their values.", "swap": ("total += d;", "total += 1;")},
            {"why": "Skips every other digit by removing two digits per pass.", "swap": ("n /= 10;", "n /= 100;")},
            {"why": "Adds the digit to the total even when it is not odd.", "swap": ("if (d % 2 == 1) {\n        total += d;\n        count++;\n    }", "total += d;\n    if (d % 2 == 1) {\n        count++;\n    }")}]
    return mk(rng, "cs_odd_digit_sum_trace", "2.10", "3.A", STEM_OUT, code, muts=muts, py=f"{sum(od)} {len(od)}", concept="a while loop that extracts digits with % and / and accumulates only the odd digits",
              path="javac+java output vs Python digit loop", kwhy="The loop peels off the last digit each pass, adds it to total when it is odd, and counts it.")


@retry_any
def cs_pair_count_trace(rng):
    n, lim = rng.randint(4, 6), rng.randint(5, 8)
    code = f"int count = 0;\nfor (int i = 1; i <= {n}; i++) {{\n    for (int j = i; j <= {n}; j++) {{\n        if (i + j == {lim} || i * j == {lim + 1}) {{\n            count++;\n        }}\n    }}\n}}\nSystem.out.println(count);"
    c = sum(1 for i in range(1, n + 1) for j in range(i, n + 1) if i + j == lim or i * j == lim + 1)
    if c < 2:
        raise ValueError("ambiguous")
    muts = [{"why": "Starts the inner loop at 1 instead of i, so each pair is counted twice.", "swap": ("int j = i;", "int j = 1;")},
            {"why": "Believes the condition needs both tests to be true.", "swap": ("||", "&&")},
            {"why": "Stops the inner loop one value early.", "swap": (f"j <= {n}; j++", f"j < {n}; j++")},
            {"why": "Starts the inner loop at i + 1, which skips pairs of equal values.", "swap": ("int j = i;", "int j = i + 1;")}]
    return mk(rng, "cs_pair_count_trace", "2.12", "3.A", STEM_OUT, code, muts=muts, py=str(c), concept="nested loops in which the inner loop starts at the outer index and a compound condition counts matching pairs",
              path="javac+java output vs Python nested loops", kwhy="The inner loop starts at i, so each unordered pair is visited once, and count increases when either the sum or the product condition is true.")


@retry_any
def cs_flag_scan_trace(rng):
    vals = [rng.randint(1, 9) for _ in range(6)]
    t = rng.randint(8, 12)
    code = f"int[] v = {{{', '.join(map(str, vals))}}};\nint sum = 0;\nint i = 0;\nboolean found = false;\nwhile (i < v.length && !found) {{\n    sum += v[i];\n    if (sum > {t}) {{\n        found = true;\n    }}\n    i++;\n}}\nSystem.out.println(i + \" \" + sum);"
    sm, i, f = 0, 0, False
    while i < 6 and not f:
        sm += vals[i]
        if sm > t: f = True
        i += 1
    if not f or i < 3:
        raise ValueError("ambiguous")
    muts = [{"why": "Believes the loop stops before the value that passes the threshold is added.", "swap": ("sum += v[i];\n    if (sum > " + str(t) + ") {\n        found = true;\n    }", "if (sum + v[i] > " + str(t) + ") {\n        found = true;\n    } else {\n        sum += v[i];\n    }")},
            {"why": "Believes the loop continues until the end of the array.", "swap": ("i < v.length && !found", "i < v.length")},
            {"why": "Believes the index is not advanced in the pass that sets found.", "swap": ("    i++;\n}", "    if (!found) {\n        i++;\n    }\n}")},
            {"why": "Believes the threshold test uses >= instead of >.", "swap": (f"sum > {t}", f"sum >= {t}")}]
    return mk(rng, "cs_flag_scan_trace", "2.11", "3.A", STEM_OUT, code, muts=muts, py=f"{i} {sm}", concept="a while loop with a boolean flag and an index that stops when a running sum passes a threshold",
              path="javac+java output vs Python scan", kwhy="The loop adds values until the running sum exceeds the threshold, sets found, and the index has advanced past the value that caused it.")


@retry_any
def cs_grade_chain_trace(rng):
    sc = [rng.choice([55, 62, 70, 78, 85, 90, 94, 99, 100, 68, 81]) for _ in range(5)]
    c1, c2, c3 = rng.choice([(90, 80, 70), (93, 85, 75)])
    code = f"int[] s = {{{', '.join(map(str, sc))}}};\nString out = \"\";\nfor (int x : s) {{\n    if (x >= {c1}) {{\n        out += \"A\";\n    }} else if (x >= {c2}) {{\n        out += \"B\";\n    }} else if (x >= {c3}) {{\n        out += \"C\";\n    }}\n}}\nSystem.out.println(out + \" \" + out.length());"
    out = "".join("A" if x >= c1 else "B" if x >= c2 else "C" if x >= c3 else "" for x in sc)
    if len(out) == len(sc) or len(set(out)) < 3:
        raise ValueError("ambiguous")
    muts = [{"why": "Believes the else-if chain keeps testing after a branch runs, so a score can add several letters.", "swap": ("} else if (x >= " + str(c2) + ") {", "}\n    if (x >= " + str(c2) + ") {")},
            {"why": "Believes the cutoff for the top letter is exclusive.", "swap": (f"x >= {c1}", f"x > {c1}")},
            {"why": "Believes a score below every cutoff still adds a letter.", "swap": ("out += \"C\";\n    }", "out += \"C\";\n    } else {\n        out += \"F\";\n    }")},
            {"why": "Believes the loop reads only the first four scores.", "swap": ("for (int x : s) {", "for (int k = 0; k < s.length - 1; k++) {\n    int x = s[k];")}]
    return mk(rng, "cs_grade_chain_trace", "2.4", "3.A", STEM_OUT, code, muts=muts, py=f"{out} {len(out)}", concept="an else-if chain inside a loop where one score matches no branch, building a string",
              path="javac+java output vs Python chain", kwhy="Each score runs through the else-if chain once and adds at most one letter; scores below the lowest cutoff add nothing, so the string is shorter than the array.")


@retry_any
def cs_trim_until_char_trace(rng):
    words = ["classroom", "program", "variable", "iteration", "inheritance", "boolean", "compiler", "algorithm"]
    w = rng.choice(words)
    ch = rng.choice(sorted(set(w[1:-1])))
    code = f"String s = \"{w}\";\nint cuts = 0;\nwhile (s.length() > 0 && s.charAt(s.length() - 1) != '{ch}') {{\n    s = s.substring(0, s.length() - 1);\n    cuts++;\n}}\nSystem.out.println(s + \" \" + cuts);"
    s, cuts = w, 0
    while len(s) > 0 and s[-1] != ch:
        s = s[:-1]; cuts += 1
    if cuts < 2 or not s:
        raise ValueError("ambiguous")
    muts = [{"why": "Believes the loop also removes the matching character.", "swap": (f"!= '{ch}'", f"!= '{ch}' || true")},
            {"why": "Believes the loop stops at the first occurrence of the character instead of the last.", "swap": ("s.charAt(s.length() - 1) != '" + ch + "'", "s.indexOf(\"" + ch + "\") == -1 || s.charAt(s.length() - 1) != '" + ch + "'")},
            {"why": "Believes the count is not increased in the pass that removes the character.", "swap": ("cuts++;", "cuts += 2;")},
            {"why": "Believes the loop condition tests the first character of the string.", "swap": ("s.charAt(s.length() - 1)", "s.charAt(0)")}]
    return mk(rng, "cs_trim_until_char_trace", "2.12", "3.A", STEM_OUT, code, muts=muts, py=f"{s} {cuts}", concept="a while loop that shortens a string from the end until its last character matches a target",
              path="javac+java output vs Python while loop", kwhy="The loop removes characters from the end until the last character equals the target, counting each removal.")
