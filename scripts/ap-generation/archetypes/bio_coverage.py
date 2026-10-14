"""AP Biology 스킬·단원 범위 검사(2026-10-13). 공식 근거: AP Biology CED(V.1, ©2025) Exam Information p.198(단원 MC 가중)·p.201(Practice MC 가중). 문항 수 경계는 floor(최소% × 60), ceil(최대% × 60).
라이브러리 한 벌로 '공식 단원·Practice 범위 안의 60문항 풀 세트'를 한 번에, 그리고 서로 겹치지 않는 두 회를 조립할 수 있는지를 정수계획으로 검사한다(Physics 에서 라이브러리가 한 스킬에 쏠린 일을 막기 위해 처음부터 계획에 넣는다)."""
import math
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds

MC_N = 60
UNIT_MC = {"1": (8, 11), "2": (10, 13), "3": (12, 16), "4": (10, 15), "5": (8, 11), "6": (12, 16), "7": (13, 20), "8": (10, 15)}
PRACTICE_MC = {"1": (25, 33), "2": (16, 24), "3": (8, 14), "4": (8, 14), "5": (8, 14), "6": (20, 26)}
SET_SIZE = 4
SET_COUNT = 2  # 한 회의 공유 자료 세트 수(공식: "individual questions or in sets of typically 4–5 questions each", 개수 미공표 → 우리 선택)
FRQ_TYPES = ["bio_q1_results", "bio_q2_graphing", "bio_q3_investigation", "bio_q4_conceptual", "bio_q5_model", "bio_q6_data"]
FRQ_POINTS = {"bio_q1_results": 9, "bio_q2_graphing": 9, "bio_q3_investigation": 4, "bio_q4_conceptual": 4, "bio_q5_model": 4, "bio_q6_data": 4}
FRQ_TOTAL = 34


def count_bounds(rng_pct, n=MC_N):
    return math.floor(rng_pct[0] * n / 100), math.ceil(rng_pct[1] * n / 100)


def tags_from_registry():
    """원형 id -> [(단원, 스킬)] (세트는 문항마다 한 쌍). 라이브러리를 실제로 한 번 돌려 얻는다."""
    import registry as R
    out = {}
    for n in R.BIO_STAGES["bio_mc_all"] + R.BIO_STAGES["bio_sets"]:
        p = R.batch(n, 1, 0)[0]
        out[n] = [(q["topic"].split(".")[0], q["skill"]) for q in (p["items"] if "items" in p else [p])]
    return out


def _rows(tags, ids, n, sets):
    rows, lo, hi = [], [], []

    def add(coefs, l, h):
        rows.append(coefs); lo.append(l); hi.append(h)
    return rows, lo, hi, add


def assemble_check(tags, n=MC_N, n_sets=SET_COUNT):
    """라이브러리에서 원형을 최대 한 번씩 골라 n문항(단독 + 세트 n_sets 개)을 공식 단원·Practice 범위 안에서 조립할 수 있는지. 반환: (가능, 선택 목록 또는 None, 사유)."""
    ids = sorted(tags)
    A = len(ids)
    sets = [i for i, a in enumerate(ids) if len(tags[a]) == SET_SIZE]
    rows, lo, hi, add = _rows(tags, ids, n, sets)
    add([len(tags[a]) for a in ids], n, n)
    add([1 if len(tags[a]) == SET_SIZE else 0 for a in ids], n_sets, n_sets)
    for u, rng_ in UNIT_MC.items():
        l, h = count_bounds(rng_, n)
        add([sum(1 for uu, _ in tags[a] if uu == u) for a in ids], l, h)
    for pr, rng_ in PRACTICE_MC.items():
        l, h = count_bounds(rng_, n)
        add([sum(1 for _, s in tags[a] if s[0] == pr) for a in ids], l, h)
    res = milp(c=np.zeros(A), constraints=LinearConstraint(np.array(rows, dtype=float), lo, hi), integrality=np.ones(A), bounds=Bounds(0, 1))
    if not res.success:
        return False, None, res.message
    return True, [a for a, v in zip(ids, res.x) if v > 0.5], "ok"


def assemble_two_check(tags, n=MC_N, n_sets=SET_COUNT):
    """서로 겹치지 않는(원형을 두 회 합쳐 최대 한 번) 두 회를 한 번에 조립할 수 있는지. 반환: (가능, [회1 목록, 회2 목록] 또는 None, 사유)."""
    ids = sorted(tags)
    A = len(ids)
    nv = 2 * A
    rows, lo, hi = [], [], []

    def add(coefs, l, h):
        rows.append(coefs); lo.append(l); hi.append(h)
    for e in (0, 1):
        off = e * A

        def vec(f):
            v = [0.0] * nv
            for k, a in enumerate(ids):
                v[off + k] = f(a)
            return v
        add(vec(lambda a: len(tags[a])), n, n)
        add(vec(lambda a: 1 if len(tags[a]) == SET_SIZE else 0), n_sets, n_sets)
        for u, rng_ in UNIT_MC.items():
            l, h = count_bounds(rng_, n)
            add(vec(lambda a, u=u: sum(1 for uu, _ in tags[a] if uu == u)), l, h)
        for pr, rng_ in PRACTICE_MC.items():
            l, h = count_bounds(rng_, n)
            add(vec(lambda a, pr=pr: sum(1 for _, s in tags[a] if s[0] == pr)), l, h)
    for k in range(A):
        v = [0.0] * nv; v[k] = 1; v[A + k] = 1
        add(v, 0, 1)
    res = milp(c=np.zeros(nv), constraints=LinearConstraint(np.array(rows, dtype=float), lo, hi), integrality=np.ones(nv), bounds=Bounds(0, 1))
    if not res.success:
        return False, None, res.message
    pick = [[a for k, a in enumerate(ids) if res.x[e * A + k] > 0.5] for e in (0, 1)]
    return True, pick, "ok"


def library_counts(tags):
    """단원·Practice·스킬별 문항 수(라이브러리 크기)."""
    unit, prac, skill = {}, {}, {}
    for v in tags.values():
        for u, s in v:
            unit[u] = unit.get(u, 0) + 1; prac[s[0]] = prac.get(s[0], 0) + 1; skill[s] = skill.get(s, 0) + 1
    return unit, prac, skill


def frq_point_shares(packs):
    """FRQ 점수의 Practice 별 비중(%): 각 파트 점수를 그 파트의 스킬 코드에 균등 배분(공식 FRQ Practice 비중은 미공표 — 참고용)."""
    pts, tot = {}, 0.0
    for p in packs:
        for part in p["parts"]:
            codes = part["skill_codes"]
            for c in codes:
                pts[c[0]] = pts.get(c[0], 0.0) + part["points"] / len(codes)
            tot += part["points"]
    return {k: round(100 * v / tot, 1) for k, v in sorted(pts.items())}, tot
