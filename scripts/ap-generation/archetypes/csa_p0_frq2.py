"""AP Computer Science A P0 — FRQ 새 시나리오 8개(유형마다 2개 추가): 두 번째 풀 모의고사(겹침 0)와 보충 후보를 위한 것. 기존 8개와 합쳐 유형마다 4개 시나리오가 있어
파일럿 1회 + 풀 2회가 서로 다른 시나리오를 쓸 수 있다. 검증 방식은 csa_p0_frq.py 와 같다: 모범 답안·독립 대안 답안은 같은 테스트 묶음을 전부 통과하고, 그럴듯한 오답은 자기 파트에서 최소 1개 실패한다.
기대값은 독립 Python 참조가 만든다. 모범 답안은 'ALTON reference answer for self-review — not official AP scoring' 이다(공식 채점 문구 복제 없음)."""
from csa_common import *  # noqa: F401,F403
from calc_ab_frq import part
from csa_p0_frq import R, _pack, _fence, extract_method, verify_variants, pick  # noqa: F401
import csa_java as J  # noqa: F401


def _bool(b):
    return "true" if b else "false"


# ======================= Q1 메서드·제어문: 윤년·월의 일수 (4 + 5) =======================
def csf_methods_leap(rng):
    skeleton = "public class DateTools {\n    /** Returns true if year is a leap year. A year is a leap year if it is divisible by 4, except that\n     *  a year divisible by 100 is a leap year only if it is also divisible by 400. */\n    public static boolean isLeapYear(int year) { /* to be implemented in part (a) */ }\n\n    /** Returns the number of days in month (1 through 12) of year; see part (b). */\n    public static int daysInMonth(int month, int year) { /* to be implemented in part (b) */ }\n}"
    ref = """public class DateTools {
    public static boolean isLeapYear(int year) {
        if (year % 400 == 0) {
            return true;
        }
        if (year % 100 == 0) {
            return false;
        }
        return year % 4 == 0;
    }
    public static int daysInMonth(int month, int year) {
        if (month == 2) {
            if (isLeapYear(year)) {
                return 29;
            }
            return 28;
        }
        if (month == 4 || month == 6 || month == 9 || month == 11) {
            return 30;
        }
        return 31;
    }
}"""
    alt = """public class DateTools {
    public static boolean isLeapYear(int year) {
        return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    }
    public static int daysInMonth(int month, int year) {
        int[] days = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
        int n = days[month - 1];
        if (month == 2 && isLeapYear(year)) {
            n++;
        }
        return n;
    }
}"""
    w = [("Tests only divisibility by 4.", ref.replace("        if (year % 400 == 0) {\n            return true;\n        }\n        if (year % 100 == 0) {\n            return false;\n        }\n        return year % 4 == 0;", "        return year % 4 == 0;"), "a"),
         ("Forgets that years divisible by 400 are leap years.", ref.replace("        if (year % 400 == 0) {\n            return true;\n        }\n", ""), "a"),
         ("Treats every year divisible by 100 as a leap year.", ref.replace("        if (year % 100 == 0) {\n            return false;\n        }\n", ""), "a"),
         ("Leaves November out of the 30-day months.", ref.replace("month == 9 || month == 11", "month == 9"), "b"),
         ("Always returns 28 for February.", ref.replace("            if (isLeapYear(year)) {\n                return 29;\n            }\n            return 28;", "            return 28;"), "b"),
         ("Does not call isLeapYear and tests only year % 4 for February.", ref.replace("if (isLeapYear(year)) {", "if (year % 4 == 0) {"), "b")]
    years = [2000, 1900, 2024, 2023, 2100, 1996, 2400, 1]
    cases = [(2, 2000), (2, 1900), (2, 2024), (2, 2023), (1, 2023), (4, 2023), (6, 2023), (9, 2023), (11, 2023), (12, 2023), (7, 2023), (2, 2100)]
    leap = lambda y: (y % 4 == 0 and y % 100 != 0) or y % 400 == 0  # noqa: E731
    dim = lambda m, y: 29 if m == 2 and leap(y) else (28 if m == 2 else (30 if m in (4, 6, 9, 11) else 31))  # noqa: E731
    tests = [("a", f"return DateTools.isLeapYear({y});", _bool(leap(y))) for y in years] + [("b", f"return DateTools.daysInMonth({m}, {y});", str(dim(m, y))) for m, y in cases]
    verified = verify_variants("DateTools", ref, alt, w, tests)
    parts = [part("a", "Write the method isLeapYear, which returns true if year is a leap year and false otherwise. A year is a leap year if it is divisible by 4, except that a year divisible by 100 is a leap year only if it is also divisible by 400. For example, isLeapYear(2024) returns true, isLeapYear(1900) returns false and isLeapYear(2000) returns true. Complete the method isLeapYear.", 4, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "isLeapYear")),
                  [R("A1", "Tests divisibility by 4 using the remainder operator", ["year % 4 == 0"], ["tests year / 4"]),
                   R("A2", "Excludes years divisible by 100 from the leap years", ["year % 100 == 0 returns false", "year % 100 != 0 in the condition"], ["treats centuries as leap years"], "A1"),
                   R("A3", "Makes years divisible by 400 leap years again", ["year % 400 == 0 returns true"], ["forgets the 400 rule"], "A2"),
                   R("A4", "Returns a boolean value for every year (conditions combined so exactly one result is produced)", ["return true / return false for all paths"], ["falls through without a return"], "A3")]),
             part("b", "Write the method daysInMonth, which returns the number of days in month of year, where month is from 1 (January) through 12 (December). April, June, September and November have 30 days, February has 29 days in a leap year and 28 otherwise, and the other months have 31 days. Your solution must call isLeapYear from part (a). Assume that isLeapYear works as specified. Complete the method daysInMonth.", 5, "code", ["2.C"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "daysInMonth")),
                  [R("B1", "Handles February separately and calls isLeapYear(year) (does not re-implement the leap-year test)", ["month == 2", "isLeapYear(year)"], ["re-implements the test"]),
                   R("B2", "Returns 29 for February of a leap year and 28 otherwise", ["return 29", "return 28"], ["always 28"], "B1"),
                   R("B3", "Returns 30 for April, June, September and November", ["month == 4 || month == 6 || month == 9 || month == 11"], ["omits a month", "uses && between months"]),
                   R("B4", "Returns 31 for every other month", ["return 31"], ["returns 30 for the other months"], "B3"),
                   R("B5", "Every month leads to exactly one return and the method compiles with return type int", ["all paths return"], ["missing return"], "B4")])]
    return _pack("csf_methods_leap", "q1", "2.9", ["2.5", "2.3"], "2.A", "DateTools: leap years and days in a month", "A calendar program uses a class DateTools with two static methods. The class is shown with the method headers.", skeleton, parts, tests, verified, ["years=8", "month_cases=12"],
                 ("Methods and control structures: a compound boolean condition and a helper call", ["Combine divisibility tests in the right order", "Choose a result by month with ||", "Call the method from part (a)"], [("the reference and an alternative (table lookup) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))


# ======================= Q1 메서드·제어문: 자릿수 합·디지털 루트 (4 + 5) =======================
def csf_methods_digits(rng):
    skeleton = "public class DigitTools {\n    /** Returns the sum of the digits of n. Precondition: n >= 0. */\n    public static int digitSum(int n) { /* to be implemented in part (a) */ }\n\n    /** Returns the digital root of n; see part (b). Precondition: n >= 0. */\n    public static int digitalRoot(int n) { /* to be implemented in part (b) */ }\n}"
    ref = """public class DigitTools {
    public static int digitSum(int n) {
        int sum = 0;
        while (n > 0) {
            sum += n % 10;
            n /= 10;
        }
        return sum;
    }
    public static int digitalRoot(int n) {
        while (n >= 10) {
            n = digitSum(n);
        }
        return n;
    }
}"""
    alt = """public class DigitTools {
    public static int digitSum(int n) {
        String s = "" + n;
        int total = 0;
        for (int i = 0; i < s.length(); i++) {
            total += s.charAt(i) - '0';
        }
        return total;
    }
    public static int digitalRoot(int n) {
        if (n < 10) {
            return n;
        }
        return digitalRoot(digitSum(n));
    }
}"""
    w = [("Stops while n is still 1, so a leading digit 1 is never added.", ref.replace("while (n > 0) {", "while (n > 1) {"), "a"),
         ("Replaces the sum instead of accumulating it.", ref.replace("sum += n % 10;", "sum = n % 10;"), "a"),
         ("Adds the quotient instead of the last digit.", ref.replace("sum += n % 10;", "sum += n / 10;"), "a"),
         ("Stops when n reaches 10, so 10 is returned as a root.", ref.replace("while (n >= 10) {", "while (n > 10) {"), "b"),
         ("Applies digitSum only once.", ref.replace("        while (n >= 10) {\n            n = digitSum(n);\n        }\n        return n;", "        if (n >= 10) {\n            n = digitSum(n);\n        }\n        return n;"), "b"),
         ("Keeps only the last digit of n on each pass.", ref.replace("n = digitSum(n);", "n = n % 10;"), "b")]
    py_sum = lambda n: sum(int(d) for d in str(n))  # noqa: E731

    def py_root(n):
        while n >= 10:
            n = py_sum(n)
        return n
    asum = [0, 5, 10, 123, 9045, 1000, 99999, 1]
    broot = [7, 10, 38, 99, 12345, 999999999, 0, 19]
    tests = [("a", f"return DigitTools.digitSum({n});", str(py_sum(n))) for n in asum] + [("b", f"return DigitTools.digitalRoot({n});", str(py_root(n))) for n in broot]
    verified = verify_variants("DigitTools", ref, alt, w, tests)
    parts = [part("a", "Write the method digitSum, which returns the sum of the digits of the nonnegative integer n. For example, digitSum(9045) returns 18 and digitSum(0) returns 0. Complete the method digitSum.", 4, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "digitSum")),
                  [R("A1", "Uses a loop that continues while digits remain (n > 0 or an equivalent test)", ["while (n > 0)"], ["stops while n is still 1"]),
                   R("A2", "Extracts the last digit with n % 10", ["n % 10"], ["uses n / 10 as the digit"], "A1"),
                   R("A3", "Accumulates the digits in a variable initialized before the loop and removes the last digit from n each pass", ["sum += n % 10", "n /= 10"], ["replaces the sum", "does not shrink n"], "A2"),
                   R("A4", "Returns the accumulated sum after the loop", ["return sum"], ["returns inside the loop"], "A3")]),
             part("b", "Write the method digitalRoot, which repeatedly replaces n by the sum of its digits until n has only one digit and then returns that digit. For example, digitalRoot(38) returns 2 because 3 + 8 = 11 and 1 + 1 = 2, and digitalRoot(7) returns 7. Your solution must call digitSum from part (a). Assume that digitSum works as specified. Complete the method digitalRoot.", 5, "code", ["2.C"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "digitalRoot")),
                  [R("B1", "Repeats the replacement with a loop (or recursion) rather than applying it a fixed number of times", ["while (n >= 10)"], ["applies digitSum only once"]),
                   R("B2", "Uses a correct stopping test: continues while n has two or more digits", ["n >= 10 (or n > 9)"], ["stops at 10"], "B1"),
                   R("B3", "Calls digitSum(n) and uses its result (does not duplicate the digit loop)", ["digitSum(n)"], ["re-implements the loop"]),
                   R("B4", "Stores the new value back into n (or passes it to the recursive call)", ["n = digitSum(n)"], ["discards the result"], "B3"),
                   R("B5", "Returns the single remaining digit", ["return n"], ["returns the last sum before reducing"], "B1")])]
    return _pack("csf_methods_digits", "q1", "2.7", ["2.9", "1.10"], "2.A", "DigitTools: digit sums and the digital root", "A number-theory class DigitTools has two static methods. The class is shown with the method headers.", skeleton, parts, tests, verified, ["digit_sum_cases=8", "root_cases=8"],
                 ("Methods and control structures: a digit-extraction loop and repeated application of a helper", ["Peel off digits with % and /", "Repeat until one digit remains", "Reuse the method from part (a)"], [("the reference and an alternative (String digits, recursion) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))


# ======================= Q2 클래스 설계: Scoreboard =======================
def csf_class_scoreboard(rng):
    tgt = pick(rng, [10, 15, 21])
    skeleton = "public class Scoreboard {\n    // to be written in this question:\n    //   constructor Scoreboard(int target)\n    //   void scoreHome(int points)\n    //   void scoreAway(int points)\n    //   String leader()\n    //   boolean isOver()\n}"
    ref = """public class Scoreboard {
    private int target;
    private int home;
    private int away;

    public Scoreboard(int target) {
        this.target = target;
        home = 0;
        away = 0;
    }
    public void scoreHome(int points) {
        home += points;
    }
    public void scoreAway(int points) {
        away += points;
    }
    public String leader() {
        if (home > away) {
            return "home";
        }
        if (away > home) {
            return "away";
        }
        return "tie";
    }
    public boolean isOver() {
        return home >= target || away >= target;
    }
}"""
    alt = """public class Scoreboard {
    private int goal;
    private int[] scores = new int[2];

    public Scoreboard(int target) {
        goal = target;
    }
    public void scoreHome(int points) {
        scores[0] = scores[0] + points;
    }
    public void scoreAway(int points) {
        scores[1] = scores[1] + points;
    }
    public String leader() {
        String result = "tie";
        if (scores[0] != scores[1]) {
            result = scores[0] > scores[1] ? "home" : "away";
        }
        return result;
    }
    public boolean isOver() {
        return Math.max(scores[0], scores[1]) >= goal;
    }
}"""
    w = [("Reports home as the leader when the scores are tied.", ref.replace("        if (away > home) {\n            return \"away\";\n        }\n        return \"tie\";", "        if (away > home) {\n            return \"away\";\n        }\n        return \"home\";"), "a"),
         ("Needs more than the target to end the game (uses > instead of >=).", ref.replace("home >= target || away >= target", "home > target || away > target"), "a"),
         ("Adds the away points to the home score.", ref.replace("away += points;", "home += points;"), "a"),
         ("Requires both teams to reach the target.", ref.replace("home >= target || away >= target", "home >= target && away >= target"), "a"),
         ("Replaces the home score instead of adding to it.", ref.replace("home += points;", "home = points;"), "a")]

    def sim(ops):
        h = a = 0
        for o, v in ops:
            if o == "h":
                h += v
            else:
                a += v
        return f"{'home' if h > a else ('away' if a > h else 'tie')} {_bool(h >= tgt or a >= tgt)}"
    seqs = [[], [("h", 3)], [("a", 4), ("h", 4)], [("h", tgt - 1)], [("h", tgt)], [("a", tgt + 2)], [("h", 5), ("a", 2), ("h", 1), ("a", 9)], [("h", tgt - 2), ("a", tgt - 2), ("h", 1)], [("a", tgt - 1), ("h", tgt - 1)]]
    tests = []
    for sq in seqs:
        body = f"Scoreboard s = new Scoreboard({tgt}); " + " ".join(f"s.score{'Home' if o == 'h' else 'Away'}({v});" for o, v in sq) + ' return s.leader() + " " + s.isOver();'
        tests.append(("a", body, sim(sq)))
    verified = verify_variants("Scoreboard", ref, alt, w, tests)
    table = f"| Statement | Value returned | Explanation |\n|---|---|---|\n| Scoreboard s = new Scoreboard({tgt}); | (none) | A game that ends when a team reaches {tgt} points |\n| s.scoreHome(4); | (none) | The home team has 4 points |\n| s.scoreAway(4); | (none) | The away team has 4 points |\n| s.leader() | \"tie\" | The scores are equal |\n| s.scoreAway({tgt - 4}); | (none) | The away team now has {tgt} points |\n| s.isOver() | true | A team has reached the target |\n| s.leader() | \"away\" | The away team has more points |"
    parts = [part("a", f"Write the complete Scoreboard class, including the constructor and any required instance variables and methods. A Scoreboard keeps the points of a home team and an away team in a game that ends when a team reaches a target number of points. The constructor takes the target. scoreHome and scoreAway add points to a team. leader returns \"home\" if the home team has more points, \"away\" if the away team has more points and \"tie\" if the scores are equal. isOver returns true if at least one team has reached the target. Examples of the behavior are listed in the following table.\n\n{table}", 9, "code", ["2.B"], "One correct implementation (ALTON reference answer):\n" + _fence(ref),
                  [R("A1", "Declares the class header public class Scoreboard", ["public class Scoreboard"], ["wrong class name"]),
                   R("A2", "Declares private instance variables that store the target and both scores", ["private int target", "private int home", "private int away"], ["public instance variables", "no stored target"], "A1"),
                   R("A3", "Constructor has the correct signature, stores the target and starts both scores at 0 (distinguishing parameter from field)", ["public Scoreboard(int target)", "this.target = target"], ["target = target"], "A1"),
                   R("A4", "scoreHome adds the points to the home score (accumulates, void method)", ["home += points"], ["replaces the score"], "A2"),
                   R("A5", "scoreAway adds the points to the away score only", ["away += points"], ["adds to the wrong team"], "A2"),
                   R("A6", "leader returns the String \"home\" or \"away\" for the team with more points", ["home > away", "away > home"], ["returns a number", "compares the target"], "A2"),
                   R("A7", "leader returns \"tie\" when the scores are equal (the cases do not overlap)", ["return \"tie\""], ["returns home on a tie"], "A6"),
                   R("A8", "isOver returns true when either team has reached the target (at least, with a logical or)", ["home >= target || away >= target"], ["uses > or &&"], "A2"),
                   R("A9", "All methods have the correct headers and return types (void, String, boolean) and the class compiles as a whole", ["public String leader()", "public boolean isOver()"], ["missing return type"], "A1")])]
    return _pack("csf_class_scoreboard", "q2", "3.3", ["3.4", "3.5"], "2.B", "Scoreboard: design a class", f"A scoring program tracks a game between a home team and an away team. The target for this game is {tgt} points. Write the Scoreboard class described below.", skeleton, parts, tests, verified, [f"target={tgt}"],
                 ("Class design: private state for two quantities, mutators and two query methods with a three-way result", ["Choose private state", "Update it from mutators", "Report a decision from the state"], [("the reference and an alternative (score array) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, array-based alternative and wrong solutions; expected values from a Python simulation"))


# ======================= Q2 클래스 설계: Stock =======================
def csf_class_stock(rng):
    skeleton = "public class Stock {\n    // to be written in this question:\n    //   constructor Stock(String name, int quantity)\n    //   String getName()\n    //   int getQuantity()\n    //   void restock(int amount)\n    //   boolean sell(int amount)\n}"
    ref = """public class Stock {
    private String name;
    private int quantity;

    public Stock(String name, int quantity) {
        this.name = name;
        this.quantity = quantity;
    }
    public String getName() {
        return name;
    }
    public int getQuantity() {
        return quantity;
    }
    public void restock(int amount) {
        quantity += amount;
    }
    public boolean sell(int amount) {
        if (amount <= quantity) {
            quantity -= amount;
            return true;
        }
        return false;
    }
}"""
    alt = """public class Stock {
    private String label;
    private int received;
    private int sold;

    public Stock(String name, int quantity) {
        label = name;
        received = quantity;
        sold = 0;
    }
    public String getName() {
        return label;
    }
    public int getQuantity() {
        return received - sold;
    }
    public void restock(int amount) {
        received = received + amount;
    }
    public boolean sell(int amount) {
        boolean enough = amount <= received - sold;
        if (enough) {
            sold += amount;
        }
        return enough;
    }
}"""
    w = [("Refuses to sell the last units (uses < instead of <=).", ref.replace("amount <= quantity", "amount < quantity"), "a"),
         ("Reduces the quantity even when there is not enough stock.", ref.replace("        if (amount <= quantity) {\n            quantity -= amount;\n            return true;\n        }\n        return false;", "        quantity -= amount;\n        return amount <= quantity + amount;"), "a"),
         ("Replaces the quantity when restocking.", ref.replace("quantity += amount;", "quantity = amount;"), "a"),
         ("Returns true for every sale, including refused ones.", ref.replace("            return true;\n        }\n        return false;", "            return true;\n        }\n        return true;"), "a"),
         ("Reports one more than the quantity in stock.", ref.replace("return quantity;", "return quantity + 1;"), "a")]
    item = pick(rng, ["pens", "mugs", "cables", "lamps"])

    def sim(q0, ops):
        q = q0; outs = []
        for o, v in ops:
            if o == "s":
                ok = v <= q
                if ok:
                    q -= v
                outs.append(_bool(ok))
            else:
                q += v
        return " ".join(outs + [str(q)])
    cases = [(5, []), (5, [("s", 3)]), (5, [("s", 5)]), (5, [("s", 6), ("r", 2), ("s", 6)]), (0, [("s", 1), ("r", 4), ("s", 4)]), (10, [("s", 4), ("s", 4), ("s", 4), ("r", 10), ("s", 4)]), (3, [("r", 0), ("s", 0)])]
    tests = []
    for q0, ops in cases:
        body = f'Stock s = new Stock("{item}", {q0}); String out = ""; ' + " ".join(f"out += s.sell({v}) + \" \";" if o == "s" else f"s.restock({v});" for o, v in ops) + ' return out + s.getQuantity();'
        tests.append(("a", body, sim(q0, ops)))
    tests.append(("a", f'return new Stock("{item}", 4).getName();', item))
    verified = verify_variants("Stock", ref, alt, w, tests)
    table = f"| Statement | Value returned | Explanation |\n|---|---|---|\n| Stock s = new Stock(\"{item}\", 5); | (none) | A stock of 5 {item} |\n| s.sell(3) | true | There was enough stock; 2 remain |\n| s.sell(4) | false | Not enough stock; the quantity does not change |\n| s.restock(10); | (none) | The quantity becomes 12 |\n| s.sell(12) | true | All of the stock is sold |\n| s.getQuantity() | 0 | Nothing remains |\n| s.getName() | \"{item}\" | The name given to the constructor |"
    parts = [part("a", f"Write the complete Stock class, including the constructor and any required instance variables and methods. A Stock records the name of an item and the quantity of it in stock. The constructor takes the name and the starting quantity. getName and getQuantity return them. restock adds units to the quantity. sell removes units and returns true if there is enough stock; otherwise it returns false and leaves the quantity unchanged. Examples of the behavior are listed in the following table.\n\n{table}", 9, "code", ["2.B"], "One correct implementation (ALTON reference answer):\n" + _fence(ref),
                  [R("A1", "Declares the class header public class Stock", ["public class Stock"], ["wrong class name"]),
                   R("A2", "Declares private instance variables that store the name and the quantity (or equivalent data)", ["private String name", "private int quantity"], ["public instance variables"], "A1"),
                   R("A3", "Constructor has the correct signature and stores both parameters (distinguishing parameter from field)", ["public Stock(String name, int quantity)", "this.name = name"], ["name = name"], "A1"),
                   R("A4", "getName returns the name (String) and getQuantity returns the current quantity (int)", ["return name", "return quantity"], ["returns the wrong variable"], "A2"),
                   R("A5", "restock adds the amount to the quantity (accumulates, void method)", ["quantity += amount"], ["replaces the quantity"], "A2"),
                   R("A6", "sell compares the amount with the quantity using a correct boundary (selling all remaining stock is allowed)", ["amount <= quantity"], ["uses < so the last units cannot be sold"], "A2"),
                   R("A7", "sell reduces the quantity only when the sale is allowed", ["quantity -= amount inside the if"], ["reduces the quantity unconditionally"], "A6"),
                   R("A8", "sell returns true for an accepted sale and false for a refused one (return type boolean)", ["return true", "return false"], ["always returns true"], "A6"),
                   R("A9", "All methods have the correct headers and return types and the class compiles as a whole", ["public boolean sell(int amount)", "public void restock(int amount)"], ["missing return type"], "A1")])]
    return _pack("csf_class_stock", "q2", "3.3", ["3.4", "3.5"], "2.B", "Stock: design a class", f"A shop tracks how many units of an item it has. Write the Stock class described below.", skeleton, parts, tests, verified, [f"item={item}"],
                 ("Class design: a String and an int field, accessors, a mutator and a guarded update returning a boolean", ["Choose private state", "Guard the update and report success", "Provide accessors"], [("the reference and an alternative (received and sold totals) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, received/sold alternative and wrong solutions; expected values from a Python simulation"))


# ======================= Q3 ArrayList: 가장 긴 연속 구간 =======================
def csf_list_runs(rng):
    skeleton = "import java.util.ArrayList;\n\npublic class RunFinder {\n    /** Returns the length of the longest run of consecutive equal values in data.\n     *  Returns 0 if data is empty. The list data is not modified. */\n    public static int longestRun(ArrayList<Integer> data) { /* to be written */ }\n}"
    ref = """import java.util.ArrayList;

public class RunFinder {
    public static int longestRun(ArrayList<Integer> data) {
        if (data.size() == 0) {
            return 0;
        }
        int best = 1;
        int run = 1;
        for (int i = 1; i < data.size(); i++) {
            if (data.get(i).equals(data.get(i - 1))) {
                run++;
            } else {
                run = 1;
            }
            if (run > best) {
                best = run;
            }
        }
        return best;
    }
}"""
    alt = """import java.util.ArrayList;

public class RunFinder {
    public static int longestRun(ArrayList<Integer> data) {
        int best = 0;
        for (int start = 0; start < data.size(); start++) {
            int end = start;
            while (end < data.size() && data.get(end).equals(data.get(start))) {
                end++;
            }
            if (end - start > best) {
                best = end - start;
            }
        }
        return best;
    }
}"""
    w = [("Returns 0 for a one-element list because best starts at 0.", ref.replace("int best = 1;", "int best = 0;"), "a"),
         ("Never restarts the run, so it counts every equal neighbor pair.", ref.replace("            } else {\n                run = 1;\n            }", "            }"), "a"),
         ("Compares each value with the first value instead of the previous value.", ref.replace("data.get(i).equals(data.get(i - 1))", "data.get(i).equals(data.get(0))"), "a"),
         ("Compares Integer objects with ==, which is false for equal values outside the cached range.", ref.replace("data.get(i).equals(data.get(i - 1))", "data.get(i) == data.get(i - 1)"), "a"),
         ("Returns the run length of the last run instead of the longest run.", ref.replace("        return best;", "        return run;"), "a"),
         ("Throws an exception for an empty list.", ref.replace("        if (data.size() == 0) {\n            return 0;\n        }\n", ""), "a")]
    lists = [[], [5], [1, 1, 2, 2, 2, 3], [4, 4, 4, 4], [1, 2, 3], [1, 2, 2, 1, 1], [1000, 1000, 1000], [3, 3, 2, 3, 3, 3], [7, 7]]

    def py(a):
        best = run = 0
        for i, v in enumerate(a):
            run = run + 1 if i and v == a[i - 1] else 1
            best = max(best, run)
        return best
    tests = []
    for a in lists:
        build = "ArrayList<Integer> d = new ArrayList<Integer>(); " + " ".join(f"d.add({v});" for v in a)
        tests.append(("a", build + " int r = RunFinder.longestRun(d); return r + \"|\" + d;", f"{py(a)}|{a}"))
    verified = verify_variants("RunFinder", ref, alt, w, tests)
    parts = [part("a", "Write the method longestRun, which returns the length of the longest run of consecutive equal values in the ArrayList data. A run is a sequence of one or more neighboring elements that are equal. The method returns 0 if data is empty and must not modify data. For example, if data is [1, 1, 2, 2, 2, 3] the method returns 3, and if data is [4, 5, 6] the method returns 1. Complete the method longestRun.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "longestRun")),
                  [R("A1", "Handles an empty list by returning 0 without an exception", ["data.size() == 0", "return 0"], ["throws an exception", "returns 1"]),
                   R("A2", "Traverses the list with correct bounds so every neighboring pair is examined (indexes stay inside the list)", ["for (int i = 1; i < data.size(); i++)"], ["reads data.get(i + 1) at the last index", "starts at -1"]),
                   R("A3", "Compares each value with its neighbor (previous or next element), not with the first element", ["data.get(i).equals(data.get(i - 1))"], ["compares with data.get(0)"], "A2"),
                   R("A4", "Compares Integer values with equals (or by unboxing), not with == on objects", ["equals", "or intValue()"], ["== on Integer objects"], "A3"),
                   R("A5", "Extends the current run length when the values are equal", ["run++"], ["increments for every element"], "A3"),
                   R("A6", "Restarts the current run length at 1 when the values differ", ["run = 1"], ["never resets the run"], "A5"),
                   R("A7", "Keeps the maximum run length seen so far (updates it when a run is longer)", ["if (run > best) best = run"], ["returns the last run"], "A5"),
                   R("A8", "Initializes the counters so a list with one element returns 1", ["int best = 1", "int run = 1"], ["initializes best to 0"], "A1"),
                   R("A9", "Returns the best length after the traversal and does not modify data", ["return best"], ["returns inside the loop", "removes elements"], "A7")])]
    return _pack("csf_list_runs", "q3", "4.10", ["4.8", "4.9"], "2.A", "RunFinder: the longest run in an ArrayList", "A data-analysis class uses an ArrayList<Integer> of readings. The class is shown with the header of the method you will write.", skeleton, parts, tests, verified, ["list_cases=9"],
                 ("ArrayList traversal that compares neighboring elements and keeps a running maximum", ["Compare neighbors with get(i) and get(i - 1)", "Reset and extend a run counter", "Keep the maximum run"], [("the reference and an alternative (nested scan) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python; the == on Integer case uses values above 127"))


# ======================= Q3 ArrayList: 짧은 문자열 제거(제자리 수정) =======================
def csf_list_remove_short(rng):
    skeleton = "import java.util.ArrayList;\n\npublic class WordFilter {\n    /** Removes from words every String whose length is less than minLength.\n     *  The order of the remaining Strings is not changed. */\n    public static void removeShort(ArrayList<String> words, int minLength) { /* to be written */ }\n}"
    ref = """import java.util.ArrayList;

public class WordFilter {
    public static void removeShort(ArrayList<String> words, int minLength) {
        for (int i = words.size() - 1; i >= 0; i--) {
            if (words.get(i).length() < minLength) {
                words.remove(i);
            }
        }
    }
}"""
    alt = """import java.util.ArrayList;

public class WordFilter {
    public static void removeShort(ArrayList<String> words, int minLength) {
        int i = 0;
        while (i < words.size()) {
            if (words.get(i).length() < minLength) {
                words.remove(i);
            } else {
                i++;
            }
        }
    }
}"""
    w = [("Traverses forward and removes by index, which skips the element that moves into the removed position.", ref.replace("for (int i = words.size() - 1; i >= 0; i--)", "for (int i = 0; i < words.size(); i++)"), "a"),
         ("Removes strings whose length equals minLength as well (uses <=).", ref.replace("length() < minLength", "length() <= minLength"), "a"),
         ("Builds a new list and does not change words.", ref.replace("                words.remove(i);", "                result.add(words.get(i));").replace("        for (int i = words.size() - 1", "        ArrayList<String> result = new ArrayList<String>();\n        for (int i = words.size() - 1"), "a"),
         ("Removes the long strings instead of the short ones.", ref.replace("length() < minLength", "length() >= minLength"), "a"),
         ("Stops one element early when traversing backward.", ref.replace("i >= 0; i--", "i > 0; i--"), "a")]
    cases = [([], 2), (["a"], 2), (["ab", "abc", "a", "abcd"], 3), (["x", "y", "z"], 1), (["aa", "bb", "c", "dd", "e"], 2), (["short", "tiny", "a", "enormous"], 5), (["q", "w", "e", "r"], 2), (["aaa", "b", "c", "ddd"], 2)]

    def lit(ws):
        return "[" + ", ".join(ws) + "]"
    tests = []
    for ws, m in cases:
        build = "ArrayList<String> w = new ArrayList<String>(); " + " ".join(f'w.add("{s}");' for s in ws)
        tests.append(("a", build + f" WordFilter.removeShort(w, {m}); return w;", lit([s for s in ws if len(s) >= m])))
    verified = verify_variants("WordFilter", ref, alt, w, tests)
    parts = [part("a", "Write the method removeShort, which removes from the ArrayList words every String whose length is less than minLength. The order of the remaining Strings must not change, and the method changes the list it is given rather than returning a new list. For example, if words is [\"ab\", \"abc\", \"a\", \"abcd\"] and minLength is 3, then after the call words is [\"abc\", \"abcd\"]. Complete the method removeShort.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "removeShort")),
                  [R("A1", "Traverses every index of the list with bounds based on words.size()", ["for (int i = 0; i < words.size(); i++) or a backward loop"], ["uses length instead of size()", "skips the first or last element"]),
                   R("A2", "Uses get(i) to read an element and length() to read its length", ["words.get(i).length()"], ["calls length on the list"], "A1"),
                   R("A3", "Tests for strings shorter than minLength with a correct boundary", ["length() < minLength"], ["uses <=", "removes the long strings"], "A2"),
                   R("A4", "Removes the element at index i (remove(i)) when the test is true", ["words.remove(i)"], ["removes by the wrong index", "set instead of remove"], "A3"),
                   R("A5", "Accounts for the shift caused by a removal (backward traversal, or the index is not advanced after a removal)", ["i-- or backward loop or no i++ after remove"], ["skips the element that moves into the removed position"], "A4"),
                   R("A6", "Does not remove elements incorrectly: every short string is removed and no other string is removed", ["all short strings removed"], ["leaves some short strings"], "A5"),
                   R("A7", "Preserves the order of the remaining elements", ["no reordering"], ["reorders the list"], "A4"),
                   R("A8", "Changes the original list (words) instead of building and discarding a new list", ["modifies words"], ["builds a new list only"], "A4"),
                   R("A9", "The method compiles with return type void and correct ArrayList<String> and String use", ["public static void removeShort(ArrayList<String> words, int minLength)"], ["returns a value from a void method"], "A1")])]
    return _pack("csf_list_remove_short", "q3", "4.10", ["4.8", "4.9"], "2.A", "WordFilter: remove short Strings from an ArrayList", "A text-processing class modifies a list of words. The class is shown with the header of the method you will write.", skeleton, parts, tests, verified, ["word_cases=8"],
                 ("ArrayList traversal with removal: the index shift after remove", ["Traverse with an index", "Remove by index safely", "Change the list in place"], [("the reference and an alternative (index advanced only when nothing is removed) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python list filtering"))


# ======================= Q4 2D 배열: 테두리 합 =======================
def csf_2d_border(rng):
    skeleton = "public class GridBorder {\n    /** Returns the sum of the elements that are in the first row, the last row, the first column\n     *  or the last column of grid. Each element is counted once.\n     *  Precondition: grid is rectangular with at least one row and one column. */\n    public static int borderSum(int[][] grid) { /* to be written */ }\n}"
    ref = """public class GridBorder {
    public static int borderSum(int[][] grid) {
        int sum = 0;
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[r].length; c++) {
                if (r == 0 || r == grid.length - 1 || c == 0 || c == grid[r].length - 1) {
                    sum += grid[r][c];
                }
            }
        }
        return sum;
    }
}"""
    alt = """public class GridBorder {
    public static int borderSum(int[][] grid) {
        int total = 0;
        for (int[] row : grid) {
            for (int v : row) {
                total += v;
            }
        }
        int inner = 0;
        for (int r = 1; r < grid.length - 1; r++) {
            for (int c = 1; c < grid[r].length - 1; c++) {
                inner += grid[r][c];
            }
        }
        return total - inner;
    }
}"""
    w = [("Counts the corner elements twice (adds the rows and then the columns).", """public class GridBorder {
    public static int borderSum(int[][] grid) {
        int sum = 0;
        for (int c = 0; c < grid[0].length; c++) {
            sum += grid[0][c] + grid[grid.length - 1][c];
        }
        for (int r = 0; r < grid.length; r++) {
            sum += grid[r][0] + grid[r][grid[0].length - 1];
        }
        return sum;
    }
}""", "a"),
         ("Requires an element to be in the first or last row and the first or last column (uses && between the row test and the column test).", ref.replace("(r == 0 || r == grid.length - 1 || c == 0 || c == grid[r].length - 1)", "((r == 0 || r == grid.length - 1) && (c == 0 || c == grid[r].length - 1))"), "a"),
         ("Leaves out the last column.", ref.replace(" || c == grid[r].length - 1", ""), "a"),
         ("Adds the interior elements instead of the border elements.", ref.replace("if (r == 0 || r == grid.length - 1 || c == 0 || c == grid[r].length - 1) {", "if (!(r == 0 || r == grid.length - 1 || c == 0 || c == grid[r].length - 1)) {"), "a"),
         ("Swaps the row and column indexes when reading the element.", ref.replace("sum += grid[r][c];", "sum += grid[c % grid.length][r % grid[0].length];"), "a")]
    grids = [[[5]], [[1, 2, 3]], [[1], [2], [3]], [[1, 2], [3, 4]], [[1, 2, 3], [4, 5, 6], [7, 8, 9]], [[1, 2, 3, 4], [5, 6, 7, 8], [9, 1, 2, 3]], [[1, 2, 3], [4, 5, 6], [7, 8, 9], [1, 1, 1]], [[-1, 5], [5, -1], [2, 2]]]

    def py(g):
        return sum(v for r, row in enumerate(g) for c, v in enumerate(row) if r in (0, len(g) - 1) or c in (0, len(row) - 1))
    tests = []
    for g in grids:
        lit = "new int[][] { " + ", ".join("{ " + ", ".join(map(str, row)) + " }" for row in g) + " }"
        tests.append(("a", f"return GridBorder.borderSum({lit});", str(py(g))))
    verified = verify_variants("GridBorder", ref, alt, w, tests)
    parts = [part("a", "Write the method borderSum, which returns the sum of the elements of grid that are in the first row, the last row, the first column or the last column. Each element is counted once, even if it is in two of those places. For example, if grid is { { 1, 2, 3 }, { 4, 5, 6 }, { 7, 8, 9 } } the method returns 40, because every element except the 5 is on the border. Complete the method borderSum.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "borderSum")),
                  [R("A1", "Iterates over every row with a loop bounded by grid.length", ["for (int r = 0; r < grid.length; r++)"], ["uses grid[0].length for the rows"]),
                   R("A2", "Iterates over every element of the current row with bounds based on grid[r].length (or grid[0].length)", ["for (int c = 0; c < grid[r].length; c++)"], ["uses grid.length for the columns"], "A1"),
                   R("A3", "Accesses elements with the row index first and the column index second", ["grid[r][c]"], ["swaps the indexes"], "A2"),
                   R("A4", "Recognizes the first and last rows with correct index tests", ["r == 0 || r == grid.length - 1"], ["compares with grid.length", "omits the last row"], "A1"),
                   R("A5", "Recognizes the first and last columns with correct index tests", ["c == 0 || c == grid[r].length - 1"], ["omits the last column"], "A2"),
                   R("A6", "Combines the row and column tests so that an element is included when it satisfies any of them (logical or)", ["||"], ["uses && between the row and column tests"], "A5"),
                   R("A7", "Counts each border element exactly once (corners and one-row or one-column arrays are not double counted)", ["a single condition per element"], ["adds rows and columns separately"], "A6"),
                   R("A8", "Accumulates the included elements in a sum initialized before the loops", ["int sum = 0", "sum += grid[r][c]"], ["replaces the sum"], "A7"),
                   R("A9", "Returns the sum after both loops and compiles with return type int", ["return sum"], ["returns inside the loop"], "A8")])]
    return _pack("csf_2d_border", "q4", "4.13", ["4.12"], "2.A", "GridBorder: the sum of the border of a 2D array", "A class GridBorder analyzes a rectangular two-dimensional array of integers. The class is shown with the header of the method you will write.", skeleton, parts, tests, verified, ["grids=8"],
                 ("2D array traversal with a combined row and column boundary test", ["Visit every element with nested loops", "Test the row and the column boundaries", "Count each element once"], [("the reference and an alternative (total minus interior) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))


# ======================= Q4 2D 배열: 전치 =======================
def csf_2d_transpose(rng):
    skeleton = "public class GridTools {\n    /** Returns a new two-dimensional array that is the transpose of grid: for every row r and column c,\n     *  element [c][r] of the result equals element [r][c] of grid. The array grid is not modified.\n     *  Precondition: grid is rectangular and has at least one row and one column. */\n    public static int[][] transpose(int[][] grid) { /* to be written */ }\n}"
    ref = """public class GridTools {
    public static int[][] transpose(int[][] grid) {
        int[][] result = new int[grid[0].length][grid.length];
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[r].length; c++) {
                result[c][r] = grid[r][c];
            }
        }
        return result;
    }
}"""
    alt = """public class GridTools {
    public static int[][] transpose(int[][] grid) {
        int rows = grid.length;
        int cols = grid[0].length;
        int[][] out = new int[cols][rows];
        for (int c = 0; c < cols; c++) {
            for (int r = 0; r < rows; r++) {
                out[c][r] = grid[r][c];
            }
        }
        return out;
    }
}"""
    w = [("Creates the result with the same dimensions as grid, which fails when the array is not square.", ref.replace("new int[grid[0].length][grid.length]", "new int[grid.length][grid[0].length]"), "a"),
         ("Copies each element to the same position, which does not transpose.", ref.replace("result[c][r] = grid[r][c];", "result[r][c] = grid[r][c];"), "a"),
         ("Returns grid itself instead of a new array.", ref.replace("        return result;", "        return grid;"), "a"),
         ("Uses grid.length as the bound of the column loop, which fails when there are more columns than rows.", ref.replace("c < grid[r].length", "c < grid.length"), "a"),
         ("Swaps elements of grid in place (works only for square arrays) and returns grid.", """public class GridTools {
    public static int[][] transpose(int[][] grid) {
        for (int r = 0; r < grid.length; r++) {
            for (int c = r + 1; c < grid.length; c++) {
                int t = grid[r][c];
                grid[r][c] = grid[c][r];
                grid[c][r] = t;
            }
        }
        return grid;
    }
}""", "a")]
    grids = [[[1]], [[1, 2, 3]], [[1], [2]], [[1, 2], [3, 4]], [[1, 2, 3], [4, 5, 6]], [[1, 2], [3, 4], [5, 6]], [[1, 2, 3], [4, 5, 6], [7, 8, 9]], [[7, 8, 9, 0]]]
    tests = []
    for g in grids:
        lit = "new int[][] { " + ", ".join("{ " + ", ".join(map(str, row)) + " }" for row in g) + " }"
        exp = [list(col) for col in zip(*g)]
        tests.append(("a", f"int[][] g = {lit}; int[][] t = GridTools.transpose(g); return Arrays.deepToString(t) + \"|\" + Arrays.deepToString(g);", f"{exp}|{g}"))
    verified = verify_variants("GridTools", ref, alt, w, tests)
    parts = [part("a", "Write the method transpose, which returns a new two-dimensional array that is the transpose of grid: for every row r and column c, the element at row c and column r of the result equals the element at row r and column c of grid. The array grid must not be modified. For example, if grid is { { 1, 2, 3 }, { 4, 5, 6 } } the method returns { { 1, 4 }, { 2, 5 }, { 3, 6 } }. Complete the method transpose.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "transpose")),
                  [R("A1", "Creates a new two-dimensional array whose number of rows equals the number of columns of grid and whose number of columns equals the number of rows of grid", ["new int[grid[0].length][grid.length]"], ["same dimensions as grid", "swapped incorrectly"]),
                   R("A2", "Iterates over every row with a loop bounded by grid.length", ["for (int r = 0; r < grid.length; r++)"], ["skips a row"], "A1"),
                   R("A3", "Iterates over every element of each row with correct column bounds", ["for (int c = 0; c < grid[r].length; c++)"], ["uses grid.length for the columns"], "A2"),
                   R("A4", "Reads from grid with the row index first and the column index second", ["grid[r][c]"], ["swaps the indexes when reading"], "A3"),
                   R("A5", "Writes into the result with the indexes exchanged", ["result[c][r]"], ["result[r][c]"], "A3"),
                   R("A6", "Assigns the element read from grid to the element written in the result", ["result[c][r] = grid[r][c]"], ["compares instead of assigns"], "A5"),
                   R("A7", "Works for arrays that are not square (rows and columns are bounded separately)", ["separate bounds for rows and columns"], ["fails for non-square arrays"], "A1"),
                   R("A8", "Leaves grid unchanged", ["no assignment to grid elements"], ["modifies grid"], "A1"),
                   R("A9", "Returns the new array after all elements are copied and compiles with return type int[][]", ["return result"], ["returns inside the loop", "returns grid"], "A6")])]
    return _pack("csf_2d_transpose", "q4", "4.13", ["4.12", "4.11"], "2.A", "GridTools: transpose a 2D array", "A class GridTools manipulates rectangular two-dimensional arrays of integers. The class is shown with the header of the method you will write.", skeleton, parts, tests, verified, ["grids=8"],
                 ("2D array traversal that builds a new array with row and column exchanged", ["Allocate an array with swapped dimensions", "Map [r][c] to [c][r]", "Leave the input unchanged"], [("the reference and an alternative (column-first loops) pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python zip"))


STAGE_FRQ_EXTRA = ["csf_methods_leap", "csf_methods_digits", "csf_class_scoreboard", "csf_class_stock", "csf_list_runs", "csf_list_remove_short", "csf_2d_border", "csf_2d_transpose"]
