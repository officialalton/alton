"""AP Physics 1 기호식·순위 선택지 도구(2026-10-13, phys-s3: 스킬 2.A·2.C 원형용).
- 2.A: 선택지가 기호식(TeX)이다. 화면에 나가는 TeX 는 손으로 쓰므로 `tex_eval` 이 그 TeX 를 문항의 실제 숫자로 계산해 sympy/수치로 유도한 정답과 일치하는지(정답) 확인하고,
  오답 식은 서로 MIN_REL_SEP(8%) 이상 다른 값이 되는 것만 채택한다(값이 거의 같아 구별이 안 되는 오답 방지).
- 2.C: 선택지가 순위(`A > C > B > D`)다. 정답 순위는 계산한 값으로 정하고, 오답 순위는 이름 붙은 잘못된 규칙(힘만 비교, 질량만 비교 …)의 점수로 만든다."""
import math
import re
from phys_common import Opt, agree, MIN_REL_SEP

_GREEK = {"mu", "theta", "phi", "omega", "rho", "pi", "alpha", "tau", "Delta"}


def tex_eval(tex, env):
    """작은 TeX 부분집합(\\frac \\sqrt \\sin \\cos \\tan \\left( \\right) \\cdot ^ _ 그리스 문자, 암묵 곱)을 env 의 숫자로 계산한다."""
    s = tex.replace("\\left", "").replace("\\right", "").replace("\\cdot", "*").replace("\\tfrac", "\\frac").replace("\\dfrac", "\\frac").replace("\\,", " ")
    toks = re.findall(r"\\[A-Za-z]+|\d+\.?\d*|[A-Za-z]|[{}()^_+\-*/]", s)
    pos = [0]

    def peek():
        return toks[pos[0]] if pos[0] < len(toks) else None

    def eat():
        t = toks[pos[0]]
        pos[0] += 1
        return t

    def group():
        assert eat() == "{"
        v = expr()
        assert eat() == "}"
        return v

    def group_text():
        assert eat() == "{"
        out = ""
        while peek() != "}":
            out += eat()
        eat()
        return out

    def with_sub(base):
        if peek() == "_":
            eat()
            sub = group_text() if peek() == "{" else eat()
            return base + sub
        return base

    def atom():
        t = peek()
        if t == "{":
            return group()
        if t == "(":
            eat()
            v = expr()
            assert eat() == ")"
            return v
        t = eat()
        if t == "\\frac":
            a = group()
            b = group()
            return a / b
        if t == "\\sqrt":
            return math.sqrt(group())
        if t in ("\\sin", "\\cos", "\\tan"):
            return {"\\sin": math.sin, "\\cos": math.cos, "\\tan": math.tan}[t](atom())
        if t[0].isdigit():
            return float(t)
        if t == "\\pi":
            return math.pi
        if t.startswith("\\"):
            assert t[1:] in _GREEK, f"unknown tex token {t}"
            return float(env[with_sub(t[1:])])
        return float(env[with_sub(t)])

    def factor():
        v = atom()
        while peek() == "^":
            eat()
            e = group() if peek() == "{" else atom()
            v = v ** e
        return v

    def term():
        sign = 1
        while peek() in ("-", "+"):
            sign *= -1 if eat() == "-" else 1
        v = sign * factor()
        while True:
            t = peek()
            if t == "*":
                eat()
                v *= factor()
            elif t == "/":
                eat()
                v /= factor()
            elif t is not None and t not in ("+", "-", ")", "}"):
                v *= factor()
            else:
                return v

    def expr():
        v = term()
        while peek() in ("+", "-"):
            op = eat()
            r = term()
            v = v + r if op == "+" else v - r
        return v

    out = expr()
    assert pos[0] == len(toks), f"trailing tex tokens in {tex}"
    return out


def sym_opts(key_tex, key_val, wrongs, env, why_key=""):
    """기호식 선택지. key_val 은 sympy 풀이 + 수치 풀이로 얻은 정답의 수치(문항 env 에서). 정답 TeX 를 tex_eval 로 계산해 key_val 과 일치해야 하고,
    오답 TeX 는 서로(정답 포함) 8% 이상 다른 값이어야 한다. wrongs: [(오개념 설명, tex)]. 값 필드는 None(기호식)."""
    agree(tex_eval(key_tex, env), key_val, 1e-9, "sym_key")
    chosen = [key_val]
    ds, texts = [], {key_tex.lower()}
    for why, tx in wrongs:
        try:
            v = tex_eval(tx, env)
        except ValueError:  # 이 숫자에서는 식이 정의되지 않음(예: 음수의 제곱근) — 이 오답은 쓰지 않는다
            continue
        if not math.isfinite(v) or tx.lower() in texts or any(abs(v - c) <= MIN_REL_SEP * max(abs(c), abs(v)) for c in chosen):
            continue
        chosen.append(v)
        texts.add(tx.lower())
        ds.append(Opt("$" + tx + "$", False, why, None))
    if len(ds) < 3:
        raise ValueError("not_enough_separated_distractors")
    return Opt("$" + key_tex + "$", True, why_key, None), ds


def rank_opts(vals, labels, wrong_rules, tie_tol=MIN_REL_SEP):
    """순위 선택지. vals: {라벨: 값}, 값이 큰 것부터 나열한 순위가 정답. 정답 값은 서로 8% 이상 떨어져야 한다(동순위 없음).
    wrong_rules: [(오개념 설명, {라벨: 점수})], 점수 내림차순이 오답 순서. 정답과 같거나 이미 나온 순서이거나 점수가 동점인 규칙은 버린다."""
    order = sorted(labels, key=lambda L: -vals[L])
    for a, b in zip(order, order[1:]):
        if vals[a] - vals[b] <= tie_tol * abs(vals[a]):
            raise ValueError("tie_in_ranking")

    def fmt(o):
        return " > ".join(o)
    key = Opt(fmt(order), True, "", None)
    ds, seen = [], {fmt(order)}
    for why, sc in wrong_rules:
        o = sorted(labels, key=lambda L: -sc[L])
        if len({round(sc[L], 9) for L in labels}) < len(labels) or fmt(o) in seen:
            continue
        seen.add(fmt(o))
        ds.append(Opt(fmt(o), False, why, None))
    if len(ds) < 3:
        raise ValueError("not_enough_separated_distractors")
    return key, ds, order
