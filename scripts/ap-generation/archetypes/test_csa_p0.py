"""AP Computer Science A P0 원형 테스트(무료: 네트워크·DB·LLM 없음, JDK 필요). unittest 기반 — `python -m unittest test_csa_p0` 또는 pytest. Vitest 래퍼: lib/ap-generation/csa-archetypes.test.ts.
검사: 실행기 안전(컴파일 오류·예외·시간 초과·금지 API·캐시) / 시드 결정성 / 선택지 구조 / 코드 안전(달러·밑줄) / 독립 경로 불일치 시 폐기 / 화면에 보이는 코드를 다시 실행해 정답과 대조 /
FRQ 구조(9점·행 1점·모범·대안 통과, 오답 실패) / 단원·Practice 범위 정수계획."""
import json, os, random, re, sys, unittest
import csa_java as J
import csa_common as CC
import csa_coverage as C
import csa_p0_frq as FQ
import registry as R

MC = R.CSA_STAGES["csa_mc_all"]
SETS = R.CSA_STAGES["csa_sets"]
FRQ = R.CSA_STAGES["csa_frq"]
SKILLS_OK = set(C.CODE_SKILLS)
HERE = os.path.dirname(os.path.abspath(__file__))
curriculum = json.load(open(os.path.join(HERE, "../../../data/ap/curriculum-2027/ap_computer_science_a.json")))
TOPICS = {t["code"] for u in curriculum["units"] for t in u["topics"]}
SEEDS = int(os.environ.get("CSA_SEEDS", 2))
# 학생에게 보이는 코드가 곧 실행된 문장인 원형(문장 모드): 화면 코드를 다시 실행해 키와 대조한다
STATEMENT_MODE = ["cs_int_division_expr", "cs_casting_range", "cs_compound_assign", "cs_string_methods", "cs_math_class", "cs_while_trace", "cs_nested_loops_count", "cs_arraylist_ops", "cs_array_traverse",
                  "cs_arraylist_remove_loop", "cs_2d_traverse", "cs_binary_search", "cs_selection_sort_pass", "cs_if_nesting",
                  # 2026-10-13 두 번째 풀 모의고사용 새 구조(csa_p0_e·f): 화면 코드가 곧 실행 문장인 것
                  "cs_assign_swap_bug", "cs_string_concat_prec", "cs_char_arith", "cs_int_overflow", "cs_string_equals_compare", "cs_for_iter_count", "cs_boolean_expr_trace", "cs_else_if_chain", "cs_nested_triangle", "cs_halving_count", "cs_scope_trace", "cs_arraylist_insert_remove"]


def items(pack):
    return pack["items"] if "items" in pack else [pack]


def code_of(desc):
    m = re.search(r"```java\n(.*?)\n```", desc, re.S)
    return m.group(1) if m else None


def packs(name, n=SEEDS):
    return R.batch(name, n, 500)


@unittest.skipUnless(J.java_available(), "JDK not available")
class TestHarness(unittest.TestCase):
    def test_runs_and_captures(self):
        r = J.java_eval("class A { static int f(int n) { return n * 2; } }", [("ret", "return A.f(4);"), ("out", "System.out.println(7); System.out.print(\"x\");"), ("ret", "int[] a = new int[1]; return a[2];"), ("ret", "return new int[] { 1, 2 };")])
        self.assertEqual([J.tidy(x) for x in r], ["8", "7 x", "EXC:ArrayIndexOutOfBoundsException", "[1, 2]"])

    def test_compile_error_detected(self):
        ok, msg = J.compiles("public class T { int f() { return \"a\"; } }")
        self.assertFalse(ok); self.assertIn("incompatible types", msg)
        self.assertTrue(J.compiles("public class T2 { int f() { return 1; } }")[0])

    def test_timeout_kills_infinite_loop(self):
        r = J.run_java({"Main.java": "public class Main { public static void main(String[] a) { while (true) { } } }"}, cache=False)
        self.assertTrue(r.compiled); self.assertTrue(r.timed_out)

    def test_forbidden_api_refused(self):
        for bad in ("System.exit(0);", "Runtime.getRuntime();", "new java.io.File(\"x\");", "new Thread();"):
            with self.assertRaises(ValueError):
                J.run_java({"Main.java": "public class Main { public static void main(String[] a) { " + bad + " } }"})

    def test_cache_is_content_addressed(self):
        src = {"Main.java": "public class Main { public static void main(String[] a) { System.out.println(40 + 2); } }"}
        a = J.run_java(src); b = J.run_java(src)
        self.assertEqual(a.stdout, b.stdout); self.assertEqual(a.stdout.strip(), "42")

    def test_spaced_ok(self):
        self.assertTrue(J.spaced_ok([3, 4, 9, 11]))      # 작은 정수는 정확 값 구별
        self.assertFalse(J.spaced_ok([20, 21, 40, 80]))  # 20 vs 21 = 4.8%
        self.assertFalse(J.spaced_ok([2.5, 2.6, 9.0, 12.5]))
        self.assertTrue(J.spaced_ok([2.5, 3.0, 9.0, 12.5]))
        self.assertFalse(J.spaced_ok([5, 5, 9, 12]))


@unittest.skipUnless(J.java_available(), "JDK not available")
class TestIndependentPath(unittest.TestCase):
    def test_python_mismatch_discards_the_seed(self):
        with self.assertRaises(ValueError) as cm:
            CC.mk(random.Random(1), "cs_x", "1.3", "3.A", "What is printed?", "System.out.println(2 + 3);", muts=[{"why": "a", "swap": ("2 + 3", "2 * 3")}, {"why": "b", "swap": ("2 + 3", "2 - 3")}, {"why": "c", "swap": ("2 + 3", "20 + 3")}],
                  py="6", concept="x", path="x", kwhy="x")
        self.assertIn("independent_check_failed", str(cm.exception))

    def test_distractors_that_equal_the_key_are_dropped(self):
        with self.assertRaises(ValueError) as cm:  # 변형 3개 중 2개가 정답과 같은 결과 → 오답이 3개가 안 된다
            CC.mk(random.Random(1), "cs_x", "1.3", "3.A", "What is printed?", "System.out.println(2 + 3);", muts=[{"why": "a", "swap": ("2 + 3", "3 + 2")}, {"why": "b", "swap": ("2 + 3", "1 + 4")}, {"why": "c", "swap": ("2 + 3", "20 + 3")}],
                  py="5", concept="x", path="x", kwhy="x")
        self.assertIn("not_enough_distinct_distractors", str(cm.exception))

    def test_wrong_reference_solution_is_caught_by_the_verifier(self):
        ref = "public class Z { public static int f(int n) { return n + 1; } }"
        alt = "public class Z { public static int f(int n) { return n + 2; } }"  # 대안이 틀리면 모범과 대안 불일치로 거부
        with self.assertRaises(ValueError):
            FQ.verify_variants("Z", ref, alt, [], [("a", "return Z.f(1);", "2")])

    def test_wrong_solution_that_passes_everything_is_rejected(self):
        ref = "public class Y { public static int f(int n) { return n + 1; } }"
        with self.assertRaises(ValueError):
            FQ.verify_variants("Y", ref, ref, [("same behavior", ref.replace("n + 1", "1 + n"), "a")], [("a", "return Y.f(1);", "2")])

    def test_unique_key_in_test_based_options(self):
        # 두 후보가 모든 테스트를 통과하면(정답 둘) 문항을 만들 수 없다
        tpl = "class K { static int f(int n) { /*BODY*/ } }"
        opts = [{"text": "`a`", "source": tpl.replace("/*BODY*/", "return n + n;"), "why": "x" * 20, "key": True}, {"text": "`b`", "source": tpl.replace("/*BODY*/", "return 2 * n;"), "why": "y" * 20, "key": False},
                {"text": "`c`", "source": tpl.replace("/*BODY*/", "return n;"), "why": "z" * 20, "key": False}, {"text": "`d`", "source": tpl.replace("/*BODY*/", "return 0;"), "why": "w" * 20, "key": False}]
        with self.assertRaises(ValueError) as cm:
            CC.mk_tests(random.Random(1), "cs_x", "2.9", "2.A", "stem", "class K {}", opts, [("return K.f(3);", "6")], concept="x", path="x", kwhy_by_key="x")
        self.assertIn("distractor_passes_all_tests", str(cm.exception))


@unittest.skipUnless(J.java_available(), "JDK not available")
class TestMcArchetypes(unittest.TestCase):
    def test_library_size(self):
        self.assertGreaterEqual(len(MC), 80)  # 2026-10-13: 두 번 풀 모의고사(겹침 0)용으로 약 34개 구조 추가
        self.assertEqual(len(SETS), 4)

    def test_deterministic(self):
        for n in MC + SETS:
            with self.subTest(n):
                a = json.dumps(R.batch(n, 1, 500), sort_keys=True); b = json.dumps(R.batch(n, 1, 500), sort_keys=True)
                self.assertEqual(a, b)

    def test_structure(self):
        for n in MC + SETS:
            for pack in packs(n):
                for q in items(pack):
                    with self.subTest(q["archetype"]):
                        o = q["options"]
                        self.assertEqual(len(o), 4)
                        self.assertEqual(len({x["text"] for x in o}), 4)
                        self.assertTrue(0 <= q["key_index"] < 4)
                        self.assertEqual(sum(1 for i, x in enumerate(o) if i == q["key_index"]), 1)
                        for i, x in enumerate(o):
                            if i != q["key_index"]:
                                self.assertGreaterEqual(len(x["why"]), 15, x)
                        self.assertGreaterEqual(len({x["why"] for i, x in enumerate(o) if i != q["key_index"]}), 3)
                        self.assertIn(q["skill"], SKILLS_OK)
                        self.assertIn(q["topic"], TOPICS)
                        self.assertEqual(q["calculator"], "not_allowed")
                        self.assertTrue(30 <= q["est_seconds"] <= 150)
                        self.assertTrue(q["blueprint"]["misconceptions"])
                        vals = [x["value"] for x in o]
                        if all(v is not None for v in vals):
                            self.assertTrue(J.spaced_ok([float(v) for v in vals]), vals)

    def test_code_text_is_safe_for_the_renderer(self):
        bad = re.compile(r"\$|__|\\")
        for n in MC + SETS:
            for pack in packs(n):
                stim = pack.get("stimulus") or {}
                for q in items(pack):
                    with self.subTest(n):
                        texts = [q["stem"]] + [x["text"] for x in q["options"]] + [(q.get("stimulus") or stim).get("description", "")] + [pack.get("set_intro", "")]
                        for t in texts:
                            self.assertIsNone(bad.search(t), t[:80])
                        d = (q.get("stimulus") or stim)
                        if d.get("data", {}).get("variant") == "java_code":
                            code = code_of(d["description"])
                            self.assertIsNotNone(code)
                            self.assertEqual(d["data"], {"variant": "java_code", "language": "java"})

    def test_no_korean(self):
        for n in MC + SETS:
            for pack in packs(n, 1):
                for q in items(pack):
                    self.assertIsNone(re.search(r"[ㄱ-ㆎ가-힣]", json.dumps(q, ensure_ascii=False)), n)

    def test_screen_code_reexecuted_matches_key(self):
        """학생 화면에 보이는 코드(문장 모드)를 따로 다시 실행해 정답 선택지와 같은지 확인한다 — 표시 코드와 실행 코드가 어긋나지 않는다."""
        for n in STATEMENT_MODE:
            for pack in packs(n):
                with self.subTest(n):
                    code = code_of(pack["stimulus"]["description"])
                    key = pack["options"][pack["key_index"]]["text"].strip("`")
                    got = J.tidy(J.java_eval("", [("out", code)])[0])
                    shown = key if not key.startswith("A ") else key
                    self.assertEqual(got, shown)

    def test_test_based_items_carry_test_cases(self):
        for n in ["cs_loop_completion", "cs_bug_find", "cs_class_completion", "cs_helper_completion", "cs_array_completion", "cs_2d_completion", "cs_string_completion", "cs_arraylist_completion", "cs_recursion_completion", "cs_class_state_completion"]:
            for pack in packs(n):
                with self.subTest(n):
                    self.assertGreaterEqual(len(pack["test_cases"]), 3)

    def test_sets_have_two_items_sharing_code(self):
        for n in SETS:
            pack = packs(n, 1)[0]
            self.assertEqual(len(pack["items"]), 2)
            self.assertIn("```java", pack["stimulus"]["description"])
            for q in pack["items"]:
                self.assertTrue(q["stimulus"]["kind"] == "none")

    def test_skill_and_unit_coverage_of_the_library(self):
        tags = C.tags_from_registry()
        unit, prac, skill = C.library_counts(tags)
        for s in C.CODE_SKILLS:
            self.assertGreaterEqual(skill.get(s, 0), 1, s)
        for u in "1234":
            self.assertGreaterEqual(unit[u], C.count_bounds(C.UNIT_MC[u])[0], u)
        for pr in "234":
            self.assertGreaterEqual(prac[pr], C.count_bounds(C.PRACTICE_MC[pr])[0], pr)

    def test_full_exam_assemblable_in_official_ranges(self):
        ok, sel, why = C.assemble_check(C.tags_from_registry())
        self.assertTrue(ok, why)
        tags = C.tags_from_registry()
        total = sum(len(tags[a]) for a in sel)
        self.assertEqual(total, C.MC_N)


@unittest.skipUnless(J.java_available(), "JDK not available")
class TestFrq(unittest.TestCase):
    def test_four_official_types(self):
        want = {"q1": 4, "q2": 4, "q3": 4, "q4": 4}  # 유형마다 시나리오 4개: 파일럿 1 + 풀 모의고사 2회 + 보충 1
        got = {}
        for n in FRQ:
            p = packs(n, 1)[0]
            got[p["template"]] = got.get(p["template"], 0) + 1
        self.assertEqual(got, want)

    def test_structure_and_verification(self):
        for n in FRQ:
            for p in packs(n, 1):
                with self.subTest(n):
                    self.assertEqual(p["total_points"], 9)
                    self.assertEqual(sum(x["points"] for x in p["parts"]), 9)
                    for part in p["parts"]:
                        self.assertEqual(sum(r["points"] for r in part["rubric_rows"]), part["points"])
                        self.assertTrue(all(r["points"] == 1 and r["required_elements"] for r in part["rubric_rows"]))
                        self.assertEqual(part["response_mode"], "code")
                        self.assertTrue(set(part["skill_codes"]) <= {"2.A", "2.B", "2.C"})
                    self.assertGreaterEqual(len(p["self_check_tests"]), 6)
                    v = p["verification"]
                    self.assertGreaterEqual(v["variants"], 6)
                    self.assertTrue(all(x >= 1 for x in v["wrong_failures"]), v)
                    self.assertEqual(p["calculator"], "not_allowed")
                    self.assertIn("```java", p["stimulus"]["description"])
                    self.assertIn("not official AP scoring", p["reference_note"])
                    code = json.dumps(p, ensure_ascii=False)
                    self.assertIsNone(re.search(r"[ㄱ-ㆎ가-힣]", code))

    def test_part_split_matches_official_shape(self):
        for n in ("csf_methods_pass", "csf_methods_leap", "csf_methods_digits"):
            self.assertEqual([x["points"] for x in packs(n, 1)[0]["parts"]], [4, 5])
        for n in ("csf_class_steps", "csf_list_above", "csf_2d_best_row", "csf_class_scoreboard", "csf_class_stock", "csf_list_runs", "csf_list_remove_short", "csf_2d_border", "csf_2d_transpose"):
            self.assertEqual([x["points"] for x in packs(n, 1)[0]["parts"]], [9])

    def test_model_answers_compile(self):
        for n in FRQ:
            p = packs(n, 1)[0]
            for part in p["parts"]:
                with self.subTest(n + part["label"]):
                    code = code_of(part["model_answer"])
                    self.assertIsNotNone(code)
                    self.assertIn("{", code)

    def test_frq_text_safe_for_renderer(self):
        bad = re.compile(r"\$|__")
        for n in FRQ:
            p = packs(n, 1)[0]
            texts = [p["stimulus"]["description"]] + [x["prompt"] for x in p["parts"]] + [x["model_answer"] for x in p["parts"]]
            for t in texts:
                self.assertIsNone(bad.search(t), (n, t[:60]))


@unittest.skipUnless(J.java_available(), "JDK not available")
class TestTwoExams(unittest.TestCase):
    """2026-10-13: 서로 겹치지 않는 풀 모의고사 두 회(MC 42 + FRQ 4)를 한 라이브러리에서 공식 범위 안에 조립할 수 있다."""
    NEW_MODULES = ("csa_p0_e", "csa_p0_f")

    def test_two_disjoint_42_sets_inside_official_ranges(self):
        tags = C.tags_from_registry()
        ok, sel, why = C.assemble_two_check(tags)
        self.assertTrue(ok, why)
        a, b = sel
        self.assertFalse(set(a) & set(b), "구조(원형)는 두 회에서 겹치지 않아야 한다")
        for exam in sel:
            self.assertEqual(sum(len(tags[x]) for x in exam), C.MC_N)
            unit = {u: sum(1 for x in exam for uu, _ in tags[x] if uu == u) for u in "1234"}
            prac = {p: sum(1 for x in exam for _, s in tags[x] if s[0] == p) for p in "12345"}
            for u, rng_ in C.UNIT_MC.items():
                lo, hi = C.count_bounds(rng_); self.assertTrue(lo <= unit[u] <= hi, (u, unit[u], lo, hi))
            for p, rng_ in C.PRACTICE_MC.items():
                lo, hi = C.count_bounds(rng_); self.assertTrue(lo <= prac[p] <= hi, (p, prac[p], lo, hi))
            skills = {s for x in exam for _, s in tags[x]}
            self.assertTrue(set(C.CODE_SKILLS) <= skills, set(C.CODE_SKILLS) - skills)

    def test_survives_the_loss_of_any_two_archetypes(self):
        """검수에서 구조 두 개가 통째로 반려돼도(첫 통과율 60~75%) 두 회 조립이 계속 가능하다 — 마진 확인."""
        import itertools
        tags = C.tags_from_registry()
        names = sorted(tags)
        for x in names:
            self.assertTrue(C.assemble_two_check({k: v for k, v in tags.items() if k != x})[0], x)
        bad = [(x, y) for x, y in itertools.combinations(names, 2) if not C.assemble_two_check({k: v for k, v in tags.items() if k not in (x, y)})[0]]
        self.assertEqual(bad, [])

    def test_new_archetype_count(self):
        new = [n for n in MC + SETS if R.CSA[n][0].__module__ in self.NEW_MODULES]
        self.assertGreaterEqual(len(new), 30)
        for n in new:
            for pack in packs(n, 1):
                for q in items(pack):
                    with self.subTest(n):
                        mis = [o["why"] for i, o in enumerate(q["options"]) if i != q["key_index"]]
                        self.assertEqual(len(set(mis)), 3)  # 오답 세 개는 서로 다른 이름 붙은 오개념
                        self.assertTrue(q["blueprint"]["misconceptions"])

    def test_eight_distinct_new_frq_scenarios_two_per_type(self):
        extra = R.CSA_STAGES["csa_frq_extra"]
        self.assertEqual(len(extra), 8)
        per = {}
        for n in extra:
            p = packs(n, 1)[0]
            per.setdefault(p["template"], []).append(p["stimulus"]["description"])
        self.assertEqual({k: len(v) for k, v in per.items()}, {"q1": 2, "q2": 2, "q3": 2, "q4": 2})
        old = [packs(n, 1)[0]["stimulus"]["description"] for n in R.CSA_STAGES["csa_p1_frq"] + R.CSA_STAGES["csa_frq_alt"]]
        allp = old + [d for v in per.values() for d in v]
        self.assertEqual(len(set(allp)), len(allp), "시나리오 지문이 서로 달라야 한다")
        # 두 회가 유형마다 서로 다른 시나리오를 쓴다: 유형당 파일럿 외 3개 이상
        count = {}
        for n in R.CSA_STAGES["csa_frq"]:
            t = packs(n, 1)[0]["template"]; count[t] = count.get(t, 0) + 1
        self.assertTrue(all(v >= 4 for v in count.values()), count)


class TestPaidRunPlan(unittest.TestCase):
    """유료 실행 단계 목록(csa_p0_stages.py)이 파일럿과 함께 라이브러리 전체를 겹침·누락 없이 덮는다."""

    def test_mc_batches_plus_pilot_cover_the_whole_library_once(self):
        pilot = R.CSA_STAGES["csa_p1_a"]
        batches = [R.CSA_STAGES[f"csa_s2_mc_{x}"] for x in "abc"]
        allx = pilot + [n for b in batches for n in b]
        self.assertEqual(len(allx), len(set(allx)), "배치끼리 원형이 겹친다")
        self.assertEqual(sorted(allx), sorted(MC + SETS))
        for b in batches:
            self.assertTrue(20 <= len(b) <= 26, len(b))

    def test_frq_batches_plus_pilot_cover_all_scenarios_with_three_per_type_pair_per_batch(self):
        pilot = R.CSA_STAGES["csa_p1_frq"]
        a, b = R.CSA_STAGES["csa_s2_frq_a"], R.CSA_STAGES["csa_s2_frq_b"]
        allx = pilot + a + b
        self.assertEqual(sorted(allx), sorted(FRQ)); self.assertEqual(len(allx), len(set(allx)))
        tmpl = lambda names: sorted(packs(n, 1)[0]["template"] for n in names)  # noqa: E731
        self.assertEqual(tmpl(a), ["q1", "q1", "q1", "q2", "q2", "q2"]); self.assertEqual(tmpl(b), ["q3", "q3", "q3", "q4", "q4", "q4"])

    def test_shortfall_lists_start_empty_until_the_assign_report_names_the_missing_cells(self):
        self.assertEqual(R.CSA_STAGES.get("csa_s2_short_mc", []), []); self.assertEqual(R.CSA_STAGES.get("csa_s2_short_frq", []), [])


class TestPaidRunPlanConfigs(unittest.TestCase):
    """config/ap-frozen/csa-*.template.json 은 미동결 템플릿이다: 해시 placeholder, 비용 상한 합이 중단선 이내, 목록 이름이 레지스트리에 있다."""
    CFG = os.path.join(HERE, "../../../config/ap-frozen")

    def test_templates_are_unfrozen_and_inside_the_budget(self):
        import csa_cost as K
        plan = K.paid_plan()
        self.assertLessEqual(plan["worst_case_cumulative"], K.STOP_LINE)
        self.assertLessEqual(plan["expected_with_reserve"], 12.8)
        for row in plan["steps"]:
            cfg = json.load(open(os.path.join(self.CFG, row["step"] + ".template.json")))
            self.assertEqual(cfg["expected"]["generatorHash"], "UNFROZEN"); self.assertEqual(cfg["expected"]["reviewerPromptHash"], "UNFROZEN")
            self.assertEqual(cfg["capUsd"], row["cap"]); self.assertAlmostEqual(cfg["hardStopCumulativeUsd"], row["hard_stop"], places=2)
            self.assertLessEqual(cfg["hardStopCumulativeUsd"], K.STOP_LINE)
            self.assertEqual(cfg["subject"], "ap_computer_science_a"); self.assertEqual(cfg["run"], row["step"]); self.assertFalse(cfg["repair"])
            self.assertIn("perCellCapUsd", cfg["_budget_estimate"]); self.assertIn("perCellUsd", cfg["_budget_estimate"])
            self.assertIn(cfg["archetypeList"], R.CSA_STAGES)
            if not row["step"].startswith("csa-s2-short"):
                cells = len(R.CSA_STAGES[cfg["archetypeList"]]); weighted = cells + sum(1 for n in R.CSA_STAGES[cfg["archetypeList"]] if n.startswith("css_"))
                self.assertEqual(weighted if row["kind"] == "mc" else cells, row["cells_weighted"], row["step"])
        seeds = [json.load(open(os.path.join(self.CFG, r["step"] + ".template.json")))["seed0"] for r in plan["steps"]]
        self.assertEqual(len(seeds), len(set(seeds)))
        hs = [r["hard_stop"] for r in plan["steps"]]
        self.assertEqual(hs, sorted(hs))

    def test_frozen_copies_carry_real_hashes(self):
        # 오너 승인(2026-10-13) 뒤 동결 사본(.v*.json)이 생긴다: 모두 UNFROZEN 자리표시자가 아닌 실제 해시여야 한다
        for f in os.listdir(self.CFG):
            if f.startswith("csa-") and not f.endswith(".template.json"):
                cfg = json.load(open(os.path.join(self.CFG, f)))
                self.assertNotIn("UNFROZEN", json.dumps(cfg["expected"]), f)
