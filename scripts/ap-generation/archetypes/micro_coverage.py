"""AP Microeconomics 스킬·단원 범위 검사(2026-10-13). Physics 에서 원형 라이브러리가 스킬 한쪽에 쏠려 공식 범위를 못 맞춘 일을 막기 위해, 처음부터 '라이브러리 한 벌로 공식 범위 안의 60문항 시험을 조립할 수 있는가'를 정수계획으로 검사한다.
공식 근거: AP Microeconomics CED(V.1 ©2026) Exam Information p.122–124(단원 MC 가중, 스킬 범주 MC 가중, 수치 분석 20–30%, FRQ 과제 유형 비중). 문항 수 경계는 하한 내림·상한 올림(chem_coverage 와 같은 관용)."""
import math
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds

MC_N = 60
UNIT_MC = {"1": (12, 15), "2": (20, 25), "3": (22, 25), "4": (15, 22), "5": (10, 13), "6": (8, 13)}
CAT_MC = {"1": (30, 42), "2": (37, 47), "3": (16, 25)}  # 범주 4(그래프 그리기)는 MC 에서 평가하지 않는다
NUMERIC_MC = (20, 30)  # 1.C·2.C·3.C 문항 비중
NUMERIC_SKILLS = ("1.C", "2.C", "3.C")
MC_SKILLS = ["1.A", "1.B", "1.C", "1.D", "2.A", "2.B", "2.C", "3.A", "3.B", "3.C"]
FRQ_TOTAL = 20  # 긴 10 + 짧은 5 x 2
FRQ_TYPE_PCT = {"graph": (30, 50), "assertion": (10, 20), "explain": (25, 35), "numeric": (15, 30)}
MODE_TYPE = {"draw": "graph", "select": "assertion", "identify": "assertion", "explain": "explain", "calculate": "numeric"}


def count_bounds(rng_pct, n=MC_N):
    return math.floor(rng_pct[0] * n / 100 + 1e-9), math.ceil(rng_pct[1] * n / 100 - 1e-9)


def tags_from_registry():
    """원형 id -> [(단원, 스킬)]. 라이브러리를 실제로 한 번 돌려 얻는다."""
    import registry as R
    out = {}
    for n in R.MICRO_STAGES["micro_mc_all"]:
        p = R.batch(n, 1, 0)[0]
        out[n] = [(p["topic"].split(".")[0], p["skill"])]
    return out


def assemble_check(tags, n=MC_N, require_all_skills=True, forbid=()):
    """라이브러리에서 원형을 최대 한 번씩 골라 n문항을 공식 단원·스킬 범주·수치 분석 범위 안에서 조립할 수 있는지(정수계획)."""
    ids = sorted(a for a in tags if a not in forbid)
    A = len(ids)
    rows, lo, hi = [], [], []

    def add(coefs, l, h):
        rows.append(coefs); lo.append(l); hi.append(h)

    add([len(tags[a]) for a in ids], n, n)
    for u, r_ in UNIT_MC.items():
        l, h = count_bounds(r_, n)
        add([sum(1 for uu, _ in tags[a] if uu == u) for a in ids], l, h)
    for c, r_ in CAT_MC.items():
        l, h = count_bounds(r_, n)
        add([sum(1 for _, s in tags[a] if s[0] == c) for a in ids], l, h)
    l, h = count_bounds(NUMERIC_MC, n)
    add([sum(1 for _, s in tags[a] if s in NUMERIC_SKILLS) for a in ids], l, h)
    if require_all_skills:
        for sk in MC_SKILLS:
            add([sum(1 for _, s in tags[a] if s == sk) for a in ids], 1, A)
    res = milp(c=np.zeros(A), constraints=LinearConstraint(np.array(rows, dtype=float), lo, hi), integrality=np.ones(A), bounds=Bounds(0, 1))
    if not res.success:
        return False, None, res.message
    return True, [a for a, v in zip(ids, res.x) if v > 0.5], "ok"


def library_counts(tags):
    unit, cat, skill = {}, {}, {}
    for v in tags.values():
        for u, s in v:
            unit[u] = unit.get(u, 0) + 1; cat[s[0]] = cat.get(s[0], 0) + 1; skill[s] = skill.get(s, 0) + 1
    return unit, cat, skill


def frq_task_points(packs):
    """FRQ 점수의 과제 유형별 점수: 파트의 response_mode 로 분류(draw=그래프, select=단언, explain=설명, calculate=수치)."""
    pts, tot = {"graph": 0, "assertion": 0, "explain": 0, "numeric": 0}, 0
    for p in packs:
        for pt in p["parts"]:
            pts[MODE_TYPE[pt["response_mode"]]] += pt["points"]; tot += pt["points"]
    return pts, tot


def frq_exam_ok(packs):
    """세 문항(긴 1 + 짧은 2)이 공식 구조·과제 유형 비중 범위 안인지. 반환: (ok, 위반 목록, 유형별 점수)."""
    pts, tot = frq_task_points(packs)
    bad = []
    if tot != FRQ_TOTAL:
        bad.append(f"total_{tot}")
    longs = [p for p in packs if p["total_points"] == 10]; shorts = [p for p in packs if p["total_points"] == 5]
    if len(longs) != 1 or len(shorts) != 2:
        bad.append("structure_not_1_long_2_short")
    for t, r_ in FRQ_TYPE_PCT.items():
        l, h = math.ceil(r_[0] * FRQ_TOTAL / 100 - 1e-9), math.floor(r_[1] * FRQ_TOTAL / 100 + 1e-9)
        if not l <= pts[t] <= h:
            bad.append(f"{t}_{pts[t]}_not_in_{l}-{h}")
    return not bad, bad, pts
