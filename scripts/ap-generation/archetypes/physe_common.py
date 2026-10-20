"""AP Physics C: Electricity and Magnetism 원형 공통 도구(2026-10-20, 신규 과목). Physics 1 도구(phys_common·phys_sym)와 Physics C: Mechanics 도구(physc_common)의 방식을 그대로 쓰고 과목 코드·전자기 상수·단위 표기만 더한다.
규칙은 같다: 정답·표·그림 수치는 코드가 이중 경로(sympy 기호 풀이 vs numpy 수치 적분·미분·RK4·선형계·이분법)로 계산, 오답은 이름 붙은 오개념, 선택지 8% 이상 간격, 필요한 값은 모두 학생 화면 본문에 둔다.
E&M 은 미적분 기반이다(가우스 법칙의 적분, 연속 전하 분포, RC·RL 미분 방정식, 패러데이 법칙의 미분). 시험 형식(MC 42/85분, FRQ 4/95분: MR 10·TBR 12·LAB 10·QQT 8)은 AP Central CED(Course Framework V.1, 2026)로 확인했다(docs/ap/physics-c-em-groundwork.md)."""
import math  # noqa: F401
import random  # noqa: F401
from fractions import Fraction as Fr  # noqa: F401
import numpy as np  # noqa: F401
import sympy as sp  # noqa: F401
import phys_common as _pc
from phys_common import *  # noqa: F401,F403
from phys_common import pack, mc_blueprint, MAT_NONE, MAT_GRAPH, MAT_DIAGRAM, Opt  # noqa: F401
from phys_sym import tex_eval, sym_opts, rank_opts  # noqa: F401
from common import numeric_integral, table_stimulus  # noqa: F401

SUBC = "ap_physics_c_electricity_and_magnetism"
K = 9.0e9  # N m^2 / C^2 (시험 참조 정보 값; 문항 본문에 적어 준다)
EPS0 = 8.85e-12  # C^2 / (N m^2)
MU0 = 4e-7 * math.pi  # T m / A
QE = 1.60e-19  # C
ME = 9.11e-31  # kg
MP = 1.67e-27  # kg

# 단위(TeX) — 값은 문항에서 접두어(µ, n, m)에 맞춰 환산해 쓴다
U_N = "\\text{ N}"; U_MN = "\\text{ mN}"; U_C = "\\text{ C}"; U_UC = "\\,\\mu\\text{C}"; U_NC = "\\text{ nC}"; U_NCC = "\\text{ N/C}"; U_VM = "\\text{ V/m}"
U_V = "\\text{ V}"; U_MV = "\\text{ mV}"; U_J = "\\text{ J}"; U_MJ = "\\text{ mJ}"; U_UJ = "\\,\\mu\\text{J}"; U_M = "\\text{ m}"; U_CM = "\\text{ cm}"; U_MM = "\\text{ mm}"
U_F = "\\text{ F}"; U_UF = "\\,\\mu\\text{F}"; U_NF = "\\text{ nF}"; U_PF = "\\text{ pF}"; U_OHM = "\\,\\Omega"; U_KOHM = "\\text{ k}\\Omega"; U_A = "\\text{ A}"; U_MA = "\\text{ mA}"
U_T = "\\text{ T}"; U_MT = "\\text{ mT}"; U_UT = "\\,\\mu\\text{T}"; U_WB = "\\text{ Wb}"; U_MWB = "\\text{ mWb}"; U_H = "\\text{ H}"; U_MH = "\\text{ mH}"; U_S = "\\text{ s}"; U_MS = "\\text{ ms}"; U_US = "\\,\\mu\\text{s}"
U_W = "\\text{ W}"; U_MW = "\\text{ mW}"; U_MS1 = "\\text{ m/s}"; U_HZ = "\\text{ Hz}"; U_RAD = "\\text{ rad/s}"; U_KG = "\\text{ kg}"
C_K = "$k=9.0\\times10^{9}\\text{ N}\\cdot\\text{m}^{2}/\\text{C}^{2}$"
C_EPS = "$\\varepsilon_0=8.85\\times10^{-12}\\text{ C}^{2}/(\\text{N}\\cdot\\text{m}^{2})$"
C_MU = "$\\mu_0=4\\pi\\times10^{-7}\\text{ T}\\cdot\\text{m/A}$"
C_E = "$e=1.60\\times10^{-19}\\text{ C}$"


def QU(v, utex, n=3):
    """수치+TeX 단위 -> $...$ (값은 이미 접두어에 맞게 환산된 수)."""
    if v != 0 and (abs(v) < 0.01 or abs(v) >= 1e5):
        return SCI(v, utex, n)
    return "$" + sig(v, n) + utex + "$"


def FU(utex, n=3):
    """선택지 서식 함수: num_opts/signed_opts 의 fmt 에 넘긴다."""
    return lambda v: QU(v, utex, n)


def SCI(v, utex="", n=3):
    """과학적 표기 $1.30\\times10^{5}$ + 단위."""
    if v == 0:
        return "$0" + utex + "$"
    e = int(math.floor(math.log10(abs(v)))); m = v / 10 ** e
    ms = sig(m, n)
    if ms.startswith("10"):
        e += 1; ms = sig(v / 10 ** e, n)
    return "$" + ms + f"\\times10^{{{e}}}" + utex + "$"


def FS(utex, n=3):
    return lambda v: QU(v, utex, n) if (v == 0 or 0.01 <= abs(v) < 1e5) else SCI(v, utex, n)


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
    key, ds, order = rank_opts(vals, labels, rules, tie_tol)
    for d in ds:
        d.why = f"{d.why} Applying that rule orders the objects {d.text}."
    return key, ds, order


def set_pack(arch, topic, intro, stim, items, facts):
    return {"archetype": arch, "topic": topic, "skill": "2.B", "calculator": "allowed", "set_intro": intro, "stimulus": stim, "items": items, "facts": facts, "blueprint": items[0]["blueprint"]}


def fx(v, n=3):
    """sig 의 짧은 별칭."""
    return sig(v, n)
