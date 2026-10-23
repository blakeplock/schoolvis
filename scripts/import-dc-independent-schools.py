#!/usr/bin/env python3
"""Conservatively match DC government's CC BY 4.0 independent-school GEOJSON to SchoolVis.

Offline-first: --geojson accepts downloaded file, default fetches DC Open Data.
Dry run writes source-backed match proposals and review; --apply stores unique matches
without overwriting prior school_locations. Excludes uncertain or duplicate identities.
"""
import argparse, csv, datetime, difflib, json, re, sqlite3, urllib.request
from pathlib import Path

DB=Path.home()/'.schoolvis'/'schools.sqlite'
URL='https://opendata.dc.gov/api/download/v1/items/8986ebe04f554892aa76b95b284c4942/geojson?layers=3'
LICENSE='https://creativecommons.org/licenses/by/4.0/'
STOP={'the','school','schools','of','and','day','washington','dc','d','c','for','at','academy','upper','lower','middle','campus'}
def norm(s):
    return ' '.join(w for w in re.findall(r'[a-z0-9]+',str(s).lower().replace('&',' and ')) if w not in STOP)
def fields(props):
    return {re.sub('[^a-z0-9]','',str(k).lower()):v for k,v in props.items()}
def pick(props,*names):
    for n in names:
        val=props.get(n)
        if val not in ('',None):return str(val).strip()
    return ''
def unpack(feature):
    p=fields(feature.get('properties') or {})
    name=pick(p,'name','schoolname','facilityname','school','sitename','organization','institutionname')
    geo=feature.get('geometry') or {}; pt=geo.get('coordinates') or []
    if geo.get('type')!='Point' or len(pt)<2: return None
    try: lon,lat=float(pt[0]),float(pt[1])
    except (ValueError,TypeError):return None
    if not (-77.20<lon<-76.85 and 38.75<lat<39.05) or not name:return None
    address=pick(p,'address','fulladdress','streetaddress','siteaddress','addr','address1','street')
    zip_code=pick(p,'zipcode','zip','postalcode','zip5')
    return {'name':name,'lat':lat,'lon':lon,'address':address,'zip':zip_code,'source':URL}
def collect(doc):
    if doc.get('type')!='FeatureCollection':raise ValueError('Expected a GeoJSON FeatureCollection')
    return [x for f in doc.get('features',[]) if (x:=unpack(f))]
def match(s,records):
    target=norm(s['name']); matches=[]
    for record in records:
        other=norm(record['name']); score=1.0 if target==other and target else difflib.SequenceMatcher(None,target,other).ratio()
        if target and other and (target in other or other in target) and min(len(target),len(other))>=10:score=max(score,.90)
        if score>=.87:matches.append((score,record))
    matches.sort(key=lambda x:-x[0]);
    if not matches:return None,'not in DC dataset'
    best=matches[0][0]; eligible=[r for score,r in matches if best-score<.08]
    if best<.94:return None,'name similarity requires review'
    if len(eligible)!=1:return None,'multiple possible school/campus matches'
    return eligible[0],''
def run(dbpath,doc,out,apply):
    records=collect(doc)
    if not records:raise ValueError('No DC point records parsed; inspect dataset schema')
    db=sqlite3.connect(dbpath)
    try:
        schools=[{'id':sid,'name':name} for sid,name in db.execute("SELECT id,name FROM schools WHERE county='Washington DC' ORDER BY name")]
        has=bool(db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='school_locations'").fetchone())
        existing={r[0] for r in db.execute('SELECT school_id FROM school_locations')} if has else set()
        proposals=[];review=[]
        for school in schools:
            if school['id'] in existing:continue
            candidate,reason=match(school,records)
            if candidate:
                proposals.append({'school_id':school['id'],'registry_name':school['name'],'source_school_name':candidate['name'],'lat':candidate['lat'],'lon':candidate['lon'],'address':candidate['address'],'zip':candidate['zip'],'source_url':URL,'rights':'CC BY 4.0','verification':'name_match_not_campus_verified'})
            else:review.append({'school_id':school['id'],'registry_name':school['name'],'reason':reason})
        # Explicitly reject a government feature matching more than one institution.
        counts={}
        for x in proposals:counts[(x['lat'],x['lon'],x['source_school_name'])]=counts.get((x['lat'],x['lon'],x['source_school_name']),0)+1
        safe=[]
        for x in proposals:
            if counts[(x['lat'],x['lon'],x['source_school_name'])]>1:review.append({'school_id':x['school_id'],'registry_name':x['registry_name'],'reason':'same DC feature matched multiple registry schools'})
            elif not x['address']:review.append({'school_id':x['school_id'],'registry_name':x['registry_name'],'reason':'DC GIS record lacks street address: manual confirmation'})
            else:safe.append(x)
        out.mkdir(parents=True,exist_ok=True)
        for filename,rows,columns in [('dc-gis-proposals.csv',safe,['school_id','registry_name','source_school_name','lat','lon','address','zip','source_url','rights','verification']),('dc-gis-review.csv',review,['school_id','registry_name','reason'])]:
            with (out/filename).open('w',newline='',encoding='utf-8') as f:
                w=csv.DictWriter(f,fieldnames=columns);w.writeheader();w.writerows(rows)
        if apply and safe:
            now=datetime.datetime.now(datetime.timezone.utc).isoformat()
            with db:
                db.execute('''CREATE TABLE IF NOT EXISTS school_locations (school_id TEXT PRIMARY KEY REFERENCES schools(id),street_address TEXT NOT NULL,city TEXT NOT NULL,state TEXT NOT NULL,postal_code TEXT NOT NULL,lat REAL NOT NULL CHECK(lat BETWEEN -90 AND 90),lon REAL NOT NULL CHECK(lon BETWEEN -180 AND 180),address_source_url TEXT NOT NULL,geocode_source TEXT NOT NULL,geocoded_at TEXT NOT NULL,review_status TEXT NOT NULL DEFAULT 'geocoded_unverified')''')
                db.executemany('''INSERT OR IGNORE INTO school_locations(school_id,street_address,city,state,postal_code,lat,lon,address_source_url,geocode_source,geocoded_at,review_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)''',[(r['school_id'],r['address'],'Washington','DC',r['zip'],r['lat'],r['lon'],URL,'DC Open Data GIS (CC BY 4.0)',now,'government_gis_unverified') for r in safe])
        print(f'DC GIS source features: {len(records)}; DC registry: {len(schools)}; already located: {len(existing & {x["id"] for x in schools})}; new eligible matches: {len(safe)}; review: {len(review)}; mode: {"APPLIED" if apply else "DRY RUN"}')
        print(f'Outputs: {out}/dc-gis-proposals.csv and {out}/dc-gis-review.csv')
        print('Attribution: DC Open Data, Independent Schools (CC BY 4.0), source URL in each record. Dataset last modified 2024-04-19; current campus locations require separate confirmation.')
    finally:db.close()
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--geojson',type=Path,help='Use an offline downloaded GeoJSON');p.add_argument('--db',type=Path,default=DB);p.add_argument('--output-dir',type=Path,default=Path('data/locations'));p.add_argument('--apply',action='store_true')
    a=p.parse_args()
    if a.geojson:doc=json.loads(a.geojson.read_text(encoding='utf-8-sig'))
    else:
        req=urllib.request.Request(URL,headers={'User-Agent':'SchoolVis-mdc-pilot/0.11.8 (https://github.com/blakeplock/schoolvis)'})
        with urllib.request.urlopen(req,timeout=60) as response: doc=json.load(response)
    run(a.db,doc,a.output_dir,a.apply)
