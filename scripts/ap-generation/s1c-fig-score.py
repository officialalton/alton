# S1c 그림·표 채점: 결함 유형별 탐지, 정상 대조군 오탐, 사전 차단(주입과 무관한 결정적 게이트) 분리.
import json,collections,sys
run=sys.argv[1] if len(sys.argv)>1 else 's1c-fig'; d=f'data/ap/sample-2027/{run}/'
t=json.load(open(d+'truth.json')); v={x['key']:x for x in json.load(open(d+'verdicts.json'))}; ck=json.load(open(d+'check.json'))
rows=[]
for k,tr in t.items():
    pre=bool(ck[k]['reasons']); x=v[k]; rs=x['reasons']
    paths=[]
    if any(r.startswith('solver_disagrees') for r in rs): paths.append('solver')
    if any(r.startswith('instant_reject') for r in rs): paths.append('instant_reject')
    if any(r.startswith('criterion_failed') for r in rs): paths.append('criterion')
    rows.append(dict(key=k,defect=tr['defect'],figure=tr['figure'],pre_blocked=pre,flagged=(not pre) and (not x['passed']),paths=paths,reasons=rs,relevant=tr.get('answerRelevantCell')))
D=[r for r in rows if r['defect']!='none']; G=[r for r in rows if r['defect']=='none']
print('사전 차단(주입 무관 결정적 게이트): 결함',sum(r['pre_blocked'] for r in D),'정상',sum(r['pre_blocked'] for r in G))
for dt in sorted({r['defect'] for r in D}):
    e=[r for r in D if r['defect']==dt and not r['pre_blocked']]; print(f"{dt}: 평가 {len(e)}, 탐지 {sum(r['flagged'] for r in e)}, 미탐지 {[r['key'] for r in e if not r['flagged']]}, 경로 {dict(collections.Counter(p for r in e for p in r['paths']))}")
for fg in ['table','graph']:
    e=[r for r in G if r['figure']==fg and not r['pre_blocked']]; print(f"정상 {fg}: 평가 {len(e)}, 오탐 {sum(r['flagged'] for r in e)}", [(r['key'],r['reasons'][:2]) for r in e if r['flagged']])
json.dump(rows,open(d+'score.json','w'),ensure_ascii=False,indent=1)
