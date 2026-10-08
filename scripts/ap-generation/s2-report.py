# S2 보고: 표본 그룹(무작위 / 복구된 오탐 의심 / 교정 후에도 규칙 탈락)별·과목별·구조별 통과율과 전수 비용 추정.
import json,collections,glob
root='data/ap/sample-2027/'
rows=[]
for d,sub in [('s2-ab','ap_calculus_ab'),('s2-bio','ap_biology'),('s2-micro','ap_microeconomics')]:
    v={x['key']:x for x in json.load(open(root+d+'/verdicts.json'))}; t=json.load(open(root+d+'/truth.json')); cells={c['cellId']:c for c in json.load(open(root+d+'/cells.json'))}
    cost=collections.defaultdict(float)
    for f in ['solve','review','review2','difficulty']:
        for ln in open(root+d+f'/../{d}/{f}.results.jsonl') if False else []: pass
    for f in ['solve','review','review2','difficulty']:
        try:
            for ln in open(root+d+'/'+f+'.results.jsonl'):
                r=json.loads(ln); cost[r['custom_id'][2:]]+=r.get('cost',0)
        except FileNotFoundError: pass
    for k,x in v.items():
        rows.append(dict(sub=sub,run=d,key=k,group=t[k]['group'],stratum=t[k]['stratum'],kind=cells[x['cellId']]['kind'],passed_strict=x['passed'] and not x.get('soft'),passed_soft=x['passed'],cost=cost[k],reasons=x['reasons'],soft=x.get('soft')))
def rate(rs,f): return f"{sum(1 for r in rs if r[f])}/{len(rs)}"
print('전체',len(rows),'strict',rate(rows,'passed_strict'),'soft',rate(rows,'passed_soft'),'비용 $%.3f'%sum(r['cost'] for r in rows))
for g in ['random','recovered_fp','rule_fail']:
    rs=[r for r in rows if r['group']==g]; print(g,len(rs),'strict',rate(rs,'passed_strict'),'soft',rate(rs,'passed_soft'))
    by=collections.defaultdict(list)
    for r in rs: by[(r['sub'],r['kind'])].append(r)
    for k,l in sorted(by.items()): print('   ',k,len(l),'strict',rate(l,'passed_strict'),'soft',rate(l,'passed_soft'))
print('실패 사유(비통과)',collections.Counter(x.split(':')[0] for r in rows if not r['passed_soft'] for x in r['reasons']).most_common(10))
mc=[r for r in rows if r['kind']=='mc']; fr=[r for r in rows if r['kind']!='mc']
print('평균 항목당 비용 MC %.4f FRQ %.4f'%(sum(r['cost'] for r in mc)/len(mc),sum(r['cost'] for r in fr)/len(fr)))
json.dump(rows,open(root+'s2-report.json','w'),ensure_ascii=False,indent=1)
