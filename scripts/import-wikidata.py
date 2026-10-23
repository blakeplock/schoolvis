#!/usr/bin/env python3
"""Seed a CC0 Wikidata school search index; Wikipedia categories supply QIDs only.

This is a candidate directory, not comprehensive enrollment or verified websites.
No Wikipedia article, description, category label, or page text is persisted.
"""
import argparse
import datetime
import json
import re
import sqlite3
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

DB = Path.home() / '.schoolvis' / 'schools.sqlite'
CATEGORY = 'Category:Private_schools_in_the_United_States_by_state_or_territory'
UA = 'SchoolVis/0.11.1 (school directory CC0 Wikidata import; https://github.com/blakeplock/schoolvis)'
API = 'https://en.wikipedia.org/w/api.php'
WIKIDATA = 'https://www.wikidata.org/w/api.php'
QID = re.compile(r'^Q[1-9][0-9]*$')
STATES = {'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY','District of Columbia':'DC'}

def fetch(api, params):
    url = api + '?' + urllib.parse.urlencode(dict(action='query',format='json',formatversion=2,**params))
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept':'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req,timeout=25) as res:
                data = res.read(5_000_000)
            return json.loads(data)
        except (urllib.error.URLError,TimeoutError):
            if attempt == 3: raise
            time.sleep(2**attempt)

def state_for(cat, inherited=''):
    for name,code in STATES.items():
        if re.search(r'\b'+re.escape(name)+r'\b',cat,re.I): return code
    return inherited

def discover(max_categories, max_qids, delay):
    queue=[(CATEGORY,0,'')]; seen=set(); qids={}
    while queue and len(seen)<max_categories and len(qids)<max_qids:
        cat,depth,state=queue.pop(0)
        if cat in seen:continue
        seen.add(cat); state=state_for(cat,state)
        params={'list':'categorymembers','cmtitle':cat,'cmlimit':'max','cmtype':'page|subcat'}
        while True:
            result=fetch(API,params)
            for item in result.get('query',{}).get('categorymembers',[]):
                if item.get('ns')==14 and depth<4:
                    name=item.get('title','')
                    if re.search(r'(private|independent|parochial|religious|school)',name,re.I):
                        queue.append((name,depth+1,state))
                elif item.get('ns')==0 and len(qids)<max_qids:
                    # Page IDs are used transiently to resolve linked Wikidata IDs.
                    pageid=item.get('pageid')
                    if not isinstance(pageid,int):continue
                    props=fetch(API,{'prop':'pageprops','pageids':str(pageid),'ppprop':'wikibase_item'})
                    for page in props.get('query',{}).get('pages',[]):
                        q=page.get('pageprops',{}).get('wikibase_item','')
                        if QID.fullmatch(q):qids.setdefault(q,state)
                    time.sleep(delay)
            if 'continue' not in result:break
            params.update(result['continue']);time.sleep(delay)
        print(f'Categories examined: {len(seen)}; Wikidata IDs discovered: {len(qids)}',flush=True)
        time.sleep(delay)
    return qids

def statements(entity,prop):
    for s in entity.get('claims',{}).get(prop,[]):
        if s.get('rank')=='deprecated':continue
        v=s.get('mainsnak',{}).get('datavalue',{}).get('value')
        if v is not None:yield v

def read_entities(qids, delay):
    out=[]; pairs=list(qids.items()); stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    for offset in range(0,len(pairs),40):
        batch=pairs[offset:offset+40]; ids='|'.join(q for q,_ in batch)
        url=WIKIDATA+'?'+urllib.parse.urlencode({'action':'wbgetentities','format':'json','ids':ids,'props':'labels|claims','languages':'en'})
        req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json'})
        with urllib.request.urlopen(req,timeout=30) as f:data=json.loads(f.read(8_000_000))
        for q,state in batch:
            entity=data.get('entities',{}).get(q,{})
            if entity.get('missing'):continue
            label=entity.get('labels',{}).get('en',{}).get('value','').strip()
            if not label or len(label)>220:continue
            sites=[v for v in statements(entity,'P856') if isinstance(v,str) and v.startswith('https://')]
            candidate=sites[0][:2048] if sites else ''
            out.append((q,label,'',state,'',candidate,'unverified',f'https://www.wikidata.org/wiki/{q}',f'https://www.wikidata.org/wiki/Special:EntityData/{q}.json',stamp,'CC0-1.0','Wikidata'))
        time.sleep(delay)
    return out

def store(rows,dbfile):
    dbfile.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    db=sqlite3.connect(dbfile)
    try:
        with db:
            db.execute("""CREATE TABLE IF NOT EXISTS wikidata_schools (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL,
                state TEXT NOT NULL, zip TEXT NOT NULL, website_candidate TEXT,
                website_status TEXT NOT NULL, source_url TEXT NOT NULL,
                statement_source TEXT NOT NULL, retrieved_at TEXT NOT NULL,
                rights TEXT NOT NULL, provider TEXT NOT NULL)""")
            db.execute('CREATE INDEX IF NOT EXISTS wikidata_school_name ON wikidata_schools(name)')
            db.execute('DELETE FROM wikidata_schools')
            db.executemany('INSERT INTO wikidata_schools VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',rows)
    finally:db.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--max-categories',type=int,default=100)
    parser.add_argument('--max-schools',type=int,default=1500)
    parser.add_argument('--delay',type=float,default=.15)
    parser.add_argument('--db',type=Path,default=DB)
    args=parser.parse_args()
    if not 1<=args.max_categories<=300 or not 1<=args.max_schools<=5000 or not .1<=args.delay<=5:parser.error('Invalid bounded collection settings')
    found=discover(args.max_categories,args.max_schools,args.delay)
    if not found:raise SystemExit('No Wikidata-linked institutions found. Nothing changed.')
    records=read_entities(found,args.delay)
    if not records:raise SystemExit('No valid Wikidata labels found. Nothing changed.')
    store(records,args.db.expanduser())
    print(f'Imported {len(records)} CC0 Wikidata school candidates. Official domains UNVERIFIED. Coverage incomplete.')
