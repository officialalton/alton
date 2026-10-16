"""보강 생성(2026-10-09 오너 승인 supplement) MC 원형 공통 도구. 그래프 없는 일반 문항(c_ 접두)과 텍스트 선택지 문항을 짧게 쓰기 위한 조립 함수."""
from gcommon import *


def dec4(v):
    return "$%.4f$" % v


def dec3(v):
    return "$%.3f$" % v


def numopts(pairs, key_val, textfn=dec4, tol=None):
    """pairs: [(why, value)] → 값이 서로 다르고 키와 다른 것만 Opt. 표기 기준으로 같은 텍스트도 제거."""
    out, used = [], {textfn(key_val)}
    for why, v in pairs:
        t = textfn(v)
        if t in used or abs(float(v)) > 1e7:
            continue
        used.add(t)
        out.append(Opt(t, False, why, v))
    if len(out) < 3:
        raise ValueError("not_enough_distractors")
    return out


def textopts(pairs):
    """pairs: [(text, why)] → 값 없는 텍스트 선택지 Opt(오답)."""
    out, used = [], set()
    for t, why in pairs:
        if t in used:
            continue
        used.add(t)
        out.append(Opt(t, False, why, None))
    if len(out) < 3:
        raise ValueError("not_enough_distractors")
    return out


def nb(arch, topic, skill, calc, concept, thinking, cond, mis, path, subject, method="exact arithmetic + independent numeric cross-check"):
    return bp(arch, topic, skill, calc, concept, thinking, cond, mis, path, {"type": "none", "must_include": []}, method=method, subject=subject)


def build(arch, topic, skill, calc, stem, key, ds, rng, bpr, est=90, facts=None):
    return pack(arch, topic, skill, calc, stem, key, ds, rng, est=est, facts=facts or [], extra={"blueprint": bpr})
