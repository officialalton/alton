"""AP Computer Science A P0 원형 A — 단원 1(Using Objects and Methods)·2(Selection and Iteration).
각 함수는 시드 rng 하나로 한 문항 팩을 만든다. 정답·오답은 Java 실행 결과(csa_common.mk), 독립 Python 참조가 정답을 재계산한다. 조건 불충족 시 ValueError."""
import math
from csa_common import *  # noqa: F401,F403
from common import Opt  # noqa: F401
import csa_java as J


def client(stmts, extra=""):
    body = "\n".join("        " + ln for ln in stmts.strip("\n").split("\n"))
    return f"public class Client {{\n    public static void main(String[] args) {{\n{body}\n    }}\n}}"


def pick(rng, seq):
    return seq[rng.randrange(len(seq))]


STEM_OUT = "What is printed as a result of executing the code segment?"


# ======================= 1.3 정수 나눗셈·나머지·우선순위 (3.A) =======================
@retry_sep
def cs_int_division_expr(rng):
    a, b, c, d = rng.randint(7, 29), rng.randint(2, 5), rng.randint(2, 4), rng.randint(5, 23)
    code = f"int a = {a};\nint b = {b};\nint c = {c};\nint d = {d};\nSystem.out.println(a / b * c + d % b);"
    py = str((a // b) * c + d % b)
    muts = [{"why": "Uses exact (floating-point) division for a / b instead of integer division.", "swap": ("a / b * c", "(double) a / b * c")},
            {"why": "Reads d % b as the quotient d / b instead of the remainder.", "swap": ("d % b", "d / b")},
            {"why": "Groups the operations from left to right, ignoring that * / % bind tighter than +.", "swap": ("a / b * c + d % b", "(a / b * c + d) % b")},
            {"why": "Rounds a / b to the nearest integer instead of truncating it.", "swap": ("a / b * c", "(int) Math.round((double) a / b) * c")}]
    return mk(rng, "cs_int_division_expr", "1.3", "3.A", STEM_OUT, code, muts=muts, py=py, concept="integer division, remainder and operator precedence in one expression",
              path="javac+java output vs Python integer arithmetic (// and %)", kwhy=f"Integer division truncates: {a} / {b} is {a // b}, times {c} is {(a // b) * c}; the remainder {d} % {b} is {d % b}; the sum is {py}.", facts=[f"a={a}", f"b={b}", f"c={c}", f"d={d}", f"key={py}"])


# ======================= 1.5 형변환·범위 (3.A) =======================
@retry_sep
def cs_casting_range(rng):
    x = rng.randint(31, 99) / 10
    if abs(x - round(x)) < 0.15 or x * 10 % 10 in (0, 5):
        raise ValueError("ambiguous")
    code = f"double x = {x};\nint p = (int) x;\nint q = (int) (x + 0.5);\ndouble r = p / 2;\nSystem.out.println(p + \" \" + q + \" \" + r);"
    p_, q_ = int(x), int(x + 0.5)
    py = f"{p_} {q_} {float(p_ // 2)}"
    muts = [{"why": "Believes a cast to int rounds to the nearest integer instead of truncating.", "swap": ("int p = (int) x;", "int p = (int) Math.round(x);")},
            {"why": "Believes p / 2 is exact because the result is stored in a double.", "swap": ("double r = p / 2;", "double r = p / 2.0;")},
            {"why": "Believes adding 0.5 before the cast has no effect.", "swap": ("int q = (int) (x + 0.5);", "int q = (int) x;")},
            {"why": "Forgets that the cast applies only to x and not to the whole sum.", "swap": ("int q = (int) (x + 0.5);", "int q = (int) x + 1;")}]
    return mk(rng, "cs_casting_range", "1.5", "3.A", STEM_OUT, code, muts=muts, py=py, concept="casting double to int truncates; integer division before widening",
              path="javac+java output vs Python int()/floor division", kwhy=f"(int) {x} truncates to {p_}; (int) ({x} + 0.5) is {q_}; p / 2 is integer division giving {p_ // 2}, which widens to {float(p_ // 2)}.", facts=[f"x={x}", f"key={py}"])


# ======================= 1.6 복합 대입·증감 (3.A) =======================
@retry_sep
def cs_compound_assign(rng):
    x, y = rng.randint(3, 12), rng.randint(2, 7)
    code = f"int x = {x};\nint y = {y};\nx += y;\ny *= 2;\nx -= y--;\nSystem.out.println(x + \" \" + y);"
    x1 = x + y; y1 = y * 2; x2 = x1 - y1; y2 = y1 - 1
    py = f"{x2} {y2}"
    muts = [{"why": "Treats y-- as a pre-decrement so y is reduced before it is subtracted from x.", "swap": ("x -= y--;", "x -= --y;")},
            {"why": "Reads y *= 2 as y += 2.", "swap": ("y *= 2;", "y += 2;")},
            {"why": "Forgets that y-- also decrements y after the subtraction.", "swap": ("x -= y--;", "x -= y;")},
            {"why": "Reads x += y as x = y.", "swap": ("x += y;", "x = y;")}]
    return mk(rng, "cs_compound_assign", "1.6", "3.A", STEM_OUT, code, muts=muts, py=py, concept="compound assignment and post-decrement side effects",
              path="javac+java output vs Python sequential assignment", kwhy=f"x becomes {x1} after x += y, y becomes {y1}; x -= y-- subtracts the old y ({y1}) giving {x2}, then y becomes {y2}.", facts=[f"x={x}", f"y={y}", f"key={py}"])


# ======================= 1.15 String 메서드 (3.B) =======================
@retry_sep
def cs_string_methods(rng):
    w = pick(rng, ["computer", "algorithm", "interface", "variable", "iteration", "boolean", "compiler", "function"])
    i = rng.randint(1, 3); j = i + rng.randint(2, 3); ch = pick(rng, [c for c in w if w.count(c) == 1])
    code = f"String s = \"{w}\";\nString t = s.substring({i}, {j});\nint n = s.indexOf(\"{ch}\");\nSystem.out.println(t + n + s.length());"
    py = w[i:j] + str(w.index(ch)) + str(len(w))
    muts = [{"why": "Treats the second argument of substring as an inclusive index.", "swap": (f"s.substring({i}, {j})", f"s.substring({i}, {j + 1})")},
            {"why": "Counts indexOf positions from 1 instead of 0.", "swap": (f's.indexOf("{ch}")', f's.indexOf("{ch}") + 1')},
            {"why": "Uses the last valid index instead of the length of the string.", "swap": ("s.length()", "(s.length() - 1)")},
            {"why": "Treats the first argument of substring as a 1-based position.", "swap": (f"s.substring({i}, {j})", f"s.substring({i - 1}, {j})")}]
    return mk(rng, "cs_string_methods", "1.15", "3.B", STEM_OUT, code, muts=muts, py=py, concept="substring bounds, indexOf and length",
              path="javac+java output vs Python slicing, str.index and len", kwhy=f"substring({i}, {j}) keeps the characters at indexes {i} through {j - 1}: \"{w[i:j]}\"; indexOf finds \"{ch}\" at index {w.index(ch)}; the length is {len(w)}.", facts=[f"w={w}", f"key={py}"])


# ======================= 1.11 Math 클래스 (3.C) =======================
@retry_sep
def cs_math_class(rng):
    b, c, d = rng.randint(2, 6), pick(rng, [20, 28, 40, 55, 70]), -rng.randint(2, 9)
    code = f"double a = Math.pow({b}, 2);\nint b = (int) Math.sqrt({c});\nSystem.out.println(a + b + Math.abs({d}));"
    py = str(float(b ** 2) + int(math.sqrt(c)) + abs(d))
    muts = [{"why": "Reads Math.pow(base, 2) as base * 2.", "swap": (f"Math.pow({b}, 2)", f"({b} * 2.0)")},
            {"why": "Rounds the square root to the nearest integer instead of truncating it with the cast.", "swap": (f"(int) Math.sqrt({c})", f"(int) Math.round(Math.sqrt({c}))")},
            {"why": "Ignores Math.abs and adds the negative number.", "swap": (f"Math.abs({d})", f"({d})")},
            {"why": "Treats Math.sqrt as returning the square.", "swap": (f"(int) Math.sqrt({c})", f"(int) Math.pow({c}, 2) % 10")}]
    return mk(rng, "cs_math_class", "1.11", "3.C", STEM_OUT, code, muts=muts, py=py, concept="Math.pow, Math.sqrt with a cast, Math.abs and a double result",
              path="javac+java output vs Python math.pow/sqrt/abs", kwhy=f"Math.pow({b}, 2) is {float(b ** 2)}; the cast keeps {int(math.sqrt(c))}; Math.abs({d}) is {abs(d)}; the sum is the double {py}.", facts=[f"key={py}"])


# ======================= 1.12-1.14 객체 참조·별칭 (3.B) =======================
@retry_sep
def cs_object_alias(rng):
    s0, g1, g2 = rng.randint(2, 9), rng.randint(2, 6), rng.randint(2, 6)
    cls = "class Box {\n    private int size;\n    public Box(int s) { size = s; }\n    public void grow(int d) { size += d; }\n    public int getSize() { return size; }\n}"
    stm = f"Box a = new Box({s0});\nBox b = a;\nb.grow({g1});\nBox c = new Box(a.getSize());\nc.grow({g2});\nSystem.out.println(a.getSize() + \" \" + b.getSize() + \" \" + c.getSize());"
    a_ = s0 + g1; py = f"{a_} {a_} {a_ + g2}"
    muts = [{"why": "Believes Box b = a makes a separate copy, so growing b leaves a unchanged.", "call": stm.replace("Box b = a;", f"Box b = new Box({s0});")},
            {"why": "Believes c shares the same object as a because it was built from a value of a.", "call": stm.replace(f"Box c = new Box(a.getSize());\nc.grow({g2});", f"Box c = a;\nc.grow({g2});")},
            {"why": "Believes grow replaces the size instead of adding to it.", "swap": ("size += d;", "size = d;")},
            {"why": "Believes the constructor argument is ignored so every new Box starts at 0.", "swap": ("size = s;", "size = 0;")}]
    return mk(rng, "cs_object_alias", "1.13", "3.B", STEM_OUT, cls, call=stm, muts=muts, py=py, stim_code=cls + "\n\n" + client(stm), concept="two references to one object versus a new object built from a copied value",
              path="javac+java output vs Python object model (list of mutable dicts)", kwhy=f"a and b refer to the same Box, which grows from {s0} to {a_}; c is a new Box created with the value {a_} and then grows by {g2} to {a_ + g2}.", facts=[f"key={py}"])


# ======================= 1.9-1.10 메서드·매개변수 전달 (3.C) =======================
@retry_sep
def cs_method_params(rng):
    n, k = rng.randint(2, 8), rng.randint(2, 6)
    cls = "class Util {\n    public static void bump(int x, int[] arr) {\n        x++;\n        arr[0]++;\n        arr = new int[] { 99 };\n    }\n}"
    stm = f"int n = {n};\nint[] v = {{ {k} }};\nUtil.bump(n, v);\nSystem.out.println(n + \" \" + v[0]);"
    py = f"{n} {k + 1}"
    base = f"int n = {n};\nint[] v = {{ {k} }};\nUtil.bump(n, v);\n"
    muts = [{"why": "Believes the int argument is passed by reference so x++ changes n.", "call": base + 'System.out.println((n + 1) + " " + v[0]);'},
            {"why": "Believes reassigning the array parameter also changes the caller's array.", "call": base + 'System.out.println(n + " " + 99);'},
            {"why": "Believes an array element cannot be changed by a method because arrays are copied when passed.", "call": base + f'System.out.println(n + " " + {k});'},
            {"why": "Believes both parameters are changed by the method.", "call": base + 'System.out.println((n + 1) + " " + 99);'}]
    return mk(rng, "cs_method_params", "1.9", "3.C", STEM_OUT, cls, call=stm, muts=muts, py=py, stim_code=cls + "\n\n" + client(stm), concept="primitive parameters are copies; array elements changed through the reference persist; reassigning the parameter does not",
              path="javac+java output vs Python pass-by-object-reference model", kwhy=f"x is a copy of n so n stays {n}; arr[0]++ changes the caller's array element to {k + 1}; assigning a new array to arr affects only the local parameter.", facts=[f"key={py}"])


# ======================= 2.5-2.6 단락 평가·우선순위 (3.A) =======================
def _tf(b):
    return "true" if b else "false"


@retry_sep
def cs_short_circuit(rng):
    t1, t2, t3 = rng.choice([True, False]), rng.choice([True, False]), rng.choice([True, False])
    cls = "class Check {\n    public static boolean test(String label, boolean value) {\n        System.out.print(label);\n        return value;\n    }\n}"
    cond = f'Check.test("A", {_tf(t1)}) || Check.test("B", {_tf(t2)}) && Check.test("C", {_tf(t3)})'
    stm = f'if ({cond}) {{\n    System.out.println("X");\n}} else {{\n    System.out.println("Y");\n}}'
    out = ["A"]
    r = t1
    if not t1:
        out.append("B")
        if t2:
            out.append("C")
        r = t2 and t3
    py = "".join(out) + ("X" if r else "Y")
    muts = [{"why": "Evaluates every operand because it ignores short-circuit evaluation.", "call": stm.replace("||", "|").replace("&&", "&")},
            {"why": "Gives || higher precedence than &&, grouping (A || B) && C.", "call": stm.replace(cond, f"({cond.split(' || ')[0]} || {cond.split(' || ')[1].split(' && ')[0]}) && {cond.split(' && ')[1]}")},
            {"why": "Stops at the first operand regardless of its value.", "call": stm.replace(cond, cond.split(" || ")[0])},
            {"why": "Evaluates the right operand of || even when the left operand is true but skips && operands.", "call": stm.replace(" || ", " | ")}]
    return mk(rng, "cs_short_circuit", "2.5", "3.A", STEM_OUT, cls, call=stm, muts=muts, py=py, stim_code=cls + "\n\n" + client(stm), concept="short-circuit evaluation order and precedence of && over ||",
              path="javac+java output vs Python or/and with an explicit evaluation log", kwhy="&& binds tighter than ||, so the condition is A || (B && C); || stops when A is true, and && stops when B is false, so only the operands that are needed print their labels.", facts=[f"t={t1},{t2},{t3}", f"key={py}"])


# ======================= 2.6 De Morgan 동치 (3.A) — 모든 입력 조합을 실행해 판정 =======================
def cs_demorgan(rng):
    forms = [("!(a && b)", "!a || !b", True), ("!(a || b)", "!a && !b", True), ("!(a && !b)", "!a || b", True), ("!(!a || b)", "a && !b", True)]
    base, eq, _ = pick(rng, forms)
    wrongs = {"!(a && b)": [("!a && !b", "Applies De Morgan's law but forgets to change && to ||."), ("!a || b", "Negates only the first operand."), ("a || b", "Drops the negation entirely.")],
              "!(a || b)": [("!a || !b", "Applies De Morgan's law but forgets to change || to &&."), ("!a && b", "Negates only the first operand."), ("a && b", "Drops the negation entirely.")],
              "!(a && !b)": [("!a && b", "Negates the operands but keeps &&."), ("a || !b", "Drops the outer negation and keeps the inner one."), ("!a || !b", "Negates b twice incorrectly.")],
              "!(!a || b)": [("!a && b", "Negates a again and keeps b."), ("a || !b", "Changes the operator to || without negating correctly."), ("!a || !b", "Negates both operands and keeps ||.")]}[base]
    cands = [(eq, True, None)] + [(w, False, why) for w, why in wrongs]
    bodies = []
    for e in [base] + [c[0] for c in cands]:
        bodies.append(("ret", "String s = \"\"; for (int i = 0; i < 4; i++) { boolean a = i / 2 == 1; boolean b = i % 2 == 1; s += (" + e + ") ? \"1\" : \"0\"; } return s;"))
    res = J.java_eval("", bodies)
    truth = J.tidy(res[0]).lstrip("=>")
    py_truth = "".join("1" if eval(base.replace("!", " not ").replace("&&", " and ").replace("||", " or "), {}, {"a": i // 2 == 1, "b": i % 2 == 1}) else "0" for i in range(4))
    agree_str(J.tidy(res[0]), py_truth)
    same = [J.tidy(r) == J.tidy(res[0]) for r in res[1:]]
    if same != [True, False, False, False]:
        raise ValueError("demorgan_candidates_not_exactly_one_equivalent")
    key = Opt(f"`{eq}`", True, f"Checking all four combinations of a and b, `{eq}` produces the same truth table as `{base}`, which is {truth} for (a, b) in the order FF, FT, TF, TT where 1 means true.", None)
    ds = [Opt(f"`{w}`", False, why, None) for w, why in wrongs]
    p = pack("cs_demorgan", "2.6", "3.A", "not_allowed", "x", key, ds, rng, stimulus={"kind": "none", "description": "", "data": {}}, est=70, facts=[f"base={base}", f"truth={truth}"])
    p["stem"] = f"Which of the following boolean expressions is equivalent to `{base}` for all values of the boolean variables a and b?"
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate([o for j, o in enumerate(p["options"]) if j != p["key_index"]])]
    p["blueprint"] = mc_blueprint("cs_demorgan", SUB, "2.6", "3.A", "not_allowed", "De Morgan's laws for boolean expressions", "apply De Morgan's laws or compare truth tables", [("the key has the same truth table as the stem expression on all four inputs", "java truth-table run"), ("each distractor differs on at least one input", "java truth-table run")], mis,
                                  "javac+java evaluation of all four (a, b) combinations vs a Python eval truth table", material={"type": "none", "must_include": []}, method="javac+java truth table + python truth table", extra={"judgment_demand": "apply De Morgan's laws"})
    return p


# ======================= 2.7 while 반복 (3.A) =======================
@retry_sep
def cs_while_trace(rng):
    n, step, lim = rng.randint(2, 6), rng.randint(2, 4), rng.randint(20, 40)
    code = f"int n = {n};\nint count = 0;\nwhile (n < {lim}) {{\n    n = n * 2 + {step};\n    count++;\n}}\nSystem.out.println(n + \" \" + count);"
    v, c = n, 0
    while v < lim:
        v = v * 2 + step; c += 1
    py = f"{v} {c}"
    muts = [{"why": "Adds the step before doubling.", "swap": (f"n * 2 + {step}", f"(n + {step}) * 2")},
            {"why": "Reads n * 2 + step as n * (2 + step).", "swap": (f"n * 2 + {step}", f"n * (2 + {step})")},
            {"why": "Reverses the comparison, so the loop condition is false at the start and the body never runs.", "swap": (f"n < {lim}", f"n > {lim}")},
            {"why": "Stops one pass early, as soon as the next value would reach the limit.", "swap": (f"n < {lim}", f"n * 2 + {step} < {lim}")}]
    return mk(rng, "cs_while_trace", "2.7", "3.A", STEM_OUT, code, muts=muts, py=py, concept="tracing a while loop to its exit condition",
              path="javac+java output vs Python while loop", kwhy=f"The loop doubles n and adds {step} until n is at least {lim}; it runs {c} times and ends with n equal to {v}.", facts=[f"key={py}"])


# ======================= 2.11-2.12 중첩 반복·실행 횟수 (3.A) =======================
@retry_sep
def cs_nested_loops_count(rng):
    n, m = rng.randint(4, 7), rng.randint(3, 6)
    code = f"int count = 0;\nfor (int i = 1; i <= {n}; i++) {{\n    for (int j = i; j <= {m}; j++) {{\n        count++;\n    }}\n}}\nSystem.out.println(count);"
    py = str(sum(1 for i in range(1, n + 1) for j in range(i, m + 1)))
    muts = [{"why": "Assumes the inner loop always runs the full number of times, giving rows times columns.", "swap": ("int j = i;", "int j = 1;")},
            {"why": "Starts the inner loop at i + 1, skipping the diagonal.", "swap": ("int j = i;", "int j = i + 1;")},
            {"why": "Counts only the passes of the outer loop.", "swap": ("count++;", "count += j == i ? 1 : 0;")},
            {"why": "Uses exclusive upper bounds for both loops.", "swap": (f"i <= {n}", f"i < {n}")}]
    return mk(rng, "cs_nested_loops_count", "2.11", "3.A", "What is printed as a result of executing the code segment?", code, muts=muts, py=py, concept="counting executions of nested loops with a dependent inner start",
              path="javac+java output vs Python double comprehension", kwhy=f"For each i from 1 to {n} the inner loop runs once for each j from i to {m}, which is zero times when i exceeds {m}; the total is {py}.", facts=[f"key={py}"])


# ======================= 2.10 String 알고리즘 (3.C) =======================
@retry_sep
def cs_string_algorithm(rng):
    w = pick(rng, ["banana", "mississippi", "education", "aardvark", "committee", "bookkeeper", "assessment", "balloon"])
    cls = "class Words {\n    public static String mystery(String s) {\n        String result = \"\";\n        for (int i = 0; i < s.length() - 1; i++) {\n            if (s.charAt(i) == s.charAt(i + 1)) {\n                result += s.charAt(i);\n            }\n        }\n        return result;\n    }\n}"
    call = f'return Words.mystery("{w}");'
    py = "".join(w[i] for i in range(len(w) - 1) if w[i] == w[i + 1])
    muts = [{"why": "Stops one character early because it uses i < s.length() - 2.", "swap": ("s.length() - 1", "s.length() - 2")},
            {"why": "Compares each character with the character two positions ahead.", "swap": ("s.charAt(i + 1)", "s.charAt(i + 2)")},
            {"why": "Appends the neighbor instead of the repeated letter's first copy, adding every second occurrence of the pair.", "swap": ("result += s.charAt(i);", "result += s.charAt(i); result += s.charAt(i);")},
            {"why": "Collects the characters that differ from the next one.", "swap": ("s.charAt(i) == s.charAt(i + 1)", "s.charAt(i) != s.charAt(i + 1)")}]
    if not py:
        raise ValueError("no_repeats")
    return mk(rng, "cs_string_algorithm", "2.10", "3.C", f"What is returned by the call Words.mystery(\"{w}\")?", cls, call=call, muts=muts, py=py, concept="a String traversal that compares adjacent characters",
              path="javac+java return value vs Python adjacent-pair scan", kwhy=f"The method collects each character that equals the character after it; in \"{w}\" that gives \"{py}\".", facts=[f"w={w}", f"key={py}"])


# ======================= 코드 완성 / 버그 수정 (테스트 실행으로 판정) =======================
def _frag(cls_tpl, body):
    return cls_tpl.replace("/*BODY*/", body)


def cs_loop_completion(rng):
    """2.9 / 2.A: 누락 코드 완성 — 후보를 전부 컴파일·실행해 모든 테스트를 통과하는 하나만 정답."""
    kind = pick(rng, ["even_sum", "count_multiples"])
    k = rng.randint(3, 5)
    if kind == "even_sum":
        tpl = "class Calc {\n    /** Returns the sum of the even integers from 1 through n, inclusive. */\n    public static int evenSum(int n) {\n        int sum = 0;\n/*BODY*/\n        return sum;\n    }\n}"
        shown_lines = "        for (int i = 1; i <= n; i++) {\n            /* missing code */\n        }"
        cands = [("if (i % 2 == 0) { sum += i; }", True, None), ("if (i % 2 == 1) { sum += i; }", False, "Adds the odd numbers instead of the even numbers."), ("if (i / 2 == 0) { sum += i; }", False, "Uses integer division instead of the remainder operator to test for even."), ("if (i % 2 == 0) { sum = i; }", False, "Assigns instead of accumulating, so only the last even number is kept.")]
        loop = lambda frag: "        for (int i = 1; i <= n; i++) {\n            " + frag + "\n        }"
        tests = [(f"return Calc.evenSum({v});", str(sum(i for i in range(1, v + 1) if i % 2 == 0))) for v in (1, 2, 7, 10)]
        stem = "The method evenSum is intended to return the sum of the even integers from 1 through n, inclusive. Which of the following can replace /* missing code */ so that the method works as intended?"
        spec = "Calc.evenSum"
    else:
        tpl = f"class Calc {{\n    /** Returns how many integers from 1 through n, inclusive, are multiples of {k}. */\n    public static int countMultiples(int n) {{\n        int count = 0;\n/*BODY*/\n        return count;\n    }}\n}}"
        shown_lines = "        for (int i = 1; i <= n; i++) {\n            /* missing code */\n        }"
        cands = [(f"if (i % {k} == 0) {{ count++; }}", True, None), (f"if (i % {k} != 0) {{ count++; }}", False, "Counts the numbers that are not multiples."), (f"if (i / {k} == 0) {{ count++; }}", False, "Uses integer division instead of the remainder operator."), (f"if (i % {k} == 0) {{ count = i; }}", False, "Stores the multiple instead of counting it.")]
        loop = lambda frag: "        for (int i = 1; i <= n; i++) {\n            " + frag + "\n        }"
        tests = [(f"return Calc.countMultiples({v});", str(sum(1 for i in range(1, v + 1) if i % k == 0))) for v in (1, k, 3 * k + 1, 20)]
        stem = f"The method countMultiples is intended to return how many integers from 1 through n, inclusive, are multiples of {k}. Which of the following can replace /* missing code */ so that the method works as intended?"
        spec = "Calc.countMultiples"
    shown = tpl.replace("/*BODY*/", shown_lines)
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", loop(c)), "why": w, "key": key} for c, key, w in cands]
    return mk_tests(rng, "cs_loop_completion", "2.9", "2.A", stem, shown, options, tests, concept="complete a loop body that implements a filtering accumulator", path="each candidate compiled with the surrounding method and run on boundary tests; expected values from a Python reference",
                    kwhy_by_key=f"Only this body tests each integer with the remainder operator and accumulates it for every qualifying value; it passes every test case, including the smallest inputs.")


def cs_bug_find(rng):
    """2.8 / 3.D: 의도와 다르게 동작하는 코드 — 올바른 수정 후보를 테스트 실행으로 판정."""
    kind = pick(rng, ["average", "last_index"])
    if kind == "average":
        tpl = "class Stats {\n    /** Returns the average of the values in data as a double. */\n    public static double average(int[] data) {\n        int sum = 0;\n        for (int v : data) {\n            sum += v;\n        }\n/*BODY*/\n    }\n}"
        buggy = "        return sum / data.length;"
        cands = [("        return (double) sum / data.length;", True, None), ("        return (double) (sum / data.length);", False, "Casts after the integer division, so the fractional part is already lost."), ("        return sum / data.length * 1.0;", False, "Multiplies by 1.0 after the integer division has already truncated the quotient."), ("        return (double) sum / (data.length - 1);", False, "Divides by one less than the number of values.")]
        arrs = [[1, 2], [3, 3, 4], [4], [1, 2, 2, 3]]
        tests = [(f"return Stats.average(new int[] {{ {', '.join(map(str, a))} }});", str(sum(a) / len(a))) for a in arrs]
        stem = "The method average is intended to return the average of the values in data as a double. The method sometimes returns an incorrect result. Which of the following statements can replace the return statement in the method so that it works as intended?"
    else:
        tpl = "class Finder {\n    /** Returns the index of the last occurrence of target in arr, or -1 if target is not in arr. */\n    public static int lastIndex(int[] arr, int target) {\n        int result = -1;\n/*BODY*/\n        return result;\n    }\n}"
        buggy = "        for (int i = 0; i < arr.length - 1; i++) {\n            if (arr[i] == target) {\n                result = i;\n            }\n        }"
        cands = [("        for (int i = 0; i < arr.length; i++) {\n            if (arr[i] == target) {\n                result = i;\n            }\n        }", True, None), ("        for (int i = 0; i <= arr.length; i++) {\n            if (arr[i] == target) {\n                result = i;\n            }\n        }", False, "Lets i reach arr.length, which causes an ArrayIndexOutOfBoundsException."), ("        for (int i = 0; i < arr.length; i++) {\n            if (arr[i] == target) {\n                return i;\n            }\n        }", False, "Returns the first occurrence instead of the last."), ("        for (int i = 1; i < arr.length; i++) {\n            if (arr[i] == target) {\n                result = i;\n            }\n        }", False, "Starts at index 1, so a target at index 0 is missed.")]
        tests = [("return Finder.lastIndex(new int[] { 4, 7, 4, 9 }, 9);", "3"), ("return Finder.lastIndex(new int[] { 4, 7, 4, 9 }, 4);", "2"), ("return Finder.lastIndex(new int[] { 4 }, 4);", "0"), ("return Finder.lastIndex(new int[] { 4, 7 }, 5);", "-1")]
        stem = "The method lastIndex is intended to return the index of the last occurrence of target in arr, or -1 if target is not in arr. The method does not work as intended for some arrays. Which of the following replaces the loop at the center of the method so that it works as intended?"
    shown = tpl.replace("/*BODY*/", buggy)
    options = [{"text": f"```\n{c.strip(chr(10))}\n```" if "\n" in c else f"`{c.strip()}`", "source": tpl.replace("/*BODY*/", c), "why": w, "key": key} for c, key, w in cands]
    # 학생 화면 선택지는 한 줄 코드 또는 코드 블록. 정답 후보가 아닌 원본(버그)이 테스트에서 실패하는지도 확인한다.
    chk = J.java_eval(tpl.replace("/*BODY*/", buggy), [("ret", c) for c, _ in tests])
    if all(J.tidy(r) == e for r, (_, e) in zip(chk, tests)):
        raise ValueError("buggy_original_passes_all_tests")
    return mk_tests(rng, "cs_bug_find", "2.8", "3.D", stem, shown, options, tests, concept="locate and correct a logic error from the method's specification", path="the shown buggy method fails a test; each candidate fix compiled and run on the tests, only one passes all",
                    kwhy_by_key="This version fixes the flaw in the original: it passes every test case, including the cases where the original returns a wrong value.")


@retry_sep
def cs_compile_error(rng):
    """1.2 / 3.D: 컴파일 오류가 나는 문장 하나 — 후보를 각각 컴파일해 판정."""
    good_pool = [("double d = 5;", "An int value can be widened to a double."), ("int n = (int) 3.9;", "A cast narrows the double to an int."), ("String s = \"a\" + 1;", "String concatenation accepts an int operand."), ("long big = 12;", "An int can be assigned to a long."), ("char c = 'x';", "A char literal is valid."), ("boolean ok = 3 > 2;", "A relational expression produces a boolean.")]
    bad_pool = [("int k = 3.9;", "Assigning a double to an int requires a cast, so this fails to compile."), ("boolean b = 1;", "An int cannot be assigned to a boolean in Java."), ("String t = 'ab';", "Single quotes allow only one character; a String needs double quotes."), ("int m = \"7\";", "A String cannot be assigned to an int."), ("char q = \"x\";", "A String literal cannot be assigned to a char.")]
    bad = pick(rng, bad_pool)
    goods = rng.sample(good_pool, 3)
    cands = [bad] + goods
    bodies = [("out", c[0]) for c in cands]
    ok = []
    for c, _ in cands:
        comp, _m = J.compiles("public class Main {\n    public static void main(String[] args) {\n        " + c + "\n    }\n}")
        ok.append(comp)
    if ok != [False, True, True, True]:
        raise ValueError("compile_candidates_not_exactly_one_failing")
    key = Opt(f"`{bad[0]}`", True, bad[1], None)
    ds = [Opt(f"`{g[0]}`", False, "This statement compiles: " + g[1], None) for g in goods]
    p = pack("cs_compile_error", "1.2", "3.D", "not_allowed", "x", key, ds, rng, stimulus={"kind": "none", "description": "", "data": {}}, est=60, facts=[f"bad={bad[0]}"])
    p["stem"] = "Which of the following statements, if placed in a main method, causes a compile-time error?"
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate([o for j, o in enumerate(p["options"]) if j != p["key_index"]])]
    p["blueprint"] = mc_blueprint("cs_compile_error", SUB, "1.2", "3.D", "not_allowed", "Java type rules for declarations and assignments", "decide whether each statement is type-correct", [("exactly one statement fails javac in a main method", "javac run on each statement")], mis, "javac compiles each candidate statement inside a main method",
                                  material={"type": "none", "must_include": []}, method="javac compile of each option", extra={"judgment_demand": "apply Java assignment-compatibility rules"})
    return p


STAGE_P1_MC = ["cs_int_division_expr", "cs_casting_range", "cs_compound_assign", "cs_string_methods", "cs_math_class", "cs_object_alias", "cs_method_params", "cs_short_circuit", "cs_demorgan", "cs_while_trace", "cs_nested_loops_count", "cs_string_algorithm", "cs_loop_completion", "cs_bug_find", "cs_compile_error"]
