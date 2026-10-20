"""로컬 점검(무료): python _try.py <모듈이름> [시드 수] [--show] — 모듈의 mi_/mif_ 원형을 시드별로 만들어 예외·옵션 수를 본다."""
import sys, json, importlib
import registry as R
mod = importlib.import_module(sys.argv[1])
n = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 6
show = "--show" in sys.argv
names = [x for x in dir(mod) if (x.startswith(("mi_", "mif_", "ma_", "maf_", "st_", "cs_", "ca_")) and callable(getattr(mod, x)) and getattr(getattr(mod, x), "__module__", "") == mod.__name__)]
only = [a for a in sys.argv[3:] if not a.startswith("--")]
for nm in names:
    if only and nm not in only:
        continue
    ok, bad = 0, {}
    first = None
    for s in range(n):
        try:
            p = R.batch(nm, 1, 1000 + s)
            if p:
                ok += 1
                first = first or p[0]
        except Exception as e:  # noqa: BLE001
            bad[str(e)[:80]] = bad.get(str(e)[:80], 0) + 1
    print(f"{nm}: ok {ok}/{n}", bad if bad else "")
    if show and first:
        print(json.dumps({k: first[k] for k in ("stem", "options", "key_index") if k in first}, indent=1)[:1800])
