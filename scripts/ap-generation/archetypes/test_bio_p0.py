"""AP Biology P0 Python 테스트(무료). python -m unittest test_bio_p0 (archetypes 폴더에서)."""
import hashlib
import json
import math
import random
import re
import unittest
from fractions import Fraction

import bio_coverage as C
import registry as R

NAMES = R.BIO_STAGES["bio_mc_all"] + R.BIO_STAGES["bio_sets"]
SEEDS = (0, 1, 2)


def plain(t):
    return re.sub(r"[\\${}^]", "", re.sub(r"\\(mathrm|text)", " ", t)).strip()


def items_of(p):
    return p["items"] if "items" in p else [p]


def packs(name, n=3, seed0=0):
    return R.batch(name, n, seed0)


class TestRegistry(unittest.TestCase):
    def test_library_size_and_prefixes(self):
        self.assertGreaterEqual(len(R.BIO_STAGES["bio_mc_all"]), 160)
        self.assertEqual(len(R.BIO_STAGES["bio_sets"]), 8)
        self.assertGreaterEqual(len(R.BIO_STAGES["bio_frq"]), 24)
        self.assertTrue(all(n.startswith("bi_") for n in R.BIO_STAGES["bio_mc_all"]))
        self.assertTrue(all(n.startswith("bif_") for n in R.BIO_STAGES["bio_frq"]))

    def test_pilot_stages_reference_registered_archetypes(self):
        for k in ("bio_p1_mc", "bio_p1_frq"):
            for n in R.BIO_STAGES[k]:
                self.assertIn(n, R.BIO | R.BIO_FRQ, n)

    def test_deterministic(self):
        for n in NAMES + R.BIO_STAGES["bio_frq"]:
            a = json.dumps(R.batch(n, 2, 11), sort_keys=True)
            b = json.dumps(R.batch(n, 2, 11), sort_keys=True)
            self.assertEqual(a, b, n)

    def test_every_archetype_produces_packs(self):
        for n in NAMES + R.BIO_STAGES["bio_frq"]:
            self.assertTrue(R.batch(n, 1, 0), n)


class TestOptionStructure(unittest.TestCase):
    def test_four_unique_options_named_misconceptions_and_length_cues(self):
        for n in NAMES:
            for p in packs(n, 6, 100):
                for q in items_of(p):
                    texts = [o["text"] for o in q["options"]]
                    self.assertEqual(len(texts), 4, n)
                    self.assertEqual(len(set(texts)), 4, n)
                    ki = q["key_index"]
                    self.assertTrue(0 <= ki < 4)
                    whys = [o["why"] for i, o in enumerate(q["options"]) if i != ki]
                    self.assertTrue(all(len(w.strip()) >= 25 for w in whys), (n, whys))
                    self.assertEqual(len(set(whys)), 3, (n, "wrong options share a rationale"))
                    self.assertTrue(q["options"][ki]["why"].strip(), n)
                    lens = [len(plain(t)) for t in texts]
                    mean = sum(lens) / 4
                    self.assertFalse(lens[ki] == max(lens) and lens[ki] > mean * 1.6 and lens[ki] > 18, (n, texts))
                    self.assertFalse(min(lens) > 0 and max(lens) / min(lens) > 6 and max(lens) > 30, (n, texts))
                    words = len(re.sub(r"\$[^$]*\$", " ", q["stem"]).split())
                    self.assertLessEqual(words, 100, n)
                    self.assertTrue(45 <= q["est_seconds"] <= 130, n)

    def test_skill_and_topic_codes_are_official(self):
        with open("../../../data/ap/curriculum-2027/ap_biology.json") as fh:
            cur = json.load(fh)
        skills = {s["code"] for s in cur["skills"]}
        topics = {t["code"] for u in cur["units"] for t in u["topics"]}
        for n in NAMES:
            for q in items_of(packs(n, 1)[0]):
                self.assertIn(q["skill"], skills, n)
                self.assertNotEqual(q["skill"], "4.A", n)
                self.assertIn(q["topic"], topics, n)

    def test_math_delimiters_are_balanced(self):
        for n in NAMES:
            for p in packs(n, 4, 200):
                for q in items_of(p):
                    for t in [q["stem"]] + [o["text"] for o in q["options"]]:
                        self.assertEqual(t.replace("\\$", "").count("$") % 2, 0, (n, t))

    def test_no_two_archetypes_share_a_stem_and_option_set(self):
        seen = {}
        for n in NAMES:
            for q in items_of(packs(n, 1)[0]):
                key = hashlib.sha1((q["stem"] + "|".join(sorted(o["text"] for o in q["options"]))).encode()).hexdigest()
                self.assertNotIn(key, seen, (n, seen.get(key)))
                seen[key] = n

    def test_archetypes_vary_with_the_seed(self):
        """원형 하나가 시드마다 똑같은 문항만 내놓으면 안 된다(같은 구조 중복): 서로 다른 문항이 둘 이상 나와야 한다."""
        low = []
        for n in R.BIO_STAGES["bio_mc_all"]:
            sigs = {R.sig(p) for p in R.batch(n, 6, 300)}
            if len(sigs) < 2:
                low.append(n)
        self.assertEqual(low, [])


class TestNumericTruth(unittest.TestCase):
    """facts·stem 만으로 테스트가 다시 계산한 값이 키와 같은지."""

    def key_text(self, q):
        return plain(q["options"][q["key_index"]]["text"])

    def test_dehydration_count(self):
        for p in packs("bi_dehydration_count", 8):
            n = int(re.search(r"n=(\d+)", p["facts"][0]).group(1))
            self.assertEqual(self.key_text(p), str(n - 1))

    def test_chargaff(self):
        for p in packs("bi_chargaff", 8):
            a = int(re.search(r"A=(\d+)", p["facts"][0]).group(1))
            self.assertEqual(self.key_text(p), f"{50 - a}%")

    def test_dna_hbonds(self):
        for p in packs("bi_dna_hbonds", 8):
            top = re.search(r"top=([ATGC]+)", p["facts"][0]).group(1)
            self.assertEqual(int(self.key_text(p)), sum(2 if c in "AT" else 3 for c in top))

    def test_water_potential(self):
        for p in packs("bi_water_potential", 8):
            f = {k: float(v) for k, v in (x.split("=") for x in p["facts"][:4])}
            self.assertAlmostEqual(float(re.search(r"-?\d+\.\d+", self.key_text(p)).group()), -f["i"] * f["C"] * 0.0831 * f["T"], places=2)

    def test_pcr(self):
        for p in packs("bi_pcr", 8):
            f = {k: int(v) for k, v in (x.split("=") for x in p["facts"])}
            self.assertEqual(int(self.key_text(p).replace(",", "")), f["m"] * 2 ** f["n"])

    def test_chi_square(self):
        for p in packs("bi_chi_square", 8):
            rows = p["stimulus"]["data"]["rows"]
            obs = [float(r[1]) for r in rows]; exp = [float(r[2]) for r in rows]
            x = sum((o - e) ** 2 / e for o, e in zip(obs, exp))
            df = len(obs) - 1
            crit = {1: 3.84, 3: 7.81}[df]
            self.assertIn(f"{x:.2f}", p["options"][p["key_index"]]["text"])
            self.assertIn("not rejected" if x <= crit else "rejected", p["options"][p["key_index"]]["text"])

    def test_hardy_weinberg_frequencies(self):
        for p in packs("bi_hw_allele_freq", 12):
            q2 = float(re.search(r"q2=([\d.]+)", p["facts"][0]).group(1)); variant = re.search(r"variant=(\w+)", p["facts"][1]).group(1)
            q = math.sqrt(q2); pp = 1 - q
            want = {"carriers": 2 * pp * q, "p": pp, "homo_dom": pp * pp}[variant]
            self.assertAlmostEqual(float(self.key_text(p)), want, places=2)

    def test_logistic_and_trophic_and_simpson(self):
        for p in packs("bi_logistic", 6):
            f = {k: float(v) for k, v in (x.split("=") for x in p["facts"][:3])}
            self.assertEqual(int(self.key_text(p).replace(",", "")), round(f["r"] * f["N"] * (f["K"] - f["N"]) / f["K"]))
        for p in packs("bi_trophic_energy", 6):
            f = {k: float(v) for k, v in (x.split("=") for x in p["facts"])}
            self.assertAlmostEqual(float(re.search(r"[\d.,]+", self.key_text(p)).group().replace(",", "")), f["E"] * 0.1 ** (f["level"] - 1), places=1)
        for p in packs("bi_simpson", 6):
            counts = json.loads(re.search(r"counts=(\[.*?\])", p["facts"][0]).group(1)); N = sum(counts)
            self.assertAlmostEqual(float(self.key_text(p)), round(1 - sum((c / N) ** 2 for c in counts), 2), places=2)

    def test_restriction_gel_fragments_sum_to_length(self):
        for p in packs("bi_restriction_gel", 10):
            L = int(re.search(r"L=(\d+)", p["facts"][0]).group(1))
            nums = [int(x.replace(",", "")) for x in re.findall(r"[\d,]+(?= bp|,| and)", self.key_text(p)) if x.replace(",", "").isdigit()]
            self.assertEqual(sum(nums), L)

    def test_translation_uses_the_first_start_codon(self):
        import bio_common as B
        for p in packs("bi_translation", 10):
            mrna = re.search(r"mrna=([ACGU]+)", p["facts"][0]).group(1)
            self.assertEqual(self.key_text(p), "-".join(B.translate(mrna)))


class TestCoverage(unittest.TestCase):
    tags = None

    @classmethod
    def setUpClass(cls):
        cls.tags = C.tags_from_registry()

    def test_full_exam_assemblable_in_official_ranges(self):
        ok, pick, why = C.assemble_check(self.tags)
        self.assertTrue(ok, why)
        n = sum(len(self.tags[a]) for a in pick)
        self.assertEqual(n, 60)
        unit = {}
        for a in pick:
            for u, s in self.tags[a]:
                unit[u] = unit.get(u, 0) + 1
        for u, rng_ in C.UNIT_MC.items():
            lo, hi = C.count_bounds(rng_)
            self.assertTrue(lo <= unit.get(u, 0) <= hi, (u, unit))

    def test_two_disjoint_exams_assemblable(self):
        ok, picks, why = C.assemble_two_check(self.tags)
        self.assertTrue(ok, why)
        self.assertFalse(set(picks[0]) & set(picks[1]))
        for e in picks:
            self.assertEqual(sum(len(self.tags[a]) for a in e), 60)
            self.assertEqual(sum(1 for a in e if len(self.tags[a]) == C.SET_SIZE), C.SET_COUNT)
            prac = {}
            for a in e:
                for _, s in self.tags[a]:
                    prac[s[0]] = prac.get(s[0], 0) + 1
            for pr, rng_ in C.PRACTICE_MC.items():
                lo, hi = C.count_bounds(rng_)
                self.assertTrue(lo <= prac.get(pr, 0) <= hi, (pr, prac))

    def test_survives_the_loss_of_random_archetypes(self):
        """후보가 반려돼 원형이 일부 사라져도 두 회가 조립되는지(15 % 손실, 8회 무작위)."""
        rnd = random.Random(7)
        ids = sorted(self.tags)
        for _ in range(8):
            lost = set(rnd.sample(ids, int(len(ids) * 0.15)))
            t = {a: v for a, v in self.tags.items() if a not in lost}
            ok, _, why = C.assemble_two_check(t)
            self.assertTrue(ok, (len(lost), why))

    def test_library_covers_every_practice_with_margin(self):
        unit, prac, skill = C.library_counts(self.tags)
        for pr, rng_ in C.PRACTICE_MC.items():
            self.assertGreaterEqual(prac[pr], 2 * C.count_bounds(rng_)[0] + 4, (pr, prac))
        for u, rng_ in C.UNIT_MC.items():
            self.assertGreaterEqual(unit[u], 2 * C.count_bounds(rng_)[0], (u, unit))


class TestFrq(unittest.TestCase):
    WEIGHTS = {"bio_q1_results": 9, "bio_q2_graphing": 9, "bio_q3_investigation": 4, "bio_q4_conceptual": 4, "bio_q5_model": 4, "bio_q6_data": 4}

    def test_every_type_has_enough_scenarios_and_official_point_structure(self):
        by_t = {}
        for n in R.BIO_STAGES["bio_frq"]:
            for p in R.batch(n, 2, 0):
                by_t.setdefault(p["template"], set()).add(n)
                self.assertEqual(p["total_points"], self.WEIGHTS[p["template"]], n)
                self.assertEqual(sum(pt["points"] for pt in p["parts"]), p["total_points"], n)
                for pt in p["parts"]:
                    self.assertEqual(sum(r["points"] for r in pt["rubric_rows"]), pt["points"], (n, pt["label"]))
                    self.assertTrue(all(r["points"] == 1 for r in pt["rubric_rows"]), n)
                    self.assertTrue(pt["skill_codes"] and pt["topic_codes"], n)
                    self.assertTrue(pt["model_answer"].strip(), n)
                    self.assertTrue(all(r.get("meaning_based") for r in pt["rubric_rows"]), n)
                if p["total_points"] == 4:
                    self.assertEqual([pt["points"] for pt in p["parts"]], [1, 1, 1, 1], n)
                if p["template"] == "bio_q1_results":
                    self.assertEqual([pt["points"] for pt in p["parts"]], [1, 3, 3, 2], n)
                if p["template"] == "bio_q2_graphing":
                    self.assertEqual([pt["points"] for pt in p["parts"]], [1, 4, 2, 2], n)
        self.assertEqual(set(by_t), set(self.WEIGHTS))
        for t, s in by_t.items():
            self.assertGreaterEqual(len(s), 4, t)

    def test_graph_part_of_q2_has_graph_rows_for_paper_scoring(self):
        for n in [x for x in R.BIO_STAGES["bio_frq"] if x.startswith("bif_q2_")]:
            p = R.batch(n, 1, 0)[0]
            b = next(pt for pt in p["parts"] if pt["label"] == "B")
            self.assertEqual(b["response_mode"], "draw")
            self.assertEqual({r["kind"] for r in b["rubric_rows"]}, {"graph"})
            self.assertIn("4.A", b["skill_codes"])

    def test_numeric_rows_match_the_expected_values(self):
        for n in R.BIO_STAGES["bio_frq"]:
            p = R.batch(n, 1, 0)[0]
            for ev in p.get("expected_values", []):
                part = next(pt for pt in p["parts"] if pt["label"] == ev["part"])
                nums = [float(e) for r in part["rubric_rows"] for e in r["required_elements"] if re.fullmatch(r"-?\d+(\.\d+)?", str(e))]
                if nums:  # 수치 행이 문장 형태인 파트(예: 활성화 에너지를 서술로 묻는 행)는 기대값 필드로만 검증한다
                    self.assertTrue(any(abs(x - ev["value"]) <= max(ev["tolerance"], 0.06 * abs(ev["value"])) + 0.06 for x in nums), (n, ev, nums))

    def test_percent_change_and_overlap_recomputed_from_the_table(self):
        for n in [x for x in R.BIO_STAGES["bio_frq"] if x.startswith(("bif_q1_", "bif_q6_"))]:
            p = R.batch(n, 1, 0)[0]
            rows = p["stimulus"]["data"]["rows"]
            ms = [(float(re.match(r"(-?[\d.]+) ± ([\d.]+)", r[1]).group(1)), float(re.match(r"(-?[\d.]+) ± ([\d.]+)", r[1]).group(2))) for r in rows]
            fm = json.loads(next(f for f in p["facts"] if f.startswith("means=")).split("=", 1)[1])
            for (m, e2), x in zip(ms, fm):
                self.assertAlmostEqual(m, x, places=1)
            ev = next(e for e in p["expected_values"] if e["quantity"] == "percent change")
            if n.startswith("bif_q6_"):
                best = max(((abs(ms[i][0] - ms[j][0]), i, j) for i in range(3) for j in range(i + 1, 3)))
                _, i, j = best
                pct = (ms[j][0] - ms[i][0]) / abs(ms[i][0]) * 100
            else:
                pct = (ms[-1][0] - ms[0][0]) / ms[0][0] * 100
            self.assertAlmostEqual(pct, ev["value"], delta=0.1)


if __name__ == "__main__":
    unittest.main()
