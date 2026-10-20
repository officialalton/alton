"""AP Physics C: Mechanics 원형 구조 테스트(무료). 실행: python3 -m unittest test_physc_p0 (archetypes 디렉터리에서, .venv-ap 의 python 사용).
수치 진실은 원형 안의 이중 경로(sympy 대 수치 미분·적분·RK4·이분법) 검사가 보장하고, 여기서는 시드 성공률·선택지 구조·FRQ 배점·단원 분포를 확인한다."""
import random
import re
import unittest

import registry as R

FRQ_W = {"mr": 10, "tbr": 12, "lab": 10, "qqt": 8}


class PhysCMechanics(unittest.TestCase):
    def test_registry_counts_and_units(self):
        names = R.PHYSC_STAGES["physc_mc_all"] + R.PHYSC_STAGES["physc_sets_all"]
        self.assertEqual(len(names), 215)
        units = {}
        for n in names:
            p = R.batch(n, 1, 0)[0]
            for q in (p["items"] if "items" in p else [p]):
                u = q["topic"].split(".")[0]
                units[u] = units.get(u, 0) + 1
        self.assertEqual(sorted(units), ["1", "2", "3", "4", "5", "6", "7"])
        self.assertGreaterEqual(min(units.values()), 10)

    def test_mc_seed_success_and_option_structure(self):
        for n in R.PHYSC_STAGES["physc_mc_all"] + R.PHYSC_STAGES["physc_sets_all"]:
            ok = 0
            for s in range(25):
                try:
                    p = R.PHYSC[n][0](random.Random(s))
                except ValueError:
                    continue
                ok += 1
                for q in (p["items"] if "items" in p else [p]):
                    texts = [o["text"] for o in q["options"]]
                    self.assertEqual(len(set(texts)), 4, n)
                    self.assertTrue(0 <= q["key_index"] < 4, n)
                    self.assertLessEqual(len(re.findall(r"\w+", q["stem"])), 110, n)
                    self.assertNotIn("e+", "".join(texts), n)
                    self.assertEqual(q["blueprint"]["subject"], "ap_physics_c_mechanics", n)
            self.assertGreaterEqual(ok, 15, f"{n} seed success {ok}/25")

    def test_frq_types_weights_and_five_scenarios_each(self):
        per = {}
        for n in R.PHYSC_STAGES["physc_frq_all"]:
            p = R.PHYSC_FRQ[n][0](random.Random(3))
            self.assertEqual(p["total_points"], FRQ_W[p["template"]], n)
            self.assertEqual(sum(pt["points"] for pt in p["parts"]), p["total_points"], n)
            self.assertTrue(all(r["points"] == 1 for pt in p["parts"] for r in pt["rubric_rows"]), n)
            per.setdefault(p["template"], set()).add(n)
        self.assertEqual({k: len(v) for k, v in per.items()}, {"mr": 5, "tbr": 5, "lab": 5, "qqt": 5})


if __name__ == "__main__":
    unittest.main()
