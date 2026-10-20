"""AP Microeconomics P0 원형 테스트(무료, 네트워크·DB·LLM 없음). unittest 기반이라 `python -m unittest test_micro_p0` 또는 pytest 로 돈다(Vitest 래퍼: lib/ap-generation/micro-archetypes.test.ts).
검사: 시드 결정성 / 구조 중복 없음 / 선택지 구조(5개·유일 정답·간격·오개념 why) / 허용 스킬·토픽 / 수치 진실 테스트(facts 로 독립 재계산) / 그래프 점이 곡선 위 / 공식 단원·스킬 범주·수치 분석 범위 정수계획 / FRQ 구조·과제 유형 비중."""
import itertools, json, math, random, re, unittest
import numpy as np
import registry as R
import micro_coverage as C
from micro_common import MIN_REL_SEP

MC = R.MICRO_STAGES["micro_mc_all"]
FRQ = R.MICRO_STAGES["micro_frq"]
MC_SKILLS_OK = set(C.MC_SKILLS)
curriculum = json.load(open("../../../data/ap/curriculum-2027/ap_microeconomics.json"))
TOPICS = {t["code"] for u in curriculum["units"] for t in u["topics"]}
SKILLS = {s["code"] for s in curriculum["skills"]}
# 그림이 곡선 위에 있지 않은 표식을 일부러 쓰는 원형(점이 곡선 안/밖)
OFF_CURVE = {"mi_ppc_graph_points"}


def facts(p):
    out = {}
    for f in p["facts"]:
        if "=" in f:
            k, v = f.split("=", 1)
            try:
                out[k] = float(v)
            except ValueError:
                out[k] = v
    return out


def key_value(q):
    return float(q["options"][q["key_index"]]["value"])


class Determinism(unittest.TestCase):
    def test_same_seed_same_pack(self):
        for n in MC + FRQ:
            fn = (R.MICRO.get(n) or R.MICRO_FRQ.get(n))[0]
            for sd in range(300, 340):
                try:
                    a = fn(random.Random(sd))
                except Exception:
                    continue
                self.assertEqual(json.dumps(a, sort_keys=True), json.dumps(fn(random.Random(sd)), sort_keys=True), n)
                break
            else:
                self.fail(f"{n}: no seed produced a pack")

    def test_library_size_and_registration(self):
        self.assertGreaterEqual(len(MC), 90)
        self.assertEqual(len(FRQ), 9)  # 8 + mif_short_shutdown(MI3, 2026-10-19)
        self.assertEqual(len(set(MC + FRQ)), len(MC + FRQ))
        self.assertEqual(set(R.MICRO_STAGES["micro_p1_mc"]) - set(MC), set())
        self.assertEqual(len(R.MICRO_STAGES["micro_p1_mc"]), 22)
        self.assertEqual(len(R.MICRO_STAGES["micro_p1_frq"]), 8)


class NoDuplicateStructures(unittest.TestCase):
    def test_batches_have_distinct_signatures(self):
        for n in MC:
            b = R.batch(n, 5, 900)
            self.assertGreaterEqual(len(b), 3, f"{n}: fewer than 3 distinct packs in 400 seeds")
            self.assertEqual(len({R.sig(p) for p in b}), len(b), n)

    def test_stems_are_not_shared_between_different_archetypes(self):
        seen = {}
        for n in MC:
            for p in R.batch(n, 2, 100):
                key = re.sub(r"[\d.]+", "#", p["stem"])
                if key in seen and seen[key] != n:
                    self.fail(f"{n} and {seen[key]} share the stem structure: {key[:80]}")
                seen[key] = n


class OptionStructure(unittest.TestCase):
    def test_every_mc_item(self):
        for n in MC:
            for p in R.batch(n, 4, 40):
                opts = p["options"]
                self.assertEqual(len(opts), 5, n)
                self.assertEqual(len({o["text"] for o in opts}), 5, f"{n}: duplicate option texts")
                whys = [o["why"] for i, o in enumerate(opts) if i != p["key_index"]]
                self.assertEqual(len(set(whys)), 4, f"{n}: duplicate misconception explanations")
                for w in whys:
                    self.assertTrue(w and len(w) >= 25, f"{n}: distractor without a named misconception")
                self.assertTrue(opts[p["key_index"]]["why"], n)
                self.assertIn(p["skill"], MC_SKILLS_OK, n)
                self.assertIn(p["topic"], TOPICS, n)
                self.assertIn(p["skill"], SKILLS)
                self.assertTrue(p["blueprint"]["verification"]["independent_path"], n)
                self.assertGreaterEqual(len(p["blueprint"]["misconceptions"]), 3, n)
                self.assertTrue(p["blueprint"]["model"]["initial_state"], n)

    def test_currency_is_plain_text_and_no_tex(self):
        for n in MC:
            for p in R.batch(n, 3, 60):
                for t in [p["stem"]] + [o["text"] for o in p["options"]]:
                    self.assertNotIn("\\", t, f"{n}: backslash in text: {t[:60]}")
                    self.assertFalse(re.search(r"\d[eE]-?\d", t), f"{n}: raw exponent: {t[:60]}")

    def test_no_option_letter_references(self):
        for n in MC:
            for p in R.batch(n, 3, 70):
                for o in p["options"]:
                    self.assertFalse(re.search(r"\(?\b[A-E]\)(?=\s|$)|\b[Oo]ption [A-E]\b|\b[Cc]hoice [A-E]\b", o["why"] or ""), f"{n}: letter reference in why: {o['why'][:60]}")

    def test_key_is_not_a_length_giveaway(self):
        """gates.ts 의 key_much_longer 규칙(키가 가장 길고 평균의 1.6배 초과, 18자 초과)을 같은 방식으로 미리 잡는다."""
        bad = []
        for n in MC:
            for p in R.batch(n, 12, 200):
                lens = [len(o["text"]) for o in p["options"]]
                mean = sum(lens) / len(lens)
                k = lens[p["key_index"]]
                if k == max(lens) and k > mean * 1.6 and k > 18:
                    bad.append(n)
        self.assertEqual(sorted(set(bad)), [], "key much longer than the distractors")

    def test_key_position_is_not_constant(self):
        pos = [p["key_index"] for n in MC for p in R.batch(n, 3, 10)]
        self.assertGreaterEqual(len(set(pos)), 5)

    def test_numeric_option_spacing(self):
        for n in MC:
            for p in R.batch(n, 5, 120):
                vals = [o["value"] for o in p["options"]]
                if any(v is None for v in vals):
                    continue
                v = [float(x) for x in vals]
                for i in range(5):
                    for j in range(i + 1, 5):
                        a, b = v[i], v[j]
                        self.assertGreaterEqual(abs(a - b), MIN_REL_SEP * max(abs(a), abs(b)) - 1e-9, f"{n}: options too close {a} {b}")


class NumericTruth(unittest.TestCase):
    """각 원형의 키를 facts 만으로 테스트가 직접 다시 계산한다(원형 코드의 이중 경로와는 별개의 세 번째 계산)."""

    def run_check(self, name, fn, count=6):
        done = 0
        for p in R.batch(name, count, 0):
            f = facts(p)
            exp = fn(f)
            got = key_value(p)
            self.assertAlmostEqual(got, exp, delta=max(abs(exp) * 2e-3, 1e-9), msg=f"{name} {f}")
            done += 1
        self.assertGreaterEqual(done, 3, name)

    def test_elasticity_family(self):
        self.run_check("mi_pe_midpoint", lambda f: abs((f["Q1"] - f["Q0"]) / ((f["Q1"] + f["Q0"]) / 2)) / abs((f["P1"] - f["P0"]) / ((f["P1"] + f["P0"]) / 2)))
        self.run_check("mi_pe_pct", lambda f: -f["ed"] * f["dp"])
        for p in R.batch("mi_cross_price", 6, 0):
            f = facts(p)
            x = f["pctQ"] / f["pctP"]
            self.assertAlmostEqual(float(p["options"][p["key_index"]]["value"]), x, delta=1e-6)
            self.assertIn("substitutes" if x > 0 else "complements", p["options"][p["key_index"]]["text"])

    def test_market_and_policy(self):
        self.run_check("mi_equilibrium_numeric", lambda f: (f["a"] * f["d"] + f["c"] * f["b"]) / (f["b"] + f["d"]))
        self.run_check("mi_shortage_numeric", lambda f: abs((f["a"] - f["b"] * f["P1"]) - (f["c"] + f["d"] * f["P1"])))
        self.run_check("mi_price_floor_surplus", lambda f: (f["c"] + f["d"] * f["floor"]) - (f["a"] - f["b"] * f["floor"]))
        self.run_check("mi_import_numeric", lambda f: (f["a"] - f["b"] * f["pw"]) - (f["c"] + f["d"] * f["pw"]))
        self.run_check("mi_per_unit_tax", lambda f: f["a"] - f["b"] * ((f["a"] - f["c"] + f["d"] * f["t"]) / (f["b"] + f["d"])))
        self.run_check("mi_tax_incidence_numeric", lambda f: f["d"] * f["t"] / (f["b"] + f["d"]))
        self.run_check("mi_dwl_tax", lambda f: 0.5 * f["t"] * (f["Q0"] - f["Qt"]))

    def test_surplus_and_price_control(self):
        self.run_check("mi_surplus_numeric", lambda f: 0.5 * (f["A"] - f["Q0"] * 0 - f["P0"]) * f["Q0"] if f["which"] == "consumer" else 0.5 * (f["P0"] - f["C"]) * f["Q0"])
        for p in R.batch("mi_price_control_graph", 10, 0):
            f = facts(p)
            from fractions import Fraction as Fr
            B, D = float(Fr(str(f["B"]))), float(Fr(str(f["D"])))
            qd, qs = (f["A"] - f["Pc"]) / B, (f["Pc"] - f["C"]) / D
            binding = (f["kind"] == "ceiling" and f["Pc"] < f["P0"]) or (f["kind"] == "floor" and f["Pc"] > f["P0"])
            self.assertEqual(binding, str(f["binding"]) == "True")
            self.assertAlmostEqual(f["traded"], min(qd, qs) if binding else f["Q0"], delta=1e-6)

    def test_cost_family(self):
        self.run_check("mi_cost_table_mc", lambda f: f["a"] + f["b"] * (2 * f["n"] - 1))
        self.run_check("mi_profit_numeric", lambda f: (f["P"] - f["atc"]) * f["q"])
        self.run_check("mi_pc_graph_profit", lambda f: f["profit"])
        for p in R.batch("mi_profit_types", 6, 0):
            f = facts(p)
            exp = f["rev"] - f["expl"] - (f["impl"] if f["which"] == "economic" else 0)
            self.assertAlmostEqual(key_value(p), exp, delta=1e-6)
        for p in R.batch("mi_shutdown_decision", 8, 0):
            f = facts(p)
            fc = (f["atc"] - f["avc"]) * f["q"]
            op = (f["atc"] - f["P"]) * f["q"]
            self.assertEqual(float(p["options"][p["key_index"]]["value"]), min(fc, op))
            self.assertEqual(("shut down" if f["P"] < f["avc"] else "continue"), "shut down" if "shut down" in p["options"][p["key_index"]]["text"] else "continue")

    def test_market_structure_family(self):
        for p in R.batch("mi_monopoly_numeric", 9, 0):
            f = facts(p)
            q = (f["A"] - f["m"]) / (2 * f["B"]); pr = f["A"] - f["B"] * q
            exp = {"quantity": q, "price": pr, "profit": (pr - f["m"]) * q}[f["which"]]
            self.assertAlmostEqual(key_value(p), exp, delta=1e-6)
        self.run_check("mi_monopoly_dwl", lambda f: f["dwl"])
        self.run_check("mi_hhi", lambda f: f["hhi"])
        for p in R.batch("mi_cr4", 5, 0):
            sh = json.loads(re.search(r"shares=(\[.*\])", [x for x in p["facts"] if x.startswith("shares=")][0]).group(1))
            self.assertAlmostEqual(key_value(p), sum(sorted(sh)[-4:]), delta=1e-9)

    def test_factor_and_externality_family(self):
        self.run_check("mi_mrp_value", lambda f: f["mrp"])
        for p in R.batch("mi_hire_table", 6, 0):
            f = facts(p)
            tp = json.loads([x for x in p["facts"] if x.startswith("tp=")][0][3:])
            mrps = [(tp[i] - tp[i - 1]) * f["P"] for i in range(1, 6)]
            self.assertEqual(key_value(p), sum(1 for m in mrps if m >= f["w"]))
        self.run_check("mi_ext_graph", lambda f: f["Q0"] - f["qeff"])
        for p in R.batch("mi_pigou_numeric", 6, 0):
            tab = json.loads([x for x in p["facts"] if x.startswith("table=")][0][6:].replace("(", "[").replace(")", "]"))
            qeff = max(q for q, mb, mc, me in tab if mb > mc + me)
            self.assertEqual(key_value(p), tab[qeff - 1][3])

    def test_unit1_family(self):
        for p in R.batch("mi_opp_cost_choice", 6, 0):
            pay = json.loads([x for x in p["facts"] if x.startswith("pay=")][0][4:])
            self.assertEqual(key_value(p), sorted(pay)[-2])
        for p in R.batch("mi_mb_mc_table", 6, 0):
            mb = json.loads([x for x in p["facts"] if x.startswith("mb=")][0][3:]); mc = json.loads([x for x in p["facts"] if x.startswith("mc=")][0][3:])
            self.assertEqual(key_value(p), max(i + 1 for i in range(6) if mb[i] > mc[i]))
        for p in R.batch("mi_ppc_opp_cost", 6, 0):
            pts = json.loads([x for x in p["facts"] if x.startswith("pts=")][0][4:].replace("(", "[").replace(")", "]")); i = int(facts(p)["i"])
            self.assertAlmostEqual(key_value(p), (pts[i][1] - pts[i + 1][1]) / (pts[i + 1][0] - pts[i][0]), delta=0.006)


class GraphChecks(unittest.TestCase):
    @staticmethod
    def _interp(vs, x):
        for (x0, y0), (x1, y1) in zip(vs, vs[1:]):
            if min(x0, x1) - 1e-9 <= x <= max(x0, x1) + 1e-9:
                if x1 == x0:
                    return y0
                return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
        return None

    def test_labeled_points_lie_on_curves_and_inside_axes(self):
        count = 0
        for n in MC:
            for p in R.batch(n, 3, 30):
                st = p["stimulus"]
                if st["kind"] != "graph":
                    continue
                count += 1
                d = st["data"]
                curves = d.get("curves") or [{"label": "", "vertices": d["vertices"]}]
                self.assertGreaterEqual(len(curves), 1, n)
                for c in curves:
                    self.assertTrue(c["label"] or len(curves) == 1, n)
                    self.assertGreaterEqual(len(c["vertices"]), 2, n)
                xs, ys = d["x_axis"], d["y_axis"]
                for c in curves:
                    for q, pr in c["vertices"]:
                        self.assertLessEqual(q, xs["max"] + 1e-6, f"{n}: curve beyond x axis")
                        self.assertGreaterEqual(q, xs["min"] - 1e-6, n)
                        self.assertLessEqual(pr, ys["max"] + 1e-6, f"{n}: curve above y axis {pr}")
                        self.assertGreaterEqual(pr, ys["min"] - 1e-6, n)
                for pt in d.get("labeled_points", []):
                    self.assertTrue(xs["min"] <= pt["Q"] <= xs["max"] and ys["min"] <= pt["P"] <= ys["max"], f"{n}: marker outside axes")
                    if n in OFF_CURVE:
                        continue
                    on = any((self._interp(c["vertices"], pt["Q"]) is not None) and abs(self._interp(c["vertices"], pt["Q"]) - pt["P"]) <= 0.51 for c in curves)
                    self.assertTrue(on, f"{n}: marker {pt} is on no curve")
        self.assertGreaterEqual(count, 12)

    def test_curve_labels_are_mentioned_in_the_stem(self):
        """그림 게이트는 본문(stem)에 나오지 않는 곡선 라벨을 지운다(범례가 'Curve 1' 로 바뀐다). 모든 곡선 라벨이 본문에 나와야 한다."""
        bad = set()
        for n in MC:
            for p in R.batch(n, 2, 30):
                st = p["stimulus"]
                if st["kind"] != "graph":
                    continue
                for c in st["data"].get("curves", []):
                    lab = c["label"]
                    if not re.search(r"(?<![A-Za-z0-9])" + re.escape(lab) + r"(?![A-Za-z0-9])", p["stem"]):
                        bad.add(f"{n}:{lab}")
        self.assertEqual(sorted(bad), [])


class Coverage(unittest.TestCase):
    """2026-10-13 물리의 스킬 쏠림 교훈: 라이브러리 한 벌로 공식 범위 안의 60문항 시험이 조립되는지 정수계획으로 보장한다."""

    def test_official_bounds_values(self):
        self.assertEqual({k: C.count_bounds(v) for k, v in C.UNIT_MC.items()}, {"1": (7, 9), "2": (12, 15), "3": (13, 15), "4": (9, 14), "5": (6, 8), "6": (4, 8)})
        self.assertEqual({k: C.count_bounds(v) for k, v in C.CAT_MC.items()}, {"1": (18, 26), "2": (22, 29), "3": (9, 15)})
        self.assertEqual(C.count_bounds(C.NUMERIC_MC), (12, 18))

    def test_every_mc_skill_has_an_archetype_and_graphs_exist(self):
        tags = C.tags_from_registry()
        unit, cat, skill = C.library_counts(tags)
        self.assertEqual(set(skill), set(C.MC_SKILLS))
        for u, (lo, hi) in {u: C.count_bounds(v) for u, v in C.UNIT_MC.items()}.items():
            self.assertGreaterEqual(unit[u], hi, f"unit {u} library smaller than the exam maximum")
        stim = [R.batch(n, 1, 0)[0]["stimulus"]["kind"] for n in MC]
        self.assertGreaterEqual(stim.count("graph"), 12)
        self.assertGreaterEqual(stim.count("payoff_matrix"), 2)

    def test_exam_assembles_inside_official_ranges(self):
        tags = C.tags_from_registry()
        ok, sel, msg = C.assemble_check(tags)
        self.assertTrue(ok, msg)
        self.assertEqual(len(sel), 60)
        ok2, sel2, msg2 = C.assemble_check(tags, forbid=set(sel[::6]))
        self.assertTrue(ok2, msg2)  # 한 시험의 원형 6분의 1 을 잃어도 또 다른 시험이 조립된다

    def test_exam_still_assembles_when_the_library_loses_a_tenth(self):
        tags = C.tags_from_registry()
        drop = set(sorted(tags)[::10])
        ok, sel, msg = C.assemble_check(tags, forbid=drop)
        self.assertTrue(ok, msg)


class FrqStructure(unittest.TestCase):
    def test_points_rows_and_modes(self):
        w = {"long": 10, "short": 5}
        for n in FRQ:
            for p in R.batch(n, 3, 0):
                self.assertEqual(p["total_points"], 10 if n.startswith("mif_long") else 5, n)
                self.assertEqual(sum(pt["points"] for pt in p["parts"]), p["total_points"], n)
                self.assertIn(p["topic"], TOPICS)
                for pt in p["parts"]:
                    self.assertIn(pt["response_mode"], C.MODE_TYPE, n)
                    self.assertEqual(sum(r["points"] for r in pt["rubric_rows"]), pt["points"], n)
                    for s in pt["skill_codes"]:
                        self.assertIn(s, SKILLS)
                    for t in pt["topic_codes"]:
                        self.assertIn(t, TOPICS)
                    if pt["response_mode"] == "draw":
                        self.assertTrue(all(s.startswith("4.") for s in pt["skill_codes"]), n)
                    for r in pt["rubric_rows"]:
                        self.assertTrue(r["meaning_based"], n)
                        self.assertGreaterEqual(len(r["alt_solutions"]), 2, f"{n} {r['row_id']}")
                        self.assertGreaterEqual(len(r["common_errors"]), 1, f"{n} {r['row_id']}")
                self.assertEqual(p["blueprint"]["model"]["key_assumptions_id"], p["blueprint"]["model"]["explanation_assumptions_id"])

    def test_numeric_rows_match_recomputed_facts(self):
        for p in R.batch("mif_long_pc_firm", 6, 0):
            f = facts(p)
            F = f["b"] * f["k"] ** 2
            tc = lambda q: F + f["a"] * q + f["b"] * q * q
            best = max(range(0, 9), key=lambda q: f["P2"] * q - tc(q))
            self.assertEqual(best, f["qstar"])
            self.assertEqual(f["P2"] * best - tc(best), f["profit"])
            self.assertIn(str(int(f["profit"])), p["parts"][1]["rubric_rows"][1]["required_elements"])
        for p in R.batch("mif_long_monopoly", 6, 0):
            f = facts(p)
            q = (f["A"] - f["m"]) / (2 * f["B"])
            self.assertEqual(q, f["Qm"])
            self.assertEqual((f["A"] - f["B"] * q - f["m"]) * q - f["F"], f["profit"])
        for p in R.batch("mif_long_market_policy", 6, 0):
            f = facts(p)
            qd, qs = f["a"] - f["b"] * f["Pc"], f["c"] + f["d"] * f["Pc"]
            self.assertIn(str(int(qd - qs)), p["parts"][3]["rubric_rows"][1]["required_elements"])
            self.assertGreater(f["hi"], f["P0"])
        for p in R.batch("mif_short_elasticity", 6, 0):
            f = facts(p)
            e = abs((f["Q1"] - f["Q0"]) / ((f["Q1"] + f["Q0"]) / 2) / ((f["P1"] - f["P0"]) / ((f["P1"] + f["P0"]) / 2)))
            self.assertAlmostEqual(e, f["e"], places=3)

    def test_exam_level_task_type_ranges_have_two_disjoint_valid_exams(self):
        packs = {n: R.batch(n, 1, 0)[0] for n in FRQ + ["frq_micro_game", "frq_micro_monopoly"]}
        longs = [n for n, p in packs.items() if p["total_points"] == 10]; shorts = [n for n, p in packs.items() if p["total_points"] == 5]
        good = [(L, a, b) for L in longs for a, b in itertools.combinations(shorts, 2) if C.frq_exam_ok([packs[L], packs[a], packs[b]])[0]]
        self.assertGreaterEqual(len(good), 6)
        pairs = [(x, y) for x in good for y in good if not (set(x) & set(y))]
        self.assertGreaterEqual(len(pairs), 1, "no two disjoint valid FRQ exams")
        pts, tot = C.frq_task_points([packs[n] for n in good[0]])
        self.assertEqual(tot, 20)
        self.assertGreaterEqual(pts["graph"], 6)


if __name__ == "__main__":
    unittest.main()
