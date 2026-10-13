"""AP Statistics MC 원형 공통 도구(2026-10-12, S1 파일럿). 모든 정답·표·그림 수치는 코드가 계산한다. LLM 은 stem 문장만 다듬는다.
- 이중 경로: scipy.stats 값은 math.erf·직접 수치 적분(scipy.integrate.quad 로 pdf 를 적분, 분포 함수 자체는 쓰지 않음)·정확 분수·전수 열거로 독립 재계산한다.
- 표기: 수·확률·통계량은 모두 $...$ 안(TeX 위생). 소수 선택지는 stem 이 반올림 관례를 밝힌다(gates.statsMcRules).
- 해석형 문항은 고정 문장 4개(정답 1 + 이름 붙은 오해 3)로 만든다. 문장 길이는 비슷하게 맞춘다(길이 단서 방지)."""
import math
import random  # noqa: F401  (원형 파일이 rng 타입 힌트용으로 쓴다)
from fractions import Fraction as Fr
import numpy as np
from scipy import stats as ss, integrate as _I
from common import Opt, pack
from bp import mc_blueprint

SUB = "ap_statistics"


# ---------------- 표기 ----------------
def T(v, nd=3):
    """수치를 $...$ 로. 음수 0 표기 방지."""
    s = f"{v:.{nd}f}"
    if float(s) == 0:
        s = s.lstrip("-")
    return "$" + s + "$"


def TI(n):
    return "$" + str(int(n)) + "$"


def PCT(v, nd=1):
    return "$" + f"{v * 100:.{nd}f}" + "\\%$"


def clean(v, nd=4):
    """보기 좋은 소수(불필요한 0 제거)."""
    s = f"{v:.{nd}f}".rstrip("0").rstrip(".")
    return s or "0"


def TC(v, nd=4):
    return "$" + clean(v, nd) + "$"


# ---------------- 독립 분포 계산 ----------------
def ncdf(z):
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def t_pdf(x, df):
    return math.gamma((df + 1) / 2) / (math.sqrt(df * math.pi) * math.gamma(df / 2)) * (1 + x * x / df) ** (-(df + 1) / 2)


def t_cdf_num(x, df):
    """t 분포 누적(독립 경로: pdf 수치 적분)."""
    if x >= 0:
        return 1 - _I.quad(lambda u: t_pdf(u, df), x, math.inf)[0]
    return _I.quad(lambda u: t_pdf(u, df), -math.inf, x)[0]


def chi2_pdf(x, k):
    return x ** (k / 2 - 1) * math.exp(-x / 2) / (2 ** (k / 2) * math.gamma(k / 2))


def chi2_sf_num(x, k):
    return _I.quad(lambda u: chi2_pdf(u, k), x, math.inf)[0]


def agree(a, b, tol=1e-6, name="value"):
    if abs(float(a) - float(b)) > tol * max(1.0, abs(float(b))):
        raise ValueError(f"independent_check_failed:{name}:{a}:{b}")


# ---------------- 설계도·팩 ----------------
def sbp(arch, topic, skill, concept, thinking, cond, mis, path, material, judgment, method="exact arithmetic + independent numeric path"):
    return mc_blueprint(arch, SUB, topic, skill, "allowed", concept, thinking, cond, mis, path, material=material, method=method, extra={"judgment_demand": judgment})


def spack(arch, topic, skill, stem, key, ds, rng, bpr, stim=None, est=90, facts=None):
    return pack(arch, topic, skill, "allowed", stem, key, ds, rng, stimulus=stim, est=est, facts=facts or [], extra={"blueprint": bpr})


DATA_CHARTS = ("histogram", "dot_plot", "boxplot", "scatter", "two_way", "bar", "table")


def stat_stim(desc, chart, **kw):
    """stimulus(kind stat_chart): data 계열(histogram·dot_plot·boxplot·scatter·two_way·bar·table)은 SAT data 스펙 필드를 data.data 에 넣고,
    tree·curve·output 은 같은 이름의 키(tree=… / curve=… / output=…)와 선택적 title 을 그대로 둔다."""
    if chart in DATA_CHARTS:
        title = kw.pop("title", None)
        d = {"chart": chart, "data": kw}
        if title:
            d["title"] = title
        return {"kind": "stat_chart", "description": desc, "data": d}
    return {"kind": "stat_chart", "description": desc, "data": {"chart": chart, **kw}}


def sentence_options(key_text, key_why, wrongs):
    """고정 문장 선택지: 정답 1 + 이름 붙은 오해. wrongs: [(문장, 오해 설명)]."""
    ds = [Opt(t, False, w, None) for t, w in wrongs]
    return Opt(key_text, True, key_why, None), ds


def curve_pts(pdf, lo, hi, n=81):
    return [[round(lo + (hi - lo) * i / (n - 1), 4), float(pdf(lo + (hi - lo) * i / (n - 1)))] for i in range(n)]


def normal_curve(mean, sd, ticks, label, shades=None, marks=None, z=True, k=4.0, title=None):
    lo, hi = mean - k * sd, mean + k * sd
    cur = {"family": "normal", "x": {"label": label, "min": round(lo, 4), "max": round(hi, 4), "ticks": ticks},
           "points": curve_pts(lambda x: math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * math.sqrt(2 * math.pi)), lo, hi)}
    if z:
        cur["z"] = {"mean": mean, "sd": sd, "ticks": [-3, -2, -1, 0, 1, 2, 3]}
    if shades:
        cur["shades"] = shades
    if marks:
        cur["marks"] = marks
    d = {"curve": cur}
    if title:
        d["title"] = title
    return d


def pick(rng, seq):
    return seq[rng.randrange(len(seq))]


def forever(n=4000):
    for _ in range(n):
        yield
    raise ValueError("no_sample")


def stat_names():
    return None
