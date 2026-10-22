"""AP Computer Science A 원형 — CS5 단독 5칸 대체(2026-10-21): 구조 비교가 공개 문항의 숫자만 바꾼 변형으로 판정한 가상 칸을 채우는 새 코드 완성 문항(단원 1 셋, 단원 2 둘).
정답·오답은 Java 로 컴파일·실행한 결과다. 자료·조건·요구 과제가 공개 문항과 달라야 한다."""
from csa_common import *  # noqa: F401,F403
from csa_p0_t5a import _add
import csa_java as J  # noqa: F401

_add("cs_price_cents_round", "1.7",
     "class Pricing {\n    /** Returns the price in dollars after discounting dollars by pct percent, rounded to the nearest cent. Both arguments are positive. */\n    public static double discounted(double dollars, int pct) {\n/*BODY*/\n    }\n}",
     "The method discounted is intended to return dollars reduced by pct percent, rounded to the nearest cent. Which of the following can replace /* missing code */ so that discounted works as intended?",
     [("double cents = dollars * (100 - pct);\nreturn (int) (cents + 0.5) / 100.0;", True, None),
      ("double cents = dollars * (100 - pct);\nreturn (int) cents / 100.0;", False, "Truncates instead of rounding to the nearest cent."),
      ("double cents = dollars * (100 - pct);\nreturn (int) (cents / 100.0 + 0.5);", False, "Rounds to the nearest whole dollar because the division comes before the cast."),
      ("int cents = (int) dollars * (100 - pct);\nreturn (cents + 0.5) / 100.0;", False, "Casts dollars to int first, which drops the cents of the price.")],
     [("return Pricing.discounted(10.00, 15);", "8.5"), ("return Pricing.discounted(19.99, 10);", "17.99"), ("return Pricing.discounted(4.99, 50);", "2.5"), ("return Pricing.discounted(12.50, 33);", "8.38")],
     "round a computed double to a given number of decimal places with a cast", "Scaling to cents, adding 0.5 before the (int) cast and then dividing by 100.0 rounds to the nearest cent.", "each candidate compiled and run on prices with and without cents", skill="2.A")
_add("cs_circular_back", "1.9",
     "class Ring {\n    /** Returns the index reached by moving k positions backward from index i in a circular list of n positions (0 through n - 1). 0 <= i < n and 0 <= k < n. */\n    public static int back(int i, int k, int n) {\n/*BODY*/\n    }\n}",
     "The method back is intended to return the index reached by moving k positions backward from index i, wrapping around from index 0 to index n - 1. Which of the following can replace /* missing code */ so that back works as intended?",
     [("return (i - k + n) % n;", True, None),
      ("return (i - k) % n;", False, "The remainder of a negative number is negative in Java, so the result can be negative."),
      ("return (i + k) % n;", False, "Moves forward instead of backward."),
      ("return i - k + n;", False, "Does not wrap with the remainder, so the result can be n or larger.")],
     [("return Ring.back(5, 2, 8);", "3"), ("return Ring.back(1, 3, 8);", "6"), ("return Ring.back(0, 1, 5);", "4"), ("return Ring.back(4, 0, 6);", "4")],
     "wrap an index with the remainder operator", "Adding n before taking the remainder keeps the value non-negative, so i - k + n wraps correctly.", "each candidate compiled and run with and without wrap-around", skill="2.A")
_add("cs_swap_halves", "1.15",
     "class Words {\n    /** Returns a string in which the second half of s comes before the first half. The length of s is even. For example, swapHalves(\"abcdef\") returns \"defabc\". */\n    public static String swapHalves(String s) {\n/*BODY*/\n    }\n}",
     "The method swapHalves is intended to return a string in which the second half of s comes before the first half. Which of the following can replace /* missing code */ so that swapHalves works as intended?",
     [("int h = s.length() / 2;\nreturn s.substring(h) + s.substring(0, h);", True, None),
      ("int h = s.length() / 2;\nreturn s.substring(h) + s.substring(0, h - 1);", False, "Drops the last character of the first half."),
      ("int h = s.length() / 2;\nreturn s.substring(0, h) + s.substring(h);", False, "Rebuilds the original string without swapping the halves."),
      ("int h = s.length() / 2;\nreturn s.substring(h + 1) + s.substring(0, h);", False, "Drops the first character of the second half.")],
     [("return Words.swapHalves(\"abcdef\");", "defabc"), ("return Words.swapHalves(\"ab\");", "ba"), ("return Words.swapHalves(\"wxyz\");", "yzwx"), ("return Words.swapHalves(\"\");", "")],
     "split and rebuild a string with substring", "The second half starts at index h, so s.substring(h) + s.substring(0, h) swaps the halves exactly.", "each candidate compiled and run on strings of length 0, 2, 4 and 6")
_add("cs_valid_clock_time", "2.5",
     "class Clock {\n    /** Returns true if h is a valid hour (0 through 23) and m is a valid minute (0 through 59). */\n    public static boolean isValid(int h, int m) {\n/*BODY*/\n    }\n}",
     "The method isValid is intended to return true only if h is a valid hour from 0 through 23 and m is a valid minute from 0 through 59. Which of the following can replace /* missing code */ so that isValid works as intended?",
     [("return h >= 0 && h <= 23 && m >= 0 && m <= 59;", True, None),
      ("return h >= 0 && h < 23 && m >= 0 && m < 59;", False, "Rejects the largest valid hour and minute."),
      ("return h >= 0 || h <= 23 && m >= 0 || m <= 59;", False, "Mixes || and && so that out-of-range values can still produce true."),
      ("return h > 0 && h <= 23 && m > 0 && m <= 59;", False, "Rejects hour 0 and minute 0, which are valid.")],
     [("return Clock.isValid(0, 0);", "true"), ("return Clock.isValid(23, 59);", "true"), ("return Clock.isValid(24, 10);", "false"), ("return Clock.isValid(12, 60);", "false")],
     "write a compound boolean expression with range checks", "Each value needs both bounds joined by &&, and the inclusive bounds 0, 23 and 59 are kept.", "each candidate compiled and run on boundary and out-of-range values", skill="2.B")
_add("cs_halving_steps", "2.9",
     "class Steps {\n    /** Returns the number of steps needed to reach 1 from n, where n >= 1. In each step, an even value is divided by 2 and an odd value greater than 1 becomes 3 * value + 1. */\n    public static int steps(int n) {\n        int count = 0;\n/*BODY*/\n        return count;\n    }\n}",
     "The method steps is intended to count the steps needed to reach 1 from n using the rule in the comment. Which of the following can replace /* missing code */ so that steps works as intended?",
     [("while (n != 1) {\n    if (n % 2 == 0) {\n        n = n / 2;\n    } else {\n        n = 3 * n + 1;\n    }\n    count++;\n}", True, None),
      ("while (n != 1) {\n    if (n % 2 == 0) {\n        n = n / 2;\n    } else {\n        n = 3 * n + 1;\n    }\n}\ncount = 1;", False, "Never increments count inside the loop."),
      ("while (n > 2) {\n    if (n % 2 == 0) {\n        n = n / 2;\n    } else {\n        n = 3 * n + 1;\n    }\n    count++;\n}", False, "Stops when the value is 2 or less, so it misses the final step."),
      ("while (n != 1) {\n    if (n % 2 == 0) {\n        n = n / 2;\n    } else {\n        n = (3 * n + 1) / 2;\n    }\n    count++;\n}", False, "Combines the odd update and the next halving into one step, so it counts fewer steps.")],
     [("return Steps.steps(1);", "0"), ("return Steps.steps(2);", "1"), ("return Steps.steps(6);", "8"), ("return Steps.steps(7);", "16")],
     "count the iterations of a while loop with a two-way update", "The loop runs until n reaches 1, applying the even or odd rule and counting once per step.", "each candidate compiled and run for values with short and long sequences", skill="2.B", est=120)
