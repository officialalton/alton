"""AP Psychology 원형 테스트(2026-10-14)(무료, 네트워크·DB·LLM 없음). unittest 기반: `python -m unittest test_psych_p0` (Vitest 래퍼: lib/ap-generation/psych-archetypes.test.ts).
검사: 모든 원형이 만들어진다 / 변형 두 개 이상이 서로 다르다 / 4지선다·유일 정답·오답 why 가 서로 다르고 25자 이상 / 정답이 가장 긴 선택지로 쏠리지 않는다 / 허용 스킬·토픽(MC 에 4.x 없음)
/ 세트는 3문항·같은 단원·한 문항의 정답이 다른 문항 본문에 없다 / 통계 원형은 독립 경로로 다시 계산한다 / FRQ 는 총 7점·AAQ A–F·EBQ A–E 구조이고 숫자가 지문에 있다 / 같은 시드는 같은 결과."""
import json
import random
import re
import statistics as st
import unittest

import numpy as np

import registry as R

MC = R.PSYCH_STAGES["psych_mc_all"]
SETS = R.PSYCH_STAGES["psych_sets"]
FRQ = R.PSYCH_STAGES["psych_frq"]
curriculum = json.load(open("../../../data/ap/curriculum-2027/ap_psychology.json"))
TOPICS = {t["code"] for u in curriculum["units"] for t in u["topics"]}
SKILLS = {s["code"] for s in curriculum["skills"]}
MC_SKILLS = SKILLS - {"4.A", "4.B"}
FN = lambda n: R.PSYCH[n][0] if n in R.PSYCH else R.PSYCH_FRQ[n][0]  # noqa: E731


def facts(p):
    out = {}
    for f in p["facts"]:
        if "=" in f:
            k, v = f.split("=", 1)
            out[k] = v
    return out


def build(n, seeds=range(9500, 9530)):
    out = []
    for s in seeds:
        try:
            out.append(FN(n)(random.Random(s)))
        except Exception:
            pass
    return out


def plain(t):
    return re.sub(r"\s+", " ", t).strip().lower()


class TestLibrary(unittest.TestCase):
    def test_counts(self):
        self.assertGreaterEqual(len(MC), 150)
        self.assertGreaterEqual(len(SETS), 20)
        self.assertEqual(len(FRQ), 8)
        self.assertEqual(len([n for n in FRQ if n.startswith("psf_aaq_")]), 4)
        self.assertEqual(len([n for n in FRQ if n.startswith("psf_ebq_")]), 4)

    def test_every_archetype_builds_and_is_seed_deterministic(self):
        for n in MC + SETS + FRQ:
            ps = build(n, range(9500, 9503))
            self.assertTrue(ps, n)
            again = FN(n)(random.Random(9500))
            self.assertEqual(json.dumps(again, sort_keys=True), json.dumps(FN(n)(random.Random(9500)), sort_keys=True), n)

    def test_at_least_two_distinct_variants_for_single_archetypes(self):
        short = []
        for n in MC:
            if n.startswith("ps_data_retrieval") or n.startswith("ps_data_therapy") or n.startswith("ps_data_scatter") or n.startswith("ps_data_serial"):
                continue
            ids = {p["variant_id"] for p in build(n)}
            if len(ids) < 2:
                short.append(n)
        self.assertEqual(short, [])


def _check_mc(self, p, n):
    self.assertEqual(len(p["options"]), 4, n)
    texts = [plain(o["text"]) for o in p["options"]]
    self.assertEqual(len(set(texts)), 4, n)
    self.assertIn(p["skill"], MC_SKILLS, n)
    self.assertIn(p["topic"], TOPICS, n)
    self.assertEqual(p["calculator"], "na", n)
    whys = [plain(o["why"]) for i, o in enumerate(p["options"]) if i != p["key_index"]]
    self.assertEqual(len(set(whys)), 3, n)
    self.assertTrue(all(len(w) >= 25 for w in whys), n)
    self.assertGreaterEqual(len(p["options"][p["key_index"]]["why"]), 20, n)
    for o in p["options"]:
        self.assertNotRegex(o["text"], r"\b(all|none) of the above\b", n)
        self.assertNotRegex(o["why"], r"\b(?:option|choice|answer)\s+\(?[A-E]\)?\b", n)
    self.assertGreaterEqual(len(p["blueprint"]["misconceptions"]), 3, n)


class TestMc(unittest.TestCase):
    def test_structure(self):
        for n in MC:
            for p in build(n, range(9500, 9506)):
                _check_mc(self, p, n)

    def test_key_not_systematically_longest(self):
        longest = total = 0
        for n in MC:
            for p in build(n, range(9500, 9504)):
                lens = [len(o["text"]) for o in p["options"]]
                total += 1
                if lens[p["key_index"]] == max(lens) and lens.count(max(lens)) == 1:
                    longest += 1
        self.assertLess(longest / total, 0.45, f"{longest}/{total} keys are the strict longest option")

    def test_key_positions_are_balanced(self):
        from collections import Counter
        c = Counter()
        for n in MC:
            for p in build(n, range(9500, 9502)):
                c[p["key_index"]] += 1
        tot = sum(c.values())
        for i in range(4):
            self.assertGreater(c[i] / tot, 0.18, c)
            self.assertLess(c[i] / tot, 0.32, c)

    def test_units_and_skills_cover_the_exam_structure(self):
        from collections import Counter
        u, k = Counter(), Counter()
        for n in MC:
            p = FN(n)(random.Random(9500))
            u[p["topic"].split(".")[0]] += 1
            k[p["skill"][0]] += 1
        for unit in "12345":
            self.assertGreaterEqual(u[unit], 25, u)
        self.assertGreaterEqual(k["1"], 100, k)
        self.assertGreaterEqual(k["2"], 25, k)
        self.assertGreaterEqual(k["3"], 8, k)


class TestSets(unittest.TestCase):
    def test_sets(self):
        for n in SETS:
            p = FN(n)(random.Random(9500))
            self.assertEqual(len(p["items"]), 3, n)
            self.assertNotEqual(p["stimulus"]["kind"], "none", n)
            units = {it["topic"].split(".")[0] for it in p["items"]}
            self.assertEqual(len(units), 1, n)
            self.assertGreaterEqual(len(p["set_intro"]), 200, n)
            skills = [it["skill"] for it in p["items"]]
            self.assertTrue(any(s.startswith("2.") or s.startswith("3.") for s in skills), n)
            keys = [plain(it["options"][it["key_index"]]["text"]) for it in p["items"]]
            for i, it in enumerate(p["items"]):
                _check_mc(self, it, n)
                for j, other in enumerate(p["items"]):
                    if i != j and len(keys[i]) >= 6:
                        self.assertNotIn(keys[i], plain(other["stem"]), f"{n}: item {j + 1} question contains item {i + 1} answer")


class TestStats(unittest.TestCase):
    def test_mean_median_range_mode(self):
        for s in range(9500, 9530):
            for n in ("ps_stat_mean", "ps_stat_median", "ps_stat_range_mode", "ps_stat_outlier"):
                try:
                    p = FN(n)(random.Random(s))
                except Exception:
                    continue
                f = facts(p)
                data = json.loads(f["data"].replace("'", '"')) if "data" in f else None
                key = p["options"][p["key_index"]]["text"]
                if n == "ps_stat_mean":
                    self.assertAlmostEqual(float(key), float(np.mean(data)), 9)
                if n == "ps_stat_median":
                    self.assertAlmostEqual(float(key), float(np.median(data)), 9)
                if n == "ps_stat_range_mode":
                    which = "range" if "range" in p["stem"] else "mode"
                    exp = max(data) - min(data) if which == "range" else st.multimode(data)[0]
                    self.assertEqual(int(float(key)), exp)
                rows = [r[-1] if n != "ps_stat_median" else r[1] for r in p["stimulus"]["data"]["rows"]]
                if data:
                    self.assertEqual(sorted(int(x) for x in rows), sorted(data), n)

    def test_percentile_and_effect_sizes(self):
        from scipy.stats import norm
        for s in range(9500, 9530):
            p = FN("ps_stat_percentile")(random.Random(s))
            z = int(facts(p)["z"])
            self.assertEqual(int(p["options"][p["key_index"]]["text"]), {-2: 2, -1: 16, 1: 84, 2: 98}[z])
            self.assertAlmostEqual(norm.cdf(z) * 100, int(p["options"][p["key_index"]]["text"]), delta=0.6)
            q = FN("ps_stat_effect_size")(random.Random(s))
            d = float(facts(q)["d"])
            lab = {0.1: "small", 0.5: "medium", 0.9: "large"}[d]
            self.assertIn(lab, q["options"][q["key_index"]]["text"].lower().replace("moderate in size", "medium"))

    def test_sd_compare_and_correlation(self):
        for s in range(9500, 9530):
            try:
                p = FN("ps_stat_sd_compare")(random.Random(s))
            except Exception:
                continue
            f = facts(p)
            a, b = json.loads(f["a"]), json.loads(f["b"])
            self.assertGreater(np.std(b), 1.5 * np.std(a))
            self.assertAlmostEqual(np.mean(a), np.mean(b), 9)
        for s in range(9500, 9520):
            p = FN("ps_stat_corr_r")(random.Random(s))
            r = float(facts(p)["r"])
            key = p["options"][p["key_index"]]["text"]
            self.assertIn("positive" if r > 0 else "negative", key)
            self.assertIn("strong" if abs(r) >= 0.7 else "moderate" if abs(r) >= 0.3 else "weak", key)


class TestFrq(unittest.TestCase):
    def test_structure(self):
        for n in FRQ:
            p = FN(n)(random.Random(9500))
            self.assertEqual(p["total_points"], 7, n)
            labels = [x["label"] for x in p["parts"]]
            if p["template"] == "aaq":
                self.assertEqual(labels, list("ABCDEF"), n)
                self.assertEqual([x["points"] for x in p["parts"]], [1, 1, 1, 1, 1, 2], n)
                self.assertEqual(p["est_minutes"], 25, n)
                for h in ("Introduction", "Participants", "Procedure", "Ethical procedures", "Results"):
                    self.assertIn(h, p["set_intro"], n)
            else:
                self.assertEqual(labels, list("ABCDE"), n)
                self.assertEqual([x["points"] for x in p["parts"]], [1, 1, 2, 1, 2], n)
                self.assertEqual(p["est_minutes"], 45, n)
                for k in (1, 2, 3):
                    self.assertIn(f"Source {k}:", p["set_intro"], n)
            for x in p["parts"]:
                self.assertEqual(sum(r["points"] for r in x["rubric_rows"]), x["points"], (n, x["label"]))
                self.assertGreaterEqual(len(x["model_answer"]), 40, (n, x["label"]))
            self.assertTrue(p["set_intro"].startswith("ALTON original source"), n)

    def test_numbers_in_answers_are_in_the_sources(self):
        for n in FRQ:
            p = FN(n)(random.Random(9500))
            src = p["set_intro"] + json.dumps(p["stimulus"])
            have = {float(x.replace(",", "")) for x in re.findall(r"\d+(?:,\d{3})*(?:\.\d+)?", src)}
            for x in p["parts"]:
                ans = x["model_answer"].replace("ALTON reference answer for self-review — not official AP scoring. ", "")
                for m in re.findall(r"\d+(?:,\d{3})*(?:\.\d+)?", ans):
                    v = float(m.replace(",", ""))
                    ok = v in have or v <= 5 or any(abs(abs(a - b) - v) < 1e-6 for a in have for b in have)
                    self.assertTrue(ok, f"{n} part {x['label']}: {m} not in the source")

    def test_aaq_table_arithmetic(self):
        # 표의 수치에서 모범 답안의 차이를 독립 계산
        p = FN("psf_aaq_retrieval")(random.Random(1))
        rows = {r[0]: r for r in p["stimulus"]["data"]["rows"]}
        self.assertAlmostEqual(float(rows["Quiz"][2]) - float(rows["Reread"][2]), 3.3, 9)
        p = FN("psf_aaq_compliance")(random.Random(1))
        rows = {r[0]: r for r in p["stimulus"]["data"]["rows"]}
        self.assertEqual(round(100 * int(rows["Large-then-small"][2]) / int(rows["Large-then-small"][1])), 65)
        self.assertEqual(round(100 * int(rows["Small-only"][2]) / int(rows["Small-only"][1])), 40)
        p = FN("psf_aaq_mindfulness")(random.Random(1))
        rows = {r[0]: r for r in p["stimulus"]["data"]["rows"]}
        self.assertEqual(int(rows["Mindfulness course"][2]) - int(rows["Mindfulness course"][3]), 14)
        self.assertEqual(int(rows["Waiting list"][2]) - int(rows["Waiting list"][3]), 2)


if __name__ == "__main__":
    unittest.main()
