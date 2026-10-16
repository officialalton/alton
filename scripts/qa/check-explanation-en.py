#!/usr/bin/env python3
"""번역된 영어 해설(data/explanation-en/results/*.json) 검사. 통과분만 data/explanation-en/approved.json 에 모은다. DB 접근 없음."""
import json,re,glob,sys,os,collections
root="data/explanation-en"
han=re.compile(r"[가-힣]")
math=re.compile(r"\$\$.+?\$\$|\$[^$\n]+?\$",re.S)
num=re.compile(r"\d+(?:\.\d+)?")
tasks={};
for f in glob.glob(f"{root}/tasks/*.task.json"):
    t=json.load(open(f));tasks[t['id']]={i['versionId']:i for i in t['items']}
approved={};flags=collections.defaultdict(list);missing=[];seen=set()
for tid,items in sorted(tasks.items()):
    rf=f"{root}/results/{tid}.result.json"
    if not os.path.exists(rf):missing.append(tid);continue
    try:r=json.load(open(rf))
    except Exception as e:flags['bad_json'].append((tid,str(e)[:60]));continue
    got={x.get('versionId'):(x.get('explanationEn') or '').strip() for x in r.get('results',[])}
    for vid,it in items.items():
        en=got.get(vid)
        if not en:flags['missing_item'].append(vid);continue
        ko=it['explanationKo']
        if han.search(en):flags['hangul_left'].append(vid);continue
        ko_math=[m.strip() for m in math.findall(ko)]
        lost=[m for m in ko_math if m not in en and m.replace(' ','') not in en.replace(' ','')]
        if lost:flags['math_changed'].append((vid,lost[:2]));continue
        ko_nums=collections.Counter(num.findall(math.sub(' ',ko)))
        en_nums=collections.Counter(num.findall(math.sub(' ',en)))
        absent=[n for n in ko_nums if n not in en_nums]
        if absent and len(absent)>1:flags['numbers_missing'].append((vid,absent[:4]));continue
        if len(en)<20:flags['too_short'].append(vid);continue
        if vid in seen:continue
        seen.add(vid);approved[vid]=en
json.dump(approved,open(f"{root}/approved.json","w"),ensure_ascii=False)
print("통과",len(approved),"| 결과 파일 없음",missing)
for k,v in flags.items():print(k,len(v),v[:2])
