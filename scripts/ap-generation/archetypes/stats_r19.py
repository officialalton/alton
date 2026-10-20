"""AP Statistics 추가 라운드(2026-10-19, 연습 시험 3~5) 공통 도구. 이 모듈은 레지스트리 자동 등록 대상이 아니다(stats_s*.py 만 등록).
새 원형은 기존 공개 세트(ST1·ST2)의 풀이 틀을 쓰지 않는다. 정답·표·그림 수치는 코드가 계산하고 독립 경로(분수·전수 열거·math.erf·수치 적분)로 다시 계산한다.
mc(): 설계도·오답 오개념·난이도 신호를 한 번에 만든다(오답 보기의 why 가 곧 오개념 설명)."""
from stats_common import *  # noqa: F401,F403
from calc_ab_frq import row, part  # noqa: F401
from bp import frq_blueprint  # noqa: F401


def mc(arch, topic, skill, concept, steps, key, wrongs, rng, stem, how, judgment, stim=None, material=None, est=90, facts=None, cond=None, sig=None):
    """key=(text, why[, value]); wrongs=[(text, why, mid[, value[, step]]), ...]; sig=(concepts, representations, arithmetic) 이면 난이도 신호를 선언한다(steps 는 이 함수의 steps)."""
    k = Opt(key[0], True, key[1], key[2] if len(key) > 2 else None)
    ds = []
    for w in wrongs:
        o = Opt(w[0], False, w[1], w[3] if len(w) > 3 else None)
        o.step = w[4] if len(w) > 4 else 1
        ds.append(o)
    vals = [o.value for o in [k] + ds]
    if all(v is not None for v in vals):  # gates.statsMcRules 와 같은 검사: 값 선택지의 간격은 마지막 자릿수 단위의 2배 이상
        decs = max(len((o.text.replace("$", "").split(".") + [""])[1].split(" ")[0].rstrip("\\%).,")) if "." in o.text else 0 for o in [k] + ds)
        step = 10 ** -decs
        sv = sorted(float(v) for v in vals)
        if decs > 0 and any(sv[i] - sv[i - 1] < step * 2 - 1e-12 for i in range(1, len(sv))):
            raise ValueError("options_too_close_for_rounding")
    mis = [(w[2], w[1]) for w in wrongs]
    c = cond or [(concept[:90] if len(concept) >= 8 else "the stated conditions hold", "the stem and the displayed data give every value that this check uses")]
    bpr = sbp(arch, topic, skill, concept, steps, c, mis, how, material or ({"type": "none", "must_include": []} if stim is None else {"type": stim["data"].get("chart", "table") if isinstance(stim.get("data"), dict) else "table", "must_include": ["the displayed values"]}), judgment)
    p = spack(arch, topic, skill, stem, k, ds, rng, bpr, stim, est, facts or [])
    if sig:
        assert all(1 <= o.step <= len(steps) for o in ds), "fail_step_out_of_range"
        assert len({o.step for o in ds}) >= len(steps) - 1, "steps_not_load_bearing"
        concepts, reps, arith = sig
        p["difficulty_signals"] = {"steps": steps, "concepts": concepts, "representations": reps, "distractor_fail_step": {o.text: o.step for o in ds}, "arithmetic": arith}
    return p


def gaps_ok(vals, g):
    return min(abs(x - y) for i, x in enumerate(vals) for j, y in enumerate(vals) if i < j) >= g


def NOSTIM():
    return {"type": "none", "must_include": []}


def R(rid, crit, req, alt=None, err=None, requires=None, nums=False):
    """1점 채점 행."""
    return row(rid, 1, crit, req, None, alt, err, requires, False, nums, None, False)


def mean_based(pk):
    """서술(explain) 파트의 행은 문구 일치가 아니라 의미로 채점한다(표기: meaning_based). 허용 표현·흔한 오류는 행에 쓴 값을 그대로 쓴다."""
    for pt in pk["parts"]:
        if pt["response_mode"] != "explain":
            continue
        for r in pt["rubric_rows"]:
            r["meaning_based"] = True
            r["uses_concept"] = True
            r["single_explanation"] = False
            r["grading_note"] = "Award the point when the response conveys the required meaning in the context of the problem, whatever the wording; do not require any specific phrase. A response that states the right conclusion without the stated reason, or a reason without the conclusion, earns this row only when the row asks for just one of them."
            if not r["alt_solutions"]:
                r["alt_solutions"] = ["an equivalent statement in the student's own words that keeps the same meaning and the context"]
    return pk


def frq_pack(arch, template, topic, extra, skill, title, stim, parts, minutes, facts, expected, bpr_args, judgment):
    assert sum(p["points"] for p in parts) == 10 and sum(len(p["rubric_rows"]) for p in parts) == 10 and all(r["points"] == 1 for p in parts for r in p["rubric_rows"])
    pk = {"archetype": arch, "template": template, "topic": topic, "extra_topics": extra, "skill": skill, "representative_skill": skill, "calculator": "allowed", "title": title, "stimulus": stim,
          "parts": parts, "total_points": 10, "est_minutes": minutes, "facts": facts, "expected_values": expected}
    concept, thinking, conds, material, path_ = bpr_args
    pk["blueprint"] = frq_blueprint(arch, "ap_statistics", pk, concept, thinking, conds, material, path_, extra={"judgment_demand": judgment})
    mean_based(pk)
    return pk


def ev(part_label, quantity, value, tol):
    return {"part": part_label, "quantity": quantity, "value": float(value), "unit": "", "tolerance": tol}


def zstar(conf):
    """독립 경로: 정규 누적함수 이분법(scipy 의 ppf 를 쓰지 않는다)."""
    tail = 1 - (1 - conf) / 2
    lo, hi = 0.0, 6.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if ncdf(mid) < tail:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def tstar(conf, df):
    """독립 경로: t 밀도 수치 적분 위의 이분법."""
    tail = 1 - (1 - conf) / 2
    lo, hi = 0.0, 12.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if t_cdf_num(mid, df) < tail:
            lo = mid
        else:
            hi = mid
    v = (lo + hi) / 2
    agree(v, ss.t.ppf(tail, df), tol=1e-5, name="tstar")
    return v
