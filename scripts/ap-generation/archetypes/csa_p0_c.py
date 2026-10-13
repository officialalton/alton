"""AP Computer Science A P0 원형 C — 공식 범위(Practice 2 22–38%, 단원 2 25–35% 등)를 라이브러리 한 벌로 채우기 위한 보충 원형: 중첩 if, 코드 완성 4종(String·ArrayList·재귀·클래스 상태)."""
from csa_common import *  # noqa: F401,F403
from csa_p0_a import client, pick, STEM_OUT
import csa_java as J


# ======================= 2.4 중첩 if·dangling else (3.A) =======================
@retry_sep
def cs_if_nesting(rng):
    a, b, t1, t2 = rng.randint(3, 12), rng.randint(2, 9), rng.randint(4, 9), rng.randint(3, 8)
    base = f"if (a > {t1})\n    if (b > {t2})\n        result = a + b;\n    else\n        result = a - b;"
    code = f"int a = {a};\nint b = {b};\nint result = 5;\n{base}\nSystem.out.println(result);"
    py = str(((a + b) if b > t2 else (a - b)) if a > t1 else 5)
    muts = [{"why": "Pairs the else with the outer if, ignoring that an else belongs to the nearest unmatched if.", "swap": (base, f"if (a > {t1}) {{\n    if (b > {t2})\n        result = a + b;\n}} else {{\n    result = a - b;\n}}")},
            {"why": "Reads the else branch as running when the inner condition is true.", "swap": ("result = a + b;\n    else\n        result = a - b;", "result = a - b;\n    else\n        result = a + b;")},
            {"why": "Ignores the inner condition and tests only the outer one.", "swap": (base, f"if (a > {t1})\n    result = a + b;\nelse\n    result = a - b;")},
            {"why": "Believes each assignment adds to the starting value of result instead of replacing it.", "swap": (base, f"if (a > {t1})\n    if (b > {t2})\n        result += a + b;\n    else\n        result += a - b;")}]
    return mk(rng, "cs_if_nesting", "2.4", "3.A", STEM_OUT, code, muts=muts, py=py, concept="an else clause pairs with the nearest unmatched if", path="javac+java output vs Python nested conditional",
              kwhy="Without braces the else belongs to the inner if: when a is not above the outer threshold nothing is assigned and result stays 5; otherwise the inner condition chooses between a + b and a - b.", facts=[f"key={py}"])


# ======================= 2.10 / 2.A String 완성 =======================
def cs_string_completion(rng):
    kind = pick(rng, ["vowels", "reverse"])
    if kind == "vowels":
        tpl = "class Text {\n    /** Returns the number of lowercase vowels (a, e, i, o, u) in s. */\n    public static int countVowels(String s) {\n        int count = 0;\n        for (int i = 0; i < s.length(); i++) {\n/*BODY*/\n        }\n        return count;\n    }\n}"
        cands = [('if ("aeiou".indexOf(s.substring(i, i + 1)) >= 0) { count++; }', True, None), ('if ("aeiou".indexOf(s.substring(i, i + 1)) > 0) { count++; }', False, "Uses > 0, so the vowel a at index 0 of the vowel list is never counted."), ('if (s.indexOf("aeiou") >= 0) { count++; }', False, "Searches for the whole vowel list inside s instead of testing one character."), ('if ("aeiou".indexOf(s.substring(i, i + 1)) >= 0) { count = i; }', False, "Stores the index instead of counting.")]
        words = ["", "sky", "audio", "Education", "banana", "rhythm", "aeiou"]
        py = lambda w: sum(1 for c in w if c in "aeiou")  # noqa: E731
        tests = [(f'return Text.countVowels("{w}");', str(py(w))) for w in words]
        stem = "The method countVowels is intended to return the number of lowercase vowels (a, e, i, o, u) in the String s. Which of the following can replace /* missing code */ so that countVowels works as intended?"
        indent = "            "
        shown = tpl.replace("/*BODY*/", indent + "/* missing code */")
    else:
        tpl = "class Text {\n    /** Returns s with its characters in reverse order. */\n    public static String reverse(String s) {\n        String result = \"\";\n        for (int i = s.length() - 1; i >= 0; i--) {\n/*BODY*/\n        }\n        return result;\n    }\n}"
        cands = [("result += s.substring(i, i + 1);", True, None), ("result = s.substring(i, i + 1);", False, "Replaces the result on every pass instead of appending."), ("result = s.substring(i, i + 1) + result;", False, "Prepends each character while moving backward, which rebuilds the original order."), ("result += s.substring(i);", False, "Appends the whole suffix starting at i instead of one character.")]
        words = ["", "a", "ab", "stack", "level", "abcd"]
        tests = [(f'return Text.reverse("{w}");', w[::-1]) for w in words]
        stem = "The method reverse is intended to return a String with the characters of s in reverse order. Which of the following can replace /* missing code */ so that reverse works as intended?"
        indent = "            "
        shown = tpl.replace("/*BODY*/", indent + "/* missing code */")
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", indent + c), "why": w, "key": k} for c, k, w in cands]
    return mk_tests(rng, "cs_string_completion", "2.10", "2.A", stem, shown, options, tests, concept="complete a String loop that tests or appends one character at a time", path="each candidate compiled into the method and run on a set of Strings including the empty string",
                    kwhy_by_key="This statement processes exactly one character per pass in the way the specification requires, and every test String gives the expected result.")


# ======================= 4.10 / 2.A ArrayList 완성 =======================
def cs_arraylist_completion(rng):
    tpl = "class ListTools {\n    /** Removes every negative value from list, keeping the other values in their original order. */\n    public static void removeNegatives(ArrayList<Integer> list) {\n        for (int i = list.size() - 1; i >= 0; i--) {\n/*BODY*/\n        }\n    }\n}"
    shown = tpl.replace("/*BODY*/", "            /* missing code */")
    cands = [("if (list.get(i) < 0) { list.remove(i); }", True, None), ("if (list.get(i) <= 0) { list.remove(i); }", False, "Also removes the value 0."), ("if (list.get(i) < 0) { list.set(i, 0); }", False, "Replaces negative values with 0 instead of removing them."), ("if (list.get(i) < 0) { list.remove(i); i--; }", False, "Decrements i again after a removal, which skips the next element to the left.")]
    options = [{"text": f"`{c}`", "source": tpl.replace("/*BODY*/", "            " + c), "why": w, "key": k} for c, k, w in cands]
    lists = [[3, -1, 4], [-1, -2, -3], [0, -1, 0], [], [5, 6], [-2, 7, -2, -4, 1]]
    tests = [("ArrayList<Integer> L = new ArrayList<Integer>(); " + " ".join(f"L.add({v});" for v in a) + " ListTools.removeNegatives(L); return L;", str([v for v in a if v >= 0])) for a in lists]
    return mk_tests(rng, "cs_arraylist_completion", "4.10", "2.A", "The method removeNegatives is intended to remove every negative value from list while keeping the other values in order. Which of the following can replace /* missing code */ so that removeNegatives works as intended?", shown, options, tests,
                    concept="remove elements during a backward ArrayList traversal", path="each candidate compiled and run on lists with zeros, runs of negatives and an empty list", kwhy_by_key="Traversing from the end means a removal never shifts an unvisited element, and the test uses a strict comparison with 0, so only negative values are removed.")


# ======================= 4.16 / 2.A 재귀 완성 =======================
def cs_recursion_completion(rng):
    tpl = "class Rec {\n    /** Returns base raised to the power exp, where exp is a non-negative integer. */\n    public static int power(int base, int exp) {\n/*BODY*/\n    }\n}"
    shown = tpl.replace("/*BODY*/", "        /* missing code */")
    cands = [("if (exp == 0) {\n            return 1;\n        }\n        return base * power(base, exp - 1);", True, None), ("if (exp == 1) {\n            return 1;\n        }\n        return base * power(base, exp - 1);", False, "Uses the wrong base case, so power(base, 1) returns 1 and power(base, 0) never ends."), ("if (exp == 0) {\n            return 1;\n        }\n        return base + power(base, exp - 1);", False, "Adds instead of multiplying."), ("if (exp == 0) {\n            return 1;\n        }\n        return base * power(base, exp);", False, "Never reduces exp, so the recursion never reaches the base case.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "        " + c), "why": w, "key": k} for c, k, w in cands]
    tests = [("return Rec.power(2, 0);", "1"), ("return Rec.power(2, 5);", "32"), ("return Rec.power(3, 3);", "27"), ("return Rec.power(5, 1);", "5")]
    return mk_tests(rng, "cs_recursion_completion", "4.16", "2.A", "The method power is intended to return base raised to the power exp, where exp is a non-negative integer. Which of the following can replace /* missing code */ so that power works as intended?", shown, options, tests,
                    concept="a recursive method needs a correct base case and a recursive call that makes progress", path="each candidate compiled and run on exponents 0, 1 and larger (non-terminating candidates end in StackOverflowError)", kwhy_by_key="The base case handles exp of 0, and each call multiplies by base while reducing exp by 1, so the recursion terminates with the correct product.")


# ======================= 3.5 / 2.B 클래스 상태 메서드 완성 =======================
def cs_class_state_completion(rng):
    tpl = "class Wallet {\n    private int balance;\n    public Wallet(int start) { balance = start; }\n    public int getBalance() { return balance; }\n\n    /** Spends amt if the wallet holds at least amt, and returns true. Otherwise leaves the balance unchanged and returns false. */\n    public boolean spend(int amt) {\n/*BODY*/\n    }\n}"
    shown = tpl.replace("/*BODY*/", "        /* missing code */")
    cands = [("if (amt <= balance) {\n            balance -= amt;\n            return true;\n        }\n        return false;", True, None), ("if (amt < balance) {\n            balance -= amt;\n            return true;\n        }\n        return false;", False, "Refuses a purchase that uses exactly the whole balance (uses < instead of <=)."), ("balance -= amt;\n        return amt <= balance + amt;", False, "Reduces the balance before checking, so a purchase that is too large still changes the balance."), ("if (amt <= balance) {\n            balance = amt;\n            return true;\n        }\n        return false;", False, "Assigns the amount to the balance instead of subtracting it.")]
    options = [{"text": f"```\n{c}\n```", "source": tpl.replace("/*BODY*/", "        " + c), "why": w, "key": k} for c, k, w in cands]
    tests = [("Wallet w = new Wallet(10); boolean r = w.spend(4); return r + \" \" + w.getBalance();", "true 6"), ("Wallet w = new Wallet(10); boolean r = w.spend(10); return r + \" \" + w.getBalance();", "true 0"), ("Wallet w = new Wallet(10); boolean r = w.spend(11); return r + \" \" + w.getBalance();", "false 10"), ("Wallet w = new Wallet(7); w.spend(3); boolean r = w.spend(5); return r + \" \" + w.getBalance();", "false 4")]
    return mk_tests(rng, "cs_class_state_completion", "3.5", "2.B", "The method spend in the Wallet class is intended to behave as described in its comment. Which of the following can replace /* missing code */ so that spend works as intended?", shown, options, tests, concept="a method that guards a state change and reports success", path="each candidate compiled into the class and run on boundary purchases (exact balance, too much, repeated)", kwhy_by_key="The check uses at least amt, the balance is reduced only after the check succeeds, and a failed purchase returns false with the balance unchanged.")


STAGE_P1_MC = ["cs_if_nesting", "cs_string_completion", "cs_arraylist_completion", "cs_recursion_completion", "cs_class_state_completion"]
