#!/usr/bin/env python3
"""Read-only scans of the generated SAT problem stock (data/mock-exam-generation, data/rw-generation) for the defect classes that the
2026-10-08 external audit found by solving the exams as a student. No DB, no network, no LLM.

  python3 scripts/audit/stock-defect-scans.py            # writes data/audit/2026-10-13-stock-defect-scans.json

Scans
  completion_duplicate : "Which choice completes the text..." items where words/punctuation after the blank repeat what the options
                         already contain (-> no grammatical completion), incl. literal ', ' right after a blank whose options end in ','
  question_in_stimulus : stimulus already contains the question text (shown twice to the student)
  vertical_line_encoded_flat : plane figure line labelled "x = c" stored with slope/intercept (drawn as a horizontal line)
  intersection_off_axes: two-line system figures whose intersection is outside the drawn axes
A hit is a candidate, not a verdict: only gids that were imported (acceptance/import-general, rw-stock, se-topup, rebalance gen) matter.
"""
import json, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'data')
OUT = os.path.join(DATA, 'audit', '2026-10-13-stock-defect-scans.json')
IMPORTED = ('acceptance/import-general', 'rw-stock-', 'se-topup', 'rebalance-20261008/gen/passed', 'rebalance-20261008/gen/merged', 'rebalance-20261008/gen/all.passed', 'adopted-', 'gapfill-20261006/items')


def load_problems():
    out = []
    def visit(x, path, gid):
        if isinstance(x, dict):
            g = x.get('gid') or gid
            if (isinstance(x.get('options'), list) or 'answers' in x or x.get('format') in ('spr', 'mc')) and any(k in x for k in ('passage', 'stimulus', 'question')):
                out.append((path, g, x)); return
            for v in x.values(): visit(v, path, g)
        elif isinstance(x, list):
            for v in x: visit(v, path, gid)
    for root in ('mock-exam-generation', 'rw-generation'):
        for dp, _dn, fn in os.walk(os.path.join(DATA, root)):
            for f in fn:
                if not f.endswith('.json'): continue
                p = os.path.join(dp, f)
                if os.path.getsize(p) > 40e6: continue
                try: d = json.load(open(p))
                except Exception: continue
                visit(d, os.path.relpath(p, DATA), None)
    return out


def words(s): return re.findall(r"[a-z0-9']+", s.lower())
def clean(o): return re.sub(r'\$|\\[a-z]+|\*\*', '', str(o))
def overlap(a, b, maxk=8):
    best = 0
    for k in range(1, min(maxk, len(a), len(b)) + 1):
        if a[-k:] == b[:k]: best = k
    return best
STOP = {'the', 'a', 'an', 'of', 'to', 'and', 'in', 'on', 'it', 'is', 'as', 'that', 'by', 'at', 'for', 'or'}


def lineparams(o):
    if 'through' in o:
        if not all(isinstance(z, list) and len(z) == 2 for z in o['through']): return None
        (a, b), (c, d) = o['through']
        if a == c: return None
        m = (d - b) / (c - a); return m, b - m * a
    if 'slope' in o: return o['slope'], o['intercept']
    return None


def main():
    probs = load_problems()
    res = {'completion_duplicate': {}, 'question_in_stimulus': {}, 'vertical_line_encoded_flat': {}, 'intersection_off_axes': {}}
    for path, g, x in probs:
        key = g or 'PATH:' + path
        imported = any(a in path for a in IMPORTED)
        ps = str(x.get('stimulus') or x.get('passage') or '')
        opts = x.get('options')
        parts = re.split(r'_{3,}', ps)
        if opts and len(parts) == 2:
            pre, post = parts; pw, bw = words(pre), words(post)
            hits = []
            for i, o in enumerate(opts):
                ow = words(clean(o))
                k = overlap(ow, bw); k2 = overlap(pw, ow)
                if k and not all(w in STOP for w in ow[-k:]): hits.append(i)
                elif k2 and not all(w in STOP for w in ow[:k2]): hits.append(i)
            lit = post.lstrip()[:1] in (',', ';', ':') and post.lstrip()[:1] != '' and sum(1 for o in opts if clean(o).rstrip().endswith(post.lstrip()[:1])) >= 2
            ci = x.get('correctIndex')
            if len(hits) >= 2 or (ci in hits) or lit:
                res['completion_duplicate'].setdefault(key, {'gid': g, 'files': [], 'key_option': opts[ci] if ci is not None else None, 'pre': pre[-40:], 'post': post[:40], 'literal_punct': bool(lit), 'imported': imported})['files'].append(path)
        q = re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', '', str(x.get('question') or '').lower())).strip()
        st = re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', '', str(x.get('stimulus') or '').lower())).strip()
        if len(q) >= 40 and st and q in st:
            res['question_in_stimulus'].setdefault(key, {'gid': g, 'file': path, 'question': str(x.get('question'))[:90], 'imported': imported})
        fig = x.get('figure')
        if isinstance(fig, dict) and fig.get('type') == 'plane':
            lines = [o for o in fig.get('objects', []) if o.get('kind') == 'line']
            for o in lines:
                if re.match(r'^\s*x\s*=', str(o.get('label') or '')) and ('slope' in o and 'intercept' in o) and o.get('slope') in (0, 0.0):
                    res['vertical_line_encoded_flat'].setdefault(key, {'gid': g, 'file': path, 'line': o, 'imported': imported})
            if len(lines) == 2 and re.search(r'solution|intersect|system', ps + str(x.get('question') or ''), re.I):
                a, b = lineparams(lines[0]), lineparams(lines[1])
                if a and b and abs(a[0] - b[0]) > 1e-9:
                    xi = (b[1] - a[1]) / (a[0] - b[0]); yi = a[0] * xi + a[1]; ax = fig['axes']
                    if not (ax['x']['min'] <= xi <= ax['x']['max'] and ax['y']['min'] <= yi <= ax['y']['max']):
                        res['intersection_off_axes'].setdefault(key, {'gid': g, 'file': path, 'intersection': [round(xi, 3), round(yi, 3)], 'axes': ax, 'imported': imported})
    summary = {k: {'candidates': len(v), 'imported': sum(1 for r in v.values() if r.get('imported'))} for k, v in res.items()}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({'kind': 'stock_defect_scans', 'note': 'candidates only; see docs/audit/2026-10-13-external-audit-triage.md', 'summary': summary, 'results': res}, open(OUT, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(summary, indent=1)); print('wrote', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
