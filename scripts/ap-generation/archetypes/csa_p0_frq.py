"""AP Computer Science A P0 — FRQ 4유형(공식 형식: Q1 Methods and Control Structures, Q2 Class Design, Q3 Data Analysis with ArrayList, Q4 2D Array), 문항별 Q1 7점·Q2 7점·Q3 5점·Q4 6점 = 25점(2025 공식 배점).
각 문항은 (1) 컴파일되는 모범 답안 + 독립 대안 답안 + '그럴듯한 오답' 3개를 실제로 javac/java 로 돌려 같은 테스트 케이스 묶음에서 모범·대안은 전부 통과, 오답은 최소 1개 실패함을 확인하고,
(2) 기대값은 독립 Python 참조 구현이 만든다. 테스트 케이스는 `self_check_tests` 로 팩에 저장한다(학생 답안 자기 점검용 — 이 파일은 학생 코드를 실행하지 않는다).
모범 답안은 'ALTON reference answer for self-review — not official AP scoring' 이다(공식 채점 문구 복제 없음). 채점 행은 1점씩이다. 원래 9행으로 쓴 행동 단위를 공식 배점에 맞게 인접 행끼리 합쳐 한 행이 한두 개의 연속된 행동을 본다(`_rescale`)."""
import re
from csa_common import *  # noqa: F401,F403
from calc_ab_frq import row, part
from bp import frq_blueprint
import csa_java as J

REF_NOTE = "ALTON reference answer for self-review — not official AP scoring"
pick = lambda rng, seq: seq[rng.randrange(len(seq))]  # noqa: E731


def R(rid, crit, req, err=None, requires=None):
    r = row(rid, 1, crit, req, None, None, err, requires, False, False, None, False)
    r["kind"] = "code"
    return r


def _rename(src, name, i):
    return re.sub(rf"\b{name}\b", f"{name}V{i}", src)


def _plain(src):
    """검증용 소스 정리: import 줄 제거(검증기는 java.util.* 를 이미 가져온다), public class 는 같은 파일에 여러 개 둘 수 없어 package-private 로."""
    return re.sub(r"^import .*\n", "", src, flags=re.M).replace("public class", "class")


def extract_method(src, name):
    """클래스 소스에서 메서드 하나(머리글+본문)를 중괄호 짝을 세어 잘라낸다(모범 답안 표시용)."""
    m = re.search(rf"^[ ]*public static [\w<>\[\]]+ {name}\(", src, re.M)
    i = src.index("{", m.start()); depth = 0
    for j in range(i, len(src)):
        depth += src[j] == "{"; depth -= src[j] == "}"
        if depth == 0:
            return src[m.start():j + 1]


def verify_variants(cname, ref, alt, wrongs, tests, shared=""):
    """ref/alt/wrongs[(why, src, part)] 전체 클래스 소스. tests[(part, 호출 본문, 기대 문자열)]. 모범·대안은 전부 통과, 오답은 자기 파트 테스트에서 최소 1개 실패해야 한다."""
    variants = [("ref", ref, None), ("alt", alt, None)] + [(w, s, p) for w, s, p in wrongs]
    classes = shared + "\n" + "\n".join(_rename(_plain(s), cname, i) for i, (_n, s, _p) in enumerate(variants))
    bodies, owner = [], []
    for i in range(len(variants)):
        for tp, call, _e in tests:
            bodies.append(("ret", _rename(call, cname, i))); owner.append((i, tp))
    res = J.java_eval(classes, bodies)
    fails = {i: [] for i in range(len(variants))}
    for (i, tp), r, (_tp, call, exp) in zip(owner, res, tests * len(variants)):
        if J.tidy(r) != exp:
            fails[i].append((tp, call))
    if fails[0] or fails[1]:
        raise ValueError(f"reference_or_alternative_fails_tests:{fails[0][:2]}:{fails[1][:2]}")
    for i, (w, _s, p) in enumerate(variants[2:], 2):
        if not [f for f in fails[i] if f[0] == p]:
            raise ValueError(f"wrong_solution_passes_all_tests_of_part_{p}:{w}")
    return {"variants": len(variants), "wrong_failures": [len(fails[i]) for i in range(2, len(variants))]}


def _fence(code):
    return f"{FENCE}java\n{code.strip(chr(10))}\n{FENCE}"


CSA_POINTS = {"q1": [3, 4], "q2": [7], "q3": [5], "q4": [6]}  # 2025 공식 배점: Q1 7(a 3 + b 4), Q2 7, Q3 5, Q4 6


def _group_sizes(n, m, rows):
    """n개 행을 m개 묶음으로 인접 병합한다. 마지막 '컴파일/헤더' 행은 앞 행과 먼저 합친다."""
    sizes = [1] * n
    while len(sizes) > m:
        if len(sizes) == n and re.search(r"compil|headers? and return type", rows[-1]["criterion"], re.I):
            sizes[-2] += sizes.pop()
            continue
        k = min(range(len(sizes) - 1), key=lambda i: (sizes[i] + sizes[i + 1], i))  # 가장 작은 인접 쌍을 합친다
        sizes[k] += sizes.pop(k + 1)
    return sizes


def _rescale(template, parts):
    """9행(각 1점)으로 쓴 채점 행을 공식 배점(CSA_POINTS)에 맞게 병합한다. 행 id·requires 를 새 묶음 기준으로 다시 매긴다."""
    tgt = CSA_POINTS[template]; owner = {}
    assert len(tgt) == len(parts), template
    for pt, m in zip(parts, tgt):
        rows = pt["rubric_rows"]
        assert all(r["points"] == 1 for r in rows) and len(rows) >= m, (template, pt["label"])
        sizes = _group_sizes(len(rows), m, rows)
        prefix = rows[0]["row_id"][0]; out = []; i = 0
        for g, sz in enumerate(sizes, 1):
            chunk = rows[i:i + sz]; i += sz
            for r in chunk:
                owner[r["row_id"]] = f"{prefix}{g}"
            merged = dict(chunk[0]); merged["row_id"] = f"{prefix}{g}"; merged["points"] = 1
            merged["criterion"] = "; ".join(r["criterion"].rstrip(".") for r in chunk) + "." if sz > 1 else chunk[0]["criterion"]
            merged["required_elements"] = [e for r in chunk for e in r["required_elements"]]
            merged["common_errors"] = [e for r in chunk for e in r["common_errors"]]
            merged["_req"] = chunk[0].get("requires_row_id")
            out.append(merged)
        pt["rubric_rows"] = out; pt["points"] = m
    for pt in parts:
        for r in pt["rubric_rows"]:
            q = owner.get(r.pop("_req"))
            r["requires_row_id"] = q if q and q != r["row_id"] else None
    return parts


def _pack(arch, template, topic, extra, skill, title, intro, skeleton, parts, tests, verified, facts, bpr):
    assert sum(p["points"] for p in parts) == 9 and all(r["points"] == 1 for p in parts for r in p["rubric_rows"]), arch
    parts = _rescale(template, parts)
    total = sum(p["points"] for p in parts)
    stim = {"kind": "text", "description": intro + "\n" + _fence(skeleton), "data": {"variant": "java_code", "language": "java"}}
    pk = {"archetype": arch, "template": template, "topic": topic, "extra_topics": extra, "skill": skill, "representative_skill": skill, "calculator": "not_allowed", "title": title, "stimulus": stim,
          "parts": parts, "total_points": total, "est_minutes": 22, "facts": facts, "expected_values": [], "reference_note": REF_NOTE,
          "self_check_tests": [{"part": p, "call": c, "expected": e} for p, c, e in tests], "verification": verified}
    concept, thinking, conds, path = bpr
    pk["blueprint"] = frq_blueprint(arch, SUB, pk, concept, thinking, conds, {"type": "code", "must_include": ["class or method skeleton", "specification with examples"]}, path, extra={"judgment_demand": "write correct Java for the stated specification"}, method="javac+java unit tests + python reference")
    return pk


# ======================= Q1 메서드·제어문 (4 + 5) =======================
def csf_methods_pass(rng):
    L, U = pick(rng, [(6, 2), (8, 2), (8, 3), (10, 2)])
    skeleton = "public class PasswordCheck {\n    /** Returns the number of uppercase letters (A through Z) in s. */\n    public static int countUpper(String s) { /* to be implemented in part (a) */ }\n\n    /** Rates the strength of the password s; see part (b). */\n    public static String rate(String s) { /* to be implemented in part (b) */ }\n}"
    ref = f"""public class PasswordCheck {{
    public static int countUpper(String s) {{
        int count = 0;
        for (int i = 0; i < s.length(); i++) {{
            char ch = s.charAt(i);
            if (ch >= 'A' && ch <= 'Z') {{
                count++;
            }}
        }}
        return count;
    }}
    public static String rate(String s) {{
        int upper = countUpper(s);
        if (s.length() >= {L} && upper >= {U}) {{
            return "strong";
        }}
        if (s.length() >= {L} || upper >= 1) {{
            return "medium";
        }}
        return "weak";
    }}
}}"""
    alt = f"""public class PasswordCheck {{
    public static int countUpper(String s) {{
        String caps = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        int n = 0;
        int i = s.length() - 1;
        while (i >= 0) {{
            if (caps.indexOf(s.substring(i, i + 1)) >= 0) {{
                n += 1;
            }}
            i--;
        }}
        return n;
    }}
    public static String rate(String s) {{
        boolean isLong = s.length() >= {L};
        int u = countUpper(s);
        String result = "weak";
        if (isLong || u >= 1) {{
            result = "medium";
        }}
        if (isLong && u >= {U}) {{
            result = "strong";
        }}
        return result;
    }}
}}"""
    w = [("Stops one character early (loop bound s.length() - 1).", ref.replace("i < s.length();", "i < s.length() - 1;"), "a"),
         ("Excludes the letter A (uses > instead of >=).", ref.replace("ch >= 'A'", "ch > 'A'"), "a"),
         ("Counts every letter, not only uppercase letters.", ref.replace("ch >= 'A' && ch <= 'Z'", "ch >= 'A' && ch <= 'z'"), "a"),
         ("Requires length greater than the threshold instead of at least the threshold.", ref.replace(f"s.length() >= {L} && upper", f"s.length() > {L} && upper"), "b"),
         ("Returns medium when both conditions are required (uses && instead of ||).", ref.replace(f"s.length() >= {L} || upper >= 1", f"s.length() >= {L} && upper >= 1"), "b"),
         ("Does not call countUpper correctly: counts the length instead of the uppercase letters.", ref.replace("int upper = countUpper(s);", "int upper = s.length();"), "b")]
    sample = ["", "abc", "Abc", "HELLO", "abcdefgh", "Abcdefgh", "AbCdEfGh", "ABcdefghij", "zzzzzzzzzzzz", "QWERTYUIOP", "xyzABC", "ZaZa", "Az", "aZ"]
    py_up = lambda s: sum(1 for c in s if "A" <= c <= "Z")  # noqa: E731
    py_rate = lambda s: "strong" if len(s) >= L and py_up(s) >= U else ("medium" if len(s) >= L or py_up(s) >= 1 else "weak")  # noqa: E731
    tests = [("a", f'return PasswordCheck.countUpper("{s}");', str(py_up(s))) for s in sample[:10]] + [("b", f'return PasswordCheck.rate("{s}");', py_rate(s)) for s in sample]
    verified = verify_variants("PasswordCheck", ref, alt, w, tests)
    parts = [
        part("a", "Write the method countUpper, which returns the number of uppercase letters (A through Z) in the String s. For example, countUpper(\"Hello World\") returns 2 and countUpper(\"abc\") returns 0. Complete the method countUpper.", 4, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "countUpper")),
             [R("A1", "Iterates over every character of s with a loop whose bounds are correct (first through last index)", ["loop over 0 to s.length() - 1"], ["stops before the last character"]),
              R("A2", "Tests each character for being between A and Z inclusive (or an equivalent test)", ["ch >= 'A' && ch <= 'Z'"], ["excludes A or Z", "counts lowercase letters"], "A1"),
              R("A3", "Increments (or otherwise accumulates) a counter only for uppercase characters", ["count++ inside the condition"], ["increments for every character"], "A2"),
              R("A4", "Initializes the counter before the loop and returns it after the loop", ["int count = 0", "return count"], ["returns inside the loop"], "A1")]),
        part("b", f"Write the method rate, which returns a String that rates the strength of the password s. The rating is \"strong\" if s has at least {L} characters and at least {U} uppercase letters; otherwise \"medium\" if s has at least {L} characters or at least 1 uppercase letter; otherwise \"weak\". Your solution must call countUpper from part (a). Assume that countUpper works as specified.", 5, "code", ["2.C"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "rate")),
             [R("B1", "Calls countUpper(s) and uses its result (does not duplicate the counting loop)", ["countUpper(s)"], ["re-implements the loop"]),
              R("B2", f"Compares s.length() with {L} using a correct boundary (at least {L})", [f"s.length() >= {L}"], ["uses > instead of >="], None),
              R("B3", f"Returns \"strong\" exactly when the length condition and the uppercase count of at least {U} both hold", ["&&", "strong"], ["uses || for strong"], "B1"),
              R("B4", "Returns \"medium\" exactly when the length condition or at least one uppercase letter holds (and the password is not strong)", ["||", "medium"], ["uses && for medium"], "B3"),
              R("B5", "Returns \"weak\" otherwise; the tests are ordered or combined so exactly one value is returned for every input", ["weak", "else or fall through"], ["checks medium before strong"], "B4")])]
    return _pack("csf_methods_pass", "q1", "2.10", ["1.15", "2.9"], "2.A", "PasswordCheck: counting uppercase letters and rating a password", f"A teacher is writing a class PasswordCheck with two static methods. The class is shown with the method headers. (The threshold for a long password is {L} characters.)", skeleton, parts, tests, verified, [f"L={L}", f"U={U}"],
                 ("Methods and control structures with String traversal and a helper call", ["Write a counting loop over the characters of a String", "Combine conditions with && and || in the right order", "Call the method from part (a) instead of repeating it"], [("the reference and an alternative pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and three wrong solutions per part; expected values from Python"))


def csf_methods_runs(rng):
    k = pick(rng, [2, 3])
    skeleton = "public class RunTools {\n    /** Returns the number of positions i such that s.charAt(i) equals s.charAt(i + 1). */\n    public static int countPairs(String s) { /* part (a) */ }\n\n    /** Returns s with every run of consecutive equal characters replaced by one copy of that character. */\n    public static String squeeze(String s) { /* part (b) */ }\n}"
    ref = """public class RunTools {
    public static int countPairs(String s) {
        int count = 0;
        for (int i = 0; i < s.length() - 1; i++) {
            if (s.charAt(i) == s.charAt(i + 1)) {
                count++;
            }
        }
        return count;
    }
    public static String squeeze(String s) {
        String result = "";
        for (int i = 0; i < s.length(); i++) {
            if (i == 0 || s.charAt(i) != s.charAt(i - 1)) {
                result += s.charAt(i);
            }
        }
        return result;
    }
}"""
    alt = """public class RunTools {
    public static int countPairs(String s) {
        int n = 0;
        int i = 1;
        while (i < s.length()) {
            if (s.substring(i, i + 1).equals(s.substring(i - 1, i))) {
                n++;
            }
            i++;
        }
        return n;
    }
    public static String squeeze(String s) {
        if (s.length() == 0) {
            return "";
        }
        String out = s.substring(0, 1);
        for (int i = 1; i < s.length(); i++) {
            String cur = s.substring(i, i + 1);
            if (!cur.equals(out.substring(out.length() - 1))) {
                out += cur;
            }
        }
        return out;
    }
}"""
    w = [("Loops to s.length() so s.charAt(i + 1) goes out of bounds.", ref.replace("i < s.length() - 1; i++) {\n            if (s.charAt(i) == s.charAt(i + 1))", "i < s.length(); i++) {\n            if (s.charAt(i) == s.charAt(i + 1))"), "a"),
         ("Compares each character with the one two positions ahead.", ref.replace("s.charAt(i) == s.charAt(i + 1)", "i + 2 < s.length() && s.charAt(i) == s.charAt(i + 2)"), "a"),
         ("Removes every repeated character in the whole string, not only consecutive ones.", ref.replace("i == 0 || s.charAt(i) != s.charAt(i - 1)", "result.indexOf(s.substring(i, i + 1)) < 0"), "b"),
         ("Drops the first character (starts the loop at 1 without adding it).", ref.replace("i == 0 || s.charAt(i) != s.charAt(i - 1)", "i > 0 && s.charAt(i) != s.charAt(i - 1)"), "b"),
         ("Compares each character with the first character of the string instead of the previous character.", ref.replace("s.charAt(i) != s.charAt(i - 1)", "s.charAt(i) != s.charAt(0)"), "b")]
    sample = ["", "a", "aa", "aab", "abb", "aabbcc", "abc", "aaaa", "abcabc", "xxyzzz", "mississippi", "qqrq"]
    py_pairs = lambda s: sum(1 for i in range(len(s) - 1) if s[i] == s[i + 1])  # noqa: E731
    py_sq = lambda s: "".join(c for i, c in enumerate(s) if i == 0 or c != s[i - 1])  # noqa: E731
    tests = [("a", f'return RunTools.countPairs("{s}");', str(py_pairs(s))) for s in sample] + [("b", f'return RunTools.squeeze("{s}");', py_sq(s)) for s in sample]
    verified = verify_variants("RunTools", ref, alt, w, tests)
    parts = [
        part("a", "Write the method countPairs, which returns the number of positions i such that the character at index i of s is equal to the character at index i + 1. For example, countPairs(\"aabbbc\") returns 3 and countPairs(\"abc\") returns 0. Complete the method countPairs.", 4, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "countPairs")),
             [R("A1", "Loops over the valid positions without accessing index s.length() (stops at s.length() - 1)", ["i < s.length() - 1"], ["accesses charAt(s.length())"]),
              R("A2", "Compares the character at i with the character at i + 1 (not i + 2 or i - 2)", ["s.charAt(i) == s.charAt(i + 1)"], ["compares non-neighbors"], "A1"),
              R("A3", "Counts each matching position once", ["count++"], ["counts runs instead of pairs"], "A2"),
              R("A4", "Initializes the count and returns it after the loop (also correct for the empty string)", ["return count"], ["returns inside the loop"], "A1")]),
        part("b", "Write the method squeeze, which returns a String in which each run of consecutive equal characters of s is replaced by a single copy of that character. For example, squeeze(\"aabbbc\") returns \"abc\", and squeeze(\"abab\") returns \"abab\". Complete the method squeeze.", 5, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "squeeze")),
             [R("B1", "Traverses every character of s with correct bounds", ["for (int i = 0; i < s.length(); i++)"], ["skips the first or last character"]),
              R("B2", "Keeps the first character (handles index 0 without comparing to index -1)", ["i == 0"], ["accesses charAt(-1)"], "B1"),
              R("B3", "Appends a character only when it differs from the previous character (consecutive, not global, duplicates)", ["s.charAt(i) != s.charAt(i - 1)"], ["removes non-consecutive duplicates"], "B1"),
              R("B4", "Builds the result String by concatenation or an equivalent construct", ["result += s.charAt(i)"], ["replaces instead of appending"], "B3"),
              R("B5", "Returns the built String after the loop (the empty string for empty input)", ["return result"], ["returns inside the loop"], "B4")])]
    return _pack("csf_methods_runs", "q1", "2.8", ["1.15", "2.10"], "2.A", "RunTools: adjacent pairs and squeezing runs", "A student is writing a class RunTools with two static methods that work with runs of equal characters.", skeleton, parts, tests, verified, [f"k={k}"],
                 ("Methods and control structures: adjacent-element comparison in a String and building a String", ["Compare neighbors without going out of bounds", "Build a String by selective concatenation"], [("the reference and an alternative pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))


# ======================= Q2 클래스 설계 (9, 한 파트) =======================
def csf_class_steps(rng):
    mn = pick(rng, [5000, 8000, 10000])
    skeleton = f"public class StepTracker {{\n    // to be written in this question:\n    //   constructor StepTracker(int minActive)\n    //   void addDailySteps(int steps)\n    //   int activeDays()\n    //   double averageSteps()\n}}"
    ref = f"""public class StepTracker {{
    private int minActive;
    private int totalSteps;
    private int days;
    private int active;

    public StepTracker(int minActive) {{
        this.minActive = minActive;
        totalSteps = 0;
        days = 0;
        active = 0;
    }}
    public void addDailySteps(int steps) {{
        totalSteps += steps;
        days++;
        if (steps >= minActive) {{
            active++;
        }}
    }}
    public int activeDays() {{
        return active;
    }}
    public double averageSteps() {{
        if (days == 0) {{
            return 0.0;
        }}
        return (double) totalSteps / days;
    }}
}}"""
    alt = """public class StepTracker {
    private int threshold;
    private int[] log = new int[400];
    private int n;

    public StepTracker(int minActive) {
        threshold = minActive;
    }
    public void addDailySteps(int steps) {
        log[n] = steps;
        n++;
    }
    public int activeDays() {
        int c = 0;
        for (int i = 0; i < n; i++) {
            if (log[i] >= threshold) {
                c++;
            }
        }
        return c;
    }
    public double averageSteps() {
        double sum = 0;
        for (int i = 0; i < n; i++) {
            sum += log[i];
        }
        return n == 0 ? 0.0 : sum / n;
    }
}"""
    w = [("Compares with > so a day exactly at the minimum is not active.", ref.replace("steps >= minActive", "steps > minActive"), "a"),
         ("Uses integer division for the average.", ref.replace("(double) totalSteps / days", "totalSteps / days"), "a"),
         ("Divides by zero when no days were recorded.", ref.replace("        if (days == 0) {\n            return 0.0;\n        }\n", ""), "a"),
         ("Counts every day as active.", ref.replace("        if (steps >= minActive) {\n            active++;\n        }", "        active++;"), "a"),
         ("Replaces the total instead of accumulating it.", ref.replace("totalSteps += steps;", "totalSteps = steps;"), "a")]

    def sim(seq):
        t = d = a = 0
        for s in seq:
            t += s; d += 1; a += s >= mn
        return f"{a} {(t / d) if d else 0.0}"
    seqs = [[], [mn], [mn - 1, mn + 1], [mn, 0, 2 * mn], [100, 200, 300], [mn, mn, mn, mn - 1], [mn + 7, 3]]
    tests = []
    for sq in seqs:
        body = f"StepTracker t = new StepTracker({mn}); " + " ".join(f"t.addDailySteps({s});" for s in sq) + ' return t.activeDays() + " " + t.averageSteps();'
        tests.append(("a", body, sim(sq)))
    verified = verify_variants("StepTracker", ref, alt, w, tests)
    table = "| Statement | Value returned | Explanation |\n|---|---|---|\n" + f"| StepTracker t = new StepTracker({mn}); | (none) | A tracker whose active-day minimum is {mn} steps |\n| t.addDailySteps({mn + 500}); | (none) | One day with {mn + 500} steps |\n| t.addDailySteps({mn - 2000}); | (none) | A second day, below the minimum |\n| t.activeDays() | 1 | Only the first day counted as active |\n| t.averageSteps() | {(mn + 500 + mn - 2000) / 2} | The mean of the two days |"
    parts = [part("a", f"Write the complete StepTracker class, including the constructor and any required instance variables and methods. A StepTracker records the number of steps taken on each day. The constructor takes the minimum number of steps for a day to count as active. addDailySteps records one more day. activeDays returns the number of recorded days with at least the minimum number of steps. averageSteps returns the average number of steps per recorded day as a double, or 0.0 if no days have been recorded. Examples of the behavior are listed in the following table.\n\n{table}", 9, "code", ["2.B"], "One correct implementation (ALTON reference answer):\n" + _fence(ref),
                 [R("A1", "Declares the class header public class StepTracker", ["public class StepTracker"], ["declares an interface or a method named StepTracker"]),
                  R("A2", "Declares private instance variables sufficient to store the minimum and the data needed by all methods", ["private int ..."], ["declares public instance variables", "declares the variables inside a method"], "A1"),
                  R("A3", "Declares a public constructor with one int parameter that stores the minimum in an instance variable", ["public StepTracker(int minActive)", "stores the parameter"], ["assigns the parameter to itself without this"], "A1"),
                  R("A4", "addDailySteps updates the stored data to reflect one more day (steps are accumulated, not replaced)", ["totalSteps += steps"], ["replaces the total"], "A2"),
                  R("A5", "addDailySteps (or activeDays) counts a day as active exactly when steps is at least the minimum", ["steps >= minActive"], ["uses > instead of >="], "A4"),
                  R("A6", "activeDays returns the number of active days (declared int, public)", ["public int activeDays()", "return active"], ["returns the total steps"], "A5"),
                  R("A7", "averageSteps handles the case of no recorded days by returning 0.0 without dividing by zero", ["days == 0", "return 0.0"], ["divides by zero"], "A2"),
                  R("A8", "averageSteps computes the average using floating-point division (a cast or double operand)", ["(double) totalSteps / days"], ["uses integer division"], "A7"),
                  R("A9", "All methods have the correct headers and return types (void, int, double) and the class compiles as a whole", ["void addDailySteps(int steps)", "double averageSteps()"], ["wrong return type"], "A1")])]
    return _pack("csf_class_steps", "q2", "3.3", ["3.4", "3.5"], "2.B", "StepTracker: design a class", f"A fitness app counts the days on which a user is active. The minimum for an active day is {mn} steps. Write the StepTracker class described below.", skeleton, parts, tests, verified, [f"min={mn}"],
                 ("Class design: header, private state, constructor, accessors and a guarded division", ["Choose private state", "Initialize it in the constructor", "Update and report it from methods"], [("the reference and an alternative (different state representation) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative with a different internal representation, and wrong solutions; expected values from a Python simulation"))


def csf_class_counter(rng):
    lim = pick(rng, [3, 4, 5])
    skeleton = "public class LimitedCounter {\n    // to be written in this question:\n    //   constructor LimitedCounter(int limit)\n    //   boolean increment()\n    //   void reset()\n    //   int remaining()\n}"
    ref = """public class LimitedCounter {
    private int limit;
    private int count;

    public LimitedCounter(int limit) {
        this.limit = limit;
        count = 0;
    }
    public boolean increment() {
        if (count < limit) {
            count++;
            return true;
        }
        return false;
    }
    public void reset() {
        count = 0;
    }
    public int remaining() {
        return limit - count;
    }
}"""
    alt = """public class LimitedCounter {
    private int left;
    private int cap;

    public LimitedCounter(int limit) {
        cap = limit;
        left = limit;
    }
    public boolean increment() {
        boolean ok = left > 0;
        if (ok) {
            left = left - 1;
        }
        return ok;
    }
    public void reset() {
        left = cap;
    }
    public int remaining() {
        return left;
    }
}"""
    w = [("Allows one extra increment (uses <= when comparing with the limit).", ref.replace("count < limit", "count <= limit"), "a"),
         ("Returns true even when the increment is refused.", ref.replace("        return false;\n    }\n    public void reset", "        return true;\n    }\n    public void reset"), "a"),
         ("Reset does not clear the count.", ref.replace("public void reset() {\n        count = 0;\n    }", "public void reset() {\n    }"), "a"),
         ("Remaining returns the count instead of the amount left.", ref.replace("return limit - count;", "return count;"), "a"),
         ("Increments the count even when the limit has been reached.", ref.replace("        if (count < limit) {\n            count++;\n            return true;\n        }\n        return false;", "        count++;\n        return count <= limit;"), "a")]

    def sim(ops):
        c, outs = 0, []
        for o in ops:
            if o == "i":
                if c < lim:
                    c += 1; outs.append("true")
                else:
                    outs.append("false")
            elif o == "r":
                c = 0
        return (" ".join(outs) + " " if outs else "") + str(lim - c)
    seqs = ["", "i", "iii", "i" * (lim + 2), "i" * lim + "r" + "i", "iirii", "r", "i" * lim]
    tests = []
    for sq in seqs:
        stm = f"LimitedCounter c = new LimitedCounter({lim}); String out = \"\"; " + " ".join("out += c.increment() + \" \";" if o == "i" else "c.reset();" for o in sq) + " return out + c.remaining();"
        tests.append(("a", stm, sim(sq)))
    verified = verify_variants("LimitedCounter", ref, alt, w, tests)
    table = f"| Statement | Result |\n|---|---|\n| LimitedCounter c = new LimitedCounter({lim}); | creates a counter that accepts at most {lim} increments |\n| c.increment() (called {lim} times) | true each time |\n| c.increment() | false (the limit has been reached) |\n| c.remaining() | 0 |\n| c.reset(); c.remaining() | {lim} |"
    parts = [part("a", f"Write the complete LimitedCounter class, including the constructor and any required instance variables and methods. A LimitedCounter accepts increments until a limit that is given to the constructor is reached. increment adds one to the counter and returns true if the limit has not been reached, and returns false (without changing the counter) otherwise. reset sets the counter back to its starting value. remaining returns the number of increments still allowed. Examples of the behavior are listed in the following table.\n\n{table}", 9, "code", ["2.B"], "One correct implementation (ALTON reference answer):\n" + _fence(ref),
                 [R("A1", "Declares the class header public class LimitedCounter", ["public class LimitedCounter"], ["wrong class name"]),
                  R("A2", "Declares private instance variables that store the limit and the current progress", ["private int limit", "private int count"], ["public instance variables", "no stored limit"], "A1"),
                  R("A3", "Constructor has the correct signature and records the limit (distinguishing parameter from field)", ["public LimitedCounter(int limit)", "this.limit = limit"], ["limit = limit"], "A1"),
                  R("A4", "increment refuses the update once the limit is reached (boundary correct: at most the limit)", ["count < limit"], ["uses <= so one extra is accepted"], "A2"),
                  R("A5", "increment updates the counter only when the increment is accepted", ["count++ inside the if"], ["increments unconditionally"], "A4"),
                  R("A6", "increment returns true when accepted and false when refused (return type boolean)", ["return true", "return false"], ["always returns true"], "A4"),
                  R("A7", "reset restores the starting state (void method)", ["count = 0"], ["leaves the counter unchanged"], "A2"),
                  R("A8", "remaining returns the number of increments still allowed (int method)", ["return limit - count"], ["returns the count"], "A2"),
                  R("A9", "The class compiles as a whole with correct return types and public methods", ["public boolean increment()", "public void reset()", "public int remaining()"], ["missing return type"], "A1")])]
    return _pack("csf_class_counter", "q2", "3.3", ["3.4", "3.5"], "2.B", "LimitedCounter: design a class", "A game allows a player a limited number of actions. Write the LimitedCounter class described below.", skeleton, parts, tests, verified, [f"limit={lim}"],
                 ("Class design with a guarded update that returns a boolean", ["Choose private state", "Guard the update and report success", "Provide reset and remaining"], [("the reference and an alternative (counting down) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, count-down alternative and wrong solutions; expected values from a Python simulation"))


# ======================= Q3 ArrayList 자료 분석 (9, 한 파트) =======================
WRONG_MODIFY = """import java.util.ArrayList;

public class DataTools {
    public static ArrayList<Integer> aboveAverage(ArrayList<Integer> data) {
        int sum = 0;
        for (int i = 0; i < data.size(); i++) {
            sum += data.get(i);
        }
        if (data.size() == 0) {
            return data;
        }
        double avg = (double) sum / data.size();
        for (int i = data.size() - 1; i >= 0; i--) {
            if (data.get(i) <= avg) {
                data.remove(i);
            }
        }
        return data;
    }
}"""


def csf_list_above(rng):
    skeleton = "import java.util.ArrayList;\n\npublic class DataTools {\n    /** Returns a new ArrayList containing the values of data that are strictly greater than the average\n     *  of all values in data, in their original order. The list data is not modified.\n     *  Returns an empty list if data is empty. */\n    public static ArrayList<Integer> aboveAverage(ArrayList<Integer> data) { /* to be written */ }\n}"
    ref = """import java.util.ArrayList;

public class DataTools {
    public static ArrayList<Integer> aboveAverage(ArrayList<Integer> data) {
        ArrayList<Integer> result = new ArrayList<Integer>();
        if (data.size() == 0) {
            return result;
        }
        int sum = 0;
        for (int i = 0; i < data.size(); i++) {
            sum += data.get(i);
        }
        double avg = (double) sum / data.size();
        for (int i = 0; i < data.size(); i++) {
            if (data.get(i) > avg) {
                result.add(data.get(i));
            }
        }
        return result;
    }
}"""
    alt = """import java.util.ArrayList;

public class DataTools {
    public static ArrayList<Integer> aboveAverage(ArrayList<Integer> data) {
        ArrayList<Integer> out = new ArrayList<Integer>();
        double total = 0;
        for (int v : data) {
            total += v;
        }
        for (int v : data) {
            if (v * data.size() > total) {
                out.add(v);
            }
        }
        return out;
    }
}"""
    w = [("Uses integer division for the average.", ref.replace("(double) sum / data.size()", "sum / data.size()"), "a"),
         ("Uses >= so values equal to the average are included.", ref.replace("data.get(i) > avg", "data.get(i) >= avg"), "a"),
         ("Removes elements from data instead of building a new list (data is modified).", WRONG_MODIFY, "a"),
         ("Returns the values in reverse order.", ref.replace("result.add(data.get(i));", "result.add(0, data.get(i));"), "a"),
         ("Returns null instead of an empty list when data is empty.", ref.replace("            return result;\n        }\n        int sum", "            return null;\n        }\n        int sum"), "a")]
    lists = [[], [5], [1, 2, 3], [4, 4, 4], [10, 1, 1, 1], [-3, -1, -2, 0], [7, 9, 8, 6], [2, 3]]

    def py(a):
        if not a:
            return []
        m = sum(a) / len(a)
        return [v for v in a if v > m]
    tests = []
    for a in lists:
        build = "ArrayList<Integer> d = new ArrayList<Integer>(); " + " ".join(f"d.add({v});" for v in a)
        tests.append(("a", build + " ArrayList<Integer> r = DataTools.aboveAverage(d); return r + \"|\" + d;", f"{py(a)}|{a}"))
    verified = verify_variants("DataTools", ref, alt, w, tests)
    parts = [part("a", "Write the method aboveAverage, which returns a new ArrayList<Integer> containing the values of data that are strictly greater than the average of all the values in data, in their original order. The method must not modify data and returns an empty list when data is empty. For example, if data is [1, 2, 3, 10] the average is 4.0 and the method returns [10]. Complete the method aboveAverage.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "aboveAverage")),
                 [R("A1", "Creates a new ArrayList<Integer> to hold the result and returns it (the original list is not returned or modified)", ["new ArrayList<Integer>()", "return result"], ["returns data", "modifies data"]),
                  R("A2", "Handles an empty list without an exception (empty result, no division by zero)", ["data.size() == 0"], ["divides by zero"], "A1"),
                  R("A3", "Traverses all of data to accumulate the sum using get(i) or an enhanced for loop with correct bounds", ["for (int i = 0; i < data.size(); i++)", "sum += data.get(i)"], ["uses length instead of size()", "misses the last element"]),
                  R("A4", "Computes the average of all values (not of a subset) and does not lose the fractional part", ["(double) sum / data.size()"], ["integer division"], "A3"),
                  R("A5", "Makes a second pass (or an equivalent single approach) that examines every element again after the average is known", ["second traversal"], ["compares against a running average"], "A4"),
                  R("A6", "Tests each element for being strictly greater than the average", ["data.get(i) > avg"], ["uses >=", "compares the index"], "A5"),
                  R("A7", "Adds qualifying elements to the result", ["result.add(data.get(i))"], ["adds the index"], "A6"),
                  R("A8", "Preserves the original order of the qualifying elements", ["add at the end"], ["add(0, ...) reverses the order"], "A7"),
                  R("A9", "Does not remove elements from data while it is traversed and the code compiles with correct ArrayList and Integer use", ["no data.remove"], ["remove inside the loop"], "A1")])]
    return _pack("csf_list_above", "q3", "4.10", ["4.8", "4.9"], "2.A", "DataTools: values above the average of an ArrayList", "A data-analysis class uses an ArrayList<Integer> of measurements. The class is shown with the header of the method you will write.", skeleton, parts, tests, verified, ["list_cases=8"],
                 ("ArrayList traversal with two passes, a floating-point average and building a new list", ["Traverse an ArrayList with get and size", "Compute an average without losing the fraction", "Build a new list without changing the input"], [("the reference and an alternative pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative (enhanced for + cross-multiplication) and wrong solutions; expected values from Python"))


def csf_list_reviews(rng):
    skeleton = "import java.util.ArrayList;\n\npublic class Review {\n    private String text;\n    private int stars;\n    public Review(String t, int s) { text = t; stars = s; }\n    public String getText() { return text; }\n    public int getStars() { return stars; }\n}\n\npublic class ReviewStats {\n    /** Returns the average number of stars of the reviews whose text contains word,\n     *  or -1.0 if no review contains word. */\n    public static double averageFor(ArrayList<Review> reviews, String word) { /* to be written */ }\n}"
    base = """import java.util.ArrayList;

class Review {
    private String text;
    private int stars;
    public Review(String t, int s) { text = t; stars = s; }
    public String getText() { return text; }
    public int getStars() { return stars; }
}

"""
    ref = """public class ReviewStats {
    public static double averageFor(ArrayList<Review> reviews, String word) {
        int total = 0;
        int count = 0;
        for (int i = 0; i < reviews.size(); i++) {
            Review r = reviews.get(i);
            if (r.getText().indexOf(word) >= 0) {
                total += r.getStars();
                count++;
            }
        }
        if (count == 0) {
            return -1.0;
        }
        return (double) total / count;
    }
}"""
    alt = """public class ReviewStats {
    public static double averageFor(ArrayList<Review> reviews, String word) {
        double sum = 0.0;
        int n = 0;
        for (Review r : reviews) {
            String t = r.getText();
            boolean found = false;
            for (int i = 0; i + word.length() <= t.length(); i++) {
                if (t.substring(i, i + word.length()).equals(word)) {
                    found = true;
                }
            }
            if (found) {
                sum += r.getStars();
                n++;
            }
        }
        return n > 0 ? sum / n : -1.0;
    }
}"""
    w = [("Uses indexOf(word) > 0, which misses a word at the start of the text.", ref.replace("indexOf(word) >= 0", "indexOf(word) > 0"), "a"),
         ("Uses integer division for the average.", ref.replace("(double) total / count", "total / count"), "a"),
         ("Returns 0.0 instead of -1.0 when nothing matches.", ref.replace("return -1.0;", "return 0.0;"), "a"),
         ("Divides by the total number of reviews instead of the number that contain word.", ref.replace("(double) total / count", "(double) total / reviews.size()"), "a"),
         ("Uses equals, so only reviews whose whole text is word match.", ref.replace("r.getText().indexOf(word) >= 0", "r.getText().equals(word)"), "a")]
    data = [[], [("good food", 5)], [("good food", 5), ("bad service", 2), ("good", 4)], [("ok", 3), ("fine", 4)], [("great", 5), ("greatest", 4), ("not great", 1)], [("a good one", 3), ("good", 2), ("goodness", 5)]]

    def py(rv, wd):
        xs = [s for t, s in rv if wd in t]
        return (sum(xs) / len(xs)) if xs else -1.0
    tests = []
    for rv in data:
        for wd in ("good", "great"):
            build = "ArrayList<Review> L = new ArrayList<Review>(); " + " ".join(f'L.add(new Review("{t}", {s}));' for t, s in rv)
            tests.append(("a", build + f' return ReviewStats.averageFor(L, "{wd}");', str(py(rv, wd))))
    verified = verify_variants("ReviewStats", ref, alt, w, tests, shared=_plain(base))
    parts = [part("a", "Write the method averageFor, which returns the average number of stars, as a double, of the Review objects in reviews whose text contains the String word anywhere (including at the start). If no review contains word, the method returns -1.0. For example, if the reviews are (\"good food\", 5), (\"bad service\", 2) and (\"good\", 4) then averageFor(reviews, \"good\") returns 4.5. Complete the method averageFor.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "averageFor")),
                 [R("A1", "Traverses every element of reviews with correct bounds (get and size, or enhanced for)", ["for (int i = 0; i < reviews.size(); i++)"], ["misses the first or last review"]),
                  R("A2", "Accesses each Review's text through the accessor getText()", ["r.getText()"], ["accesses the private field"], "A1"),
                  R("A3", "Tests whether the text contains word using indexOf (or equivalent), with a correct boundary for index 0", ["indexOf(word) >= 0"], ["indexOf(word) > 0", "uses equals"], "A2"),
                  R("A4", "Accumulates the stars of matching reviews only (through getStars())", ["total += r.getStars()"], ["adds the stars of every review"], "A3"),
                  R("A5", "Counts the matching reviews", ["count++"], ["counts all reviews"], "A3"),
                  R("A6", "Initializes both accumulators before the loop", ["int total = 0", "int count = 0"], ["initializes inside the loop"], "A1"),
                  R("A7", "Returns -1.0 when no review matches (no division by zero)", ["count == 0", "return -1.0"], ["returns 0.0", "divides by zero"], "A5"),
                  R("A8", "Computes the average of the matching reviews with floating-point division", ["(double) total / count"], ["integer division", "divides by reviews.size()"], "A7"),
                  R("A9", "Returns the average after the loop and the code compiles with correct ArrayList<Review> use", ["return (double) total / count"], ["returns inside the loop"], "A8")])]
    return _pack("csf_list_reviews", "q3", "4.10", ["4.9", "1.15"], "2.A", "ReviewStats: average stars of matching reviews", "A website stores customer reviews in an ArrayList<Review>. The Review class and the header of the method you will write are shown.", skeleton, parts, tests, verified, ["review_cases=12"],
                 ("ArrayList of objects: filter with indexOf, accumulate and average with a sentinel", ["Traverse a list of objects", "Filter with a String method", "Average with a no-match sentinel"], [("the reference and an alternative (manual substring scan) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))


# ======================= Q4 2D 배열 (9, 한 파트) =======================
def csf_2d_best_row(rng):
    skeleton = "public class GridStats {\n    /** Returns the index of the row of grid with the largest sum of its elements.\n     *  If more than one row has the largest sum, returns the smallest such index.\n     *  Precondition: grid has at least one row and every row has at least one element. */\n    public static int bestRow(int[][] grid) { /* to be written */ }\n}"
    ref = """public class GridStats {
    public static int bestRow(int[][] grid) {
        int best = 0;
        int bestSum = -1000000;
        for (int r = 0; r < grid.length; r++) {
            int sum = 0;
            for (int c = 0; c < grid[r].length; c++) {
                sum += grid[r][c];
            }
            if (sum > bestSum) {
                bestSum = sum;
                best = r;
            }
        }
        return best;
    }
}"""
    alt = """public class GridStats {
    public static int bestRow(int[][] grid) {
        int[] sums = new int[grid.length];
        for (int r = 0; r < grid.length; r++) {
            for (int v : grid[r]) {
                sums[r] += v;
            }
        }
        int idx = 0;
        for (int r = 1; r < sums.length; r++) {
            if (sums[r] > sums[idx]) {
                idx = r;
            }
        }
        return idx;
    }
}"""
    w = [("Uses >= so the last row among equal sums is returned.", ref.replace("sum > bestSum", "sum >= bestSum"), "a"),
         ("Returns the largest sum instead of the row index.", ref.replace("return best;", "return bestSum;"), "a"),
         ("Initializes the best sum to 0, which fails when every row sum is negative.", ref.replace("int bestSum = -1000000;", "int bestSum = 0;"), "a"),
         ("Sums the columns instead of the rows (swaps the indexes).", ref.replace("sum += grid[r][c];", "sum += grid[c % grid.length][r % grid[0].length];"), "a"),
         ("Compares only the first element of each row.", ref.replace("            int sum = 0;\n            for (int c = 0; c < grid[r].length; c++) {\n                sum += grid[r][c];\n            }", "            int sum = grid[r][0];"), "a")]
    grids = [[[5]], [[1, 2], [3, 4]], [[4, 4], [1, 7], [8, 0]], [[-5, -1], [-2, -2], [-9, 1]], [[1, 1, 1], [3, 0, 0], [0, 2, 1]], [[0, 9], [9, 0]], [[2, 9, 1], [5, 5, 5]], [[-1], [-3], [-2]]]
    tests = []
    for g in grids:
        lit = "new int[][] { " + ", ".join("{ " + ", ".join(map(str, row)) + " }" for row in g) + " }"
        sums = [sum(r) for r in g]
        tests.append(("a", f"return GridStats.bestRow({lit});", str(sums.index(max(sums)))))
    verified = verify_variants("GridStats", ref, alt, w, tests)
    parts = [part("a", "Write the method bestRow, which returns the index of the row of grid with the largest sum of its elements. If more than one row has the largest sum, the method returns the smallest such row index. For example, if grid is { { 1, 2 }, { 5, 0 }, { 3, 2 } } the row sums are 3, 5 and 5, so bestRow returns 1. Complete the method bestRow.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "bestRow" if "bestRow" in ref else "shiftRight")),
                 [R("A1", "Iterates over every row with a loop bounded by grid.length", ["for (int r = 0; r < grid.length; r++)"], ["uses grid[0].length for the rows"]),
                  R("A2", "Iterates over every element of the current row with bounds based on grid[r].length (or an enhanced for)", ["for (int c = 0; c < grid[r].length; c++)"], ["uses grid.length for the columns"], "A1"),
                  R("A3", "Accesses elements with the row index first and the column index second", ["grid[r][c]"], ["swaps the indexes"], "A2"),
                  R("A4", "Accumulates the sum of the current row (and resets it for each row)", ["int sum = 0 inside the row loop", "sum += grid[r][c]"], ["does not reset the sum", "sums the whole array"], "A2"),
                  R("A5", "Keeps track of the largest row sum seen so far, initialized so negative sums work", ["bestSum initialized to the first row or a very small value"], ["initializes to 0"], "A4"),
                  R("A6", "Compares the current row sum with the best using a strict comparison so ties keep the smaller index", ["sum > bestSum"], ["uses >= (returns the last tied row)"], "A5"),
                  R("A7", "Records the row index (not the sum) of the best row when a new best is found", ["best = r"], ["stores the sum as the index"], "A6"),
                  R("A8", "Returns the row index after all rows have been examined", ["return best"], ["returns inside the loop", "returns the sum"], "A7"),
                  R("A9", "The method compiles with correct 2D array syntax and return type int", ["public static int bestRow(int[][] grid)"], ["wrong return type"], "A1")])]
    return _pack("csf_2d_best_row", "q4", "4.13", ["4.12"], "2.A", "GridStats: the row with the largest sum", "A class GridStats analyzes a rectangular two-dimensional array of integers. The class is shown with the header of the method you will write.", skeleton, parts, tests, verified, ["grids=8"],
                 ("2D array row traversal with a running maximum and tie rule", ["Sum each row with nested loops", "Track the best sum and its index", "Break ties toward the smaller index"], [("the reference and an alternative (separate sums array) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))


def csf_2d_shift(rng):
    skeleton = "public class GridShift {\n    /** Returns a new two-dimensional array with the same dimensions as grid in which each row of grid\n     *  has been shifted one position to the right; the last element of each row moves to the front\n     *  of that row. The array grid is not modified.\n     *  Precondition: grid is rectangular and has at least one row and one column. */\n    public static int[][] shiftRight(int[][] grid) { /* to be written */ }\n}"
    ref = """public class GridShift {
    public static int[][] shiftRight(int[][] grid) {
        int[][] result = new int[grid.length][grid[0].length];
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[r].length; c++) {
                result[r][(c + 1) % grid[r].length] = grid[r][c];
            }
        }
        return result;
    }
}"""
    alt = """public class GridShift {
    public static int[][] shiftRight(int[][] grid) {
        int rows = grid.length;
        int cols = grid[0].length;
        int[][] out = new int[rows][cols];
        for (int r = 0; r < rows; r++) {
            out[r][0] = grid[r][cols - 1];
            for (int c = 1; c < cols; c++) {
                out[r][c] = grid[r][c - 1];
            }
        }
        return out;
    }
}"""
    w = [("Does not wrap the last element to the front (the first element stays 0).", ref.replace("result[r][(c + 1) % grid[r].length] = grid[r][c];", "if (c + 1 < grid[r].length) { result[r][c + 1] = grid[r][c]; }"), "a"),
         ("Modifies grid in place and returns it.", ref.replace("int[][] result = new int[grid.length][grid[0].length];", "int[][] result = grid;"), "a"),
         ("Shifts left instead of right.", ref.replace("(c + 1) % grid[r].length", "(c + grid[r].length - 1) % grid[r].length"), "a"),
         ("Shifts down the columns instead of along the rows.", ref.replace("result[r][(c + 1) % grid[r].length] = grid[r][c];", "result[(r + 1) % grid.length][c] = grid[r][c];"), "a"),
         ("Creates the result with swapped dimensions.", ref.replace("new int[grid.length][grid[0].length]", "new int[grid[0].length][grid.length]"), "a")]
    grids = [[[1]], [[1, 2]], [[1], [2]], [[1, 2, 3], [4, 5, 6]], [[1, 2], [3, 4], [5, 6]], [[7, 8, 9, 0]], [[1, 2, 3], [4, 5, 6], [7, 8, 9]], [[5, 5], [6, 6]]]
    tests = []
    for g in grids:
        lit = "new int[][] { " + ", ".join("{ " + ", ".join(map(str, row)) + " }" for row in g) + " }"
        exp = [row[-1:] + row[:-1] for row in g]
        tests.append(("a", f"int[][] g = {lit}; int[][] s = GridShift.shiftRight(g); return Arrays.deepToString(s) + \"|\" + Arrays.deepToString(g);", f"{exp}|{g}".replace("[[", "[[").replace("], [", "], [")))
    verified = verify_variants("GridShift", ref, alt, w, tests)
    parts = [part("a", "Write the method shiftRight, which returns a new two-dimensional array with the same dimensions as grid in which every row of grid has been shifted one position to the right, with the last element of each row moving to the front of that row. The array grid must not be modified. For example, if grid is { { 1, 2, 3 }, { 4, 5, 6 } } the method returns { { 3, 1, 2 }, { 6, 4, 5 } }. Complete the method shiftRight.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "bestRow" if "bestRow" in ref else "shiftRight")),
                 [R("A1", "Creates a new two-dimensional array with the same number of rows and columns as grid (and does not reuse grid)", ["new int[grid.length][grid[0].length]"], ["result = grid", "swapped dimensions"]),
                  R("A2", "Iterates over every row with a loop bounded by grid.length", ["for (int r = 0; r < grid.length; r++)"], ["skips a row"], "A1"),
                  R("A3", "Iterates over every element of each row with correct column bounds", ["for (int c = 0; c < grid[r].length; c++)"], ["skips the last column"], "A2"),
                  R("A4", "Reads from grid with the row index first and the column index second", ["grid[r][c]"], ["swaps the indexes"], "A3"),
                  R("A5", "Computes the destination column one position to the right", ["c + 1"], ["moves left", "moves down a row"], "A3"),
                  R("A6", "Wraps the last element of each row to column 0 (modulo or a special case)", ["% grid[r].length", "or the last element copied to index 0"], ["no wrap-around"], "A5"),
                  R("A7", "Stores into the new array (not into grid)", ["result[r][...] = grid[r][c]"], ["assigns into grid"], "A5"),
                  R("A8", "Leaves grid unchanged", ["no assignment to grid elements"], ["modifies grid"], "A1"),
                  R("A9", "Returns the new array after all rows are processed and the code compiles with return type int[][]", ["return result"], ["returns inside the loop"], "A7")])]
    return _pack("csf_2d_shift", "q4", "4.13", ["4.12", "4.11"], "2.A", "GridShift: shift every row to the right", "A class GridShift manipulates rectangular two-dimensional arrays of integers. The class is shown with the header of the method you will write.", skeleton, parts, tests, verified, ["grids=8"],
                 ("2D array traversal that builds a new array with wrap-around indexing", ["Allocate a matching array", "Map each source index to a destination index with wrap-around", "Leave the input unchanged"], [("the reference and an alternative (explicit first column) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python (list rotation)"))


STAGE_P1_FRQ = ["csf_methods_pass", "csf_class_steps", "csf_list_above", "csf_2d_best_row"]
STAGE_FRQ_ALT = ["csf_methods_runs", "csf_class_counter", "csf_list_reviews", "csf_2d_shift"]
