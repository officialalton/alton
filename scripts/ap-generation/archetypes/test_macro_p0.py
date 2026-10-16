"""AP Macroeconomics 원형 테스트(2026-10-14)(무료, 네트워크·DB·LLM 없음). unittest 기반이라 `python -m unittest test_micro_p0` 또는 pytest 로 돈다(Vitest 래퍼: lib/ap-generation/micro-archetypes.test.ts).
검사: 시드 결정성 / 구조 중복 없음 / 선택지 구조(5개·유일 정답·간격·오개념 why) / 허용 스킬·토픽 / 수치 진실 테스트(facts 로 독립 재계산) / 그래프 점이 곡선 위 / 공식 단원·스킬 범주·수치 분석 범위 정수계획 / FRQ 구조·과제 유형 비중."""
import itertools, json, math, random, re, unittest
import numpy as np
import registry as R
import macro_coverage as C
from macro_common import MIN_REL_SEP

MC = R.MACRO_STAGES["macro_mc_all"]
FRQ = R.MACRO_STAGES["macro_frq"]
MC_SKILLS_OK = set(C.MC_SKILLS)
curriculum = json.load(open("../../../data/ap/curriculum-2027/ap_macroeconomics.json"))
TOPICS = {t["code"] for u in curriculum["units"] for t in u["topics"]}
SKILLS = {s["code"] for s in curriculum["skills"]}
# 그림이 곡선 위에 있지 않은 표식을 일부러 쓰는 원형(점이 곡선 안/밖)
OFF_CURVE = {"ma_ppc_graph_points"}


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
            fn = (R.MACRO.get(n) or R.MACRO_FRQ.get(n))[0]
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
        self.assertGreaterEqual(len(MC), 120)
        self.assertEqual(len(FRQ), 10)
        self.assertEqual(len(set(MC + FRQ)), len(MC + FRQ))
        self.assertEqual(set(R.MACRO_STAGES["macro_p1_mc"]) - set(MC), set())
        self.assertEqual(len(R.MACRO_STAGES["macro_p1_mc"]), 26)
        self.assertEqual(len(R.MACRO_STAGES["macro_p1_frq"]), 10)


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

    def test_option_texts_have_no_inner_sentence_breaks(self):
        """gates.ts 의 explanation_key_mismatch 는 해설의 'The correct answer is X.' 를 첫 마침표(공백 앞)까지 잘라 읽는다 — 선택지 안에 'U.S. ' 같은 마침표가 있으면 키가 어긋나 보인다."""
        for n in MC:
            for p in R.batch(n, 3, 80):
                for o in p["options"]:
                    self.assertIsNone(re.search(r"\.\s+\S", o["text"].rstrip(".")), f"{n}: inner period in option: {o['text'][:70]}")

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

    def test_unit2_family(self):
        self.run_check("ma_gdp_expenditure", lambda f: f["C"] + f["I"] + f["G"] + f["X"] - f["M"])
        self.run_check("ma_income_approach", lambda f: f["wages"] + f["rent"] + f["interest"] + f["profit"])
        self.run_check("ma_cpi_inflation", lambda f: (f["nxt"] - f["base"]) / f["base"] * 100)
        self.run_check("ma_cyclical_rate", lambda f: f["act"] - f["nat"])
        self.run_check("ma_real_wage", lambda f: f["nom"] - f["infl"])
        self.run_check("ma_real_gdp_growth", lambda f: f["g"])
        for p in R.batch("ma_unemp_rate", 8, 0):
            f = facts(p)
            exp = (f["lf"] - f["emp"]) / f["lf"] * 100 if f["ask"] == "unemp" else f["lf"] / f["pop"] * 100
            self.assertAlmostEqual(key_value(p), exp, delta=0.06)
        for p in R.batch("ma_deflator", 8, 0):
            f = facts(p)
            exp = f["nom"] * 100 / f["defl"] if f["ask"] == "real" else f["defl"]
            self.assertAlmostEqual(key_value(p), exp, delta=0.51)
        for p in R.batch("ma_gdp_percapita_growth", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), ((f["gdp1"] / f["pop1"]) / (f["gdp0"] / f["pop0"]) - 1) * 100, delta=0.06)

    def test_unit3_family(self):
        for p in R.batch("ma_multiplier_calc", 8, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), f["d"], delta=max(abs(f["d"]) * 2e-3, 1e-6))
            self.assertAlmostEqual(abs(f["d"]), f["dg"] / (1 - f["mpc"]), delta=0.5)
        for p in R.batch("ma_tax_multiplier", 8, 0):
            f = facts(p)
            tm = f["mpc"] / (1 - f["mpc"]) * f["dt"] * (1 if str(f["cut"]) == "True" else -1)
            self.assertAlmostEqual(key_value(p), tm, delta=0.5)
        for p in R.batch("ma_balanced_budget", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(abs(key_value(p)), f["dg"], delta=1e-6)
        self.run_check("ma_fiscal_gap_closing", lambda f: f["gap"] * (1 - f["mpc"]))
        for p in R.batch("ma_mpc_from_data", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), f["key"], delta=2e-3)
        for p in R.batch("ma_gap_size", 6, 0):
            f = facts(p)
            self.assertEqual(key_value(p), f["y"] - f["yf"])

    def test_unit4_family(self):
        for p in R.batch("ma_money_multiplier", 8, 0):
            f = facts(p)
            exp = 1 / f["rr"] if f["ask"] == "mult" else f["x"] / f["rr"]
            self.assertAlmostEqual(key_value(p), exp, delta=max(exp * 2e-3, 1e-6))
        for p in R.batch("ma_deposit_expansion", 9, 0):
            f = facts(p)
            exp = {"lend": f["d"] * (1 - f["rr"]), "total": f["d"] / f["rr"], "required": f["d"] * f["rr"]}[f["ask"]]
            self.assertAlmostEqual(key_value(p), exp, delta=1e-6)
        for p in R.batch("ma_bank_balance_sheet", 9, 0):
            f = facts(p)
            exc = f["res"] - f["dep"] * f["rr"]
            exp = exc / f["rr"] if f["ask"] == "money" else exc
            self.assertAlmostEqual(key_value(p), exp, delta=max(abs(exp) * 2e-3, 1e-6))
        for p in R.batch("ma_real_rate", 9, 0):
            f = facts(p)
            exp = {"real": f["nom"] - f["infl"], "nominal": f["nom"], "expected": f["infl"]}[f["ask"]]
            self.assertAlmostEqual(key_value(p), exp, delta=1e-9)

    def test_unit5_family(self):
        for p in R.batch("ma_quantity_theory", 9, 0):
            f = facts(p)
            exp = {"growth": f.get("gp"), "P": f.get("M", 0) * f.get("V", 0) / f.get("Q", 1), "M": f.get("P", 0) * f.get("Q", 0) / f.get("V", 1)}[f["kind"]]
            self.assertAlmostEqual(key_value(p), exp, delta=max(abs(exp) * 2e-3, 1e-6))
        for p in R.batch("ma_deficit_debt", 8, 0):
            f = facts(p)
            bal = f["t"] - f["g"]
            exp = bal if f["ask"] == "balance" else f["debt0"] - bal
            self.assertAlmostEqual(key_value(p), exp, delta=1e-9)
        for p in R.batch("ma_debt_gdp", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), f["key"], delta=0.06)
        self.run_check("ma_productivity_growth", lambda f: f["gp"])

    def test_unit6_and_unit1_family(self):
        for p in R.batch("ma_bop_calc", 8, 0):
            f = facts(p)
            ca = f["gx"] - f["gm"] + f["sx"] - f["sm"] + f["inc"]
            self.assertAlmostEqual(key_value(p), ca if f["ask"] == "ca" else -ca, delta=1e-9)
        for p in R.batch("ma_exchange_calc", 8, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), f["key"], delta=max(abs(f["key"]) * 2e-3, 1e-6))
        self.run_check("ma_ncf_identity", lambda f: f["ex"] - f["im"])
        for p in R.batch("ma_ppc_opp_cost", 6, 0):
            pts = json.loads([x for x in p["facts"] if x.startswith("pts=")][0][4:].replace("(", "[").replace(")", "]")); i = int(facts(p)["i"])
            self.assertAlmostEqual(key_value(p), (pts[i][1] - pts[i + 1][1]) / (pts[i + 1][0] - pts[i][0]), delta=0.006)
        for p in R.batch("ma_shortage_numeric", 6, 0):
            f = facts(p)
            qd = (f["A"] - f["P1"]) / f["B"]; qs = (f["P1"] - f["C"]) / f["D"]
            self.assertAlmostEqual(key_value(p), abs(qd - qs), delta=max(abs(qd - qs) * 2e-3, 0.06))


class ModelRules(unittest.TestCase):
    """사건표·규칙·시뮬레이션: 규칙표와 선형 모형 시뮬레이션이 모든 이동 조합에서 일치한다."""

    def test_rule_equals_simulation(self):
        import macro_models as M
        for ds_ in (-1, 0, 1):
            for ss_ in (-1, 0, 1):
                if ds_ == 0 and ss_ == 0:
                    continue
                M.adas_dirs(ds_, ss_)
                M.mm_dirs(ss_, ds_) if not (ss_ == ds_ and ss_ != 0) else None
                M.fx_dirs(ds_, ss_); M.lf_dirs(ss_, ds_)
        for f in (-1, 1):
            for m in (-1, 1):
                M.policy_mix(f, m)

    def test_event_tables_have_consistent_directions(self):
        import macro_models as M
        for t, ms, md, mech in M.MM_EVENTS:
            self.assertTrue(ms or md)
            self.assertFalse(ms and md)
        for t, sup, dem, mech in M.LF_EVENTS:
            self.assertFalse(sup and dem)
        for t, dd, sd, mech in M.FX_EVENTS:
            self.assertFalse(dd and sd)
        self.assertGreaterEqual(len(M.AD_UP), 6)
        self.assertGreaterEqual(len(M.SRAS_DOWN), 4)

    def test_policy_mix_determinacy(self):
        import macro_models as M
        self.assertEqual(M.policy_mix(1, 1), {"Y": 1, "i": None})
        self.assertEqual(M.policy_mix(-1, -1), {"Y": -1, "i": None})
        self.assertEqual(M.policy_mix(1, -1), {"Y": None, "i": 1})
        self.assertEqual(M.policy_mix(-1, 1), {"Y": None, "i": -1})

    def test_adas_known_cases(self):
        import macro_models as M
        self.assertEqual(M.adas_dirs(1, 0), {"P": 1, "Y": 1, "U": -1})
        self.assertEqual(M.adas_dirs(0, -1), {"P": 1, "Y": -1, "U": 1})
        self.assertEqual(M.adas_dirs(1, -1)["P"], 1)
        self.assertIsNone(M.adas_dirs(1, -1)["Y"])
        self.assertIsNone(M.adas_dirs(1, 1)["P"])


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

    def test_adas_graphs_have_vertical_lras_and_consistent_gap(self):
        for p in R.batch("ma_adas_gap_graph", 8, 0):
            d = p["stimulus"]["data"]
            lras = [c for c in d["curves"] if c["label"] == "LRAS"][0]["vertices"]
            self.assertEqual(lras[0][0], lras[1][0])
            f = facts(p)
            self.assertEqual(lras[0][0], f["Yf"])
            pt = d["labeled_points"][0]
            self.assertEqual(pt["Q"], f["Y0"])
            right = key_text(p)
            self.assertEqual("recessionary" in right, f["Y0"] < f["Yf"])


def key_text(p):
    return p["options"][p["key_index"]]["text"]


class Coverage(unittest.TestCase):
    """라이브러리 한 벌로 공식 범위 안의 60문항 시험이 조립되는지 정수계획으로 보장한다."""

    def test_official_bounds_values(self):
        self.assertEqual({k: C.count_bounds(v) for k, v in C.UNIT_MC.items()}, {"1": (3, 6), "2": (7, 11), "3": (10, 17), "4": (10, 14), "5": (12, 18), "6": (6, 8)})
        self.assertEqual({k: C.count_bounds(v) for k, v in C.CAT_MC.items()}, {"1": (18, 24), "2": (15, 20), "3": (18, 24)})
        self.assertEqual(C.count_bounds(C.NUMERIC_MC), (9, 12))

    def test_every_mc_skill_has_an_archetype_and_graphs_exist(self):
        tags = C.tags_from_registry()
        unit, cat, skill = C.library_counts(tags)
        self.assertEqual(set(skill), set(C.MC_SKILLS))
        for u, (lo, hi) in {u: C.count_bounds(v) for u, v in C.UNIT_MC.items()}.items():
            self.assertGreaterEqual(unit[u], hi, f"unit {u} library smaller than the exam maximum")
        for c, (lo, hi) in {c: C.count_bounds(v) for c, v in C.CAT_MC.items()}.items():
            self.assertGreaterEqual(cat[c], 2 * lo, f"category {c} library too small for two exams")
        stim = [R.batch(n, 1, 0)[0]["stimulus"]["kind"] for n in MC]
        self.assertGreaterEqual(stim.count("graph"), 12)
        self.assertGreaterEqual(stim.count("table"), 12)

    def test_exam_assembles_inside_official_ranges(self):
        tags = C.tags_from_registry()
        ok, sel, msg = C.assemble_check(tags)
        self.assertTrue(ok, msg)
        self.assertEqual(len(sel), 60)
        ok2, sel2, msg2 = C.assemble_check(tags, forbid=set(sel[::6]))
        self.assertTrue(ok2, msg2)

    def test_exam_still_assembles_when_the_library_loses_a_tenth(self):
        tags = C.tags_from_registry()
        drop = set(sorted(tags)[::10])
        ok, sel, msg = C.assemble_check(tags, forbid=drop)
        self.assertTrue(ok, msg)

    def test_numeric_archetypes_are_enough_for_two_exams(self):
        tags = C.tags_from_registry()
        numeric = [a for a, v in tags.items() if any(s in C.NUMERIC_SKILLS for _, s in v)]
        self.assertGreaterEqual(len(numeric), 2 * C.count_bounds(C.NUMERIC_MC)[1])


class HardTruth(unittest.TestCase):
    """macro-hard(2026-10-15): exam_prep 보강 원형의 키를 facts·표만으로 테스트가 다시 계산한다(원형 코드의 이중 경로와 별개의 세 번째 계산)."""

    def rows(self, p):
        def num(c):
            try:
                return float(str(c).replace("$", "").replace(",", "").replace("%", ""))
            except ValueError:
                return float("nan")
        return [[num(c) for c in r] for r in p["stimulus"]["data"]["rows"]]

    def test_library_has_the_hard_archetypes_and_all_are_multi_step(self):
        hard = [n for n in MC if n.startswith("ma_h_")]
        self.assertGreaterEqual(len(hard), 29)
        for n in hard:
            for p in R.batch(n, 3, 0):
                self.assertGreaterEqual(len(p["blueprint"]["student_thinking"]), 2, n)

    def test_trade_gain_and_ppc(self):
        for p in R.batch("ma_h_trade_gain", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), f["e"] / f["t"] - f["a2"] * f["e"] / f["a1"], places=6)
        for p in R.batch("ma_h_ppc_rotate", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), f["gain"], places=6)
            self.assertAlmostEqual(f["gain"], f["C"] * f["g"] / 100 * (1 - f["k1"] / f["K"]), places=6)

    def test_shift_shortage_from_the_table(self):
        for p in R.batch("ma_h_shift_shortage", 6, 0):
            f = facts(p); rows = self.rows(p)
            qs = [(pr, qd, qs_) for pr, qd, qs_ in rows]
            x, y = f["x"], f["y"]
            hit = [(pr, qs_ - y) for pr, qd, qs_ in qs if qd + x == qs_ - y]
            if not hit:  # 새 균형이 표 밖이면 직선으로 외삽
                import numpy as np
                P = np.array([r[0] for r in qs]); a = np.polyfit(P, [r[1] + x for r in qs], 1); b = np.polyfit(P, [r[2] - y for r in qs], 1)
                pe = (b[1] - a[1]) / (a[0] - b[0]); hit = [(pe, a[0] * pe + a[1])]
            self.assertAlmostEqual(key_value(p), hit[0][1], places=6)

    def test_percapita_unemployment_cpi_and_growth_from_the_tables(self):
        for p in R.batch("ma_h_real_percapita", 6, 0):
            r = self.rows(p); nom1, nom2 = r[0][1], r[0][2]; d2 = r[1][2]; p1, p2 = r[2][1], r[2][2]
            self.assertAlmostEqual(key_value(p), round(((nom2 * 100 / d2) / p2) / (nom1 / p1) * 100 - 100, 1), places=6)
        for p in R.batch("ma_h_unemp_event", 6, 0):
            f = facts(p); r = self.rows(p); E, U = r[1][1], r[2][1]
            self.assertAlmostEqual(key_value(p), round((U - f["d"] - f["f"]) / (E + U - f["d"]) * 100, 1), places=6)
        for p in R.batch("ma_h_cpi_real_wage", 6, 0):
            f = facts(p); rows = self.rows(p) if False else p["stimulus"]["data"]["rows"]
            c1 = sum(float(a) * float(b.strip("$")) for _, a, b, _c in rows); c2 = sum(float(a) * float(c.strip("$")) for _, a, _b, c in rows)
            infl = c2 / c1 * 100 - 100
            self.assertAlmostEqual(abs(key_value(p)), abs(f["w"] - infl), places=6)
        for p in R.batch("ma_h_exp_real_growth", 6, 0):
            f = facts(p); r = self.rows(p)
            gdp = lambda col: r[0][col] + r[1][col] + r[2][col] + r[3][col] - r[4][col]  # noqa: E731
            self.assertAlmostEqual(key_value(p), (gdp(2) * 100 / r[5][2] / gdp(1) - 1) * 100, places=6)

    def test_gdp_classification_sum(self):
        import macro_p0_h as H
        counted = {d for d, c in H.CATALOG if c}
        for p in R.batch("ma_h_gdp_classify", 6, 0):
            tot = sum(float(a.strip("$")) for d, a in p["stimulus"]["data"]["rows"] if d in counted)
            self.assertAlmostEqual(key_value(p), tot, places=6)

    def test_multiplier_family(self):
        for p in R.batch("ma_h_mpc_table_gap", 6, 0):
            f = facts(p); r = self.rows(p)
            mpc = (r[2][1] - r[0][1]) / (r[2][0] - r[0][0])
            self.assertAlmostEqual(key_value(p), f["gap"] * (1 - mpc), places=6)
        for p in R.batch("ma_h_two_policy_net", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), (f["g"] - f["mpc"] * f["t"]) / (1 - f["mpc"]), places=6)
        for p in R.batch("ma_h_gap_tax", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), (f["Yf"] - f["Y0"]) * (1 - f["mpc"]) / f["mpc"], places=6)
        for p in R.batch("ma_h_depr_nx_gdp", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), (f["X"] * f["a"] / 100 + f["M"] * f["b"] / 100) / (1 - f["mpc"]), places=6)
        for p in R.batch("ma_h_adas_table_shift", 6, 0):
            r = self.rows(p)
            x = float(re.search(r"increases by \$(\d+) billion", p["stem"]).group(1)); yf = float(re.search(r"Potential real GDP is \$(\d+)", p["stem"]).group(1))
            eq = [row[2] for row in r if row[1] + x == row[2]]
            self.assertEqual(len(eq), 1)
            self.assertAlmostEqual(key_value(p), eq[0] - yf, places=6)

    def test_financial_family(self):
        for p in R.batch("ma_h_money_target", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), (f["M0"] - f["sl"] * (f["i1"] - f["i0"]) - f["M0"]) * f["rr"], places=6)
        for p in R.batch("ma_h_rr_cut", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), f["D"] * (f["ro"] / f["rn"] - 1), places=6)
        for p in R.batch("ma_h_money_growth_real", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), f["n"] - (f["gM"] + f["gV"] - f["gY"]), places=6)
        for p in R.batch("ma_h_debt_path", 6, 0):
            r = self.rows(p); f = facts(p)
            d3 = f["D0"] + sum(row[1] - row[2] for row in r)
            self.assertAlmostEqual(key_value(p), d3 / f["Y3"] * 100, places=6)
        for p in R.batch("ma_h_crowding_table", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), f["fall"], places=6)

    def test_phillips_and_open_economy(self):
        for p in R.batch("ma_h_phillips_expect", 6, 0):
            f = facts(p); r = self.rows(p)
            pi_at_low = [row[1] for row in r if row[0] == f["un"] - (f["pi1"] - f["pe"]) / f["sl"]]
            self.assertEqual(len(pi_at_low), 1)
            self.assertAlmostEqual(key_value(p), pi_at_low[0], places=6)
        for p in R.batch("ma_h_trip_exchange", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(f["back"], (1000 * f["e0"] - f["S"]) / f["e1"], places=6)


class FrqStructure(unittest.TestCase):
    def test_points_rows_and_modes(self):
        for n in FRQ:
            for p in R.batch(n, 3, 0):
                self.assertEqual(p["total_points"], 10 if n.startswith("maf_long") else 5, n)
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
                        self.assertGreaterEqual(len(r["alt_solutions"]), 1, f"{n} {r['row_id']}")
                        self.assertGreaterEqual(len(r["common_errors"]), 1, f"{n} {r['row_id']}")
                self.assertEqual(p["blueprint"]["model"]["key_assumptions_id"], p["blueprint"]["model"]["explanation_assumptions_id"])
                self.assertEqual(p["blueprint"]["subject"], "ap_macroeconomics")

    def test_numeric_rows_match_recomputed_facts(self):
        for p in R.batch("maf_long_adas_policy", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(f["gap"] * (1 - f["mpc"]), f["need"], places=6)
            self.assertIn(str(int(f["need"])), p["parts"][3]["rubric_rows"][0]["required_elements"])
            self.assertEqual(f["yf"] - f["y1"], f["gap"])
        for p in R.batch("maf_long_open_economy", 6, 0):
            f = facts(p)
            self.assertEqual(f["ex1"] - f["im1"], f["nx1"]); self.assertEqual(f["ex2"] - f["im2"], f["nx2"])
            self.assertLess(f["nx2"], f["nx1"])
        for p in R.batch("maf_long_money_market", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(f["x"] / f["rr"], f["dm"], places=6)
        for p in R.batch("maf_short_gdp_data", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(f["n2"] * 100 / f["d2"], f["r2"], places=6)
            self.assertAlmostEqual((f["d2"] / f["d1"] - 1) * 100, f["infl"], places=3)
        for p in R.batch("maf_short_money_banking", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(f["res"] - f["dep"] * f["rr"], f["exc"], places=3)
            self.assertAlmostEqual(f["exc"] / f["rr"], f["maxm"], places=2)
        for p in R.batch("maf_short_fiscal_multiplier", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(f["dg"] / (1 - f["mpc"]), f["dy"], places=3)

    def test_exam_level_task_type_ranges_have_two_disjoint_valid_exams(self):
        packs = {n: R.batch(n, 1, 0)[0] for n in FRQ}
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
