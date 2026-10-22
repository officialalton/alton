"""AP Computer Science A 공유 세트(문항 2개, 같은 코드 자료) — CS4·CS5 5세트 채우기용 신규(2026-10-21): 단원 3 클래스 2개, 단원 4 배열·ArrayList 2개.
정답은 Java 실행 결과, 독립 Python 시뮬레이션이 값을 재계산한다. 첫 문항은 실행 추적, 둘째 문항은 같은 코드의 동작 설명 또는 구현 선택(테스트 실행)이다."""
from csa_common import *  # noqa: F401,F403
from common import Opt  # noqa: F401
from csa_p0_a import pick, STEM_OUT
from csa_p0_e import retry_any
from csa_p0_x1 import _text_item
import csa_java as J

GARAGE = "class Garage {\n    private int[] slots;\n    private int used;\n    public Garage(int n) {\n        slots = new int[n];\n    }\n    public boolean park(int id) {\n        for (int i = 0; i < slots.length; i++) {\n            if (slots[i] == 0) {\n                slots[i] = id;\n                used++;\n                return true;\n            }\n        }\n        return false;\n    }\n    public void leave(int id) {\n        for (int i = 0; i < slots.length; i++) {\n            if (slots[i] == id) {\n                slots[i] = 0;\n                used--;\n            }\n        }\n    }\n/*BODY*/\n}"


@retry_any
def css_t5_garage_set(rng):
    n = rng.randint(3, 4)
    ids = rng.sample(range(11, 40), n + 2)
    leave = ids[rng.randint(0, 1)]
    seq = ids[:n] + [leave]  # park n cars, one leaves, two more try to park
    shown = GARAGE.replace("/*BODY*/", "    // other methods not shown")
    lines = [f"Garage g = new Garage({n});"] + [f"boolean p{i} = g.park({ids[i]});" for i in range(n)] + [f"g.leave({leave});", f"boolean q1 = g.park({ids[n]});", f"boolean q2 = g.park({ids[n + 1]});"]
    ret = "return " + " + \" \" + ".join([f"p{n - 1}", "q1", "q2"]) + ";"
    stm = "\n".join(lines) + "\n" + ret
    slots = [0] * n; used = 0
    def park(i):
        nonlocal used
        for k in range(n):
            if slots[k] == 0:
                slots[k] = i; used += 1; return True
        return False
    for i in ids[:n]: park(i)
    for k in range(n):
        if slots[k] == leave: slots[k] = 0; used -= 1
    q1v, q2v = park(ids[n]), park(ids[n + 1])
    py = f"true {str(q1v).lower()} {str(q2v).lower()}"
    muts = [{"why": "Believes a car that leaves does not free its slot.", "swap": ("slots[i] = 0;\n                used--;", "used--;")},
            {"why": "Believes park places the car in the last free slot, so nothing changes for the count.", "swap": ("if (slots[i] == 0) {", "if (slots[i] != 0) {")},
            {"why": "Believes park never fails when the garage is full.", "swap": ("        return false;\n    }\n    public void leave", "        return true;\n    }\n    public void leave")},
            {"why": "Believes leave frees every slot.", "swap": ("if (slots[i] == id) {", "if (slots[i] != id) {")}]
    q1 = mk(rng, "css_t5_garage_set_q1", "3.5", "3.B", "What is returned by the following code segment?\n```java\n" + stm + "\n```", shown, call=stm, muts=muts, py=py, stim_code=False, concept="trace object state through park and leave calls on an array field",
            path="javac+java output vs Python simulation", kwhy="The last car parked, the car that leaves frees exactly one slot, and the next parking attempts fill free slots in index order until none is left.", facts=[f"key={py}"])
    tpl = GARAGE
    cands = [("public int occupied() {\n        int c = 0;\n        for (int i = 0; i < slots.length; i++) {\n            if (slots[i] != 0) {\n            c++;\n            }\n        }\n        return c;\n    }", True, None),
             ("public int occupied() {\n        int c = 0;\n        for (int i = 0; i < slots.length; i++) {\n            if (slots[i] == 0) {\n            c++;\n            }\n        }\n        return c;\n    }", False, "Counts the empty slots instead of the occupied slots."),
             ("public int occupied() {\n        int c = 0;\n        for (int i = 0; i < slots.length - 1; i++) {\n            if (slots[i] != 0) {\n            c++;\n            }\n        }\n        return c;\n    }", False, "Stops one slot early, so the last slot is never counted."),
             ("public int occupied() {\n        return slots.length;\n    }", False, "Returns the number of slots, not the number that are occupied.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", c), "why": w, "key": bool(k)} for c, k, w in cands]
    tests = [("Garage g = new Garage(3); g.park(5); g.park(6); return g.occupied();", "2"), ("Garage g = new Garage(3); g.park(5); g.park(6); g.leave(5); return g.occupied();", "1"), ("Garage g = new Garage(2); g.park(1); g.park(2); g.park(3); return g.occupied();", "2"), ("Garage g = new Garage(2); return g.occupied();", "0")]
    shown2 = tpl.replace("/*BODY*/", "    // occupied method not shown")
    q2 = mk_tests(rng, "css_t5_garage_set_q2", "3.5", "2.B", "The Garage class needs a method occupied that returns the number of slots that currently hold a car. Which of the following implementations of occupied works as intended?", shown2, options, tests, concept="write a counting method that traverses an array field of an object",
                  path="each implementation compiled into the class and run on full, partly filled and empty garages", kwhy_by_key="Counting the slots whose value is not 0 over every index gives the number of parked cars.", stim=False)
    return set_pack("css_t5_garage_set", "Consider the following Garage class, which keeps track of parking slots in an array.", shown, [q1, q2], "3.5", "3.B")


CART = "class Cart {\n    private ArrayList<Integer> prices;\n    private int pct;\n    public Cart(int discountPct) {\n        prices = new ArrayList<Integer>();\n        pct = discountPct;\n    }\n    public void add(int price) {\n        prices.add(price);\n    }\n    public int total() {\n        int t = 0;\n        for (int p : prices) {\n            t += p;\n        }\n        return t - t * pct / 100;\n    }\n/*BODY*/\n}"


@retry_any
def css_t5_cart_set(rng):
    pct = rng.choice([10, 20, 25, 50])
    pr = [rng.choice([10, 20, 30, 40, 50, 60]) for _ in range(rng.randint(3, 4))]
    shown = CART.replace("/*BODY*/", "    // other methods not shown")
    stm = f"Cart c = new Cart({pct});\n" + "\n".join(f"c.add({p});" for p in pr) + "\nSystem.out.println(c.total());"
    t = sum(pr); py = str(t - t * pct // 100)
    muts = [{"why": "Believes the discount is subtracted as a flat amount equal to pct.", "swap": ("return t - t * pct / 100;", "return t - pct;")},
            {"why": "Believes the discount is applied to each price before the total, with integer rounding of each part.", "swap": ("t += p;", "t += p - p * pct / 100;")},
            {"why": "Believes the total ignores the discount.", "swap": ("return t - t * pct / 100;", "return t;")},
            {"why": "Believes the method returns only the discount amount.", "swap": ("return t - t * pct / 100;", "return t * pct / 100;")}]
    q1 = mk(rng, "css_t5_cart_set_q1", "3.5", "3.B", "What is printed as a result of executing the following code segment?\n```java\n" + stm + "\n```", shown, call=stm, muts=muts, py=py, stim_code=False, concept="trace an ArrayList field that is totalled with a percentage discount using integer arithmetic",
            path="javac+java output vs Python simulation", kwhy=f"The prices total {t}, and the discount of {pct} percent is {t * pct // 100}, so total returns {py}.", facts=[f"key={py}"])
    tpl = CART
    cands = [("public int mostExpensive() {\n        int best = 0;\n        for (int p : prices) {\n            if (p > best) {\n            best = p;\n            }\n        }\n        return best;\n    }", True, None),
             ("public int mostExpensive() {\n        int best = 0;\n        for (int p : prices) {\n            if (p < best) {\n            best = p;\n            }\n        }\n        return best;\n    }", False, "Looks for a price smaller than best, which starts at 0, so it always returns 0."),
             ("public int mostExpensive() {\n        int best = 0;\n        for (int p : prices) {\n            best += p;\n        }\n        return best;\n    }", False, "Adds all of the prices instead of finding the largest."),
             ("public int mostExpensive() {\n        return prices.get(prices.size() - 1);\n    }", False, "Returns the last price added, which is not necessarily the largest (and throws an exception for an empty cart).")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", c), "why": w, "key": bool(k)} for c, k, w in cands]
    tests = [("Cart c = new Cart(0); c.add(30); c.add(80); c.add(20); return c.mostExpensive();", "80"), ("Cart c = new Cart(0); c.add(10); return c.mostExpensive();", "10"), ("Cart c = new Cart(0); c.add(90); c.add(20); return c.mostExpensive();", "90"), ("Cart c = new Cart(0); return c.mostExpensive();", "0")]
    shown2 = tpl.replace("/*BODY*/", "    // mostExpensive method not shown")
    q2 = mk_tests(rng, "css_t5_cart_set_q2", "3.5", "2.B", "The Cart class needs a method mostExpensive that returns the largest price in the cart, or 0 if the cart is empty. Which of the following implementations of mostExpensive works as intended?", shown2, options, tests, concept="write a maximum-finding method over an ArrayList field",
                  path="each implementation compiled into the class and run on carts with the largest price first, last and in the middle, and on an empty cart", kwhy_by_key="A running best that starts at 0 and is replaced by any larger price gives the maximum, and stays 0 for an empty cart.", stim=False)
    return set_pack("css_t5_cart_set", "Consider the following Cart class, which keeps the prices of items and a discount percentage.", shown, [q1, q2], "3.5", "3.B")


@retry_any
def css_t5_array_set(rng):
    code = "public static int mystery(int[] a) {\n        int c = 0;\n        for (int i = 0; i < a.length - 1; i++) {\n            if (a[i] > a[i + 1]) {\n                c++;\n            }\n        }\n        return c;\n    }"
    cls = f"class Probe {{\n    {code}\n}}"
    for _ in range(80):
        a = [rng.randint(1, 9) for _ in range(rng.randint(6, 7))]
        v = sum(1 for i in range(len(a) - 1) if a[i] > a[i + 1])
        if 2 <= v <= 4 and len(set(a)) >= 5:
            break
    else:
        raise ValueError("ambiguous")
    arr = ", ".join(map(str, a))
    muts = [{"why": "Counts the positions where a value is smaller than the next value.", "call": f"int[] b = {{ {arr} }}; int c = 0; for (int i = 0; i < b.length - 1; i++) {{ if (b[i] < b[i + 1]) {{ c++; }} }} return c;"},
            {"why": "Counts the positions where a value is at least as large as the next value.", "call": f"int[] b = {{ {arr} }}; int c = 0; for (int i = 0; i < b.length - 1; i++) {{ if (b[i] >= b[i + 1]) {{ c++; }} }} return c;"},
            {"why": "Returns the largest drop between neighbors instead of the number of drops.", "call": f"int[] b = {{ {arr} }}; int m = 0; for (int i = 0; i < b.length - 1; i++) {{ if (b[i] - b[i + 1] > m) {{ m = b[i] - b[i + 1]; }} }} return m;"},
            {"why": "Compares each value with the first value instead of with the next value.", "call": f"int[] b = {{ {arr} }}; int c = 0; for (int i = 1; i < b.length; i++) {{ if (b[0] > b[i]) {{ c++; }} }} return c;"}]
    q1 = mk(rng, "css_t5_array_set_q1", "4.5", "3.B", f"What is returned by the call Probe.mystery(new int[] {{ {arr} }})?", cls, call=f"return Probe.mystery(new int[] {{ {arr} }});", muts=muts, py=str(v), stim_code=False, concept="trace a scan that compares each element with its next neighbor",
            path="javac+java output vs Python scan", kwhy=f"The loop counts the positions where a value is larger than the one after it; here there are {v}.", facts=[f"a={a}", f"key={v}"])
    vals = [("{1, 2, 3}", 0), ("{3, 2, 1}", 2), ("{5, 5, 5}", 0), ("{4, 1, 4, 1}", 2)]
    res = J.java_eval(cls, [("ret", f"return Probe.mystery(new int[] {a_});") for a_, _ in vals])
    if [J.tidy(r) for r in res] != [str(e) for _, e in vals]:
        raise ValueError("expectation_failed")
    key = ("It returns the number of positions whose value is larger than the next value.", "For {3, 2, 1} it returns 2, and for {1, 2, 3} or {5, 5, 5} it returns 0.")
    wrongs = [("It returns the number of positions whose value is smaller than the next value.", "For {3, 2, 1} that count would be 0, but the method returns 2."),
              ("It returns 1 if the array is in decreasing order and 0 otherwise.", "For {4, 1, 4, 1} the array is not decreasing, but the method returns 2, so it counts drops."),
              ("It returns the length of the longest run of decreasing values.", "For {3, 2, 1} the longest decreasing run has 3 values, but the method returns 2, the number of adjacent drops.")]
    q2 = _text_item(rng, "css_t5_array_set_q2", "4.5", "4.A", "Which of the following best describes the value returned by the method mystery for any non-empty array a?", None, key, wrongs, "describe what a scan of adjacent pairs counts", "java runs on four arrays", ["method=mystery"])
    return set_pack("css_t5_array_set", "Consider the following method, which examines an array of integers and returns an int result.", cls, [q1, q2], "4.5", "3.B")


@retry_any
def css_t5_list_set(rng):
    code = "public static ArrayList<Integer> mystery(ArrayList<Integer> list) {\n        ArrayList<Integer> r = new ArrayList<Integer>();\n        for (int v : list) {\n            if (!r.contains(v)) {\n                r.add(v);\n            }\n        }\n        return r;\n    }"
    cls = f"class Probe {{\n    {code}\n}}"
    for _ in range(80):
        a = [rng.randint(1, 6) for _ in range(rng.randint(6, 7))]
        r = []
        for v in a:
            if v not in r: r.append(v)
        if len(r) >= 3 and len(r) <= len(a) - 2:
            break
    else:
        raise ValueError("ambiguous")
    adds = "".join(f"L.add({v}); " for v in a)
    setup = f"ArrayList<Integer> L = new ArrayList<Integer>(); {adds}"
    muts = [{"why": "Believes the method keeps the last occurrence of each value.", "call": setup + "ArrayList<Integer> r = new ArrayList<Integer>(); for (int i = 0; i < L.size(); i++) { boolean later = false; for (int j = i + 1; j < L.size(); j++) { if (L.get(j).equals(L.get(i))) { later = true; } } if (!later) { r.add(L.get(i)); } } return r;"},
            {"why": "Believes the method returns the repeated values.", "call": setup + "ArrayList<Integer> r = new ArrayList<Integer>(); ArrayList<Integer> seen = new ArrayList<Integer>(); for (int v : L) { if (seen.contains(v) && !r.contains(v)) { r.add(v); } seen.add(v); } return r;"},
            {"why": "Believes the method sorts the values as well as removing duplicates.", "call": setup + "ArrayList<Integer> r = new ArrayList<Integer>(); for (int v : L) { if (!r.contains(v)) { r.add(v); } } java.util.Collections.sort(r); return r;"},
            {"why": "Believes the method returns the original list unchanged.", "call": setup + "return L;"}]
    q1 = mk(rng, "css_t5_list_set_q1", "4.9", "3.B", f"What is returned by the call Probe.mystery(list), where list contains {', '.join(map(str, a))} in that order?", cls, call=setup + "return Probe.mystery(L);", muts=muts, py=str(r), stim_code=False, concept="trace a method that removes repeated values from an ArrayList while keeping the first occurrence",
            path="javac+java output vs Python list simulation", kwhy="Each value is added to the result only if it is not already there, so the first occurrences are kept in order.", facts=[f"a={a}", f"key={r}"])
    vals = [([1, 1, 2], "[1, 2]"), ([3, 2, 3, 1, 2], "[3, 2, 1]"), ([], "[]"), ([5, 4, 3], "[5, 4, 3]")]
    res = J.java_eval(cls, [("ret", "ArrayList<Integer> L = new ArrayList<Integer>(); " + "".join(f"L.add({v}); " for v in vs) + "return Probe.mystery(L);") for vs, _ in vals])
    if [J.tidy(x) for x in res] != [e for _, e in vals]:
        raise ValueError("expectation_failed")
    key = ("It returns a new list with each distinct value of list once, in the order of first appearance.", "For [3, 2, 3, 1, 2] it returns [3, 2, 1].")
    wrongs = [("It returns a new list with each distinct value of list once, in increasing order.", "For [3, 2, 3, 1, 2] the result is [3, 2, 1], not [1, 2, 3]; the method does not sort."),
              ("It returns a new list with only the values that appear more than once in list.", "For [3, 2, 3, 1, 2] the result is [3, 2, 1], which includes 1, a value that appears only once."),
              ("It removes the duplicate values from list itself and returns list.", "The method builds and returns a new list; the original list is not changed.")]
    q2 = _text_item(rng, "css_t5_list_set_q2", "4.9", "4.A", "Which of the following best describes the value returned by the method mystery?", None, key, wrongs, "describe what a loop with contains and add builds", "java runs on four lists", ["method=mystery"])
    return set_pack("css_t5_list_set", "Consider the following method, which processes an ArrayList of Integer objects and returns an ArrayList.", cls, [q1, q2], "4.9", "3.B")
