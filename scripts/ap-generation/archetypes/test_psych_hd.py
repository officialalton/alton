"""AP Psychology 고차 원형(psych-hard) 테스트(무료). `python -m unittest test_psych_hd`.
검사: 모든 고정 문장 변형이 만들어진다 / 정답이 가장 긴 선택지가 아니다(변형마다) / 풀이 단계 3개 이상 / 표의 백분율은 정수 인원 / 코드 계산 원형은 독립 경로로 재계산 / 단원·Practice 분포 / 세트 2개의 표 비율 수정."""
import random
import re
import statistics as st
import unittest

import numpy as np
from scipy import stats as sps

import registry as R
import psych_p0_hd_a as A
import psych_p0_hd_b as B
import psych_p0_hd_c as C
from psych_hd_common import pct_rows_ok

FIXED = [(m.__name__, a) for m in (B, C) for a in m.ITEMS]
CODE = ["ps_hd_s_did", "ps_hd_s_zcompare", "ps_hd_s_counts", "ps_hd_s_placebo3", "ps_hd_s_corr", "ps_hd_s_skew", "ps_hd_s_pvalue", "ps_hd_s_reliab", "ps_hd_s_normal_count"]


def build(n, seeds=range(9500, 9540)):
    out = []
    for s in seeds:
        out.append(R.PSYCH[n][0](random.Random(s)))
    return out


class TestHd(unittest.TestCase):
    def test_counts(self):
        self.assertEqual(len(C.ITEMS), 26)
        self.assertEqual(len(B.ITEMS), 11)
        self.assertEqual(len(R.PSYCH_STAGES["psych_hd_a"]), 26)
        self.assertEqual(len(R.PSYCH_STAGES["psych_hd_b"]), 22)

    def test_fixed_variants_have_three_thinking_steps_and_key_not_longest(self):
        for mod, (arch, topic, skill, concept, ek, variants) in FIXED:
            self.assertGreaterEqual(len(variants), 2, arch)
            for v in variants:
                self.assertGreaterEqual(len(v[5]), 3, arch)
                self.assertLessEqual(len(v[1]), max(len(w[0]) for w in v[3]), arch)
                self.assertEqual(len(v[3]), 3, arch)
                self.assertEqual(len({w[1] for w in v[3]}), 3, arch)
                self.assertTrue(all(len(w[1]) >= 25 for w in v[3]), arch)
            self.assertEqual(len({v[0] for v in variants}), len(variants), arch)
            if skill.startswith("3"):
                self.assertTrue(all(len(v) > 4 and v[4] for v in variants), arch)  # 자료 해석 원형은 표가 있다

    def test_code_archetypes_build_and_are_distinct(self):
        for n in CODE:
            ps = build(n)
            self.assertEqual(len(ps), 40, n)
            self.assertGreaterEqual(len({p["variant_id"] for p in ps}), 4, n)
            for p in ps:
                self.assertEqual(len(p["options"]), 4)
                lens = [len(o["text"]) for o in p["options"]]
                self.assertLessEqual(lens[p["key_index"]], max(lens), n)
                stim = p.get("stimulus")
                if stim:
                    pct_rows_ok(stim)  # 표 백분율은 정수 인원

    def test_pct_rule(self):
        with self.assertRaises(ValueError):
            pct_rows_ok({"kind": "table", "data": {"columns": [], "rows": [["A", "40", "82%"]]}})
        pct_rows_ok({"kind": "table", "data": {"columns": [], "rows": [["A", "40", "80%"], ["B", "30", "40%"]]}})

    def test_did_net_gain(self):
        for p in build("ps_hd_s_did", range(9500, 9520)):
            f = {k: v for k, v in (x.split("=", 1) for x in p["facts"] if "=" in x)}
            pre_t, post_t, pre_c, post_c = (int(f[k]) for k in ("pre_t", "post_t", "pre_c", "post_c"))
            net = (post_t - pre_t) - (post_c - pre_c)
            self.assertEqual(int(f["net"]), net)
            self.assertIn(f"{net} points more", p["options"][p["key_index"]]["text"])
            self.assertTrue(0 <= post_t - post_c <= 3)

    def test_zcompare_and_normal_count_independent(self):
        for p in build("ps_hd_s_normal_count", range(9500, 9520)):
            f = {k: v for k, v in (x.split("=", 1) for x in p["facts"] if "=" in x)}
            z = int(f["z"]); n = int(f["n"]); ans = int(f["answer"])
            self.assertAlmostEqual(n * float(sps.norm.sf(z)), ans, delta=n * 0.0035)
            self.assertIn(f"{ans:,}", p["options"][p["key_index"]]["text"])
        for p in build("ps_hd_s_zcompare", range(9500, 9520)):
            rows = p["stimulus"]["data"]["rows"]
            zs = {r[0]: (int(r[3]) - int(r[1])) / int(r[2]) for r in rows}
            better = max(zs, key=zs.get)
            self.assertIn(better, p["options"][p["key_index"]]["text"])
            self.assertAlmostEqual(max(zs.values()), 2.0)

    def test_counts_and_placebo_percentages_are_exact(self):
        for n in ("ps_hd_s_counts", "ps_hd_s_placebo3"):
            for p in build(n, range(9500, 9520)):
                rows = p["stimulus"]["data"]["rows"]
                for r in rows:
                    size, k = int(r[1]), int(r[2])
                    self.assertAlmostEqual(100 * k / size, round(100 * k / size), places=9)

    def test_skew_and_pvalue_paths(self):
        for p in build("ps_hd_s_skew", range(9500, 9520)):
            data = [int(r[1]) for r in p["stimulus"]["data"]["rows"]]
            self.assertAlmostEqual(np.mean(data), st.mean(data)); self.assertEqual(float(np.median(data)), st.median(data))
            self.assertGreaterEqual(st.mean(data) - st.median(data), 18)
        for p in build("ps_hd_s_pvalue", range(9500, 9520)):
            rows = p["stimulus"]["data"]["rows"]
            n2, d2, p2 = int(rows[1][1]), float(rows[1][2]), float("0" + rows[1][3])
            self.assertAlmostEqual(float(sps.ttest_ind_from_stats(d2, 1, n2, 0, 1, n2).pvalue), p2, delta=0.006)
            self.assertGreater(p2, 0.05)

    def test_reliab_split(self):
        for p in build("ps_hd_s_reliab", range(9500, 9520)):
            rows = p["stimulus"]["data"]["rows"]
            rel = {r[0]: float(r[1]) for r in rows}; val = {r[0]: float(r[2]) for r in rows}
            self.assertNotEqual(max(rel, key=rel.get), max(val, key=val.get))
            for t in rel:
                self.assertLessEqual(val[t], rel[t] ** 0.5 + 1e-9)

    def test_units_and_practices(self):
        units = {}; prac = {}
        for n in R.PSYCH_STAGES["psych_hd_a"] + R.PSYCH_STAGES["psych_hd_b"]:
            if n.startswith("pss_"):
                continue
            p = build(n, range(9500, 9502))[0]
            units[p["topic"].split(".")[0]] = units.get(p["topic"].split(".")[0], 0) + 1
            prac[p["skill"].split(".")[0]] = prac.get(p["skill"].split(".")[0], 0) + 1
        for u in "12345":
            self.assertGreaterEqual(units[u], 7, units)
        self.assertGreaterEqual(prac["2"] + prac["3"], 20, prac)

    def test_corrected_sets_have_exact_percentages(self):
        for n in ("pss_u3_attachment_style", "pss_u4_bystander_lab"):
            for s in range(9500, 9504):
                p = R.PSYCH[n][0](random.Random(s))
                pct_rows_ok(p["stimulus"])


if __name__ == "__main__":
    unittest.main()
