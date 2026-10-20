"""2026-10-19 ap-bi-ph-ch: Biology BI3·BI4 와 Physics 1 PH5·PH6 를 위해 새로 쓴 원형(bio_p0_n·bio_p0_o·phys_p0_n·phys_p0_frq3)의 일관성 검사.
시드마다 (1) 선택지 4개가 서로 다르고 오답 설명 3개가 서로 다르며 (2) 학생 화면 글에 `1.2e+03` 같은 프로그램 표기·제어 문자(비원시 문자열의 \\t·\\f)가 없고 (3) 결정적이다(같은 시드 → 같은 결과)."""
import json
import random
import re
import unittest

import registry as R

BIO_NEW = [n for n in R.BIO if n.startswith(("bi_n_", "bis_n_"))]
PHYS_NEW = [n for st in ("phys_n_mc", "phys_n_sets", "phys_n2_mc") for n in R.PHYS_STAGES.get(st, [])]
PHYS_NEW_OWN = [n for n in PHYS_NEW if getattr(R.PHYS[n][0], "__module__", "") == "phys_p0_n"]
FRQ_NEW = R.PHYS_STAGES["phys_n_frq"]
CTRL = re.compile(r"[\x00-\x08\x09\x0b\x0c\x0e-\x1f]")
SCI = re.compile(r"\d[eE][+-]\d")


def items_of(p):
    return p["items"] if "items" in p else [p]


def check_pack(tc, name, p):
    for it in items_of(p):
        texts = [o["text"] for o in it["options"]]
        whys = [o["why"] for i, o in enumerate(it["options"]) if i != it["key_index"]]
        tc.assertEqual(len(set(texts)), 4, name)
        tc.assertEqual(len(set(whys)), 3, name)
        blob = it["stem"] + " " + " ".join(o["text"] + " " + o["why"] for o in it["options"])
        tc.assertIsNone(SCI.search(blob), (name, "program notation"))
        tc.assertIsNone(CTRL.search(blob), (name, "control char"))
        tc.assertLessEqual(len(it["stem"].split()), 118, (name, "stem words"))


class NewBio(unittest.TestCase):
    def test_counts_and_guide_rows(self):
        self.assertEqual(len([n for n in BIO_NEW if n.startswith("bi_n_")]), 30)
        self.assertEqual([n for n in BIO_NEW if n.startswith("bis_n_")], ["bis_n_cellcycle_set"])
        guide = {r["id"] for r in json.load(open("../../../lib/ap-generation/subjects/bio-archetypes.json"))}
        for n in BIO_NEW:
            if n.startswith("bis_n_"):
                self.assertTrue({f"{n}_q{i}" for i in range(1, 5)} <= guide, n)
            else:
                self.assertIn(n, guide, n)

    def test_pack_quality_and_determinism(self):
        for n in BIO_NEW:
            fn = R.BIO[n][0]
            for seed in range(25):
                p = fn(random.Random(seed))
                check_pack(self, n, p)
            self.assertEqual(json.dumps(fn(random.Random(7)), sort_keys=True), json.dumps(fn(random.Random(7)), sort_keys=True), n)

    def test_set_has_four_questions_and_a_shared_table(self):
        p = R.BIO["bis_n_cellcycle_set"][0](random.Random(3))
        self.assertEqual(len(p["items"]), 4)
        self.assertEqual(p["stimulus"]["kind"], "table")


class NewPhysics(unittest.TestCase):
    def test_guide_rows_exist_with_matching_skill(self):
        guide = {r["id"]: r for r in json.load(open("../../../lib/ap-generation/subjects/physics1-archetypes.json"))}
        for n in PHYS_NEW_OWN:
            p = R.PHYS[n][0](random.Random(1))
            for it in items_of(p):
                aid = it["archetype"]
                self.assertIn(aid, guide, aid)
                self.assertEqual(guide[aid]["skill"], it["skill"], aid)

    def test_pack_quality_and_determinism(self):
        for n in PHYS_NEW_OWN:
            fn = R.PHYS[n][0]
            for seed in range(25):
                check_pack(self, n, fn(random.Random(seed)))
            self.assertEqual(json.dumps(fn(random.Random(11)), sort_keys=True), json.dumps(fn(random.Random(11)), sort_keys=True), n)


class NewFrq(unittest.TestCase):
    def test_four_types_totals_and_rows(self):
        types = {}
        for n in FRQ_NEW:
            p = R.PHYS_FRQ[n][0](random.Random(5))
            types[p["template"]] = n
            self.assertEqual(sum(pt["points"] for pt in p["parts"]), p["total_points"], n)
            for pt in p["parts"]:
                self.assertEqual(sum(r["points"] for r in pt["rubric_rows"]), pt["points"], (n, pt["label"]))
        self.assertEqual(sorted(types), ["lab", "mr", "qqt", "tbr"])
        self.assertEqual([R.PHYS_FRQ[n][0](random.Random(5))["total_points"] for n in FRQ_NEW], [10, 12, 10, 8])

    def test_justification_part_has_a_reason_row(self):
        for n in FRQ_NEW:
            p = R.PHYS_FRQ[n][0](random.Random(2))
            for pt in p["parts"]:
                if pt["response_mode"] == "explain" and re.search(r"justify", pt["prompt"], re.I) and any(str(s).startswith("3.") for s in pt["skill_codes"]):
                    self.assertTrue(any(re.search(r"reason|justif", r["criterion"], re.I) for r in pt["rubric_rows"]), (n, pt["label"]))

    def test_table_stimulus_notes_have_no_latex(self):
        for n in FRQ_NEW:
            st = R.PHYS_FRQ[n][0](random.Random(4))["stimulus"]
            if st["kind"] == "table":
                self.assertIsNone(re.search(r"\\[A-Za-z]+", " ".join(st["data"].get("notes", []))), n)


if __name__ == "__main__":
    unittest.main()
