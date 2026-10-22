"""AP Computer Science A 원형 — CS4·CS5 5세트 채우기용 신규 코드 완성 문항(2026-10-21), 단원 4 데이터 컬렉션(배열·ArrayList·2차원 배열·탐색·정렬·재귀).
정답·오답은 모두 Java 로 컴파일·실행한 결과다(csa_common.mk_tests): 정답은 모든 테스트를 통과하고 오답은 이름 붙은 오개념으로 적어도 한 테스트에서 실패한다.
구조 기준: 공개 문항과 자료·조건·요구 과제·풀이 단계가 달라야 한다(같은 개념을 다른 과제로 묻는 것은 허용)."""
from csa_common import *  # noqa: F401,F403
import csa_java as J  # noqa: F401


def _comp(arch, topic, tpl, stem, cands, tests, concept, kwhy, path, skill="2.A", indent="        ", est=100):
    """코드 완성 원형 공장: tpl 안의 /*BODY*/ 를 후보 코드로 채운 클래스를 후보마다 만들어 tests 를 실행한다. cands = [(코드, 정답 여부, 오답 설명)]."""
    shown = tpl.replace("/*BODY*/", indent + "/* missing code */")

    def fn(rng):
        options = []
        for c, k, w in cands:
            body = "\n".join(indent + ln if ln.strip() else ln for ln in c.split("\n"))
            text = f"`{c}`" if "\n" not in c and len(c) < 70 else f"```\n{c}\n```"
            options.append({"text": text, "source": tpl.replace("/*BODY*/", body), "why": w, "key": bool(k)})
        return mk_tests(rng, arch, topic, skill, stem, shown, options, tests, concept=concept, path=path, kwhy_by_key=kwhy, est=est)
    fn.__name__ = arch
    return fn


_DEF = []


def _add(*a, **k):
    f = _comp(*a, **k)
    _DEF.append(f)
    globals()[f.__name__] = f
    return f


# ---- 4.4 배열 순회 ----
_add("cs_array_sum_evens", "4.4",
     "class ArrTools {\n    /** Returns the sum of the even values in a. Returns 0 if a has no even values. */\n    public static int sumEvens(int[] a) {\n        int sum = 0;\n/*BODY*/\n        return sum;\n    }\n}",
     "The method sumEvens is intended to return the sum of the even values in the array a. Which of the following can replace /* missing code */ so that sumEvens works as intended?",
     [("for (int v : a) {\n    if (v % 2 == 0) {\n        sum += v;\n    }\n}", True, None),
      ("for (int v : a) {\n    if (v % 2 == 0) {\n        sum++;\n    }\n}", False, "Counts the even values instead of adding their values."),
      ("for (int i = 0; i < a.length; i++) {\n    if (i % 2 == 0) {\n        sum += a[i];\n    }\n}", False, "Tests the index for evenness instead of the value."),
      ("for (int v : a) {\n    if (v % 2 == 0) {\n        sum = v;\n    }\n}", False, "Overwrites the sum with each even value instead of accumulating.")],
     [("return ArrTools.sumEvens(new int[] {1, 2, 3, 4});", "6"), ("return ArrTools.sumEvens(new int[] {});", "0"), ("return ArrTools.sumEvens(new int[] {7, 9});", "0"), ("return ArrTools.sumEvens(new int[] {-2, -4, 5});", "-6"), ("return ArrTools.sumEvens(new int[] {2, 2, 2});", "6")],
     "traverse an array with a conditional accumulator", "Only the version that tests the value with v % 2 == 0 and adds v to sum passes every test.", "each candidate compiled and run on empty, all-odd and negative arrays")
_add("cs_array_last_index", "4.5",
     "class ArrTools {\n    /** Returns the index of the last occurrence of target in a, or -1 if target does not appear. */\n    public static int lastIndexOf(int[] a, int target) {\n/*BODY*/\n    }\n}",
     "The method lastIndexOf is intended to return the index of the last occurrence of target in the array a, or -1 if target is not in a. Which of the following can replace /* missing code */ so that lastIndexOf works as intended?",
     [("for (int i = a.length - 1; i >= 0; i--) {\n    if (a[i] == target) {\n        return i;\n    }\n}\nreturn -1;", True, None),
      ("for (int i = 0; i < a.length; i++) {\n    if (a[i] == target) {\n        return i;\n    }\n}\nreturn -1;", False, "Returns the first occurrence instead of the last."),
      ("int last = -1;\nfor (int i = 0; i < a.length; i++) {\n    if (a[i] == target) {\n        last = i;\n    }\n}\nreturn 0;", False, "Computes the last index but then returns 0."),
      ("for (int i = a.length; i >= 0; i--) {\n    if (a[i] == target) {\n        return i;\n    }\n}\nreturn -1;", False, "Starts at a.length, which is out of bounds, so an exception occurs.")],
     [("return ArrTools.lastIndexOf(new int[] {3, 5, 3, 8}, 3);", "2"), ("return ArrTools.lastIndexOf(new int[] {3, 5, 3, 8}, 8);", "3"), ("return ArrTools.lastIndexOf(new int[] {3, 5, 3, 8}, 4);", "-1"), ("return ArrTools.lastIndexOf(new int[] {}, 1);", "-1")],
     "search an array from the end", "Scanning from the last index downward and returning the first match gives the last occurrence.", "each candidate compiled and run with repeated, missing and empty inputs")
_add("cs_array_reverse_copy", "4.5",
     "class ArrTools {\n    /** Returns a new array containing the values of a in reverse order. The array a is not changed. */\n    public static int[] reversed(int[] a) {\n        int[] r = new int[a.length];\n/*BODY*/\n        return r;\n    }\n}",
     "The method reversed is intended to return a new array with the values of a in reverse order without changing a. Which of the following can replace /* missing code */ so that reversed works as intended?",
     [("for (int i = 0; i < a.length; i++) {\n    r[i] = a[a.length - 1 - i];\n}", True, None),
      ("for (int i = 0; i < a.length; i++) {\n    r[i] = a[a.length - i];\n}", False, "Uses a.length - i, which is out of bounds when i is 0."),
      ("for (int i = 0; i < a.length; i++) {\n    r[a.length - 1 - i] = r[i];\n}", False, "Copies from the new array r, whose values are all 0, instead of from a."),
      ("for (int i = 0; i < a.length; i++) {\n    r[i] = a[i];\n}", False, "Copies the values in the original order.")],
     [("int[] r = ArrTools.reversed(new int[] {1, 2, 3, 4}); return r[0] + \" \" + r[1] + \" \" + r[2] + \" \" + r[3];", "4 3 2 1"), ("int[] r = ArrTools.reversed(new int[] {7}); return r.length + \" \" + r[0];", "1 7"), ("int[] a = new int[] {5, 6, 9}; int[] r = ArrTools.reversed(a); return r[0] + \" \" + r[2] + \" \" + a[0];", "9 5 5")],
     "build a reversed copy of an array with index arithmetic", "r[i] must take the element at the mirrored index a.length - 1 - i.", "each candidate compiled and run on arrays of length 1 and 4")
_add("cs_array_count_greater", "4.4",
     "class ArrTools {\n    /** Returns the number of values in a that are greater than the average of all values in a. Assume a has at least one value. */\n    public static int countAboveAverage(int[] a) {\n        double avg = 0;\n        for (int v : a) {\n            avg += v;\n        }\n        avg = avg / a.length;\n        int count = 0;\n/*BODY*/\n        return count;\n    }\n}",
     "The method countAboveAverage is intended to return the number of values in the array a that are greater than the average of the values in a. Which of the following can replace /* missing code */ so that countAboveAverage works as intended?",
     [("for (int v : a) {\n    if (v > avg) {\n        count++;\n    }\n}", True, None),
      ("for (int v : a) {\n    if (v >= avg) {\n        count++;\n    }\n}", False, "Also counts values equal to the average."),
      ("for (int v : a) {\n    if (avg > v) {\n        count++;\n    }\n}", False, "Counts values below the average instead of above."),
      ("for (int v : a) {\n    if (v > avg) {\n        count = v;\n    }\n}", False, "Stores the value instead of counting.")],
     [("return ArrTools.countAboveAverage(new int[] {1, 2, 3, 10});", "1"), ("return ArrTools.countAboveAverage(new int[] {4, 4, 4});", "0"), ("return ArrTools.countAboveAverage(new int[] {1, 5, 5, 9});", "1"), ("return ArrTools.countAboveAverage(new int[] {2, 3, 8, 9});", "2")],
     "compare each element with a computed average", "Only a strict comparison v > avg that increments count passes every test, including the all-equal case.", "each candidate compiled and run with values equal to the average")
_add("cs_array_shift_right", "4.5",
     "class ArrTools {\n    /** Shifts every value in a one position to the right; the last value is discarded and a[0] becomes 0. */\n    public static void shiftRight(int[] a) {\n/*BODY*/\n    }\n}",
     "The method shiftRight is intended to move every value of the array a one position to the right, discard the last value, and set a[0] to 0. Which of the following can replace /* missing code */ so that shiftRight works as intended?",
     [("for (int i = a.length - 1; i > 0; i--) {\n    a[i] = a[i - 1];\n}\na[0] = 0;", True, None),
      ("for (int i = 1; i < a.length; i++) {\n    a[i] = a[i - 1];\n}\na[0] = 0;", False, "Copying from left to right overwrites values before they are moved, filling the array with a[0]."),
      ("for (int i = a.length - 1; i >= 0; i--) {\n    a[i] = a[i - 1];\n}\na[0] = 0;", False, "The loop reaches i == 0 and reads a[-1], which throws an exception."),
      ("for (int i = a.length - 1; i > 0; i--) {\n    a[i - 1] = a[i];\n}\na[a.length - 1] = 0;", False, "Shifts the values to the left instead of the right.")],
     [("int[] a = {1, 2, 3, 4}; ArrTools.shiftRight(a); return a[0] + \" \" + a[1] + \" \" + a[2] + \" \" + a[3];", "0 1 2 3"), ("int[] a = {9}; ArrTools.shiftRight(a); return \"\" + a[0];", "0"), ("int[] a = {5, 6}; ArrTools.shiftRight(a); return a[0] + \" \" + a[1];", "0 5")],
     "shift array elements by iterating in the right direction", "To avoid overwriting, the loop must run from the end toward the front.", "each candidate compiled and run on arrays of length 1, 2 and 4")
# ---- 4.8~4.11 ArrayList ----
_add("cs_list_add_sorted", "4.10",
     "class ListTools {\n    /** Inserts value into list, which is sorted in increasing order, so that list remains sorted. */\n    public static void insertSorted(ArrayList<Integer> list, int value) {\n/*BODY*/\n    }\n}",
     "The method insertSorted is intended to insert value into the sorted ArrayList list so that the list remains in increasing order. Which of the following can replace /* missing code */ so that insertSorted works as intended?",
     [("int i = 0;\nwhile (i < list.size() && list.get(i) < value) {\n    i++;\n}\nlist.add(i, value);", True, None),
      ("int i = 0;\nwhile (i < list.size() && list.get(i) < value) {\n    i++;\n}\nlist.set(i, value);", False, "Replaces an existing element or throws an exception instead of inserting."),
      ("int i = 0;\nwhile (list.get(i) < value) {\n    i++;\n}\nlist.add(i, value);", False, "Does not check i < list.size(), so inserting a largest value throws an exception."),
      ("list.add(value);", False, "Appends at the end without keeping the list sorted.")],
     [("ArrayList<Integer> L = new ArrayList<Integer>(); L.add(2); L.add(5); L.add(9); ListTools.insertSorted(L, 6); return L;", "[2, 5, 6, 9]"), ("ArrayList<Integer> L = new ArrayList<Integer>(); L.add(2); L.add(5); ListTools.insertSorted(L, 7); return L;", "[2, 5, 7]"), ("ArrayList<Integer> L = new ArrayList<Integer>(); L.add(4); ListTools.insertSorted(L, 1); return L;", "[1, 4]"), ("ArrayList<Integer> L = new ArrayList<Integer>(); ListTools.insertSorted(L, 3); return L;", "[3]")],
     "find an insertion position in a sorted ArrayList", "The loop stops at the first element that is not smaller than value, and add(i, value) inserts there without losing elements.", "each candidate compiled and run at the front, middle, end and for an empty list")
_add("cs_list_remove_duplicates_adjacent", "4.10",
     "class ListTools {\n    /** Removes each value that is equal to the value just before it, so that no two adjacent values are equal. */\n    public static void squeeze(ArrayList<Integer> list) {\n/*BODY*/\n    }\n}",
     "The method squeeze is intended to remove each element that is equal to the element just before it, so that no two adjacent elements are equal. Which of the following can replace /* missing code */ so that squeeze works as intended?",
     [("for (int i = list.size() - 1; i > 0; i--) {\n    if (list.get(i).equals(list.get(i - 1))) {\n        list.remove(i);\n    }\n}", True, None),
      ("for (int i = 1; i < list.size(); i++) {\n    if (list.get(i).equals(list.get(i - 1))) {\n        list.remove(i);\n    }\n}", False, "Removing while moving forward shifts elements left and skips the element after each removal."),
      ("for (int i = list.size() - 1; i > 0; i--) {\n    if (list.get(i) == list.get(i - 1)) {\n        list.remove(i);\n    }\n}", False, "Compares Integer objects with ==, which compares references and fails for values above 127."),
      ("for (int i = 0; i < list.size() - 1; i++) {\n    if (list.get(i).equals(list.get(i + 1))) {\n        list.remove(i);\n    }\n}", False, "Removing while moving forward and not re-checking the same position skips elements, so some adjacent duplicates remain.")],
     [("ArrayList<Integer> L = new ArrayList<Integer>(); L.add(3); L.add(3); L.add(3); L.add(5); ListTools.squeeze(L); return L;", "[3, 5]"), ("ArrayList<Integer> L = new ArrayList<Integer>(); L.add(1); L.add(2); L.add(2); L.add(1); L.add(1); ListTools.squeeze(L); return L;", "[1, 2, 1]"), ("ArrayList<Integer> L = new ArrayList<Integer>(); L.add(500); L.add(500); L.add(7); ListTools.squeeze(L); return L;", "[500, 7]"), ("ArrayList<Integer> L = new ArrayList<Integer>(); ListTools.squeeze(L); return L;", "[]")],
     "remove adjacent duplicates from an ArrayList safely", "Traversing from the end with equals removes a duplicate without disturbing the indexes still to be examined.", "each candidate compiled and run on runs of equal values, values above 127 and an empty list")
# ---- 4.12 / 4.13 2차원 배열 ----
_add("cs_2d_column_sum", "4.12",
     "class GridTools {\n    /** Returns the sum of the values in column c of m. Assume m is rectangular and c is a valid column index. */\n    public static int columnSum(int[][] m, int c) {\n        int sum = 0;\n/*BODY*/\n        return sum;\n    }\n}",
     "The method columnSum is intended to return the sum of the values in column c of the rectangular array m. Which of the following can replace /* missing code */ so that columnSum works as intended?",
     [("for (int r = 0; r < m.length; r++) {\n    sum += m[r][c];\n}", True, None),
      ("for (int r = 0; r < m.length; r++) {\n    sum += m[c][r];\n}", False, "Swaps the indexes, so it adds the values of row c (or throws an exception) instead of column c."),
      ("for (int r = 0; r < m.length; r++) {\n    sum = m[r][c];\n}", False, "Overwrites the sum with each value instead of accumulating."),
      ("for (int k = 0; k < m[0].length; k++) {\n    sum += m[0][k];\n}", False, "Adds the values of the first row instead of the requested column.")],
     [("return GridTools.columnSum(new int[][] {{1, 2, 3}, {4, 5, 6}}, 1);", "7"), ("return GridTools.columnSum(new int[][] {{1, 2, 3}, {4, 5, 6}}, 0);", "5"), ("return GridTools.columnSum(new int[][] {{1, 2, 3}, {4, 5, 6}}, 2);", "9"), ("return GridTools.columnSum(new int[][] {{7, 8}}, 1);", "8")],
     "traverse one column of a 2D array", "The row index must vary while the column index stays fixed at c.", "each candidate compiled and run on a non-square array")
_add("cs_2d_swap_rows", "4.13",
     "class GridTools {\n    /** Swaps row r1 and row r2 of m. */\n    public static void swapRows(int[][] m, int r1, int r2) {\n/*BODY*/\n    }\n}",
     "The method swapRows is intended to swap row r1 and row r2 of the two-dimensional array m. Which of the following can replace /* missing code */ so that swapRows works as intended?",
     [("int[] temp = m[r1];\nm[r1] = m[r2];\nm[r2] = temp;", True, None),
      ("m[r1] = m[r2];\nm[r2] = m[r1];", False, "Both rows end up referring to the old row r2; the old row r1 is lost."),
      ("int t = m[r1][0];\nm[r1][0] = m[r2][0];\nm[r2][0] = t;", False, "Swaps only the first elements of the two rows."),
      ("for (int c = 0; c < m[r1].length; c++) {\n    m[r1][c] = m[r2][c];\n}", False, "Copies row r2 into row r1 but never copies row r1 into row r2.")],
     [("int[][] m = {{1, 2}, {3, 4}, {5, 6}}; GridTools.swapRows(m, 0, 2); return m[0][0] + \" \" + m[0][1] + \" \" + m[2][0] + \" \" + m[2][1];", "5 6 1 2"), ("int[][] m = {{1, 2}, {3, 4}, {5, 6}}; GridTools.swapRows(m, 0, 1); return m[0][0] + \" \" + m[0][1] + \" \" + m[1][0] + \" \" + m[1][1];", "3 4 1 2"), ("int[][] m = {{1, 2}, {3, 4}}; GridTools.swapRows(m, 1, 1); return m[1][0] + \" \" + m[1][1];", "3 4")],
     "swap two rows (array references) of a 2D array", "A 2D array holds row references, so swapping the references with a temporary variable swaps the rows.", "each candidate compiled and run for different and identical rows")
_add("cs_2d_largest", "4.12",
     "class GridTools {\n    /** Returns the largest value in g. Assume g has at least one row and one column. */\n    public static int largest(int[][] g) {\n        int best = g[0][0];\n/*BODY*/\n        return best;\n    }\n}",
     "The method largest is intended to return the largest value in the two-dimensional array g. Which of the following can replace /* missing code */ so that largest works as intended?",
     [("for (int r = 0; r < g.length; r++) {\n    for (int c = 0; c < g[r].length; c++) {\n        if (g[r][c] > best) {\n            best = g[r][c];\n        }\n    }\n}", True, None),
      ("for (int c = 0; c < g[0].length; c++) {\n    if (g[0][c] > best) {\n        best = g[0][c];\n    }\n}", False, "Examines only the first row."),
      ("for (int r = 0; r < g.length; r++) {\n    for (int c = 0; c < g[r].length; c++) {\n        if (g[r][c] > g[r][0]) {\n            best = g[r][c];\n        }\n    }\n}", False, "Compares each value with the first value of its own row instead of with the best value so far."),
      ("for (int r = 0; r < g.length; r++) {\n    for (int c = 0; c < g[r].length; c++) {\n        if (g[r][c] < best) {\n            best = g[r][c];\n        }\n    }\n}", False, "Finds the smallest value instead of the largest.")],
     [("return GridTools.largest(new int[][] {{1, 9}, {4, 2}});", "9"), ("return GridTools.largest(new int[][] {{-5, -2}, {-9, -7}});", "-2"), ("return GridTools.largest(new int[][] {{3}});", "3"), ("return GridTools.largest(new int[][] {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}});", "9")],
     "find an extreme value with nested loops", "The running maximum must be compared with every element of every row.", "each candidate compiled and run on arrays with negative values and a single cell")
# ---- 탐색·정렬·재귀 ----
_add("cs_binary_search_complete", "4.14",
     "class SearchTools {\n    /** Returns an index of target in the sorted array a, or -1 if target does not appear. */\n    public static int search(int[] a, int target) {\n        int lo = 0;\n        int hi = a.length - 1;\n/*BODY*/\n    }\n}",
     "The method search is intended to use binary search to find target in the sorted array a, and to return an index of target or -1 if it is not found. Which of the following can replace /* missing code */ so that search works as intended?",
     [("while (lo <= hi) {\n    int mid = (lo + hi) / 2;\n    if (a[mid] == target) {\n        return mid;\n    } else if (a[mid] < target) {\n        lo = mid + 1;\n    } else {\n        hi = mid - 1;\n    }\n}\nreturn -1;", True, None),
      ("while (lo < hi) {\n    int mid = (lo + hi) / 2;\n    if (a[mid] == target) {\n        return mid;\n    } else if (a[mid] < target) {\n        lo = mid + 1;\n    } else {\n        hi = mid - 1;\n    }\n}\nreturn -1;", False, "The condition lo < hi stops before examining the last remaining position."),
      ("while (lo <= hi) {\n    int mid = (lo + hi) / 2;\n    if (a[mid] == target) {\n        return mid;\n    } else if (a[mid] < target) {\n        hi = mid - 1;\n    } else {\n        lo = mid + 1;\n    }\n}\nreturn -1;", False, "Moves the search in the wrong direction after each comparison."),
      ("while (lo <= hi) {\n    int mid = (lo + hi) / 2;\n    if (a[mid] == target) {\n        return mid;\n    } else if (a[mid] < target) {\n        lo = mid + 1;\n    } else {\n        hi = mid - 1;\n    }\n}\nreturn lo;", False, "Returns lo when the target is missing instead of -1.")],
     [("return SearchTools.search(new int[] {2, 4, 6, 8, 10}, 6);", "2"), ("return SearchTools.search(new int[] {2, 4, 6, 8, 10}, 10);", "4"), ("return SearchTools.search(new int[] {2, 4, 6, 8, 10}, 2);", "0"), ("return SearchTools.search(new int[] {2, 4, 6, 8, 10}, 5);", "-1"), ("return SearchTools.search(new int[] {}, 3);", "-1")],
     "complete the loop of a binary search", "The loop must continue while lo <= hi, narrow in the right direction, and return -1 when the range is empty.", "each candidate compiled and run for found, boundary and missing targets and an empty array")
_add("cs_selection_min_index", "4.15",
     "class SortTools {\n    /** Returns the index of the first occurrence of the smallest value in a from index from to the end of a. Assume 0 <= from < a.length. */\n    public static int indexOfMin(int[] a, int from) {\n        int idx = from;\n/*BODY*/\n        return idx;\n    }\n}",
     "The method indexOfMin is intended to return the index of the first occurrence of the smallest value in the part of the array a that begins at index from. Which of the following can replace /* missing code */ so that indexOfMin works as intended?",
     [("for (int i = from + 1; i < a.length; i++) {\n    if (a[i] < a[idx]) {\n        idx = i;\n    }\n}", True, None),
      ("for (int i = from + 1; i < a.length; i++) {\n    if (a[i] <= a[idx]) {\n        idx = i;\n    }\n}", False, "Using <= moves idx to a later equal value, so it returns the last occurrence of the smallest value."),
      ("for (int i = 0; i < a.length; i++) {\n    if (a[i] < a[idx]) {\n        idx = i;\n    }\n}", False, "Starts at index 0 and so can return an index before from."),
      ("for (int i = from + 1; i < a.length; i++) {\n    if (a[i] < a[idx]) {\n        idx = a[i];\n    }\n}", False, "Stores the value a[i] in idx instead of the index i.")],
     [("return SortTools.indexOfMin(new int[] {5, 3, 8, 3}, 0);", "1"), ("return SortTools.indexOfMin(new int[] {5, 3, 8, 3}, 2);", "3"), ("return SortTools.indexOfMin(new int[] {4}, 0);", "0"), ("return SortTools.indexOfMin(new int[] {1, 6, 9, 7}, 1);", "1")],
     "find the index of the minimum from a starting position (selection sort step)", "The scan must begin at from + 1, compare with a[idx], and record the index i on a strict improvement.", "each candidate compiled and run with ties and different starting positions")
_add("cs_recursion_sum_digits", "4.16",
     "class Rec {\n    /** Returns the sum of the digits of n, where n is a non-negative integer. */\n    public static int sumDigits(int n) {\n/*BODY*/\n    }\n}",
     "The method sumDigits is intended to return the sum of the digits of the non-negative integer n. Which of the following can replace /* missing code */ so that sumDigits works as intended?",
     [("if (n < 10) {\n    return n;\n}\nreturn n % 10 + sumDigits(n / 10);", True, None),
      ("if (n == 0) {\n    return 1;\n}\nreturn n % 10 + sumDigits(n / 10);", False, "The base case returns 1 for 0, which adds an extra 1 to every result."),
      ("if (n < 10) {\n    return n;\n}\nreturn n % 10 * sumDigits(n / 10);", False, "Multiplies instead of adding."),
      ("if (n < 10) {\n    return n;\n}\nreturn n / 10 + sumDigits(n % 10);", False, "Swaps the roles of the last digit and the remaining digits.")],
     [("return Rec.sumDigits(5);", "5"), ("return Rec.sumDigits(123);", "6"), ("return Rec.sumDigits(1000);", "1"), ("return Rec.sumDigits(99);", "18"), ("return Rec.sumDigits(0);", "0")],
     "recursion on the digits of an integer", "The last digit n % 10 is added to the sum of the remaining digits n / 10, with a base case for one digit.", "each candidate compiled and run on one-digit, zero-containing and repeated-digit numbers")
_add("cs_recursion_count_char", "4.16",
     "class Rec {\n    /** Returns the number of times the character c appears in s. */\n    public static int countChar(String s, char c) {\n/*BODY*/\n    }\n}",
     "The method countChar is intended to return the number of times the character c appears in the String s. Which of the following can replace /* missing code */ so that countChar works as intended?",
     [("if (s.length() == 0) {\n    return 0;\n}\nint rest = countChar(s.substring(1), c);\nif (s.charAt(0) == c) {\n    return rest + 1;\n}\nreturn rest;", True, None),
      ("if (s.length() == 0) {\n    return 1;\n}\nint rest = countChar(s.substring(1), c);\nif (s.charAt(0) == c) {\n    return rest + 1;\n}\nreturn rest;", False, "The base case returns 1, which adds an extra count to every result."),
      ("if (s.length() == 0) {\n    return 0;\n}\nint rest = countChar(s.substring(1), c);\nif (s.charAt(0) == c) {\n    return rest;\n}\nreturn rest;", False, "Never adds 1 when the first character matches."),
      ("if (s.length() == 0) {\n    return 0;\n}\nif (s.charAt(0) == c) {\n    return 1;\n}\nreturn countChar(s.substring(1), c);", False, "Returns 1 at the first match instead of counting all matches.")],
     [("return Rec.countChar(\"banana\", 'a');", "3"), ("return Rec.countChar(\"\", 'a');", "0"), ("return Rec.countChar(\"xyz\", 'a');", "0"), ("return Rec.countChar(\"aaa\", 'a');", "3")],
     "recursion on a String with a count", "The recursive call counts the rest of the String, and 1 is added only when the first character matches.", "each candidate compiled and run on empty, repeated and absent characters")
# ---- ArrayList 추가 ----
_add("cs_list_replace_all", "4.10",
     "class ListTools {\n    /** Replaces every element of list that equals oldS with newS, keeping the positions of all elements. */\n    public static void replaceAll(ArrayList<String> list, String oldS, String newS) {\n/*BODY*/\n    }\n}",
     "The method replaceAll is intended to replace every element of the ArrayList list that is equal to oldS with newS while keeping all positions. Which of the following can replace /* missing code */ so that replaceAll works as intended?",
     [("for (int i = 0; i < list.size(); i++) {\n    if (list.get(i).equals(oldS)) {\n        list.set(i, newS);\n    }\n}", True, None),
      ("for (int i = 0; i < list.size(); i++) {\n    if (list.get(i) == oldS) {\n        list.set(i, newS);\n    }\n}", False, "Compares String references with ==, so equal Strings built at run time are not replaced."),
      ("for (int i = 0; i < list.size(); i++) {\n    if (list.get(i).equals(oldS)) {\n        list.add(newS);\n    }\n}", False, "Appends newS instead of replacing the element, so the list grows."),
      ("for (int i = 0; i < list.size(); i++) {\n    if (list.get(i).equals(oldS)) {\n        list.remove(i);\n        list.add(newS);\n    }\n}", False, "Moves the replacement to the end and skips the element after each removal.")],
     [("ArrayList<String> L = new ArrayList<String>(); L.add(new String(\"go\")); L.add(\"stay\"); L.add(\"go\"); ListTools.replaceAll(L, \"go\", \"stop\"); return L;", "[stop, stay, stop]"), ("ArrayList<String> L = new ArrayList<String>(); L.add(\"a\"); L.add(\"b\"); ListTools.replaceAll(L, \"z\", \"y\"); return L;", "[a, b]"), ("ArrayList<String> L = new ArrayList<String>(); L.add(\"x\"); L.add(\"x\"); L.add(\"x\"); ListTools.replaceAll(L, \"x\", \"w\"); return L;", "[w, w, w]")],
     "replace elements of an ArrayList in place using equals", "String values are compared with equals, and set(i, newS) replaces the element at the same position.", "each candidate compiled and run with run-time created Strings and adjacent matches")
_add("cs_list_remove_min", "4.10",
     "class ListTools {\n    /** Removes the first occurrence of the smallest value in list. Assume list is not empty. */\n    public static void removeMin(ArrayList<Integer> list) {\n/*BODY*/\n    }\n}",
     "The method removeMin is intended to remove only the first occurrence of the smallest value in the non-empty ArrayList list. Which of the following can replace /* missing code */ so that removeMin works as intended?",
     [("int idx = 0;\nfor (int i = 1; i < list.size(); i++) {\n    if (list.get(i) < list.get(idx)) {\n        idx = i;\n    }\n}\nlist.remove(idx);", True, None),
      ("int min = list.get(0);\nfor (int i = 1; i < list.size(); i++) {\n    if (list.get(i) < min) {\n        min = list.get(i);\n    }\n}\nlist.remove(min);", False, "list.remove(min) with an int argument removes the element at index min, not the value min."),
      ("int idx = 0;\nfor (int i = 1; i < list.size(); i++) {\n    if (list.get(i) <= list.get(idx)) {\n        idx = i;\n    }\n}\nlist.remove(idx);", False, "Using <= selects the last occurrence of the smallest value instead of the first."),
      ("int idx = 0;\nfor (int i = 1; i < list.size(); i++) {\n    if (list.get(i) > list.get(idx)) {\n        idx = i;\n    }\n}\nlist.remove(idx);", False, "Removes the largest value instead of the smallest.")],
     [("ArrayList<Integer> L = new ArrayList<Integer>(); L.add(5); L.add(2); L.add(8); L.add(2); ListTools.removeMin(L); return L;", "[5, 8, 2]"), ("ArrayList<Integer> L = new ArrayList<Integer>(); L.add(4); L.add(6); L.add(2); ListTools.removeMin(L); return L;", "[4, 6]"), ("ArrayList<Integer> L = new ArrayList<Integer>(); L.add(7); ListTools.removeMin(L); return L;", "[]")],
     "remove an element by index instead of by value", "Tracking the index of the first smallest value and calling remove(idx) removes exactly that element.", "each candidate compiled and run where the smallest value differs from its index")
_add("cs_list_move_to_front", "4.10",
     "class ListTools {\n    /** If s is in list, moves its first occurrence to the front of list. Otherwise list is unchanged. */\n    public static void moveToFront(ArrayList<String> list, String s) {\n/*BODY*/\n    }\n}",
     "The method moveToFront is intended to move the first occurrence of s to the front of the ArrayList list, and to leave list unchanged if s is not in list. Which of the following can replace /* missing code */ so that moveToFront works as intended?",
     [("if (list.contains(s)) {\n    list.remove(s);\n    list.add(0, s);\n}", True, None),
      ("list.add(0, s);\nlist.remove(s);", False, "Adds a copy at the front and then removes that same copy, so the list never changes."),
      ("list.remove(s);\nlist.add(s);", False, "Moves the element to the end instead of the front and adds s when it was not in the list."),
      ("int i = list.indexOf(s);\nlist.remove(i);\nlist.add(0, s);", False, "Does not check whether s was found, so a missing s causes an exception.")],
     [("ArrayList<String> L = new ArrayList<String>(); L.add(\"a\"); L.add(\"b\"); L.add(\"c\"); ListTools.moveToFront(L, \"c\"); return L;", "[c, a, b]"), ("ArrayList<String> L = new ArrayList<String>(); L.add(\"a\"); L.add(\"b\"); L.add(\"c\"); ListTools.moveToFront(L, \"z\"); return L;", "[a, b, c]"), ("ArrayList<String> L = new ArrayList<String>(); L.add(\"b\"); L.add(\"a\"); L.add(\"b\"); ListTools.moveToFront(L, \"a\"); return L;", "[a, b, b]")],
     "reorder an ArrayList with indexOf, remove and add", "indexOf locates the first occurrence, remove deletes it, and add(0, s) puts it in front, with a guard for a missing value.", "each candidate compiled and run for a found value, a missing value and a repeated value")
_add("cs_array_max_jump", "4.4",
     "class ArrTools {\n    /** Returns the largest absolute difference between two adjacent values in a. Returns 0 if a has fewer than two values. */\n    public static int maxJump(int[] a) {\n        int best = 0;\n/*BODY*/\n        return best;\n    }\n}",
     "The method maxJump is intended to return the largest absolute difference between two adjacent values in the array a, or 0 if a has fewer than two values. Which of the following can replace /* missing code */ so that maxJump works as intended?",
     [("for (int i = 1; i < a.length; i++) {\n    int d = Math.abs(a[i] - a[i - 1]);\n    if (d > best) {\n        best = d;\n    }\n}", True, None),
      ("for (int i = 1; i < a.length; i++) {\n    int d = a[i] - a[i - 1];\n    if (d > best) {\n        best = d;\n    }\n}", False, "Does not use the absolute value, so a drop between adjacent values is ignored."),
      ("for (int i = 1; i < a.length; i++) {\n    int d = Math.abs(a[i] - a[0]);\n    if (d > best) {\n        best = d;\n    }\n}", False, "Compares every value with the first value instead of with its neighbor."),
      ("for (int i = 1; i < a.length; i++) {\n    best += Math.abs(a[i] - a[i - 1]);\n}", False, "Adds all of the differences instead of keeping the largest.")],
     [("return ArrTools.maxJump(new int[] {1, 5, 2, 9});", "7"), ("return ArrTools.maxJump(new int[] {4, 4});", "0"), ("return ArrTools.maxJump(new int[] {9, 3});", "6"), ("return ArrTools.maxJump(new int[] {5});", "0"), ("return ArrTools.maxJump(new int[] {2, 6, 3, 4});", "4")],
     "compare adjacent array elements with an absolute difference", "Math.abs of each adjacent difference is compared with the best value so far.", "each candidate compiled and run with decreasing values and short arrays")
_add("cs_string_array_longest", "4.6",
     "class WordTools {\n    /** Returns the longest String in words. If several are longest, returns the first of them. Assume words has at least one element. */\n    public static String longest(String[] words) {\n        String best = words[0];\n/*BODY*/\n        return best;\n    }\n}",
     "The method longest is intended to return the longest String in the array words, and the first of them if there is a tie. Which of the following can replace /* missing code */ so that longest works as intended?",
     [("for (String w : words) {\n    if (w.length() > best.length()) {\n        best = w;\n    }\n}", True, None),
      ("for (String w : words) {\n    if (w.length() >= best.length()) {\n        best = w;\n    }\n}", False, "Using >= replaces the first longest String with a later String of equal length."),
      ("for (String w : words) {\n    if (w.compareTo(best) > 0) {\n        best = w;\n    }\n}", False, "Compares Strings alphabetically instead of by length."),
      ("for (String w : words) {\n    if (w.length() < best.length()) {\n        best = w;\n    }\n}", False, "Finds the shortest String instead of the longest.")],
     [("return WordTools.longest(new String[] {\"cat\", \"horse\", \"dog\"});", "horse"), ("return WordTools.longest(new String[] {\"ab\", \"cd\"});", "ab"), ("return WordTools.longest(new String[] {\"b\", \"apple\", \"grape\"});", "apple"), ("return WordTools.longest(new String[] {\"zz\"});", "zz")],
     "find the longest String with strict comparison", "A strict comparison of lengths keeps the first longest String when there is a tie.", "each candidate compiled and run with ties and alphabetical order differing from length order")
_add("cs_array_double_all", "4.4",
     "class ArrTools {\n    /** Doubles every value in a. */\n    public static void doubleAll(int[] a) {\n/*BODY*/\n    }\n}",
     "The method doubleAll is intended to double every value stored in the array a. Which of the following can replace /* missing code */ so that doubleAll works as intended?",
     [("for (int i = 0; i < a.length; i++) {\n    a[i] = a[i] * 2;\n}", True, None),
      ("for (int v : a) {\n    v = v * 2;\n}", False, "Changing the enhanced for loop variable changes only a copy, not the array element."),
      ("for (int i = 0; i < a.length; i++) {\n    a[i] = 2;\n}", False, "Stores 2 in every position instead of doubling each value."),
      ("for (int i = 0; i < a.length - 1; i++) {\n    a[i] = a[i] * 2;\n}", False, "Stops one position early, so the last value is not doubled.")],
     [("int[] a = {1, 2, 3}; ArrTools.doubleAll(a); return a[0] + \" \" + a[1] + \" \" + a[2];", "2 4 6"), ("int[] a = {5}; ArrTools.doubleAll(a); return \"\" + a[0];", "10"), ("int[] a = {0, 4}; ArrTools.doubleAll(a); return a[0] + \" \" + a[1];", "0 8")],
     "modify array elements with an indexed loop", "Only an indexed loop can assign new values to the array elements.", "each candidate compiled and run on arrays of length 1 to 3")
