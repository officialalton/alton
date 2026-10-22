"""AP Chemistry P0 원형 테스트(무료, 네트워크·DB·LLM 없음). unittest 기반이라 `python -m unittest test_chem_p0` 또는 pytest 로 돈다(Vitest 래퍼: lib/ap-generation/chemistry-archetypes.test.ts).
검사: 시드 결정성 / 구조 중복 없음 / 선택지 구조(4개·유일 정답·간격·오개념 why) / 허용 스킬·토픽 / 수치 진실 테스트(facts 로 독립 재계산) / 그림 장면 검사 / FRQ 배점·행 구조·스킬 비중 / 스킬·단원 범위 정수계획."""
import json, math, random, re, unittest
import xml.etree.ElementTree as ET
import numpy as np
import registry as R
import chem_coverage as C
import chem_figs as F
import chem_common as CC
from chem_common import MASS, formula_mass, R_ATM, R_J, F_CONST, KW, CONSTS

MC = R.CHEM_STAGES["chem_mc_all"]
SETS = R.CHEM_STAGES["chem_sets"]
FRQ = R.CHEM_STAGES["chem_frq"]
ALL_MC = MC + SETS
MC_SKILLS_OK = set(C.MC_SKILLS)  # 3.x 는 MC 에서 평가되지 않는다
# 값이 pH·원자량처럼 한 단위가 작은 문항은 상대 8% 대신 절대 간격을 쓴다(chem_common.abs_opts 에 간격이 명시돼 있다)
ABS_GAP = {"ch_t5_buffer_after_base", "ch_t5_ph_weak_acid", "ch_t5_ph_weak_base", "ch_t5_ph_after_dilution", "ch_t5_strong_base_ph", "ch_t5_cell_potential_sum", "ch_t5_nernst_cell", "ch_t5_delta_g_from_e", "ch_t5_delta_g_hs", "ch_t5_delta_g_from_k", "ch_t5_buffer_ratio_for_ph", "ch_t5_isotope_abundance_from_avg", "chs_t5_hess_table_set_q1", "chs_t5_hess_table_set_q2", "chs_t5_metal_specific_heat_set_q1", "ch_strong_ph", "ch_weak_acid_ph", "ch_buffer_ph", "ch_average_atomic_mass", "ch_successive_ie", "ch_cell_potential", "ch_nernst", "ch_buret_data", "ch_beer_procedure", "ch_balance_combustion", "ch_particulate_limiting",
           "ch_mass_spec_peaks", "ch_lewis_lone_pairs", "chs_titration_set_q2", "ch_formal_charge", "ch_hess_law", "ch_bond_enthalpy", "ch_formation_enthalpy", "ch_calorimetry", "ch_cell_deltag", "ch_energy_profile", "ch_gibbs_k", "ch_ice_table", "ch_n_ph_strong_base", "ch_n_buffer_after_acid", "ch_n_halfway_titration_ph", "ch_n_entropy_reaction", "ch_n_gibbs_hs", "chs_gibbs_temperature_set_q1", "chs_gibbs_temperature_set_q2", "chs_calorimeter_dissolve_set_q1", "chs_calorimeter_dissolve_set_q2"}
FRQ_FORM_1 = ["chf_long_kinetics", "chf_long_thermo", "chf_long_titration", "chf_short_bonding", "chf_short_equilibrium", "chf_short_pes", "chf_short_stoich"]
FRQ_FORM_2 = ["chf_long_buffer", "chf_long_calorimetry", "chf_long_ksp", "chf_short_gas_mix", "chf_short_massspec", "chf_short_neutral", "chf_short_solution"]
curriculum = json.load(open("../../../data/ap/curriculum-2027/ap_chemistry.json"))
TOPICS = {t["code"] for u in curriculum["units"] for t in u["topics"]}
SKILLS = {s["code"] for s in curriculum["skills"]}


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
                out[k] = v
    return out


def key_value(q):
    return float(q["options"][q["key_index"]]["value"])


class Determinism(unittest.TestCase):
    def test_same_seed_same_pack(self):
        for n in ALL_MC + FRQ:
            fn = (R.CHEM.get(n) or R.CHEM_FRQ.get(n))[0]
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
        self.assertEqual(SETS, ["chs_calorimeter_dissolve_set", "chs_equilibrium_set", "chs_gibbs_temperature_set", "chs_rate_set", "chs_t5_equilibrium_table_set", "chs_t5_hess_table_set", "chs_t5_ksp_table_set", "chs_t5_metal_specific_heat_set", "chs_titration_set"])
        self.assertEqual(FRQ, sorted(FRQ_FORM_1 + FRQ_FORM_2))
        self.assertEqual(len(set(MC + SETS + FRQ)), len(MC + SETS + FRQ))


class NoDuplicateStructures(unittest.TestCase):
    def test_batches_have_distinct_signatures(self):
        for n in ALL_MC:
            b = R.batch(n, 6, 900)
            self.assertGreaterEqual(len(b), 4, f"{n}: fewer than 4 distinct packs in 400 seeds")
            self.assertEqual(len({R.sig(p) + str(p.get("set_intro")) for p in b}), len(b), n)

    def test_stems_are_not_shared_between_different_archetypes(self):
        seen = {}
        for n in ALL_MC:
            for p in R.batch(n, 2, 100):
                for q in items(p):
                    key = re.sub(r"[\d.]+", "#", q["stem"])
                    if key in seen and seen[key] != n and not n.startswith("chs_"):
                        self.fail(f"{n} and {seen[key]} share the stem structure: {key[:80]}")
                    seen[key] = n


class OptionStructure(unittest.TestCase):
    def test_every_mc_item(self):
        for n in ALL_MC:
            for p in R.batch(n, 4, 40):
                for q in items(p):
                    opts = q["options"]
                    self.assertEqual(len(opts), 4, n)
                    self.assertEqual(len({o["text"] for o in opts}), 4, f"{n}: duplicate option texts")
                    self.assertEqual(sum(1 for i in range(4) if i == q["key_index"]), 1)
                    for i, o in enumerate(opts):
                        if i != q["key_index"]:
                            self.assertTrue(o["why"] and len(o["why"]) >= 15, f"{n}: distractor without a named misconception")
                    self.assertIn(q["skill"], MC_SKILLS_OK, n)
                    self.assertIn(q["topic"], TOPICS, n)
                    self.assertIn(q["skill"], SKILLS)
                    self.assertTrue(q["blueprint"]["verification"]["independent_path"], n)
                    self.assertGreaterEqual(len(q["blueprint"]["misconceptions"]), 3, n)

    def test_math_wrapped_and_no_raw_scientific_notation(self):
        for n in ALL_MC:
            for p in R.batch(n, 3, 60):
                for q in items(p):
                    for t in [q["stem"]] + [o["text"] for o in q["options"]]:
                        self.assertFalse(re.search(r"\d[eE]-?\d", re.sub(r"\$[^$]*\$", "", t)), f"{n}: raw exponent outside math: {t[:60]}")
                        self.assertFalse(re.search(r"\\(mathrm|text|rightarrow|Delta|times)", re.sub(r"\$[^$]*\$", "", t)), f"{n}: TeX outside $...$: {t[:60]}")
                        self.assertEqual(t.count("$") % 2, 0, f"{n}: unbalanced $: {t[:60]}")

    def test_key_is_not_a_length_giveaway(self):
        """gates.ts 의 key_much_longer 규칙(키가 가장 길고 평균의 1.6배 초과, 18자 초과)을 같은 방식으로 미리 잡는다."""
        plain = lambda s: re.sub(r"[{}^_]", "", re.sub(r"\\[a-zA-Z]+", "", s.replace("$", "")))
        bad = []
        for n in ALL_MC:
            for p in R.batch(n, 12, 200):
                for q in items(p):
                    lens = [len(plain(o["text"])) for o in q["options"]]
                    mean = sum(lens) / 4
                    k = lens[q["key_index"]]
                    if k == max(lens) and k > mean * 1.6 and k > 18:
                        bad.append(n)
        self.assertEqual(sorted(set(bad)), [], "key much longer than the distractors")

    def test_numeric_option_spacing(self):
        for n in ALL_MC:
            for p in R.batch(n, 5, 120):
                for q in items(p):
                    vals = [o["value"] for o in q["options"]]
                    if any(v is None for v in vals):
                        continue
                    v = [float(x) for x in vals]
                    for i in range(4):
                        for j in range(i + 1, 4):
                            a, b = v[i], v[j]
                            if q["archetype"] in ABS_GAP or n in ABS_GAP:
                                self.assertGreater(abs(a - b), 1e-9, n)
                            else:
                                self.assertGreaterEqual(abs(a - b), CC.MIN_REL_SEP * max(abs(a), abs(b)) - 1e-12, f"{n}: options too close {a} {b}")


def _parse_pH(q):
    return float(re.sub(r"[^0-9.\-]", "", q["options"][q["key_index"]]["text"]))


class NumericTruth(unittest.TestCase):
    """각 원형의 키를 facts 만으로 테스트가 직접 다시 계산한다(원형 코드의 이중 경로와는 별개의 세 번째 계산)."""

    def run_check(self, name, fn, seeds=range(0, 12)):
        done = 0
        for p in R.batch(name, 6, 0):
            for q in items(p):
                f = facts(q if "facts" in q else p)
                exp = fn(f)
                got = key_value(q)
                self.assertAlmostEqual(got, exp, delta=max(abs(exp) * 2e-3, 1e-9), msg=f"{name} {f}")
                done += 1
        self.assertGreaterEqual(done, 3, name)

    def test_ideal_gas_family(self):
        for p in R.batch("ch_ideal_gas", 9, 0):
            f = facts(p)
            key = key_value(p)
            unknown = [v for v in ("V", "P", "n") if abs(f[v] - key) <= 2e-3 * abs(key)]
            self.assertTrue(unknown, f"key {key} matches none of V, P, n in {f}")
            T = f["Tc"] + 273.15
            self.assertAlmostEqual(f["P"] * f["V"], f["n"] * R_ATM * T, delta=4e-3 * f["n"] * R_ATM * T)
        self.run_check("ch_combined_gas", lambda f: f["P1"] * f["V1"] * (f["T2c"] + 273.15) / ((f["T1c"] + 273.15) * f["V2"]))
        self.run_check("ch_gas_molar_mass", lambda f: f["d"] * R_ATM * (f["Tc"] + 273.15) / f["P"])

    def test_dilution_and_first_order(self):
        self.run_check("ch_dilution", lambda f: f["M2"] * f["V2"] / f["M1"] if f["ask"] == "stock" else f["V2"] - f["M2"] * f["V2"] / f["M1"])
        self.run_check("ch_first_order_decay", lambda f: f["A0"] * math.exp(-f["k"] * f["t"]))

    def test_weak_acid_ph_and_ka(self):
        for p in R.batch("ch_weak_acid_ph", 6, 0):
            f = facts(p)
            x = np.roots([1, f["Ka"], -f["Ka"] * f["c"]]).max()
            self.assertAlmostEqual(_parse_pH(p), -math.log10(x), delta=0.006)
        for p in R.batch("ch_strong_ph", 8, 0):
            f = facts(p)
            mult = 2 if "(OH)2" in f["kind"] else 1
            exp = -math.log10(f["c"]) if f["kind"] in ("HCl", "HNO3") else 14 + math.log10(mult * f["c"])
            self.assertAlmostEqual(_parse_pH(p), exp, delta=0.006)

    def test_thermo_and_electro(self):
        self.run_check("ch_gibbs_k", lambda f: math.exp(-f["dG"] * 1000 / (R_J * f["T"])))
        self.run_check("ch_photon_energy", lambda f: CONSTS["h"] * CONSTS["c"] / (f["lam"] * 1e-9))
        self.run_check("ch_faraday", lambda f: f["I"] * f["tmin"] * 60 * {"Cu": 63.55, "Ag": 107.87, "Zn": 65.38, "Ni": 58.69, "Al": 26.98, "Cr": 52.00}[f["met"]] / (f["n"] * F_CONST))
        self.run_check("ch_nernst", lambda f: f["E0"] - R_J * 298.0 / (f["n"] * F_CONST) * math.log(f["Q"]))
        self.run_check("ch_gibbs_temperature", lambda f: abs(f["dH"] * 1000 / f["dS"]))
        self.run_check("ch_formation_enthalpy", lambda f: f["dH"])
        self.run_check("ch_hess_law", lambda f: f["dH"])
        self.run_check("ch_bond_enthalpy", lambda f: f["dH"])

    def test_cell_potential(self):
        E = {"Mg2+/Mg": -2.37, "Zn2+/Zn": -0.76, "Fe2+/Fe": -0.44, "Ni2+/Ni": -0.25, "Pb2+/Pb": -0.13, "Cu2+/Cu": 0.34, "Ag+/Ag": 0.80}
        self.run_check("ch_cell_potential", lambda f: E[f["cathode"]] - E[f["anode"]])

    def test_stoichiometry_family(self):
        def lim(f):
            ma, mb = f["ma"], f["mb"]; a, b, c = (float(x) for x in f["coefs"].split(","))
            na, nb = ma / formula_mass(f["fa"]), mb / formula_mass(f["fb"])
            return min(na / a, nb / b) * c * formula_mass(f["fp"])
        self.run_check("ch_limiting_reagent", lim)
        self.run_check("ch_percent_yield", lambda f: f["pct"])
        self.run_check("ch_titration_conc", lambda f: f["Mb"] * f["Vb"] / f["ratio"] / f["Va"])

    def test_percent_and_moles(self):
        for p in R.batch("ch_percent_composition", 6, 0):
            self.assertAlmostEqual(key_value(p), 100 * float(facts(p)["el_mass"]) / float(facts(p)["M"]), delta=0.05)
        for p in R.batch("ch_moles_of_atoms", 6, 0):
            f = facts(p)
            self.assertAlmostEqual(key_value(p), float(f["n"]), delta=2e-3 * float(f["n"]))

    def test_equilibrium_family(self):
        self.run_check("ch_k_expression", lambda f: f["Kc"])
        self.run_check("ch_k_manipulation", lambda f: f["K1"] ** f["a"] * f["K2"] ** f["b"])

        def ksp(f):
            a, b, k = f["a"], f["b"], f["ksp"]
            lo, hi = 0.0, 1.0
            for _ in range(200):
                mid = (lo + hi) / 2
                if (a * mid) ** a * (b * mid) ** b < k:
                    lo = mid
                else:
                    hi = mid
            return lo
        self.run_check("ch_ksp_solubility", ksp)

        def ice(f):
            K, A0 = f["K"], f["A0"]
            lo, hi = 0.0, A0
            for _ in range(200):
                mid = (lo + hi) / 2
                if (2 * mid) ** 2 < K * (A0 - mid):
                    lo = mid
                else:
                    hi = mid
            return 2 * lo
        self.run_check("ch_ice_table", ice)

    def test_kinetics_family(self):
        self.run_check("ch_rate_law_initial", lambda f: f["key"])
        self.run_check("ch_heating_curve", lambda f: f["q"])
        self.run_check("ch_energy_profile", lambda f: f["key"])

    def test_misc_numeric(self):
        self.run_check("ch_average_atomic_mass", lambda f: (f["m1"] * f["a1"] + f["m2"] * f["a2"]) / 100)
        self.run_check("ch_chromatography", lambda f: f["rf"])
        self.run_check("ch_calorimetry", lambda f: f["dH"])
        self.run_check("ch_partial_pressure", lambda f: f["Pk"])


class FigureChecks(unittest.TestCase):
    def test_pes_and_particles_stimuli(self):
        for n in ("ch_pes_identify", "ch_pes_subshell", "ch_particulate_limiting", "ch_particle_phase", "ch_particle_solution_formula"):
            for p in R.batch(n, 6, 0):
                for q in items(p):
                    st = q.get("stimulus") or p["stimulus"]
                    self.assertEqual(st["kind"], "diagram", n)
                    data = st["data"]
                    self.assertNotIn("z", data, n)  # 원자 번호는 화면 데이터(정답 누출)에 넣지 않는다
                    if data["variant"] == "chem_pes":
                        z = next((int(f.split("=")[1]) for f in p["facts"] if f.startswith("z=")), None)
                        self.assertEqual(F.check_pes(F.scene_of("chem_pes", data), z), [], n)
                    else:
                        self.assertEqual(F.check_particles(data["scene"]), [], n)
                    ET.fromstring(F.render(data["variant"], data))  # 올바른 SVG

    def test_graph_stimuli_are_well_formed(self):
        for n in ("ch_mb_curves", "ch_potential_curve", "ch_titration_point", "ch_energy_profile", "ch_heating_curve", "ch_vapor_pressure_graph"):
            for p in R.batch(n, 4, 0):
                st = p["stimulus"]
                self.assertEqual(st["kind"], "graph")
                d = st["data"]
                pts = d["vertices"] if "vertices" in d else [pt for c in d["curves"] for pt in c["vertices"]]
                self.assertGreaterEqual(len(pts), 4)
                for x, y in pts:
                    self.assertTrue(d["x_axis"]["min"] - 1e-6 <= x <= d["x_axis"]["max"] + 1e-6, f"{n} x out of axis")
                    self.assertTrue(d["y_axis"]["min"] - 1e-6 <= y <= d["y_axis"]["max"] + 1e-6, f"{n} y {y} out of axis [{d['y_axis']['min']},{d['y_axis']['max']}]")

    def test_pes_energies_decrease_for_every_period_2_3_element(self):
        import chem_p0_a as A
        for z in range(3, 18):
            es = [p[0] for p in A._pes_peaks(z)]
            self.assertTrue(all(es[i] > es[i + 1] for i in range(len(es) - 1)), z)


class Constants(unittest.TestCase):
    def test_constants_match_ced_equation_sheet(self):
        self.assertEqual(CONSTS["R"], 8.314); self.assertEqual(CONSTS["R_atm"], 0.08206); self.assertEqual(CONSTS["F"], 96485.0)
        self.assertEqual(CONSTS["Kw"], 1.0e-14); self.assertEqual(CONSTS["h"], 6.626e-34); self.assertEqual(CONSTS["c"], 2.998e8); self.assertEqual(CONSTS["NA"], 6.022e23)

    def test_formula_masses(self):
        self.assertAlmostEqual(formula_mass("Ca(OH)2"), 74.10, places=2)
        self.assertAlmostEqual(formula_mass("Al2(SO4)3"), 342.14, places=1)
        self.assertAlmostEqual(CC.formula_mass_flat("(NH4)2SO4"), formula_mass("(NH4)2SO4"), places=9)


class FrqStructure(unittest.TestCase):
    def test_points_rows_and_skills(self):
        for n in FRQ:
            for p in R.batch(n, 3, 0):
                total = {"long": 10, "short": 4}[p["template"]]
                self.assertEqual(p["total_points"], total, n)
                self.assertEqual(sum(pt["points"] for pt in p["parts"]), total)
                for pt in p["parts"]:
                    self.assertEqual(sum(r["points"] for r in pt["rubric_rows"]), pt["points"], f"{n} {pt['label']}")
                    self.assertTrue(all(s in SKILLS for s in pt["skill_codes"]), (n, pt["skill_codes"]))
                    for r in pt["rubric_rows"]:
                        self.assertIn(r["kind"], {"expression", "numeric", "diagram", "graph", "claim", "justification", "design"})
                ids = [r["row_id"] for pt in p["parts"] for r in pt["rubric_rows"]]
                for pt in p["parts"]:
                    for r in pt["rubric_rows"]:
                        if r["requires_row_id"]:
                            self.assertIn(r["requires_row_id"], ids)
                            self.assertLess(ids.index(r["requires_row_id"]), ids.index(r["row_id"]))
                self.assertIn("not official AP scoring", p["reference_note"])

    def test_exam_has_three_long_and_four_short_46_points(self):
        for form in (FRQ_FORM_1, FRQ_FORM_2):
            packs = [R.batch(n, 1, 0)[0] for n in form]
            self.assertEqual(sorted(p["template"] for p in packs), ["long"] * 3 + ["short"] * 4)
            self.assertEqual(sum(p["total_points"] for p in packs), 46)

    def test_frq_practice_shares_inside_official_ranges(self):
        for form in (FRQ_FORM_1, FRQ_FORM_2):
            packs = [R.batch(n, 1, 0)[0] for n in form]
            shares, tot = C.frq_point_shares(packs)
            self.assertEqual(tot, 46)
            for pr, (lo, hi) in C.PRACTICE_FRQ.items():
                self.assertGreaterEqual(shares.get(pr, 0), lo, f"Practice {pr} {shares} {form[0]}")
                self.assertLessEqual(shares.get(pr, 0), hi, f"Practice {pr} {shares} {form[0]}")

    def test_numeric_expected_values_match_facts(self):
        for p in R.batch("chf_long_thermo", 4, 0):
            f = facts(p)
            dG = f["dH"] - f["T"] * f["dS"] / 1000
            ev = {e["part"] + e["quantity"]: e["value"] for e in p["expected_values"]}
            self.assertAlmostEqual(ev["AdG"], dG, places=6)
            self.assertAlmostEqual(f["K"], math.exp(-dG * 1000 / (R_J * f["T"])), delta=1e-6 * f["K"])
        for p in R.batch("chf_long_titration", 4, 0):
            f = facts(p)
            ev = {e["part"]: e["value"] for e in p["expected_values"]}
            self.assertAlmostEqual(ev["B"], f["c"] * f["Va"] / f["cb"], places=6)


class Coverage(unittest.TestCase):
    """스킬·단원 범위가 라이브러리에 처음부터 내장돼 있다(Physics 가 2.B 로 쏠려 범위를 못 맞춘 일 방지)."""

    @classmethod
    def setUpClass(cls):
        cls.tags = C.tags_from_registry()

    def test_every_official_mc_skill_has_an_archetype(self):
        _, _, sk = C.library_counts(self.tags)
        for s in C.MC_SKILLS:
            self.assertGreaterEqual(sk.get(s, 0), 1, f"no archetype for skill {s}")
        self.assertEqual({k for k in sk if k[0] == "3"}, set(), "Practice 3 is not assessed in MC")

    def test_library_can_fill_each_unit_and_practice_range(self):
        unit, prac, _ = C.library_counts(self.tags)
        for u, rng_ in C.UNIT_MC.items():
            self.assertGreaterEqual(unit.get(u, 0), C.count_bounds(rng_)[1], f"unit {u}: {unit.get(u)} archetypes")
        for p, rng_ in C.PRACTICE_MC.items():
            self.assertGreaterEqual(prac.get(p, 0), C.count_bounds(rng_)[1], f"practice {p}: {prac.get(p)} archetypes")

    def test_a_60_item_set_inside_all_official_ranges_is_assemblable(self):
        ok, sel, msg = C.assemble_check(self.tags)
        self.assertTrue(ok, msg)
        unit, prac, sk = {}, {}, set()
        n = 0
        for a in sel:
            for u, s in self.tags[a]:
                unit[u] = unit.get(u, 0) + 1; prac[s[0]] = prac.get(s[0], 0) + 1; sk.add(s); n += 1
        self.assertEqual(n, 60)
        for u, r in C.UNIT_MC.items():
            lo, hi = C.count_bounds(r)
            self.assertTrue(lo <= unit[u] <= hi, (u, unit[u]))
        for p, r in C.PRACTICE_MC.items():
            lo, hi = C.count_bounds(r)
            self.assertTrue(lo <= prac[p] <= hi, (p, prac[p]))
        self.assertEqual(sk, set(C.MC_SKILLS))

    def test_tags_match_each_archetype_pack(self):
        for a, v in self.tags.items():
            for p in R.batch(a, 3, 0):
                self.assertEqual([(q["topic"].split(".")[0], q["skill"]) for q in items(p)], v, a)


if __name__ == "__main__":
    unittest.main()
