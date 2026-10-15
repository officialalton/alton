"""AP Psychology 원형 공통 도구(2026-10-14, 무료 엔지니어링; macro_common.py 와 같은 규약).
Macro 와 다른 점: 개념 문항은 코드로 정답을 계산할 수 없다. 문항(질문·정답 문장·오답 문장·오답별 오개념)은 CED(Fall 2025, 5단원) 필수 내용(EK)에서 사람이 직접 쓴 '고정 문장 변형'이고,
정답 보증은 (1) 결정적 게이트 (2) 키를 숨긴 독립 풀이(Opus) (3) 5기준 검토(Sonnet) (4) 두 번째 독립 모델 패널(Fable+Sonnet 맹검 풀이)이다. 연구 방법·기술통계 문항(`ps_stat_*`)은 코드가 정답을 계산하고 독립 경로(statistics 모듈 vs numpy)로 다시 계산한다.
규칙(docs/ap/psychology-groundwork.md):
- 4지선다(A–D). 오답은 이름 붙은 오개념(why ≥25자, 서로 다름)을 가진다. 해설에서 선택지를 문자로 가리키지 않는다.
- 원본 시나리오만(공개 시험 문항·지문 복제 금지). 실존 연구는 이름 붙인 고전 결과를 한 줄로 언급할 때도 단정이 아닌 '연구자들이 보고했다' 수준이며, 논쟁·재현 실패 연구(Milgram·Zimbardo 식 주장, 에고 고갈, 파워 포즈, 학습 양식 등)는 쓰지 않는다.
- 이 과목에는 계산기·참조 시트가 없다(calculator='na')."""
import hashlib  # noqa: F401
import math  # noqa: F401
import random  # noqa: F401
import re
import numpy as np  # noqa: F401
from common import Opt, pack, table_stimulus  # noqa: F401
from bp import mc_blueprint, frq_blueprint  # noqa: F401
from calc_ab_frq import row, part  # noqa: F401

SUB = "ap_psychology"
MAT_NONE = {"type": "none", "must_include": []}
MAT_TABLE = lambda *inc: {"type": "table", "must_include": list(inc)}  # noqa: E731
MAT_CHART = lambda *inc: {"type": "graph", "must_include": list(inc)}  # noqa: E731
MIN_WHY = 25

PATH_CONCEPT = ("authored from the CED required content (essential knowledge {ek}); the key is NOT code-verified: it must be matched by an independent blind solver (Opus), the five-criterion reviewer (Sonnet) "
                "and a second independent model panel (Fable and Sonnet blind solves) before the item is used")
PATH_STATS = "every number and the key are computed by code from the data shown (statistics module) and recomputed with numpy; wrong options are the standard slips (mean for median, forgetting to sort, range for spread)"


def _bp(arch, topic, skill, concept, ek, mis, material, thinking=None, cond=None, path=None, method="authored+blind-solver+panel"):
    return mc_blueprint(arch, SUB, topic, skill, "na", concept,
                        thinking or [f"Identify what the scenario or question is asking about: {concept}", "Match the defining feature in the stem against each option and reject the near-miss concepts"],
                        cond or [("the stem contains the defining feature of exactly one option", "stem wording")], mis, path or PATH_CONCEPT.format(ek=ek), material=material, method=method,
                        extra={"judgment_demand": ["apply the concept to the scenario"]})


def mk(arch, topic, skill, stem, key_text, key_why, wrongs, rng, *, concept, ek=None, stim=None, est=60, facts=None, material=None, path=None, method="authored+blind-solver+panel", thinking=None, cond=None):
    """한 문항 팩(4지선다). wrongs = [(오답 문장, 오개념 설명) x 3]. 오답 설명은 서로 다르고 25자 이상이어야 한다."""
    if len(wrongs) != 3:
        raise ValueError("need_three_wrongs")
    if len((key_why or "").strip()) < 20:
        raise ValueError("empty_key_why")
    key = Opt(key_text, True, key_why, None)
    ds = [Opt(t, False, w, None) for t, w in wrongs]
    # 같은 시드가 모든 원형에서 같은 선택지 순서(= 같은 정답 위치)를 만들지 않게, 원형 id 를 섞은 결정적 난수로 선택지를 섞는다.
    rng = random.Random(int(hashlib.sha1(f"{arch}:{rng.random()}".encode()).hexdigest()[:12], 16))
    p = pack(arch, topic, skill, "na", stem, key, ds, rng, stimulus=stim, est=max(45, min(130, est)), facts=facts or [f"ek={ek or topic}"], n_total=4)
    shown = [o for i, o in enumerate(p["options"]) if i != p["key_index"]]
    seen = set()
    for o in shown:
        w = (o["why"] or "").strip()
        if len(w) < MIN_WHY:
            raise ValueError("short_why")
        if w in seen:
            raise ValueError("duplicate_why")
        seen.add(w)
    p["variant_id"] = hashlib.sha1(f"{stem}|{key_text}".encode()).hexdigest()[:12]  # 같은 변형이 선택지 순서만 달라져 후보로 두 번 뽑히지 않게(registry.batch 가 사용)
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate(shown)]
    mat = material or (MAT_TABLE() if stim and stim["kind"] == "table" else MAT_CHART() if stim and stim["kind"] in ("stat_chart", "graph") else MAT_NONE)
    p["blueprint"] = _bp(arch, topic, skill, concept, ek or topic, mis, mat, thinking=thinking, cond=cond, path=path, method=method)
    return p


def _fixed(arch, topic, skill, concept, variants, ek=None, est=60, stim=None):
    """고정 문장 원형: 변형 2개 이상, 변형마다 (질문, 정답 문장, 정답 설명, [(오답 문장, 오개념 설명) x 3]). 두 시험에는 서로 다른 변형을 쓴다."""
    def fn(rng):
        v = variants[rng.randrange(len(variants))]
        q, kt, kw, wr = v[:4]
        return mk(arch, topic, skill, q, kt, kw, wr, rng, concept=concept, ek=ek, est=est, stim=(v[4] if len(v) > 4 else stim))
    fn.__name__ = arch
    return fn


def register(g, items):
    """모듈 전역에 ps_<id> 함수를 등록한다(registry.py 가 모듈의 ps_ 접두 함수를 자동 수집)."""
    names = []
    for (arch, topic, skill, concept, ek, variants) in items:
        fn = _fixed("ps_" + arch, topic, skill, concept, variants, ek=ek)
        fn.__module__ = g["__name__"]
        g["ps_" + arch] = fn
        names.append("ps_" + arch)
    return names


# ---------------- 자료 세트(문항 3개, 같은 단원) ----------------
def set_pack(arch, topic, skill, intro, stim, specs, rng, *, concept, ek=None):
    """specs = [(topic, skill, stem, key, key_why, wrongs, est)] x 3. 세트의 세 문항은 같은 단원이어야 한다(게이트 gateStatsSet)."""
    if len(specs) != 3:
        raise ValueError("set_size")
    items = []
    for j, (t, s, stem, key, kwhy, wrongs, est) in enumerate(specs):
        it = mk(f"{arch}_q{j + 1}", t, s, stem, key, kwhy, wrongs, rng, concept=concept, ek=ek or t, est=est)
        it["archetype"] = f"{arch}_q{j + 1}"
        items.append(it)
    return {"archetype": arch, "topic": topic, "skill": skill, "calculator": "na", "set_intro": intro, "stimulus": stim, "variant_id": hashlib.sha1(intro.encode()).hexdigest()[:12], "items": items, "facts": items[0]["facts"], "blueprint": items[0]["blueprint"]}


def register_sets(g, sets):
    names = []
    for (arch, topic, skill, concept, ek, intro, stim, specs) in sets:
        def make(arch=arch, topic=topic, skill=skill, concept=concept, ek=ek, intro=intro, stim=stim, specs=specs):
            def fn(rng):
                return set_pack("pss_" + arch, topic, skill, intro, stim, specs, rng, concept=concept, ek=ek)
            fn.__name__ = "pss_" + arch
            return fn
        fn = make()
        fn.__module__ = g["__name__"]
        g["pss_" + arch] = fn
        names.append("pss_" + arch)
    return names


TXT = {"kind": "text", "description": "Study description (no table or figure accompanies it)", "data": {}}  # 표·그래프가 없는 세트의 공유 자료(지문만)


def tbl(desc, cols, rows, notes=None):
    return {"kind": "table", "description": desc, "data": {"columns": cols, "rows": [[str(c) for c in r] for r in rows], **({"notes": notes} if notes else {})}}


def chart(desc, kind, **data):
    """통계 차트 어댑터(`ap_stat_chart:<kind>`): bar(categories, series[{name, values}], xTitle, yTitle) · histogram(bins) · scatter(points, xTitle, yTitle) · dot_plot(dots, xTitle)."""
    return {"kind": "stat_chart", "description": desc, "data": {"chart": kind, "data": data}}


# ---------------- FRQ 도우미 ----------------
REF = "ALTON reference answer for self-review — not official AP scoring. "


def fr(rid, pts, crit, el, alt, err, requires=None, both=False, note=None, nums=False):
    r = row(rid, pts, crit, el, alt=list(alt), err=err, requires=requires, both=both, nums=nums)
    generic = "a correct equivalent statement in the student's own words"
    while len(r["alt_solutions"]) < 2:
        r["alt_solutions"].append(generic if generic not in r["alt_solutions"] else generic + " (accepted without a specific phrase)")
    r["meaning_based"] = True
    r["uses_concept"] = False
    r["single_explanation"] = False
    r["grading_note"] = note or "Award the point when the response conveys the required meaning, whatever the wording; do not require any specific phrase."
    return r


def prt(label, prompt, pts, mode, skills, answer, rows, topics):
    p = part(label, prompt, pts, mode, skills, REF + answer, rows)
    p["topic_codes"] = topics
    return p


def finish_frq(pk, concept, thinking, cond, material, path):
    pk["blueprint"] = frq_blueprint(pk["archetype"], SUB, pk, concept, thinking, cond, material, path, method="authored+blind-solver+panel", extra={"judgment_demand": ["identify research elements, interpret statistics and ethics, argue from evidence"]})
    return pk


def agree(a, b, tol=1e-9, what=""):
    if abs(float(a) - float(b)) > tol:
        raise ValueError(f"paths_disagree:{what}")
