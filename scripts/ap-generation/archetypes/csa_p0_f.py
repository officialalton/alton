"""AP Computer Science A P0 원형 F — 두 번째 풀 모의고사(겹침 0)를 위한 새 구조: 단원 3(Class Creation)·4(Data Collections) 단독 + 1.15 동작 설명, ArrayList 2문항 세트 1개.
규칙은 csa_common.py·csa_p0_e.py 와 같다(Java 실행 정답, 독립 Python 참조, 이름 붙은 오개념 변형, 후보 전부 컴파일·경계 테스트)."""
import math
from csa_common import *  # noqa: F401,F403
from csa_p0_a import client, pick, STEM_OUT
from csa_p0_e import retry_any
import csa_p0_b as B
import csa_java as J


def _describe_obj(rng, arch, topic, skill, cls, tests, descs, stem, concept):
    """객체 메서드 동작 설명 문항: tests=[(호출 본문, 파이썬 데이터)], descs=[(영어 설명, f(데이터)->값, 오답 이유 또는 None(정답))]. 정답 설명은 모든 테스트에서 실행 결과와 같고 오답 설명은 최소 한 테스트에서 다르다."""
    res = J.java_eval(cls, [("ret", body) for body, _d in tests])
    actual = [J.tidy(r) for r in res]
    for text, fn, why in descs:
        match = [str(fn(d)) == a for (_b, d), a in zip(tests, actual)]
        if why is None and not all(match):
            raise ValueError("key_description_not_true_on_all_tests")
        if why is not None and all(match):
            raise ValueError("distractor_description_true_on_all_tests")
    key = Opt(descs[0][0], True, "On every test sequence the value returned by running the method equals this description, which is what the loop computes.", None)
    ds = [Opt(t, False, w, None) for t, _f, w in descs[1:]]
    p = pack(arch, topic, skill, "not_allowed", stem, key, ds, rng, stimulus=code_stim(cls), est=95, facts=[f"tests={len(tests)}", f"concept={concept}"])
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate([o for j, o in enumerate(p["options"]) if j != p["key_index"]])]
    p["blueprint"] = mc_blueprint(arch, SUB, topic, skill, "not_allowed", concept, "work out what the method computes for the objects built in the tests and compare with each description", [("the key description holds for every test run through the JDK", "javac+java test run"), ("each distractor description fails on at least one test", "java test run")], mis,
                                  "javac+java runs the method after several record sequences; each English description has a Python predicate that must agree (key) or disagree (distractors)", material={"type": "code", "must_include": ["the class"]}, method="javac+java + python predicates", extra={"judgment_demand": "generalize from code to an English description"})
    return p


# ======================= 3.4 생성자 완성 (2.B) =======================
def cs_constructor_completion(rng):
    d = rng.randint(5, 15)
    tpl = f"class Ticket {{\n    private String name;\n    private int price;\n\n    public Ticket(String name, int price) {{\n        this.name = name;\n        this.price = price;\n    }}\n\n    /** Creates a ticket with the given name and a price of {d}. */\n    public Ticket(String name) {{\n/*BODY*/\n    }}\n\n    public String describe() {{\n        return name + \":\" + price;\n    }}\n}}"
    shown = tpl.replace("/*BODY*/", "        /* missing code */")
    cands = [(f"this.name = name;\n        price = {d};", True, None),
             (f"name = name;\n        price = {d};", False, "Assigns the parameter to itself, so the instance variable name is never set."),
             ("this.name = name;", False, f"Never sets the price, which stays 0 instead of {d}."),
             (f"name = \"ticket\";\n        price = {d};", False, "Stores a fixed name instead of the parameter.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "        " + c), "why": w, "key": k} for c, k, w in cands]
    tests = [('return new Ticket("A").describe();', f"A:{d}"), ('return new Ticket("Bob").describe();', f"Bob:{d}"), ('return new Ticket("X", 3).describe();', "X:3")]
    return mk_tests(rng, "cs_constructor_completion", "3.4", "2.B", f"The one-parameter Ticket constructor is intended to create a ticket with the given name and a price of {d}. Which of the following can replace /* missing code */ so that the constructor works as intended?", shown, options, tests,
                    concept="a constructor that must set every instance variable and must not shadow a field with a parameter", path="each candidate compiled into the class and the describe results compared with expected text; the two-parameter constructor is also called",
                    kwhy_by_key=f"this.name distinguishes the instance variable from the parameter and the price is set to the default {d}, so describe reports both.")


# ======================= 3.8 범위 (3.A) =======================
@retry_any
def cs_scope_trace(rng):
    n, k, m = rng.randint(3, 6), rng.randint(2, 4), rng.randint(2, 5)
    code = f"int total = 0;\nfor (int i = 0; i < {n}; i++) {{\n    int temp = i * {k};\n    total += temp;\n}}\nint temp = total / {m};\nSystem.out.println(temp + \" \" + total);"
    total = k * n * (n - 1) // 2
    py = f"{total // m} {total}"
    muts = [{"why": "Believes the temp declared in the loop body still holds its last value after the loop, so the new declaration is ignored.", "call": f"int total = 0;\nfor (int i = 0; i < {n}; i++) {{\n    int temp = i * {k};\n    total += temp;\n}}\nSystem.out.println({(n - 1) * k} + \" \" + total);"},
            {"why": "Believes the assignment replaces total instead of accumulating into it.", "swap": ("total += temp;", "total = temp;")},
            {"why": "Reads the division by a number as the remainder operator.", "swap": (f"total / {m}", f"total % {m}")},
            {"why": "Lets the loop run one extra pass.", "swap": (f"i < {n}", f"i <= {n}")}]
    return mk(rng, "cs_scope_trace", "3.8", "3.A", STEM_OUT, code, muts=muts, py=py, concept="a variable declared in a loop body goes out of scope, so the same name can be declared again after the loop",
              path="javac+java output vs Python loop sums", kwhy=f"total accumulates 0, {k}, {2 * k}, ... to {total}; the loop's temp is out of scope, so the new temp is total / {m} = {total // m}.", facts=[f"key={py}"])


# ======================= 3.5 메서드 작성: 한계값 유지 (2.B) =======================
def cs_clamp_completion(rng):
    lo, hi = rng.randint(0, 5), rng.randint(15, 30)
    tpl = f"class Thermostat {{\n    private int temp;\n    private int min;\n    private int max;\n\n    public Thermostat(int start, int low, int high) {{\n        temp = start;\n        min = low;\n        max = high;\n    }}\n\n    /** Changes the temperature by delta, but never below min or above max: the temperature stops at the limit. */\n    public void adjust(int delta) {{\n/*BODY*/\n    }}\n\n    public int getTemp() {{\n        return temp;\n    }}\n}}"
    shown = tpl.replace("/*BODY*/", "        /* missing code */")
    cands = [("temp += delta;\n        if (temp > max) {\n            temp = max;\n        }\n        if (temp < min) {\n            temp = min;\n        }", True, None),
             ("temp += delta;\n        if (temp > max) {\n            temp = max;\n        }", False, "Limits only the upper end, so the temperature can fall below min."),
             ("if (temp + delta <= max && temp + delta >= min) {\n            temp += delta;\n        }", False, "Ignores a change that would leave the range instead of stopping at the limit."),
             ("temp = delta;", False, "Replaces the temperature with delta instead of changing it by delta."),
             ("temp += delta;\n        if (temp > max) {\n            temp = min;\n        }\n        if (temp < min) {\n            temp = max;\n        }", False, "Wraps around to the other limit instead of stopping at the limit.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "        " + c), "why": w, "key": k} for c, k, w in cands]
    start = (lo + hi) // 2
    seqs = [[3], [hi], [-hi], [-2, -3], [hi - start + 1, -1], [0]]

    def sim(seq):
        t = start
        for d in seq:
            t += d
            t = min(max(t, lo), hi)
        return t
    tests = [(f"Thermostat t = new Thermostat({start}, {lo}, {hi}); " + " ".join(f"t.adjust({d});" for d in sq) + " return t.getTemp();", str(sim(sq))) for sq in seqs]
    return mk_tests(rng, "cs_clamp_completion", "3.5", "2.B", "The method adjust is intended to change the temperature by delta but never let it go below min or above max; at a limit the temperature stops. Which of the following can replace /* missing code */ so that adjust works as intended?", shown, options, tests,
                    concept="write a mutator that updates an instance variable and keeps it inside a range", path="each candidate compiled into the class and run on adjustment sequences that cross each limit; expected values from a Python clamp",
                    kwhy_by_key="It applies the change and then corrects the value at each limit: values above max become max and values below min become min.")


# ======================= 3.5 도우미 메서드 호출 완성 (2.C) =======================
def cs_helper_use_completion(rng):
    tpl = "class Compare {\n    /** Returns the larger of a and b. */\n    public static int larger(int a, int b) {\n        if (a > b) {\n            return a;\n        }\n        return b;\n    }\n\n    /** Returns the largest of a, b and c. The method must call larger. */\n    public static int largest(int a, int b, int c) {\n        return /*BODY*/;\n    }\n}"
    shown = tpl.replace("/*BODY*/", "/* missing code */")
    cands = [("larger(larger(a, b), c)", True, None), ("larger(a, b)", False, "Ignores c, so a third value that is the largest is never returned."), ("larger(a, c)", False, "Ignores b, so a middle argument that is the largest is never returned."), ("larger(larger(a, b), a)", False, "Compares the larger of a and b with a again instead of with c."), ("larger(b, c)", False, "Ignores a, so a first argument that is the largest is never returned.")]
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", c), "why": w, "key": k} for c, k, w in cands]
    triples = [(3, 5, 4), (9, 1, 2), (1, 2, 9), (2, 9, 3), (4, 4, 4), (-5, -2, -9)]
    tests = [(f"return Compare.largest({a}, {b}, {c});", str(max(a, b, c))) for a, b, c in triples]
    return mk_tests(rng, "cs_helper_use_completion", "3.5", "2.C", "The method largest is intended to return the largest of its three arguments by calling the method larger. Which of the following can replace /* missing code */ so that largest works as intended?", shown, options, tests,
                    concept="combine calls to a helper method so every argument takes part in the result", path="each candidate compiled and run on triples where each argument in turn is the largest, plus ties and negatives",
                    kwhy_by_key="larger(a, b) is the larger of the first two values, and comparing that result with c gives the largest of all three.")


def cs_instance_helper_completion(rng):
    tpl = "class Cart {\n    private int total;\n    private int items;\n\n    public Cart() {\n        total = 0;\n        items = 0;\n    }\n\n    /** Adds one item with the given price. */\n    public void addItem(int price) {\n        total += price;\n        items++;\n    }\n\n    /** Adds count items that each have the given price by calling addItem. */\n    public void addItems(int price, int count) {\n/*BODY*/\n    }\n\n    public int getTotal() {\n        return total;\n    }\n\n    public int getItems() {\n        return items;\n    }\n}"
    shown = tpl.replace("/*BODY*/", "        /* missing code */")
    cands = [("for (int i = 0; i < count; i++) {\n            addItem(price);\n        }", True, None),
             ("addItem(price * count);", False, "Makes one call with the combined price, so the number of items goes up by only 1."),
             ("total += price * count;", False, "Changes the total but never updates the number of items."),
             ("for (int i = 0; i <= count; i++) {\n            addItem(price);\n        }", False, "Makes one call too many because the loop test uses <=."),
             ("for (int i = 0; i < count; i++) {\n            addItem(price * i);\n        }", False, "Passes a different price on each call instead of the same price.")]
    options = [{"text": f"```\n{c}\n```" if chr(10) in c else f"`{c}`", "source": tpl.replace("/*BODY*/", "        " + c), "why": w, "key": k} for c, k, w in cands]
    cases = [(5, 3), (7, 1), (4, 0), (2, 6), (10, 2)]
    tests = [(f"Cart c = new Cart(); c.addItems({p}, {n}); return c.getItems() + \":\" + c.getTotal();", f"{n}:{p * n}") for p, n in cases]
    return mk_tests(rng, "cs_instance_helper_completion", "3.5", "2.C", "The method addItems is intended to add count items with the same price to the cart by calling addItem. Which of the following can replace /* missing code */ so that addItems works as intended?", shown, options, tests,
                    concept="call another method of the same class repeatedly so that all of its side effects happen", path="each candidate compiled into the class; both the item count and the total are checked after several calls",
                    kwhy_by_key="Calling addItem once per item updates the total and the item count exactly as count separate additions would.")


# ======================= 3.5 메서드 동작 설명 (4.A) =======================
TRACKER = "class Tracker {\n    private int[] marks;\n    private int size;\n\n    public Tracker(int capacity) {\n        marks = new int[capacity];\n        size = 0;\n    }\n\n    public void record(int mark) {\n        if (size < marks.length) {\n            marks[size] = mark;\n            size++;\n        }\n    }\n\n    public int mystery() {\n        int c = 0;\n        for (int i = 1; i < size; i++) {\n            if (marks[i] > marks[i - 1]) {\n                c++;\n            }\n        }\n        return c;\n    }\n}"


def cs_class_describe(rng):
    cap = 5
    seqs = [[3, 5, 2, 8], [1, 2, 3, 4, 5, 6], [], [7], [4, 4, 4], [9, 1, 9, 1], [2, 8, 1, 9, 3]]

    def kept(s):
        return s[:cap]
    descs = [("the number of recorded marks that are greater than the mark recorded just before them", lambda s: sum(1 for i in range(1, len(kept(s))) if kept(s)[i] > kept(s)[i - 1]), None),
             ("the number of recorded marks that are greater than the first recorded mark", lambda s: sum(1 for v in kept(s)[1:] if v > kept(s)[0]), "Believes each mark is compared with the first mark instead of the one before it."),
             ("the number of recorded marks that are less than the mark recorded just before them", lambda s: sum(1 for i in range(1, len(kept(s))) if kept(s)[i] < kept(s)[i - 1]), "Believes the comparison counts decreases instead of increases."),
             ("the number of marks that have been passed to record", lambda s: len(s), "Believes the method counts every call to record, including calls ignored when the tracker is full.")]
    tests = [(f"Tracker t = new Tracker({cap}); " + " ".join(f"t.record({v});" for v in s) + " return t.mystery();", s) for s in seqs]
    return _describe_obj(rng, "cs_class_describe", "3.5", "4.A", TRACKER, tests, descs, "A Tracker object is created with a capacity and receives marks through record. Which of the following best describes the value returned by the method mystery?", "describe the behavior of an instance method that depends on object state")


# ======================= 4.3 배열 참조 전달 (3.B) =======================
ARRAYOPS = "class ArrayOps {\n    public static void doubleAll(int[] a) {\n        for (int i = 0; i < a.length; i++) {\n            a[i] = a[i] * 2;\n        }\n    }\n\n    public static int[] doubled(int[] a) {\n        int[] b = new int[a.length];\n        for (int i = 0; i < a.length; i++) {\n            b[i] = a[i] * 2;\n        }\n        return b;\n    }\n}"


@retry_any
def cs_array_ref_pass(rng):
    x, y = rng.randint(2, 9), rng.randint(2, 9)
    stm = f"int[] v = {{ {x}, {y} }};\nint[] w = ArrayOps.doubled(v);\nArrayOps.doubleAll(v);\nw[0]++;\nSystem.out.println(v[0] + \" \" + w[0] + \" \" + (v == w));"
    py = f"{2 * x} {2 * x + 1} false"
    muts = [{"why": "Believes a method that returns an array returns the very array it received, so v and w are the same object.", "swap": ("int[] b = new int[a.length];", "int[] b = a;")},
            {"why": "Believes a method cannot change the array that is passed to it, so v keeps its original values.", "call": stm.replace("ArrayOps.doubleAll(v);\n", "")},
            {"why": "Believes incrementing w[0] also changes v[0] because both came from the same data.", "call": stm.replace("w[0]++;", "w[0]++;\nv[0]++;")},
            {"why": "Believes == compares the elements of two arrays instead of their references.", "call": stm.replace("(v == w)", "(v[1] == w[1])")}]
    return mk(rng, "cs_array_ref_pass", "4.3", "3.B", STEM_OUT, ARRAYOPS, call=stm, muts=muts, py=py, stim_code=ARRAYOPS + "\n\n" + client(stm), concept="an array parameter shares the caller's array; a new array is a separate object",
              path="javac+java output vs Python list copy and in-place update", kwhy=f"doubleAll changes the caller's array in place, so v[0] is {2 * x}; doubled returned a separate array that held {2 * x} and was then incremented to {2 * x + 1}; v and w are different objects.", facts=[f"key={py}"])


# ======================= 4.8 ArrayList add/remove/set (3.B) =======================
@retry_any
def cs_arraylist_insert_remove(rng):
    a, b, c, d, e = rng.sample(range(5, 40), 5)
    code = (f"ArrayList<Integer> list = new ArrayList<Integer>();\nlist.add({a});\nlist.add({b});\nlist.add({c});\nlist.add(1, {d});\nlist.remove(2);\nlist.remove(Integer.valueOf({c}));\nlist.set(0, list.get(0) + {e});\nSystem.out.println(list);")
    lst = [a, b, c]; lst.insert(1, d); lst.pop(2); lst.remove(c); lst[0] += e
    py = str(lst).replace("'", "")
    muts = [{"why": "Believes remove(2) removes the value 2 instead of the element at index 2.", "swap": ("list.remove(2);", "list.remove(Integer.valueOf(2));")},
            {"why": "Believes add(1, x) replaces the element at index 1 instead of inserting before it.", "swap": (f"list.add(1, {d});", f"list.set(1, {d});")},
            {"why": "Believes remove with an Integer argument removes the element at that index.", "swap": (f"list.remove(Integer.valueOf({c}));", f"list.remove({c});")},
            {"why": "Believes set inserts a new element at index 0 instead of replacing the element there.", "swap": (f"list.set(0, list.get(0) + {e});", f"list.add(0, list.get(0) + {e});")}]
    return mk(rng, "cs_arraylist_insert_remove", "4.8", "3.B", STEM_OUT, code, muts=muts, py=py, concept="ArrayList add at an index, remove by index versus by value, and set",
              path="javac+java output vs Python list insert, pop(index), remove(value) and assignment", kwhy=f"add(1, {d}) inserts, remove(2) removes by index, remove(Integer.valueOf({c})) removes by value, and set replaces the first element: {py}.", facts=[f"key={py}"])


# ======================= 4.15 삽입 정렬 완성 (2.A) =======================
def cs_insertion_completion(rng):
    tpl = "class Sorter {\n    /** Sorts arr into ascending order. */\n    public static void insertionSort(int[] arr) {\n        for (int i = 1; i < arr.length; i++) {\n            int key = arr[i];\n            int j = i;\n/*BODY*/\n            arr[j] = key;\n        }\n    }\n}"
    shown = tpl.replace("/*BODY*/", "            /* missing code */")
    cands = [("while (j > 0 && arr[j - 1] > key) {\n                arr[j] = arr[j - 1];\n                j--;\n            }", True, None),
             ("while (arr[j - 1] > key && j > 0) {\n                arr[j] = arr[j - 1];\n                j--;\n            }", False, "Tests arr[j - 1] before j > 0, so an out-of-range index is read when the key is the smallest so far."),
             ("while (j > 0 && arr[j - 1] < key) {\n                arr[j] = arr[j - 1];\n                j--;\n            }", False, "Moves the smaller elements to the right, which orders the values from largest to smallest."),
             ("while (j > 0 && arr[j - 1] > key) {\n                j--;\n            }", False, "Moves the position but never shifts the larger elements to the right, so values are overwritten.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "            " + c), "why": w, "key": k} for c, k, w in cands]
    arrs = [[3, 1, 2], [1, 2, 3], [5], [2, 2, 1], [9, 7, 8, 1], [4, 3, 2, 1, 0]]
    tests = [("int[] a = { " + ", ".join(map(str, a)) + " }; Sorter.insertionSort(a); return a;", "[" + ", ".join(map(str, sorted(a))) + "]") for a in arrs]
    return mk_tests(rng, "cs_insertion_completion", "4.15", "2.A", "The method insertionSort is intended to sort arr into ascending order. Which of the following can replace /* missing code */ so that insertionSort works as intended?", shown, options, tests,
                    concept="the inner shifting loop of insertion sort and the order of its boundary test", path="each candidate compiled and run on reversed, sorted, tied and one-element arrays; expected values from Python sorted()",
                    kwhy_by_key="While the element before position j is larger than the key, it is shifted one place to the right; the j > 0 test comes first so arr[j - 1] is never read out of range.")


# ======================= 4.17 재귀 이진 탐색 추적 (3.C) =======================
FINDER = "class Finder {\n    private static int calls = 0;\n\n    public static int search(int[] a, int target, int lo, int hi) {\n        calls++;\n        if (lo > hi) {\n            return -1;\n        }\n        int mid = (lo + hi) / 2;\n        if (a[mid] == target) {\n            return mid;\n        }\n        if (a[mid] < target) {\n            return search(a, target, mid + 1, hi);\n        }\n        return search(a, target, lo, mid - 1);\n    }\n\n    public static int getCalls() {\n        return calls;\n    }\n}"


def _py_rbs(a, t):
    calls = 0

    def rec(lo, hi):
        nonlocal calls
        calls += 1
        if lo > hi:
            return -1
        mid = (lo + hi) // 2
        if a[mid] == t:
            return mid
        return rec(mid + 1, hi) if a[mid] < t else rec(lo, mid - 1)
    r = rec(0, len(a) - 1)
    return r, calls


@retry_any
def cs_recursive_binary_trace(rng):
    a = sorted(rng.sample(range(2, 60), 8))
    t = pick(rng, a[1:7]) if rng.random() < 0.6 else rng.choice([v for v in range(1, 61) if v not in a])
    arr = "{ " + ", ".join(map(str, a)) + " }"
    stm = f"int[] a = {arr};\nint idx = Finder.search(a, {t}, 0, a.length - 1);\nSystem.out.println(idx + \" \" + Finder.getCalls());"
    r, calls = _py_rbs(a, t)
    py = f"{r} {calls}"
    muts = [{"why": "Believes the middle index is rounded up when the range has an even number of positions.", "swap": ("int mid = (lo + hi) / 2;", "int mid = (lo + hi + 1) / 2;")},
            {"why": "Believes the recursion stops as soon as lo equals hi, so a one-position range is never examined.", "swap": ("if (lo > hi) {", "if (lo >= hi) {")},
            {"why": "Believes the method returns the value that was found instead of its index.", "swap": ("return mid;", "return a[mid];")},
            {"why": "Does not count the final call that ends the recursion.", "swap": ("calls++;\n        if (lo > hi) {\n            return -1;\n        }", "if (lo > hi) {\n            return -1;\n        }\n        calls++;")}]
    return mk(rng, "cs_recursive_binary_trace", "4.17", "3.C", STEM_OUT, FINDER, call=stm, muts=muts, py=py, stim_code=FINDER + "\n\n" + client(stm), concept="recursive binary search: the returned index and the number of recursive calls",
              path="javac+java output vs Python recursion with a call counter", kwhy=f"Searching {a} for {t} makes {calls} calls and returns {r}.", facts=[f"a={a}", f"t={t}", f"key={py}"])


# ======================= 4.13 2D 대각선 완성 (2.A) =======================
def cs_2d_diag_completion(rng):
    tpl = "class Matrix {\n    /** Returns the sum of the main diagonal (top left to bottom right) of m, a square array. */\n    public static int diagonalSum(int[][] m) {\n        int sum = 0;\n        for (int i = 0; i < m.length; i++) {\n/*BODY*/\n        }\n        return sum;\n    }\n}"
    shown = tpl.replace("/*BODY*/", "            /* missing code */")
    cands = [("sum += m[i][i];", True, None), ("sum += m[i][m.length - 1 - i];", False, "Adds the other diagonal, from top right to bottom left."), ("sum += m[i][0];", False, "Adds the first column."), ("sum += m[0][i];", False, "Adds the first row.")]
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", "            " + c), "why": w, "key": k} for c, k, w in cands]
    ms = [[[1, 2], [3, 4]], [[5]], [[1, 2, 3], [4, 5, 6], [7, 8, 9]], [[2, 0, 0], [0, 3, 0], [0, 0, 4]], [[9, 1], [1, 8]], [[0, 7, 1], [2, 5, 3], [4, 6, 8]]]
    tests = [("return Matrix.diagonalSum(new int[][] { " + ", ".join("{ " + ", ".join(map(str, r)) + " }" for r in m) + " });", str(sum(m[i][i] for i in range(len(m))))) for m in ms]
    return mk_tests(rng, "cs_2d_diag_completion", "4.13", "2.A", "The method diagonalSum is intended to return the sum of the main diagonal of a square 2D array. Which of the following can replace /* missing code */ so that diagonalSum works as intended?", shown, options, tests,
                    concept="use the same index for the row and the column to visit a diagonal", path="each candidate compiled and run on square arrays whose diagonals, rows and columns have different sums; expected values from Python",
                    kwhy_by_key="Using i as both the row index and the column index visits the elements m[0][0], m[1][1], ... of the main diagonal once each.")


# ======================= 1.15 String 동작 설명 (4.A) =======================
B.FAMILIES["every_other"] = ("public static String mystery(String s) {\n        String r = \"\";\n        for (int i = 0; i < s.length(); i += 2) {\n            r += s.substring(i, i + 1);\n        }\n        return r;\n    }", "String",
                            [("the characters of s at even-numbered indexes (0, 2, 4, ...), in their original order", lambda s: s[0::2], None),
                             ("the characters of s at odd-numbered indexes (1, 3, 5, ...), in their original order", lambda s: s[1::2], "Believes the first pass of the loop skips the character at index 0."),
                             ("the characters of s at even-numbered indexes, in reverse order", lambda s: s[0::2][::-1], "Believes += puts each new character in front of the String built so far."),
                             ("the first half of s", lambda s: s[: len(s) // 2], "Believes the step of 2 stops the loop at the middle of the String.")],
                            ["computer", "abc", "", "a", "abcdef", "programming", "xyzzy"])


def cs_describe_every_other(rng):
    return B._describe(rng, "every_other", "cs_describe_every_other", True, "1.15", "4.A")


# ======================= 3.5 초기 조건 (4.B) =======================
PRE_CLS = {
    "grade": ("class Grade {\n    private int[] scores;\n\n    public Grade(int[] scores) {\n        this.scores = scores;\n    }\n\n    public int average() {\n        int sum = 0;\n        for (int s : scores) {\n            sum += s;\n        }\n        return sum / scores.length;\n    }\n}",
              [("new Grade(new int[0]).average()", True, "The array has no elements, so the division is by zero and an ArithmeticException is thrown."), ("new Grade(new int[] { 0 }).average()", False, "One element: the sum 0 is divided by 1, which is allowed."), ("new Grade(new int[] { -4, 4 }).average()", False, "Two elements whose sum is 0; dividing 0 by 2 is allowed."), ("new Grade(new int[] { 100, 90, 80 }).average()", False, "Three elements; the average is 90.")],
              "Which of the following expressions, evaluated after the Grade class is compiled, causes a run-time exception?"),
    "initial": ("class Person {\n    private String name;\n\n    public Person(String name) {\n        this.name = name;\n    }\n\n    public String initial() {\n        return name.substring(0, 1);\n    }\n}",
                [("new Person(\"\").initial()", True, "An empty String has no character at index 0, so substring(0, 1) throws a StringIndexOutOfBoundsException."), ("new Person(\"A\").initial()", False, "A one-character String has the substring from 0 to 1."), ("new Person(\"Alex\").initial()", False, "The first character exists."), ("new Person(\"  \").initial()", False, "Spaces are characters, so the substring exists.")],
                "Which of the following expressions, evaluated after the Person class is compiled, causes a run-time exception?"),
}


def cs_precondition_class(rng):
    fam = pick(rng, sorted(PRE_CLS))
    cls, calls, stem = PRE_CLS[fam]
    res = J.java_eval(cls, [("ret", f"return {c};") for c, _k, _w in calls])
    if ["EXC:" in r for r in res] != [k for _c, k, _w in calls]:
        raise ValueError("exactly_one_expression_must_throw")
    key = Opt(f"`{calls[0][0]}`", True, calls[0][2], None)
    ds = [Opt(f"`{c}`", False, w, None) for c, _k, w in calls[1:]]
    p = pack("cs_precondition_class", "3.5", "4.B", "not_allowed", stem, key, ds, rng, stimulus=code_stim(cls), est=70, facts=[f"family={fam}"])
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate([o for j, o in enumerate(p["options"]) if j != p["key_index"]])]
    p["blueprint"] = mc_blueprint("cs_precondition_class", SUB, "3.5", "4.B", "not_allowed", "initial conditions under which a method of a class works as intended", "check each constructor argument against what the method needs", [("exactly the key expression throws when each expression is run with the JDK", "java run of all four expressions")], mis, "javac+java runs every option expression and records which throw an exception",
                                  material={"type": "code", "must_include": ["the class"]}, method="javac+java run of each option", extra={"judgment_demand": "identify the object state that violates the method's precondition"})
    return p


# ======================= 3.3 클래스 사용 컴파일 오류 (3.D) =======================
BOX = "class Box {\n    private int side;\n\n    public Box(int s) {\n        side = s;\n    }\n\n    public int area() {\n        return side * side;\n    }\n\n    public static int unit() {\n        return 1;\n    }\n}"


def cs_compile_error_calls(rng):
    """3.3 / 3.D: 클래스를 잘못 쓰는 문장 하나 — 후보를 각각 컴파일해 판정."""
    good_pool = [("Box b = new Box(3);", "The one-parameter constructor accepts an int."), ("int a = new Box(2).area();", "area is an instance method that returns an int."), ("int u = Box.unit();", "unit is a static method and can be called on the class."), ("Box c = new Box(4);\n        int k = c.area() + 1;", "area returns an int, which can be used in arithmetic."), ("double d = new Box(5).area();", "An int result can be widened to a double.")]
    bad_pool = [("int x = Box.area();", "area is an instance method and cannot be called on the class name."), ("Box d = new Box();", "The class has no constructor without parameters."), ("int y = new Box(2).side;", "side is private and cannot be accessed outside the class."), ("String t = new Box(2).area();", "An int cannot be assigned to a String."), ("Box e = new Box(\"3\");", "The constructor needs an int, not a String.")]
    bad = pick(rng, bad_pool)
    goods = rng.sample(good_pool, 3)
    cands = [bad] + goods
    ok = [J.compiles(BOX + "\npublic class Main {\n    public static void main(String[] args) {\n        " + c + "\n    }\n}")[0] for c, _ in cands]
    if ok != [False, True, True, True]:
        raise ValueError("compile_candidates_not_exactly_one_failing")
    one = lambda t: f"`{t}`" if chr(10) not in t else "```\n" + t.replace(chr(10) + "        ", chr(10)) + "\n```"  # noqa: E731
    key = Opt(one(bad[0]), True, bad[1], None)
    ds = [Opt(one(g[0]), False, "This statement compiles: " + g[1], None) for g in goods]
    p = pack("cs_compile_error_calls", "3.3", "3.D", "not_allowed", "Which of the following statements, if placed in a main method of another class, causes a compile-time error?", key, ds, rng, stimulus=code_stim(BOX), est=75, facts=[f"bad={bad[0]}"])
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate([o for j, o in enumerate(p["options"]) if j != p["key_index"]])]
    p["blueprint"] = mc_blueprint("cs_compile_error_calls", SUB, "3.3", "3.D", "not_allowed", "access rules and signatures when a client uses a class", "decide whether each statement respects the constructor, access and static rules of Box", [("exactly one statement fails javac when placed in a client of Box", "javac run on each statement")], mis, "javac compiles each candidate statement inside a main method next to the class",
                                  material={"type": "code", "must_include": ["the class"]}, method="javac compile of each option", extra={"judgment_demand": "apply Java access, static and constructor rules"})
    return p


# ======================= 4.3 배열·문자열 초기 조건 (4.B) =======================
PRE_ARR = {
    "pair": ("class Tools {\n    public static int pairSum(int[] a, int i) {\n        return a[i] + a[i + 1];\n    }\n}",
             [("Tools.pairSum(new int[] { 4, 5, 6 }, 2)", True, "Index 3 is past the end of a three-element array, so an ArrayIndexOutOfBoundsException is thrown."), ("Tools.pairSum(new int[] { 4, 5, 6 }, 0)", False, "Indexes 0 and 1 exist."), ("Tools.pairSum(new int[] { 4, 5, 6 }, 1)", False, "Indexes 1 and 2 exist."), ("Tools.pairSum(new int[] { 4, 5 }, 0)", False, "Indexes 0 and 1 exist in a two-element array.")],
             "Which of the following calls to pairSum causes a run-time exception?"),
    "last": ("class Tools {\n    public static int lastValue(int[] a) {\n        return a[a.length - 1];\n    }\n}",
             [("Tools.lastValue(new int[0])", True, "An empty array has no last element; the index -1 throws an ArrayIndexOutOfBoundsException."), ("Tools.lastValue(new int[] { 7 })", False, "A one-element array has a last element at index 0."), ("Tools.lastValue(new int[] { 7, 8 })", False, "The last element is at index 1."), ("Tools.lastValue(new int[3])", False, "An array of three zeros has a last element at index 2.")],
             "Which of the following calls to lastValue causes a run-time exception?"),
}


def cs_precondition_array(rng):
    fam = pick(rng, sorted(PRE_ARR))
    code, calls, stem = PRE_ARR[fam]
    res = J.java_eval(code, [("ret", f"return {c};") for c, _k, _w in calls])
    if ["EXC:" in r for r in res] != [k for _c, k, _w in calls]:
        raise ValueError("exactly_one_call_must_throw")
    key = Opt(f"`{calls[0][0]}`", True, calls[0][2], None)
    ds = [Opt(f"`{c}`", False, w, None) for c, _k, w in calls[1:]]
    p = pack("cs_precondition_array", "4.3", "4.B", "not_allowed", stem, key, ds, rng, stimulus=code_stim(code), est=70, facts=[f"family={fam}"])
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate([o for j, o in enumerate(p["options"]) if j != p["key_index"]])]
    p["blueprint"] = mc_blueprint("cs_precondition_array", SUB, "4.3", "4.B", "not_allowed", "initial conditions on the length and indexes of an array argument", "check each argument against the indexes the method reads", [("exactly the key call throws when each call is run with the JDK", "java run of all four calls")], mis, "javac+java runs every option call and records which throw an exception",
                                  material={"type": "code", "must_include": ["the method"]}, method="javac+java run of each option", extra={"judgment_demand": "identify the argument that makes an index invalid"})
    return p


# ======================= 2문항 세트: ArrayList 메서드 (추적 + 동작 설명) =======================
B.FAMILIES["list_descents"] = ("public static int mystery(ArrayList<Integer> list) {\n        int c = 0;\n        for (int i = 0; i < list.size() - 1; i++) {\n            if (list.get(i) > list.get(i + 1)) {\n                c++;\n            }\n        }\n        return c;\n    }", "list",
                               [("the number of positions where a value is greater than the value that follows it", lambda a: sum(1 for i in range(len(a) - 1) if a[i] > a[i + 1]), None),
                                ("the number of values that are greater than the first value", lambda a: sum(1 for v in a if v > a[0]), "Believes each value is compared with the first value."),
                                ("the number of positions where a value is less than the value that follows it", lambda a: sum(1 for i in range(len(a) - 1) if a[i] < a[i + 1]), "Believes the comparison counts increases instead of decreases."),
                                ("the number of times the largest value appears in the list", lambda a: a.count(max(a)), "Believes the counter tracks the maximum.")],
                               [[3, 1, 2], [1, 2, 3], [5, 5, 5], [4, 2, 6, 1], [7], [9, 8, 7, 6], [1, 3, 2, 4, 3]])


@retry_any
def css_list_set(rng):
    """세트: 같은 ArrayList 메서드 — (1) 구체적 리스트의 반환값, (2) 동작 설명."""
    code, kind, descs, tests = B.FAMILIES["list_descents"]
    cls = f"class Probe {{\n    {code}\n}}"
    a = [rng.randint(1, 9) for _ in range(rng.randint(6, 7))]
    py_n = sum(1 for i in range(len(a) - 1) if a[i] > a[i + 1])
    if not 2 <= py_n <= 4:
        raise ValueError("ambiguous")
    mk_list = lambda v: "ArrayList<Integer> L = new ArrayList<Integer>(); " + " ".join(f"L.add({x});" for x in v) + " "  # noqa: E731
    body = mk_list(a)
    muts = [{"why": "Counts the positions where a value is less than the value that follows it.", "call": mk_list(a[::-1]) + "return Probe.mystery(L);"},
            {"why": "Also compares the last value with the first value, as if the list wrapped around.", "call": body + "int c = Probe.mystery(L); if (L.get(L.size() - 1) > L.get(0)) { c++; } return c;"},
            {"why": "Counts the values that are smaller than the first value.", "call": body + "int c = 0; for (int i = 1; i < L.size(); i++) { if (L.get(i) < L.get(0)) { c++; } } return c;"},
            {"why": "Counts equal neighbors as decreases too.", "call": body + "int c = 0; for (int i = 0; i < L.size() - 1; i++) { if (L.get(i) >= L.get(i + 1)) { c++; } } return c;"}]
    q1 = mk(rng, "css_list_set_q1", "4.9", "3.B", f"The ArrayList values contains the elements {', '.join(map(str, a))}, in that order. What is returned by the call Probe.mystery(values)?", cls, call=body + "return Probe.mystery(L);", muts=muts, py=str(py_n), stim_code=False,
            concept="trace an ArrayList scan on a concrete list", path="javac+java return value vs Python count of descents", kwhy=f"The loop compares each value with the next one and counts the pairs that decrease; for {a} that is {py_n}.", facts=[f"a={a}", f"key={py_n}"])
    q2 = B._describe(rng, "list_descents", "css_list_set_q2", stim=False, topic="4.9", skill="4.A")
    return set_pack("css_list_set", "Consider the following method, which examines an ArrayList of integers and returns an int result.", cls, [q1, q2], "4.9", "3.B")
