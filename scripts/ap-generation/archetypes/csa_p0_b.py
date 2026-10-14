"""AP Computer Science A P0 원형 B — 단원 3(Class Creation)·4(Data Collections: 배열·ArrayList·2D·탐색·정렬·재귀) + 스킬 4.A·4.B.
정답·오답 모두 Java 실행 결과, 독립 Python 참조로 정답 재계산. 2027 CED 단원 3 에는 상속·다형성 토픽이 없다(data/ap/curriculum-2027/ap_computer_science_a.json) — 범위 밖이라 원형을 두지 않는다."""
from csa_common import *  # noqa: F401,F403
from csa_p0_a import client, pick, STEM_OUT
import math
import csa_java as J

# ======================= 3.3-3.5 클래스 상태 추적 (3.B) =======================
ACCOUNT = """class Account {
    private int balance;
    public Account(int start) { balance = start; }
    public void deposit(int amt) {
        if (amt > 0) {
            balance += amt;
        }
    }
    public boolean withdraw(int amt) {
        if (amt > 0 && amt <= balance) {
            balance -= amt;
            return true;
        }
        return false;
    }
    public int getBalance() { return balance; }
}"""


@retry_sep
def cs_class_trace(rng):
    s, d1, w1, d2, w2 = rng.randint(20, 60), rng.randint(10, 40), rng.randint(15, 80), rng.randint(5, 30), rng.randint(40, 120)
    stm = f"Account acct = new Account({s});\nacct.deposit({d1});\nboolean r1 = acct.withdraw({w1});\nacct.deposit(-{d2});\nboolean r2 = acct.withdraw({w2});\nSystem.out.println(r1 + \" \" + r2 + \" \" + acct.getBalance());"
    bal = s + d1
    r1 = 0 < w1 <= bal; bal -= w1 if r1 else 0
    r2 = 0 < w2 <= bal; bal -= w2 if r2 else 0
    py = f"{'true' if r1 else 'false'} {'true' if r2 else 'false'} {bal}"
    muts = [{"why": "Believes a deposit of a negative amount is applied (the guard on deposit is ignored).", "swap": ("if (amt > 0) {\n            balance += amt;\n        }", "balance += amt;")},
            {"why": "Believes withdraw succeeds even when the amount exceeds the balance.", "swap": ("amt > 0 && amt <= balance", "amt > 0")},
            {"why": "Believes a failed withdraw still reduces the balance.", "swap": ("            return true;\n        }\n        return false;", "            return true;\n        }\n        balance -= amt;\n        return false;")},
            {"why": "Believes the constructor ignores its parameter and always starts the balance at 0.", "swap": ("balance = start;", "balance = 0;")}]
    return mk(rng, "cs_class_trace", "3.5", "3.B", STEM_OUT, ACCOUNT, call=stm, muts=muts, py=py, stim_code=ACCOUNT + "\n\n" + client(stm), concept="tracing instance state through methods that guard their updates",
              path="javac+java output vs Python class simulation", kwhy="Only positive deposits and withdrawals that do not exceed the balance change the state, and a failed withdraw returns false without changing the balance.", facts=[f"key={py}"], est=110)


# ======================= 3.7 static 변수 (3.B) =======================
TICKET = """class Ticket {
    private static int issued = 0;
    private int number;
    public Ticket() {
        issued++;
        number = issued;
    }
    public int getNumber() { return number; }
    public static int getIssued() { return issued; }
}"""


@retry_sep
def cs_static_counter(rng):
    k = rng.randint(3, 5)
    names = ["t1", "t2", "t3", "t4", "t5"][:k]
    stm = "\n".join(f"Ticket {n} = new Ticket();" for n in names) + f"\nSystem.out.println({names[0]}.getNumber() + \" \" + {names[-1]}.getNumber() + \" \" + Ticket.getIssued());"
    py = f"1 {k} {k}"
    muts = [{"why": "Believes each Ticket has its own copy of issued, so every number is 1.", "swap": ("number = issued;", "number = 1;")},
            {"why": "Assigns the number before the shared counter is incremented.", "swap": ("issued++;\n        number = issued;", "number = issued;\n        issued++;")},
            {"why": "Believes the static counter is reset by every constructor call.", "swap": ("issued++;", "issued = 1;")},
            {"why": "Believes the static counter starts at 1 instead of 0.", "swap": ("private static int issued = 0;", "private static int issued = 1;")}]
    return mk(rng, "cs_static_counter", "3.7", "3.B", STEM_OUT, TICKET, call=stm, muts=muts, py=py, stim_code=TICKET + "\n\n" + client(stm), concept="a static class variable shared by all instances",
              path="javac+java output vs Python class-attribute counter", kwhy=f"The static counter is shared: the first Ticket gets number 1, the last gets {k}, and {k} Tickets have been issued.", facts=[f"k={k}", f"key={py}"])


# ======================= 3.8-3.9 this·매개변수 가림 (3.B) =======================
PAIR = """class Pair {
    private int first;
    private int second;
    public Pair(int first, int second) {
        this.first = first;
        second = second;
    }
    public int sum() { return first + second; }
}"""


@retry_sep
def cs_this_shadow(rng):
    a, b = rng.randint(2, 9), rng.randint(3, 9)
    stm = f"Pair p = new Pair({a}, {b});\nSystem.out.println(p.sum());"
    py = str(a)
    muts = [{"why": "Believes second = second assigns the parameter to the instance variable.", "swap": ("second = second;", "this.second = second;")},
            {"why": "Believes only the last constructor statement takes effect.", "call": f"Pair p = new Pair({a}, {b});\nSystem.out.println({b});"},
            {"why": "Believes neither field is set because both names are also parameters.", "swap": ("this.first = first;", "first = first;")}]
    return mk(rng, "cs_this_shadow", "3.9", "3.B", STEM_OUT, PAIR, call=stm, muts=muts, py=py, stim_code=PAIR + "\n\n" + client(stm), concept="a parameter that shadows an instance variable; this distinguishes them",
              path="javac+java output vs Python (field defaults to 0 when only the parameter is assigned)", kwhy=f"this.first = first sets the field to {a}; second = second assigns the parameter to itself, so the instance variable second keeps its default value 0 and sum returns {a}.", facts=[f"key={py}"])


# ======================= 3.6 참조 반환·별칭 (3.C) =======================
ROSTER = """class Roster {
    private int[] ids;
    public Roster(int[] start) { ids = start; }
    public int[] getIds() { return ids; }
    public int total() {
        int sum = 0;
        for (int v : ids) {
            sum += v;
        }
        return sum;
    }
}"""


@retry_sep
def cs_return_reference(rng):
    a, b, c = rng.randint(2, 9), rng.randint(3, 9), rng.randint(4, 9)
    stm = f"int[] data = {{ {a}, {b}, {c} }};\nRoster r = new Roster(data);\ndata[0] = 0;\nint[] got = r.getIds();\ngot[1] = 0;\nSystem.out.println(r.total());"
    py = str(c)
    muts = [{"why": "Believes the constructor stores a copy of the array, so changes to data are not seen.", "swap": ("ids = start;", "ids = start.clone();")},
            {"why": "Believes getIds returns a copy, so changes to got are not seen.", "swap": ("return ids;", "return ids.clone();")},
            {"why": "Believes the Roster is unaffected by changes made outside the class.", "call": f"int[] data = {{ {a}, {b}, {c} }};\nRoster r = new Roster(data);\nSystem.out.println(r.total());"}]
    return mk(rng, "cs_return_reference", "3.6", "3.C", STEM_OUT, ROSTER, call=stm, muts=muts, py=py, stim_code=ROSTER + "\n\n" + client(stm), concept="storing and returning a reference exposes the same array to outside code",
              path="javac+java output vs Python list aliasing", kwhy=f"The Roster stores the same array that data refers to and getIds returns that same array, so both assignments change the stored values; only {c} remains in the total.", facts=[f"key={py}"])


# ======================= 3.4 / 2.B 생성자 완성 =======================
def cs_class_completion(rng):
    a, b = rng.sample(range(2, 12), 2)
    tpl = "class Rectangle {\n    private int width;\n    private int height;\n\n    /** Constructs a Rectangle with the given width and height. */\n    public Rectangle(int width, int height) {\n/*BODY*/\n    }\n\n    public int getWidth() { return width; }\n    public int area() { return width * height; }\n}"
    shown = tpl.replace("/*BODY*/", "        /* missing code */")
    cands = [("this.width = width;\n        this.height = height;", True, None), ("width = width;\n        height = height;", False, "Assigns each parameter to itself, so the instance variables keep their default values."), ("this.width = height;\n        this.height = width;", False, "Stores the arguments in the wrong order."), ("this.width = width;\n        this.height = width;", False, "Uses the width argument for both instance variables.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "        " + c), "why": w, "key": k} for c, k, w in cands]
    tests = [(f"return new Rectangle({a}, {b}).getWidth();", str(a)), (f"return new Rectangle({a}, {b}).area();", str(a * b)), (f"return new Rectangle({b}, {a}).getWidth();", str(b))]
    return mk_tests(rng, "cs_class_completion", "3.4", "2.B", "The Rectangle constructor is intended to initialize both instance variables from its parameters. Which of the following can replace /* missing code */ so that the constructor works as intended?", shown, options, tests,
                    concept="initialize instance variables in a constructor, distinguishing parameters from fields", path="each candidate compiled into the class and run on getWidth/area tests", kwhy_by_key="Using this.width and this.height refers to the instance variables, so each receives the matching parameter and every test passes.")


# ======================= 3.5 / 2.C 보조 메서드 호출 완성 =======================
def cs_helper_completion(rng):
    th = pick(rng, [50, 60, 65, 70])
    tpl = f"class Grades {{\n    /** Returns true if score is a passing score ({th} or more). */\n    private static boolean isPassing(int score) {{\n        return score >= {th};\n    }}\n\n    /** Returns the number of passing scores in scores. */\n    public static int countPassing(int[] scores) {{\n        int count = 0;\n        for (int s : scores) {{\n/*BODY*/\n        }}\n        return count;\n    }}\n}}"
    shown = tpl.replace("/*BODY*/", "            /* missing code */")
    cands = [("if (isPassing(s)) { count++; }", True, None), ("if (!isPassing(s)) { count++; }", False, "Counts the failing scores."), ("if (isPassing(s)) { count = s; }", False, "Stores the score instead of counting it."), ("if (isPassing(count)) { count++; }", False, "Passes the running count to the helper method instead of the score.")]
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", "            " + c), "why": w, "key": k} for c, k, w in cands]
    arrs = [[th, th - 1, 100], [th - 5, 10], [th + 1, th + 2, th + 3, th - 1]]
    tests = [("return Grades.countPassing(new int[] { " + ", ".join(map(str, a)) + " });", str(sum(1 for v in a if v >= th))) for a in arrs]
    return mk_tests(rng, "cs_helper_completion", "3.5", "2.C", f"The method countPassing is intended to use the helper method isPassing to count the scores that are {th} or more. Which of the following can replace /* missing code */ so that countPassing works as intended?", shown, options, tests,
                    concept="call a helper method with the correct argument inside a loop", path="each candidate compiled with both methods and run on boundary score arrays", kwhy_by_key="The helper is called with the current score and the count is incremented once for each passing score.")


# ======================= 4.4 배열 순회 (3.B) =======================
@retry_sep
def cs_array_traverse(rng):
    kind = pick(rng, ["prefix", "shift", "reverse"])
    n = rng.randint(5, 6)
    a = [rng.randint(1, 9) for _ in range(n)]
    arr = "{ " + ", ".join(map(str, a)) + " }"
    show = "for (int v : a) {\n    System.out.print(v + \" \");\n}"
    if kind == "prefix":
        body = "for (int i = 1; i < a.length; i++) {\n    a[i] = a[i] + a[i - 1];\n}"
        r = a[:]
        for i in range(1, n):
            r[i] += r[i - 1]
        muts = [{"why": "Starts the loop at index 0, so a[-1] is accessed.", "swap": ("int i = 1;", "int i = 0;")},
                {"why": "Believes each element is added to the original (unchanged) previous element.", "swap": ("a[i] = a[i] + a[i - 1];", "a[i] = a[i] + a[0];")},
                {"why": "Believes the loop doubles each element instead of accumulating.", "swap": ("a[i] = a[i] + a[i - 1];", "a[i] = a[i] + a[i];")},
                {"why": "Processes from the right, adding the following element instead of the previous one.", "swap": ("for (int i = 1; i < a.length; i++) {\n    a[i] = a[i] + a[i - 1];\n}", "for (int i = a.length - 2; i >= 0; i--) {\n    a[i] = a[i] + a[i + 1];\n}")}]
    elif kind == "shift":
        body = "for (int i = 0; i < a.length - 1; i++) {\n    a[i] = a[i + 1];\n}"
        r = a[1:] + [a[-1]]
        muts = [{"why": "Believes the loop also runs for the last index, which has no next element.", "swap": ("a.length - 1; i++", "a.length; i++")},
                {"why": "Believes the elements shift right, copying each element into the next position.", "swap": ("for (int i = 0; i < a.length - 1; i++) {\n    a[i] = a[i + 1];\n}", "for (int i = 1; i < a.length; i++) {\n    a[i] = a[i - 1];\n}")},
                {"why": "Believes the last element is cleared after the shift.", "swap": ("a[i] = a[i + 1];\n}", "a[i] = a[i + 1];\n}\na[a.length - 1] = 0;")},
                {"why": "Believes the first element is lost and everything else stays where it is.", "swap": ("a[i] = a[i + 1];", "a[0] = a[1];")}]
    else:
        body = "for (int i = 0; i < a.length; i++) {\n    int temp = a[i];\n    a[i] = a[a.length - 1 - i];\n    a[a.length - 1 - i] = temp;\n}"
        r = a[:]
        muts = [{"why": "Believes the loop reverses the array once, ignoring that each pair is swapped twice.", "swap": ("i < a.length;", "i < a.length / 2;")},
                {"why": "Believes only the first and last elements are swapped.", "swap": ("for (int i = 0; i < a.length; i++) {", "for (int i = 0; i < 1; i++) {")},
                {"why": "Believes the elements are copied rather than swapped, so the left half is mirrored onto the right.", "swap": ("a[a.length - 1 - i] = temp;", "")},
                {"why": "Believes the loop rotates the elements by one position.", "swap": ("a[i] = a[a.length - 1 - i];\n    a[a.length - 1 - i] = temp;", "a[i] = a[(i + 1) % a.length];\n    a[(i + 1) % a.length] = temp;")}]
        r = a[:]  # 전체 순회 교환은 두 번 바꿔 원래 배열이 된다
    code = f"int[] a = {arr};\n{body}\n{show}"
    py = " ".join(map(str, r))
    muts = [{"why": m["why"], "swap": m["swap"]} for m in muts]
    return mk(rng, "cs_array_traverse", "4.4", "3.B", STEM_OUT, code, muts=muts, py=py, concept="tracing an in-place array traversal (accumulate, shift, or swap pairs)", path="javac+java output vs Python list manipulation",
              kwhy={"prefix": "Each element is replaced by itself plus the already updated previous element, producing running totals.", "shift": "Each element receives its right neighbor's value; the last element is never reassigned so it keeps its old value.", "reverse": "Each pair is swapped twice (once from each end), which restores the original order."}[kind], facts=[f"kind={kind}", f"a={a}", f"key={py}"])


# ======================= 4.5 / 2.A 배열 알고리즘 완성 =======================
def cs_array_completion(rng):
    kind = pick(rng, ["max", "rises"])
    if kind == "max":
        tpl = "class Scan {\n    /** Returns the largest value in arr, which has at least one element. */\n    public static int largest(int[] arr) {\n/*BODY*/\n    }\n}"
        c = [("int max = arr[0];\n        for (int i = 1; i < arr.length; i++) {\n            if (arr[i] > max) {\n                max = arr[i];\n            }\n        }\n        return max;", True, None),
             ("int max = 0;\n        for (int i = 0; i < arr.length; i++) {\n            if (arr[i] > max) {\n                max = arr[i];\n            }\n        }\n        return max;", False, "Initializes max to 0, which is wrong when every value is negative."),
             ("int max = arr[0];\n        for (int i = 1; i < arr.length - 1; i++) {\n            if (arr[i] > max) {\n                max = arr[i];\n            }\n        }\n        return max;", False, "Stops before the last element."),
             ("int max = arr[0];\n        for (int i = 1; i < arr.length; i++) {\n            if (arr[i] < max) {\n                max = arr[i];\n            }\n        }\n        return max;", False, "Uses the wrong comparison and finds the smallest value.")]
        tests = [("return Scan.largest(new int[] { -4, -9, -2, -7 });", "-2"), ("return Scan.largest(new int[] { 3, 8, 5 });", "8"), ("return Scan.largest(new int[] { 2, 5, 9 });", "9"), ("return Scan.largest(new int[] { 7 });", "7")]
        stem = "The method largest is intended to return the largest value in arr, which has at least one element. Which of the following can replace the body of the method so that largest works as intended?"
    else:
        tpl = "class Scan {\n    /** Returns the number of positions i, 1 <= i < arr.length, where arr[i] is greater than arr[i - 1]. */\n    public static int rises(int[] arr) {\n/*BODY*/\n    }\n}"
        c = [("int count = 0;\n        for (int i = 1; i < arr.length; i++) {\n            if (arr[i] > arr[i - 1]) {\n                count++;\n            }\n        }\n        return count;", True, None),
             ("int count = 0;\n        for (int i = 0; i < arr.length; i++) {\n            if (arr[i] > arr[i - 1]) {\n                count++;\n            }\n        }\n        return count;", False, "Starts at index 0, so arr[-1] is accessed."),
             ("int count = 0;\n        for (int i = 1; i < arr.length; i++) {\n            if (arr[i] >= arr[i - 1]) {\n                count++;\n            }\n        }\n        return count;", False, "Also counts equal neighbors."),
             ("int count = 0;\n        for (int i = 1; i < arr.length - 1; i++) {\n            if (arr[i] > arr[i - 1]) {\n                count++;\n            }\n        }\n        return count;", False, "Stops one position early.")]
        tests = [("return Scan.rises(new int[] { 1, 2, 3, 4 });", "3"), ("return Scan.rises(new int[] { 3, 3, 3 });", "0"), ("return Scan.rises(new int[] { 5, 1, 4, 4, 9 });", "2"), ("return Scan.rises(new int[] { 4 });", "0")]
        stem = "The method rises is intended to return the number of positions where an element is greater than the element before it. Which of the following can replace the body of the method so that rises works as intended?"
    shown = tpl.replace("/*BODY*/", "        /* missing code */")
    options = [{"text": f"```\n{b}\n```", "source": tpl.replace("/*BODY*/", "        " + b), "why": w, "key": k} for b, k, w in c]
    return mk_tests(rng, "cs_array_completion", "4.5", "2.A", stem, shown, options, tests, concept="implement an array scan with correct initialization and loop bounds", path="candidates compiled and run on boundary arrays (all negative, single element, ties)", kwhy_by_key="This body initializes from the first element, visits every required position, and compares in the right direction; it passes every test array including all-negative and single-element arrays.", est=110)


# ======================= 4.8 ArrayList 연산 (3.B) =======================
@retry_sep
def cs_arraylist_ops(rng):
    a, b, c, d, e = rng.sample(range(2, 40), 5)
    code = f"ArrayList<Integer> list = new ArrayList<Integer>();\nlist.add({a});\nlist.add({b});\nlist.add({c});\nlist.add(1, {d});\nlist.remove(0);\nlist.set(2, {e});\nSystem.out.println(list);"
    l = [a, b, c]; l.insert(1, d); l.pop(0); l[2] = e
    py = "[" + ", ".join(map(str, l)) + "]"
    muts = [{"why": "Believes add(index, value) replaces the element at that index.", "swap": (f"list.add(1, {d});", f"list.set(1, {d});")},
            {"why": "Believes remove(0) removes the element whose value is 0.", "swap": ("list.remove(0);", "list.remove(Integer.valueOf(0));")},
            {"why": "Believes set(index, value) inserts the value and shifts the others right.", "swap": (f"list.set(2, {e});", f"list.add(2, {e});")},
            {"why": "Counts indexes from 1 instead of 0 in set.", "swap": (f"list.set(2, {e});", f"list.set(1, {e});")}]
    return mk(rng, "cs_arraylist_ops", "4.8", "3.B", STEM_OUT, code, muts=muts, py=py, concept="ArrayList add(index, value), remove(index) and set(index, value) with 0-based indexes", path="javac+java output vs Python list insert/pop/assignment",
              kwhy="add(1, value) inserts and shifts later elements right, remove(0) deletes the first element and shifts the rest left, and set(2, value) replaces the element now at index 2.", facts=[f"key={py}"])


# ======================= 4.9 ArrayList 순회 중 삭제 (3.B) =======================
@retry_sep
def cs_arraylist_remove_loop(rng):
    n = rng.randint(6, 7)
    vals = [rng.choice([2, 4, 6, 8, 10, 3, 5, 7, 9]) for _ in range(n)]
    if not any(vals[i] % 2 == 0 and vals[i + 1] % 2 == 0 for i in range(n - 1)):
        raise ValueError("no adjacent evens")
    adds = "\n".join(f"nums.add({v});" for v in vals)
    code = f"ArrayList<Integer> nums = new ArrayList<Integer>();\n{adds}\nfor (int i = 0; i < nums.size(); i++) {{\n    if (nums.get(i) % 2 == 0) {{\n        nums.remove(i);\n    }}\n}}\nSystem.out.println(nums);"
    l = vals[:]; i = 0
    while i < len(l):
        if l[i] % 2 == 0:
            l.pop(i)
        i += 1
    py = "[" + ", ".join(map(str, l)) + "]"
    muts = [{"why": "Believes the loop visits every element after a removal, so all even values are removed.", "swap": ("nums.remove(i);", "nums.remove(i);\n        i--;")},
            {"why": "Believes only the first even value is removed.", "swap": ("nums.remove(i);", "nums.remove(i);\n        break;")},
            {"why": "Believes the loop bound is the original number of elements, so after removals the loop reads past the end of the shorter list and throws an exception.", "swap": ("i < nums.size()", f"i < {n}")},
            {"why": "Mixes up the test and removes odd values instead of even values (the skipped element after each removal still stays).", "swap": ("nums.get(i) % 2 == 0", "nums.get(i) % 2 == 1")}]
    return mk(rng, "cs_arraylist_remove_loop", "4.9", "3.B", STEM_OUT, code, muts=muts, py=py, concept="removing elements inside a forward loop skips the element that shifts into the removed index", path="javac+java output vs Python list pop simulation",
              kwhy=f"After an element is removed, the next element shifts into the same index but the loop moves on, so an even value directly after a removed even value is skipped and stays in the list; the list that remains is {py}.", facts=[f"key={py}"], est=105)


# ======================= 4.12 2D 배열 순회 (3.B) =======================
@retry_sep
def cs_2d_traverse(rng):
    R_, C_ = 3, 4
    g = [[rng.randint(1, 9) for _ in range(C_)] for _ in range(R_)]
    kind = pick(rng, ["evencols", "diag"])
    gl = ",\n    ".join("{ " + ", ".join(map(str, row)) + " }" for row in g)
    if kind == "evencols":
        loop = "int total = 0;\nfor (int r = 0; r < grid.length; r++) {\n    for (int c = 0; c < grid[r].length; c++) {\n        if (c % 2 == 0) {\n            total += grid[r][c];\n        }\n    }\n}\nSystem.out.println(total);"
        py = str(sum(g[r][c] for r in range(R_) for c in range(C_) if c % 2 == 0))
        muts = [{"why": "Adds the elements in odd-numbered columns.", "swap": ("c % 2 == 0", "c % 2 == 1")},
                {"why": "Swaps the row and column indexes, so a column index is used past the end of a row.", "swap": ("grid[r][c]", "grid[c][r]")},
                {"why": "Uses the number of rows as the column bound, so the last column is never visited.", "swap": ("c < grid[r].length", "c < grid.length")},
                {"why": "Uses the number of columns as the row bound, so a row index past the end is accessed.", "swap": ("r < grid.length", "r < grid[0].length")}]
    else:
        loop = "int total = 0;\nfor (int r = 0; r < grid.length; r++) {\n    for (int c = 0; c < grid[r].length; c++) {\n        if (r == c) {\n            total += grid[r][c];\n        } else if (c > r) {\n            total -= grid[r][c];\n        }\n    }\n}\nSystem.out.println(total);"
        py = str(sum(g[r][c] if r == c else (-g[r][c] if c > r else 0) for r in range(R_) for c in range(C_)))
        muts = [{"why": "Believes only the diagonal elements are added and nothing is subtracted.", "swap": ("} else if (c > r) {\n            total -= grid[r][c];\n        }", "}")},
                {"why": "Believes elements below the diagonal are subtracted instead of those above it.", "swap": ("c > r", "c < r")},
                {"why": "Swaps the row and column indexes.", "swap": ("total -= grid[r][c];", "total -= grid[c][r];")},
                {"why": "Believes the diagonal elements are subtracted and the others added.", "swap": ("total += grid[r][c];", "total -= grid[r][c];")}]
    code = f"int[][] grid = {{\n    {gl}\n}};\n{loop}"
    return mk(rng, "cs_2d_traverse", "4.12", "3.B", STEM_OUT, code, muts=muts, py=py, concept="row-major traversal of a 2D array with a column condition", path="javac+java output vs Python nested indexing",
              kwhy="The loops visit every row and every column in row-major order; only the elements that meet the condition on the column and row indexes change the total.", facts=[f"kind={kind}", f"key={py}"], est=110)


# ======================= 4.13 / 2.A 2D 알고리즘 완성 =======================
def cs_2d_completion(rng):
    tpl = "class GridTools {\n    /** Returns the sum of the elements in column col of grid, a rectangular array with at least one row. */\n    public static int columnSum(int[][] grid, int col) {\n        int sum = 0;\n/*BODY*/\n        return sum;\n    }\n}"
    shown = tpl.replace("/*BODY*/", "        /* missing code */")
    c = [("for (int r = 0; r < grid.length; r++) {\n            sum += grid[r][col];\n        }", True, None),
         ("for (int c = 0; c < grid[0].length; c++) {\n            sum += grid[col][c];\n        }", False, "Sums row col instead of column col."),
         ("for (int r = 0; r < grid.length; r++) {\n            sum += grid[col][r];\n        }", False, "Swaps the row and column indexes."),
         ("for (int r = 0; r < grid.length - 1; r++) {\n            sum += grid[r][col];\n        }", False, "Stops before the last row.")]
    options = [{"text": f"```\n{b}\n```", "source": tpl.replace("/*BODY*/", "        " + b), "why": w, "key": k} for b, w, k in [(x[0], x[2], x[1]) for x in c]]
    g1 = "new int[][] { { 1, 2, 3, 4 }, { 5, 6, 7, 8 }, { 9, 1, 2, 3 } }"
    tests = [(f"return GridTools.columnSum({g1}, 0);", "15"), (f"return GridTools.columnSum({g1}, 3);", "15"), (f"return GridTools.columnSum({g1}, 2);", "12"), ("return GridTools.columnSum(new int[][] { { 4, 5 } }, 1);", "5")]
    return mk_tests(rng, "cs_2d_completion", "4.13", "2.A", "The method columnSum is intended to return the sum of the elements in the given column of a rectangular 2D array. Which of the following can replace /* missing code */ so that columnSum works as intended?", shown, options, tests,
                    concept="traverse one column of a non-square 2D array", path="candidates compiled and run on a 3 by 4 array and a 1 by 2 array", kwhy_by_key="The row index changes while the column index stays fixed, and the loop covers every row, so every test passes including the non-square arrays.")


# ======================= 4.14 이진 탐색 (3.A) =======================
@retry_sep
def cs_binary_search(rng):
    n = rng.randint(8, 12)
    a = sorted(rng.sample(range(2, 60), n))
    present = rng.random() < 0.7
    t = rng.choice(a) if present else rng.choice([v for v in range(1, 60) if v not in a])
    code = f"int[] a = {{ {', '.join(map(str, a))} }};\nint target = {t};\nint lo = 0;\nint hi = a.length - 1;\nint steps = 0;\nint result = -1;\nwhile (lo <= hi) {{\n    int mid = (lo + hi) / 2;\n    steps++;\n    if (a[mid] == target) {{\n        result = mid;\n        break;\n    }} else if (a[mid] < target) {{\n        lo = mid + 1;\n    }} else {{\n        hi = mid - 1;\n    }}\n}}\nSystem.out.println(result + \" \" + steps);"

    def ref(arr, tg):
        def rec(lo, hi, st):
            if lo > hi:
                return -1, st
            m = (lo + hi) // 2
            if arr[m] == tg:
                return m, st + 1
            return rec(m + 1, hi, st + 1) if arr[m] < tg else rec(lo, m - 1, st + 1)
        return rec(0, len(arr) - 1, 0)
    r, s = ref(a, t)
    py = f"{r} {s}"
    muts = [{"why": "Rounds the midpoint up instead of down.", "swap": ("(lo + hi) / 2", "(lo + hi + 1) / 2")},
            {"why": "Stops the loop one iteration early because it uses lo < hi.", "swap": ("lo <= hi", "lo < hi")},
            {"why": "Moves the wrong bound: searches the left half when the middle value is too small.", "swap": ("a[mid] < target", "a[mid] > target")},
            {"why": "Believes the search never counts the comparison that finds the target.", "swap": ("steps++;\n    if (a[mid] == target) {\n        result = mid;", "if (a[mid] == target) {\n        result = mid;")}]
    return mk(rng, "cs_binary_search", "4.14", "3.A", STEM_OUT, code, muts=muts, py=py, concept="tracing a binary search: index returned and number of loop passes", path="javac+java output vs a recursive Python binary search",
              kwhy="Each pass compares the middle element and discards half of the remaining range; the loop ends when the target is found or the range becomes empty.", facts=[f"a={a}", f"target={t}", f"key={py}"], est=120)


# ======================= 4.15 선택 정렬 단계 (3.A) =======================
@retry_sep
def cs_selection_sort_pass(rng):
    n = 6
    a = rng.sample(range(1, 30), n)
    k = rng.randint(2, 3)
    body = f"for (int i = 0; i < {k}; i++) {{\n    int min = i;\n    for (int j = i + 1; j < a.length; j++) {{\n        if (a[j] < a[min]) {{\n            min = j;\n        }}\n    }}\n    int temp = a[i];\n    a[i] = a[min];\n    a[min] = temp;\n}}"
    code = f"int[] a = {{ {', '.join(map(str, a))} }};\n{body}\nfor (int v : a) {{\n    System.out.print(v + \" \");\n}}"
    r = a[:]
    for i in range(k):
        m = min(range(i, n), key=lambda j: r[j])
        r[i], r[m] = r[m], r[i]
    py = " ".join(map(str, r))
    muts = [{"why": "Believes each pass selects the largest element instead of the smallest.", "swap": ("a[j] < a[min]", "a[j] > a[min]")},
            {"why": "Believes the loop runs one pass more than the stated bound.", "swap": (f"i < {k};", f"i <= {k};")},
            {"why": "Believes each pass swaps position i with its right neighbor instead of with the smallest element found.", "swap": ("int temp = a[i];\n    a[i] = a[min];\n    a[min] = temp;", "int temp = a[i];\n    a[i] = a[i + 1];\n    a[i + 1] = temp;")},
            {"why": "Believes the minimum is copied to the front without moving the displaced element, losing it.", "swap": ("a[min] = temp;", "")}]
    return mk(rng, "cs_selection_sort_pass", "4.15", "3.A", STEM_OUT, code, muts=muts, py=py, concept="array state after a fixed number of selection sort passes", path="javac+java output vs Python selection sort passes",
              kwhy=f"Each pass finds the smallest element in the unsorted part and swaps it into position i, so after {k} passes the first {k} positions hold the {k} smallest values in order.", facts=[f"k={k}", f"key={py}"], est=110)


# ======================= 4.16 재귀 (3.C) =======================
REC = {
    "sum2": ("public static int mystery(int n) {\n        if (n <= 1) {\n            return n;\n        }\n        return n + mystery(n - 2);\n    }", lambda n: sum(range(n, 0, -2)), [("n <= 1", "n <= 0", "Uses a base case that returns 0 for n of 1 so the final odd term is dropped."), ("n + mystery(n - 2)", "n + mystery(n - 1)", "Believes the argument decreases by 1 instead of 2."), ("return n;", "return 1;", "Believes the base case always returns 1."), ("n + mystery(n - 2)", "mystery(n - 2)", "Forgets to add n to the recursive result.")]),
    "fact": ("public static int mystery(int n) {\n        if (n == 0) {\n            return 1;\n        }\n        return n * mystery(n - 1);\n    }", lambda n: math.factorial(n), [("return 1;", "return 0;", "Believes the base case returns 0, which makes every product 0."), ("n * mystery(n - 1)", "n + mystery(n - 1)", "Adds instead of multiplying."), ("n == 0", "n == 1", "Stops one level early, at n of 1, returning the base value for 1."), ("n * mystery(n - 1)", "n * mystery(n - 2)", "Steps down by 2 instead of 1, skipping every other factor; the base case at 0 is reached only when n is even, and otherwise the recursion never ends.")]),
    "fib": ("public static int mystery(int n) {\n        if (n <= 1) {\n            return n;\n        }\n        return mystery(n - 1) + mystery(n - 2);\n    }", lambda n: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55][n], [("mystery(n - 1) + mystery(n - 2)", "mystery(n - 1) + mystery(n - 1)", "Calls the same subproblem twice."), ("return n;", "return 1;", "Believes the base case returns 1 for every n of at most 1."), ("n <= 1", "n <= 2", "Ends the recursion one step too early."), ("mystery(n - 1) + mystery(n - 2)", "mystery(n - 1) * mystery(n - 2)", "Multiplies the two recursive results.")]),
}


@retry_sep
def cs_recursion_trace(rng):
    kind = pick(rng, ["sum2", "fact", "fib"])
    code_m, fn, mutdefs = REC[kind]
    n = {"sum2": rng.choice([7, 8, 9, 10]), "fact": rng.randint(4, 6), "fib": rng.randint(6, 9)}[kind]
    shown = f"class Rec {{\n    {code_m}\n}}"
    call = f"return Rec.mystery({n});"
    muts = [{"why": w, "swap": (o, nw)} for o, nw, w in mutdefs]
    py = str(fn(n))
    return mk(rng, "cs_recursion_trace", "4.16", "3.C", f"What is returned by the call Rec.mystery({n})?", shown, call=call, muts=muts, py=py, concept="evaluating a recursive method through its base case", path="javac+java return value vs a Python closed-form or iterative reference",
              kwhy="The call expands until the base case is reached, and the pending operations are completed in reverse order, giving the value " + py + ".", facts=[f"kind={kind}", f"n={n}", f"key={py}"], est=100)


@retry_sep
def cs_recursion_string(rng):
    w = pick(rng, ["stack", "queue", "array", "loops", "class", "index", "trace", "write"])
    kind = pick(rng, ["reverse", "skip"])
    if kind == "reverse":
        m = "public static String mystery(String s) {\n        if (s.length() <= 1) {\n            return s;\n        }\n        return mystery(s.substring(1)) + s.charAt(0);\n    }"
        py = w[::-1]
        muts = [("mystery(s.substring(1)) + s.charAt(0)", "s.charAt(0) + mystery(s.substring(1))", "Believes the first character is attached before the recursive result, which leaves the string unchanged."), ("s.length() <= 1", "s.length() <= 2", "Ends the recursion one character early, leaving the last two characters unreversed."), ("return s;", "return \"\";", "Believes the base case returns an empty string, which drops the last remaining character."), ("s.substring(1)", "s.substring(2)", "Skips every other character.")]
    else:
        m = "public static String mystery(String s) {\n        if (s.length() <= 1) {\n            return s;\n        }\n        return s.charAt(0) + mystery(s.substring(2));\n    }"
        py = "".join(w[i] for i in range(0, len(w), 2))
        muts = [("s.substring(2)", "s.substring(1)", "Believes the recursion drops only one character each time, so the string is unchanged."), ("s.charAt(0) + mystery(s.substring(2))", "mystery(s.substring(2)) + s.charAt(0)", "Appends each kept character after the recursive result, reversing the kept characters."), ("return s;", "return \"\";", "Believes the base case returns an empty string, which drops a trailing single character."), ("s.charAt(0) + mystery", "s.charAt(1) + mystery")]
        muts = [x if len(x) == 3 else (x[0], x[1], "Keeps the second character of each pair instead of the first.") for x in muts]
    shown = f"class Rec {{\n    {m}\n}}"
    call = f'return Rec.mystery("{w}");'
    return mk(rng, "cs_recursion_string", "4.17", "3.C", f"What is returned by the call Rec.mystery(\"{w}\")?", shown, call=call, muts=[{"why": x[2], "swap": (x[0], x[1])} for x in muts], py=py, concept="a recursive String method that builds its result from substring calls",
              path="javac+java return value vs Python slicing", kwhy="Each call handles one character and delegates the rest to a smaller String; each pending concatenation is finished when the call below it returns, starting with the call that reached the base case.", facts=[f"w={w}", f"kind={kind}", f"key={py}"])


# ======================= 4.A 동작 설명 / 4.B 초기 조건 =======================
FAMILIES = {
    "above_first": ("public static int mystery(int[] a) {\n        int c = 0;\n        for (int i = 1; i < a.length; i++) {\n            if (a[i] > a[0]) {\n                c++;\n            }\n        }\n        return c;\n    }", "int[]",
                    [("the number of elements after the first element that are greater than the first element", lambda a: sum(1 for v in a[1:] if v > a[0]), None), ("the number of elements that are greater than the last element", lambda a: sum(1 for v in a if v > a[-1]), "Compares each element with the last element instead of the first."), ("the largest value in the array", lambda a: max(a), "Believes a counter that is incremented on a comparison returns the compared value."), ("the number of elements that are less than the first element", lambda a: sum(1 for v in a if v < a[0]), "Reverses the direction of the comparison.")],
                    [[3, 5, 1, 7], [9, 2, 4], [1, 1, 1, 1], [4, 8, 8, 2, 6], [6, 7]]),
    "palindrome": ("public static boolean mystery(String s) {\n        for (int i = 0; i < s.length() / 2; i++) {\n            if (s.charAt(i) != s.charAt(s.length() - 1 - i)) {\n                return false;\n            }\n        }\n        return true;\n    }", "String",
                   [("whether s reads the same forward and backward", lambda s: s == s[::-1], None), ("whether the first and last characters of s are the same", lambda s: s[0] == s[-1], "Checks only the outermost pair of characters."), ("whether every character of s is the same", lambda s: len(set(s)) == 1, "Believes returning false on a mismatch means all characters must match."), ("whether s contains two equal adjacent characters", lambda s: any(s[i] == s[i + 1] for i in range(len(s) - 1)), "Believes the comparison looks at neighboring characters.")],
                   ["level", "abca", "aaaa", "ab", "racecar", "noon", "abcd", "abba", "xyzx"]),
    "digit_sum": ("public static int mystery(int n) {\n        int c = 0;\n        while (n > 0) {\n            c += n % 10;\n            n /= 10;\n        }\n        return c;\n    }", "int",
                  [("the sum of the digits of n", lambda n: sum(int(d) for d in str(n)), None), ("the number of digits in n", lambda n: len(str(n)), "Believes the loop counts how many times it runs instead of adding the digits."), ("the largest digit in n", lambda n: max(int(d) for d in str(n)), "Believes the accumulated value keeps only the biggest digit."), ("the digits of n in reverse order", lambda n: int(str(n)[::-1]), "Believes n % 10 appends digits to build a reversed number.")],
                  [5, 123, 909, 4567, 1000, 88, 7054]),
}


def _lit(kind, v):
    if kind == "int[]":
        return "new int[] { " + ", ".join(map(str, v)) + " }"
    if kind == "int[][]":
        return "new int[][] { " + ", ".join("{ " + ", ".join(map(str, r)) + " }" for r in v) + " }"
    if kind == "list":
        return "L"
    if kind == "String":
        return f'"{v}"'
    return str(v)


def _pre(kind, v):
    return "ArrayList<Integer> L = new ArrayList<Integer>(); " + " ".join(f"L.add({x});" for x in v) + " " if kind == "list" else ""


def _pyfmt(x):
    return ("true" if x else "false") if isinstance(x, bool) else str(x)


def _describe(rng, fam, arch, stim=True, topic="4.5", skill="4.A"):
    code, kind, descs, tests = FAMILIES[fam]
    cls = f"class Probe {{\n    {code}\n}}"
    res = J.java_eval(cls, [("ret", f"{_pre(kind, t)}return Probe.mystery({_lit(kind, t)});") for t in tests])
    actual = [J.tidy(r) for r in res]
    for text, fn, why in descs:
        match = [_pyfmt(fn(t)) == a for t, a in zip(tests, actual)]
        if why is None and not all(match):
            raise ValueError("key_description_not_true_on_all_tests")
        if why is not None and all(match):
            raise ValueError("distractor_description_true_on_all_tests")
    def _lit_s(t):
        return f"Probe.mystery(list) with list = [{', '.join(map(str, t))}]" if kind == "list" else f"Probe.mystery({_lit(kind, t)})"
    t0 = tests[0]
    key = Opt(descs[0][0], True, f"The loop does exactly what this description says. For example, {_lit_s(t0)} returns {actual[0]}.", None)
    ds = []
    for text, fn, why in descs[1:]:
        k = next(i for i, t in enumerate(tests) if _pyfmt(fn(t)) != actual[i])
        ds.append(Opt(text, False, f"{why.rstrip('.')}. For instance, {_lit_s(tests[k])} returns {actual[k]}, but this description would give {_pyfmt(fn(tests[k]))}.", None))
    shown = cls
    p = pack(arch, topic, skill, "not_allowed", "x", key, ds, rng, stimulus=(code_stim(shown) if stim else None), est=85, facts=[f"family={fam}", f"tests={len(tests)}"])
    p["stem"] = "Which of the following best describes the value returned by the method mystery?" if True else ""
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate([o for j, o in enumerate(p["options"]) if j != p["key_index"]])]
    p["blueprint"] = mc_blueprint(arch, SUB, topic, skill, "not_allowed", "describe the behavior of a code segment", "work out what the loop computes and compare with each description", [("the key description holds on every test input run through the JDK", "javac+java test run"), ("each distractor description fails on at least one input", "java test run")], mis, "javac+java runs the method on 5 or more inputs; each English description has a Python predicate that must agree (key) or disagree (distractors)",
                                  material={"type": "code", "must_include": ["the code segment"]}, method="javac+java + python predicates", extra={"judgment_demand": "generalize from code to an English description"})
    return p


def _describe_pick(rng, fam):
    topic = {"above_first": "4.5", "palindrome": "2.10", "digit_sum": "2.9"}[fam]
    return _describe(rng, fam, {"above_first": "cs_describe_array", "palindrome": "cs_describe_string", "digit_sum": "cs_describe_int"}[fam], True, topic, "4.A")


def cs_describe_array(rng):
    return _describe_pick(rng, "above_first")


def cs_describe_string(rng):
    return _describe_pick(rng, "palindrome")


def cs_describe_int(rng):
    return _describe_pick(rng, "digit_sum")


PRE = {
    "middle": ("public static char middle(String s) {\n        return s.charAt(s.length() / 2);\n    }", [('middle("")', True, "An empty string has no character at index 0, so charAt throws a StringIndexOutOfBoundsException."), ('middle("a")', False, "A one-character string has a character at index 0."), ('middle("ab")', False, "Index 1 exists in a two-character string."), ('middle("abc")', False, "Index 1 exists in a three-character string.")], "Which of the following calls to middle causes a run-time exception?"),
    "ratio": ("public static int ratio(int total, int count) {\n        return total / count;\n    }", [("ratio(5, 0)", True, "Integer division by zero throws an ArithmeticException."), ("ratio(0, 5)", False, "A zero numerator is fine: the quotient is 0."), ("ratio(-4, 2)", False, "A negative numerator is fine."), ("ratio(7, 3)", False, "The quotient is truncated and no exception is thrown.")], "Which of the following calls to ratio causes a run-time exception?"),
    "firstWord": ("public static String firstWord(String s) {\n        return s.substring(0, s.indexOf(\" \"));\n    }", [('firstWord("hello")', True, "There is no space, so indexOf returns -1 and substring(0, -1) throws a StringIndexOutOfBoundsException."), ('firstWord("hi there")', False, "The space is at index 2, so substring(0, 2) returns hi."), ('firstWord("a b c")', False, "The first space is at index 1, so the call returns a."), ('firstWord(" x")', False, "The space is at index 0, so substring(0, 0) returns an empty string and no exception is thrown.")], "Which of the following calls to firstWord causes a run-time exception?"),
}


def cs_precondition(rng):
    fam = pick(rng, sorted(PRE))
    code, calls, stem = PRE[fam]
    cls = f"class Tools {{\n    {code}\n}}"
    res = J.java_eval(cls, [("ret", "return Tools." + c + ";") for c, _k, _w in calls])
    thrown = ["EXC:" in r for r in res]
    if thrown != [k for _c, k, _w in calls]:
        raise ValueError("exactly_one_call_must_throw")
    key = Opt(f"`Tools.{calls[0][0]}`", True, calls[0][2], None)
    ds = [Opt(f"`Tools.{c}`", False, w, None) for c, _k, w in calls[1:]]
    p = pack("cs_precondition", "1.9", "4.B", "not_allowed", "x", key, ds, rng, stimulus=code_stim(cls), est=70, facts=[f"family={fam}"])
    p["stem"] = stem
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate([o for j, o in enumerate(p["options"]) if j != p["key_index"]])]
    p["blueprint"] = mc_blueprint("cs_precondition", SUB, p["topic"], "4.B", "not_allowed", "initial conditions under which a method works as intended", "check each call against the conditions the method needs", [("exactly the key call throws when each call is run with the JDK", "java run of all four calls")], mis, "javac+java runs every option call and records which throw an exception",
                                  material={"type": "code", "must_include": ["the method"]}, method="javac+java run of each option", extra={"judgment_demand": "identify the input that violates the method's precondition"})
    return p


# ======================= 2문항 세트 =======================
def css_array_set(rng):
    """세트 1: 같은 배열 메서드 — (1) 특정 배열에서 반환값, (2) 동작 설명."""
    fam = "above_first"
    code, kind, descs, tests = FAMILIES[fam]
    cls = f"class Probe {{\n    {code}\n}}"
    for _ in forever():
        arr = [rng.randint(1, 9) for _ in range(rng.randint(5, 6))]
        a = arr
        if 2 <= sum(1 for v in a[1:] if v > a[0]) <= 4:
            break
    py = str(sum(1 for v in a[1:] if v > a[0]))
    muts = [{"why": "Counts the elements that are greater than the last element instead of the first.", "call": f"return Probe.mystery(new int[] {{ {', '.join(map(str, a[::-1]))} }});"},
            {"why": "Also counts the first element itself, as if it were greater than itself.", "call": f"return Probe.mystery(new int[] {{ {', '.join(map(str, a))} }}) + 1;"},
            {"why": "Counts the elements that are less than the first element.", "call": f"int[] b = {{ {', '.join(map(str, a))} }}; int c = 0; for (int i = 1; i < b.length; i++) {{ if (b[i] < b[0]) {{ c++; }} }} return c;"},
            {"why": "Returns the largest value instead of a count.", "call": f"int[] b = {{ {', '.join(map(str, a))} }}; int m = b[0]; for (int v : b) {{ if (v > m) {{ m = v; }} }} return m;"}]
    q1 = mk(rng, "css_array_set_q1", "4.5", "3.B", f"What is returned by the call Probe.mystery(new int[] {{ {', '.join(map(str, a))} }})?", cls, call=f"return Probe.mystery(new int[] {{ {', '.join(map(str, a))} }});", muts=muts, py=py, stim_code=False, concept="trace an array scan on a concrete array", path="javac+java return value vs Python count",
            kwhy=f"The loop counts the elements after the first that are greater than a[0], which is {a[0]}; there are {py} of them.", facts=[f"a={a}", f"key={py}"])
    q2 = _describe(rng, fam, "css_array_set_q2", stim=False, topic="4.5", skill="4.A")
    return set_pack("css_array_set", "Consider the following method, which examines an array of integers and returns an int result.", cls, [q1, q2], "4.5", "3.B")


CLS_TPL = "class Playlist {\n    private ArrayList<String> songs;\n    private int plays;\n\n    public Playlist() {\n        songs = new ArrayList<String>();\n        plays = 0;\n    }\n    public void add(String title) { songs.add(title); }\n    public int size() { return songs.size(); }\n    public void play() { plays++; }\n    public int getPlays() { return plays; }\n/*BODY*/\n}"


def css_class_set(rng):
    """세트 2: 같은 클래스 — (1) 객체 상태 추적, (2) 새 메서드 구현 선택(테스트 실행)."""
    names = ["Ada", "Bo", "Cy", "Di", "Ed"]
    k = rng.randint(3, 4); plays = rng.randint(2, 4)
    shown = CLS_TPL.replace("/*BODY*/", "    // other methods not shown")
    stm = "Playlist p = new Playlist();\n" + "\n".join(f'p.add("{n}");' for n in names[:k]) + "\n" + "\n".join("p.play();" for _ in range(plays)) + "\nSystem.out.println(p.size() + \" \" + p.getPlays());"
    py = f"{k} {plays}"
    muts = [{"why": "Believes play adds a song to the list.", "swap": ("public void play() { plays++; }", "public void play() { plays++; songs.add(\"x\"); }")},
            {"why": "Believes each added song is also counted as a play.", "swap": ("public void add(String title) { songs.add(title); }", "public void add(String title) { songs.add(title); plays++; }")},
            {"why": "Believes size reports the number of plays.", "swap": ("public int size() { return songs.size(); }", "public int size() { return plays; }")},
            {"why": "Believes the constructor starts the play count at 1.", "swap": ("plays = 0;", "plays = 1;")}]
    q1 = mk(rng, "css_class_set_q1", "3.5", "3.B", "What is printed as a result of executing the following code segment?\n```java\n" + stm + "\n```", shown, call=stm, muts=muts, py=py, stim_code=False, concept="trace object state through add and play calls", path="javac+java output vs Python counters",
            kwhy=f"The list holds {k} songs and play was called {plays} times, and the two quantities are tracked independently.", facts=[f"key={py}"])
    body = "/*MISSING*/"
    cands = [("public int averagePlays() {\n        return size() == 0 ? 0 : plays / size();\n    }", True, None), ("public int averagePlays() {\n        return plays / size();\n    }", False, "Divides without checking for an empty playlist, which throws an ArithmeticException."), ("public int averagePlays() {\n        return size() / plays;\n    }", False, "Divides the number of songs by the number of plays, in the wrong order."), ("public int averagePlays() {\n        return plays * size();\n    }", False, "Multiplies instead of dividing.")]
    tpl2 = CLS_TPL
    shown2 = CLS_TPL.replace("/*BODY*/", "    // averagePlays method not shown")
    options = [{"text": f"```\n{c}\n```", "source": tpl2.replace("/*BODY*/", "    " + c), "why": w, "key": kk} for c, kk, w in cands]
    tests = [("Playlist p = new Playlist(); return p.averagePlays();", "0"), ("Playlist p = new Playlist(); p.add(\"a\"); p.add(\"b\"); p.play(); p.play(); p.play(); p.play(); return p.averagePlays();", "2"), ("Playlist p = new Playlist(); p.add(\"a\"); p.add(\"b\"); p.add(\"c\"); p.play(); p.play(); p.play(); p.play(); p.play(); p.play(); p.play(); return p.averagePlays();", "2")]
    q2 = mk_tests(rng, "css_class_set_q2", "3.5", "2.C", "The Playlist class needs a method averagePlays that returns the whole-number average of plays per song, or 0 if the playlist has no songs. Which of the following implementations works as intended?", shown2, options, tests, concept="write a method that uses other methods of the same class and guards a division", path="each candidate compiled into the class and run on empty and non-empty playlists", kwhy_by_key="The conditional avoids dividing by zero for an empty playlist and otherwise uses integer division of plays by the number of songs.", stim=False)
    return set_pack("css_class_set", "Consider the following Playlist class, which stores song titles and counts how many times the playlist has been played.", shown, [q1, q2], "3.5", "3.B")


STAGE_P1_MC = ["cs_class_trace", "cs_static_counter", "cs_this_shadow", "cs_return_reference", "cs_class_completion", "cs_helper_completion", "cs_array_traverse", "cs_array_completion", "cs_arraylist_ops", "cs_arraylist_remove_loop", "cs_2d_traverse", "cs_2d_completion", "cs_binary_search", "cs_selection_sort_pass", "cs_recursion_trace", "cs_recursion_string", "cs_describe_array", "cs_describe_string", "cs_describe_int", "cs_precondition"]
STAGE_P1_SETS = ["css_array_set", "css_class_set"]
