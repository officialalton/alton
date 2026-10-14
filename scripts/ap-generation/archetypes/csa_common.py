"""AP Computer Science A 원형 공통 도구(2026-10-13, P0 무료 엔지니어링).
규칙(docs/ap/csa-groundwork.md):
- 정답은 javac/java 로 실제 컴파일·실행한 결과(csa_java.java_eval). 독립 경로: Python 참조 구현이 같은 값을 내야 하고, 다르면 ValueError(시드 폐기).
- 오답 선택지는 이름 붙은 오개념(off-by-one, 정수 나눗셈, 별칭, 단락 평가, String 불변 …)을 **코드 변형(mutant)으로 실제 실행**해서 얻은 값이다(손으로 쓴 값이 아님).
- 코드 자료는 stimulus {kind:"text", description:"```java … ```", data:{variant:"java_code"}} — 화면은 render-learning-content 의 코드 블록(줄 번호·고정폭, KaTeX 미적용)이 그린다.
- 코드·선택지 글에 `$`, 연속 밑줄(__), 백틱을 넣지 않는다(수식·밑줄 구문 충돌; test_csa_p0 가 검사).
- 수치 선택지 간격: 정수가 아닌 값은 상대 8% 이상. 정수는 정확 값이라 서로 다르기만 하면 되나 |값|>12 이면 8% 이상(csa_java.spaced_ok)."""
import re
from common import Opt, pack
from bp import mc_blueprint as _mcb
from phys_common import retry_sep, forever, agree  # noqa: F401
import csa_java as J

SUB = "ap_computer_science_a"


def mc_blueprint(arch, subject, topic, skill, calc, concept, thinking, *a, **k):
    """blueprint.ts 는 student_thinking 을 2개 이상의 사고 단계(각 15자 이상) 목록으로 요구한다 — 문자열 하나가 오면 두 단계로 만든다."""
    if isinstance(thinking, str):
        thinking = [thinking, "compare the result with each option and rule out the named misconceptions"]
    return _mcb(arch, subject, topic, skill, calc, concept, thinking, *a, **k)
FENCE = "```"


def code_stim(code, note=""):
    code = code.strip("\n")
    return {"kind": "text", "description": f"{FENCE}java\n{code}\n{FENCE}" + (f"\n{note}" if note else ""), "data": {"variant": "java_code", "language": "java"}}


def numbered(code):
    """줄 번호 참조 문항을 위한 점검용: 1부터 센 줄 목록."""
    return [(i + 1, ln) for i, ln in enumerate(code.strip("\n").split("\n"))]


def _is_num(t):
    return re.fullmatch(r"-?\d+(\.\d+)?", t) is not None


def opt_text(res):
    r = J.tidy(res)
    if r.startswith("EXC:") or "EXC:" in r:
        return "A run-time exception occurs."  # 예외 이름은 해설(why)에 둔다 — 짧게 써야 숫자 선택지와 길이가 어울린다(options_not_parallel)
    if r == "":
        return "Nothing is printed."
    return r if _is_num(r) else f"`{r}`"


def opt_value(res):
    r = J.tidy(res)
    return float(r) if _is_num(r) else None


def _rename(src, names, i):
    for n in names:
        src = re.sub(rf"\b{n}\b", f"{n}M{i}", src)
    return src


def mutate(shown, call, m, i):
    """변형 한 개를 만든다. m = {why, swap:(old,new)} 또는 {why, call:본문}. 반환 (classes 추가 소스, 본문)."""
    names = re.findall(r"\b(?:class|interface)\s+(\w+)", shown)
    if "call" in m:
        return "", m["call"]
    old, new = m["swap"]
    if old not in shown:
        raise ValueError(f"mutant_pattern_missing:{old[:30]}")
    mut = shown.replace(old, new, 1)
    if call is None:  # 문장 코드 모드
        return "", mut
    return _rename(mut, names, i), _rename(call, names, i)


def mk(rng, arch, topic, skill, stem, shown, *, muts, py, concept, path, kwhy, call=None, kind=None, stim_code=None, est=95, facts=None, thinking="trace the code or reason about its behavior without running it", extra_classes="", note="", allow_dup_why=False):
    """MC 한 문항 팩. call=None 이면 shown 이 곧 실행할 문장(출력 문항), call 이 있으면 shown 은 클래스 코드이고 call 본문을 실행한다.
    py: 독립 Python 참조가 계산한 정답 문자열(Java 출력 형식)."""
    kind = kind or ("out" if call is None else ("ret" if "return" in call else "out"))
    classes = (shown if call is not None else "") + "\n" + extra_classes
    bodies = [(kind, shown if call is None else call)]
    why = []
    for i, m in enumerate(muts, 1):
        extra, body = mutate(shown, call, m, i)
        classes += "\n" + extra
        bodies.append((kind, body)); why.append(m["why"])
    res = J.java_eval(classes, bodies)
    key_res = res[0]
    agree_str(J.tidy(key_res), py)
    kt = J.tidy(key_res)
    if not kwhy.rstrip().endswith("."):
        kwhy = kwhy.rstrip() + "."
    kwhy = kwhy + (f" Tracing the code gives {kt}." if kt and "EXC:" not in kt else "")
    keyo = Opt(opt_text(key_res), True, kwhy, opt_value(key_res))
    seen, ds = {opt_text(key_res)}, []
    seen_vals = {opt_value(key_res)} - {None}
    for r, w in zip(res[1:], why):
        t = opt_text(r)
        v = opt_value(r)
        if t in seen or (v is not None and v in seen_vals):
            continue  # 변형이 정답과 같은 결과(또는 같은 수치)를 내면 오답으로 쓸 수 없다
        if "EXC:" in J.tidy(r) and "exception" not in w.lower():
            w = w.rstrip(".") + ". Running this version throws a run-time exception."
        seen.add(t); ds.append(Opt(t, False, w, v))
        if v is not None:
            seen_vals.add(v)
    if len(ds) < 3:
        raise ValueError("not_enough_distinct_distractors")
    p = pack(arch, topic, skill, "not_allowed", stem, keyo, ds, rng, stimulus=(None if stim_code is False else code_stim(stim_code if stim_code is not None else shown, note)), est=est, facts=facts or [f"key={J.tidy(key_res)}"])
    vals = [o["value"] for o in p["options"]]
    if all(v is not None for v in vals) and not J.spaced_ok([float(v) for v in vals]):
        raise ValueError("not_enough_separated_distractors")
    shown_opts = [o for i, o in enumerate(p["options"]) if i != p["key_index"]]
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate(shown_opts)]
    p["blueprint"] = mc_blueprint(arch, SUB, topic, skill, "not_allowed", concept, thinking, [("the key is the output of compiling and running the code with the JDK", "javac and java run"), ("a second implementation in Python gives the same value", "python reference")], mis, path,
                                  material={"type": "code", "must_include": ["the code segment"]}, method="javac+java execution + python reference", extra={"judgment_demand": "trace the code and avoid the named misconception"})
    return p


def agree_str(a, b):
    if a != b:
        raise ValueError(f"independent_check_failed:{a}:{b}")


def mk_tests(rng, arch, topic, skill, stem, shown, options, tests, *, concept, path, kwhy_by_key, est=100, facts=None, note="", extra_classes="", hidden_pre="", stim=True, thinking="read the code and decide which candidate satisfies the specification for every input"):
    """코드 완성·버그 수정 문항: options = [(선택지 글, 코드 조각 또는 변형, why 또는 None(정답))]... 실제로는 조각마다 완성된 클래스를 만들어 tests 를 실행한다.
    options: list of dict(text, source(전체 클래스 소스: 선택지 조각을 끼운 것), why, key(bool)). tests: list of (호출 본문 'return f(3);', 기대값 문자열). 정답은 모든 테스트를 통과하는 하나뿐이어야 하고,
    오답은 이름 붙은 오개념으로 적어도 한 테스트에서 실패해야 한다(실행으로 확인)."""
    classes, bodies, owners = "", [], []
    for oi, o in enumerate(options):
        names = re.findall(r"\b(?:class|interface)\s+(\w+)", o["source"])
        classes += "\n" + _rename(o["source"], names, oi)
        for call, _exp in tests:
            bodies.append(("ret", _rename(call, names, oi))); owners.append(oi)
    res = J.java_eval(classes + "\n" + extra_classes, bodies)
    passed = [True] * len(options)
    fails = [[] for _ in options]
    for (oi, (call, exp)), r in zip(zip(owners, tests * len(options)), res):
        if J.tidy(r) != exp:
            passed[oi] = False; fails[oi].append((call, exp, J.tidy(r)))
    keys = [i for i, o in enumerate(options) if o["key"]]
    if len(keys) != 1 or not passed[keys[0]]:
        raise ValueError("key_does_not_pass_all_tests")
    if any(passed[i] for i, o in enumerate(options) if not o["key"]):
        raise ValueError("distractor_passes_all_tests")
    keyo = Opt(options[keys[0]]["text"], True, kwhy_by_key, None)
    ds = [Opt(o["text"], False, o["why"], None) for i, o in enumerate(options) if not o["key"]]
    p = pack(arch, topic, skill, "not_allowed", stem, keyo, ds, rng, stimulus=(code_stim(shown, note) if stim else None), est=est, facts=facts or [f"tests={len(tests)}", f"failing={[len(f) for f in fails]}"])
    shown_opts = [o for i, o in enumerate(p["options"]) if i != p["key_index"]]
    mis = [(f"m{i + 1}", o["why"]) for i, o in enumerate(shown_opts)]
    p["blueprint"] = mc_blueprint(arch, SUB, topic, skill, "not_allowed", concept, thinking, [("the key passes every test case when compiled and run", "javac and java run"), ("each distractor fails at least one test case", "java test run")], mis, path,
                                  material={"type": "code", "must_include": ["the code segment"]}, method="javac+java unit tests + python reference tests", extra={"judgment_demand": "test candidates against boundary cases"})
    p["test_cases"] = [{"call": c, "expected": e} for c, e in tests]
    return p


def set_pack(arch, intro, shown, items, topic, skill):
    return {"archetype": arch, "topic": topic, "skill": skill, "calculator": "not_allowed", "set_intro": intro, "stimulus": code_stim(shown), "items": items, "facts": items[0]["facts"], "blueprint": items[0]["blueprint"]}
