"""외부 AP 검수(2026-10-15) 유형 단위 결함 회귀 테스트(무료: 네트워크·DB·LLM 없음). `python -m unittest test_audit_1019` (Vitest 래퍼: lib/ap-generation/audit-1019-type-fixes.test.ts).
검수가 한 문항씩만 고쳐졌다고 지적한 생성기 결함이 원형 코드에서 사라졌는지, 같은 유형이 다시 생기지 않는지 본다.
 (a) 카이제곱 설정: 동질성·독립성 귀무(동치)가 같은 문항 보기로 나오지 않는다
 (b) 표 자료 서술형: 제목이 글자 수로 잘리지 않고, 설명(description)에만 있던 실험 소개·주어진 값이 학생 글에 있다
 (c) 비용 같은 풀이 필수 값이 설명·해설에만 있지 않고 문항 본문에 있다(Micro/Macro 전체)
 (d) 같은 생성기에서 반복되는 유형: 표본비율≠정수/n, 반올림된 보이는 값, 꺾은선 도함수에 '모든 차수 도함수' 전제, '증가=이계도함수 > 0' 참고답, 분기점 방향 누락, 용질 퍼텐셜 방향, 비치명 UV 전제, '변화를 멈춘다' 문구"""
import json
import re
import unittest

import frq_visible as FV
import registry as R

MC_REGISTRIES = ["MC", "STATS", "PHYS", "CHEM", "MICRO", "MACRO", "BIO", "GRAPH"]
FRQ_REGISTRIES = ["FRQ", "STATS_FRQ", "PHYS_FRQ", "CHEM_FRQ", "MICRO_FRQ", "MACRO_FRQ", "BIO_FRQ"]


def names(reg):
    return list(getattr(R, reg).keys())


def student_math(s):
    return re.sub(r"[$\\]", "", s)


class TestSetupVisible(unittest.TestCase):
    def test_frq_titles_complete_and_setup_visible(self):
        bad = []
        for reg in FRQ_REGISTRIES:
            for n in names(reg):
                for p in R.batch(n, 2, 700):
                    left = FV.hidden_setup(p, "frq")
                    if left or FV.title_truncated(p):
                        bad.append((n, p["title"][:70], left[:2]))
        self.assertEqual(bad, [])

    def test_mc_given_values_are_in_student_text(self):
        """MC: 표·그림의 description 에만 있는 수치(비용·가격 등)가 없다(Micro 2 MC56 유형)."""
        bad = []
        for reg in MC_REGISTRIES:
            for n in names(reg):
                for p in R.batch(n, 2, 700):
                    its = p["items"] if isinstance(p.get("items"), list) else [p]
                    left = FV.hidden_setup(p, "mc")
                    if left:
                        bad.append((n, left[:2]))
        self.assertEqual(bad, [])

    def test_lint_catches_the_old_shapes(self):
        """린트가 실제로 이전 결함 모양을 잡는다(린트가 항상 통과하는 빈 검사가 아님)."""
        old_micro = {"stem": "The table shows each person's marginal benefit. What is the efficient quantity?", "options": [{"text": "3"}, {"text": "4"}],
                     "stimulus": {"kind": "table", "description": "Marginal benefit that two people receive. The marginal cost of each unit is $26.", "data": {"columns": ["Unit", "A", "B"], "rows": [["1", "$24", "$22"]]}}}
        self.assertEqual(FV.hidden_setup(old_micro, "mc"), ["number:26"])
        old_title = {"title": "Results with graphing: A student places potato cores of equal i", "parts": [{"prompt": "Describe water potential."}],
                     "stimulus": {"kind": "table", "description": "A student places potato cores of equal initial mass in sucrose solutions of different molarity. The table shows the data.", "data": {"columns": ["M", "%"], "rows": [["0.0", "5"]]}}}
        self.assertTrue(FV.title_truncated(old_title))
        fixed = FV.ensure_setup_visible(json.loads(json.dumps(old_title)))
        self.assertFalse(FV.title_truncated(fixed))
        self.assertEqual(FV.hidden_setup(fixed, "frq"), [])
        self.assertTrue(fixed["title"].startswith("A student places potato cores") and "The table shows the data" in fixed["title"])


class TestChiSquareSetup(unittest.TestCase):
    def test_no_equivalent_null_pair(self):
        for p in R.batch("st_chisq_setup", 30, 500):
            t = [o["text"] for o in p["options"]]
            hom = [x for x in t if re.search(r"distribution of .* is the same for all", x)]
            ind = [x for x in t if re.search(r"independent in the population", x)]
            self.assertLessEqual(len(hom) + len(ind), 2, t)
            # 같은 df 를 가진 동치 귀무 두 개가 한 문항에 같이 있으면 안 된다
            self.assertFalse(hom and ind, t)
            self.assertEqual(sum(1 for x in t if re.search(r"is not the same|are associated", x)), 1, t)
            key = p["options"][p["key_index"]]["text"]
            self.assertTrue(re.search(r"is the same for all|independent in the population", key), key)
            df = re.search(r"df = (\d+)", key).group(1)
            self.assertEqual(sum(1 for o in p["options"] if f"df = {df}" in o["text"] and (("is the same for all" in o["text"]) or ("independent in the population" in o["text"]))), 1)


class TestMicroPublicGood(unittest.TestCase):
    def test_cost_in_stem(self):
        for p in R.batch("mi_public_good_efficient", 12, 500):
            f = {k: v for k, v in (x.split("=", 1) for x in p["facts"])}
            mc = int(f["mc"])
            self.assertIn(f"marginal cost of providing each unit of the public good is ${mc}", p["stem"])
            ma, mb = json.loads(f["ma"]), json.loads(f["mb"])
            self.assertEqual(p["options"][p["key_index"]]["text"], str(sum(1 for a, b in zip(ma, mb) if a + b > mc)))


class TestBioFrq(unittest.TestCase):
    def test_q1_q2_q6_titles_are_the_full_setup(self):
        for n in names("BIO_FRQ"):
            if not re.match(r"bif_q[126]_", n):
                continue
            for p in R.batch(n, 2, 700):
                self.assertFalse(FV.title_truncated(p), (n, p["title"]))
                self.assertGreaterEqual(len(p["title"].split()), 10, (n, p["title"]))
                self.assertNotRegex(p["title"], r"^(Results with graphing|Interpreting and evaluating results|Data analysis):", n)

    def test_replication_fork_direction_is_stated_to_students(self):
        for p in R.batch("bif_q5_replication", 12, 500):
            fork = [x.split("=", 1)[1] for x in p["facts"] if x.startswith("fork=")][0]
            self.assertIn(f"moves toward the {fork} side of the diagram", p["title"])
            self.assertIn(f"The replication fork is moving toward the {fork} side of the diagram.", p["parts"][0]["prompt"])

    def test_potato_nacl_solute_potential_is_lower(self):
        for p in R.batch("bif_q2_potato", 3, 500):
            d = [x for x in p["parts"] if x["label"] == "D"][0]["model_answer"]
            self.assertIn("lower (more negative)", d)
            self.assertNotIn("is greater and the water potential of the solution is lower", d)

    def test_uv_doses_are_nonlethal(self):
        for p in R.batch("bif_q3_uvbacteria", 2, 500):
            self.assertIn("most of the exposed cells survive", json.dumps(p["stimulus"]))
            c = [x for x in p["parts"] if x["label"] == "C"][0]["model_answer"]
            self.assertTrue(c.startswith("Because the UV doses are low enough that most cells survive"))

    def test_population_plateau_wording(self):
        for p in R.batch("bis_population_set", 6, 500):
            q3 = p["items"][2]["stem"]
            self.assertIn("changes very little at the end of the table", q3)
            self.assertNotIn("stops changing", q3)


class TestStatsPhysCalc(unittest.TestCase):
    def test_sample_proportion_is_count_over_n(self):
        for p in R.batch("st_pvalue_interpretation", 40, 500):
            m = re.search(r"random sample of \$(\d+)\$ .*? is \$(0\.\d+)\$", p["stem"])
            n, ph = int(m.group(1)), float(m.group(2))
            x = round(n * ph)
            self.assertAlmostEqual(x / n, ph, places=9, msg=f"{ph} is not {x}/{n}")

    def test_collision_displayed_speeds_reproduce_totals(self):
        for p in R.batch("ph_evid_collision_data", 30, 500):
            f = {k: float(v) for k, v in (x.split("=", 1) for x in p["facts"] if re.match(r"(m1|m2|v1|u1|u2|K0|K1)=", x))}
            for k in ("u1", "u2"):
                self.assertAlmostEqual(f[k], float(f"{f[k]:.3g}"), places=9)
            shown_p = f["m1"] * f["u1"] + f["m2"] * f["u2"]
            self.assertAlmostEqual(shown_p, f["m1"] * f["v1"], places=9)
            self.assertAlmostEqual(0.5 * f["m1"] * f["u1"] ** 2 + 0.5 * f["m2"] * f["u2"] ** 2, f["K1"], places=9)

    def test_graph_premises_do_not_contradict_the_graph(self):
        names_ = [n for n in names("GRAPH") if n in ("g_lagrange_decimal_calc", "g_taylor_deriv_graph", "g_lagrange_p2_calc", "lagrange_graph", "g_lhopital_graph")] + [n for n in names("MC") if n in ("lagrange_graph",)]
        self.assertGreaterEqual(len(set(names_)), 4)
        for n in set(names_):
            for p in R.batch(n, 3, 500):
                for it in (p["items"] if isinstance(p.get("items"), list) else [p]):
                    s = it["stem"]
                    if "line segments" in s:
                        self.assertNotIn("derivatives of all orders", s, n)
                        self.assertNotIn("graphs of the differentiable functions", s, n)

    def test_fprime_concavity_reference_does_not_force_strict_f2(self):
        for p in R.batch("frq_fprime_graph", 4, 500):
            self.assertNotIn("so f'' > 0", json.dumps(p))
            self.assertNotIn("f'' is positive", json.dumps(p))


class TestCsaScope(unittest.TestCase):
    def test_compile_error_candidates_stay_in_course_scope(self):
        """AP CSA 범위(int·double·boolean·String): 컴파일 오류 문항의 후보 문장에 char·long·float 선언이 없다(외부 검수 AP-031)."""
        import inspect
        import csa_p0_a
        src = inspect.getsource(csa_p0_a.cs_compile_error)
        self.assertEqual(re.findall(r'\("(?:char|long|float|short|byte) \w+ =', src), [])

    @unittest.skipUnless(__import__("csa_java").java_available(), "JDK not available")
    def test_describe_list_states_nonempty_precondition(self):
        for p in R.batch("cs_describe_list", 2, 500):
            self.assertTrue(p["stem"].startswith("Assume that list contains at least one element."))


if __name__ == "__main__":
    unittest.main()
