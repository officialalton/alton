"""AP Computer Science A 원형 — CS4·CS5 5세트 채우기용 신규 문항 3부(2026-10-21): 반려 여유분(단원 2 추적·단원 3 추적·단원 2·3 코드 이해·단원 1 완성). 검증 방식은 csa_p0_t5a/b 와 같다."""
import math
from csa_common import *  # noqa: F401,F403
from common import Opt  # noqa: F401
from csa_p0_a import pick, STEM_OUT
from csa_p0_e import retry_any
from csa_p0_x1 import _text_item
from csa_p0_t5a import _comp, _add
import csa_java as J

_add("cs_abs_diff_completion", "1.12",
     "class NumTools {\n    /** Returns the non-negative difference between a and b, whichever is larger. */\n    public static int gap(int a, int b) {\n/*BODY*/\n    }\n}",
     "The method gap is intended to return the non-negative difference between a and b, whichever of them is larger. Which of the following can replace /* missing code */ so that gap works as intended?",
     [("return Math.abs(a - b);", True, None),
      ("return a - b;", False, "Returns a negative number when b is larger than a."),
      ("return Math.abs(a) - Math.abs(b);", False, "Takes the absolute value of each number before subtracting, which is not the distance between them."),
      ("return Math.max(a, b) + Math.min(a, b);", False, "Adds the larger and the smaller number instead of subtracting.")],
     [("return NumTools.gap(9, 4);", "5"), ("return NumTools.gap(4, 9);", "5"), ("return NumTools.gap(-3, 5);", "8"), ("return NumTools.gap(-6, -2);", "4"), ("return NumTools.gap(7, 7);", "0")],
     "Math.abs of a difference", "The distance between two numbers is the absolute value of their difference.", "each candidate compiled and run with either number larger and with negative values")


@retry_any
def cs_while_steps_trace(rng):
    start, add = rng.randint(2, 6), rng.randint(2, 4)
    lim = rng.randint(30, 60)
    code = f"int v = {start};\nint steps = 0;\nwhile (v < {lim}) {{\n    v = v * 2 + {add};\n    steps++;\n}}\nSystem.out.println(v + \" \" + steps);"
    v, st = start, 0
    while v < lim:
        v = v * 2 + add; st += 1
    muts = [{"why": "Uses <= in the loop condition.", "swap": (f"v < {lim}", f"v <= {lim}")},
            {"why": "Adds instead of doubling.", "swap": (f"v * 2 + {add}", f"v + 2 + {add}")},
            {"why": "Counts the steps before the update instead of after it.", "swap": ("steps++;", "steps += 2;")},
            {"why": "Doubles the sum instead of adding to the doubled value.", "swap": (f"v * 2 + {add}", f"(v + {add}) * 2")}]
    return mk(rng, "cs_while_steps_trace", "2.9", "3.A", STEM_OUT, code, muts=muts, py=f"{v} {st}", concept="a while loop that updates a value until it reaches a limit, with a step counter",
              path="javac+java output vs Python while loop", kwhy="The loop repeats while v is below the limit, applying v * 2 + a constant each time and counting the passes.")


@retry_any
def cs_loop_break_trace(rng):
    n, skip, stop = rng.randint(8, 14), rng.randint(2, 4), rng.randint(10, 24)
    code = f"int sum = 0;\nfor (int i = 1; i <= {n}; i++) {{\n    if (i % {skip} == 0) {{\n        continue;\n    }}\n    sum += i;\n    if (sum > {stop}) {{\n        break;\n    }}\n}}\nSystem.out.println(sum);"
    s = 0
    for i in range(1, n + 1):
        if i % skip == 0: continue
        s += i
        if s > stop: break
    muts = [{"why": "Treats continue like break.", "swap": ("continue;", "break;")},
            {"why": "Does not stop when the sum passes the limit.", "swap": (f"if (sum > {stop}) {{\n        break;\n    }}", "")},
            {"why": "Adds the skipped values too.", "swap": ("if (i % " + str(skip) + " == 0) {\n        continue;\n    }", "")},
            {"why": "Stops before adding the value that passes the limit.", "call": f"int sum = 0;\nfor (int i = 1; i <= {n}; i++) {{\n    if (i % {skip} == 0) {{\n        continue;\n    }}\n    if (sum + i > {stop}) {{\n        break;\n    }}\n    sum += i;\n}}\nSystem.out.println(sum);"}]
    return mk(rng, "cs_loop_break_trace", "2.12", "3.A", STEM_OUT, code, muts=muts, py=str(s), concept="continue skips the rest of one pass, and break ends the loop after the current statements",
              path="javac+java output vs Python loop with continue and break", kwhy="Multiples of the skip value are not added; once the running sum passes the limit the loop ends right after that addition.")


@retry_any
def cs_account_state_trace(rng):
    a, b = rng.randint(50, 90), rng.randint(10, 40)
    bal1 = a - (b + 2)
    c, d = bal1 - 1, bal1 - 2
    shown = "class Account {\n    private int balance;\n    private int fee;\n    public Account(int b) {\n        balance = b;\n        fee = 2;\n    }\n    public boolean withdraw(int amt) {\n        if (amt + fee <= balance) {\n            balance -= amt + fee;\n            return true;\n        }\n        return false;\n    }\n    public int getBalance() {\n        return balance;\n    }\n}"
    call = f"Account acct = new Account({a});\nboolean r1 = acct.withdraw({b});\nboolean r2 = acct.withdraw({c});\nboolean r3 = acct.withdraw({d});\nreturn r1 + \" \" + r2 + \" \" + r3 + \" \" + acct.getBalance();"
    py = "true false true 0"
    muts = [{"why": "Believes the fee is not charged.", "swap": ("balance -= amt + fee;", "balance -= amt;")},
            {"why": "Believes a withdrawal is allowed whenever the amount alone fits the balance.", "swap": ("if (amt + fee <= balance)", "if (amt <= balance)")},
            {"why": "Believes a failed withdrawal still charges the fee.", "swap": ("return false;", "balance -= fee;\n        return false;")},
            {"why": "Believes the condition needs a strictly larger balance.", "swap": ("amt + fee <= balance", "amt + fee < balance")}]
    return mk(rng, "cs_account_state_trace", "3.5", "3.B", "What value is returned by the code segment?", shown, call=call, muts=muts, py=py, concept="a method with a guarded update that returns a boolean and changes private state only on success",
              path="javac+java output vs Python simulation", kwhy="The first withdrawal succeeds; the second needs one more than the balance, so it fails; the third needs exactly the balance and succeeds, leaving 0.")


@retry_any
def cs_array_field_trace(rng):
    a = rng.randint(2, 5)
    shown = "class Scores {\n    private int[] data;\n    public Scores(int n) {\n        data = new int[n];\n    }\n    public void add(int idx, int pts) {\n        data[idx] += pts;\n    }\n    public int total() {\n        int t = 0;\n        for (int v : data) {\n            t += v;\n        }\n        return t;\n    }\n    public int[] getData() {\n        return data;\n    }\n}"
    call = f"Scores s = new Scores({a + 1});\ns.add(0, 5);\ns.add({a}, 7);\ns.add(0, 2);\nint[] d = s.getData();\nd[1] = 100;\nreturn s.total() + \" \" + d.length;"
    py = f"{5 + 7 + 2 + 100} {a + 1}"
    muts = [{"why": "Believes getData returns a copy, so changing it does not change the object.", "call": f"Scores s = new Scores({a + 1});\ns.add(0, 5);\ns.add({a}, 7);\ns.add(0, 2);\nreturn s.total() + \" \" + {a + 1};"},
            {"why": "Believes add replaces the element instead of adding to it.", "swap": ("data[idx] += pts;", "data[idx] = pts;")},
            {"why": "Believes the new array has the length given minus one.", "swap": ("data = new int[n];", "data = new int[n - 1];")},
            {"why": "Believes total adds only the first element.", "swap": ("for (int v : data) {\n            t += v;\n        }", "t = data[0];")}]
    return mk(rng, "cs_array_field_trace", "3.6", "3.B", "What value is returned by the code segment?", shown, call=call, muts=muts, py=py, concept="an accessor that returns a reference to a private array exposes the array contents",
              path="javac+java output vs Python simulation", kwhy="getData returns the object's own array, so assigning d[1] changes the data that total sums.")


# ---- 단원 2·3 코드 이해 (Practice 4) ----
def cs_precondition_sublist(rng):
    cls = "class Probe {\n    public static String slice(String s, int start, int len) {\n        return s.substring(start, start + len);\n    }\n}"
    calls = ["return Probe.slice(\"hello\", 1, 3);", "return Probe.slice(\"hello\", 0, 5);", "return Probe.slice(\"hello\", 2, 0);", "return Probe.slice(\"hello\", 3, 4);", "return Probe.slice(\"hello\", -1, 2);"]
    res = J.java_eval(cls, [("ret", c) for c in calls])
    if any("EXC:" in r for r in res[:3]) or "EXC:" not in res[3] or "EXC:" not in res[4]:
        raise ValueError("expectation_failed")
    key = ("start is at least 0, len is at least 0, and start + len is at most s.length().", "substring needs 0 <= start and start + len <= s.length(), and a negative len makes the end index smaller than start.")
    wrongs = [("start is at least 0, and len is greater than 0 and at most s.length().", "This is stronger than needed and also incomplete: it does not stop start + len from exceeding s.length()."),
              ("start + len is less than s.length() and neither start nor len is negative.", "This is stronger than needed (start + len may equal s.length()) and it does not rule out a negative start."),
              ("len is at most s.length() and start is any int value.", "This does not prevent start + len from passing the end, as slice(\"hello\", 3, 4) shows.")]
    stem = "Which of the following is the weakest precondition (the least restrictive condition) that guarantees the method slice will not throw an exception?"
    return _text_item(rng, "cs_precondition_sublist", "2.10", "4.B", stem, cls, key, wrongs, "a precondition combines every constraint a call needs", "java runs on valid and invalid start and length values", ["method=slice"])


def cs_describe_running_max(rng):
    cls = "class Probe {\n    public static int mystery(int[] a) {\n        int m = a[0];\n        int idx = 0;\n        for (int i = 1; i < a.length; i++) {\n            if (a[i] > m) {\n                m = a[i];\n                idx = i;\n            }\n        }\n        return idx;\n    }\n}"
    arrs = [("{4, 9, 2, 9}", 1), ("{7}", 0), ("{1, 2, 3, 4}", 3), ("{8, 3, 8}", 0)]
    res = J.java_eval(cls, [("ret", f"return Probe.mystery(new int[] {a});") for a, _ in arrs])
    if [J.tidy(r) for r in res] != [str(e) for _, e in arrs]:
        raise ValueError("expectation_failed")
    key = ("It returns the index of the first occurrence of the largest value in a.", "For {4, 9, 2, 9} it returns 1, the first position of the largest value 9.")
    wrongs = [("It returns the largest value in a.", "For {4, 9, 2, 9} the method returns 1, not 9."),
              ("It returns the index of the last occurrence of the largest value in a.", "For {4, 9, 2, 9} the method returns 1, not 3, because the comparison is strict."),
              ("It returns the number of values that are larger than a[0].", "For {1, 2, 3, 4} that count would be 3 but for {4, 9, 2, 9} it would be 2, while the method returns 1.")]
    stem = "Which of the following best describes the value returned by the method mystery when it is called with a non-empty array a?"
    return _text_item(rng, "cs_describe_running_max", "4.5", "4.A", stem, cls, key, wrongs, "describe what a running-maximum loop with an index computes", "java runs on four arrays", ["method=mystery"])


def cs_postcondition_swap_loop(rng):
    cls = "class Probe {\n    public static void mystery(int[] a) {\n        for (int i = 0; i < a.length / 2; i++) {\n            int t = a[i];\n            a[i] = a[a.length - 1 - i];\n            a[a.length - 1 - i] = t;\n        }\n    }\n}"
    cases = [("{1, 2, 3, 4}", "4 3 2 1"), ("{5, 6, 7}", "7 6 5"), ("{9}", "9"), ("{2, 2, 8}", "8 2 2")]
    res = J.java_eval(cls, [("ret", f"int[] a = new int[] {c}; Probe.mystery(a); String r = \"\"; for (int v : a) {{ r += v + \" \"; }} return r.trim();") for c, _ in cases])
    if [J.tidy(r) for r in res] != [e for _, e in cases]:
        raise ValueError("expectation_failed")
    key = ("The values in a are in the reverse of their original order.", "Each pass swaps a symmetric pair, so after the loop the array is reversed.")
    wrongs = [("The first and last values of a have been swapped, and the other values are unchanged.", "Every symmetric pair is swapped, not only the first and last values."),
              ("The values in a are in increasing order.", "The method does not compare values; the array {5, 6, 7} becomes {7, 6, 5}."),
              ("The values in the first half of a have been copied into the second half.", "Values are swapped rather than copied, so the original values of the second half move to the first half.")]
    stem = "Which of the following is true after the method mystery is called with a non-empty array a?"
    return _text_item(rng, "cs_postcondition_swap_loop", "2.12", "4.B", stem, cls, key, wrongs, "a postcondition describes the final state of an array after a loop", "java runs on arrays of length 1 to 4", ["method=mystery"])


def cs_class_describe_method(rng):
    cls = "class Counter {\n    private int count;\n    private int cap;\n    public Counter(int c) {\n        cap = c;\n    }\n    public boolean tick() {\n        if (count < cap) {\n            count++;\n            return true;\n        }\n        return false;\n    }\n    public int get() {\n        return count;\n    }\n}"
    res = J.java_eval(cls, [("ret", "Counter c = new Counter(2); return c.tick() + \" \" + c.tick() + \" \" + c.tick() + \" \" + c.get();"), ("ret", "Counter c = new Counter(0); return c.tick() + \" \" + c.get();")])
    if [J.tidy(r) for r in res] != ["true true false 2", "false 0"]:
        raise ValueError("expectation_failed")
    key = ("It adds 1 to count and returns true while count is below cap, and otherwise returns false.", "With cap 2, three calls return true, true, false and leave count at 2.")
    wrongs = [("It adds 1 to count on every call, and returns true only when count was below cap before the call.", "When count has reached cap, count is not increased."),
              ("It adds 1 to count only when count already equals cap, and then it returns true.", "The condition is count < cap, so it increases while count is below the cap."),
              ("It sets count to cap in a single call and returns true when count was below cap.", "count increases by 1 per call; it reaches cap only after cap calls.")]
    stem = "Which of the following best describes the behavior of the method tick in the Counter class?"
    return _text_item(rng, "cs_class_describe_method", "3.5", "4.A", stem, cls, key, wrongs, "describe a method that guards a state change and reports success", "java runs on caps of 0 and 2", ["method=tick"])
