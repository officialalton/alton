"""BC4·BC5 확대 라운드(2026-10-19) 공통 도구. 공개 세트·재고와 풀이 틀이 다른 새 원형(c_x4_*, g_x4_*, frq_x4_*)을 짧게 쓰기 위한 조립 함수.
모든 정답은 정확 계산(유리수·sympy)으로 구하고, 코드 경로가 다른 수치 경로(격자·구적법·유한차분·부분합)로 다시 확인한다. 보기 값이 서로 다르고 키와 같지 않음을 이 모듈이 강제한다."""
from gcommon import *
from scommon import textopts
from scipy import integrate as QI
import math, re, warnings
warnings.simplefilter("ignore")

BCS = "ap_calculus_bc"


def tex(v):
    """sympy 식 → LaTeX(자연로그는 \\ln, 정수 인수 로그는 \\ln 3 꼴)."""
    s = sp.latex(sp.sympify(v))
    s = re.sub(r"\\log\{\\left\((\d+) \\right\)\}", r"\\ln \1", s)
    return s.replace("\\log", "\\ln")


def E(v):
    """정확한 값 → $...$ (유리수·π·근호·로그 포함 sympy 식)."""
    v = sp.sympify(v)
    if v.is_Rational or v.is_Float or v.free_symbols:
        return fmt(v)
    return "$" + tex(v) + "$"


def bpb(arch, topic, skill, calc, concept, thinking, cond, mis, path, mat=None):
    if len(thinking) < 2 or any(len(t_) < 15 for t_ in thinking):
        raise ValueError("blueprint_thinking_short")  # blueprint.ts: 사고 단계 2개 이상, 각 15자 이상
    if len(mis) < 3 or any(len(d) < 10 for _, d in mis) or len({d.lower() for _, d in mis}) != len(mis):
        raise ValueError("blueprint_misconceptions_short")  # blueprint.ts: 오개념 3개 이상, 설명 10자 이상, 서로 달라야 한다
    return mc_blueprint(arch, BCS, topic, skill, calc, concept, thinking, cond, mis, path, material=mat or {"type": "none", "must_include": []},
                        method="exact arithmetic (rational/sympy) + independent numeric cross-check")


def vopts(pairs, key_val, fmtfn=E):
    """pairs: [(why, value)] — 값이 서로 다르고 키와 다른 것만. 3개 미만이면 ValueError."""
    out, used = [], {round(float(sp.N(sp.sympify(key_val))), 9)}
    for why, v in pairs:
        k = round(float(sp.N(sp.sympify(v))), 9)
        if k in used or abs(k) > 1e9:
            continue
        used.add(k)
        out.append(Opt(fmtfn(v), False, why, v))
    if len(out) < 3:
        raise ValueError("not_enough_distractors")
    return out


def finish(arch, topic, skill, calc, stem, key_text, key_why, key_val, ds, rng, bpr, est=90, facts=None, stim=None):
    """key_text: 보기 문장(수식 포함), ds: [Opt]. 키 보기와 같은 텍스트가 오답에 없어야 한다."""
    key = Opt(key_text, True, key_why, key_val)
    if any(d.text == key_text for d in ds):
        raise ValueError("distractor_equals_key")
    return pack(arch, topic, skill, calc, stem, key, ds, rng, stimulus=stim, est=est, facts=facts or [], extra={"blueprint": bpr})


def tab(title, xlabel, ylabel, rows):
    return {"kind": "table", "description": title, "data": {"x_label": xlabel, "y_label": ylabel, "rows": [[str(a), str(b)] for a, b in rows]}}


def tab_multi(title, header, rows):
    """여러 열 표: header = [열 이름...], rows = [[...]]. 표 본문은 학생 화면에 그대로 보인다."""
    return {"kind": "table", "description": title, "data": {"columns": header, "rows": [[str(c) for c in r] for r in rows]}}
