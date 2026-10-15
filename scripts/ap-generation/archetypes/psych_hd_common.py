"""AP Psychology 고차 원형 공통(2026-10-15, 브랜치 psych-hard). psych_common.mk 위에 (1) 변형마다 풀이 단계(thinking)를 선언하고 (2) 정답이 가장 긴 선택지가 되지 않게 강제하고
(3) 표의 백분율이 정수 인원과 맞는지 코드로 확인한다(감사 지적: 표의 비율은 정수 인원 수와 일치해야 한다).
변형 = (질문, 정답 문장, 정답 설명, [(오답 문장, 오개념 설명) x 3], 자료 또는 None, 풀이 단계 목록(3개 이상)). 심리학 사실은 CED 필수 내용 안에서 주류 합의만 쓴다(재현 논란 연구는 쓰지 않는다)."""
import re
from psych_common import mk, tbl, PATH_CONCEPT  # noqa: F401
from psych_hd_signals import CONCEPTS, FAILS, TABLE_ARCHS


def pct_rows_ok(stim):
    """표에 백분율이 있으면 같은 행의 최대 정수(인원)와 곱해 정수가 되어야 한다. 위반이면 ValueError."""
    if not stim or stim.get("kind") != "table":
        return
    for row in stim["data"]["rows"]:
        ints = [int(c) for c in row if re.fullmatch(r"\s*\d{1,5}\s*", str(c))]
        pcts = [float(m.group(1)) for c in row for m in [re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*%\s*", str(c))] if m]
        if not ints or not pcts:
            continue
        n = max(ints)
        for p in pcts:
            k = p * n / 100
            if abs(k - round(k)) > 1e-9:
                raise ValueError(f"pct_not_integer_count:{p}%_of_{n}")


def key_not_longest(key_text, wrongs):
    """정답이 가장 긴 선택지(단독 최대)가 되지 않게 한다: 정답 길이 <= 오답 중 최대 길이."""
    if len(key_text) > max(len(w[0]) for w in wrongs):
        raise ValueError("key_is_longest_option")


def hd_fixed(arch, topic, skill, concept, ek, variants):
    def fn(rng):
        v = variants[rng.randrange(len(variants))]
        q, kt, kw, wr = v[:4]
        stim = v[4] if len(v) > 4 else None
        thinking = v[5] if len(v) > 5 else None
        key_not_longest(kt, wr)
        pct_rows_ok(stim)
        vi = variants.index(v); base = arch[3:] if arch.startswith("ps_") else arch
        p = mk(arch, topic, skill, q, kt, kw, wr, rng, concept=concept, ek=ek, est=95, stim=stim, thinking=thinking,
               cond=[("the stem supplies every fact needed and exactly one option follows from all of the steps", "stem and options")])
        # 난이도 신호(AP Statistics S3 방식): 필수 풀이 단계·결합 개념·자료 수·오답이 처음 틀어지는 단계를 코드로 선언한다(lib/ap-generation/stats-difficulty.ts 가 게이트로 검증하고 판정기에 사실로 보여 준다).
        fails = FAILS[base][vi]
        p["difficulty_signals"] = {"steps": list(thinking), "concepts": list(CONCEPTS[base]), "representations": 2 if (base in TABLE_ARCHS or stim) else 1, "distractor_fail_step": {w[0]: f for w, f in zip(wr, fails)}, "arithmetic": "none"}
        return p
    fn.__name__ = arch
    return fn


def register_hd(g, items):
    names = []
    for (arch, topic, skill, concept, ek, variants) in items:
        if len(variants) < 2:
            raise ValueError("need_two_variants:" + arch)
        fn = hd_fixed("ps_" + arch, topic, skill, concept, ek, variants)
        fn.__module__ = g["__name__"]
        g["ps_" + arch] = fn
        names.append("ps_" + arch)
    return names
