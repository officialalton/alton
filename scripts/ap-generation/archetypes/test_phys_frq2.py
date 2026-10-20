"""AP Physics 1 두 번째 FRQ 시나리오 8종 테스트(무료: 네트워크·DB·LLM 없음). 배점·행 구조·수치 진실(facts 로 독립 재계산)·그림 장면·TeX 위생·유형 내 시나리오 구별."""
import json, math, random, re, unittest
import registry as R
import phys_figs as F
from phys_common import G

NEW = R.PHYS_STAGES["phys_frq2"]
OLD = R.PHYS_STAGES["phys_frq"]
WEIGHTS = {"mr": 10, "tbr": 12, "lab": 10, "qqt": 8}
TYPE_OF = {"phf_mr_incline_slide": "mr", "phf_mr_energy_patch": "mr", "phf_tbr_cart_vt": "tbr", "phf_tbr_vertical_toss": "tbr",
           "phf_lab_pendulum_g": "lab", "phf_lab_sliding_friction": "lab", "phf_qqt_flat_curve": "qqt", "phf_qqt_floating_block": "qqt"}
KINDS = {"expression", "numeric", "diagram", "graph", "claim", "justification", "design"}


def facts(p):
    out = {}
    for f in p["facts"]:
        if "=" in f:
            k, v = f.split("=", 1)
            try:
                out[k] = float(v)
            except ValueError:
                pass
    return out


def packs(n, k=6, s0=100):
    return R.batch(n, k, s0)


class Registry(unittest.TestCase):
    def test_eight_new_scenarios_two_per_type(self):
        self.assertEqual(sorted(NEW), sorted(TYPE_OF))
        self.assertEqual(sorted(TYPE_OF[n] for n in NEW), ["lab", "lab", "mr", "mr", "qqt", "qqt", "tbr", "tbr"])
        self.assertTrue(set(NEW).isdisjoint(OLD))
        self.assertEqual(R.PHYS_STAGES["phys_s4_a"], NEW)
        self.assertGreaterEqual(len(R.PHYS_FRQ), 12)  # 2026-10-19 phys_p0_frq3 가 세 번째 시나리오 4개를 더했다

    def test_deterministic(self):
        for n in NEW:
            fn = R.PHYS_FRQ[n][0]
            a = json.dumps(fn(random.Random(321)), sort_keys=True)
            self.assertEqual(a, json.dumps(fn(random.Random(321)), sort_keys=True), n)


class Structure(unittest.TestCase):
    def test_totals_rows_dependencies(self):
        for n in NEW:
            for p in packs(n):
                w = WEIGHTS[TYPE_OF[n]]
                self.assertEqual(p["template"], TYPE_OF[n]); self.assertEqual(p["total_points"], w, n)
                self.assertEqual(sum(pt["points"] for pt in p["parts"]), w); self.assertEqual(p["blueprint"]["total_points"], w)
                ids = []
                for pt in p["parts"]:
                    self.assertEqual(sum(r["points"] for r in pt["rubric_rows"]), pt["points"], n)
                    for r in pt["rubric_rows"]:
                        self.assertIn(r["kind"], KINDS); self.assertEqual(r["points"], 1)
                        if r["requires_row_id"]:
                            self.assertIn(r["requires_row_id"], ids, f"{n}: dependency must reference an earlier row")
                        ids.append(r["row_id"])
                self.assertEqual(len(ids), len(set(ids)))
                self.assertIn("not official AP scoring", p["reference_note"])
                self.assertTrue(p["expected_values"]); self.assertTrue(all(math.isfinite(e["value"]) for e in p["expected_values"]))

    def test_same_type_scenarios_are_different(self):
        by = {}
        for n in NEW:
            p = packs(n, 1, 5)[0]
            by.setdefault(TYPE_OF[n], []).append(p)
        for t, (a, b) in by.items():
            self.assertNotEqual(a["archetype"], b["archetype"]); self.assertNotEqual(a["title"], b["title"], t)
            self.assertNotEqual(re.sub(r"[\d.]+", "#", a["stimulus"]["description"]), re.sub(r"[\d.]+", "#", b["stimulus"]["description"]), t)
        old = {R.batch(n, 1, 5)[0]["title"] for n in OLD}
        self.assertTrue(old.isdisjoint({p["title"] for ps in by.values() for p in ps}))

    def test_expected_values_appear_in_numeric_rows(self):
        """기대값(풀이기가 비교)은 같은 파트의 숫자 행 요소에 같은 값으로 나와야 한다(행 문구와 기대값 불일치 방지)."""
        num = re.compile(r"-?\d+(?:\.\d+)?")
        for n in NEW:
            for p in packs(n, 4, 40):
                for e in p["expected_values"]:
                    if e["part"] == "":
                        continue
                    part = next(pt for pt in p["parts"] if pt["label"] == e["part"])
                    vals = [float(x) for r in part["rubric_rows"] for el in (r["required_elements"] + [r["criterion"]]) for x in num.findall(str(el))]
                    tol = max(e["tolerance"], 0.02 * abs(e["value"]))
                    self.assertTrue(any(abs(v - e["value"]) <= tol for v in vals), f"{n}: {e['quantity']}={e['value']} not found in part {e['part']} rows {vals[:8]}")


class Truth(unittest.TestCase):
    def test_mr_incline(self):
        for p in packs("phf_mr_incline_slide"):
            f = facts(p); th = math.radians(f["th"])
            a = G * (math.sin(th) - f["mu"] * math.cos(th))
            self.assertAlmostEqual(f["a"], a, places=3); self.assertAlmostEqual(f["v"], math.sqrt(2 * a * f["d"]), places=2)
            self.assertGreater(a, 0.8)

    def test_mr_incline_scene(self):
        for p in packs("phf_mr_incline_slide"):
            sc = p["stimulus"]["data"]["scene"]; self.assertEqual(F.check_scene(sc), []); self.assertEqual(p["stimulus"]["kind"], "diagram")
            for v in F.scene_numbers(sc):
                self.assertIn(v, p["stimulus"]["description"])
            self.assertEqual(F.render_svg(sc), F.render_svg(sc))

    def test_mr_energy_patch(self):
        for p in packs("phf_mr_energy_patch"):
            f = facts(p)
            self.assertAlmostEqual(f["d"], f["h"] / f["mu"], places=3); self.assertAlmostEqual(f["E"], f["m"] * G * f["h"], places=3)
            self.assertTrue(2.0 <= f["d"] <= 10.0)

    def test_tbr_cart(self):
        for p in packs("phf_tbr_cart_vt"):
            f = facts(p); vm = f["a1"] * f["t1"]
            self.assertAlmostEqual(f["vm"], vm, places=3)
            self.assertAlmostEqual(f["x"], 0.5 * vm * f["t1"] + vm * f["t2"] + 0.5 * vm * f["t3"], places=3)
            self.assertAlmostEqual(f["a3"], vm / f["t3"], places=3)
            ev = {e["quantity"]: e["value"] for e in p["expected_values"]}
            self.assertAlmostEqual(ev["added displacement"], vm * f["dT"], places=3)

    def test_tbr_toss(self):
        for p in packs("phf_tbr_vertical_toss"):
            f = facts(p)
            self.assertAlmostEqual(f["E"], 0.5 * f["m"] * f["v0"] ** 2, places=3); self.assertAlmostEqual(f["hmax"], f["v0"] ** 2 / (2 * G), places=3)
            self.assertAlmostEqual(f["E"], f["m"] * G * f["hmax"], places=3)

    def test_lab_pendulum(self):
        for p in packs("phf_lab_pendulum_g"):
            f = facts(p)
            self.assertLess(abs(f["g_est"] - 9.8) / 9.8, 0.04); self.assertAlmostEqual(f["g_est"], 4 * math.pi ** 2 / f["slope"], delta=0.05)
            rows = p["stimulus"]["data"]["rows"]; self.assertEqual(len(rows), 5)
            self.assertTrue(all(rows[i][1] < rows[i + 1][1] for i in range(4)))

    def test_lab_friction(self):
        for p in packs("phf_lab_sliding_friction"):
            f = facts(p)
            self.assertLess(abs(f["mu_est"] - f["mu"]) / f["mu"], 0.04); self.assertAlmostEqual(f["mu_est"], 1 / (2 * G * f["slope"]), places=2)
            rows = p["stimulus"]["data"]["rows"]; self.assertTrue(all(rows[i][1] < rows[i + 1][1] for i in range(4)))

    def test_qqt_curve(self):
        for p in packs("phf_qqt_flat_curve"):
            f = facts(p); self.assertAlmostEqual(f["vmax"], math.sqrt(f["mu"] * G * f["r"]), places=2)

    def test_qqt_floating(self):
        for p in packs("phf_qqt_floating_block"):
            f = facts(p)
            self.assertAlmostEqual(f["f1"], f["rb"] / 1000.0, places=3); self.assertAlmostEqual(f["f2"], f["rb"] / f["rs"], places=3)
            self.assertLess(f["f2"], f["f1"]); self.assertLess(f["f2"], 1.0)


class StudentVisibleContext(unittest.TestCase):
    """2026-10-13 화면 증거에서 발견: 표·그림 자료의 stimulus.description 은 학생 화면에 나오지 않는다(표는 data.notes 만, 그림은 아무것도). 풀이에 필요한 값은 notes 나 파트 문구에 있어야 한다."""
    def test_table_stimuli_carry_the_setup_in_notes(self):
        for n in ("phf_lab_pendulum_g", "phf_lab_sliding_friction"):
            for p in packs(n, 4, 60):
                self.assertEqual(p["stimulus"]["kind"], "table")
                self.assertEqual(p["stimulus"]["data"]["notes"], [p["stimulus"]["description"]], n)

    def test_diagram_stimulus_values_needed_for_the_calculation_are_in_the_prompts(self):
        for p in packs("phf_mr_incline_slide", 6, 60):
            f = facts(p)
            prompts = " ".join(pt["prompt"] for pt in p["parts"])
            self.assertIn(f"\\mu={f['mu']:g}", prompts); self.assertIn(f"d={f['d']:g}", prompts)
            sc = p["stimulus"]["data"]["scene"]
            self.assertEqual({"theta": f["th"], "m": f["m"]}, {"theta": sc["theta"], "m": sc["m"]})  # 각도·질량은 그림의 라벨로 나온다(파트 C 가 그림을 가리킨다)
            self.assertIn("given in the figure", prompts)

    def test_text_stimulus_description_is_shown_by_the_viewer(self):
        for n in NEW:
            for p in packs(n, 1, 7):
                if p["stimulus"]["kind"] == "text":
                    self.assertTrue(p["stimulus"]["description"].strip())


class TexHygiene(unittest.TestCase):
    def test_no_script_marks_inside_text(self):
        bad = re.compile(r"\\text\{[^}]*(?:[\^_]|\\cdot)[^}]*\}")
        for n in NEW:
            for p in packs(n, 6, 900):
                blob = json.dumps(p, ensure_ascii=False).replace("\\\\", "\\")
                self.assertIsNone(bad.search(blob), f"{n}: script mark inside \\text: {bad.search(blob) and bad.search(blob).group(0)}")


if __name__ == "__main__":
    unittest.main()
