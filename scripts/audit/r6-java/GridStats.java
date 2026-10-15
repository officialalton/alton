public class GridStats {
    public static int bestRow(int[][] grid) {
        int best = 0;
        int bestSum = 0;
        for (int r = 0; r < grid.length; r++) {
            int sum = 0;
            for (int c = 0; c < grid[r].length; c++) {
                sum += grid[r][c];
            }
            if (r == 0 || sum > bestSum) {
                bestSum = sum;
                best = r;
            }
        }
        return best;
    }
    public static int oldRow(int[][] grid) {
        int best = 0; int bestSum = -1000000;
        for (int r = 0; r < grid.length; r++) { int sum = 0; for (int c = 0; c < grid[r].length; c++) sum += grid[r][c]; if (sum > bestSum) { bestSum = sum; best = r; } }
        return best;
    }
    static int oracle(int[][] g) { long bs = Long.MIN_VALUE; int b = -1; for (int r = 0; r < g.length; r++) { long s = 0; for (int x : g[r]) s += x; if (s > bs) { bs = s; b = r; } } return b; }
    static void chk(int[][] g, int exp, String name) { int got = bestRow(g); if (got != exp) throw new AssertionError(name + " got " + got + " exp " + exp); System.out.println("ok " + name + " -> " + got + " (old: " + oldRow(g) + ")"); }
    public static void main(String[] a) {
        chk(new int[][]{{1,2},{5,0},{3,2}}, 1, "spec example (tie 5,5)");
        chk(new int[][]{{-2000000},{-1500000}}, 1, "large negatives");
        chk(new int[][]{{-5},{-3},{-3},{-9}}, 1, "negative tie smallest index");
        chk(new int[][]{{-7}}, 0, "single negative row");
        chk(new int[][]{{4,4},{4,4},{4,3}}, 0, "all-tie first");
        chk(new int[][]{{-1,-1},{-1,-1}}, 0, "equal negative");
        chk(new int[][]{{0},{0}}, 0, "zeros");
        java.util.Random rnd = new java.util.Random(7); int bad = 0, oldBad = 0;
        for (int t = 0; t < 200000; t++) { int R = 1 + rnd.nextInt(6), C = 1 + rnd.nextInt(5); int[][] g = new int[R][C]; int mag = rnd.nextBoolean() ? 5 : 2000000; for (int[] row : g) for (int c = 0; c < C; c++) row[c] = rnd.nextInt(2 * mag + 1) - mag; // sums stay within int
            int e = oracle(g); if (bestRow(g) != e) bad++; if (oldRow(g) != e) oldBad++; }
        System.out.println("random mismatches new=" + bad + " old=" + oldBad);
        if (bad != 0) throw new AssertionError();
    }
}
