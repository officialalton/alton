# US History 실제 자료 샘플 문항 빌더(2026-10-15): 레지스트리 자료를 먼저 고정하고, 그 자료에서 스킬·정답 근거·오답 근거를 설계한 문항을 만든다.
#   python3 scripts/ap-generation/ush-real-sample-build.py  → data/ap/ush-sources/sample-items.json
import json, sys
reg = {s["id"]: s for s in json.load(open("data/ap/ush-sources/registry.json"))["sources"]}
MARK = "Historical source (real document)"
def credit(s):
    return f'{s["author"]}, {s["year"]}. {s["repository"]}. Reuse: {s["reuse_basis"]}. {("Excerpt: " + s["modified"]) if s["type"] in ("primary_text",) else s["modified"]}.'
def text_intro(sid, kind="primary source"):
    s = reg[sid]; body = " [...] ".join(s["excerpt_segments"])
    return f'{MARK}\n({kind})\n{s["title"]}\n{credit(s)}\n\n"{body}"'
def opt(text, why, label): return {"text": text, "why": why, "value": None, "label": label}
def item(skill, topic, stem, options, key, facts, evidence, tag):
    opts = [dict(o) for o in options]
    ex = [f'The correct answer is "{opts[key]["text"]}". {opts[key]["why"]}'] + [f'"{o["text"]}" is incorrect: {o["why"]}' for i, o in enumerate(opts) if i != key]
    opts[key]["label"] = "key"
    return {"archetype": f"ush_real_{tag}", "topic": topic, "skill": skill, "stem": stem, "options": opts, "key_index": key, "explanation_en": "\n".join(ex), "est_seconds": 75, "facts": facts,
            "design": {"source_fixed_first": True, "skill": skill, "key_evidence_in_source": evidence}}
def mc(cell, theme, title, period, topic, skill, sources, items, stim_type, set_intro, stimulus=None):
    p = {"archetype": f"ush_real_{cell}", "topic": topic, "skill": skill, "calculator": "na", "set_intro": set_intro, **({"stimulus": stimulus} if stimulus else {}),
         "ush_set": {"period": period, "stim_type": stim_type, "theme": theme, "title": title, "sources": [{"id": "A", "kind": k, "title": reg[i]["title"], "attribution": credit(reg[i]), "real_data": True, "source_registry_id": i, "source_sha256": reg[i]["sha256"]} for i, k in sources]},
         "items": items, "excluded_items": []}
    return {"cellId": f"ap_us_history-{cell}", "apSubjectCode": "ap_us_history", "kind": "mc", "calculator": "na", "reserve": False, "wording": "authored_from_real_source", "candidateKey": f"ap_us_history-{cell}-k0",
            "keywordCode": topic, "unitCode": str(period), "skillPrimary": skill, "structure": "shared_stimulus_set", "archetype": f"ush_real_{cell}", "reviewState": "sample_unverified", "rejectionReason": None,
            "difficultyProvisional": "exam_prep", "difficulty": [{"label": "basic_learning" if it["skill"].endswith(".A") else "exam_prep"} for it in items], "run": "ush-real-1", "stockKey": f"ush-real-1:ap_us_history-{cell}-k0",
            "stimulusOrigin": "real_historical_source", "sourceRegistryIds": [i for i, _ in sources], "payload": p}
O = opt
# ── R1: primary text — The Jungle (1906) ─────────────────────────────────────────────
r1 = mc("real_r1", "Meat inspection in Progressive Era Chicago", "The Government Inspector in the Packinghouse", 7, "7.4", "3.A", [("txt-jungle-1906", "primary_text")], [
 item("3.A", "7.4", "Which of the following claims about meatpacking is most directly made in the excerpt?",
  [O("Government inspectors had forced the packers to adopt costly new safety methods in every plant.", "The excerpt describes an inspector who lets a dozen carcasses pass untouched while he talks; it shows no safety changes forced on the packers.", "reversal"),
   O("Federal inspection gave an appearance of safety while few carcasses were closely checked.", "The inspector feels the glands of one hog at a time while 'a dozen carcasses were passing him untouched,' yet his uniform lends 'the stamp of official approval' to the plant.", "key"),
   O("Tuberculosis had become so rare in hogs that inspection was no longer necessary.", "The inspector himself explains 'the deadly nature of the ptomaines which are found in tubercular pork,' so the excerpt treats the disease as a real danger.", "unsupported_by_source"),
   O("Inspectors worked so many hours that they were exhausted and could not do their jobs.", "The excerpt says the inspector 'did not have the manner of a man who was worked to death,' which is the opposite of overwork.", "reversal")],
  1, ["Upton Sinclair's The Jungle (1906) is a novel based on his reporting in Chicago's packinghouses.", "The excerpt shows a government inspector who checks few carcasses."],
  "'a dozen carcasses were passing him untouched' and 'put the stamp of official approval upon the things which were done in Durham's'", "3A"),
 item("2.B", "7.4", "Sinclair's description of the inspector is best understood as an effort to",
  [O("show that state governments handled meat inspection better than the federal government did.", "The excerpt names a 'government inspector' without contrasting state and federal work, and gives no evidence about state inspectors.", "unsupported_by_source"),
   O("praise the efficiency of large packinghouses as a model for other American industries.", "The description mocks the inspector's casual manner and the false 'authority' of his uniform, so it is critical rather than admiring.", "reversal"),
   O("argue that consumers, not government, should bear the responsibility for judging whether meat is safe.", "The excerpt faults an official for not doing his job; it does not suggest that shoppers should inspect meat themselves.", "misattributed"),
   O("criticize the packing industry and the weakness of the oversight that was supposed to check it.", "A novelist who shows an inspector letting carcasses pass while lending official approval is exposing both the packers and the weak public oversight of them.", "key")],
  3, ["The Jungle was written to expose conditions in the meatpacking industry and the treatment of its immigrant workers.", "Muckraking journalists and novelists criticized business practices in the Progressive Era."],
  "inspector 'gave an atmosphere of authority to the scene' while a dozen carcasses 'passed him untouched'", "2B"),
 item("4.A", "7.4", "Public reaction to accounts like the excerpt contributed most directly to which of the following developments in 1906?",
  [O("Congress passed the Meat Inspection Act and Pure Food and Drug Act to expand federal oversight.", "Both laws were signed on June 30, 1906, after the outcry over packinghouse conditions that followed The Jungle and the federal investigation it prompted.", "key"),
   O("Congress passed the Sherman Antitrust Act to break up the trusts that controlled key industries.", "The Sherman Antitrust Act dates from 1890, sixteen years earlier, and concerned monopolies rather than food safety.", "wrong_period"),
   O("Congress created the Federal Reserve System to make the banking system more stable.", "The Federal Reserve Act was passed in 1913 and addressed banking, not the safety of food.", "unrelated_development"),
   O("Congress passed the Interstate Commerce Act to regulate the rates charged by railroads.", "The Interstate Commerce Act dates from 1887 and concerned railroad rates, not meatpacking.", "wrong_period")],
  0, ["The Meat Inspection Act and the Pure Food and Drug Act were both signed on June 30, 1906.", "The Sherman Antitrust Act (1890), Interstate Commerce Act (1887) and Federal Reserve Act (1913) are different laws."],
  "(outside knowledge; the excerpt shows the weakness of inspection that the 1906 laws addressed)", "4A")],
 "primary_text", text_intro("txt-jungle-1906"))
# ── R2: table — region of birth (Census Bureau) ───────────────────────────────────────
st = reg["stat-foreign-born-region-1900-1990"]
r2intro = f'{MARK}\n(table)\n{st["title"]}\n{credit(st)} Census Bureau, Working Paper No. 81, Table 2 (selected years; sample data for 1960-1990). Counts are residents at each census, not annual arrivals.\n\nThe table for this source appears below.'
r2stim = {"kind": "table", "description": "Foreign-born residents of the United States by region of birth in selected census years, 1900 to 1990.", "data": {"columns": st["table"]["columns"], "rows": st["table"]["rows"]}}
r2 = mc("real_r2", "Changing origins of the foreign-born population", "Where the Foreign-Born Were Born, 1900-1990", 8, "8.14", "1.A", [("stat-foreign-born-region-1900-1990", "table")], [
 item("1.A", "8.14", "Which of the following trends is shown in the table for the period from 1960 to 1990?",
  [O("Residents born in Northern America became the largest group of the foreign-born population by 1990.", "Northern America-born residents fell from 952,500 in 1960 to 753,917 in 1990, far below the Asian and Latin American totals.", "reversal"),
   O("The total foreign-born population fell at every census year shown after 1960.", "The total dropped slightly in 1970 (9,738,091 to 9,619,302) but rose to 14,079,906 in 1980 and 19,767,316 in 1990.", "overstated"),
   O("The number born in Asia and in Latin America rose while the number born in Europe fell.", "Asian-born residents rose from 490,996 to 4,979,037 and Latin American-born from 908,309 to 8,407,837, while European-born fell from 7,256,311 to 4,350,403.", "key"),
   O("Europe remained the leading region of birth for the foreign-born in every year shown.", "By 1980 Latin America (4,372,487) exceeded Europe (5,149,572)? No: Europe led in 1980, but in 1990 Latin America (8,407,837) and Asia (4,979,037) both exceeded Europe (4,350,403).", "overstated")],
  2, ["Foreign-born residents from Asia and Latin America increased after 1960 while those from Europe decreased.", "Europe was the leading region of birth through 1980 but not in 1990."],
  "Europe 7,256,311 (1960) to 4,350,403 (1990); Asia 490,996 to 4,979,037; Latin America 908,309 to 8,407,837", "1A"),
 item("4.B", "8.14", "Which of the following most directly helped cause the change in the number of Asian-born residents between 1970 and 1990?",
  [O("The Immigration and Nationality Act of 1965 ended national-origins quotas and favored family ties.", "The 1965 law replaced the 1920s quota system with a preference system that opened immigration from Asia, and Asian-born residents rose from 824,887 in 1970 to 4,979,037 in 1990.", "key"),
   O("The Chinese Exclusion Act of 1882 barred Chinese laborers from entering the United States for years.", "The Chinese Exclusion Act restricted Asian immigration and dates from 1882, so it cannot explain a rise after 1970.", "reversal"),
   O("The Immigration Act of 1924 limited immigration through quotas based on national origin.", "The 1924 law restricted Asian and southern and eastern European immigration; it was replaced by the 1965 law, not responsible for growth after 1970.", "wrong_period"),
   O("The Marshall Plan sent American aid to rebuild the economies of Western Europe after the war.", "The Marshall Plan (1948) aided Western Europe and had no direct effect on migration from Asia to the United States.", "unrelated_development")],
  0, ["The Immigration and Nationality Act of 1965 abolished the national-origins quota system.", "The Chinese Exclusion Act (1882) and Immigration Act of 1924 restricted immigration."],
  "Asia-born 824,887 (1970), 2,539,777 (1980), 4,979,037 (1990)", "4B"),
 item("4.A", "8.14", "The decline in the number of European-born residents between 1930 and 1960 is best explained in part by which of the following?",
  [O("The Immigration and Nationality Act of 1965 ended the use of national-origins quotas.", "That law was passed in 1965, after the 1960 census, so it cannot explain the change between 1930 and 1960.", "wrong_period"),
   O("The federal government deported most European-born residents after the Second World War ended.", "No such mass deportation occurred; the table shows 7,256,311 European-born residents still living in the country in 1960.", "unsupported_by_source"),
   O("The Homestead Act drew large numbers of European farmers to the Great Plains.", "The Homestead Act dates from 1862 and encouraged earlier settlement; it cannot explain a decline after 1930.", "wrong_period"),
   O("Quotas set in the 1920s sharply limited new European immigration.", "The Emergency Quota Act (1921) and Immigration Act of 1924 cut European arrivals, and the Depression and war kept them low, so the European-born population aged and shrank (11,784,010 in 1930 to 7,256,311 in 1960).", "key")],
  3, ["The Emergency Quota Act (1921) and the Immigration Act of 1924 set national-origins quotas.", "Immigration was low during the Great Depression and the Second World War."],
  "Europe-born 11,784,010 (1930) to 7,256,311 (1960)", "4A")],
 "quantitative", r2intro, r2stim)
# ── R3: map — Reynolds 1856 ────────────────────────────────────────────────────────────
rm = reg["map-reynolds-1856"]
r3intro = f'{MARK}\n(map)\n{rm["title"]}\n{credit(rm)}\n\nThe map for this source appears below.'
r3stim = {"kind": "image", "description": rm["alt"], "data": {"path": rm["public_path"], "alt": rm["alt"], "credit": rm["credit"]}}
r3 = mc("real_r3", "The territorial question on the eve of the 1856 election", "Free States, Slave States, and the Western Territories, 1856", 5, "5.6", "3.A", [("map-reynolds-1856", "map")], [
 item("3.A", "5.6", "The title of the map suggests that its publishers wanted viewers to focus on which of the following issues?",
  [O("Whether the Confederate States could win recognition as an independent nation.", "The map was published in 1856; the Confederacy did not exist until 1861.", "wrong_period"),
   O("Whether slavery would be allowed to spread into the western territories.", "The title refers to 'the territory open to slavery or freedom by the repeal of the Missouri Compromise,' naming the expansion of slavery as the issue.", "key"),
   O("Whether high tariffs should be used to protect Northern manufacturers.", "The title and the colors by free and slave status address slavery, not tariff policy.", "unrelated_development"),
   O("Whether the federal government should build a railroad to the Pacific coast.", "Nothing in the title concerns railroads; it concerns the free and slave states and the territories.", "unrelated_development")],
  1, ["The map's title concerns the comparative area of free and slave states and territory opened by the repeal of the Missouri Compromise.", "The Confederacy was formed in 1861."],
  "title: 'the territory open to slavery or freedom by the repeal of the Missouri Compromise'", "3A"),
 item("4.A", "5.6", "The repeal of the Missouri Compromise mentioned in the title was accomplished by which of the following?",
  [O("The Compromise of 1850, which admitted California as a free state.", "The Compromise of 1850 left the Missouri Compromise line in place for the Louisiana Purchase lands; the line was repealed four years later.", "misattributed"),
   O("The Wilmot Proviso, which proposed banning slavery in lands taken from Mexico.", "The Wilmot Proviso of 1846 never passed the Senate and did not repeal anything.", "misattributed"),
   O("The Kansas-Nebraska Act, which let settlers decide the slavery question by popular sovereignty.", "The Kansas-Nebraska Act (1854) organized two territories north of the 36 30 line and repealed the Missouri Compromise restriction there, which is the event the map's title cites.", "key"),
   O("The Dred Scott decision, which ruled that Congress could not ban slavery in the territories at all.", "Dred Scott was decided in 1857, after this 1856 map was published, and was a court ruling that called the Missouri line unconstitutional rather than a repeal.", "wrong_period")],
  2, ["The Kansas-Nebraska Act of 1854 repealed the Missouri Compromise's ban on slavery north of 36 30 in the Louisiana Purchase lands.", "Dred Scott v. Sandford was decided in 1857."],
  "title says the territory was opened 'by the repeal of the Missouri Compromise' (map dated 1856)", "4A"),
 item("2.B", "5.6", "The portraits of John C. Fremont and William L. Dayton at the top of the map most likely indicate that the publishers wanted to",
  [O("promote the 1856 Republican presidential ticket by making the case against extending slavery.", "Fremont and Dayton were the Republican presidential and vice-presidential candidates in 1856, and the map presents the free-versus-slave comparison as a campaign argument.", "key"),
   O("support the Democratic candidate James Buchanan, who favored letting settlers decide on slavery.", "Fremont and Dayton ran against Buchanan, the Democratic nominee, in 1856, so their portraits do not promote him.", "misattributed"),
   O("celebrate the Whig party's long record of winning presidential elections.", "The Whig party had collapsed by 1856, and its former members were divided among the Republican and American parties.", "wrong_period"),
   O("announce a compromise ticket meant to unite Northern and Southern voters in 1856.", "The Republican ticket was entirely sectional, drawing support from the North, and not a compromise between sections.", "reversal")],
  0, ["John C. Fremont and William L. Dayton were the Republican nominees for president and vice president in 1856.", "James Buchanan won the 1856 election as the Democratic candidate."],
  "portraits labeled 'JOHN C. FREMONT' and 'WM. L. DAYTON' at the top corners of the map", "2B")],
 "image", r3intro, r3stim)
# fix the over-long/hedged R2 Q1 distractor to a clean claim (keeps the data check explicit)
for it in r2["payload"]["items"]:
    for o in it["options"]:
        if o["text"].startswith("Europe remained the leading region"):
            o["why"] = "Europe led through 1980 (5,149,572 versus 4,372,487 for Latin America), but in 1990 Latin America (8,407,837) and Asia (4,979,037) both exceeded Europe (4,350,403)."
    it["explanation_en"] = "\n".join([f'The correct answer is "{it["options"][it["key_index"]]["text"]}". {it["options"][it["key_index"]]["why"]}'] + [f'"{o["text"]}" is incorrect: {o["why"]}' for i, o in enumerate(it["options"]) if i != it["key_index"]])
json.dump([r1, r2, r3], open("data/ap/ush-sources/sample-mc.json", "w"), ensure_ascii=False, indent=1)
print("mc sets", 3)

# ── SAQ3: non-text source — photograph (Lange 1936) ─────────────────────────────────────
ph = reg["img-migrant-mother-1936"]
def part(label, prompt, skill, topic, model, elems, crit):
    return {"label": label, "prompt": prompt, "points": 1, "response_mode": "explain", "skill_codes": [skill], "topic_codes": [topic], "model_answer": model,
            "rubric_rows": [{"row_id": label.lower(), "points": 1, "criterion": crit, "required_elements": elems, "optional_phrases": [], "alt_solutions": [], "common_errors": [], "requires_row_id": None, "requires_both": False, "requires_numbers": False, "numeric_tolerance": None, "units_row": False}]}
parts = [
 part("A", "Briefly describe ONE condition faced by American farm families in the 1930s that is reflected in the photograph and its caption.", "3.A", "7.9",
      "Many farm families were so poor that they became migrant laborers, traveling from crop to crop for low pay, as the caption's 'destitute pea pickers' indicates.",
      ["Many farm families were so poor that they became migrant laborers who followed seasonal crops for low pay.", "Farm families lacked money for basic needs; the caption calls the pea pickers 'destitute.'", "Families left their homes in search of work during the Depression."],
      "Describe one condition of 1930s farm families that the photograph or its caption reflects, such as destitution, migrant farm labor, or displacement in search of work."),
 part("B", "Briefly explain ONE specific historical cause of the hardship reflected in the photograph.", "1.B", "7.9",
      "The Great Depression collapsed crop prices after 1929, and drought and dust storms on the southern Plains drove many farm families to leave for California.",
      ["The Great Depression collapsed crop prices after 1929, leaving farmers unable to pay debts and rent.", "Drought and dust storms of the Dust Bowl in the 1930s ruined farms on the southern Plains and sent families west.", "Tenant farmers and sharecroppers were pushed off the land, especially as landowners cut production and used tractors."],
      "Explain one specific cause of 1930s farm hardship, such as collapsing crop prices in the Great Depression, the Dust Bowl, or the displacement of tenants and sharecroppers."),
 part("C", "Briefly explain ONE specific response by the federal government to the hardship of farm families in the 1930s.", "4.B", "7.10",
      "The Resettlement Administration, later the Farm Security Administration, lent money to poor farmers and ran camps for migrant farm workers.",
      ["The Resettlement Administration (1935) and its successor the Farm Security Administration (1937) gave loans to poor farmers and built camps for migrant farm workers.", "The Agricultural Adjustment Act (1933) paid farmers to reduce production in order to raise crop prices.", "Photographers of the Resettlement Administration and Farm Security Administration, including Dorothea Lange, documented rural poverty to build public support for relief."],
      "Explain one specific federal response to 1930s farm hardship, such as the Agricultural Adjustment Act, the Resettlement Administration or Farm Security Administration, or New Deal relief programs.")]
refl = "Scoring guide (ALTON practice rubric, not official College Board scoring). This question is worth 3 points.\n" + "\n".join(f'Part {p["label"]} (0-1): {p["rubric_rows"][0]["criterion"]}\n   - 1: ' + p["model_answer"] for p in parts)
saq = {"cellId": "ap_us_history-real_saq3_1", "apSubjectCode": "ap_us_history", "kind": "frq_bundle", "calculator": "na", "reserve": False, "wording": "authored_from_real_source", "candidateKey": "ap_us_history-real_saq3_1-k0",
       "keywordCode": "7.9", "unitCode": "7", "skillPrimary": "3.A", "structure": "frq_multipart", "archetype": "ushfrq_real_saq3_1", "reviewState": "sample_unverified", "rejectionReason": None, "difficultyProvisional": "exam_prep", "run": "ush-real-1",
       "stockKey": "ush-real-1:ap_us_history-real_saq3_1-k0", "stimulusOrigin": "real_historical_source", "sourceRegistryIds": ["img-migrant-mother-1936"],
       "payload": {"archetype": "ushfrq_real_saq3_1", "template": "saq3", "topic": "7.9", "extra_topics": ["7.10"], "skill": "3.A", "representative_skill": "3.A", "calculator": "na", "title": "A Photograph of a Migrant Farm Family, 1936",
                   "set_intro": f'{MARK}\n(photograph)\n{ph["title"]}\n{credit(ph)}\n\nThe photograph for this source appears below.',
                   "stimulus": {"kind": "image", "description": ph["alt"], "data": {"path": ph["public_path"], "alt": ph["alt"], "credit": ph["credit"]}},
                   "parts": parts, "reference_text": refl,
                   "ush_frq": {"schema_version": "ush-frq-1", "task_type": "saq", "template": "saq3", "period": 7, "periods": [7], "title": "A Photograph of a Migrant Farm Family, 1936",
                               "prompt": {"scenario": "Use the photograph below to answer parts A, B, and C.", "task": "Using the photograph, answer parts A, B, and C.", "requirements": ["Answer all three parts.", "Each part is worth one point.", "Use specific historical evidence for parts B and C."], "parts": [{"label": p["label"], "prompt": p["prompt"], "points": 1} for p in parts]},
                               "sources": [{"id": "A", "kind": "photograph", "title": ph["title"], "attribution": credit(ph), "real_data": True, "source_registry_id": "img-migrant-mother-1936", "source_sha256": ph["sha256"]}]},
                   "design": {"source_fixed_first": True, "evidence_in_source": "caption text 'Destitute pea pickers in California. A 32 year old mother of seven children.' and the visible worn clothing and tent setting"}}}
# ── DBQ outline (not a loadable candidate; 3 of 7 documents are real and registered, 4 unresolved) ──
dbq = {"id": "real_dbq_outline_1", "status": "outline_only_unresolved_documents", "period": 6, "periods": [6, 7], "topics": ["6.6", "6.12", "7.4"],
       "prompt": "Evaluate the extent to which concentrated economic power led to demands for greater government regulation of business in the United States between 1880 and 1915.",
       "skills": ["6.A", "6.B", "6.C", "6.D"],
       "documents": [
        {"n": 1, "registry_id": "img-bosses-senate-1889", "type": "political_cartoon", "hipp": "Keppler, in the humor magazine Puck (1889), a critic of trusts; audience: magazine readers; purpose: argue that trusts control the Senate", "supports": "trust power over politics and a closed 'people's entrance'", "complication": "A satirical cartoon exaggerates and shows no evidence about actual legislation; use for argument about perceptions of corruption."},
        {"n": 2, "registry_id": "txt-jungle-1906", "type": "primary_text (novel)", "hipp": "Sinclair, a socialist novelist, 1906; purpose: expose packinghouse conditions and weak inspection", "supports": "public reaction leading to the 1906 federal Meat Inspection and Pure Food and Drug laws", "complication": "A novel, not an official record; Sinclair's goal was worker conditions, while the public reacted to food safety."},
        {"n": 3, "registry_id": "stat-foreign-born-1850-1940", "type": "statistic_table", "hipp": "Census Bureau counts (2006 compilation of decennial census data)", "supports": "context: immigrants were 13 to 15 percent of residents in 1880-1910, the labor force of the industries criticized (weak fit; better document to be sourced)", "complication": "Does not itself address regulation; flagged as the weakest of the three and a candidate for replacement."},
        {"n": 4, "registry_id": None, "type": "UNRESOLVED", "needed": "Sherman Antitrust Act (1890) text or Interstate Commerce Act (1887), from archives.gov or a Statutes at Large scan"},
        {"n": 5, "registry_id": None, "type": "UNRESOLVED", "needed": "Theodore Roosevelt, 'New Nationalism' speech (1910) excerpt, from a verified repository"},
        {"n": 6, "registry_id": None, "type": "UNRESOLVED", "needed": "A business-side or limited-government source (for example an 1890s court or Social Darwinist text) with verified text and rights"},
        {"n": 7, "registry_id": None, "type": "UNRESOLVED", "needed": "A second visual or a verified historical statistic on industrial concentration (HSUS or Census table)"}],
       "notes": "Outline only. The real documents are fixed first; the prompt, thesis lines and document uses were designed from them. Not loadable until documents 4-7 are fixed and verified."}
json.dump([saq], open("data/ap/ush-sources/sample-frq.json", "w"), ensure_ascii=False, indent=1)
json.dump(dbq, open("data/ap/ush-sources/sample-dbq-outline.json", "w"), ensure_ascii=False, indent=1)
print("saq + dbq outline")

# ── 검증 결과를 문항 메타데이터에 기록(ush-real-verify.ts 실행 뒤) ─────────────────────
import os
if os.path.exists("data/ap/ush-sources/sample-verification.json"):
    v = json.load(open("data/ap/ush-sources/sample-verification.json"))
    mcs = json.load(open("data/ap/ush-sources/sample-mc.json"))
    for c in mcs:
        for i, it in enumerate(c["payload"]["items"]):
            r = v["items"][f'{c["cellId"]}#{i+1}']
            it["verification"] = {"status": r["status"], "blind_solvers": v["models"]["solvers"], "solver_choices": r["solverChoices"], "solver_confidence": r["solverConfidence"], "fact_checker": v["models"]["fact"], "fact_verdict": r["factVerdict"], "flags": r["flags"]}
        c["reviewState"] = "verified_by_independent_models" if all(it["verification"]["status"] == "verified" for it in c["payload"]["items"]) else "has_unresolved_items"
    json.dump(mcs, open("data/ap/ush-sources/sample-mc.json", "w"), ensure_ascii=False, indent=1)
    fr = json.load(open("data/ap/ush-sources/sample-frq.json"))
    fv = v["fact"]["fact-frq-0"]
    fr[0]["payload"]["verification"] = {"fact_checker": v["models"]["fact"], "verdicts": fv["verdicts"], "flags": fv["flags"]}
    fr[0]["reviewState"] = "fact_checked_by_independent_model"
    json.dump(fr, open("data/ap/ush-sources/sample-frq.json", "w"), ensure_ascii=False, indent=1)
    db = json.load(open("data/ap/ush-sources/sample-dbq-outline.json"))
    dv = v["fact"]["fact-dbq"]; db["verification"] = {"fact_checker": v["models"]["fact"], "verdicts": dv["verdicts"], "flags": dv["flags"], "result": "outline facts sound; prompt NOT answerable until documents 4-7 (incl. a counter-perspective) are fixed"}
    json.dump(db, open("data/ap/ush-sources/sample-dbq-outline.json", "w"), ensure_ascii=False, indent=1)
    print("verification stamped")
