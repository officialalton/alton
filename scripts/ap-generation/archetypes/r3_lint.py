"""R3 원형 TeX 위생 검사(무료): 학생에게 보이는 모든 문장(문항·선택지·why·FRQ 프롬프트·모범 답·루브릭)에서 $...$ 바깥에 수식 조각이 남았는지 찾는다.
사용: python r3_lint.py [원형이름 ...]  (이름 없으면 calc_r3_*.py 의 전부). 종료 코드 1 = 위반 있음."""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import registry as R  # noqa: E402

MATH = re.compile(r"""[=<>≤≥]|\^|\\[A-Za-z]+|\b[A-Za-z]\s*\(\s*[-\w.+*/ ]+\s*\)|[A-Za-z]'|\bsqrt\b|\bln\s*\(|\d[a-z]\b|\b\d+(?:\.\d+)?\s*[-+*/]\s*\d|\w/\w|_\{|\bd[xyt]\b|\bd/d""")


def outside(s):
    return re.sub(r"\$[^$]*\$", " ", s.replace("\\$", ""))


def hits(s):
    t = outside(str(s))
    return [m.group(0) for m in MATH.finditer(t)]


def strings_mc(p):
    yield "stem", p["stem"]
    for i, o in enumerate(p["options"]):
        yield f"opt{i}.text", o["text"]
        yield f"opt{i}.why", o.get("why") or ""
    st = p.get("stimulus") or {}
    yield "stimulus.description", st.get("description", "")


def strings_frq(p):
    yield "title", p.get("title", "")
    st = p.get("stimulus") or {}
    yield "stimulus.description", st.get("description", "")
    for q in p["parts"]:
        yield f"{q['label']}.prompt", q["prompt"]
        yield f"{q['label']}.model_answer", q["model_answer"]
        for r in q["rubric_rows"]:
            yield f"{q['label']}.{r['row_id']}.criterion", r["criterion"]
            for e in r["required_elements"]:
                yield f"{q['label']}.{r['row_id']}.elem", e


def main():
    names = sys.argv[1:] or sorted(n for m in R._R3 for n in dir(m) if n.startswith(("g_", "c_", "frq_")) and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__)
    bad = 0
    for n in names:
        packs = []
        for s0 in (0, 3000, 9000):
            try:
                packs += R.batch(n, 2, s0)
            except Exception:
                pass
        if not packs:
            print("NO_PACK", n)
            bad += 1
            continue
        seen = set()
        for p in packs:
            gen = strings_frq(p) if "parts" in p else strings_mc(p)
            for where, s in gen:
                h = hits(s)
                if h and (n, where) not in seen:
                    seen.add((n, where))
                    print(f"TEX {n} {where}: {h[:4]} :: {str(s)[:110]}")
                    bad += 1
    print("violations", bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
