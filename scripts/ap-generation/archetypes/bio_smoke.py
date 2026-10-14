"""AP Biology 원형 연기 점검(개발 보조): python bio_smoke.py [모듈…] — 각 원형을 시드 0~39 로 돌려 성공률·실패 사유·선택지 길이 단서·간격을 요약한다."""
import importlib
import random
import sys
import traceback
import re


def plain(t):
    return re.sub(r"[\\${}^]", "", re.sub(r"\\(mathrm|text)", " ", t)).strip()


def check_pack(p):
    probs = []
    opts = p.get("options") or []
    if opts:
        lens = [len(plain(o["text"])) for o in opts]
        mean = sum(lens) / len(lens)
        ki = p["key_index"]
        if lens[ki] == max(lens) and lens[ki] > mean * 1.6 and lens[ki] > 18:
            probs.append("key_much_longer")
        if min(lens) > 0 and max(lens) / min(lens) > 6 and max(lens) > 30:
            probs.append("options_not_parallel")
        if len(set(o["text"] for o in opts)) != 4:
            probs.append("dup_options")
        words = len(re.sub(r"\$[^$]*\$", " ", p["stem"]).split())
        if words > 100:
            probs.append("stem_too_long")
    return probs


def run(mods, seeds=int(__import__("os").environ.get("SEEDS", "120"))):
    bad = 0
    for m in mods:
        mod = importlib.import_module(m)
        names = [n for n in dir(mod) if n.startswith(("bi_", "bis_", "bif_")) and callable(getattr(mod, n)) and getattr(getattr(mod, n), "__module__", "") == mod.__name__]
        for n in sorted(names):
            fn = getattr(mod, n)
            ok, errs, probs = 0, {}, {}
            for s in range(seeds):
                try:
                    p = fn(random.Random(s))
                except Exception as e:  # noqa: BLE001
                    k = type(e).__name__ + ":" + str(e)[:60]
                    errs[k] = errs.get(k, 0) + 1
                    if "--tb" in sys.argv and type(e).__name__ not in ("ValueError",):
                        traceback.print_exc()
                    continue
                ok += 1
                for q in (p["items"] if "items" in p else [p]):
                    for pr in check_pack(q):
                        probs[pr] = probs.get(pr, 0) + 1
            flag = "" if ok >= seeds * 0.5 and not probs and not any(not k.startswith("ValueError") for k in errs) else "  <<<"
            if flag:
                bad += 1
            print(f"{n}: {ok}/{seeds} {dict(list(errs.items())[:2])} {probs}{flag}")
    print("flagged:", bad)


if __name__ == "__main__":
    mods = [a for a in sys.argv[1:] if not a.startswith("--")]
    run(mods)
