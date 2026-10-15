"""AP Macroeconomics exam_prep 보강 원형 공통 도구(2026-10-15, 브랜치 macro-hard). 구조 기준(판정기 입력): 3단계 이상, 개념 또는 자료 2개 이상 결합, 앞 단계 결과를 다음 단계로 가져간다.
모든 정답은 코드가 두 경로(정확 분수·규칙표 vs sympy·반복 시뮬레이션·전수 탐색)로 계산하고, 오답은 단계 누락·오적용 값이다. 문서: docs/ap/macroeconomics-groundwork.md §8."""
from macro_models import *  # noqa: F401,F403
from macro_models import _sg  # noqa: F401


def steps(*s):
    return list(s)


def num_item(arch, topic, skill, stem, val, pairs, fmt, rng, *, concept, path, st, stim=None, facts=None, kwhy=None, est=100, judgment=None, need=4):
    """수치 선택지 문항: val_opts(키 + 오개념 값) → mk. st 는 학생이 거치는 단계 목록(설계도 student_thinking)."""
    key, ds = val_opts(val, pairs, fmt, need=need)
    return mk(arch, topic, skill, stem, key, ds, rng, concept=concept, path=path, thinking=st, stim=stim, est=est, facts=facts or [], kwhy=kwhy,
              judgment=judgment or "carry the result of each step into the next step")


def sent_item(arch, topic, skill, stem, key_text, key_why, wrongs, rng, *, concept, path, st, stim=None, facts=None, est=95, judgment=None):
    k, ds = sent_opts(key_text, key_why, wrongs)
    return mk(arch, topic, skill, stem, k, ds, rng, concept=concept, path=path, thinking=st, stim=stim, est=est, facts=facts or [],
              judgment=judgment or "carry the result of each step into the next step")


def combo_n(rng, vs, truth, mech, dirs=(1, -1), phr=None):
    """n 개 변수의 방향 조합 선택지(정답 1 + 오답 4). 한 변수만 틀린 조합을 우선한다. 반환 (key Opt, [Opt])."""
    import itertools
    from common import Opt as _O
    ph = phr or phrase
    t = tuple(truth[v] for v in vs)
    allc = [c for c in itertools.product(dirs, repeat=len(vs)) if c != t]
    one = [c for c in allc if sum(a != b for a, b in zip(c, t)) == 1]
    two = [c for c in allc if sum(a != b for a, b in zip(c, t)) >= 2]
    rng.shuffle(one); rng.shuffle(two)
    pick_c = (one + two)[:4]
    if len(pick_c) < 4:
        raise ValueError("not_enough_separated_distractors")

    def txt(c):
        parts = [ph(v, d) for v, d in zip(vs, c)]
        low = lambda x: x[0].lower() + x[1:]  # noqa: E731
        return (parts[0] + ", " + ", ".join(low(x) for x in parts[1:-1]) + ", and " + low(parts[-1]) + ".") if len(parts) > 2 else parts[0] + ", and " + low(parts[1]) + "."
    key = _O(txt(t), True, " ".join(mech[v] for v in vs), None)
    ds = []
    for c in pick_c:
        why = []
        for v, a, b in zip(vs, c, t):
            if a == b:
                continue
            nm_ = NAMES[v]
            if a is None:
                why.append(f"Calls the effect on {nm_} indeterminate, but it would {DIRW[b]}. {mech[v]}")
            elif b is None:
                why.append(f"Claims {nm_} would {DIRW[a]} for certain, but the effect is indeterminate. {mech[v]}")
            else:
                why.append(f"Says {nm_} would {DIRW[a]}, but it would {DIRW[b]}. {mech[v]}")
        ds.append(_O(txt(c), False, " ".join(why), None))
    return key, ds


def combo_item_n(arch, topic, skill, stem, vs, truth, mech, rng, *, dirs=(1, -1), concept, path, st, stim=None, facts=None, est=95, judgment=None):
    k, ds = combo_n(rng, vs, truth, mech, dirs)
    return mk(arch, topic, skill, stem, k, ds, rng, concept=concept, path=path, thinking=st, stim=stim, est=est, facts=facts or [], judgment=judgment or "carry the result of each step into the next step")


def whole(v):
    return abs(float(v) - round(float(v))) < 1e-9


def moneyb(v):
    return f"${int(round(float(v))):,} billion"


def signed_money(v, pos, neg):
    return f"{pos if v > 0 else neg} ${int(round(abs(float(v)))):,} billion"
