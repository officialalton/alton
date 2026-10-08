import json
rows=[(0,182,18,2.0),(5,164,36,3.2),(10,150,50,4.0),(20,168,32,3.6)]
mi=[m/(i+m)*100 for _,i,m,_ in rows]
ok_mi=mi==[9.0,18.0,25.0,16.0]
pct=(mi[2]-mi[0])/mi[0]*100
hrs=mi[2]/100*24
checks=[{"part":"a","pass":ok_mi and all(i+m==200 for _,i,m,_ in rows),"detail":str(mi)},
{"part":"b","pass":175<=pct<=180 and abs(hrs-6.0)<1e-9,"detail":f"{pct:.1f}% {hrs} h"},
{"part":"d","pass":mi[3]<mi[2] and (mi[2]-4.0)>(mi[3]+3.6),"detail":"20 uM below 10 uM, no overlap of 2SE bars"}]
print(json.dumps({"checks":checks,"conceptual_parts":["c"]}))