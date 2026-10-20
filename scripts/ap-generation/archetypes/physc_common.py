"""AP Physics C: Mechanics 원형 공통 도구(2026-10-20, 신규 과목 첫 라운드). Physics 1 도구(phys_common·phys_sym·phys_figs)를 그대로 쓰고 과목 코드만 바꾼 mk/pbp 을 둔다.
규칙은 Physics 1 과 같다: 정답·표·그림 수치는 코드가 이중 경로(sympy 기호 vs numpy 수치 미분·적분·RK4·이분법)로 계산, 오답은 이름 붙은 오개념, 선택지 8% 이상 간격, 값은 모두 학생 화면 본문에 둔다.
C: Mechanics 는 미적분 기반이다(도함수·적분을 쓰는 풀이 단계, 회전 관성 적분, 저항력, 물리 진자). 시험 형식(42문항/85분·FRQ 4)은 공식 확인 전 값이다(docs/ap/physics-c-mechanics-groundwork.md)."""
import math  # noqa: F401
import random  # noqa: F401
from fractions import Fraction as Fr  # noqa: F401
import numpy as np  # noqa: F401
import sympy as sp  # noqa: F401
import phys_common as _pc
from phys_common import *  # noqa: F401,F403
from phys_common import pack, mc_blueprint, MAT_NONE, MAT_GRAPH, Opt  # noqa: F401
from phys_sym import tex_eval, sym_opts, rank_opts  # noqa: F401
from common import numeric_integral, table_stimulus  # noqa: F401
from phys_figs import make_fbd, make_vectors, check_scene, render_svg  # noqa: F401

SUBC = "ap_physics_c_mechanics"
CG = _pc.G


def pbp(arch, topic, skill, concept, thinking, cond, mis, path, material, judgment, method="sympy symbolic + independent numeric path"):
    return mc_blueprint(arch, SUBC, topic, skill, "allowed", concept, thinking, cond, mis, path, material=material, method=method, extra={"judgment_demand": judgment})


def mk(arch, topic, skill, stem, key, ds, rng, *, concept, thinking, cond, path, material, judgment, stim=None, est=120, facts=None, option_scenes=None, kwhy=None):
    if kwhy and not key.why:
        key.why = kwhy
    p = pack(arch, topic, skill, "allowed", stem, key, ds, rng, stimulus=stim, est=est, facts=facts or [])
    shown = [o for i, o in enumerate(p["options"]) if i != p["key_index"]]
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate(shown)]
    p["blueprint"] = pbp(arch, topic, skill, concept, thinking, cond, mis, path, material, judgment)
    return p


_COND = [("the model assumptions stated in the stem hold", "the stem states the model assumptions")]


def MQ(arch, topic, skill, stem, key, ds, rng, concept, think, path, why, facts, stim=None, est=100, mat=None, judg=None, cond=None):
    """원형 한 문항 팩(보일러플레이트 축약)."""
    return mk(arch, topic, skill, stem, key, ds, rng, concept=concept, thinking=think, cond=cond or _COND, path=path, material=mat or MAT_NONE, judgment=judg or ["law_selection", "symbolic_reasoning"], stim=stim, est=est, facts=facts, kwhy=why)


def nd(f, x0, h=1e-5):
    """독립 수치 경로: 중심 차분 도함수."""
    return (f(x0 + h) - f(x0 - h)) / (2 * h)


def simpson(f, a, b, n=4001):
    return numeric_integral(f, a, b, n)


def rank_x(vals, labels, rules, tie_tol=0.08):
    """rank_opts 와 같지만 오답 설명에 그 규칙이 실제로 만드는 순위를 덧붙인다(검토기가 '설명이 선택지와 어긋난다'며 반려하는 것을 막는다)."""
    key, ds, order = rank_opts(vals, labels, rules, tie_tol)
    for d in ds:
        d.why = f"{d.why} Applying that rule orders the objects {d.text}."
    return key, ds, order


def set_pack(arch, topic, intro, stim, items, facts):
    return {"archetype": arch, "topic": topic, "skill": "2.B", "calculator": "allowed", "set_intro": intro, "stimulus": stim, "items": items, "facts": facts, "blueprint": items[0]["blueprint"]}
