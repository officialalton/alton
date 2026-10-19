#!/usr/bin/env python3
"""고친 원형이 지금 내는 문항 표본(무료·로컬). 독립 풀이 검증(ap-typefix-1019-verify-solve.ts)이 읽는다.
  .venv-ap/bin/python scripts/audit/ap-typefix-1019-samples.py
저장된 재고 문항은 건드리지 않는다. 출력: data/audit/ap-typefix-1019-archetype-samples.json (시드 고정 → 재현 가능)."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts", "ap-generation", "archetypes"))
os.chdir(os.path.join(ROOT, "scripts", "ap-generation", "archetypes"))
import registry as R  # noqa: E402

PLAN = [  # (원형, 과목, 개수)
    ("st_chisq_setup", "ap_statistics", 4), ("mi_public_good_efficient", "ap_microeconomics", 3), ("st_pvalue_interpretation", "ap_statistics", 3), ("ph_evid_collision_data", "ap_physics_1", 3),
    ("g_taylor_deriv_graph", "ap_calculus_bc", 1), ("g_lagrange_decimal_calc", "ap_calculus_bc", 1), ("g_lhopital_graph", "ap_calculus_ab", 1), ("bis_population_set", "ap_biology", 1),
    ("bif_q1_inhibitor", "ap_biology", 1), ("bif_q2_potato", "ap_biology", 1), ("bif_q5_replication", "ap_biology", 2), ("bif_q3_uvbacteria", "ap_biology", 1), ("bif_q6_mitotic", "ap_biology", 1),
    ("mif_short_labor", "ap_microeconomics", 1), ("chf_long_kinetics", "ap_chemistry", 1), ("stfrq_q2_regression", "ap_statistics", 1), ("frq_fprime_graph", "ap_calculus_ab", 1),
]
out = []
for name, subj, n in PLAN:
    packs = R.batch(name, n, 500)
    if len(packs) < n:
        raise SystemExit(f"{name}: only {len(packs)} packs")
    for p in packs:
        out.append({"archetype": name, "subject": subj, "seed": p["seed"], "kind": "frq_bundle" if p.get("parts") else "mc", "payload": p})
os.makedirs(os.path.join(ROOT, "data", "audit"), exist_ok=True)
with open(os.path.join(ROOT, "data", "audit", "ap-typefix-1019-archetype-samples.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False)
print(len(out), "samples")
