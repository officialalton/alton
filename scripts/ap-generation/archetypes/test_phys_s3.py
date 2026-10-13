"""AP Physics 1 phys-s3 원형(phys_p0_f / phys_p0_g / phys_p0_h: 스킬 2.A·2.C·2.D·3.B·3.C 보강 40개) 테스트(무료, 네트워크·DB·LLM 없음). 실행: python -m unittest test_phys_s3 (pytest 호환).
생성기의 이중 경로와 별개로 facts 에서 정답을 세 번째 경로로 다시 계산하고, 화면에 나가는 기호식 TeX 를 `tex_eval` 로 실제 값에 대입해 비교한다."""
import json, math, random, re, unittest
import numpy as np
import registry as R
from phys_common import G, MIN_REL_SEP
from phys_sym import tex_eval, rank_opts, sym_opts
import test_phys_p0 as P0

S3 = R.PHYS_STAGES["phys_s3"]
SKILL_OF = {
    "2.A": ["ph_sym_vertical_throw", "ph_sym_incline_accel", "ph_sym_table_hanging", "ph_sym_track_patch", "ph_sym_collision", "ph_sym_beam_cable", "ph_sym_spring_speed", "ph_sym_float_force", "ph_sym_orbit", "ph_sym_pendulum_bottom", "ph_sym_bounce_force"],
    "2.C": ["ph_rank_stop_distance", "ph_rank_accel", "ph_rank_ramp_bottom", "ph_rank_impulse", "ph_rank_torque", "ph_rank_rolling", "ph_rank_period", "ph_rank_pressure", "ph_rank_centripetal", "ph_rank_work"],
    "2.D": ["ph_pred_centripetal", "ph_pred_stop_factor", "ph_pred_spring_pe", "ph_pred_fluid_scale", "ph_pred_orbit", "ph_pred_collision_speed", "ph_pred_projectile_scale"],
    "3.B": ["ph_claim_free_fall", "ph_claim_const_velocity", "ph_claim_momentum_system", "ph_claim_torque_balance", "ph_claim_angular_momentum", "ph_claim_shm_energy", "ph_claim_buoyancy"],
    "3.C": ["ph_evid_force_data", "ph_evid_collision_data", "ph_evid_pendulum_data", "ph_evid_position_data", "ph_evid_energy_data"],
}
items = P0.items


def fj(p, name):
    for f in p["facts"]:
        if f.startswith(name + "="):
            return json.loads(f.split("=", 1)[1])
    raise KeyError(name)


def key_of(q):
    return q["options"][q["key_index"]]


def key_tex(q):
    return key_of(q)["text"].strip("$")


def wrong_tex(q):
    return [o["text"].strip("$") for i, o in enumerate(q["options"]) if i != q["key_index"]]


class Registry(unittest.TestCase):
    def test_counts_and_skills(self):
        self.assertEqual(len(S3), 40)
        self.assertEqual(len(set(S3)), 40)
        self.assertEqual(sorted(sum(SKILL_OF.values(), [])), sorted(S3))
        for sk, names in SKILL_OF.items():
            for n in names:
                self.assertIn(n, R.PHYS, n)
                for p in R.batch(n, 3, 41):
                    self.assertEqual(p["skill"], sk, n)

    def test_topic_and_skill_are_constant_per_archetype(self):
        """파이프라인은 칸의 토픽·스킬을 첫 시드의 팩에서 정해 후보 전체에 적용한다(cells()). 시드마다 토픽이 달라지면 재고 단원·스킬 분류가 틀어진다."""
        for n in S3:
            tp = {(q["topic"], q["skill"], q["calculator"]) for p in R.batch(n, 30, 1) for q in items(p)}
            self.assertEqual(len(tp), 1, f"{n}: {tp}")

    def test_options_are_distinct_ignoring_case(self):
        """TS 게이트(gates.ts norm)는 선택지를 소문자로 바꿔 비교한다: $GM$ 과 $Gm$ 이 중복으로 반려됐다."""
        for n in S3:
            for p in R.batch(n, 6, 61):
                self.assertEqual(len({re.sub(r"\s+", " ", o["text"]).strip().lower() for o in p["options"]}), 4, n)

    def test_each_generates_many_distinct_packs(self):
        for n in S3:
            self.assertGreaterEqual(len(R.batch(n, 8, 5000)), 6, n)

    def test_units_cover_all_eight(self):
        units = {n: {q["topic"].split(".")[0] for p in R.batch(n, 3, 77) for q in items(p)} for n in S3}
        self.assertEqual(set().union(*units.values()), {"1", "2", "3", "4", "5", "6", "7", "8"})
        for k in ("phys_u1", "phys_u2", "phys_u3", "phys_u4", "phys_u5", "phys_u6", "phys_u7", "phys_u8"):
            for n in R.PHYS_STAGES[k]:
                if n in S3:
                    for p in R.batch(n, 2, 31):
                        for q in items(p):
                            self.assertEqual(q["topic"].split(".")[0], k[-1], n)

    def test_per_skill_unit_spread(self):
        """새 원형이 단원 하나에 몰리지 않는다: 스킬별 단원 수(정확 배정이 단원 5/8/8/5/5/3/3/5 를 맞추려면 단원 다양성 필요)."""
        spread = {sk: {p_unit for n in names for p_unit in {q["topic"].split(".")[0] for p in R.batch(n, 3, 77) for q in items(p)}} for sk, names in SKILL_OF.items()}
        self.assertGreaterEqual(len(spread["2.A"]), 7)
        self.assertGreaterEqual(len(spread["2.C"]), 8)
        self.assertGreaterEqual(len(spread["3.B"]), 7)
        self.assertGreaterEqual(len(spread["2.D"]), 3)
        self.assertGreaterEqual(len(spread["3.C"]), 3)


class TexEvaluator(unittest.TestCase):
    def test_basic_expressions(self):
        env = {"g": 9.8, "theta": math.radians(30), "mu": 0.2, "m1": 2.0, "m2": 3.0, "h": 4.0, "d": 2.0, "v0": 3.0, "rhob": 800.0, "rhof": 1000.0}
        self.assertAlmostEqual(tex_eval(r"g(\sin\theta-\mu\cos\theta)", env), 9.8 * (0.5 - 0.2 * math.cos(math.radians(30))), places=9)
        self.assertAlmostEqual(tex_eval(r"\frac{m_1m_2}{m_1+m_2}g", env), 2 * 3 / 5 * 9.8, places=9)
        self.assertAlmostEqual(tex_eval(r"\sqrt{v_0^2+2g(h-\mu d)}", env), math.sqrt(9 + 2 * 9.8 * (4 - 0.4)), places=9)
        self.assertAlmostEqual(tex_eval(r"\frac{\rho_b}{\rho_f}", env), 0.8, places=9)
        self.assertAlmostEqual(tex_eval(r"\frac{2m_1m_2}{m_1+m_2}g", env), 2 * 6 / 5 * 9.8, places=9)
        self.assertAlmostEqual(tex_eval(r"\frac{(m_1+m_2)v_0}{m_1}", env), 5 * 3 / 2, places=9)

    def test_sym_opts_rejects_close_or_undefined(self):
        env = {"g": 9.8, "a": 1.0, "b": 1.0}
        key, ds = sym_opts("ga", 9.8, [("same value", "ag"), ("x1", "2ga"), ("x2", "3ga"), ("x3", "4ga"), ("undefined", r"\sqrt{a-5}")], env)
        self.assertEqual(len(ds), 3)
        self.assertNotIn("ag", [d.text.strip("$") for d in ds])

    def test_rank_opts(self):
        key, ds, order = rank_opts({"A": 4, "B": 3, "C": 2, "D": 1}, list("ABCD"), [("r1", dict(A=1, B=2, C=3, D=4)), ("r2", dict(A=2, B=1, C=3, D=4)), ("r3", dict(A=4, B=3, C=1, D=2)), ("tie", dict(A=1, B=1, C=2, D=3))])
        self.assertEqual(key.text, "A > B > C > D")
        self.assertEqual(len(ds), 3)
        with self.assertRaises(ValueError):
            rank_opts({"A": 4, "B": 3.9, "C": 2, "D": 1}, list("ABCD"), [])


class SymbolicTruth(unittest.TestCase):
    """2.A: 키 TeX 를 문항의 실제 숫자에 대입한 값이 facts 로 다시 계산한 닫힌 식과 같고, 오답 TeX 는 서로(정답 포함) 8% 이상 다르다."""

    def run_each(self, name, expect, seeds=8, base=3000):
        packs = R.batch(name, seeds, base)
        self.assertGreaterEqual(len(packs), 5, name)
        for p in packs:
            env = expect(p)
            kv = tex_eval(key_tex(p), env[0])
            self.assertAlmostEqual(kv, env[1], delta=1e-9 * max(1, abs(env[1])), msg=f"{name} {p['facts']}")
            vals = [kv] + [tex_eval(t, env[0]) for t in wrong_tex(p)]
            for i in range(4):
                for j in range(i + 1, 4):
                    self.assertGreater(abs(vals[i] - vals[j]), MIN_REL_SEP * max(abs(vals[i]), abs(vals[j])) - 1e-12, f"{name} options too close {vals}")
            self.assertTrue(all(o["value"] is None for o in p["options"]))

    def test_incline_accel(self):
        def ex(p):
            f = P0.facts(p); th = math.radians(f["theta_deg"]); mu = f["mu"]; s = 1 if f["variant"] == 1 else -1
            return {"g": G, "theta": th, "mu": mu}, G * (math.sin(th) + s * mu * math.cos(th))
        self.run_each("ph_sym_incline_accel", ex)

    def test_table_hanging(self):
        def ex(p):
            f = P0.facts(p); m1, m2 = f["m1"], f["m2"]
            return {"g": G, "m1": m1, "m2": m2}, (m1 * m2 / (m1 + m2) * G if f["ask_T"] else m2 / (m1 + m2) * G)
        self.run_each("ph_sym_table_hanging", ex)

    def test_track_patch(self):
        def ex(p):
            f = P0.facts(p)
            e0 = f["v0"] ** 2 if f["variant"] == 1 else 0.0
            return {"g": G, "h": f["h"], "d": f["d"], "mu": f["mu"], "v0": f["v0"]}, math.sqrt(e0 + 2 * G * (f["h"] - f["mu"] * f["d"]))
        self.run_each("ph_sym_track_patch", ex)

    def test_collision(self):
        def ex(p):
            f = P0.facts(p); m1, m2, v1, v2 = f["m1"], f["m2"], f["v1"], f["v2"]
            val = [m1 * v1 / (m1 + m2), (m1 * v1 - m2 * v2) / (m1 + m2), m1 * v1 / m2][int(f["variant"])]
            return {"m1": m1, "m2": m2, "v1": v1, "v2": v2}, val
        self.run_each("ph_sym_collision", ex)

    def test_beam_cable(self):
        def ex(p):
            f = P0.facts(p); th = math.radians(f["theta_deg"])
            return {"M": f["M"], "m": f["m"], "theta": th, "g": G}, ((f["M"] / 2 + (f["m"] if f["variant"] == 1 else 0)) * G / math.sin(th))
        self.run_each("ph_sym_beam_cable", ex)

    def test_spring_speed(self):
        def ex(p):
            f = P0.facts(p); m, k, A, x = f["m"], f["k"], f["A"], f["x"]
            return {"m": m, "k": k, "A": A, "x": x}, (A * math.sqrt(k / m) if f["variant"] == 0 else math.sqrt(k * (A * A - x * x) / m))
        self.run_each("ph_sym_spring_speed", ex)

    def test_float_force(self):
        def ex(p):
            f = P0.facts(p)
            env = {"rhob": f["rhob"], "rhof": f["rhof"], "rhoo": f["rhoo"], "V": f["V"], "g": G}
            return env, (f["rhob"] / f["rhof"] if f["variant"] == 0 else (f["rhoo"] - f["rhof"]) * f["V"] * G)
        self.run_each("ph_sym_float_force", ex)

    def test_vertical_throw(self):
        def ex(p):
            f = P0.facts(p); v0, h = f["v0"], f["h"]
            val = [v0 * v0 / (2 * G), 2 * v0 / G, math.sqrt(v0 * v0 + 2 * G * h)][int(f["variant"])]
            return {"v0": v0, "g": G, "h": h}, val
        self.run_each("ph_sym_vertical_throw", ex)


class RankTruth(unittest.TestCase):
    """2.C: 키 순위가 facts 로 다시 계산한 값의 순서와 같고, 정답 값 사이가 벌어져 있으며, 오답 순위 3개가 모두 서로·정답과 다르다."""

    def packs(self, name, seeds=8, base=3300):
        out = R.batch(name, seeds, base)
        self.assertGreaterEqual(len(out), 5, name)
        for p in out:
            texts = [o["text"] for o in p["options"]]
            self.assertEqual(len(set(texts)), 4)
            for t in texts:
                self.assertEqual(sorted(t.split(" > ")), list("ABCD"), name)
            self.assertTrue(all(o["value"] is None for o in p["options"]))
        return out

    def check(self, name, values, tie=MIN_REL_SEP):
        for p in self.packs(name):
            v = values(p)
            order = sorted("ABCD", key=lambda L: -v[L])
            self.assertEqual(key_of(p)["text"], " > ".join(order), f"{name} {p['facts']}")
            self.assertEqual(fj(p, "order"), order)
            srt = [v[L] for L in order]
            for a, b in zip(srt, srt[1:]):
                self.assertGreater(a - b, tie * abs(a) - 1e-12, f"{name} tie in {srt}")

    def test_accel(self):
        self.check("ph_rank_accel", lambda p: {L: fj(p, "F")[i] / fj(p, "m")[i] for i, L in enumerate("ABCD")})

    def test_rolling(self):
        def v(p):
            qty = int(P0.facts(p)["qty"]); ks = fj(p, "k"); ms = fj(p, "m")
            base = {L: 1 / (1 + ks[i]) for i, L in enumerate("ABCD")}
            if qty == 0:
                return base
            if qty == 1:
                return {L: ms[i] * base[L] for i, L in enumerate("ABCD")}
            return {L: -math.sqrt(1 + ks[i]) for i, L in enumerate("ABCD")}
        self.check("ph_rank_rolling", v, tie=0.03)

    def test_impulse(self):
        self.check("ph_rank_impulse", lambda p: {L: fj(p, "m")[i] * fj(p, "vi")[i] * (1 + fj(p, "mode")[i]) for i, L in enumerate("ABCD")})

    def test_torque(self):
        self.check("ph_rank_torque", lambda p: {L: fj(p, "F")[i] * fj(p, "r")[i] * math.sin(math.radians(fj(p, "theta")[i])) for i, L in enumerate("ABCD")})

    def test_period(self):
        self.check("ph_rank_period", lambda p: {L: 2 * math.pi * math.sqrt(fj(p, "p1")[i] / fj(p, "p2")[i]) for i, L in enumerate("ABCD")})

    def test_pressure(self):
        self.check("ph_rank_pressure", lambda p: {L: fj(p, "rho")[i] * G * fj(p, "h")[i] for i, L in enumerate("ABCD")})

    def test_stop_distance(self):
        self.check("ph_rank_stop_distance", lambda p: {L: fj(p, "v0")[i] ** 2 / (2 * fj(p, "a")[i]) for i, L in enumerate("ABCD")})

    def test_ramp_bottom(self):
        def v(p):
            qty = int(P0.facts(p)["qty"]); hs = fj(p, "h"); ms = fj(p, "m")
            return {L: (math.sqrt(2 * G * hs[i]) if qty == 0 else ms[i] * G * hs[i]) for i, L in enumerate("ABCD")}
        self.check("ph_rank_ramp_bottom", v)

    def test_wrong_rankings_are_named_rules(self):
        for n in SKILL_OF["2.C"]:
            for p in R.batch(n, 4, 3400):
                for i, o in enumerate(p["options"]):
                    if i != p["key_index"]:
                        self.assertRegex(o["why"], r"^(Ranks|Treats)", n)


class SymbolicTruth2(SymbolicTruth):
    """phys_p0_h 의 2.A 3개."""

    def test_orbit(self):
        def ex(p):
            f = P0.facts(p); GM = f["GM"]; r = f["r"]; Gv = 6.674e-11
            return {"G": Gv, "Mp": GM / Gv, "ms": 500.0, "r": r}, (math.sqrt(GM / r) if f["variant"] == 0 else 2 * math.pi * math.sqrt(r ** 3 / GM))
        self.run_each("ph_sym_orbit", ex)

    def test_pendulum_bottom(self):
        def ex(p):
            f = P0.facts(p); th = math.radians(f["theta_deg"]); L = f["L"]; m = f["m"]
            return {"g": G, "L": L, "theta": th, "m": m}, (math.sqrt(2 * G * L * (1 - math.cos(th))) if f["variant"] == 0 else m * G * (3 - 2 * math.cos(th)))
        self.run_each("ph_sym_pendulum_bottom", ex)

    def test_bounce_force(self):
        def ex(p):
            f = P0.facts(p)
            return {"m": f["m"], "vi": f["vi"], "vf": f["vf"], "Delta": 1.0, "t": f["dt"]}, (f["m"] * (f["vi"] + f["vf"]) / f["dt"] if f["variant"] == 0 else f["m"] * f["vi"] / f["dt"])
        self.run_each("ph_sym_bounce_force", ex)


class RankTruth2(unittest.TestCase):
    check = RankTruth.check
    packs = RankTruth.packs

    def test_centripetal(self):
        def v(p):
            qty = int(P0.facts(p)["qty"])
            return {L: fj(p, "v")[i] ** 2 / fj(p, "r")[i] * (1 if qty == 0 else fj(p, "m")[i]) for i, L in enumerate("ABCD")}
        self.check("ph_rank_centripetal", v)

    def test_work(self):
        self.check("ph_rank_work", lambda p: {L: fj(p, "F")[i] * fj(p, "d")[i] * math.cos(math.radians(fj(p, "theta")[i])) for i, L in enumerate("ABCD")})


class PredictionTruth2(unittest.TestCase):
    def test_orbit(self):
        for p in R.batch("ph_pred_orbit", 8, 3500):
            f = P0.facts(p); a = f["a"]; exp = 1 / math.sqrt(a) if f["variant"] == 0 else a ** 1.5
            self.assertAlmostEqual(P0.key_value(p), exp, delta=0.01 * exp)

    def test_collision_speed(self):
        for p in R.batch("ph_pred_collision_speed", 8, 3500):
            f = P0.facts(p); exp = (f["m"] * f["v"] / (f["m"] + f["b"] * f["m"])) / (f["m"] * f["v"] / (2 * f["m"]))
            self.assertAlmostEqual(P0.key_value(p), exp, delta=0.01 * exp)

    def test_projectile_scale(self):
        for p in R.batch("ph_pred_projectile_scale", 9, 3500):
            f = P0.facts(p); a = f["a"]; exp = [a * a, a * a, a][int(f["variant"])]
            self.assertAlmostEqual(P0.key_value(p), exp, delta=0.01 * exp)


class EvidenceTruth2(unittest.TestCase):
    def test_position_data(self):
        for p in R.batch("ph_evid_position_data", 8, 3700):
            xs = fj(p, "x"); a = P0.facts(p)["a"]
            d = [xs[i + 1] - xs[i] for i in range(4)]; dd = [d[i + 1] - d[i] for i in range(3)]
            for q in dd:
                self.assertAlmostEqual(q, a, places=6)
            self.assertAlmostEqual(2 * np.polyfit([0, 1, 2, 3, 4], xs, 2)[0], a, places=6)
            self.assertIn(f"{a:g}", key_of(p)["text"])
            self.assertEqual([float(r[1]) for r in p["stimulus"]["data"]["rows"]], xs)

    def test_energy_data(self):
        for p in R.batch("ph_evid_energy_data", 8, 3700):
            hs, vs = fj(p, "h"), fj(p, "v"); q = [v * v / h for v, h in zip(vs, hs)]
            self.assertLess(max(q) - min(q), 0.09 * np.mean(q))
            self.assertAlmostEqual(np.mean(q), fj(p, "mean_v2_over_h"), places=9)
            self.assertAlmostEqual(np.mean(q) / (2 * G), 1.0, delta=0.08)
            self.assertIn(f"{np.mean(q):.3g}", key_of(p)["text"])
            vh = [v / h for v, h in zip(vs, hs)]
            self.assertGreater(max(vh) / min(vh), 1.4)




class PredictionTruth(unittest.TestCase):
    def test_stop_factor(self):
        for p in R.batch("ph_pred_stop_factor", 6, 3500):
            f = P0.facts(p); self.assertAlmostEqual(P0.key_value(p), f["a"] ** 2, places=6)
            self.assertNotAlmostEqual(f["a"] ** 2, f["a"] * f["b"])
            self.assertTrue(all(abs(float(o["value"]) - f["a"] ** 2) > 0.05 * f["a"] ** 2 for i, o in enumerate(p["options"]) if i != p["key_index"]))

    def test_centripetal(self):
        for p in R.batch("ph_pred_centripetal", 6, 3500):
            f = P0.facts(p); exp = (f["m"] * (f["a"] * f["v0"]) ** 2 / (f["b"] * f["r0"])) / (f["m"] * f["v0"] ** 2 / f["r0"])
            self.assertAlmostEqual(P0.key_value(p), exp, delta=0.01 * exp)

    def test_fluid_scale(self):
        for p in R.batch("ph_pred_fluid_scale", 8, 3500):
            f = P0.facts(p); a, b, v = f["a"], f["b"], int(f["variant"])
            exp = [a * b, 1 / b, a ** 3][v]
            self.assertAlmostEqual(P0.key_value(p), exp, delta=0.01 * exp)
            self.assertAlmostEqual(f["val"], exp, places=9)

    def test_spring_pe(self):
        for p in R.batch("ph_pred_spring_pe", 8, 3500):
            f = P0.facts(p)
            exp = (0.5 * f["b"] * f["k"] * (f["a"] * f["x"]) ** 2 / (0.5 * f["k"] * f["x"] ** 2)) if f["variant"] == 0 else 1 / f["b"]
            self.assertAlmostEqual(P0.key_value(p), exp, delta=0.01 * exp)


class ClaimAndEvidenceTruth(unittest.TestCase):
    def test_const_velocity_key_has_the_balancing_force(self):
        for p in R.batch("ph_claim_const_velocity", 8, 3600):
            f = P0.facts(p); k = key_of(p)["text"]
            if f["case"] == 2:
                self.assertIn(f"{f['m'] * G:.0f}", k)
            else:
                self.assertIn(f"{f['F']:g}", k)
            self.assertRegex(k, r"net force")

    def test_momentum_system_key_speed(self):
        for p in R.batch("ph_claim_momentum_system", 8, 3600):
            f = P0.facts(p); case = int(f["case"]); k = key_of(p)["text"]
            exp = [f["m1"] * f["v1"] / f["m2"], f["m1"] * f["v1"] / f["m2"], f["m1"] * f["v1"] / (f["m1"] + f["m2"])][case]
            self.assertIn(f"{exp:.3g}", k)
            self.assertIn("momentum", k)
            wrong_nums = {re.search(r"\$(\d+\.?\d*)\\text\{ m/s\}", o["text"]).group(1) for i, o in enumerate(p["options"]) if i != p["key_index"] and re.search(r"\$(\d+\.?\d*)\\text\{ m/s\}", o["text"])}
            self.assertNotIn(f"{exp:.3g}", wrong_nums)

    def test_angular_momentum_key(self):
        for p in R.batch("ph_claim_angular_momentum", 8, 3600):
            f = P0.facts(p); k = key_of(p)["text"]
            if f["case"] == 0:
                self.assertIn(f"{f['w0'] * f['f']:.3g}", k); self.assertIn("kinetic energy is greater", k)
            else:
                Id = 0.5 * f["M"] * f["R"] ** 2; self.assertIn(f"{Id * f['w0'] / (Id + f['m'] * f['R'] ** 2):.3g}", k)

    def test_buoyancy_key(self):
        for p in R.batch("ph_claim_buoyancy", 8, 3600):
            f = P0.facts(p); k = key_of(p)["text"]
            if f["case"] == 0:
                self.assertIn(f"{f['m'] * G:.3g}", k)
            elif f["case"] == 1:
                self.assertIn(f"{1000 * f['V'] * G:.2f}", k)
            self.assertRegex(k, r"displace|at rest|net force")

    def test_shm_key(self):
        for p in R.batch("ph_claim_shm_energy", 9, 3600):
            f = P0.facts(p); k = key_of(p)["text"]; w = math.sqrt(f["k"] / f["m"]); case = int(f["case"])
            exp = [f["A"] * w, 2 * math.pi / w, f["k"] * f["A"] / f["m"]][case]
            self.assertIn(f"{exp:.3g}", k)

    def test_torque_balance_key_is_balance_distance(self):
        for p in R.batch("ph_claim_torque_balance", 8, 3600):
            f = P0.facts(p); self.assertAlmostEqual(f["m1"] * f["d1"], f["m2"] * f["d2"], places=9)
            k = key_of(p)["text"]
            self.assertIn("torques", k)
            if f["case"] == 1:
                self.assertIn(f"{f['d2']:.3g}", k)

    def test_free_fall_keys(self):
        for p in R.batch("ph_claim_free_fall", 9, 3600):
            f = P0.facts(p); k = key_of(p)["text"]
            if f["case"] == 1:
                self.assertIn(f"{math.sqrt(2 * f['h'] / G):.3g}", k)
            self.assertNotRegex(k, r"zero acceleration")

    def test_force_data_ratio(self):
        for p in R.batch("ph_evid_force_data", 6, 3700):
            Fs, a = fj(p, "F"), fj(p, "a"); ratios = [F / x for F, x in zip(Fs, a)]
            self.assertLess(max(ratios) - min(ratios), 0.07 * np.mean(ratios))
            self.assertAlmostEqual(fj(p, "mean_ratio"), float(np.mean(ratios)), places=9)
            self.assertIn(f"{np.mean(ratios):.2g}", key_of(p)["text"])
            rows = p["stimulus"]["data"]["rows"]
            self.assertEqual(len(rows), 5)
            self.assertEqual([float(r[0]) for r in rows], [round(F, 2) for F in Fs])
            self.assertLess(abs(np.polyfit(Fs, a, 1)[0] - 1 / np.mean(ratios)), 0.05 / np.mean(ratios))

    def test_pendulum_data_exponent(self):
        for p in R.batch("ph_evid_pendulum_data", 6, 3700):
            Ls, Ts = fj(p, "L"), fj(p, "T")
            self.assertAlmostEqual(np.polyfit(np.log(Ls), np.log(Ts), 1)[0], 0.5, delta=0.035)
            c = [T * T / L for T, L in zip(Ts, Ls)]
            self.assertIn(f"{np.mean(c):.3g}", key_of(p)["text"])
            self.assertGreater(max(T / L for T, L in zip(Ts, Ls)) / min(T / L for T, L in zip(Ts, Ls)), 1.5)

    def test_collision_data(self):
        for p in R.batch("ph_evid_collision_data", 8, 3700):
            f = P0.facts(p); m1, m2, v1, u1, u2 = f["m1"], f["m2"], f["v1"], f["u1"], f["u2"]
            self.assertAlmostEqual(m1 * v1, m1 * u1 + m2 * u2, places=9)
            K0 = 0.5 * m1 * v1 ** 2; K1 = 0.5 * m1 * u1 ** 2 + 0.5 * m2 * u2 ** 2; k = key_of(p)["text"]
            if f["elastic"]:
                self.assertAlmostEqual(K0, K1, places=9); self.assertIn("elastic", k); self.assertNotIn("inelastic", k)
            else:
                self.assertGreater(K0 - K1, 0.1 * K0); self.assertIn("inelastic", k); self.assertIn(f"{K1:.3g}", k)


if __name__ == "__main__":
    unittest.main()
