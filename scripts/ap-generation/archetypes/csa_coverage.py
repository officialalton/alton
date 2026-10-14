"""AP Computer Science A 단원·Practice 범위 검사(2026-10-13). Physics 에서 원형 라이브러리가 스킬 한쪽에 쏠려 공식 범위를 못 맞춘 일을 막기 위해, 처음부터
'라이브러리 한 벌로 공식 범위 안의 42문항 세트를 조립할 수 있는가'를 정수계획으로 검사한다.
공식 근거: data/ap/curriculum-2027/ap_computer_science_a.json(CED ©2025 전사: 단원 MC 가중, Practice MC 가중). 문항 수 경계는 floor(최소% × 42), ceil(최대% × 42)(퍼센트 범위를 정수 문항 수로 옮기는 관용).
Practice 1(설계)·Practice 5(컴퓨팅의 영향)는 코드 실행으로 정답을 검증할 수 없어 라이브러리에 두지 않는다 — 최솟값이 floor(2% × 42) = 0 이라 범위 안 조립은 가능(권장: 오너 결정으로 비코드 문항 1~2개 추가)."""
import math
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds

MC_N = 42
UNIT_MC = {"1": (15, 25), "2": (25, 35), "3": (10, 18), "4": (30, 40)}
PRACTICE_MC = {"1": (2, 10), "2": (22, 38), "3": (37, 53), "4": (10, 15), "5": (2, 10)}
FRQ_PRACTICE = {"2": (100, 100)}
CODE_SKILLS = ["2.A", "2.B", "2.C", "3.A", "3.B", "3.C", "3.D", "4.A", "4.B"]  # 코드 실행으로 검증 가능한 스킬 — 1.A·1.B·5.A 는 비코드
NON_CODE_SKILLS = ["1.A", "1.B", "5.A"]
FRQ_TOTAL = 36  # 4문항 x 9점


def count_bounds(rng_pct, n=MC_N):
    return math.floor(rng_pct[0] * n / 100), math.ceil(rng_pct[1] * n / 100)


def tags_from_registry():
    """원형 id -> [(단원, 스킬)] (세트는 문항마다 한 쌍). 라이브러리를 실제로 한 번 돌려 얻는다."""
    import registry as R
    out = {}
    for n in R.CSA_STAGES["csa_mc_all"] + R.CSA_STAGES["csa_sets"]:
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
        for sk in CODE_SKILLS:
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


def pilot_cells(n=22):
    """파일럿 MC n칸(약 22)의 단원·Practice 목표 분포: 공식 중앙값 비율을 반올림해 정수로 맞춘다(단원 1:2:3:4, Practice 2:3:4)."""
    unit_mid = {u: (a + b) / 2 for u, (a, b) in UNIT_MC.items()}
    tot = sum(unit_mid.values())
    raw = {u: unit_mid[u] / tot * n for u, in [(u,) for u in unit_mid]}
    base = {u: int(v) for u, v in raw.items()}
    for u in sorted(raw, key=lambda k: raw[k] - base[k], reverse=True)[: n - sum(base.values())]:
        base[u] += 1
    return base


SET_PER_EXAM = (1, 3)  # 우리 구성(공식 세트 수는 미공표): 풀 모의고사 한 회의 2문항 세트는 0~3개


def assemble_two_check(tags, n=MC_N, require_all_skills=True, sets_per_exam=SET_PER_EXAM):
    """서로 겹치지 않는 풀 모의고사 두 회(각 n문항)를 같은 라이브러리에서 조립할 수 있는지(정수계획): 원형(구조)은 두 시험을 통틀어 최대 한 번, 각 회는 공식 단원·Practice 범위를 지키고
    (require_all_skills 면) 코드 검증 가능한 스킬이 회마다 하나 이상 나오며, 2문항 세트는 회마다 sets_per_exam 범위. 반환: (feasible, [첫 회 원형, 둘째 회 원형] 또는 None, 사유)."""
    ids = sorted(tags)
    A = len(ids)
    rows, lo, hi = [], [], []

    def add(coefs, l, h):
        rows.append(coefs); lo.append(l); hi.append(h)

    def zeros():
        return [0.0] * (2 * A)

    def exam_row(e, f):
        r = zeros()
        for i, a in enumerate(ids):
            r[e * A + i] = f(tags[a])
        return r
    for i in range(A):  # 원형은 두 시험에서 합쳐 한 번만
        r = zeros(); r[i] = 1; r[A + i] = 1
        add(r, 0, 1)
    for e in (0, 1):
        add(exam_row(e, len), n, n)
        for u, rng_ in UNIT_MC.items():
            l, h = count_bounds(rng_, n)
            add(exam_row(e, lambda t, u=u: sum(1 for uu, _ in t if uu == u)), l, h)
        for pr, rng_ in PRACTICE_MC.items():
            l, h = count_bounds(rng_, n)
            add(exam_row(e, lambda t, pr=pr: sum(1 for _, s in t if s[0] == pr)), l, h)
        if require_all_skills:
            for sk in CODE_SKILLS:
                add(exam_row(e, lambda t, sk=sk: sum(1 for _, s in t if s == sk)), 1, 2 * A)
        add(exam_row(e, lambda t: 1 if len(t) > 1 else 0), sets_per_exam[0], sets_per_exam[1])
    res = milp(c=np.zeros(2 * A), constraints=LinearConstraint(np.array(rows, dtype=float), lo, hi), integrality=np.ones(2 * A), bounds=Bounds(0, 1))
    if not res.success:
        return False, None, res.message
    return True, [[a for i, a in enumerate(ids) if res.x[e * A + i] > 0.5] for e in (0, 1)], "ok"
