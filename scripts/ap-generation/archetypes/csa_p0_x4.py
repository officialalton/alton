"""AP Computer Science A 확대 CS3 — 신규 2문항 세트 원형 X4(단원 2·3·4 각 1). 2026-10-19. 공개 세트 CS1·CS2 와 같은 코드 모양을 쓰지 않는다."""
from csa_common import *  # noqa: F401,F403
from common import Opt  # noqa: F401
from csa_p0_a import pick
from csa_p0_e import retry_any
import csa_p0_b as B
import csa_java as J

# ---------------- 세트 1(단원 2): 같은 문자열 메서드 — 구체적 문자열의 반환값 + 동작 설명 ----------------
B.FAMILIES["adjacent_equal"] = (
    "public static int mystery(String s) {\n        int c = 0;\n        for (int i = 0; i < s.length() - 1; i++) {\n            if (s.substring(i, i + 1).equals(s.substring(i + 1, i + 2))) {\n                c++;\n            }\n        }\n        return c;\n    }", "String",
    [("the number of positions in s at which a character is the same as the character that follows it", lambda s: sum(1 for i in range(len(s) - 1) if s[i] == s[i + 1]), None),
     ("the number of different characters that appear at least twice in s", lambda s: sum(1 for ch in set(s) if s.count(ch) >= 2), "Counts repeated characters anywhere in the String, not only neighbors."),
     ("the length of the longest run of equal characters in s", lambda s: max(len(m) for m in __import__("re").findall(r"((.)\2*)", s) for m in [m[0]]), "Reports the longest run instead of counting each adjacent equal pair."),
     ("the number of characters in s that appear more than once in s", lambda s: sum(1 for ch in s if s.count(ch) > 1), "Counts every occurrence of a repeated character, even when the repeats are not next to each other.")],
    ["aabbb", "abab", "aaaa", "abcabc", "xxyxx", "abba", "aabaa"])


@retry_any
def css_adjacent_set(rng):
    code, kind, descs, tests = B.FAMILIES["adjacent_equal"]
    cls = f"class Probe {{\n    {code}\n}}"
    w = "".join(rng.choice("abc") for _ in range(rng.randint(7, 9)))
    py = sum(1 for i in range(len(w) - 1) if w[i] == w[i + 1])
    if not 2 <= py <= 4:
        raise ValueError("ambiguous")
    muts = [{"why": "Counts the characters that appear in a pair of equal neighbors twice, once for each member of the pair.", "call": f'return 2 * Probe.mystery("{w}");'},
            {"why": "Counts the runs of equal characters instead of the equal neighbor pairs.", "call": f'String w = "{w}"; int r = 1; for (int i = 1; i < w.length(); i++) {{ if (!w.substring(i, i + 1).equals(w.substring(i - 1, i))) {{ r++; }} }} return r;'},
            {"why": "Counts the neighbor pairs that are different.", "call": f'return {len(w) - 1} - Probe.mystery("{w}");'},
            {"why": "Stops one position early, so a pair at the end of the String is missed.", "call": f'String w = "{w}"; int c = 0; for (int i = 0; i < w.length() - 2; i++) {{ if (w.substring(i, i + 1).equals(w.substring(i + 1, i + 2))) {{ c++; }} }} return c;'}]
    q1 = mk(rng, "css_adjacent_set_q1", "2.10", "3.C", f"What is returned by the call Probe.mystery(\"{w}\")?", cls, call=f'return Probe.mystery("{w}");', muts=muts, py=str(py), stim_code=False, concept="trace a String scan that compares neighbors", path="javac+java return value vs Python count",
            kwhy=f"The loop compares each character with the one after it and counts the equal pairs; in {w} there are {py} of them.", facts=[f"w={w}", f"key={py}"])
    q2 = B._describe(rng, "adjacent_equal", "css_adjacent_set_q2", stim=False, topic="2.10", skill="4.A")
    return set_pack("css_adjacent_set", "Consider the following method, which examines a String and returns an int result.", cls, [q1, q2], "2.10", "3.C")


# ---------------- 세트 2(단원 4): 같은 ArrayList 메서드 ----------------
B.FAMILIES["above_mean"] = (
    "public static int mystery(ArrayList<Integer> list) {\n        int sum = 0;\n        for (int i = 0; i < list.size(); i++) {\n            sum += list.get(i);\n        }\n        int mean = sum / list.size();\n        int c = 0;\n        for (int i = 0; i < list.size(); i++) {\n            if (list.get(i) > mean) {\n                c++;\n            }\n        }\n        return c;\n    }", "list",
    [("the number of values in list that are greater than the average of the values, where the average is computed with integer division", lambda a: sum(1 for v in a if v > sum(a) // len(a)), None),
     ("the number of values in list that are greater than or equal to the average computed with integer division", lambda a: sum(1 for v in a if v >= sum(a) // len(a)), "Includes the values equal to the average, but the comparison is strict."),
     ("the sum of the values in list that are greater than the average computed with integer division", lambda a: sum(v for v in a if v > sum(a) // len(a)), "Returns the sum of those values instead of how many there are."),
     ("the number of values in list that are greater than the first value in list", lambda a: sum(1 for v in a if v > a[0]), "Compares with the first value, but the code compares with the average of all values.")],
    [[3, 5, 7], [2, 4, 6, 8], [1, 1, 1], [10, 2, 3, 3, 12], [5, 9, 5, 9], [4, 8, 6]])


@retry_any
def css_above_mean_set(rng):
    code, kind, descs, tests = B.FAMILIES["above_mean"]
    cls = f"class Probe {{\n    {code}\n}}"
    a = [rng.randint(1, 9) for _ in range(rng.randint(5, 6))]
    mean = sum(a) // len(a)
    py = sum(1 for v in a if v > mean)
    if not 2 <= py <= 4 or py == sum(1 for v in a if v >= mean):
        raise ValueError("ambiguous")
    mk_list = lambda v: "ArrayList<Integer> L = new ArrayList<Integer>(); " + " ".join(f"L.add({x});" for x in v) + " "  # noqa: E731
    body = mk_list(a)
    muts = [{"why": "Counts the values that are greater than or equal to the integer average.", "call": body + f"int c = 0; for (int i = 0; i < L.size(); i++) {{ if (L.get(i) >= {mean}) {{ c++; }} }} return c;"},
            {"why": "Adds up the values above the average instead of counting them.", "call": body + f"int s = 0; for (int i = 0; i < L.size(); i++) {{ if (L.get(i) > {mean}) {{ s += L.get(i); }} }} return s;"},
            {"why": "Compares each value with the first value of the list.", "call": body + "int c = 0; for (int i = 0; i < L.size(); i++) { if (L.get(i) > L.get(0)) { c++; } } return c;"},
            {"why": "Counts the values below the integer average.", "call": body + f"int c = 0; for (int i = 0; i < L.size(); i++) {{ if (L.get(i) < {mean}) {{ c++; }} }} return c;"}]
    q1 = mk(rng, "css_above_mean_set_q1", "4.9", "3.B", f"The ArrayList values contains the elements {', '.join(map(str, a))}, in that order. What is returned by the call Probe.mystery(values)?", cls, call=body + "return Probe.mystery(L);", muts=muts, py=str(py), stim_code=False,
            concept="trace two passes over an ArrayList: a sum and then a count against the integer mean", path="javac+java return value vs Python count", kwhy=f"The integer average of the values is {mean}, and exactly {py} of the values are greater than it.", facts=[f"a={a}", f"mean={mean}", f"key={py}"])
    q2 = B._describe(rng, "above_mean", "css_above_mean_set_q2", stim=False, topic="4.9", skill="4.A")
    return set_pack("css_above_mean_set", "Consider the following method, which examines an ArrayList of integers and returns an int result. Assume the list contains at least one element.", cls, [q1, q2], "4.9", "3.B")


# ---------------- 세트 3(단원 3): 같은 클래스 — 상태 추적 + 새 메서드 구현 ----------------
SHELF = "class Shelf {\n    private int capacity;\n    private int stock;\n    private int rejected;\n\n    public Shelf(int capacity) {\n        this.capacity = capacity;\n        stock = 0;\n        rejected = 0;\n    }\n\n    public void put(int n) {\n        if (stock + n <= capacity) {\n            stock += n;\n        } else {\n            rejected += n;\n        }\n    }\n    public int getStock() { return stock; }\n    public int getRejected() { return rejected; }\n/*BODY*/\n}"


@retry_any
def css_shelf_set(rng):
    cap = rng.choice([10, 12, 15]); a, b, c = rng.randint(3, 8), rng.randint(3, 8), rng.randint(2, 6)
    stock = 0; rej = 0
    for n in (a, b, c):
        if stock + n <= cap:
            stock += n
        else:
            rej += n
    if rej == 0 or stock == 0:
        raise ValueError("ambiguous")
    shown = SHELF.replace("/*BODY*/", "    // other methods not shown")
    stm = f"Shelf s = new Shelf({cap});\ns.put({a});\ns.put({b});\ns.put({c});\nSystem.out.println(s.getStock() + \" \" + s.getRejected());"
    muts = [{"why": "Believes an item batch that does not fit is partly stored, filling the shelf to capacity.", "swap": ("rejected += n;", "stock = capacity;\n            rejected += stock + n - capacity;")},
            {"why": "Believes a rejected batch is also added to the stock.", "swap": ("rejected += n;", "rejected += n;\n            stock += n;")},
            {"why": "Believes a batch that exactly fills the shelf is rejected.", "swap": ("stock + n <= capacity", "stock + n < capacity")},
            {"why": "Believes the rejected count is the number of rejected batches, not the number of items.", "swap": ("rejected += n;", "rejected++;")}]
    q1 = mk(rng, "css_shelf_set_q1", "3.5", "3.B", "What is printed as a result of executing the following code segment?\n```java\n" + stm + "\n```", shown, call=stm, muts=muts, py=f"{stock} {rej}", stim_code=False, concept="trace object state through put calls that are accepted or rejected", path="javac+java output vs Python simulation",
            kwhy=f"A batch is stored only when it fits within the capacity {cap}; the stock is {stock} and the items of rejected batches total {rej}.", facts=[f"cap={cap}", f"batches={a},{b},{c}", f"key={stock} {rej}"])
    shown2 = SHELF.replace("/*BODY*/", "    // percentFull method not shown")
    cands = [("public int percentFull() {\n        return 100 * stock / capacity;\n    }", True, None),
             ("public int percentFull() {\n        return 100 * (stock / capacity);\n    }", False, "Divides the two ints first, which gives 0 until the shelf is full."),
             ("public int percentFull() {\n        return stock / capacity * 100.0;\n    }", False, "Does not compile: the double result cannot be returned as an int without a cast."),
             ("public int percentFull() {\n        return 100 * stock / rejected;\n    }", False, "Divides by the rejected count, which is zero when nothing was rejected, causing an ArithmeticException."),
             ("public int percentFull() {\n        return 100 - 100 * stock / capacity;\n    }", False, "Computes the percent that is empty, not the percent that is full.")]
    options = [{"text": f"```\n{c_}\n```", "source": SHELF.replace("/*BODY*/", "    " + c_), "why": w, "key": kk} for c_, kk, w in cands if "100.0" not in c_]
    options.append({"text": "```\npublic int percentFull() {\n        return stock * 100 / capacity + rejected;\n    }\n```", "source": SHELF.replace("/*BODY*/", "    public int percentFull() {\n        return stock * 100 / capacity + rejected;\n    }"), "why": "Adds the rejected count to the percentage, which is not part of how full the shelf is.", "key": False})
    tests = [("Shelf s = new Shelf(10); return s.percentFull();", "0"), ("Shelf s = new Shelf(10); s.put(3); return s.percentFull();", "30"), ("Shelf s = new Shelf(8); s.put(3); s.put(5); return s.percentFull();", "100"), ("Shelf s = new Shelf(12); s.put(5); s.put(9); return s.percentFull();", "41")]
    q2 = mk_tests(rng, "css_shelf_set_q2", "3.5", "2.C", "The Shelf class needs a method percentFull that returns the whole-number percent of the capacity that is currently filled with stock (for example, 41 when 5 of 12 places are filled). Which of the following implementations works as intended?", shown2, options, tests,
                  concept="write a method that combines two instance variables and uses integer arithmetic correctly", path="each candidate compiled into the class and run on shelves with different contents", kwhy_by_key="The multiplication happens before the integer division, so the whole-number percent is not rounded down to 0.", stim=False)
    return set_pack("css_shelf_set", "Consider the following Shelf class, which keeps track of the items stored on a shelf of limited capacity and the items that did not fit.", shown, [q1, q2], "3.5", "3.B")
