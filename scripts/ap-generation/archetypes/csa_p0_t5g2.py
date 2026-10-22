"""AP Computer Science A FRQ — CS5 Q1 대체 시나리오(2026-10-22): 운영 보고에서 DigitTools(digitSum) 부분 (a)가 공개 Exam 2 와 같은 메서드·시그니처·조건이라 쌍둥이로 판정됐다.
새 Q1 은 자료(분 단위 정수), 과제(올림 나눗셈과 구간별 요금·상한), 추론(정수 연산과 조건 분기)이 다르다. 검증 방식은 csa_p0_t5f.py 와 같다."""
from csa_common import *  # noqa: F401,F403
from calc_ab_frq import part
import csa_java as J
from csa_p0_frq import R, _pack, _fence, extract_method, verify_variants, pick


# ======================= Q1 메서드·제어문: 주차 요금 (4 + 5) =======================
def csf_methods_parking(rng):
    skeleton = "public class ParkingFee {\n    /** Returns the number of hours charged for a stay of the given number of minutes.\n     *  Any fraction of an hour counts as a full hour, and 0 minutes is 0 hours. Precondition: minutes >= 0. */\n    public static int hoursCharged(int minutes) { /* part (a) */ }\n\n    /** Returns the total fee, in dollars, for a stay of the given number of minutes.\n     *  The first two charged hours cost 4 dollars each, every additional charged hour costs 3 dollars,\n     *  and the total never exceeds 20 dollars. Precondition: minutes >= 0. */\n    public static int totalFee(int minutes) { /* part (b) */ }\n}"
    ref = """public class ParkingFee {
    public static int hoursCharged(int minutes) {
        int hours = minutes / 60;
        if (minutes % 60 != 0) {
            hours++;
        }
        return hours;
    }
    public static int totalFee(int minutes) {
        int h = hoursCharged(minutes);
        int fee;
        if (h <= 2) {
            fee = 4 * h;
        } else {
            fee = 8 + 3 * (h - 2);
        }
        if (fee > 20) {
            fee = 20;
        }
        return fee;
    }
}"""
    alt = """public class ParkingFee {
    public static int hoursCharged(int minutes) {
        return (minutes + 59) / 60;
    }
    public static int totalFee(int minutes) {
        int fee = 0;
        for (int i = 1; i <= hoursCharged(minutes); i++) {
            if (i <= 2) {
                fee += 4;
            } else {
                fee += 3;
            }
        }
        return Math.min(fee, 20);
    }
}"""
    w = [("Truncates instead of rounding up, so a fraction of an hour is not charged.", ref.replace("        if (minutes % 60 != 0) {\n            hours++;\n        }\n", ""), "a"),
         ("Adds an hour even for exact multiples of 60.", ref.replace("if (minutes % 60 != 0) {", "if (true) {"), "a"),
         ("Uses (minutes + 60) / 60, which charges an extra hour for exact multiples.", ref.replace("        int hours = minutes / 60;\n        if (minutes % 60 != 0) {\n            hours++;\n        }\n        return hours;", "        return (minutes + 60) / 60;"), "a"),
         ("Charges every hour at 4 dollars.", ref.replace("fee = 8 + 3 * (h - 2);", "fee = 4 * h;"), "b"),
         ("Never applies the 20-dollar maximum.", ref.replace("if (fee > 20) {", "if (fee > 2000) {"), "b"),
         ("Charges only the first hour at 4 dollars and every later hour at 3 dollars.", ref.replace("if (h <= 2) {\n            fee = 4 * h;\n        } else {\n            fee = 8 + 3 * (h - 2);\n        }", "if (h <= 1) {\n            fee = 4 * h;\n        } else {\n            fee = 4 + 3 * (h - 1);\n        }"), "b"),
         ("Ignores hoursCharged and uses whole hours only.", ref.replace("int h = hoursCharged(minutes);", "int h = minutes / 60;"), "b")]
    def hc(m): return (m + 59) // 60
    def fee(m):
        h = hc(m); f = 4 * h if h <= 2 else 8 + 3 * (h - 2)
        return min(f, 20)
    tests = [("a", f"return ParkingFee.hoursCharged({m});", str(hc(m))) for m in (0, 1, 59, 60, 61, 120, 121, 600)]
    tests += [("b", f"return ParkingFee.totalFee({m});", str(fee(m))) for m in (0, 30, 60, 90, 125, 181, 300, 480, 1000)]
    verified = verify_variants("ParkingFee", ref, alt, w, tests)
    parts = [part("a", "Write the method hoursCharged, which returns the number of hours charged for a stay of the given number of minutes. Any fraction of an hour counts as a full hour. For example, hoursCharged(61) returns 2, hoursCharged(120) returns 2, and hoursCharged(0) returns 0. Complete the method hoursCharged.", 4, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "hoursCharged")),
                  [R("A1", "Converts minutes to whole hours by dividing by 60 with integer division", ["minutes / 60"], ["divides by 100", "uses double division without a cast"]),
                   R("A2", "Rounds the hours up when there are leftover minutes", ["leftover minutes add one hour"], ["ignores the leftover", "tests minutes % 60 == 1"]),
                   R("A3", "Leaves exact multiples of 60, and 0 minutes, without an extra hour", ["no extra hour for 60, 120 or 0"], ["always adds an hour", "adds an hour for exact multiples"]),
                   R("A4", "Returns the resulting int hour count", ["return the hour count"], ["returns the minutes", "returns a boolean"])]),
             part("b", "Write the method totalFee, which returns the total fee, in dollars, for a stay of the given number of minutes. The first two charged hours cost 4 dollars each, every additional charged hour costs 3 dollars, and the total never exceeds 20 dollars. You must use hoursCharged appropriately to receive full credit. For example, totalFee(125) returns 11, because 3 hours are charged: 4 + 4 + 3. Complete the method totalFee.", 5, "code", ["2.A"], "One correct implementation (ALTON reference answer):\n" + _fence(extract_method(ref, "totalFee")),
                  [R("B1", "Obtains the charged hours by calling hoursCharged", ["hoursCharged(minutes)"], ["recomputes the hours with minutes / 60"]),
                   R("B2", "Charges 4 dollars for each of the first two charged hours", ["4 dollars for each of the first two hours"], ["uses 3 dollars for the first two hours"]),
                   R("B3", "Charges 3 dollars for each charged hour after the second", ["3 dollars for each later hour"], ["charges 3 dollars for every hour"]),
                   R("B4", "Applies the 20-dollar maximum so that the result never exceeds 20", ["maximum of 20"], ["no maximum is applied"]),
                   R("B5", "Returns the fee as an int in every case, including 0 minutes", ["return the fee"], ["leaves the fee uninitialized on a path"])])]
    return _pack("csf_methods_parking", "q1", "2.4", ["1.9", "2.5"], "2.A", "ParkingFee: charged hours and a tiered fee with a maximum", "A parking garage is writing a class ParkingFee with two static methods that compute the charge for a stay measured in whole minutes.", skeleton, parts, tests, verified, ["cases=17"],
                 ("Methods and control structures: rounding up with integer arithmetic, tiered fees with conditionals, and reusing a helper method", ["Round the minutes up to charged hours with integer division and a remainder test", "Apply two rates and a maximum with conditionals while reusing hoursCharged"], [("the reference and an alternative pass every test; each wrong solution fails at least one", "java test run")], "javac+java compile and run reference, alternative and wrong solutions; expected values from Python"))
