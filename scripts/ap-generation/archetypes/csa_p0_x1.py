"""AP Computer Science A 확대 CS3 — 신규 원형 X1(단원 1·3). 2026-10-19. 공개 세트 CS1·CS2 의 원형·코드 모양과 겹치지 않는다. 정답은 javac/java 실행 결과, 독립 Python 참조가 같은 값을 내야 한다."""
import math
from csa_common import *  # noqa: F401,F403
from common import Opt  # noqa: F401
from csa_p0_a import client, pick, STEM_OUT
from csa_p0_e import retry_any
import csa_java as J


def _text_item(rng, arch, topic, skill, stem, code, key, wrongs, concept, path, facts, thinking=None, method="javac+java execution of every claim"):
    """고정 문장 선택지 문항(코드 자료 + 이름 붙은 오개념). key=(글, 이유), wrongs=[(글, 이유)]. 주장은 호출자가 실행으로 확인한 뒤 넘긴다."""
    keyo = Opt(key[0], True, key[1], None)
    ds = [Opt(t, False, w, None) for t, w in wrongs]
    p = pack(arch, topic, skill, "not_allowed", stem, keyo, ds, rng, stimulus=(code_stim(code) if code else {"kind": "none", "description": "", "data": {}}), est=80, facts=facts)
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate([o for j, o in enumerate(p["options"]) if j != p["key_index"]])]
    p["blueprint"] = mc_blueprint(arch, SUB, topic, skill, "not_allowed", concept, thinking or "read the code and decide which statement about it is true", [("each claim was checked by compiling or running the code with the JDK", "javac and java run")], mis, path,
                                  material=({"type": "code", "must_include": ["the code segment"]} if code else {"type": "none", "must_include": []}), method=method, extra={"judgment_demand": "separate the true statement from the named misconceptions"})
    return p


# ======================= 1.3 나머지 연산 (3.A) =======================
@retry_any
def cs_mod_negative_trace(rng):
    a = -rng.randint(5, 25); b = rng.randint(3, 7)
    q = -(abs(a) // b); r = a - b * q
    if r == 0:
        raise ValueError("ambiguous")
    code = f"int a = {a};\nint b = {b};\nSystem.out.println(a % b + \" \" + a / b);"
    muts = [{"why": "Treats the remainder like a mathematical modulus, which is never negative.", "swap": ("a % b", "(a % b + b) % b")},
            {"why": "Rounds the quotient toward negative infinity instead of truncating toward zero.", "swap": ("a / b", "(int) Math.floor((double) a / b)")},
            {"why": "Drops the sign of the dividend before taking the remainder.", "swap": ("a % b", "Math.abs(a) % b")},
            {"why": "Drops the sign of the dividend before dividing.", "swap": ("a / b", "Math.abs(a) / b")}]
    return mk(rng, "cs_mod_negative_trace", "1.3", "3.A", "What is printed as a result of executing the following code segment, which prints a remainder followed by a quotient?", code, muts=muts, py=f"{r} {q}", concept="remainder and quotient of a negative int in Java", path="javac+java output vs Python truncating division",
              kwhy="Java integer division truncates toward zero and the remainder takes the sign of the dividend, so a == b * (a / b) + (a % b).", facts=[f"a={a}", f"b={b}"])


# ======================= 1.6 복합 대입과 형 변환 (3.A) =======================
@retry_any
def cs_compound_mixed_types(rng):
    x0 = rng.randint(3, 12); d1 = rng.choice([1.5, 2.5, 2.9, 3.6]); m = rng.choice([1.5, 2.5, 0.5, 1.2])
    x1 = int(x0 + d1); x2 = int(x1 * m)
    if x2 == x1 or x1 == x0:
        raise ValueError("ambiguous")
    code = f"int x = {x0};\nx += {d1};\nx *= {m};\nSystem.out.println(x);"
    muts = [{"why": "Treats x as keeping the fractional part, like a double.", "swap": ("int x = ", "double x = ")},
            {"why": "Rounds to the nearest integer after the addition instead of truncating.", "swap": (f"x += {d1};", f"x = (int) Math.round(x + {d1});")},
            {"why": "Rounds to the nearest integer after the multiplication instead of truncating.", "swap": (f"x *= {m};", f"x = (int) Math.round(x * {m});")},
            {"why": "Believes a compound assignment with a double is skipped when the variable is an int.", "swap": (f"x += {d1};\n", "")}]
    return mk(rng, "cs_compound_mixed_types", "1.6", "3.A", "What is printed as a result of executing the following code segment, which applies two compound assignments to an int variable?", code, muts=muts, py=str(x2), concept="compound assignment applies an implicit cast back to the variable's type", path="javac+java output vs Python truncation after each step",
              kwhy="A compound assignment casts the double result back to int by truncation after each statement.", facts=[f"x0={x0}", f"d1={d1}", f"m={m}"])


# ======================= 1.9 값에 의한 전달 (3.C) =======================
@retry_any
def cs_pass_by_value_prim(rng):
    v = rng.randint(3, 9); k = rng.randint(2, 4); c = rng.randint(1, 6)
    cls = f"class Tools {{\n    public static int bump(int n) {{\n        n = n * {k};\n        return n + {c};\n    }}\n}}"
    call = f"int v = {v}; int r = Tools.bump(v); return v + \" \" + r;"
    muts = [{"why": "Believes the parameter is an alias of v, so v changes to the returned value.", "call": f"int v = {v}; int r = Tools.bump(v); v = r; return v + \" \" + r;"},
            {"why": "Ignores the multiplication inside bump.", "call": f"int v = {v}; int r = {v} + {c}; return v + \" \" + r;"},
            {"why": "Ignores the addition after the multiplication.", "call": f"int v = {v}; int r = {v} * {k}; return v + \" \" + r;"},
            {"why": "Reports the returned value first and the unchanged variable second.", "call": f"int v = {v}; int r = Tools.bump(v); return r + \" \" + v;"}]
    stem = f"Consider the class Tools. What is returned by the following code segment: int v = {v}; int r = Tools.bump(v); return v + \" \" + r; (the segment is the body of a method that returns a String)?"
    return mk(rng, "cs_pass_by_value_prim", "1.9", "3.C", stem, cls, call=call, muts=muts, py=f"{v} {v * k + c}", concept="a primitive argument is copied, so the method cannot change the caller's variable", path="javac+java return value vs Python arithmetic",
              kwhy="The parameter n is a copy of v, so changing n leaves v unchanged; the call returns n * k + c.", facts=[f"v={v}", f"k={k}", f"c={c}"], stim_code=cls)


# ======================= 1.9 메서드 호출 연쇄 (3.C) =======================
@retry_any
def cs_method_chain_calls(rng):
    a = rng.randint(1, 5); b = rng.randint(2, 4); x = rng.randint(2, 8)
    f = x + a; g = f * b; h = g - f
    cls = f"class Calc {{\n    public static int f(int x) {{\n        return x + {a};\n    }}\n\n    public static int g(int x) {{\n        return f(x) * {b};\n    }}\n\n    public static int h(int x) {{\n        return g(x) - f(x);\n    }}\n}}"
    call = f"return Calc.h({x});"
    muts = [{"why": "Applies f twice before multiplying.", "swap": (f"return f(x) * {b};", f"return f(f(x)) * {b};")},
            {"why": "Subtracts the original argument instead of f(x).", "swap": ("return g(x) - f(x);", "return g(x) - x;")},
            {"why": "Multiplies before adding in g, ignoring that f is called first.", "swap": (f"return f(x) * {b};", f"return x * {b} + {a};")},
            {"why": "Returns g(x) without subtracting.", "swap": ("return g(x) - f(x);", "return g(x);")}]
    stem = f"Consider the class Calc. What is returned by the call Calc.h({x})?"
    return mk(rng, "cs_method_chain_calls", "1.9", "3.C", stem, cls, call=call, muts=muts, py=str(h), concept="trace nested static method calls from the inside out", path="javac+java return value vs Python composition", kwhy="h calls g and f; g calls f, so each call is evaluated with its own parameter value.",
              facts=[f"a={a}", f"b={b}", f"x={x}"], stim_code=cls)


# ======================= 1.15 문자열 메서드 조합 (3.C) =======================
@retry_any
def cs_substring_index_trace(rng):
    words = [("programming", "gram"), ("education", "cat"), ("telescope", "esc"), ("notebook", "boo"), ("calendar", "end")]
    w, sub = pick(rng, words)
    i = w.index(sub)
    code = f"String s = \"{w}\";\nint k = s.indexOf(\"{sub}\");\nString left = s.substring(0, k);\nString right = s.substring(k + {len(sub)});\nSystem.out.println(left + \"-\" + right);"
    py = f"{w[:i]}-{w[i + len(sub):]}"
    muts = [{"why": "Includes the matched text in the left part by using k + 1 as the end index.", "swap": ("s.substring(0, k)", "s.substring(0, k + 1)")},
            {"why": "Starts the right part at the index of the match, so the match appears again.", "swap": (f"s.substring(k + {len(sub)})", "s.substring(k)")},
            {"why": "Starts the right part one character too late, dropping a character.", "swap": (f"s.substring(k + {len(sub)})", f"s.substring(k + {len(sub) + 1})")},
            {"why": "Uses the length of the match as the end index of the left part.", "swap": ("s.substring(0, k)", f"s.substring(0, {len(sub)})")}]
    return mk(rng, "cs_substring_index_trace", "1.15", "3.C", "What is printed as a result of executing the following code segment, which splits a String around the first occurrence of a substring?", code, muts=muts, py=py, concept="indexOf and substring combine to split a String around a match", path="javac+java output vs Python slicing",
              kwhy="indexOf gives the start of the match; substring(0, k) is everything before it and substring(k + length) is everything after it.", facts=[f"w={w}", f"sub={sub}"])


# ======================= 1.2 오류 종류 식별 (3.D) =======================
_KINDS = ["compile", "runtime", "wrong", "correct", "hang"]
_OPT = {"compile": "A compile-time error occurs.", "runtime": "The code compiles, but a run-time exception occurs.", "wrong": "The code compiles and runs, but it prints an incorrect result.",
        "correct": "The code compiles and runs, and it prints the intended result.", "hang": "The code compiles, but it never terminates."}


def cs_error_kind(rng):
    w, h = rng.randint(3, 9), rng.randint(2, 7)
    a1, a2 = rng.choice([(85, 90), (71, 78), (62, 69), (93, 98)])
    items, per = rng.choice([(20, 5), (36, 6), (45, 9)])
    cases = [
        ("print the area of a rectangle", f"int width = {w};\nint height = {h}\nSystem.out.println(width * height);", "compile",
         {"runtime": "The compiler stops at the missing semicolon after the value of height, so the program never runs and no exception can occur.", "wrong": "The program never runs: the missing semicolon is a syntax error that the compiler reports first.",
          "correct": "The program does not compile because the declaration of height ends without a semicolon.", "hang": "The program does not compile, so it cannot run, let alone loop forever."}),
        ("print the number of boxes needed when each box holds the same number of items", f"int items = {items};\nint perBox = 0;\nSystem.out.println(items / perBox);", "runtime",
         {"compile": "Every statement is valid Java, so the compiler accepts the code; the problem appears only when the division is evaluated.", "wrong": "No result is printed: the division by zero ends the program with an exception before anything is printed.",
          "correct": "perBox is 0, so the division items / perBox cannot produce a result, and the program does not finish normally.", "hang": "There is no loop in the code, so nothing can run forever."}),
        ("print the average of two int scores", f"int a = {a1};\nint b = {a2};\nSystem.out.println((a + b) / 2);", "wrong",
         {"compile": "Every statement is valid Java, so the compiler accepts the code.", "runtime": "No division by zero or invalid operation occurs, so no exception is thrown.", "correct": f"The int sum {a1 + a2} divided by 2 truncates to {(a1 + a2) // 2}, so a fractional average such as {(a1 + a2) / 2} is not printed.",
          "hang": "There is no loop in the code, so nothing can run forever."}),
    ]
    intent, code, kind, why = pick(rng, cases)
    code = code.replace("\\n", "\n")
    src = "public class Main {\n    public static void main(String[] args) {\n" + "\n".join("        " + ln for ln in code.split("\n")) + "\n    }\n}"
    comp, _m = J.compiles(src)
    if kind == "compile":
        if comp:
            raise ValueError("expected_compile_error")
    else:
        if not comp:
            raise ValueError("expected_to_compile")
        res = J.java_eval("", [("out", code)])
        if (kind == "runtime") != ("EXC:" in J.tidy(res[0])):
            raise ValueError("runtime_expectation_failed")
        if kind == "wrong" and J.tidy(res[0]) != str((a1 + a2) // 2):
            raise ValueError("logic_expectation_failed")
    key = (_OPT[kind], {"compile": "javac rejects the code because of the missing semicolon.", "runtime": "The code compiles, and running it throws an ArithmeticException because the divisor is 0.", "wrong": f"The code compiles and runs, but it prints {(a1 + a2) // 2} because (a + b) / 2 is integer division."}[kind])
    wrongs = [(_OPT[k], why[k]) for k in _KINDS if k != kind]
    stem = f"The following code segment is intended to {intent}. Which of the following best describes the result of placing the segment in a main method and running it?"
    return _text_item(rng, "cs_error_kind", "1.2", "3.D", stem, code, key, wrongs, "distinguish compile-time, run-time, and logic errors", "javac compile and java run of the segment", [f"kind={kind}"])


# ======================= 1.4 초기화 안 된 변수 (3.D) =======================
def cs_uninitialized_use(rng):
    n = rng.randint(3, 9)
    variants = [
        (f"int result;\nif (n > {n}) {{\n    result = n * 2;\n}}\nSystem.out.println(result);", False, "The variable result might not have been initialized when the condition is false, so the compiler rejects the code."),
        (f"int result = 0;\nif (n > {n}) {{\n    result = n * 2;\n}}\nSystem.out.println(result);", True, "result is given a value on every path, so the code compiles."),
        (f"int result;\nif (n > {n}) {{\n    result = n * 2;\n}} else {{\n    result = n;\n}}\nSystem.out.println(result);", True, "Both branches assign result, so the compiler can see it is initialized."),
        (f"int result;\nresult += n;\nSystem.out.println(result);", False, "The compound assignment reads result before any value has been stored."),
    ]
    rng.shuffle(variants)
    srcs = []
    for code, expect, _w in variants:
        src = "public class Main {\n    public static void main(String[] args) {\n        int n = " + str(n) + ";\n" + "\n".join("        " + ln for ln in code.split("\n")) + "\n    }\n}"
        comp, _m = J.compiles(src)
        if comp != expect:
            raise ValueError("compile_expectation_failed")
        srcs.append(code)
    bad = [v for v in variants if not v[1]]
    pick_bad = bad[rng.randrange(len(bad))]
    goods = [v for v in variants if v[1]]
    stem = f"Each of the following code segments is placed in a main method after the statement int n = {n};. Which segment causes a compile-time error?"
    def lab(code):
        return "`" + code.replace("\n", " ") + "`"
    key = (lab(pick_bad[0]), pick_bad[2])
    wrongs = [(lab(g[0]), "This segment compiles: " + g[2][0].lower() + g[2][1:]) for g in goods]
    other_bad = [v for v in bad if v is not pick_bad]
    if other_bad:  # 같은 결함 둘이 선택지에 함께 나오면 정답이 둘이 된다 — 한 문항에는 오류 보기 하나만 둔다
        pass
    extra = ("int result = n / 0;\nSystem.out.println(result);", "This segment compiles; dividing by the literal 0 is a run-time problem (an ArithmeticException), not a compile-time error.")
    comp, _m = J.compiles("public class Main {\n    public static void main(String[] args) {\n        int n = " + str(n) + ";\n        " + extra[0].replace("\n", "\n        ") + "\n    }\n}")
    if not comp:
        raise ValueError("extra_must_compile")
    wrongs.append((lab(extra[0]), extra[1]))
    return _text_item(rng, "cs_uninitialized_use", "1.4", "3.D", stem, None, key, wrongs[:4], "definite assignment: a local variable must be assigned on every path before use", "javac compile of every option", [f"n={n}", f"bad={pick_bad[0][:20]}"])


# ======================= 1.11 Math 로 올림 나눗셈 완성 (2.A) =======================
@retry_any
def cs_ceil_pages_completion(rng):
    per = rng.choice([4, 5, 6, 8, 10])
    tpl = f"class Pager {{\n    /** Returns the number of pages needed to show count items, with {per} items per page. */\n    public static int pages(int count) {{\n        return /* missing code */;\n    }}\n}}"
    cands = [(f"(count + {per - 1}) / {per}", True, None), (f"count / {per}", False, "Uses integer division directly, which drops a final partial page."), (f"count / {per} + 1", False, f"Always adds a page, which is wrong when count is an exact multiple of {per}."),
             (f"(int) Math.round((double) count / {per})", False, "Rounds to the nearest page, so a partial page of fewer than half the items is dropped."), (f"(count + {per}) / {per}", False, f"Adds the full page size, which counts an extra page when count is an exact multiple of {per}.")]
    tests = [(f"return Pager.pages({c});", str(math.ceil(c / per))) for c in (0, 1, per - 1, per, per + 1, 3 * per, 3 * per + 1, 5 * per - 1)]
    options = [{"text": f"`{c}`", "source": tpl.replace("/* missing code */", c), "why": w, "key": k} for c, k, w in cands]
    stem = "The method pages is intended to return the number of pages needed to show count items. Which of the following can replace /* missing code */ so that pages works as intended for every nonnegative value of count?"
    return mk_tests(rng, "cs_ceil_pages_completion", "1.11", "2.A", stem, tpl, options, tests, concept="ceiling division with int arithmetic", path="each candidate compiled and run on boundary counts vs Python ceil",
                    kwhy_by_key="Adding per - 1 before the integer division rounds a partial page up and leaves exact multiples unchanged.")


# ======================= 3.4 인스턴스 변수 기본값 (3.B) =======================
@retry_any
def cs_default_values_trace(rng):
    a = rng.randint(2, 9)
    cls = f"class Record {{\n    private int count;\n    private String label;\n    private boolean done;\n    private double score;\n\n    public Record() {{\n        count++;\n    }}\n\n    public String report() {{\n        return count + \" \" + label + \" \" + done + \" \" + score;\n    }}\n}}"
    call = "Record r = new Record(); return r.report();"
    muts = [{"why": "Believes an uninitialized String instance variable holds the empty string.", "swap": ('label + " "', '"" + " "')},
            {"why": "Believes an uninitialized boolean instance variable is true.", "swap": ("done + \" \"", "true + \" \"")},
            {"why": "Believes an uninitialized double instance variable prints as 0 with no decimal part.", "swap": ("+ score;", "+ (int) score;")},
            {"why": "Believes count++ in the constructor has no effect because count was never initialized.", "swap": ("count++;", "")}]
    return mk(rng, "cs_default_values_trace", "3.4", "3.B", "Consider the class Record. What is returned by the code segment Record r = new Record(); return r.report();?", cls, call=call, muts=muts, py="1 null false 0.0", concept="instance variables receive default values (0, 0.0, false, null) when no initializer is given", path="javac+java return value vs known default values",
              kwhy="Instance variables default to 0, null, false, and 0.0; the constructor then increments count from 0 to 1.", facts=[f"salt={a}"], stim_code=cls)


# 런 X-F: Shelf 세트의 두 번째 문항이 자기 코드 자료를 따로 싣던 결함(세트 문항은 공유 코드만)을 고친 재생성. 후보 3.
STAGE_X_F = ["css_shelf_set"]

# 런 X-B: 질문 문장이 공개 세트의 같은 토픽 출력 추적 문항과 같아 구조 look-alike 로 묶인 15개 원형(문장에 코드 목적을 넣어 고침) + 단원 1 범위로 다시 쓴 오류 종류 문항. 후보 3씩.
STAGE_X_B = [
    "cs_mod_negative_trace", "cs_compound_mixed_types", "cs_substring_index_trace", "cs_while_sentinel_trace", "cs_loop_accumulate_cond", "cs_string_count_pattern", "cs_digit_reverse_trace", "cs_nested_loop_pairs_trace",
    "cs_array_count_runs_trace", "cs_enhanced_for_trace", "cs_arraylist_set_vs_add_trace", "cs_arraylist_swap_trace", "cs_2d_row_sum_trace", "cs_linear_search_comparisons", "cs_insertion_sort_pass_trace", "cs_error_kind",
]

# 런 X-A(2026-10-19 CS3 신규 세트): x1~x4 의 신규 원형 전부. 후보 3씩.
STAGE_X_A = [
    "cs_mod_negative_trace", "cs_compound_mixed_types", "cs_pass_by_value_prim", "cs_method_chain_calls", "cs_substring_index_trace", "cs_error_kind", "cs_uninitialized_use", "cs_ceil_pages_completion", "cs_default_values_trace",
    "cs_while_sentinel_trace", "cs_bool_equiv_expr", "cs_loop_equiv_while", "cs_loop_accumulate_cond", "cs_string_count_pattern", "cs_digit_reverse_trace", "cs_largest_digit_completion", "cs_count_divisors_completion",
    "cs_remove_char_completion", "cs_sum_until_negative_completion", "cs_nested_loop_pairs_trace", "cs_grade_branches_trace",
    "cs_array_count_runs_trace", "cs_array_shift_left_completion", "cs_enhanced_for_trace", "cs_arraylist_set_vs_add_trace", "cs_arraylist_double_completion", "cs_arraylist_swap_trace", "cs_2d_row_sum_trace", "cs_2d_col_max_completion",
    "cs_linear_search_comparisons", "cs_insertion_sort_pass_trace", "cs_recursion_calls_count", "cs_recursion_digit_sum_trace", "cs_precondition_list", "cs_postcondition_2d", "cs_describe_row_ends", "cs_describe_first_min",
    "css_adjacent_set", "css_above_mean_set", "css_shelf_set",
]
