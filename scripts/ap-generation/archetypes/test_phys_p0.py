"""AP Physics 1 P0 원형 테스트(무료, 네트워크·DB·LLM 없음). unittest 기반이라 `python -m unittest test_phys_p0` 또는 pytest 로 돈다(Vitest 래퍼: lib/ap-generation/physics1-archetypes.test.ts).
검사: 시드 결정성 / 구조 중복 없음 / 선택지 구조(4개·유일 정답·8% 간격·오개념 why) / 허용 스킬·토픽 / 수치 진실 테스트(facts 로 독립 재계산) / 그림 장면 검사 / FRQ 배점·행 구조."""
import json, math, random, re, unittest
import xml.etree.ElementTree as ET
import registry as R
import phys_figs as F
from phys_common import G, MIN_REL_SEP

MC = [n for n in R.PHYS_STAGES["phys_mc_all"]]
SETS = R.PHYS_STAGES["phys_sets"]
FRQ = R.PHYS_STAGES["phys_frq"]
ALL_MC = MC + SETS
SKILLS_OK = {"2.A", "2.B", "2.C", "2.D", "3.B", "3.C"}  # MC 에서 평가되는 스킬(CED p.172)
UNIT_TOPICS = {"1": 5, "2": 9, "3": 5, "4": 4, "5": 6, "6": 6, "7": 4, "8": 4}


def items(pack):
    return pack["items"] if "items" in pack else [pack]


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


def key_value(q):
    return float(q["options"][q["key_index"]]["value"])


class Determinism(unittest.TestCase):
    def test_same_seed_same_pack(self):
        for n in ALL_MC + FRQ:
            fn = (R.PHYS.get(n) or R.PHYS_FRQ.get(n))[0]
            for sd in range(300, 340):
                try:
                    a = fn(random.Random(sd))
                except Exception:
                    continue
                self.assertEqual(json.dumps(a, sort_keys=True), json.dumps(fn(random.Random(sd)), sort_keys=True), n)
                break
            else:
                self.fail(f"{n}: no seed produced a pack")

    def test_archetypes_registered(self):
        self.assertEqual(len(MC), 47)
        self.assertEqual(SETS, ["phys_vt_set".replace("phys_", "phs_"), "phs_collision_set"])
        self.assertEqual(sorted(FRQ), ["phf_lab_spring_k", "phf_mr_table_block", "phf_qqt_collision", "phf_tbr_spring_shm"])


class NoDuplicateStructures(unittest.TestCase):
    def test_batches_have_distinct_signatures(self):
        for n in ALL_MC:
            b = R.batch(n, 6, 900)
            self.assertGreaterEqual(len(b), 4, f"{n}: fewer than 4 distinct packs in 400 seeds")
            self.assertEqual(len({R.sig(p) for p in b}), len(b), n)

    def test_stems_are_not_shared_between_different_archetypes(self):
        seen = {}
        for n in ALL_MC:
            for p in R.batch(n, 2, 100):
                for q in items(p):
                    key = re.sub(r"[\d.]+", "#", q["stem"])
                    if key in seen and seen[key] != n:
                        self.fail(f"{n} stem template duplicates {seen[key]}")
                    seen[key] = n


class McStructure(unittest.TestCase):
    def test_every_pack_structure(self):
        for n in ALL_MC:
            for p in R.batch(n, 5, 1200):
                for q in items(p):
                    ops = q["options"]
                    self.assertEqual(len(ops), 4, n)
                    self.assertEqual(len({o["text"] for o in ops}), 4, n)
                    self.assertTrue(0 <= q["key_index"] < 4)
                    self.assertEqual(q["calculator"], "allowed")
                    self.assertIn(q["skill"], SKILLS_OK, n)
                    unit = q["topic"].split(".")[0]
                    self.assertIn(unit, UNIT_TOPICS, n)
                    self.assertLessEqual(int(q["topic"].split(".")[1]), UNIT_TOPICS[unit], n)
                    for i, o in enumerate(ops):
                        if i != q["key_index"]:
                            self.assertGreaterEqual(len(o["why"] or ""), 15, f"{n} option why too short")
                    self.assertGreaterEqual(len(q["blueprint"]["misconceptions"]), 3, n)
                    self.assertGreaterEqual(len(q["blueprint"]["verification"]["independent_path"]), 20, n)
                    self.assertLessEqual(len(q["stem"].split()), 120, n)
                    self.assertEqual(q["stem"].replace("\\$", "").count("$") % 2, 0, f"{n}: unbalanced $")
                    self.assertNotRegex(q["stem"], r"\b(circuit|resistor|voltage|photon)\b", n)

    def test_numeric_options_are_separated(self):
        for n in ALL_MC:
            for p in R.batch(n, 5, 1500):
                for q in items(p):
                    vals = [None if o["value"] is None else float(o["value"]) for o in q["options"]]
                    if any(v is None for v in vals):
                        continue
                    for i in range(4):
                        for j in range(i + 1, 4):
                            a, b = vals[i], vals[j]
                            self.assertGreater(abs(a - b), MIN_REL_SEP * max(abs(a), abs(b)) - 1e-12, f"{n}: options too close {a} {b}")

    def test_scene_fixed_sentence_items_have_four_distinct_options(self):
        for n in ["ph_launch_vs_drop", "ph_motion_diagram", "ph_third_law", "ph_collision_type"]:
            for p in R.batch(n, 4, 50):
                self.assertEqual(len({o["text"] for o in p["options"]}), 4)


class NumericTruth(unittest.TestCase):
    """facts 에서 정답을 다시 계산해 key 값과 비교한다(생성기의 이중 경로와 별개로, 테스트가 쓰는 세 번째 경로)."""

    def check(self, name, fn, rel=1e-2):
        packs = R.batch(name, 6, 2000)
        self.assertGreaterEqual(len(packs), 4, name)
        for p in packs:
            f = facts(p)
            exp = fn(f)
            got = key_value(p)
            self.assertAlmostEqual(got, exp, delta=rel * max(1.0, abs(exp)), msg=f"{name} {p['facts']}")

    def test_projectile_range(self):
        self.check("ph_projectile_range", lambda f: f["v0"] ** 2 * math.sin(2 * math.radians(f["th"])) / G)

    def test_circular_tension(self):
        self.check("ph_circular_tension", lambda f: f["m"] * (2 * math.pi * f["r"] / f["P"]) ** 2 / f["r"])

    def test_vertical_circle_top(self):
        self.check("ph_vertical_circle_top", lambda f: f["m"] * (f["v"] ** 2 / f["r"] - G))

    def test_center_of_mass(self):
        for p in R.batch("ph_center_of_mass", 6, 2000):
            ms = json.loads(p["facts"][0].split("=", 1)[1]); xs = json.loads(p["facts"][1].split("=", 1)[1])
            self.assertAlmostEqual(key_value(p), sum(m * x for m, x in zip(ms, xs)) / sum(ms), places=3)

    def test_atwood_tension(self):
        self.check("ph_atwood_tension", lambda f: 2 * f["m1"] * f["m2"] * G / (f["m1"] + f["m2"]))

    def test_kinematics_time(self):
        self.check("ph_kinematics_time", lambda f: (-f["v0"] + math.sqrt(f["v0"] ** 2 + 2 * f["a"] * f["d"])) / f["a"])

    def test_incline_friction(self):
        self.check("ph_incline_friction", lambda f: G * (math.sin(math.radians(f["th"])) - f["mu"] * math.cos(math.radians(f["th"]))))

    def test_spring_launch(self):
        self.check("ph_spring_launch", lambda f: f["k"] * f["x"] ** 2 / (2 * f["m"] * G), rel=2e-2)

    def test_friction_slide(self):
        self.check("ph_friction_slide", lambda f: math.sqrt(f["v0"] ** 2 - 2 * f["mu"] * G * f["d"]))

    def test_inelastic_collision(self):
        self.check("ph_inelastic_collision", lambda f: (f["m1"] * f["v1"] + f["m2"] * f["v2"]) / (f["m1"] + f["m2"]))

    def test_beam_balance(self):
        self.check("ph_beam_balance", lambda f: f["M"] * (f["L"] / 2 - f["xp"]) / f["xp"])

    def test_wire_tension(self):
        self.check("ph_wire_tension", lambda f: f["M"] * G / (2 * math.sin(math.radians(f["th"]))))

    def test_alpha_hanging(self):
        self.check("ph_alpha_hanging", lambda f: f["m"] * G / (f["m"] + f["I"] / f["R"] ** 2))

    def test_ang_mom_platform(self):
        self.check("ph_ang_mom_platform", lambda f: f["I0"] * f["w0"] / (f["I0"] + f["m"] * f["r"] ** 2))

    def test_shm_energy(self):
        self.check("ph_shm_energy", lambda f: 0.5 * f["k"] * (f["A"] ** 2 - (f["x"]) ** 2) if "x" in f else 0.0)

    def test_shm_vmax(self):
        self.check("ph_shm_vmax", lambda f: 2 * math.pi * f["A"] / f["P"])

    def test_torricelli_range(self):
        self.check("ph_torricelli_range", lambda f: 2 * math.sqrt(f["d"] * f["hh"]))

    def test_gauge_pressure(self):
        self.check("ph_gauge_pressure", lambda f: 1.01e5 + f["rho"] * G * f["h"], rel=1e-9)

    def test_continuity(self):
        self.check("ph_continuity", lambda f: f["v1"] * (f["d1"] / f["d2"]) ** 2)

    def test_hydraulic(self):
        self.check("ph_hydraulic_lift", lambda f: f["F1"] * (f["d2"] / f["d1"]) ** 2)

    def test_vt_displacement_sign_and_area(self):
        for p in R.batch("ph_vt_displacement", 6, 2000):
            xs = json.loads(p["facts"][0].split("=", 1)[1]); vs = json.loads(p["facts"][1].split("=", 1)[1])
            area = sum((vs[i] + vs[i + 1]) / 2 * (xs[i + 1] - xs[i]) for i in range(len(xs) - 1))
            self.assertAlmostEqual(key_value(p), area, places=3)

    def test_fx_work_area(self):
        for p in R.batch("ph_fx_work", 6, 2000):
            xs = json.loads(p["facts"][0].split("=", 1)[1]); Fv = json.loads(p["facts"][1].split("=", 1)[1])
            self.assertAlmostEqual(key_value(p), sum((Fv[i] + Fv[i + 1]) / 2 * (xs[i + 1] - xs[i]) for i in range(len(xs) - 1)), places=2)

    def test_sets_share_stimulus_and_have_two_items(self):
        for n in SETS:
            for p in R.batch(n, 4, 3000):
                self.assertEqual(len(p["items"]), 2)
                self.assertTrue(p["set_intro"])
                self.assertIn(p["stimulus"]["kind"], ("graph", "diagram"))


class Figures(unittest.TestCase):
    def test_all_scene_stimuli_pass_checks_and_render_valid_svg(self):
        count = 0
        for n in ALL_MC:
            for p in R.batch(n, 4, 4000):
                for q in items(p):
                    st = q.get("stimulus") or p["stimulus"]
                    if st["kind"] == "diagram":
                        sc = st["data"]["scene"]
                        self.assertEqual(F.check_scene(sc), [], n)
                        ET.fromstring(F.render_svg(sc)); count += 1
                    for sc in q.get("option_scenes", []):
                        self.assertEqual(sc["type"] in F.RENDER, True)
                        ET.fromstring(F.render_svg(sc)); count += 1
        self.assertGreater(count, 40)

    def test_choice_scenes_have_no_hints(self):
        for n in ["ph_fbd_choice", "ph_energy_bar_choice"]:
            for p in R.batch(n, 6, 50):
                scenes = p["option_scenes"]
                self.assertEqual(len(scenes), 4)
                self.assertEqual(F.choice_checks(scenes, p["key_index"]), [], n)
                self.assertEqual([o["text"] for o in p["options"]], [f"Diagram {i + 1}" for i in range(4)])

    def test_fbd_checks_catch_bad_scenes(self):
        good = F.make_fbd([{"id": "a", "label": "Fg", "angle": 270, "mag": 10}, {"id": "b", "label": "N", "angle": 90, "mag": 10}])
        self.assertEqual(F.check_scene(good), [])
        bad = dict(good, equilibrium=True, forces=[good["forces"][0], dict(good["forces"][1], mag=7)])
        self.assertIn("equilibrium_sum_not_zero", F.check_scene(bad))
        stretched = dict(good, scale=good["scale"] * 1.0, forces=[dict(good["forces"][0]), dict(good["forces"][1], mag=10)])
        stretched["forces"][0]["mag"] = 10.0
        self.assertEqual(F.check_scene(stretched), [])

    def test_energy_bars_check_conservation(self):
        ok = F.make_bars([{"name": "i", "bars": {"Ug": 4}}, {"name": "f", "bars": {"K": 4}}])
        self.assertEqual(F.check_scene(ok), [])
        bad = F.make_bars([{"name": "i", "bars": {"Ug": 4}}, {"name": "f", "bars": {"K": 3}}])
        self.assertIn("energy_not_conserved", F.check_scene(bad))

    def test_text_numbers_match_scene_numbers(self):
        """본문 숫자 ↔ 장면 모델 숫자 일치(W10 의 단순판): 장면에 보이는 숫자는 본문에도 있어야 한다."""
        for n in ["ph_inelastic_collision", "ph_atwood_tension", "ph_incline_friction"]:
            for p in R.batch(n, 5, 80):
                sc = p["stimulus"]["data"]["scene"]
                nums = set(re.findall(r"-?\d+(?:\.\d+)?", p["stem"]))
                for v in F.scene_numbers(sc):
                    self.assertIn(v, nums, f"{n}: scene number {v} not in stem")


class FrqStructure(unittest.TestCase):
    WEIGHTS = {"phf_mr_table_block": 10, "phf_tbr_spring_shm": 12, "phf_lab_spring_k": 10, "phf_qqt_collision": 8}
    KINDS = {"expression", "numeric", "diagram", "graph", "claim", "justification", "design"}

    def test_totals_rows_and_dependencies(self):
        self.assertEqual(sum(self.WEIGHTS.values()), 40)
        for n, w in self.WEIGHTS.items():
            for p in R.batch(n, 3, 700):
                self.assertEqual(p["total_points"], w, n)
                self.assertEqual(sum(pt["points"] for pt in p["parts"]), w)
                ids = []
                for pt in p["parts"]:
                    self.assertEqual(sum(r["points"] for r in pt["rubric_rows"]), pt["points"])
                    for r in pt["rubric_rows"]:
                        self.assertIn(r["kind"], self.KINDS)
                        if r["requires_row_id"]:
                            self.assertIn(r["requires_row_id"], ids, f"{n}: dependency must reference an earlier row")
                        ids.append(r["row_id"])
                self.assertEqual(len(ids), len(set(ids)))
                self.assertIn("not official AP scoring", p["reference_note"])
                self.assertTrue(p["expected_values"])
                self.assertTrue(all(math.isfinite(e["value"]) for e in p["expected_values"]))
                self.assertEqual(p["blueprint"]["total_points"], w)

    def test_distinct_types_cover_the_four_slots(self):
        self.assertEqual({R.batch(n, 1, 0)[0]["template"] for n in FRQ}, {"mr", "tbr", "lab", "qqt"})

    def test_lab_fit_recovers_spring_constant(self):
        for p in R.batch("phf_lab_spring_k", 6, 100):
            f = facts(p)
            self.assertLess(abs(f["k_est"] - f["k"]) / f["k"], 0.04)
            self.assertAlmostEqual(f["k_est"], 4 * math.pi ** 2 / f["slope"], delta=0.05)

    def test_mr_acceleration_truth(self):
        for p in R.batch("phf_mr_table_block", 6, 100):
            f = facts(p)
            self.assertAlmostEqual(f["a"], (f["m2"] - f["mu"] * f["m1"]) * G / (f["m1"] + f["m2"]), places=3)

    def test_tbr_period_truth(self):
        for p in R.batch("phf_tbr_spring_shm", 6, 100):
            f = facts(p)
            self.assertAlmostEqual(f["P"], 2 * math.pi * math.sqrt(f["m"] / f["k"]), places=3)
            self.assertAlmostEqual(f["vmax"], f["A"] * math.sqrt(f["k"] / f["m"]), places=3)

    def test_qqt_truth(self):
        for p in R.batch("phf_qqt_collision", 6, 100):
            f = facts(p)
            self.assertAlmostEqual(f["vf"], f["v0"] / (f["n"] + 1), places=3)


if __name__ == "__main__":
    unittest.main()
