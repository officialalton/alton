"""AP Chemistry 스킬·단원 범위 검사(2026-10-13). Physics 에서 원형 라이브러리가 스킬 한쪽(2.B)에 쏠려 공식 범위를 못 맞춘 일을 막기 위해, 처음부터 '라이브러리 한 벌로 공식 범위 안의 60문항 세트를 조립할 수 있는가'를 정수계획으로 검사한다.
공식 근거: AP Chemistry CED(©2024) Exam Information V.1 p.206–207(단원 MC 가중, Practice 별 MC·FRQ 가중). 문항 수 경계는 floor(최소% × 60), ceil(최대% × 60)로 둔다(퍼센트 범위를 정수 문항 수로 옮기는 관용)."""
import math
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds

MC_N = 60
UNIT_MC = {"1": (7, 9), "2": (7, 9), "3": (18, 22), "4": (7, 9), "5": (7, 9), "6": (7, 9), "7": (7, 9), "8": (11, 15), "9": (7, 9)}
PRACTICE_MC = {"1": (8, 12), "2": (8, 12), "4": (23, 30), "5": (35, 42), "6": (8, 12)}  # Practice 3 은 MC 에서 평가하지 않는다
PRACTICE_FRQ = {"1": (2, 4), "2": (10, 16), "3": (8, 16), "4": (5, 9), "5": (43, 53), "6": (15, 24)}
MC_SKILLS = ["1.A", "1.B", "2.A", "2.B", "2.C", "2.D", "2.E", "2.F", "4.A", "4.B", "4.C", "4.D", "5.A", "5.B", "5.C", "5.D", "5.E", "5.F", "6.A", "6.B", "6.C", "6.D", "6.E", "6.F", "6.G"]
FRQ_TOTAL = 46  # 긴 문항 3 x 10 + 짧은 문항 4 x 4


def count_bounds(rng_pct, n=MC_N):
    return math.floor(rng_pct[0] * n / 100), math.ceil(rng_pct[1] * n / 100)


def tags_from_registry():
    """원형 id -> [(단원, 스킬)] (세트는 문항마다 한 쌍). 라이브러리를 실제로 한 번 돌려 얻는다."""
    import registry as R
    out = {}
    for n in R.CHEM_STAGES["chem_mc_all"] + R.CHEM_STAGES["chem_sets"]:
        p = R.batch(n, 1, 0)[0]
        out[n] = [(q["topic"].split(".")[0], q["skill"]) for q in (p["items"] if "items" in p else [p])]
    return out


def assemble_check(tags, n=MC_N, require_all_skills=True):
    """라이브러리에서 아키타입을 최대 한 번씩 골라 n문항을 공식 단원·Practice 범위 안에서 조립할 수 있는지(정수계획). 반환: (feasible, 선택 목록 또는 None, 사유)."""
    ids = sorted(tags)
    A = len(ids)
    rows, lo, hi = [], [], []

    def add(coefs, l, h):
        rows.append(coefs); lo.append(l); hi.append(h)

    add([len(tags[a]) for a in ids], n, n)
    for u, rng_ in UNIT_MC.items():
        l, h = count_bounds(rng_, n)
        add([sum(1 for uu, _ in tags[a] if uu == u) for a in ids], l, h)
    for pr, rng_ in PRACTICE_MC.items():
        l, h = count_bounds(rng_, n)
        add([sum(1 for _, s in tags[a] if s[0] == pr) for a in ids], l, h)
    if require_all_skills:
        for sk in MC_SKILLS:
            add([sum(1 for _, s in tags[a] if s == sk) for a in ids], 1, A)
    res = milp(c=np.zeros(A), constraints=LinearConstraint(np.array(rows, dtype=float), lo, hi), integrality=np.ones(A), bounds=Bounds(0, 1))
    if not res.success:
        return False, None, res.message
    return True, [a for a, v in zip(ids, res.x) if v > 0.5], "ok"


def library_counts(tags):
    """단원·Practice·스킬별 문항 수(라이브러리 크기)."""
    unit, prac, skill = {}, {}, {}
    for v in tags.values():
        for u, s in v:
            unit[u] = unit.get(u, 0) + 1; prac[s[0]] = prac.get(s[0], 0) + 1; skill[s] = skill.get(s, 0) + 1
    return unit, prac, skill


def frq_point_shares(packs):
    """FRQ 점수의 Practice 별 비중(%): 각 파트 점수를 그 파트의 스킬 코드에 균등 배분."""
    pts, tot = {}, 0.0
    for p in packs:
        for part in p["parts"]:
            codes = part["skill_codes"]
            for c in codes:
                pts[c[0]] = pts.get(c[0], 0.0) + part["points"] / len(codes)
            tot += part["points"]
    return {k: round(100 * v / tot, 1) for k, v in sorted(pts.items())}, tot
