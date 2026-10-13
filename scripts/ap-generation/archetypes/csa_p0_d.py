"""AP Computer Science A P0 원형 D — Practice 2(코드 작성) 22–38%·Practice 4(코드 설명·초기 조건) 10–15% 범위를 코드 검증 가능한 원형만으로 채우기 위한 보충(csa_coverage 검사가 요구한 만큼).
코드 완성 5종(2D 카운트·배열 교환·while·선형 탐색·static 생성자), 동작 설명 2종(ArrayList·2D), 초기 조건(정렬 가정) 1종. 정답은 전부 실행·테스트로 판정한다."""
from csa_common import *  # noqa: F401,F403
from csa_p0_a import pick
import csa_p0_b as B
import csa_java as J

B.FAMILIES["list_best"] = ("public static int mystery(ArrayList<Integer> list) {\n        int best = 0;\n        for (int i = 1; i < list.size(); i++) {\n            if (list.get(i) > list.get(best)) {\n                best = i;\n            }\n        }\n        return best;\n    }", "list",
                           [("the index of the first occurrence of the largest value in the list", lambda a: a.index(max(a)), None), ("the largest value in the list", lambda a: max(a), "Believes the variable tracks the value rather than the position."), ("the index of the last occurrence of the largest value in the list", lambda a: len(a) - 1 - a[::-1].index(max(a)), "Believes a tie replaces the stored position."), ("the number of values in the list that are greater than the first value", lambda a: sum(1 for v in a if v > a[0]), "Believes best counts the larger values.")],
                           [[3, 9, 4], [5, 5, 2], [7, 1, 7, 7], [2, 8, 8, 3], [4], [1, 2, 3, 4], [9, 3, 1]])
B.FAMILIES["grid_rows"] = ("public static int mystery(int[][] g) {\n        int c = 0;\n        for (int r = 0; r < g.length; r++) {\n            int s = 0;\n            for (int v : g[r]) {\n                s += v;\n            }\n            if (s > 10) {\n                c++;\n            }\n        }\n        return c;\n    }", "int[][]",
                           [("the number of rows whose elements have a sum greater than 10", lambda g: sum(1 for r in g if sum(r) > 10), None), ("the number of elements that are greater than 10", lambda g: sum(1 for r in g for v in r if v > 10), "Believes the comparison is made on each element instead of on the row sum."), ("the sum of all the elements of the array", lambda g: sum(sum(r) for r in g), "Believes s is a running total over the whole array."), ("the number of columns whose elements have a sum greater than 10", lambda g: sum(1 for c in range(len(g[0])) if sum(r[c] for r in g) > 10), "Believes the outer index selects columns.")],
                           [[[5, 6], [1, 2]], [[4, 4], [4, 4], [1, 1]], [[11, 0], [0, 0]], [[3, 3, 3], [9, 9, 9]], [[1, 1], [2, 2], [7, 8]], [[6, 5, 1], [2, 2, 2]]])


def cs_describe_list(rng):
    return B._describe(rng, "list_best", "cs_describe_list", True, "4.9", "4.A")


def cs_describe_2d(rng):
    return B._describe(rng, "grid_rows", "cs_describe_2d", True, "4.12", "4.A")


# ======================= 4.13 / 2.A 2D 카운트 완성 =======================
def cs_2d_count_completion(rng):
    tpl = "class GridCount {\n    /** Returns the number of negative values in grid, a rectangular array with at least one row and one column. */\n    public static int countNegatives(int[][] grid) {\n        int count = 0;\n        for (int r = 0; r < grid.length; r++) {\n            for (int c = 0; c < grid[r].length; c++) {\n/*BODY*/\n            }\n        }\n        return count;\n    }\n}"
    shown = tpl.replace("/*BODY*/", "                /* missing code */")
    cands = [("if (grid[r][c] < 0) { count++; }", True, None), ("if (grid[r][c] <= 0) { count++; }", False, "Also counts the zeros."), ("if (grid[c][r] < 0) { count++; }", False, "Swaps the row and column indexes, which fails on a non-square array."), ("count += grid[r][c] < 0 ? grid[r][c] : 0;", False, "Adds the negative values instead of counting them.")]
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", "                " + c), "why": w, "key": k} for c, k, w in cands]
    gs = [[[1, -2, 3], [-4, 0, -6]], [[0]], [[-1, -1], [-1, -1], [5, 5]], [[7, 8, 9, 10]], [[2, -3, 0, 4], [0, 0, -1, 2]]]
    tests = [("return GridCount.countNegatives(new int[][] { " + ", ".join("{ " + ", ".join(map(str, r)) + " }" for r in g) + " });", str(sum(1 for r in g for v in r if v < 0))) for g in gs]
    return mk_tests(rng, "cs_2d_count_completion", "4.13", "2.A", "The method countNegatives is intended to return the number of negative values in a rectangular 2D array. Which of the following can replace /* missing code */ so that countNegatives works as intended?", shown, options, tests,
                    concept="count elements of a non-square 2D array that meet a condition", path="each candidate compiled and run on non-square arrays with zeros", kwhy_by_key="The test is strict, uses the row index first and the column index second, and counts one for each negative value, so every array gives the right count.")


# ======================= 4.5 / 2.A 배열 교환 완성 =======================
def cs_array_swap_completion(rng):
    tpl = "class ArrayTools {\n    /** Swaps the first and last elements of arr, which has at least one element. */\n    public static void swapEnds(int[] arr) {\n/*BODY*/\n    }\n}"
    shown = tpl.replace("/*BODY*/", "        /* missing code */")
    cands = [("int temp = arr[0];\n        arr[0] = arr[arr.length - 1];\n        arr[arr.length - 1] = temp;", True, None), ("arr[0] = arr[arr.length - 1];\n        arr[arr.length - 1] = arr[0];", False, "Overwrites the first element before saving it, so both ends hold the old last value."), ("int temp = arr[0];\n        arr[0] = arr[arr.length];\n        arr[arr.length] = temp;", False, "Uses arr.length as an index, which is one past the last element."), ("int temp = arr[0];\n        arr[0] = arr[1];\n        arr[1] = temp;", False, "Swaps the first two elements instead of the first and last.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "        " + c), "why": w, "key": k} for c, k, w in cands]
    arrs = [[1, 2, 3, 4], [5], [1, 2], [9, 8, 7], [4, 4, 6]]
    tests = [("int[] a = { " + ", ".join(map(str, a)) + " }; ArrayTools.swapEnds(a); return a;", "[" + ", ".join(map(str, ([a[-1]] + a[1:-1] + [a[0]]) if len(a) > 1 else a)) + "]") for a in arrs]
    return mk_tests(rng, "cs_array_swap_completion", "4.5", "2.A", "The method swapEnds is intended to swap the first and last elements of arr, which has at least one element. Which of the following can replace /* missing code */ so that swapEnds works as intended?", shown, options, tests,
                    concept="swap two array elements through a temporary variable", path="each candidate compiled and run on arrays of length 1, 2 and more", kwhy_by_key="The first value is saved in temp before it is overwritten, the last value is copied to the front, and temp is stored at the end; it also works for a one-element array.")


# ======================= 2.7 / 2.A while 완성 =======================
def cs_while_completion(rng):
    tpl = "class Digits {\n    /** Returns the integer whose digits are the digits of n in reverse order. Precondition: n is positive. */\n    public static int reverseDigits(int n) {\n        int result = 0;\n        while (n > 0) {\n/*BODY*/\n        }\n        return result;\n    }\n}"
    shown = tpl.replace("/*BODY*/", "            /* missing code */")
    cands = [("result = result * 10 + n % 10;\n            n /= 10;", True, None), ("result = result + n % 10;\n            n /= 10;", False, "Adds the digits instead of shifting the result one decimal place each time."), ("result = result * 10 + n / 10;\n            n /= 10;", False, "Takes the leading part of n instead of its last digit."), ("result = result * 10 + n % 10;\n            n--;", False, "Reduces n by 1 instead of removing its last digit.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "            " + c), "why": w, "key": k} for c, k, w in cands]
    ns = [5, 123, 1200, 907, 4010, 98]
    tests = [(f"return Digits.reverseDigits({n});", str(int(str(n)[::-1]))) for n in ns]
    return mk_tests(rng, "cs_while_completion", "2.7", "2.A", "The method reverseDigits is intended to return the integer whose digits are those of n in reverse order. Which of the following can replace /* missing code */ so that reverseDigits works as intended?", shown, options, tests,
                    concept="a while loop that peels off the last digit with % and / and builds a number", path="each candidate compiled and run on numbers with trailing zeros and several digits", kwhy_by_key="Each pass appends the last digit of n to result (shifting result left by one place) and then removes that digit from n, so the loop ends when no digits remain.")


# ======================= 4.14 / 2.A 선형 탐색 완성 =======================
def cs_search_completion(rng):
    tpl = "class Search {\n    /** Returns the index of the first occurrence of target in arr, or -1 if target does not appear. */\n    public static int firstIndex(int[] arr, int target) {\n/*BODY*/\n    }\n}"
    shown = tpl.replace("/*BODY*/", "        /* missing code */")
    cands = [("for (int i = 0; i < arr.length; i++) {\n            if (arr[i] == target) {\n                return i;\n            }\n        }\n        return -1;", True, None), ("for (int i = 0; i < arr.length; i++) {\n            if (arr[i] == target) {\n                return i;\n            } else {\n                return -1;\n            }\n        }\n        return -1;", False, "Returns -1 after the first non-matching element instead of continuing the search."), ("for (int i = 0; i < arr.length - 1; i++) {\n            if (arr[i] == target) {\n                return i;\n            }\n        }\n        return -1;", False, "Never examines the last element."), ("for (int i = 0; i < arr.length; i++) {\n            if (arr[i] == target) {\n                return arr[i];\n            }\n        }\n        return -1;", False, "Returns the value found instead of its index.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "        " + c), "why": w, "key": k} for c, k, w in cands]
    cases = [([4, 7, 9], 4), ([4, 7, 9], 9), ([4, 7, 9], 7), ([4, 7, 9], 5), ([6, 6, 2], 6), ([], 3)]
    tests = [("return Search.firstIndex(new int[] { " + ", ".join(map(str, a)) + " }, " + str(t) + ");", str(a.index(t) if t in a else -1)) for a, t in cases]
    return mk_tests(rng, "cs_search_completion", "4.14", "2.A", "The method firstIndex is intended to return the index of the first occurrence of target in arr, or -1 if target does not appear. Which of the following can replace /* missing code */ so that firstIndex works as intended?", shown, options, tests,
                    concept="sequential search that returns inside the loop only on a match", path="each candidate compiled and run with the target first, last, middle, absent and with an empty array", kwhy_by_key="The loop examines every element, returns the index at the first match, and returns -1 only after the whole array has been checked.")


# ======================= 3.7 / 2.B static 생성자 완성 =======================
def cs_static_completion(rng):
    tpl = "class Student {\n    private static int nextId = 1;\n    private int id;\n\n    /** Constructs a Student whose id is the next unused id; ids are 1, 2, 3, ... in creation order. */\n    public Student() {\n/*BODY*/\n    }\n    public int getId() { return id; }\n}"
    shown = tpl.replace("/*BODY*/", "        /* missing code */")
    cands = [("id = nextId;\n        nextId++;", True, None), ("nextId++;\n        id = nextId;", False, "Increments before assigning, so the first id is 2."), ("id = 1;\n        nextId++;", False, "Gives every student the id 1."), ("id = nextId;", False, "Never advances the shared counter, so every student gets the same id.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "        " + c), "why": w, "key": k} for c, k, w in cands]
    tests = [("Student a = new Student(); return a.getId();", "1"), ("Student a = new Student(); Student b = new Student(); return a.getId() + \" \" + b.getId();", "2 3"), ("Student a = new Student(); Student b = new Student(); Student c = new Student(); return a.getId() + \" \" + c.getId();", "4 6")]  # 같은 JVM 에서 순서대로 실행되므로 static 카운터가 이어진다(1 → 2·3 → 4~6)
    p = mk_tests(rng, "cs_static_completion", "3.7", "2.B", "The Student constructor is intended to give each new Student the next unused id, starting with 1. Which of the following can replace /* missing code */ so that the constructor works as intended?", shown, options, tests,
                    concept="use a static variable to hand out unique ids", path="each candidate compiled into a fresh class and run creating one, two and three objects (separate class copies keep the counters independent)", kwhy_by_key="The id receives the current value of the shared counter and then the counter advances, so successive objects get 1, 2, 3, and so on.")
    p["tests_run_in_order_in_one_jvm"] = True  # static 상태가 테스트 사이에 이어진다 — 자기 점검 때도 한 번의 실행에서 이 순서로
    return p


# ======================= 4.B 초기 조건 =======================
def cs_initial_conditions(rng):
    fam = pick(rng, ["median", "contains"])
    if fam == "median":
        code = "public static int middle(int[] a) {\n        return a[a.length / 2];\n    }"
        stem = "The method middle is intended to return the median (the middle value when the values are listed in increasing order) of an array with an odd number of elements. For which of the following arrays does middle NOT work as intended?"
        spec = lambda a: sorted(a)[len(a) // 2]  # noqa: E731
        good = [[1, 4, 9], [2, 3, 5, 8, 13], [6, 7, 20], [1, 2, 3, 4, 5, 6, 7]]
        bad = [[9, 1, 4], [8, 2, 5], [20, 6, 7], [5, 1, 9, 2, 7]]
        pairs = [(a, None) for a in good]
        cand = [(pick(rng, bad), None)] + [(a, None) for a in rng.sample(good, 3)]
        calls = [("middle(" + CC_arr(a) + ")", str(spec(a))) for a, _ in cand]
        why_bad = lambda i, c, e, r: f"The values {_args(c)} are not in increasing order, so the element at the middle position is {r} but the median is {e}."  # noqa: E731
        why_ok = lambda i, c, e, r: f"The values {_args(c)} are already in increasing order, so the middle position holds the median, {e}."  # noqa: E731
        cname = "Tools"
    else:
        code = "public static boolean contains(int[] a, int t) {\n        int lo = 0;\n        int hi = a.length - 1;\n        while (lo <= hi) {\n            int mid = (lo + hi) / 2;\n            if (a[mid] == t) {\n                return true;\n            } else if (a[mid] < t) {\n                lo = mid + 1;\n            } else {\n                hi = mid - 1;\n            }\n        }\n        return false;\n    }"
        stem = "The method contains uses a binary search and is intended to return true if t appears anywhere in the array a. For which of the following calls does contains NOT work as intended?"
        sorted_cases = [([2, 4, 6, 8, 10], 8), ([1, 3, 5, 7], 4), ([5, 6, 7, 8, 9, 10], 5), ([1, 2, 3], 3)]
        unsorted_cases = [([9, 2, 7, 4, 1], 4), ([8, 3, 9, 1, 5], 1), ([6, 1, 8, 2, 9], 2)]
        cand = [pick(rng, unsorted_cases)] + rng.sample(sorted_cases, 3)
        calls = [("contains(" + CC_arr(a) + ", " + str(t) + ")", "true" if t in a else "false") for a, t in cand]
        why_bad = lambda i, c, e, r: f"The array in {_args(c)} is not sorted, so the binary search discards the half that holds the target and returns {r} instead of {e}."  # noqa: E731
        why_ok = lambda i, c, e, r: f"The array in {_args(c)} is sorted, so the binary search returns the correct value {e}."  # noqa: E731
        cname = "Tools"
    cls = f"class {cname} {{\n    {code}\n}}"
    res = J.java_eval(cls, [("ret", f"return {cname}.{c};") for c, _e in calls])
    wrong = [J.tidy(r) != e for r, (_c, e) in zip(res, calls)]
    if wrong != [True, False, False, False]:
        raise ValueError("exactly_one_option_must_fail_the_specification")
    key = Opt(f"`{cname}.{calls[0][0]}`", True, why_bad(0, calls[0][0], calls[0][1], J.tidy(res[0])), None)
    ds = [Opt(f"`{cname}.{c}`", False, why_ok(i, c, e, J.tidy(r)), None) for i, ((c, e), r) in enumerate(zip(calls[1:], res[1:]), 1)]
    p = pack("cs_initial_conditions", "4.5", "4.B", "not_allowed", "x", key, ds, rng, stimulus=code_stim(cls), est=80, facts=[f"family={fam}"])
    p["stem"] = stem
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate([o for j, o in enumerate(p["options"]) if j != p["key_index"]])]
    p["blueprint"] = mc_blueprint("cs_initial_conditions", SUB, p["topic"], "4.B", "not_allowed", "initial conditions a method needs to work as intended", "decide which input violates the method's hidden assumption", [("exactly one option gives a result different from the specification when run on the JDK", "java run vs python specification")], mis,
                                  "javac+java runs every option; a Python specification (median or membership) must agree with the three good options and disagree with the key", material={"type": "code", "must_include": ["the method"]}, method="javac+java run + python specification", extra={"judgment_demand": "name the precondition the code silently assumes"})
    return p


def _args(c):
    return c.split("(", 1)[1].rsplit(")", 1)[0].replace("new int[] ", "")


def CC_arr(a):
    return "new int[] { " + ", ".join(map(str, a)) + " }"


STAGE_P1_MC = ["cs_2d_count_completion", "cs_array_swap_completion", "cs_while_completion", "cs_search_completion", "cs_static_completion", "cs_describe_list", "cs_describe_2d", "cs_initial_conditions"]

# 파일럿 MC 22칸(= 단독 20 + 2문항 세트 1): 공식 범위 안(단원 1 4·2 6·3 4·4 8 / Practice 2 8·3 11·4 3 — test_csa_p0 가 창 안인지 검사). registry 가 csa_p1_a 로 등록한다.
STAGE_P1_A = ["cs_int_division_expr", "cs_string_methods", "cs_compile_error", "cs_short_circuit", "cs_while_trace", "cs_nested_loops_count", "cs_loop_completion", "cs_string_completion", "cs_describe_string",
              "cs_class_completion", "cs_helper_completion", "cs_array_traverse", "cs_arraylist_remove_loop", "cs_2d_traverse", "cs_recursion_trace", "cs_array_completion", "cs_2d_completion", "cs_arraylist_completion",
              "cs_describe_array", "cs_precondition", "css_class_set"]
