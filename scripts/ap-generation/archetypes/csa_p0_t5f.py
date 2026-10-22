"""AP Computer Science A FRQ — CS4·CS5 5세트 채우기용 신규 시나리오 7개(2026-10-21): Q1 2 · Q2 1 · Q3 2 · Q4 2.
검증 방식은 csa_p0_frq.py 와 같다(모범·대안은 같은 테스트 묶음을 전부 통과, 그럴듯한 오답은 자기 파트 테스트에서 최소 1개 실패). 채점 행은 서로 겹치지 않는 행동 하나씩이고 행 사이 requires 연쇄를 두지 않는다(검토기 지적 반영)."""
from csa_common import *  # noqa: F401,F403
from calc_ab_frq import part
import csa_java as J
from csa_p0_frq import R, _pack, _fence, extract_method, verify_variants, pick


def _lit2(g):
    return "new int[][] { " + ", ".join("{ " + ", ".join(map(str, row)) + " }" for row in g) + " }"


def _lst(vs, t="Integer"):
    return f"ArrayList<{t}> L = new ArrayList<{t}>(); " + " ".join(f"L.add({v});" for v in vs)


# ======================= Q1 메서드·제어문: 자릿수 합과 하샤드 수 (4 + 5) =======================
def csf_methods_harshad(rng):
    skeleton = "public class DigitTools {\n    /** Returns the sum of the digits of n. Precondition: n >= 0. */\n    public static int digitSum(int n) { /* part (a) */ }\n\n    /** Returns the smallest integer that is greater than or equal to start and is divisible by its own digit sum.\n     *  Precondition: start >= 1. */\n    public static int firstHarshad(int start) { /* part (b) */ }\n}"
    ref = """public class DigitTools {
    public static int digitSum(int n) {
        int sum = 0;
        while (n > 0) {
            sum += n % 10;
            n /= 10;
        }
        return sum;
    }
    public static int firstHarshad(int start) {
        int k = start;
        while (k % digitSum(k) != 0) {
            k++;
        }
        return k;
    }
}"""
    alt = """public class DigitTools {
    public static int digitSum(int n) {
        String s = "" + n;
        int total = 0;
        for (int i = 0; i < s.length(); i++) {
            total += Integer.parseInt(s.substring(i, i + 1));
        }
        return n == 0 ? 0 : total;
    }
    public static int firstHarshad(int start) {
        for (int k = start; ; k++) {
            int d = digitSum(k);
            if (k % d == 0) {
                return k;
            }
        }
    }
}"""
    w = [("Skips the last digit by dividing before adding.", ref.replace("sum += n % 10;\n            n /= 10;", "n /= 10;\n            sum += n % 10;"), "a"),
         ("Counts the digits instead of adding their values.", ref.replace("sum += n % 10;", "sum++;"), "a"),
         ("Stops the digit loop when n becomes 9 or less, so the leading digit is lost.", ref.replace("while (n > 0) {", "while (n > 9) {"), "a"),
         ("Starts the search after start instead of at start.", ref.replace("int k = start;", "int k = start + 1;"), "b"),
         ("Returns the digit sum of the first match instead of the number.", ref.replace("        return k;\n    }\n}", "        return digitSum(k);\n    }\n}"), "b"),
         ("Looks for the next even number instead of testing divisibility by the digit sum.", ref.replace("k % digitSum(k) != 0", "k % 2 != 0"), "b")]
    tests = [("a", f"return DigitTools.digitSum({n});", str(sum(map(int, str(n))))) for n in (0, 7, 123, 9999, 1005, 40)]
    def hs(s):
        k = s
        while k % sum(map(int, str(k))) != 0: k += 1
        return k
    tests += [("b", f"return DigitTools.firstHarshad({s});", str(hs(s))) for s in (1, 10, 11, 13, 19, 25, 100)]
    verified = verify_variants("DigitTools", ref, alt, w, tests)
    parts = [part("a", "Write the method digitSum, which returns the sum of the digits of the non-negative integer n. For example, digitSum(1305) returns 9 and digitSum(0) returns 0. Complete the method digitSum.", 4, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "digitSum")),
                  [R("A1", "Uses a loop that continues while digits remain (n > 0) and ends for n = 0 without error", ["while (n > 0)"], ["stops while digits remain", "loops forever"]),
                   R("A2", "Isolates the last digit with n % 10 (not n / 10)", ["n % 10"], ["uses n / 10 as the digit"]),
                   R("A3", "Removes the last digit from n with n / 10 after it has been used", ["n /= 10"], ["removes the digit before adding it"]),
                   R("A4", "Accumulates a running total that starts at 0 and is returned after the loop", ["int sum = 0; ... return sum"], ["returns inside the loop", "total not initialized"])]),
             part("b", "Write the method firstHarshad, which returns the smallest integer greater than or equal to start that is divisible by its own digit sum. You must use digitSum appropriately to receive full credit. For example, firstHarshad(11) returns 12, because 11 is not divisible by 2 and 12 is divisible by 1 + 2 = 3. Complete the method firstHarshad.", 5, "code", ["2.C"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "firstHarshad")),
                  [R("B1", "Starts the search at start itself (so start can be the answer)", ["int k = start"], ["starts at start + 1"]),
                   R("B2", "Repeats until a qualifying value is found (loop with a stopping condition or an infinite loop with a return)", ["while (...) { k++; }"], ["checks only start"]),
                   R("B3", "Calls digitSum with the candidate value as the argument", ["digitSum(k)"], ["recomputes the digit sum incorrectly instead of calling digitSum"]),
                   R("B4", "Tests divisibility of the candidate by its digit sum (k % digitSum(k) == 0, with the operands in this order)", ["k % digitSum(k)"], ["tests only whether k is even", "digitSum(k) % k (never ends)"]),
                   R("B5", "Returns the candidate number, not its digit sum", ["return k"], ["returns the digit sum"])])]
    return _pack("csf_methods_harshad", "q1", "2.10", ["1.9", "2.9"], "2.A", "DigitTools: digit sums and the first Harshad number", "A student is writing a class DigitTools with two static methods that work with the digits of a positive integer.", skeleton, parts, tests, verified, ["n_cases=13"],
                 ("Methods and control structures: digit extraction with % and /, and reusing a helper method", ["Extract digits with % 10 and / 10", "Reuse digitSum to search upward for a divisible value"], [("the reference and an alternative pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))


# ======================= Q1 메서드·제어문: 단어 세기·가장 긴 단어 (4 + 5) =======================
def csf_methods_words(rng):
    skeleton = "public class TextTools {\n    /** Returns the number of words in s. Words are separated by exactly one space; s is not empty and has no leading or trailing space. */\n    public static int countWords(String s) { /* part (a) */ }\n\n    /** Returns the longest word in s. If several words have the greatest length, returns the first of them.\n     *  Precondition: s is not empty and has no leading or trailing space, and words are separated by exactly one space. */\n    public static String longestWord(String s) { /* part (b) */ }\n}"
    ref = """public class TextTools {
    public static int countWords(String s) {
        int count = 1;
        for (int i = 0; i < s.length(); i++) {
            if (s.substring(i, i + 1).equals(" ")) {
                count++;
            }
        }
        return count;
    }
    public static String longestWord(String s) {
        String best = "";
        String rest = s;
        while (rest.length() > 0) {
            int sp = rest.indexOf(" ");
            String word;
            if (sp == -1) {
                word = rest;
                rest = "";
            } else {
                word = rest.substring(0, sp);
                rest = rest.substring(sp + 1);
            }
            if (word.length() > best.length()) {
                best = word;
            }
        }
        return best;
    }
}"""
    alt = """public class TextTools {
    public static int countWords(String s) {
        int words = 0;
        boolean inWord = false;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) != ' ' && !inWord) {
                words++;
                inWord = true;
            } else if (s.charAt(i) == ' ') {
                inWord = false;
            }
        }
        return words;
    }
    public static String longestWord(String s) {
        String best = "";
        int start = 0;
        for (int i = 0; i <= s.length(); i++) {
            if (i == s.length() || s.charAt(i) == ' ') {
                String w = s.substring(start, i);
                if (w.length() > best.length()) {
                    best = w;
                }
                start = i + 1;
            }
        }
        return best;
    }
}"""
    w = [("Counts spaces instead of words (forgets the last word).", ref.replace("int count = 1;", "int count = 0;"), "a"),
         ("Counts every character instead of only spaces.", ref.replace('if (s.substring(i, i + 1).equals(" ")) {', "if (true) {"), "a"),
         ("Compares Strings with == instead of equals, so spaces are not recognized.", ref.replace('s.substring(i, i + 1).equals(" ")', 's.substring(i, i + 1) == " "'), "a"),
         ("Replaces the best word when the length is equal (uses >=), so the last longest word is returned.", ref.replace("word.length() > best.length()", "word.length() >= best.length()"), "b"),
         ("Never examines the last word (loop ends when no space is found).", ref.replace("if (sp == -1) {\n                word = rest;\n                rest = \"\";\n            } else {", "if (sp == -1) {\n                break;\n            } else {"), "b"),
         ("Returns the length of the longest word instead of the word.", ref.replace("        return best;\n    }\n}", "        return \"\" + best.length();\n    }\n}"), "b")]
    sample = ["go", "a b", "red blue", "one two three", "hello big wonderful world", "aa bb cc", "x yy zz y", "sun moon star", "a bc def gh"]
    pw = lambda s: len(s.split(" "))  # noqa: E731
    def pl(s):
        best = ""
        for wd in s.split(" "):
            if len(wd) > len(best): best = wd
        return best
    tests = [("a", f'return TextTools.countWords("{s}");', str(pw(s))) for s in sample] + [("b", f'return TextTools.longestWord("{s}");', pl(s)) for s in sample]
    verified = verify_variants("TextTools", ref, alt, w, tests)
    parts = [part("a", "Write the method countWords, which returns the number of words in s. For example, countWords(\"red blue green\") returns 3 and countWords(\"go\") returns 1. Complete the method countWords.", 4, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "countWords")),
                  [R("A1", "Traverses every character of s using bounds based on s.length()", ["for (int i = 0; i < s.length(); i++)"], ["accesses an index past the end"]),
                   R("A2", "Extracts one character or one-letter substring at index i correctly", ["s.charAt(i) or s.substring(i, i + 1)"], ["uses an index that is off by one"]),
                   R("A3", "Compares the extracted character with the space character correctly (== for char, equals for String)", ["== ' ' or .equals(\" \")"], ["compares a String with == "]),
                   R("A4", "Relates the number of spaces to the number of words (adds 1 for the last word, or counts word starts) and returns the count", ["count starts at 1, or word starts are counted", "return count"], ["returns the number of spaces"])]),
             part("b", "Write the method longestWord, which returns the longest word in s. If several words have the greatest length, the method returns the first of them. For example, longestWord(\"a bc def gh\") returns \"def\" and longestWord(\"aa bb\") returns \"aa\". Complete the method longestWord.", 5, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "longestWord")),
                  [R("B1", "Separates the words of s using indexOf and substring (or an equivalent scan for spaces)", ["indexOf(\" \")", "substring"], ["splits at the wrong position"]),
                   R("B2", "Handles the last word, which is not followed by a space", ["indexOf returns -1 case handled"], ["the last word is never examined"]),
                   R("B3", "Compares the length of each word with the length of the best word so far", ["word.length() > best.length()"], ["compares a word with the previous word only"]),
                   R("B4", "Keeps the first of several longest words (strict comparison)", [">"], ["uses >= and returns the last longest word"]),
                   R("B5", "Returns the word (a String), not its length", ["return best"], ["returns the length"])])]
    return _pack("csf_methods_words", "q1", "2.10", ["1.15", "2.9"], "2.A", "TextTools: counting words and finding the longest word", "A student is writing a class TextTools with two static methods that work with a String of words separated by single spaces.", skeleton, parts, tests, verified, ["cases=18"],
                 ("Methods and control structures: scanning a String for separators with indexOf and substring", ["Count separators to count words", "Walk through the words with indexOf and substring and keep the best"], [("the reference and an alternative pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))


# ======================= Q2 클래스 설계: 배터리 (9) =======================
def csf_class_battery(rng):
    skeleton = "public class Battery {\n    // to be written in this question:\n    //   constructor Battery(int startLevel)\n    //   int use(int amount)\n    //   void recharge()\n    //   int getLevel()\n    //   int getCycles()\n    //   boolean isLow()\n}"
    ref = """public class Battery {
    private int level;
    private int cycles;

    public Battery(int startLevel) {
        level = startLevel;
        cycles = 0;
    }
    public int use(int amount) {
        int used = amount;
        if (used > level) {
            used = level;
        }
        level -= used;
        return used;
    }
    public void recharge() {
        level = 100;
        cycles++;
    }
    public int getLevel() {
        return level;
    }
    public int getCycles() {
        return cycles;
    }
    public boolean isLow() {
        return level < 20;
    }
}"""
    alt = """public class Battery {
    private int level;
    private int cycles;

    public Battery(int startLevel) {
        this.level = startLevel;
    }
    public int use(int amount) {
        if (amount >= level) {
            int all = level;
            level = 0;
            return all;
        }
        level = level - amount;
        return amount;
    }
    public void recharge() {
        cycles = cycles + 1;
        level = 100;
    }
    public int getLevel() {
        return level;
    }
    public int getCycles() {
        return cycles;
    }
    public boolean isLow() {
        if (level < 20) {
            return true;
        }
        return false;
    }
}"""
    w = [("Lets the level go below 0 and returns the requested amount.", ref.replace("        if (used > level) {\n            used = level;\n        }\n", ""), "a"),
         ("Does not count recharges.", ref.replace("        cycles++;\n", ""), "a"),
         ("Recharges to the starting level instead of 100.", ref.replace("level = 100;", "level = 50;"), "a"),
         ("Treats a level of exactly 20 as low.", ref.replace("level < 20", "level <= 20"), "a"),
         ("Returns the remaining level instead of the amount used.", ref.replace("return used;", "return level;"), "a"),
         ("Does not store the starting level.", ref.replace("        level = startLevel;\n", ""), "a")]
    tests = [("a", "Battery b = new Battery(60); return b.getLevel() + \" \" + b.getCycles();", "60 0"),
             ("a", "Battery b = new Battery(60); int u = b.use(25); return u + \" \" + b.getLevel();", "25 35"),
             ("a", "Battery b = new Battery(30); int u = b.use(45); return u + \" \" + b.getLevel();", "30 0"),
             ("a", "Battery b = new Battery(30); b.use(11); return b.isLow() + \" \" + b.getLevel();", "true 19"),
             ("a", "Battery b = new Battery(30); b.use(10); return b.isLow() + \" \" + b.getLevel();", "false 20"),
             ("a", "Battery b = new Battery(5); b.recharge(); b.use(40); b.recharge(); return b.getLevel() + \" \" + b.getCycles();", "100 2"),
             ("a", "Battery b = new Battery(10); b.recharge(); return b.getLevel() + \" \" + b.isLow();", "100 false")]
    verified = verify_variants("Battery", ref, alt, w, tests)
    parts = [part("a", "A Battery object keeps track of its charge level, a whole number from 0 through 100, and the number of times it has been recharged. The class has the following behavior: the constructor Battery(int startLevel) creates a battery with the given level and 0 recharges; use(int amount) lowers the level by amount but never below 0, and returns the amount that was actually used; recharge() sets the level to 100 and increases the number of recharges by 1; getLevel() and getCycles() return the current level and the number of recharges; isLow() returns true if the level is less than 20 and false otherwise. Write the complete Battery class, including the instance variables, the constructor, and all methods.", 9, "code", ["2.B"], "One correct implementation (ALTON reference answer):\n" + _fence(ref),
                  [R("A1", "Declares the class header and private instance variables for the level and the recharge count", ["public class Battery", "private int level; private int cycles"], ["public instance variables", "no variable for the recharge count"]),
                   R("A2", "Constructor stores the starting level and starts with 0 recharges", ["level = startLevel", "cycles = 0 (or default)"], ["does not store the level"]),
                   R("A3", "use lowers the level by the amount when the level is large enough", ["level -= amount"], ["adds the amount"]),
                   R("A4", "use never lets the level fall below 0", ["limits to level"], ["level becomes negative"]),
                   R("A5", "use returns the amount that was actually used (the limited amount, not the requested amount or the level)", ["return used"], ["returns the level"]),
                   R("A6", "recharge sets the level to 100", ["level = 100"], ["adds 100"]),
                   R("A7", "recharge increases the recharge count by 1", ["cycles++"], ["does not count recharges"]),
                   R("A8", "getLevel and getCycles return the current values with correct return types", ["return level; return cycles"], ["return types missing"]),
                   R("A9", "isLow returns true exactly when the level is below 20 (a level of 20 is not low)", ["level < 20"], ["uses <= 20"])])]
    return _pack("csf_class_battery", "q2", "3.5", ["3.4", "3.6"], "2.B", "Battery: a class that limits a charge level", "A battery-powered device uses a class Battery to track its charge. The class is described below.", skeleton, parts, tests, verified, ["tests=7"],
                 ("Class design: private state, a constructor, a limited update that returns what was done, and a threshold method", ["Declare private state and a constructor", "Limit an update and return the amount applied", "Write a boolean threshold method"], [("the reference and an alternative pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions"))


# ======================= Q3 ArrayList: 양수 평균 (9) =======================
def csf_list_avg_positive(rng):
    skeleton = "import java.util.ArrayList;\n\npublic class ListStats {\n    /** Returns the average of the positive values in readings, as a double.\n     *  Values that are 0 or negative are ignored. Returns 0.0 if readings contains no positive values. */\n    public static double averagePositive(ArrayList<Integer> readings) { /* to be written */ }\n}"
    ref = """import java.util.ArrayList;

public class ListStats {
    public static double averagePositive(ArrayList<Integer> readings) {
        int sum = 0;
        int count = 0;
        for (int i = 0; i < readings.size(); i++) {
            if (readings.get(i) > 0) {
                sum += readings.get(i);
                count++;
            }
        }
        if (count == 0) {
            return 0.0;
        }
        return (double) sum / count;
    }
}"""
    alt = """import java.util.ArrayList;

public class ListStats {
    public static double averagePositive(ArrayList<Integer> readings) {
        double total = 0;
        int n = 0;
        for (int v : readings) {
            if (v > 0) {
                total = total + v;
                n = n + 1;
            }
        }
        if (n > 0) {
            return total / n;
        }
        return 0;
    }
}"""
    w = [("Divides by the size of the whole list instead of the number of positive values.", ref.replace("(double) sum / count", "(double) sum / readings.size()"), "a"),
         ("Uses integer division, so the average loses its decimal part.", ref.replace("(double) sum / count", "sum / count"), "a"),
         ("Includes 0 as a positive value (uses >= 0).", ref.replace("readings.get(i) > 0", "readings.get(i) >= 0"), "a"),
         ("Divides by zero when there are no positive values (no empty check).", ref.replace("        if (count == 0) {\n            return 0.0;\n        }\n", ""), "a"),
         ("Skips the first element (starts at index 1).", ref.replace("int i = 0; i < readings.size()", "int i = 1; i < readings.size()"), "a")]
    cases = [[4, 6], [3, -2, 8], [0, 0], [], [-5, -1], [1, 2, 2], [10, -10, 0, 5], [7]]
    def pa(v):
        ps = [x for x in v if x > 0]
        return float(sum(ps) / len(ps)) if ps else 0.0
    tests = [("a", _lst(c) + " return ListStats.averagePositive(L);", str(pa(c))) for c in cases]
    verified = verify_variants("ListStats", ref, alt, w, tests)
    parts = [part("a", "Write the method averagePositive, which returns the average of the positive values in the ArrayList readings as a double. Values that are 0 or negative are ignored. If readings contains no positive values, the method returns 0.0. For example, if readings contains [3, -2, 8, 0], the method returns 5.5. Complete the method averagePositive.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "averagePositive")),
                  [R("A1", "Traverses every element of the list with bounds based on readings.size()", ["for (int i = 0; i < readings.size(); i++)"], ["uses length", "skips an element"]),
                   R("A2", "Accesses an element with get(i) (or an enhanced for loop variable)", ["readings.get(i)"], ["uses an array index [i]"]),
                   R("A3", "Selects only positive values (strictly greater than 0)", ["> 0"], ["includes 0", "includes negative values"]),
                   R("A4", "Accumulates the sum of the selected values", ["sum += readings.get(i)"], ["sums every value"]),
                   R("A5", "Counts the selected values", ["count++"], ["counts every value"]),
                   R("A6", "Handles the case with no positive values (returns 0.0 without dividing by zero)", ["if (count == 0) return 0.0"], ["divides by zero"]),
                   R("A7", "Divides the sum by the number of positive values (not by the list size)", ["/ count"], ["/ readings.size()"]),
                   R("A8", "Produces a double result that keeps the fractional part (a cast or a double operand)", ["(double) sum / count"], ["integer division"]),
                   R("A9", "Returns the computed average from a method whose header uses ArrayList<Integer> and double correctly", ["return ..."], ["returns inside the loop", "wrong return type"])])]
    return _pack("csf_list_avg_positive", "q3", "4.10", ["4.8", "4.9"], "2.A", "ListStats: the average of the positive readings", "A weather station stores readings in an ArrayList of Integer values. A class ListStats analyzes them.", skeleton, parts, tests, verified, ["list_cases=8"],
                 ("ArrayList data analysis: filtered average with a guard against an empty selection", ["Filter values while traversing", "Divide by the number selected, using a double", "Guard against dividing by zero"], [("the reference and an alternative pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))


# ======================= Q3 ArrayList: 첫 항목만 남기기 (9) =======================
def csf_list_keep_first(rng):
    skeleton = "import java.util.ArrayList;\n\npublic class NameList {\n    /** Removes from names every String that is equal to an earlier String in names, so that only the first occurrence of each String remains.\n     *  The order of the remaining Strings is not changed. */\n    public static void removeLaterDuplicates(ArrayList<String> names) { /* to be written */ }\n}"
    ref = """import java.util.ArrayList;

public class NameList {
    public static void removeLaterDuplicates(ArrayList<String> names) {
        for (int i = names.size() - 1; i >= 1; i--) {
            String s = names.get(i);
            if (names.indexOf(s) < i) {
                names.remove(i);
            }
        }
    }
}"""
    alt = """import java.util.ArrayList;

public class NameList {
    public static void removeLaterDuplicates(ArrayList<String> names) {
        int i = 0;
        while (i < names.size()) {
            int j = i + 1;
            while (j < names.size()) {
                if (names.get(j).equals(names.get(i))) {
                    names.remove(j);
                } else {
                    j++;
                }
            }
            i++;
        }
    }
}"""
    w = [("Traverses forward and removes by index, which skips the element that moves into the removed position.", ref.replace("for (int i = names.size() - 1; i >= 1; i--) {", "for (int i = 1; i < names.size(); i++) {"), "a"),
         ("Compares Strings with == instead of equals.", ref.replace("names.indexOf(s) < i", "names.get(0) == s"), "a"),
         ("Removes the first occurrence instead of the later ones.", ref.replace("names.remove(i);", "names.remove(names.indexOf(s));"), "a"),
         ("Builds a new list and does not change names.", ref.replace("                names.remove(i);", "                result.add(s);").replace("        for (int i = names.size() - 1", "        ArrayList<String> result = new ArrayList<String>();\n        for (int i = names.size() - 1"), "a"),
         ("Stops before index 1 incorrectly by ending the loop at i > 1.", ref.replace("i >= 1; i--", "i > 1; i--"), "a")]
    cases = [[], ["a"], ["a", "a"], ["a", "b", "a", "c", "b"], ["x", "y", "z"], ["m", "m", "m", "m"], ["b", "a", "b", "a", "b"], ["ann", "bo", "ann", "cy", "bo", "ann"]]
    def kf(v):
        r = []
        for s in v:
            if s not in r: r.append(s)
        return "[" + ", ".join(r) + "]"
    tests = []
    for c in cases:
        build = "ArrayList<String> L = new ArrayList<String>(); " + " ".join(f'L.add("{s}");' for s in c)
        tests.append(("a", build + " NameList.removeLaterDuplicates(L); return L;", kf(c)))
    verified = verify_variants("NameList", ref, alt, w, tests)
    parts = [part("a", "Write the method removeLaterDuplicates, which removes from the ArrayList names every String that is equal to an earlier String in names. Only the first occurrence of each String remains, and the order of the remaining Strings must not change. The method changes the list it is given rather than returning a new list. For example, if names is [\"a\", \"b\", \"a\", \"c\", \"b\"], then after the call names is [\"a\", \"b\", \"c\"]. Complete the method removeLaterDuplicates.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "removeLaterDuplicates")),
                  [R("A1", "Traverses the list with bounds based on names.size() (every position that could be a later duplicate)", ["for (int i = ...; i < names.size() ...)"], ["uses length", "skips positions"]),
                   R("A2", "Reads an element with get(i)", ["names.get(i)"], ["uses an array index"]),
                   R("A3", "Determines whether an equal String appears earlier (indexOf, a nested loop, or contains on a sublist)", ["names.indexOf(s) < i or an inner loop with equals"], ["checks only the neighbor"]),
                   R("A4", "Compares Strings with equals (or indexOf), not ==", ["equals"], ["=="]),
                   R("A5", "Removes the later duplicate (the element at index i or j), not the earlier occurrence", ["names.remove(i)"], ["removes the first occurrence"]),
                   R("A6", "Handles the index shift after a removal (backward traversal or an index that does not advance after remove)", ["backward loop or j not incremented after remove"], ["skips the element that moves into the removed position"]),
                   R("A7", "Keeps the first occurrence of every String (does not remove a String that appears only once)", ["only later duplicates removed"], ["removes all copies"]),
                   R("A8", "Keeps the remaining Strings in their original order", ["no reordering"], ["reorders the list"]),
                   R("A9", "Changes the original list instead of building and discarding a new list", ["modifies names"], ["builds a new list only"])])]
    return _pack("csf_list_keep_first", "q3", "4.10", ["4.8", "4.9"], "2.A", "NameList: keep only the first copy of each name", "A class NameList works with a list of names stored in an ArrayList of String objects.", skeleton, parts, tests, verified, ["list_cases=8"],
                 ("ArrayList traversal with removal: finding earlier equal Strings and handling the index shift", ["Detect a later duplicate with equals/indexOf", "Remove by index safely", "Change the list in place"], [("the reference and an alternative pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python list logic"))


# ======================= Q4 2차원 배열: 좌우 반전 (9) =======================
def csf_2d_flip_rows(rng):
    skeleton = "public class GridTools {\n    /** Returns a new two-dimensional array with the same dimensions as grid in which every row of grid appears in reverse order.\n     *  The array grid is not changed. Precondition: grid has at least one row and every row has the same positive length. */\n    public static int[][] flipRows(int[][] grid) { /* to be written */ }\n}"
    ref = """public class GridTools {
    public static int[][] flipRows(int[][] grid) {
        int[][] result = new int[grid.length][grid[0].length];
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[r].length; c++) {
                result[r][c] = grid[r][grid[r].length - 1 - c];
            }
        }
        return result;
    }
}"""
    alt = """public class GridTools {
    public static int[][] flipRows(int[][] grid) {
        int rows = grid.length;
        int cols = grid[0].length;
        int[][] out = new int[rows][cols];
        for (int c = 0; c < cols; c++) {
            for (int r = 0; r < rows; r++) {
                out[r][cols - 1 - c] = grid[r][c];
            }
        }
        return out;
    }
}"""
    w = [("Reverses the order of the rows instead of the elements in each row.", ref.replace("result[r][c] = grid[r][grid[r].length - 1 - c];", "result[r][c] = grid[grid.length - 1 - r][c];"), "a"),
         ("Uses grid[r].length - c, which goes out of bounds for c = 0.", ref.replace("grid[r].length - 1 - c", "grid[r].length - c"), "a"),
         ("Returns grid itself after reversing it in place.", ref.replace("        int[][] result = new int[grid.length][grid[0].length];", "        int[][] result = grid;"), "a"),
         ("Leaves the last column unchanged (inner loop stops one early).", ref.replace("c < grid[r].length; c++", "c < grid[r].length - 1; c++"), "a"),
         ("Creates a result array with the rows and columns swapped.", ref.replace("new int[grid.length][grid[0].length]", "new int[grid[0].length][grid.length]").replace("result[r][c] = grid[r][grid[r].length - 1 - c];", "result[c][r] = grid[r][grid[r].length - 1 - c];"), "a")]
    grids = [[[5]], [[1, 2, 3]], [[1], [2], [3]], [[1, 2], [3, 4]], [[1, 2, 3], [4, 5, 6]], [[7, 0, 7, 1], [2, 2, 9, 4]], [[3, 1, 4], [1, 5, 9], [2, 6, 5]]]
    tests = []
    for g in grids:
        lit = _lit2(g)
        rev = [row[::-1] for row in g]
        tests.append(("a", f"int[][] r = GridTools.flipRows({lit}); String s = \"\"; for (int[] row : r) {{ for (int v : row) {{ s += v + \",\"; }} s += \"|\"; }} return s;", "".join("".join(f"{v}," for v in row) + "|" for row in rev)))
    tests.append(("a", "int[][] g = { { 1, 2 }, { 3, 4 } }; int[][] r = GridTools.flipRows(g); return g[0][0] + \" \" + g[0][1] + \" \" + r[0][0];", "1 2 2"))
    verified = verify_variants("GridTools", ref, alt, w, tests)
    parts = [part("a", "Write the method flipRows, which returns a new two-dimensional array with the same dimensions as grid in which every row of grid appears in reverse order. The array grid must not be changed. For example, if grid is { { 1, 2, 3 }, { 4, 5, 6 } } the method returns { { 3, 2, 1 }, { 6, 5, 4 } }. Complete the method flipRows.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "flipRows")),
                  [R("A1", "Creates a new two-dimensional array with the same number of rows and columns as grid", ["new int[grid.length][grid[0].length]"], ["reuses grid", "swaps rows and columns"]),
                   R("A2", "Iterates over every row with a loop bounded by grid.length", ["for (int r = 0; r < grid.length; r++)"], ["uses grid[0].length for the rows"]),
                   R("A3", "Iterates over every element of a row with bounds based on the row length", ["c < grid[r].length"], ["uses grid.length for the columns"]),
                   R("A4", "Computes the mirrored column index within the same row (length - 1 - c)", ["grid[r].length - 1 - c"], ["length - c (out of bounds)"]),
                   R("A5", "Reads from grid and writes to the new array at the corresponding position", ["result[r][c] = grid[r][...]"], ["writes to grid"]),
                   R("A6", "Keeps each row in its own row of the result (does not reverse the order of the rows)", ["same row index r"], ["grid[grid.length - 1 - r]"]),
                   R("A7", "Does not change the original array grid", ["grid unchanged"], ["reverses grid in place and returns it"]),
                   R("A8", "Works for any rectangular size, including one row, one column, and non-square arrays", ["no assumption of square shape"], ["assumes the same number of rows and columns"]),
                   R("A9", "Returns the new array after both loops finish (a method with return type int[][])", ["return result"], ["returns inside the loop"])])]
    return _pack("csf_2d_flip_rows", "q4", "4.12", ["4.13"], "2.A", "GridTools: reversing every row of a 2D array", "A class GridTools contains a method that works with a two-dimensional array of integers.", skeleton, parts, tests, verified, ["grids=8"],
                 ("2D array traversal creating a mirrored copy with index arithmetic", ["Create a new array of the right size", "Traverse rows and columns", "Mirror the column index"], [("the reference and an alternative pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))


# ======================= Q4 2차원 배열: 열의 최솟값 (9) =======================
def csf_2d_column_min(rng):
    skeleton = "public class GridTools2 {\n    /** Returns a new one-dimensional array whose element at index c is the smallest value in column c of grid.\n     *  Precondition: grid has at least one row and every row has the same positive length. */\n    public static int[] columnMins(int[][] grid) { /* to be written */ }\n}"
    ref = """public class GridTools2 {
    public static int[] columnMins(int[][] grid) {
        int[] mins = new int[grid[0].length];
        for (int c = 0; c < grid[0].length; c++) {
            int m = grid[0][c];
            for (int r = 1; r < grid.length; r++) {
                if (grid[r][c] < m) {
                    m = grid[r][c];
                }
            }
            mins[c] = m;
        }
        return mins;
    }
}"""
    alt = """public class GridTools2 {
    public static int[] columnMins(int[][] grid) {
        int[] result = new int[grid[0].length];
        for (int c = 0; c < result.length; c++) {
            result[c] = grid[0][c];
        }
        for (int r = 1; r < grid.length; r++) {
            for (int c = 0; c < grid[r].length; c++) {
                result[c] = Math.min(result[c], grid[r][c]);
            }
        }
        return result;
    }
}"""
    w = [("Finds the minimum of each row instead of each column.", ref.replace("int[] mins = new int[grid[0].length];\n        for (int c = 0; c < grid[0].length; c++) {\n            int m = grid[0][c];\n            for (int r = 1; r < grid.length; r++) {\n                if (grid[r][c] < m) {\n                    m = grid[r][c];\n                }\n            }\n            mins[c] = m;\n        }", "int[] mins = new int[grid.length];\n        for (int r = 0; r < grid.length; r++) {\n            int m = grid[r][0];\n            for (int c = 1; c < grid[r].length; c++) {\n                if (grid[r][c] < m) {\n                    m = grid[r][c];\n                }\n            }\n            mins[r] = m;\n        }"), "a"),
         ("Starts each minimum at 0, which fails when every value in a column is positive.", ref.replace("int m = grid[0][c];", "int m = 0;"), "a"),
         ("Finds the largest value in each column instead of the smallest.", ref.replace("grid[r][c] < m", "grid[r][c] > m"), "a"),
         ("Skips the last row when looking for the minimum.", ref.replace("r < grid.length; r++", "r < grid.length - 1; r++"), "a"),
         ("Returns the smallest value overall instead of an array of column minimums.", ref.replace("            mins[c] = m;", "            if (c == 0 || m < mins[0]) {\n                mins[0] = m;\n            }"), "a")]
    grids = [[[5]], [[4, 9, 2]], [[4], [9], [2]], [[3, 8], [1, 9]], [[5, 5, 5], [6, 1, 7], [4, 3, 9]], [[-2, 7], [-5, 4], [0, 1]], [[9, 9, 9, 9], [8, 7, 6, 5]]]
    tests = [("a", "int[] m = GridTools2.columnMins(" + _lit2(g) + "); String s = \"\"; for (int v : m) { s += v + \",\"; } return s;",
              "".join(f"{min(g[r][c] for r in range(len(g)))}," for c in range(len(g[0])))) for g in grids]
    verified = verify_variants("GridTools2", ref, alt, w, tests)
    parts = [part("a", "Write the method columnMins, which returns a one-dimensional array whose element at index c is the smallest value in column c of grid. For example, if grid is { { 3, 8, 5 }, { 1, 9, 6 }, { 4, 7, 2 } } the method returns { 1, 7, 2 }. Complete the method columnMins.", 9, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "columnMins")),
                  [R("A1", "Creates a result array whose length equals the number of columns, grid[0].length", ["new int[grid[0].length]"], ["uses grid.length"]),
                   R("A2", "Iterates over every column with a loop bounded by the number of columns", ["for (int c = 0; c < grid[0].length; c++)"], ["loops over rows only"]),
                   R("A3", "For each column, examines every row of that column (row index varies while the column index is fixed)", ["grid[r][c] with r varying"], ["swaps the indexes", "examines only one row"]),
                   R("A4", "Initializes the minimum from a value in the column (not 0 or a fixed constant that may be too small)", ["m = grid[0][c]"], ["m = 0"]),
                   R("A5", "Updates the minimum when a smaller value is found (a strict less-than comparison)", ["grid[r][c] < m"], ["finds the maximum"]),
                   R("A6", "Includes every row, including the last row, in the comparison", ["r < grid.length"], ["stops one row early"]),
                   R("A7", "Stores each column's minimum at index c of the result array", ["mins[c] = m"], ["stores only one value"]),
                   R("A8", "Works for any rectangular size, including one row, one column, and negative values", ["no assumption of square shape or positive values"], ["assumes the same number of rows and columns"]),
                   R("A9", "Returns the result array after the loops finish (return type int[])", ["return mins"], ["returns inside the loop"])])]
    return _pack("csf_2d_column_min", "q4", "4.12", ["4.13", "4.5"], "2.A", "GridTools2: the smallest value in each column", "A class GridTools2 contains a method that analyzes a two-dimensional array of integers by column.", skeleton, parts, tests, verified, ["grids=7"],
                 ("2D array column traversal with a running minimum per column", ["Fix a column and vary the row", "Start the minimum from a value in the column", "Store one result per column"], [("the reference and an alternative pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))


STAGE_T5_FRQ = ["csf_methods_harshad", "csf_methods_words", "csf_class_battery", "csf_list_avg_positive", "csf_list_keep_first", "csf_2d_flip_rows", "csf_2d_column_min"]
