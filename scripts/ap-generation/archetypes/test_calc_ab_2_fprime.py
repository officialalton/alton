"""calc_ab_2.fprime_graph_statements 회귀 테스트(2026-10-13 외부 감사 A-01~03). 무료·결정적. `python -m unittest test_calc_ab_2_fprime` (archetypes 폴더에서).
결함: f' 의 증가 구간 (lo,hi) 을 부호 변화점과 무관하게 뽑아 "f' 가 r1 에서 0 → (r1,r2) 에서 음수인데 r1 을 품는 구간에서 증가"라는 모순 전제(존재하지 않는 함수)가 나왔다."""
import random, re, unittest
import calc_ab_2 as G

STEM = re.compile(r"positive on \$\(0,(\d+)\)\$, negative on \$\((\d+),(\d+)\)\$ and positive on \$\((\d+),9\)\$\. Also, \$f'\$ is increasing on \$\((\d+),(\d+)\)\$")


class FprimeGraphStatements(unittest.TestCase):
    def parse(self, seed):
        p = G.fprime_graph_statements(random.Random(seed))
        m = STEM.search(p["stem"])
        self.assertIsNotNone(m, p["stem"])
        r1, r1b, r2, r2b, lo, hi = map(int, m.groups())
        self.assertEqual((r1, r2), (r1b, r2b))
        return p, r1, r2, lo, hi

    def test_increasing_interval_never_contains_the_sign_change_points(self):
        for seed in range(3000):
            _p, r1, r2, lo, hi = self.parse(seed)
            # f' 는 r1 에서 0 이고 바로 뒤에서 음수 -> r1 을 품는(또는 r1 에서 시작하는) 구간에서는 증가할 수 없다. 증가 구간은 음수에서 0 으로 올라오는 (r1, r2] 안.
            self.assertTrue(r1 < lo < hi <= r2, f"seed {seed}: r1={r1} r2={r2} lo={lo} hi={hi}")

    def test_old_defect_shape_is_not_reachable(self):
        # 감사 사례: 증가 구간이 r1 을 품는다(lo <= r1 < hi). 수천 시드에서 한 번도 나오면 안 된다.
        for seed in range(3000):
            _p, r1, _r2, lo, hi = self.parse(seed)
            self.assertFalse(lo <= r1 < hi, f"seed {seed}")

    def test_still_one_key_and_four_options(self):
        for seed in range(200):
            p, *_ = self.parse(seed)
            self.assertEqual(len(p["options"]), 4)
            self.assertEqual(sum(1 for i in range(4) if i == p["key_index"]), 1)
            self.assertIn("concave up", p["options"][p["key_index"]]["text"])


if __name__ == "__main__":
    unittest.main()
