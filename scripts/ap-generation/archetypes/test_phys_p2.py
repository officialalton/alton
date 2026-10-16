"""AP Physics 1 확장 원형(phys_p0_d / phys_p0_e) 테스트(무료, 네트워크·DB·LLM 없음). 생성기의 이중 경로와 별개로 facts 에서 정답을 다시 계산(세 번째 경로)하고,
설명한 오개념의 식으로 오답 값이 실제 선택지에 나타나는지 확인한다(P1-a 반려 1순위 원인). 실행: python -m pytest test_phys_p2.py"""
import json, math, random, re, unittest
import registry as R
import phys_figs as F
from phys_common import G, MIN_REL_SEP
import test_phys_p0 as P0

S3_NAMES = set(R.PHYS_STAGES["phys_s3"])  # phys-s3 신규 30개는 test_phys_s3 가 따로 본다
_st = lambda k: [n for n in R.PHYS_STAGES[k] if n not in S3_NAMES]  # noqa: E731
NEW_U3 = _st("phys_u3")[7:]
NEW = NEW_U3 + _st("phys_u1")[7:] + _st("phys_u2")[10:] + _st("phys_u4")[4:] + _st("phys_u5")[5:] + _st("phys_u6")[4:] + _st("phys_u7")[3:] + _st("phys_u8")[7:]
NEW_SETS = R.PHYS_STAGES["phys_sets"][2:]
facts, key_value, items = P0.facts, P0.key_value, P0.items


def jfact(p, name):
    for f in p["facts"]:
        if f.startswith(name + "="):
            return json.loads(f.split("=", 1)[1])
    raise KeyError(name)


def option_values(p):
    return [float(o["value"]) for o in p["options"] if o["value"] is not None]


class Registered(unittest.TestCase):
    def test_new_counts(self):
        self.assertEqual(len(NEW_U3), 21)
        self.assertEqual(len(NEW), 48)
        self.assertEqual(len(NEW_SETS), 3)
        for n in NEW + NEW_SETS:
            self.assertTrue(n in R.PHYS)

    def test_units_match_stage_lists(self):
        for k in ("phys_u1", "phys_u2", "phys_u3", "phys_u4", "phys_u5", "phys_u6", "phys_u7", "phys_u8"):
            for n in R.PHYS_STAGES[k]:
                for p in R.batch(n, 2, 11):
                    for q in items(p):
                        self.assertEqual(q["topic"].split(".")[0], k[-1], f"{n} is in stage {k} but topic {q['topic']}")

    def test_each_new_archetype_generates_many_seeds(self):
        for n in NEW + NEW_SETS:
            self.assertGreaterEqual(len(R.batch(n, 8, 5000)), 6, n)

    def test_blueprint_misconceptions_are_the_shown_distractors(self):
        """P1-a: 설계도가 화면에 나오지 않은 오개념(m4)을 담아 반려됐다. 이제 설계도 오개념 = 보이는 오답의 why."""
        for n in R.PHYS_STAGES["phys_mc_all"] + R.PHYS_STAGES["phys_sets"]:
            for p in R.batch(n, 4, 7000):
                for q in items(p):
                    shown = sorted(o["why"] for i, o in enumerate(q["options"]) if i != q["key_index"])
                    self.assertEqual(sorted(m["description"] for m in q["blueprint"]["misconceptions"]), shown, n)

    def test_key_explanation_has_working(self):
        """P1-a(v1·v2): 정답 해설이 '문제 그대로 반복'(또는 'values given... this gives')이라 반려됐다. 숫자형 정답은 해설에 숫자 대입(숫자 토큰 2개 이상)이 있어야 한다."""
        num = re.compile(r"(?<![A-Za-z_\\{^])\d+(?:\.\d+)?")
        bad = []
        for n in R.PHYS_STAGES["phys_mc_all"] + R.PHYS_STAGES["phys_sets"]:
            for p in R.batch(n, 4, 7100):
                for q in items(p):
                    k = q["options"][q["key_index"]]
                    if k["value"] is None:
                        continue
                    if len(num.findall(k["why"])) < 2 or "values given in the question" in k["why"]:
                        bad.append((n, k["why"][:90]))
        self.assertEqual(bad, [])

    def test_set_stems_do_not_reference_other_questions(self):
        for n in R.PHYS_STAGES["phys_sets"]:
            for p in R.batch(n, 4, 7200):
                self.assertNotRegex(p["set_intro"], r"(?i)questions? \d")
                for q in p["items"]:
                    self.assertNotRegex(q["stem"], r"(?i)questions? \d|following graph")


class NumericTruthU3(unittest.TestCase):
    def check(self, name, fn, rel=1e-2, seeds=6, base=2000):
        packs = R.batch(name, seeds, base)
        self.assertGreaterEqual(len(packs), 4, name)
        for p in packs:
            exp = fn(p)
            self.assertAlmostEqual(key_value(p), exp, delta=rel * max(1.0, abs(exp)), msg=f"{name} {p['facts']}")

    def test_w_angle_force(self):
        self.check("ph_w_angle_force", lambda p: (lambda f: f["F"] * f["d"] * math.cos(math.radians(f["th"])))(facts(p)))

    def test_net_work_speed(self):
        self.check("ph_net_work_speed", lambda p: (lambda f: math.sqrt(2 * (f["F"] - f["mu"] * f["m"] * G) * f["d"] / f["m"]))(facts(p)))

    def test_vert_spring_compress(self):
        def f(p):
            q = facts(p); m, k, h = q["m"], q["k"], q["h"]
            return (m * G + math.sqrt((m * G) ** 2 + 2 * k * m * G * h)) / k
        self.check("ph_vert_spring_compress", f)

    def test_pendulum_bottom(self):
        self.check("ph_pendulum_bottom", lambda p: (lambda f: math.sqrt(2 * G * f["L"] * (1 - math.cos(math.radians(f["th"])))))(facts(p)))

    def test_ux_force_graph(self):
        for p in R.batch("ph_ux_force_graph", 6, 2000):
            xs, Us, i = jfact(p, "xs"), jfact(p, "Us"), jfact(p, "i")
            self.assertAlmostEqual(key_value(p), -(Us[i + 1] - Us[i]) / (xs[i + 1] - xs[i]), places=3)
            self.assertLess(key_value(p), 0)

    def test_vt_work_energy(self):
        for p in R.batch("ph_vt_work_energy", 6, 2000):
            vs, i, m = jfact(p, "vs"), jfact(p, "i"), facts(p)["m"]
            self.assertAlmostEqual(key_value(p), 0.5 * m * (vs[i + 1] ** 2 - vs[i] ** 2), places=2)

    def test_power_accel(self):
        self.check("ph_power_accel", lambda p: (lambda f: f["m"] * (G + f["a"]) * f["v"])(facts(p)))

    def test_fx_speed_graph(self):
        for p in R.batch("ph_fx_speed_graph", 6, 2000):
            xs, Fv, f = jfact(p, "xs"), jfact(p, "Fv"), facts(p)
            W = sum((Fv[i] + Fv[i + 1]) / 2 * (xs[i + 1] - xs[i]) for i in range(len(xs) - 1))
            self.assertAlmostEqual(key_value(p), math.sqrt(f["v0"] ** 2 + 2 * W / f["m"]), delta=1e-2)

    def test_bounce_energy_loss(self):
        self.check("ph_bounce_energy_loss", lambda p: (lambda f: f["m"] * G * (f["h1"] - f["h2"]))(facts(p)))

    def test_ramp_friction_energy(self):
        def f(p):
            q = facts(p); r = math.radians(q["th"]); L = q["h"] / math.sin(r)
            return math.sqrt(2 * G * q["h"] - 2 * q["mu"] * G * math.cos(r) * L)
        self.check("ph_ramp_friction_energy", f)

    def test_gravity_work_path(self):
        self.check("ph_gravity_work_path", lambda p: (lambda f: -f["m"] * G * f["L"] * math.sin(math.radians(f["th"])))(facts(p)))

    def test_pt_graph_speed(self):
        for p in R.batch("ph_pt_graph_speed", 6, 2000):
            xs, Pv, m = jfact(p, "xs"), jfact(p, "Pv"), facts(p)["m"]
            E = sum((Pv[i] + Pv[i + 1]) / 2 * (xs[i + 1] - xs[i]) for i in range(len(xs) - 1))
            self.assertAlmostEqual(key_value(p), math.sqrt(2 * E / m), delta=1e-2)

    def test_spring_energy_graph(self):
        self.check("ph_spring_energy_graph", lambda p: (lambda f: 0.5 * f["k"] * (f["x2"] ** 2 - f["x1"] ** 2))(facts(p)))

    def test_coaster_speed(self):
        self.check("ph_coaster_speed", lambda p: (lambda f: math.sqrt(f["v0"] ** 2 + 2 * G * (f["H"] - f["h"])))(facts(p)))

    def test_proj_speed_height(self):
        self.check("ph_proj_speed_height", lambda p: (lambda f: math.sqrt(f["v0"] ** 2 - 2 * G * f["y"]))(facts(p)))

    def test_pulley_energy(self):
        self.check("ph_pulley_energy", lambda p: (lambda f: math.sqrt(2 * (f["m2"] - f["m1"]) * G * f["d"] / (f["m1"] + f["m2"])))(facts(p)))

    def test_loop_release_height(self):
        self.check("ph_loop_release_height", lambda p: 2.5 * facts(p)["R"])

    def test_power_efficiency(self):
        self.check("ph_power_efficiency", lambda p: (lambda f: f["m"] * G * f["v"] / f["eta"])(facts(p)))

    def test_zero_work_cases_key_is_the_zero_work_statement(self):
        for p in R.batch("ph_zero_work_cases", 9, 2000):
            self.assertRegex(p["options"][p["key_index"]]["text"], r"zero work")
            self.assertEqual(sum(1 for o in p["options"] if re.search(r"zero work", o["text"])), 1)

    def test_ramps_compare_key_says_same_speed(self):
        for p in R.batch("ph_ramps_compare", 8, 2000):
            self.assertRegex(p["options"][p["key_index"]]["text"], r"same speed|speeds are equal")


class NumericTruthOthers(NumericTruthU3):
    def test_three_stage_motion(self):
        def f(p):
            q = facts(p); v = q["a1"] * q["t1"]
            return 0.5 * q["a1"] * q["t1"] ** 2 + v * q["t2"] + v * v / (2 * q["ab"])
        self.check("ph_three_stage_motion", f)

    def test_contact_force_blocks(self):
        self.check("ph_contact_force_blocks", lambda p: (lambda f: f["F"] * f["m2"] / (f["m1"] + f["m2"]))(facts(p)))

    def test_incline_pulley(self):
        self.check("ph_incline_pulley", lambda p: (lambda f: (f["m2"] - f["m1"] * math.sin(math.radians(f["th"]))) * G / (f["m1"] + f["m2"]))(facts(p)))

    def test_push_angle_normal(self):
        self.check("ph_push_angle_normal", lambda p: (lambda f: f["m"] * G + f["F"] * math.sin(math.radians(f["th"])))(facts(p)))

    def test_crate_stop_distance(self):
        self.check("ph_crate_stop_distance", lambda p: (lambda f: f["v0"] ** 2 / (2 * f["mu"] * G))(facts(p)))

    def test_pt_slope_force(self):
        for p in R.batch("ph_pt_slope_force", 6, 2000):
            xs, ps, i = jfact(p, "xs"), jfact(p, "ps"), jfact(p, "i")
            self.assertAlmostEqual(key_value(p), (ps[i + 1] - ps[i]) / (xs[i + 1] - xs[i]), places=3)

    def test_three_body_explosion(self):
        self.check("ph_three_body_explosion", lambda p: (lambda f: -(f["m1"] * f["v1"] + f["m2"] * f["v2"]) / f["m3"])(facts(p)))

    def test_wall_bounce_impulse(self):
        self.check("ph_wall_bounce_impulse", lambda p: (lambda f: f["m"] * (f["v1"] + f["v2"]) / f["dt"])(facts(p)))

    def test_wt_angle_graph(self):
        for p in R.batch("ph_wt_angle_graph", 6, 2000):
            xs, ws = jfact(p, "xs"), jfact(p, "ws")
            self.assertAlmostEqual(key_value(p), sum((ws[i] + ws[i + 1]) / 2 * (xs[i + 1] - xs[i]) for i in range(len(xs) - 1)) / (2 * math.pi), places=2)

    def test_rim_acceleration(self):
        self.check("ph_rim_acceleration", lambda p: (lambda f: math.hypot(f["w"] ** 2 * f["r"], f["al"] * f["r"]))(facts(p)))

    def test_net_torque_alpha(self):
        self.check("ph_net_torque_alpha", lambda p: (lambda f: (f["F1"] * f["R"] - f["F2"] * f["r"]) / (0.5 * f["M"] * f["R"] ** 2))(facts(p)))

    def test_inertia_scaling(self):
        for p in R.batch("ph_inertia_scaling", 6, 2000):
            f = facts(p)
            self.assertEqual(key_value(p), f["a"] * f["b"] ** 2)

    def test_rot_kin_stop(self):
        self.check("ph_rot_kin_stop", lambda p: (lambda f: f["N"] * f["t"] / 120.0)(facts(p)))

    def test_flywheel_ke(self):
        self.check("ph_flywheel_ke", lambda p: (lambda f: 0.5 * (0.5 * f["M"] * f["R"] ** 2) * (2 * math.pi * f["N"] / 60) ** 2)(facts(p)))

    def test_torque_work_power(self):
        self.check("ph_torque_work_power", lambda p: (lambda f: f["tau"] * 2 * math.pi * f["n"])(facts(p)))

    def test_skater_ke_change(self):
        for p in R.batch("ph_skater_ke_change", 6, 2000):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), f["Ii"] / f["If"], places=6)

    def test_orbit_speed_ratio(self):
        self.check("ph_orbit_speed_ratio", lambda p: (lambda f: f["vp"] * f["rp"] / f["ra"])(facts(p)))

    def test_pendulum_moon(self):
        self.check("ph_pendulum_moon", lambda p: (lambda f: 2 * math.pi * math.sqrt(f["L"] / f["gm"]))(facts(p)))

    def test_t2_m_graph(self):
        self.check("ph_t2_m_graph", lambda p: facts(p)["k"])

    def test_vertical_spring_period(self):
        self.check("ph_vertical_spring_period", lambda p: (lambda f: 2 * math.pi * math.sqrt(f["d"] / G))(facts(p)))

    def test_xt_max_accel(self):
        self.check("ph_xt_max_accel", lambda p: (lambda f: f["A"] * (2 * math.pi / f["P"]) ** 2)(facts(p)))

    def test_density_weighing(self):
        self.check("ph_density_weighing", lambda p: facts(p)["rho"], rel=1e-6)

    def test_hatch_force(self):
        self.check("ph_hatch_force", lambda p: (lambda f: 1000.0 * G * f["d"] * f["Acm"] * 1e-4)(facts(p)), rel=1e-6)

    def test_buoyant_tension(self):
        self.check("ph_buoyant_tension", lambda p: (lambda f: (f["rho"] - 1000.0) * f["V"] * G)(facts(p)), rel=1e-6)

    def test_bernoulli_height(self):
        self.check("ph_bernoulli_height", lambda p: (lambda f: f["p1"] + 0.5 * 1000.0 * (f["v1"] ** 2 - f["v2"] ** 2) - 1000.0 * G * f["dh"])(facts(p)), rel=1e-6)


class SignJudgments(unittest.TestCase):
    """x–t·SHM 그래프의 부호 판단: 정답 지점은 질의 조건을 만족하는 유일한 점이고, 화면 라벨 점과 일치한다."""
    def test_xt_signs_unique_match(self):
        for p in R.batch("ph_xt_signs", 8, 2000):
            ts = jfact(p, "ts"); k = facts(p)["k"]; t1 = facts(p)["t1"]; t2 = facts(p)["t2"]; q = jfact(p, "q")
            vf = lambda t: k * (t - t1) * (t - t2)  # noqa: E731
            af = lambda t: k * (2 * t - t1 - t2)  # noqa: E731
            sg = [(int(math.copysign(1, vf(t))), int(math.copysign(1, af(t)))) for t in ts]
            self.assertEqual(sg.count(tuple(q)), 1)
            ki = sg.index(tuple(q))
            self.assertEqual(p["options"][p["key_index"]]["text"], "Point " + "ABCD"[ki])
            labeled = p["stimulus"]["data"]["labeled_points"]
            self.assertEqual([m["label"] for m in labeled], list("ABCD"))
            self.assertEqual([m["x"] for m in labeled], ts)

    def test_shm_signs_unique_match(self):
        for p in R.batch("ph_shm_signs", 8, 2000):
            ts = jfact(p, "ts"); q = jfact(p, "q")
            pts = p["stimulus"]["data"]["labeled_points"]
            # 위치(x) 값에서 가속도 부호는 -sign(x); 속도 부호는 인접 표본의 기울기(그래프 정점)에서 읽는다
            vert = p["stimulus"]["data"]["vertices"]
            def slope_at(t):
                i = min(range(len(vert)), key=lambda j: abs(vert[j][0] - t))
                i = min(max(i, 1), len(vert) - 2)
                return vert[i + 1][1] - vert[i - 1][1]
            sg = [(int(math.copysign(1, slope_at(t))), int(-math.copysign(1, m["y"]))) for t, m in zip(ts, pts)]
            self.assertEqual(sg.count(tuple(q)), 1)
            ki = sg.index(tuple(q))
            self.assertEqual(p["options"][p["key_index"]]["text"], "Point " + "ABCD"[ki])


class DistractorValuesMatchNamesNew(unittest.TestCase):
    """이름 붙은 오개념의 식을 facts 로 다시 계산해 선택지(정답 외 3개 중)에 있는 값이 모두 그 식 중 하나와 일치하는지 확인."""
    def match_all(self, name, formulas, base=2500, seeds=8):
        for p in R.batch(name, seeds, base):
            f = facts(p) if True else {}
            vals = [float(o["value"]) for i, o in enumerate(p["options"]) if o["value"] is not None and i != p["key_index"]]
            allowed = [fn(p, f) for fn in formulas]
            for v in vals:
                self.assertTrue(any(abs(v - a) <= 5e-3 * max(1.0, abs(a)) for a in allowed), f"{name}: shown distractor {v} matches no named formula {allowed}")

    def test_w_angle_force(self):
        r = lambda f: math.radians(f["th"])  # noqa: E731
        self.match_all("ph_w_angle_force", [lambda p, f: f["F"] * f["d"], lambda p, f: f["F"] * f["d"] * math.sin(r(f)), lambda p, f: f["F"] * math.cos(r(f)), lambda p, f: f["F"] * f["d"] / math.cos(r(f))])

    def test_vert_spring_compress(self):
        self.match_all("ph_vert_spring_compress", [lambda p, f: math.sqrt(2 * f["m"] * G * f["h"] / f["k"]), lambda p, f: f["m"] * G / f["k"], lambda p, f: 2 * f["m"] * G / f["k"], lambda p, f: math.sqrt(f["m"] * G * f["h"] / f["k"])])

    def test_pendulum_bottom(self):
        r = lambda f: math.radians(f["th"])  # noqa: E731
        self.match_all("ph_pendulum_bottom", [lambda p, f: math.sqrt(2 * G * f["L"]), lambda p, f: math.sqrt(2 * G * f["L"] * math.sin(r(f))), lambda p, f: math.sqrt(2 * G * f["L"] * math.cos(r(f))), lambda p, f: math.sqrt(G * f["L"] * (1 - math.cos(r(f))))])

    def test_ramp_friction_energy(self):
        def v2(f):
            r = math.radians(f["th"]); L = f["h"] / math.sin(r); return 2 * G * f["h"] - 2 * f["mu"] * G * math.cos(r) * L
        self.match_all("ph_ramp_friction_energy", [lambda p, f: math.sqrt(2 * G * f["h"]),
                                                    lambda p, f: math.sqrt(max(2 * G * f["h"] - 2 * f["mu"] * G * f["h"] / math.sin(math.radians(f["th"])), 0.01)),
                                                    lambda p, f: math.sqrt(2 * G * f["h"] - 2 * f["mu"] * G * math.cos(math.radians(f["th"])) * f["h"]), lambda p, f: v2(f)])

    def test_loop_release_height(self):
        self.match_all("ph_loop_release_height", [lambda p, f: 2 * f["R"], lambda p, f: 3 * f["R"], lambda p, f: 1.5 * f["R"], lambda p, f: 0.5 * f["R"]])

    def test_incline_pulley(self):
        def a(f, c):
            r = math.radians(f["th"]); return c(f, r)
        self.match_all("ph_incline_pulley", [lambda p, f: (f["m2"] - f["m1"]) * G / (f["m1"] + f["m2"]), lambda p, f: (f["m2"] - f["m1"] * math.cos(math.radians(f["th"]))) * G / (f["m1"] + f["m2"]),
                                             lambda p, f: (f["m2"] - f["m1"] * math.sin(math.radians(f["th"]))) * G / f["m2"], lambda p, f: f["m2"] * G / (f["m1"] + f["m2"])])

    def test_rim_acceleration(self):
        self.match_all("ph_rim_acceleration", [lambda p, f: f["w"] ** 2 * f["r"], lambda p, f: f["al"] * f["r"], lambda p, f: f["w"] ** 2 * f["r"] + f["al"] * f["r"], lambda p, f: f["w"] * f["r"]])

    def test_flywheel_ke(self):
        def w(f): return 2 * math.pi * f["N"] / 60
        self.match_all("ph_flywheel_ke", [lambda p, f: 0.25 * f["M"] * f["R"] ** 2 * f["N"] ** 2, lambda p, f: 0.5 * f["M"] * f["R"] ** 2 * w(f) ** 2,
                                            lambda p, f: 0.25 * f["M"] * f["R"] ** 2 * (f["N"] / 60) ** 2, lambda p, f: 0.25 * f["M"] * f["R"] ** 2 * w(f)])

    def test_pendulum_moon(self):
        self.match_all("ph_pendulum_moon", [lambda p, f: 2 * math.pi * math.sqrt(f["L"] / G), lambda p, f: 2 * math.pi * math.sqrt(f["gm"] * f["L"]), lambda p, f: math.sqrt(f["L"] / f["gm"]), lambda p, f: 2 * math.pi * math.sqrt(f["gm"] / f["L"])])

    def test_vertical_spring_period(self):
        self.match_all("ph_vertical_spring_period", [lambda p, f: 2 * math.pi * math.sqrt(f["d"] * G), lambda p, f: math.sqrt(f["d"] / G), lambda p, f: 2 * math.pi * math.sqrt(G / f["d"]), lambda p, f: 2 * math.pi * math.sqrt(2 * f["d"] / G)])

    def test_hatch_force(self):
        self.match_all("ph_hatch_force", [lambda p, f: (1.01e5 + 1000.0 * G * f["d"]) * f["Acm"] * 1e-4, lambda p, f: 1000.0 * G * f["Acm"] * 1e-4, lambda p, f: 1000.0 * G * f["d"] * f["Acm"], lambda p, f: 1000.0 * G * f["d"]])


class FiguresNew(unittest.TestCase):
    def test_new_scene_stimuli_pass_checks(self):
        for n in ["ph_ramp_friction_energy", "ph_pulley_energy", "ph_bars_statement"]:
            for p in R.batch(n, 6, 4000):
                sc = p["stimulus"]["data"]["scene"]
                self.assertEqual(F.check_scene(sc), [], n)

    def test_pulley_scene_masses_in_text(self):
        for p in R.batch("ph_pulley_energy", 6, 80):
            sc = p["stimulus"]["data"]["scene"]
            nums = set(re.findall(r"-?\d+(?:\.\d+)?", p["stem"]))
            for v in F.scene_numbers(sc):
                self.assertIn(v, nums)

    def test_incline_scene_numbers_in_text(self):
        for p in R.batch("ph_ramp_friction_energy", 6, 80):
            sc = p["stimulus"]["data"]["scene"]
            nums = set(re.findall(r"-?\d+(?:\.\d+)?", p["stem"]))
            for v in F.scene_numbers(sc):
                self.assertIn(v, nums)

    def test_graph_stimuli_axes_cover_data(self):
        for n in NEW + NEW_SETS:
            for p in R.batch(n, 3, 4100):
                st = p["stimulus"] if "stimulus" in p and p["stimulus"]["kind"] == "graph" else None
                if not st:
                    continue
                d = st["data"]
                pts = d.get("vertices") or [v for c in d.get("curves", []) for v in c["vertices"]]
                xa, ya = d["x_axis"], d["y_axis"]
                for x, y in pts:
                    self.assertTrue(xa["min"] - 1e-9 <= x <= xa["max"] + 1e-9, f"{n}: x {x} outside axis")
                    self.assertTrue(ya["min"] - 1e-9 <= y <= ya["max"] + 1e-9, f"{n}: y {y} outside axis {ya}")


if __name__ == "__main__":
    unittest.main()
