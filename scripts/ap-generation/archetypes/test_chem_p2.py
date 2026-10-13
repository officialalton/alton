"""AP Chemistry 두 번째 변형 원형 10종(chem_p0_j.py) 테스트(무료). 키를 facts·자료 표·그림 장면만으로 테스트가 다시 계산한다(원형 코드의 이중 경로와 별개의 세 번째 계산).
또 한 원형뿐이던 스킬 10개가 이제 둘 이상의 원형을 갖는지, 구조(자료 형태)가 서로 다른지 확인한다."""
import math, re, unittest
import numpy as np
import registry as R
import chem_coverage as C
import chem_figs as F
from chem_common import MASS, formula_mass, CONSTS
from test_chem_p0 import facts, items, key_value

NEW = {"ch_mixture_mass_percent": "1.B", "ch_testable_variables": "2.A", "ch_le_chatelier_prediction": "2.B", "ch_titrant_change": "2.F", "ch_precipitate_claim": "6.A", "ch_halflife_order_claim": "6.B", "ch_acid_strength_particles": "6.C",
       "ch_vapor_pressure_justify": "6.E", "ch_buffer_data_conclusion": "6.F", "ch_hydrate_error": "6.G"}


def key_text(q):
    return q["options"][q["key_index"]]["text"]


def num(s):
    return float(re.sub(r"[^0-9.\-]", "", s))


class SecondVariants(unittest.TestCase):
    def test_registered_with_the_skill_they_were_added_for(self):
        for n, sk in NEW.items():
            self.assertIn(n, R.CHEM_STAGES["chem_mc_all"])
            p = R.batch(n, 1, 0)[0]
            self.assertEqual(p["skill"], sk, n)

    def test_each_thin_skill_now_has_two_archetypes_and_different_material_types(self):
        tags = C.tags_from_registry()
        _, _, sk = C.library_counts(tags)
        for s in ("1.B", "2.A", "2.B", "2.F", "6.A", "6.B", "6.C", "6.E", "6.F", "6.G"):
            self.assertGreaterEqual(sk[s], 2, s)
        # 같은 스킬의 두 원형은 자료 형태나 질문 방식이 다르다(숫자만 다른 변형이 아님): 설계도의 material.type 또는 개념이 다르다
        first = {"1.B": "ch_particle_phase", "2.A": "ch_testable_question", "2.B": "ch_rate_prediction", "2.F": "ch_beer_procedure", "6.A": "ch_solid_type_claim", "6.B": "ch_claim_from_data", "6.C": "ch_imf_boiling", "6.E": "ch_gas_particle_claim", "6.F": "ch_titration_conclusion", "6.G": "ch_titration_error"}
        for n, s in NEW.items():
            a = R.batch(first[s], 1, 0)[0]["blueprint"]; b = R.batch(n, 1, 0)[0]["blueprint"]
            self.assertNotEqual(a["concept"], b["concept"], n)

    def test_mixture_mass_percent(self):
        for p in R.batch("ch_mixture_mass_percent", 8, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), 100 * f["nx"] * f["mx"] / (f["nx"] * f["mx"] + f["ny"] * f["my"]), delta=0.05)
            sc = p["stimulus"]["data"]["scene"]["box"]
            self.assertEqual([g["count"] for g in sc], [int(f["nx"]), int(f["ny"])])
            self.assertEqual(F.check_particles(p["stimulus"]["data"]["scene"]), [])
            self.assertAlmostEqual(f["mx"], formula_mass(f["x"]), places=3)

    def test_titrant_change(self):
        for p in R.batch("ch_titrant_change", 8, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), f["ca"] * f["Va"] / f["c2"], delta=0.01 * f["Va"] / 25)
            self.assertAlmostEqual(f["v1"], f["ca"] * f["Va"] / f["c1"], delta=1e-4)
            self.assertNotEqual(f["c1"], f["c2"])

    def test_precipitate_claim_matches_the_solubility_rule_table(self):
        import chem_p0_j as J
        for p in R.batch("ch_precipitate_claim", 8, 0):
            f = facts(p)
            rows = p["stimulus"]["data"]["rows"]
            obs = tuple(r[1] == "Precipitate formed" for r in rows)
            self.assertEqual([c for c, v in J.PPT.items() if v == obs], [f["cation"]])
            self.assertIn({"Pb2+": "Pb^{2+}", "Ba2+": "Ba^{2+}", "Mg2+": "Mg^{2+}", "K+": "K^{+}"}[f["cation"]], key_text(p))
            # 오답 후보 하나도 같은 관찰과 모두 일치하지 않는다
            for i, o in enumerate(p["options"]):
                if i != p["key_index"]:
                    self.assertIn("contradicts the observation", o["why"])

    def test_le_chatelier_direction(self):
        for p in R.batch("ch_le_chatelier_prediction", 10, 0):
            f = facts(p)
            m, n = {"A2B": (1, 2), "2AB": (2, 1), "AB": (1, 1)}[f["rx"]]
            a0, b0 = f["a0"], f["b0"]
            a1, b1 = {"half": (2 * a0, 2 * b0), "double": (a0 / 2, b0 / 2), "addA": (a0 + 0.4, b0), "addB": (a0, b0 + 0.3)}[f["change"]]
            Q = b1 ** n / a1 ** m; K = b0 ** n / a0 ** m
            self.assertAlmostEqual(f["K"], K, delta=1e-4); self.assertAlmostEqual(f["Q"], Q, delta=1e-4)
            want = "equal to" if abs(Q - K) < 1e-12 else ("greater than" if Q > K else "less than")
            direction = "neither direction" if want == "equal to" else ("the reactants" if Q > K else "the products")
            kt = key_text(p)
            self.assertIn(want + " $K_c$", kt); self.assertIn(direction, kt)

    def test_half_life_pattern(self):
        for p in R.batch("ch_halflife_order_claim", 8, 0):
            f = facts(p)
            rows = p["stimulus"]["data"]["rows"]
            ts = [float(r[0]) for r in rows]; cs = [float(r[1]) for r in rows]
            for a, b in zip(cs, cs[1:]):
                self.assertAlmostEqual(b / a, 0.5, places=6)
            iv = [b - a for a, b in zip(ts, ts[1:])]
            order = int(f["order"])
            ratio = [iv[1] / iv[0], iv[2] / iv[1]]
            want = {1: (0.85, 1.15), 2: (1.7, 2.6), 0: (0.4, 0.6)}[order]
            self.assertTrue(all(want[0] <= r <= want[1] for r in ratio), (order, iv))
            self.assertIn({0: "zero", 1: "first", 2: "second"}[order] + " order", key_text(p))

    def test_acid_strength_counts(self):
        for p in R.batch("ch_acid_strength_particles", 8, 0):
            f = facts(p)
            box = {g["species"]: g["count"] for g in p["stimulus"]["data"]["scene"]["box"]}
            self.assertEqual(box.get("H+"), box.get("A-"))
            self.assertEqual(box.get("HA", 0), int(f["ha"]))
            self.assertEqual("weak acid" in key_text(p), box.get("HA", 0) > 0)
            if box.get("HA", 0):
                self.assertAlmostEqual(f["pct"], 100 * box["H+"] / (box["HA"] + box["H+"]), delta=0.01)

    def test_vapor_pressure_table_orders_agree(self):
        for p in R.batch("ch_vapor_pressure_justify", 8, 0):
            rows = p["stimulus"]["data"]["rows"]
            px, py = float(rows[0][1]), float(rows[1][1]); bx, by = float(rows[0][2]), float(rows[1][2])
            self.assertLess(px, py); self.assertGreater(bx, by)
            self.assertIn("stronger intermolecular forces than liquid Y", key_text(p))

    def test_buffer_ph_values(self):
        for p in R.batch("ch_buffer_data_conclusion", 8, 0):
            f = facts(p)
            nHA, nA, nb = f["cHA"] * 0.1, f["cA"] * 0.1, f["nb"]
            ph0 = f["pKa"] + math.log10(nA / nHA); ph1 = f["pKa"] + math.log10((nA + nb) / (nHA - nb))
            rows = p["stimulus"]["data"]["rows"]
            self.assertAlmostEqual(float(rows[0][1]), ph0, delta=0.03); self.assertAlmostEqual(float(rows[0][2]), ph1, delta=0.03)
            h = 10 ** -ph0; ex = nb - h * 0.1
            self.assertAlmostEqual(float(rows[1][2]), 14 + math.log10(ex / 0.105), delta=0.03)
            self.assertIn("Solution A resists changes in pH", key_text(p))

    def test_hydrate_effect_direction(self):
        eff_by = {"incomplete": "low", "reabsorb": "low", "spatter": "high", "surface_water": "high", "overheat": "high"}
        for p in R.batch("ch_hydrate_error", 10, 0):
            f = facts(p)
            self.assertEqual(f["effect"], eff_by[f["scenario"]])
            self.assertIn({"high": "too high", "low": "too low"}[f["effect"]], key_text(p))
            M_h = formula_mass(f["hydrate"]) + f["n"] * (2 * MASS["H"] + MASS["O"])
            self.assertAlmostEqual(f["true"], 100 * f["n"] * (2 * MASS["H"] + MASS["O"]) / M_h, delta=1e-3)

    def test_testable_question_has_one_variable_and_a_measured_outcome(self):
        for p in R.batch("ch_testable_variables", 8, 0):
            f = facts(p)
            kt = key_text(p)
            self.assertIn(str(f["iv"]), kt); self.assertIn(str(f["dv"]), kt)
            self.assertNotIn(" both ", kt)


class ExplanationQuality(unittest.TestCase):
    """2026-10-13 chem-p1-a 첫 통과 36%: 검토기가 정답 설명이 비어 있거나(대입 없음), 오답 설명이 템플릿·중복·값과 불일치라며 반려했다. 코드로 확인할 수 있는 부분을 강제한다."""

    def test_every_item_has_a_reasoned_key_and_unique_distractor_explanations(self):
        for n in R.CHEM_STAGES["chem_mc_all"] + R.CHEM_STAGES["chem_sets"]:
            for p in R.batch(n, 4, 40):
                for q in items(p):
                    opts = q["options"]; k = q["key_index"]
                    kw = (opts[k]["why"] or "").strip()
                    self.assertGreaterEqual(len(kw), 40, f"{n}: key explanation too short")
                    numeric = all(o["value"] is not None for o in opts)
                    if numeric:
                        self.assertRegex(kw, r"\d", f"{n}: numeric item without a worked substitution in the key explanation")
                    whys = [o["why"].strip() for i, o in enumerate(opts) if i != k]
                    self.assertEqual(len(set(whys)), 3, f"{n}: duplicate distractor explanations")
                    self.assertNotIn(kw, whys, n)
                    for w in whys + [kw]:
                        self.assertNotIn("this option:", w, n)
                        self.assertNotRegex(w, r"e\+\d\d", f"{n}: computer-style number in an explanation")
                    for o in opts:
                        self.assertNotRegex(o["text"], r"\de[+-]\d", f"{n}: computer-style number in an option")


if __name__ == "__main__":
    unittest.main()
