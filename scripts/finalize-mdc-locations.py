#!/usr/bin/env python3
"""Source-aware Wikidata coordinate reconciliation for SchoolVis MD/DC.

Network discovery never changes SQLite. Review proposals, then explicitly approve
an exact QID and coordinates via approval CSV before --apply. No OSM/Google data.
"""
import argparse,csv,datetime,difflib,json,re,sqlite3,time,urllib.parse,urllib.request,urllib.error
from pathlib import Path

DB=Path.home()/'.schoolvis'/'schools.sqlite'
BASE=Path('data/locations')
API='https://www.wikidata.org/w/api.php'
UA='SchoolVis-MD-DC-coordinate-reconciliation/1.0 (https://github.com/blakeplock/schoolvis; manual review required)'
FIELDS=['school_id','school_name','qid','wikidata_label','latitude','longitude','source_url','review_status','reason','address','city','state','campus_note']

def read_csv(path):
 with path.open(newline='',encoding='utf-8-sig') as f:return list(csv.DictReader(f))
def write_csv(path,rows,fields=FIELDS):
 path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('w',newline='',encoding='utf-8') as f:
  w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows(rows)
def normalize(x):
 x=x.lower().replace('&',' and ')
 return ' '.join(re.findall(r'[a-z0-9]+',x))
def name_matches(a,b,aliases=()):
 names=[a,*aliases]
 return any(normalize(x)==normalize(b) for x in names if x)
def request(params,delay=1.0):
 url=API+'?'+urllib.parse.urlencode({'format':'json',**params})
 req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json'})
 for attempt in range(7):
  try:
   with urllib.request.urlopen(req,timeout=30) as res:
    body=res.read(5_000_000)
   time.sleep(delay)
   return json.loads(body)
  except urllib.error.HTTPError as e:
   if e.code not in (429,500,502,503,504) or attempt==6:raise
   retry=e.headers.get('Retry-After','')
   wait=min(120,max(3,2**attempt, int(retry) if retry.isdigit() else 0));print('Wikidata retry in',wait,'seconds',flush=True);time.sleep(wait)
  except (urllib.error.URLError,TimeoutError):
   if attempt==6:raise
   time.sleep(min(60,2**attempt+2))
def coord_from_entity(ent):
 found=[]
 for statement in ent.get('claims',{}).get('P625',[]):
  if statement.get('rank')=='deprecated':continue
  value=statement.get('mainsnak',{}).get('datavalue',{}).get('value',{})
  if not isinstance(value,dict) or value.get('globe','').split('/')[-1]!='Q2':continue
  if not all(k in value for k in ('latitude','longitude')):continue
  precision=value.get('precision')
  # Anything coarser than approximately 100m is not a campus point.
  if precision is None or precision>0.001:continue
  found.append((float(value['latitude']),float(value['longitude'])))
 return list(dict.fromkeys(found))
def discover_one(r):
 search=request({'action':'wbsearchentities','search':r['school_name'],'language':'en','type':'item','limit':10}).get('search',[])
 qids=[x['id'] for x in search if re.fullmatch(r'Q[1-9][0-9]*',x.get('id',''))]
 if not qids:return [],'No Wikidata identity candidates'
 entities=request({'action':'wbgetentities','ids':'|'.join(qids),'props':'labels|aliases|claims','languages':'en'}).get('entities',{})
 hits=[]
 for q,ent in entities.items():
  label=ent.get('labels',{}).get('en',{}).get('value','')
  aliases=[x.get('value','') for x in ent.get('aliases',{}).get('en',[])]
  if not name_matches(r['school_name'],label,aliases):continue
  cs=coord_from_entity(ent)
  for lat,lon in cs:
   if r.get('state')=='MD' and not (37.85<=lat<=39.85 and -79.65<=lon<=-75.0):continue
   if r.get('state')=='DC' and not (38.78<=lat<=39.01 and -77.13<=lon<=-76.87):continue
   hits.append((q,label,lat,lon))
 return hits, ('Identity exact but no suitably precise coordinate' if not hits else '')
def discover(rows,path):
 out=[]
 for i,r in enumerate(rows,1):
  try:
   hits,err=discover_one(r)
   if len(hits)==1:
    q,label,lat,lon=hits[0]
    status='review_candidate'
    reason='Exact Wikidata name/alias and geographically plausible; CAMPUS still requires manual confirmation'
   elif len(hits)>1:
    q=label=lat=lon='';status='ambiguous';reason=f'{len(hits)} plausible Wikidata coordinates, manual selection required'
   else:
    q=label=lat=lon='';status='unresolved';reason=err
  except Exception as e:
   q=label=lat=lon='';status='api_error';reason=f'{type(e).__name__}: {str(e)[:140]}'
  out.append({'school_id':r['school_id'],'school_name':r['school_name'],'qid':q,'wikidata_label':label,'latitude':lat,'longitude':lon,'source_url':f'https://www.wikidata.org/wiki/{q}' if q else r.get('source_url',''),'review_status':status,'reason':reason,'address':r.get('address',''),'city':r.get('city',''),'state':r.get('state',''),'campus_note':r.get('notes','')})
  print(f'{i}/{len(rows)} {r["school_name"]}: {status}',flush=True)
  write_csv(path,out)
 return out
def apply_approvals(approvals,dbpath):
 db=sqlite3.connect(dbpath)
 count=0;skips=[]
 try:
  with db:
   existing={r[0] for r in db.execute('SELECT school_id FROM school_locations')}
   known={r[0] for r in db.execute('SELECT id FROM schools')}
   for r in approvals:
    sid=r['school_id']
    if r.get('review_status')!='approved' or sid in existing or sid not in known:
     skips.append(sid);continue
    if not re.fullmatch('Q[1-9][0-9]*',r.get('qid','')):raise ValueError('Missing QID for '+sid)
    lat=float(r['latitude']);lon=float(r['longitude']);st=r['state']
    if not ((st=='MD' and 37.85<=lat<=39.85 and -79.65<=lon<=-75) or (st=='DC' and 38.78<=lat<=39.01 and -77.13<=lon<=-76.87)):raise ValueError('Out-of-bounds coordinate '+sid)
    if not r.get('address') or not r.get('source_url','').startswith('https://www.wikidata.org/wiki/Q'):
     raise ValueError('Address or QID provenance missing '+sid)
    db.execute('INSERT INTO school_locations(school_id,street_address,city,state,postal_code,lat,lon,address_source_url,geocode_source,geocoded_at,review_status) VALUES(?,?,?,?,?,?,?,?,?,?,?)',(sid,r['address'],r.get('city',''),st,r.get('zip',''),lat,lon,r['source_url'],'Wikidata P625; manually approved school campus',datetime.datetime.now(datetime.timezone.utc).isoformat(),'manual_approved_reference_point'))
    count+=1
  print('Imported',count,'manually approved coordinates; skipped',len(skips),'unapproved/already-located/unrecognized.')
 finally:db.close()
def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--input',type=Path,default=BASE/'final-18-reconciliation.csv')
 p.add_argument('--output',type=Path,default=BASE/'final-18-coordinate-review.csv')
 p.add_argument('--db',type=Path,default=DB)
 p.add_argument('--apply',action='store_true',help='Import only entries explicitly changed to review_status=approved in --output')
 args=p.parse_args()
 if args.apply:
  if not args.output.exists():p.error('Run discovery and manually approve results before --apply')
  apply_approvals(read_csv(args.output),args.db.expanduser())
 else:
  if not args.input.exists():p.error('Input reconciliation CSV not found')
  discover(read_csv(args.input),args.output)
  print('Review:',args.output,'(no database changes). Edit review_status to approved ONLY after confirming campus coordinates.')
if __name__=='__main__':main()
