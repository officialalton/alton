"""AP Computer Science A 확대 CS3 — 신규 원형 X3(단원 4: 배열·ArrayList·2차원 배열·검색·정렬·재귀). 2026-10-19. 공개 세트 CS1·CS2 의 원형·코드 모양과 겹치지 않는다."""
import math
from csa_common import *  # noqa: F401,F403
from common import Opt  # noqa: F401
from csa_p0_a import client, pick, STEM_OUT
from csa_p0_e import retry_any
from csa_p0_x1 import _text_item
import csa_p0_b as B
import csa_java as J


# ======================= 4.4 연속 같은 값 구간 수 (3.B) =======================
@retry_any
def cs_array_count_runs_trace(rng):
    a = [rng.randint(1, 3) for _ in range(rng.randint(8, 10))]
    runs = 1 + sum(1 for i in range(1, len(a)) if a[i] != a[i - 1])
    if runs < 4:
        raise ValueError("ambiguous")
    code = "int[] a = {" + ", ".join(map(str, a)) + "};\nint runs = 1;\nfor (int i = 1; i < a.length; i++) {\n    if (a[i] != a[i - 1]) {\n        runs++;\n    }\n}\nSystem.out.println(runs);"
    muts = [{"why": "Starts the count at 0, so the first run is not counted.", "swap": ("int runs = 1;", "int runs = 0;")},
            {"why": "Counts the adjacent pairs that are equal instead of the changes.", "swap": ("a[i] != a[i - 1]", "a[i] == a[i - 1]")},
            {"why": "Compares each value with the first value instead of the previous value.", "swap": ("a[i - 1]", "a[0]")},
            {"why": "Stops one position early, so a change at the end is missed.", "swap": ("i < a.length;", "i < a.length - 1;")}]
    return mk(rng, "cs_array_count_runs_trace", "4.4", "3.B", "What is printed as a result of executing the following code segment, which counts the groups of equal adjacent values in an array?", code, muts=muts, py=str(runs), concept="count runs of equal adjacent values by counting changes", path="javac+java output vs Python scan", kwhy="Each position where a value differs from the previous value starts a new run; the first run is counted by initializing runs to 1.", facts=[f"a={a}"])


# ======================= 4.5 왼쪽으로 한 칸 이동 완성 (2.A) =======================
@retry_any
def cs_array_shift_left_completion(rng):
    tpl = "class Shifter {\n    /** Moves every element of a one position to the left; the first element moves to the last position. */\n    public static void rotateLeft(int[] a) {\n        int first = a[0];\n/* missing code */\n    }\n}"
    cands = [("for (int i = 0; i < a.length - 1; i++) { a[i] = a[i + 1]; }\n        a[a.length - 1] = first;", True, None), ("for (int i = 0; i < a.length; i++) { a[i] = a[i + 1]; }\n        a[a.length - 1] = first;", False, "Lets i reach the last index, so a[i + 1] is out of bounds and an exception occurs."),
             ("for (int i = a.length - 1; i > 0; i--) { a[i] = a[i - 1]; }\n        a[0] = first;", False, "Shifts the elements to the right instead of the left."), ("for (int i = 0; i < a.length - 1; i++) { a[i + 1] = a[i]; }\n        a[a.length - 1] = first;", False, "Copies each element forward, which fills the array with the first value."),
             ("for (int i = 0; i < a.length - 1; i++) { a[i] = a[i + 1]; }", False, "Never stores the saved first element, so the last element is duplicated and the first value is lost.")]
    cases = [[1, 2, 3, 4], [5, 9], [7, 7, 2], [4, 1, 8, 6, 3]]
    tests = [(f"int[] t = {{{', '.join(map(str, c))}}}; Shifter.rotateLeft(t); return t;", "[" + ", ".join(map(str, c[1:] + c[:1])) + "]") for c in cases]
    options = [{"text": f"`{c.replace(chr(10) + '        ', ' ')}`", "source": tpl.replace("/* missing code */", "        " + c), "why": w, "key": k} for c, k, w in cands]
    stem = "The method rotateLeft is intended to move every element of the array a one position to the left, with the first element moving to the last position. Which of the following can replace /* missing code */ so that rotateLeft works as intended?"
    shown = tpl.replace("/* missing code */", "        /* missing code */")
    return mk_tests(rng, "cs_array_shift_left_completion", "4.5", "2.A", stem, shown, options, tests, concept="shift array elements and keep the saved first element", path="each candidate compiled and run on arrays vs Python rotation", kwhy_by_key="The loop copies each element from its right neighbor, and the saved first element is stored in the last position.")


# ======================= 4.4 향상된 for 문은 원소를 바꾸지 못한다 (3.B) =======================
@retry_any
def cs_enhanced_for_trace(rng):
    a = [rng.randint(2, 9) for _ in range(4)]; k = rng.randint(2, 4)
    code = "int[] a = {" + ", ".join(map(str, a)) + "};\nfor (int v : a) {\n    v = v * " + str(k) + ";\n}\nint total = 0;\nfor (int i = 0; i < a.length; i++) {\n    total += a[i];\n}\nSystem.out.println(total);"
    muts = [{"why": "Believes the enhanced for loop variable is an alias of the array element, so each element is multiplied.", "swap": ("for (int v : a) {\n    v = v * " + str(k) + ";\n}", "for (int i = 0; i < a.length; i++) {\n    a[i] = a[i] * " + str(k) + ";\n}")},
            {"why": "Adds the multiplied values only for the first element.", "swap": ("for (int v : a) {\n    v = v * " + str(k) + ";\n}", "a[0] = a[0] * " + str(k) + ";")},
            {"why": "Reports the sum of the products instead of the sum of the original elements, as if v were the element.", "swap": ("total += a[i];", "total += a[i] * " + str(k) + ";")},
            {"why": "Reports only the last element, believing the loop variable keeps the last value.", "swap": ("total += a[i];", "total = a[i];")}]
    return mk(rng, "cs_enhanced_for_trace", "4.4", "3.B", "What is printed as a result of executing the following code segment, which uses an enhanced for loop and then totals the array?", code, muts=muts, py=str(sum(a)), concept="an enhanced for loop variable is a copy of a primitive element, so assigning to it does not change the array", path="javac+java output vs Python sum", kwhy="The variable v holds a copy of each int element; changing v leaves the array unchanged, so the second loop adds the original values.", facts=[f"a={a}", f"k={k}"])


# ======================= 4.8 ArrayList set 과 add (3.B) =======================
@retry_any
def cs_arraylist_set_vs_add_trace(rng):
    a = [rng.randint(1, 9) for _ in range(4)]; x = rng.randint(10, 19); y = rng.randint(20, 29)
    code = "ArrayList<Integer> list = new ArrayList<Integer>();\n" + "".join(f"list.add({v});\n" for v in a) + f"list.set(1, {x});\nlist.add(1, {y});\nlist.remove(0);\nSystem.out.println(list);"
    lst = list(a); lst[1] = x; lst.insert(1, y); lst.pop(0)
    py = "[" + ", ".join(map(str, lst)) + "]"
    muts = [{"why": "Believes set(1, x) inserts a new element, shifting the others to the right.", "swap": (f"list.set(1, {x});", f"list.add(1, {x});")},
            {"why": "Believes add(1, y) replaces the element at index 1.", "swap": (f"list.add(1, {y});", f"list.set(1, {y});")},
            {"why": "Believes remove(0) removes the last element.", "swap": ("list.remove(0);", "list.remove(list.size() - 1);")},
            {"why": "Skips the removal, so the first element stays in the list.", "swap": ("list.remove(0);\n", "")}]
    return mk(rng, "cs_arraylist_set_vs_add_trace", "4.8", "3.B", "What is printed as a result of executing the following code segment, which changes an ArrayList with set, add, and remove?", code, muts=muts, py=py, concept="ArrayList set replaces, add(index, value) inserts, remove(index) shifts the later elements", path="javac+java output vs Python list operations", kwhy="set replaces the element at index 1, add(1, y) inserts and shifts later elements right, and remove(0) deletes the first element and shifts the rest left.", facts=[f"a={a}", f"x={x}", f"y={y}"])


# ======================= 4.10 ArrayList 중복 삽입 완성 (2.A) =======================
@retry_any
def cs_arraylist_double_completion(rng):
    tpl = "class Doubler {\n    /** Replaces each element of list with two consecutive copies of itself, so [3, 5] becomes [3, 3, 5, 5]. */\n    public static void doubleEach(ArrayList<Integer> list) {\n        for (int i = list.size() - 1; i >= 0; i--) {\n/* missing code */\n        }\n    }\n}"
    cands = [("list.add(i, list.get(i));", True, None), ("list.add(i + 1, list.get(i + 1));", False, "Reads one index past the element, which is out of bounds at the last index."), ("list.set(i + 1, list.get(i));", False, "Replaces the following element instead of inserting a copy, and fails at the last index."),
             ("list.add(list.get(i));", False, "Appends each copy at the end of the list instead of next to the original."), ("list.add(i, i);", False, "Inserts the index instead of the element's value.")]
    cases = [[3, 5], [1], [4, 4, 7], [9, 2, 6, 1]]
    tests = []
    for c in cases:
        ex = [v for v in c for _ in (0, 1)]
        tests.append(("ArrayList<Integer> L = new ArrayList<Integer>(); " + " ".join(f"L.add({v});" for v in c) + " Doubler.doubleEach(L); return L;", "[" + ", ".join(map(str, ex)) + "]"))
    options = [{"text": f"`{c}`", "source": tpl.replace("/* missing code */", "            " + c), "why": w, "key": k} for c, k, w in cands]
    stem = "The method doubleEach is intended to replace each element of list with two consecutive copies of that element. Which of the following can replace /* missing code */ so that doubleEach works as intended?"
    shown = tpl.replace("/* missing code */", "            /* missing code */")
    return mk_tests(rng, "cs_arraylist_double_completion", "4.10", "2.A", stem, shown, options, tests, concept="insert into an ArrayList while traversing from the back so the unvisited indexes are not disturbed", path="each candidate compiled and run on lists vs Python duplication", kwhy_by_key="Traversing from the end and inserting a copy at index i keeps the indexes of the elements not yet visited unchanged.")


# ======================= 4.8 ArrayList 교환 (3.B) =======================
@retry_any
def cs_arraylist_swap_trace(rng):
    a = rng.sample(range(2, 9), 4)
    code = "ArrayList<Integer> list = new ArrayList<Integer>();\n" + "".join(f"list.add({v});\n" for v in a) + "int temp = list.get(0);\nlist.set(0, list.get(list.size() - 1));\nlist.set(list.size() - 1, temp);\nSystem.out.println(list);"
    lst = list(a); lst[0], lst[-1] = lst[-1], lst[0]
    muts = [{"why": "Omits the temporary variable, so both ends end with the last value.", "swap": ("int temp = list.get(0);\n", "int temp = list.get(list.size() - 1);\n")},
            {"why": "Uses add and remove, which shifts the elements instead of swapping two positions.", "swap": ("list.set(0, list.get(list.size() - 1));\nlist.set(list.size() - 1, temp);", "list.add(0, list.get(list.size() - 1));\nlist.remove(list.size() - 1);")},
            {"why": "Swaps the first two elements instead of the first and last.", "swap": ("list.set(0, list.get(list.size() - 1));\nlist.set(list.size() - 1, temp);", "list.set(0, list.get(1));\nlist.set(1, temp);")},
            {"why": "Stores the saved value in the first position again, so only one element changes.", "swap": ("list.set(list.size() - 1, temp);", "list.set(0, temp);")}]
    return mk(rng, "cs_arraylist_swap_trace", "4.8", "3.B", "What is printed as a result of executing the following code segment, which exchanges two elements of an ArrayList?", code, muts=muts, py="[" + ", ".join(map(str, lst)) + "]", concept="swap two ArrayList elements with get, set, and a temporary variable", path="javac+java output vs Python swap", kwhy="The first value is saved, the last value is copied to index 0, and the saved value is stored at the last index.", facts=[f"a={a}"])


# ======================= 4.12 2차원 배열 행 합 (3.B) =======================
@retry_any
def cs_2d_row_sum_trace(rng):
    r, c = rng.choice([(3, 3), (3, 4), (4, 3)])
    m = [[rng.randint(1, 6) for _ in range(c)] for _ in range(r)]
    code = "int[][] m = {" + ", ".join("{" + ", ".join(map(str, row)) + "}" for row in m) + "};\nint best = 0;\nfor (int r = 0; r < m.length; r++) {\n    int sum = 0;\n    for (int c = 0; c < m[r].length; c++) {\n        sum += m[r][c];\n    }\n    if (sum > best) {\n        best = r;\n    }\n}\nSystem.out.println(best);"
    # 주의: best 에는 합이 아니라 행 번호를 저장해 비교가 일관되지 않은 코드(의도적 함정)가 아니도록, 비교 대상도 행 번호를 쓰지 않게 고친다
    code = "int[][] m = {" + ", ".join("{" + ", ".join(map(str, row)) + "}" for row in m) + "};\nint bestSum = 0;\nint bestRow = 0;\nfor (int r = 0; r < m.length; r++) {\n    int sum = 0;\n    for (int c = 0; c < m[r].length; c++) {\n        sum += m[r][c];\n    }\n    if (sum > bestSum) {\n        bestSum = sum;\n        bestRow = r;\n    }\n}\nSystem.out.println(bestRow + \" \" + bestSum);"
    sums = [sum(row) for row in m]
    if sums.count(max(sums)) > 1:
        raise ValueError("ambiguous")
    br = sums.index(max(sums))
    muts = [{"why": "Reports the largest value in the matrix instead of the largest row sum.", "swap": ("sum += m[r][c];", "sum = Math.max(sum, m[r][c]);")},
            {"why": "Starts the best sum above every row sum, so no row is ever selected and the initial values are printed.", "swap": ("int bestSum = 0;", "int bestSum = 100;")},
            {"why": "Sums the columns of the first row only, ignoring the other rows.", "swap": ("for (int c = 0; c < m[r].length; c++) {\n        sum += m[r][c];", "for (int c = 0; c < m[r].length; c++) {\n        sum += m[0][c];")},
            {"why": "Reports the largest sum first and the row index second, reversing the order of the two values.", "swap": ('bestRow + " " + bestSum', 'bestSum + " " + bestRow')}]
    return mk(rng, "cs_2d_row_sum_trace", "4.12", "3.B", "What is printed as a result of executing the following code segment, which finds the row with the largest sum in a two-dimensional array?", code, muts=muts, py=f"{br} {max(sums)}", concept="row-major traversal that tracks the largest row sum and its row index", path="javac+java output vs Python row sums", kwhy="Each row's sum is compared with the best sum so far, and the row index is saved with it.", facts=[f"m={m}"])


# ======================= 4.13 열 최댓값 완성 (2.A) =======================
@retry_any
def cs_2d_col_max_completion(rng):
    tpl = "class Grid {\n    /** Returns the largest value in column col of the rectangular array m. */\n    public static int colMax(int[][] m, int col) {\n        int best = m[0][col];\n        for (int r = 1; r < m.length; r++) {\n/* missing code */\n        }\n        return best;\n    }\n}"
    cands = [("if (m[r][col] > best) { best = m[r][col]; }", True, None), ("if (m[col][r] > best) { best = m[col][r]; }", False, "Swaps the row and column indexes, so it reads row col instead of column col."), ("if (m[r][col] < best) { best = m[r][col]; }", False, "Keeps the smallest value in the column."),
             ("best += m[r][col];", False, "Adds the column values instead of keeping the largest."), ("if (m[r][0] > best) { best = m[r][0]; }", False, "Always reads column 0 instead of the requested column.")]
    cases = [([[3, 8, 1], [4, 2, 9], [7, 5, 6]], 1), ([[3, 8, 1], [4, 2, 9], [7, 5, 6]], 2), ([[1, 5], [2, 4], [3, 3]], 0), ([[6, 2, 8, 1], [5, 9, 3, 4]], 3)]
    lit = lambda mm: "new int[][] { " + ", ".join("{ " + ", ".join(map(str, row)) + " }" for row in mm) + " }"  # noqa: E731
    tests = [(f"return Grid.colMax({lit(mm)}, {cc});", str(max(row[cc] for row in mm))) for mm, cc in cases]
    options = [{"text": f"`{c}`", "source": tpl.replace("/* missing code */", "            " + c), "why": w, "key": k} for c, k, w in cands]
    stem = "The method colMax is intended to return the largest value in column col of the rectangular two-dimensional array m. Which of the following can replace /* missing code */ so that colMax works as intended?"
    shown = tpl.replace("/* missing code */", "            /* missing code */")
    return mk_tests(rng, "cs_2d_col_max_completion", "4.13", "2.A", stem, shown, options, tests, concept="traverse one column of a 2D array with the row index varying", path="each candidate compiled and run on arrays vs Python column max", kwhy_by_key="The row index changes while the column index stays at col, and best keeps the larger value.")


# ======================= 4.14 순차 검색 비교 횟수 (3.A) =======================
@retry_any
def cs_linear_search_comparisons(rng):
    a = rng.sample(range(1, 30), rng.randint(7, 9)); t = rng.choice(a[2:-1])
    code = "int[] a = {" + ", ".join(map(str, a)) + "};\nint target = " + str(t) + ";\nint compares = 0;\nint idx = -1;\nfor (int i = 0; i < a.length && idx == -1; i++) {\n    compares++;\n    if (a[i] == target) {\n        idx = i;\n    }\n}\nSystem.out.println(idx + \" \" + compares);"
    i = a.index(t)
    muts = [{"why": "Counts the comparison only when the value is found.", "swap": ("compares++;\n    if (a[i] == target) {\n        idx = i;", "if (a[i] == target) {\n        compares++;\n        idx = i;")},
            {"why": "Believes the loop scans the whole array even after a match.", "swap": ("i < a.length && idx == -1;", "i < a.length;")},
            {"why": "Reports the position as one-based.", "swap": ("idx = i;", "idx = i + 1;")},
            {"why": "Starts the scan at the second element.", "swap": ("int i = 0;", "int i = 1;")}]
    return mk(rng, "cs_linear_search_comparisons", "4.14", "3.A", "What is printed as a result of executing the following code segment, which searches an array for a target value?", code, muts=muts, py=f"{i} {i + 1}", concept="a sequential search stops at the first match; the number of comparisons is the index plus one", path="javac+java output vs Python index", kwhy="The loop stops as soon as the target is found, so the comparisons equal the index plus one.", facts=[f"a={a}", f"t={t}"])


# ======================= 4.15 삽입 정렬 한 단계 (3.A) =======================
@retry_any
def cs_insertion_sort_pass_trace(rng):
    a = rng.sample(range(1, 20), 6); k = rng.randint(3, 4)
    code = "int[] a = {" + ", ".join(map(str, a)) + "};\nfor (int i = 1; i < " + str(k) + "; i++) {\n    int cur = a[i];\n    int j = i - 1;\n    while (j >= 0 && a[j] > cur) {\n        a[j + 1] = a[j];\n        j--;\n    }\n    a[j + 1] = cur;\n}\nSystem.out.println(Arrays.toString(a));"
    b = list(a)
    for i in range(1, k):
        cur = b[i]; j = i - 1
        while j >= 0 and b[j] > cur:
            b[j + 1] = b[j]; j -= 1
        b[j + 1] = cur
    muts = [{"why": "Stops the loop one pass early, so the last of the intended insertions is missing.", "swap": ("i < " + str(k) + ";", "i < " + str(k - 1) + ";")},
            {"why": "Stores the current value one position too far to the left, overwriting an element that was just shifted.", "swap": ("a[j + 1] = cur;", "a[j] = cur;")},
            {"why": "Sorts the whole array instead of only the first k elements.", "swap": ("i < " + str(k) + ";", "i < a.length;")},
            {"why": "Writes the current value to its original position, so the shifted values overwrite it incorrectly.", "swap": ("a[j + 1] = cur;", "a[i] = cur;")}]
    return mk(rng, "cs_insertion_sort_pass_trace", "4.15", "3.A", "What is printed as a result of executing the following code segment, which performs the first insertion-sort steps on an array?", code, muts=muts, py="[" + ", ".join(map(str, b)) + "]", concept="insertion sort shifts larger values right and inserts the current value", path="javac+java output vs Python insertion sort passes", kwhy="Each pass inserts a[i] into the already ordered prefix by shifting the larger values one position to the right.", facts=[f"a={a}", f"k={k}"])


# ======================= 4.16 재귀 호출 횟수 (3.C) =======================
@retry_any
def cs_recursion_calls_count(rng):
    n = rng.randint(5, 7)
    cls = "class Paths {\n    public static int calls = 0;\n\n    public static int f(int n) {\n        calls++;\n        if (n <= 1) {\n            return 1;\n        }\n        return f(n - 1) + f(n - 2);\n    }\n}"
    def f(n, c):
        c[0] += 1
        return 1 if n <= 1 else f(n - 1, c) + f(n - 2, c)
    c = [0]; val = f(n, c)
    call = f"Paths.calls = 0; int v = Paths.f({n}); return v + \" \" + Paths.calls;"
    muts = [{"why": "Reports the number of calls as n.", "call": f"Paths.calls = 0; int v = Paths.f({n}); return v + \" \" + {n};"},
            {"why": "Counts only the calls made by the first recursive branch.", "call": f"Paths.calls = 0; int v = Paths.f({n}); return v + \" \" + (Paths.calls - {c[0] // 2});"},
            {"why": "Reports the call count in place of the returned value.", "call": f"Paths.calls = 0; int v = Paths.f({n}); return Paths.calls + \" \" + Paths.calls;"},
            {"why": "Swaps the two numbers.", "call": f"Paths.calls = 0; int v = Paths.f({n}); return Paths.calls + \" \" + v;"}]
    stem = f"Consider the class Paths. What is returned by the code segment Paths.calls = 0; int v = Paths.f({n}); return v + \" \" + Paths.calls; (the value of v followed by the total number of calls made to f)?"
    return mk(rng, "cs_recursion_calls_count", "4.16", "3.C", stem, cls, call=call, muts=muts, py=f"{val} {c[0]}", concept="count the calls of a tree-recursive method", path="javac+java return value vs Python recursion with a counter", kwhy="Each call with n above 1 makes two further calls, so the total number of calls is counted over the whole call tree.", facts=[f"n={n}"])


# ======================= 4.17 자릿수 합 재귀 (3.C) =======================
@retry_any
def cs_recursion_digit_sum_trace(rng):
    n = rng.choice([4821, 9073, 5648, 1999, 3076])
    cls = "class Rec {\n    public static int ds(int n) {\n        if (n < 10) {\n            return n;\n        }\n        return n % 10 + ds(n / 10);\n    }\n}"
    muts = [{"why": "Returns the last digit only, treating the recursive call as the end.", "swap": ("return n % 10 + ds(n / 10);", "return n % 10;")},
            {"why": "Multiplies the digits instead of adding them.", "swap": ("return n % 10 + ds(n / 10);", "return n % 10 * ds(n / 10);")},
            {"why": "Keeps the leading digit in the recursion, so the first digit is added twice.", "swap": ("return n % 10 + ds(n / 10);", "return n % 10 + ds(n / 10) + n / 1000;")},
            {"why": "Recurses on n - 10 instead of n / 10, so the digits are not separated.", "swap": ("ds(n / 10)", "ds(n - 10)")}]
    return mk(rng, "cs_recursion_digit_sum_trace", "4.17", "3.C", f"Consider the class Rec. What is returned by the call Rec.ds({n})?", cls, call=f"return Rec.ds({n});", muts=muts, py=str(sum(int(c) for c in str(n))), concept="a recursive method that peels one digit per call", path="javac+java return value vs Python digit sum", kwhy="Each call adds the last digit to the result for the remaining digits, and the base case returns a one-digit number.", facts=[f"n={n}"])


# ======================= 4.9 사전조건 (4.B) =======================
def cs_precondition_list(rng):
    cases = [
        ("public static int middle(ArrayList<Integer> list) {\n        return list.get(list.size() / 2);\n    }", "The list is not empty.", "middle", "ArrayList<Integer> L = new ArrayList<Integer>(); return Probe.middle(L);"),
        ("public static int last(ArrayList<Integer> list) {\n        return list.get(list.size() - 1);\n    }", "The list is not empty.", "last", "ArrayList<Integer> L = new ArrayList<Integer>(); return Probe.last(L);"),
    ]
    code, pre, name, bad_call = pick(rng, cases)
    cls = f"class Probe {{\n    {code}\n}}"
    # 실행 확인: 빈 리스트는 예외, 원소가 하나인 리스트는 정상
    res = J.java_eval(cls, [("ret", bad_call), ("ret", "ArrayList<Integer> L = new ArrayList<Integer>(); L.add(4); return Probe." + name + "(L);"), ("ret", "ArrayList<Integer> L = new ArrayList<Integer>(); L.add(4); L.add(7); L.add(9); return Probe." + name + "(L);")])
    if "EXC:" not in res[0] or "EXC:" in res[1] or "EXC:" in res[2]:
        raise ValueError("precondition_expectation_failed")
    key = (pre, f"The call fails on an empty list: get is called with index {'0' if name == 'middle' else '-1'}, which is out of range. Nonempty lists work, so this is the needed precondition.")
    wrongs = [("The list has an even number of elements.", "A list with one or three elements works, so an even size is not needed."), ("The list contains only positive values.", "The values are never examined, only the position, so their sign does not matter."),
              ("The list has at least three elements.", "A list with a single element already works; requiring three is more than is needed.")]
    stem = "Which of the following is the weakest (least restrictive) precondition that guarantees the method will not throw an exception for a valid call?"
    return _text_item(rng, "cs_precondition_list", "4.9", "4.B", stem, cls, key, wrongs, "a precondition states what must be true for the method to run correctly", "java runs on an empty, a one-element, and a three-element list", [f"method={name}"])


# ======================= 4.12 사후조건 (4.B) =======================
def cs_postcondition_2d(rng):
    cls = "class Matrix {\n    /** Precondition: m is a rectangular array with at least one row. */\n    public static int[] rowFirsts(int[][] m) {\n        int[] out = new int[m.length];\n        for (int r = 0; r < m.length; r++) {\n            out[r] = m[r][0];\n        }\n        return out;\n    }\n}"
    res = J.java_eval(cls, [("ret", "return Matrix.rowFirsts(new int[][] {{4, 1}, {7, 2}, {9, 3}});"), ("ret", "return Matrix.rowFirsts(new int[][] {{5}});")])
    if J.tidy(res[0]) != "[4, 7, 9]" or J.tidy(res[1]) != "[5]":
        raise ValueError("expectation_failed")
    key = ("It returns a new array whose element at index r is the first element of row r of m.", "The loop stores m[r][0] in out[r] for every row, so the result has one entry per row.")
    wrongs = [("It returns a new array containing the first row of m.", "The method reads the first element of every row, not every element of the first row."),
              ("It returns the first element of m.", "The method returns an array, not a single value."),
              ("It changes m so that every row begins with the value 0.", "The method never assigns to m; it only reads from it."),
              ("It returns a new array whose element at index r is the sum of row r of m.", "The method reads one element per row; it does not add the elements.")]
    stem = "Which of the following best describes the postcondition (the result) of the method rowFirsts?"
    return _text_item(rng, "cs_postcondition_2d", "4.12", "4.B", stem, cls, key, wrongs, "a postcondition states what the method returns or changes", "java run on a 3x2 and a 1x1 array", ["method=rowFirsts"])


# ======================= 4.A 동작 설명 가족 2개 =======================
B.FAMILIES["row_ends_equal"] = (
    "public static int mystery(int[][] m) {\n        int c = 0;\n        for (int r = 0; r < m.length; r++) {\n            if (m[r][0] == m[r][m[r].length - 1]) {\n                c++;\n            }\n        }\n        return c;\n    }", "int[][]",
    [("the number of rows of m whose first element equals its last element", lambda m: sum(1 for row in m if row[0] == row[-1]), None),
     ("the number of rows of m whose first element is greater than its last element", lambda m: sum(1 for row in m if row[0] > row[-1]), "Believes the equality test is a comparison for greater-than."),
     ("the number of columns of m whose first element equals its last element", lambda m: sum(1 for c in range(len(m[0])) if m[0][c] == m[-1][c]), "Reads the matrix column by column instead of row by row."),
     ("the number of elements of m that equal the first element of their row", lambda m: sum(1 for row in m for v in row if v == row[0]), "Believes every element is compared with the first element of its row, not only the last one.")],
    [[[3, 5, 3], [1, 2, 4]], [[2, 7, 2], [6, 6, 6], [1, 9, 8]], [[5, 1], [5, 5]], [[4, 4, 1], [2, 8, 3], [7, 7, 7]]])
B.FAMILIES["first_min_index"] = (
    "public static int mystery(ArrayList<Integer> list) {\n        int idx = 0;\n        for (int i = 1; i < list.size(); i++) {\n            if (list.get(i) < list.get(idx)) {\n                idx = i;\n            }\n        }\n        return idx;\n    }", "list",
    [("the index of the first occurrence of the smallest value in list", lambda a: a.index(min(a)), None),
     ("the index of the last occurrence of the smallest value in list", lambda a: len(a) - 1 - a[::-1].index(min(a)), "Believes a strict comparison lets a later equal value replace the saved index."),
     ("the smallest value in list", lambda a: min(a), "Confuses the position of the smallest value with the value itself."),
     ("the number of values in list that are smaller than the first value", lambda a: sum(1 for v in a if v < a[0]), "Believes the loop only counts how many values are smaller than the first one.")],
    [[5, 2, 8, 2], [4, 4, 4], [9, 3, 6, 1, 1], [7, 6, 5, 4], [2, 9, 2, 9]])


def cs_describe_row_ends(rng):
    return B._describe(rng, "row_ends_equal", "cs_describe_row_ends", True, "4.12", "4.A")


def cs_describe_first_min(rng):
    return B._describe(rng, "first_min_index", "cs_describe_first_min", True, "4.9", "4.A")
