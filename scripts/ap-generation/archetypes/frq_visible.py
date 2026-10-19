"""FRQ·MC 원형이 학생에게 반드시 보여야 하는 정보(실험 소개·조건·비용 같은 주어진 값)를 학생 화면에 싣는 공용 보조(2026-10-19, 외부 AP 검수 2026-10-15 유형 단위 수정).

배경: 표·도식 자료의 `stimulus.description` 은 그림 스펙(ap_table)에 실리지 않아 학생 화면에 나오지 않는다(lib/ap-exam/convert.ts frqLostSetup 이 일부 경우에만 구제).
원형이 실험 소개나 "한계비용은 $26" 같은 주어진 값을 description 에만 두면 학생은 본문 없이 푼다(Micro 2 MC56, Biology 2 FRQ2 의 잘린 소개).
또 제목을 `intro[:40]` 처럼 글자 수로 자르면 문장이 중간에서 끊긴다. 이 모듈은 (1) 제목을 완전한 문장으로 만드는 함수, (2) 학생이 보는 글만 모아 description 의 정보가 거기에 있는지 검사하는 함수를 준다.
"""
import re

_NUM = re.compile(r"(?<![\d.])\d+(?:\.\d+)?(?![\d])")
_TERMINAL = re.compile(r"[.?!)\"'”]$")


def setup_title(intro: str) -> str:
    """제목 = 실험 소개 전체(글자 수로 자르지 않는다). 끝의 마침표·세미콜론만 뗀다(변환기가 '— answer every part.' 를 뒤에 붙인다)."""
    t = " ".join(str(intro).split()).rstrip(" .;")
    if not t:
        raise ValueError("empty_setup_title")
    return t


def _strs(v):
    if isinstance(v, str):
        return [v]
    if isinstance(v, bool):
        return []
    if isinstance(v, (int, float)):
        return [str(v)]
    if isinstance(v, (list, tuple)):
        return [x for y in v for x in _strs(y)]
    if isinstance(v, dict):
        return [x for y in v.values() for x in _strs(y)]
    return []


def _opt_text(o):
    return o if isinstance(o, str) else (o or {}).get("text", "")


def _norm(s):
    return re.sub(r"[$\\,]", "", s)


def student_text(p):
    """학생이 보는 글: 제목·세트 소개·문항 본문·보기·FRQ 파트 문장·표/그림 자료 값. description 과 해설(why·model_answer)은 넣지 않는다."""
    items = p["items"] if isinstance(p.get("items"), list) else [p]
    t = [str(p.get("title", "")), str(p.get("set_intro", ""))]
    for it in items:
        t.append(str(it.get("stem", "")))
        t += [_opt_text(o) for o in (it.get("options") or [])]
    for x in p.get("parts") or []:
        t.append(str(x.get("prompt", "")))
    st = p.get("stimulus")
    if isinstance(st, dict) and st.get("kind") not in (None, "none"):
        t += _strs(st.get("data"))
    return _norm("\n".join(t))


def _numset(text):
    out = set()
    for n in _NUM.findall(text):
        try:
            out.add(float(n))
        except ValueError:
            pass
    return out


def hidden_setup(p, kind):
    """description 에만 있고 학생 화면에 없는 정보. 반환: 빈 목록이면 결함 없음.
    - 설명의 수치가 학생 글(제목·본문·보기·파트·표·그림 자료 값)에 없으면 그 수치(12 와 12.00 은 같은 값으로 본다),
    - 표 자료 FRQ 이고 설명이 두 문장 이상(실험 소개·조건 서술)인데 어느 문장도 학생 글에 없으면 그 문장.
    그래프(좌표 나열 대체 글)·본문 자료·이미지 자료의 description 은 그림 자체가 보여 주는 대체 글이라 검사하지 않는다."""
    st = p.get("stimulus")
    if not isinstance(st, dict) or st.get("kind") in (None, "none", "text", "graph", "image"):
        return []
    d = str(st.get("description") or "").strip()
    if not d or re.match(r"(?i)no (stimulus|figure)", d):
        return []
    stu = student_text(p)
    nd = _norm(d)
    if nd in stu:
        return []
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", d) if s.strip()]
    if kind == "mc" and len(sentences) < 2:
        return []  # MC 의 한 줄 그림 캡션은 풀이에 필요하지 않다
    have = _numset(stu)
    out = [f"number:{n}" for n in dict.fromkeys(_NUM.findall(nd)) if float(n) not in have]
    if kind != "mc" and st.get("kind") == "table" and len(sentences) >= 2:
        for s in sentences:
            if len(s.split()) >= 8 and _norm(s).rstrip(".") not in stu:
                out.append(f"sentence:{s[:60]}")
    return out


def title_truncated(p):
    """제목이 글 중간에서 끊겼는가: 마침표류로 끝나지 않고, 앞의 '분류: ' 를 뗀 본문이 설명·파트 문장의 앞부분과 같다."""
    t = str(p.get("title", ""))
    if not t or _TERMINAL.search(t):
        return False
    body = re.sub(r"^[^:]{0,70}: ", "", t)
    if len(body) < 35:
        return False
    st = p.get("stimulus")
    d = str(st.get("description", "")) if isinstance(st, dict) else ""
    cands = [d] + [str(x.get("prompt", "")) for x in p.get("parts") or []]
    # 같은 문장이 계속되는데(다음 글자가 마침표·세미콜론이 아님) 제목이 거기서 멈췄으면 잘린 것이다. 완전한 소개를 마침표 없이 제목으로 쓴 경우는 다음 글자가 '.' 라서 통과한다.
    return any(c.startswith(body) and len(c) > len(body) and c[len(body)] not in ".;!?:," for c in cands)


def ensure_setup_visible(p):
    """서술형(FRQ) 팩의 안전망: 표·도식·통계 그림의 description(실험 소개·주어진 조건)이 학생 글에 없으면 제목을 그 설명 전체(완전한 문장)로 바꾼다.
    description 은 그림 스펙에 실리지 않아 학생에게 안 보인다. 제목은 항상 보이므로 풀이에 필요한 값(가격·온도·표본 크기)을 거기에 둔다. 이미 보이면 아무것도 바꾸지 않는다(멱등).
    객관식 팩은 건드리지 않는다(원형이 stem 에 직접 써야 한다 — micro_common·macro_common 의 mk 가 hidden_setup 으로 막는다)."""
    if not p.get("parts"):
        return p
    if not hidden_setup(p, "frq"):
        return p
    p["title"] = setup_title(p["stimulus"]["description"])
    left = hidden_setup(p, "frq")
    if left:
        raise ValueError("setup_still_hidden:" + ",".join(left))
    return p
