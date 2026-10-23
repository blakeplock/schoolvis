#!/usr/bin/env python3
"""Create source-backed address proposals for the SchoolVis Maryland/DC pilot.

Fetches Maryland's public approved nonpublic-school DIRECTORY (not NCES restricted data).
Does not copy descriptions or copyrighted article text, just school names/addresses.
Does not modify SQLite. Review proposed CSV, then use import-mdc-locations.py.
"""
import argparse, csv, difflib, html, re, sqlite3, urllib.request
from html.parser import HTMLParser
from pathlib import Path

DB=Path.home()/'.schoolvis'/'schools.sqlite'
SOURCE='https://oitinfo.msde.maryland.gov/NSAB/NSABSchoolList/TotalPrivateSchoolList'
STOP={'the','school','schools','of','at','and','inc','incorporated','maryland','day'}

def normalize(s):
    s=html.unescape(s).lower().replace('&',' and ').replace('’',"'")
    s=re.sub(r'[^a-z0-9]+',' ',s)
    words=[w for w in s.split() if w not in STOP]
    return ' '.join(words)

def county_key(s):
    return normalize(s.replace('Washington DC','District of Columbia').replace('Baltimore County','Baltimore').replace('Prince George\'s','Prince Georges'))

class Tables(HTMLParser):
    def __init__(self):
        super().__init__();self.tables=[];self.table=None;self.row=None;self.cell=None;self.depth=0
    def handle_starttag(self,t,attrs):
        if t=='table':
            if self.table is None:self.table=[];self.depth=1
            else:self.depth+=1
        elif self.table is not None and t=='tr' and self.depth==1:self.row=[]
        elif self.row is not None and t in ('td','th'):self.cell=[]
        elif self.cell is not None and t in ('br','p','div'):self.cell.append('\n')
    def handle_data(self,data):
        if self.cell is not None:self.cell.append(data)
    def handle_endtag(self,t):
        if t in ('td','th') and self.cell is not None:
            self.row.append(re.sub(r'[ \t]+',' ',''.join(self.cell)).strip());self.cell=None
        elif t=='tr' and self.row is not None:
            if self.row:self.table.append(self.row)
            self.row=None
        elif t=='table' and self.table is not None:
            self.depth-=1
            if self.depth==0:self.tables.append(self.table);self.table=None

def extract(html_text):
    parser=Tables();parser.feed(html_text)
    for table in parser.tables:
        for cells in table:
            if len(cells)<4:continue
            # Official directory columns: advanced link, school name/classification, county, address, phone
            if not re.search(r'\b\d{2}-\d{2}-\d{3,5}\b',cells[0]):continue
            name=cells[1].split('\n')[0].strip()
            county=cells[2].strip()
            addr=cells[3].strip()
            if not name or not county or not addr:continue
            lines=[x.strip() for x in addr.split('\n') if x.strip()]
            if len(lines)<2:continue
            street=lines[0]
            # City's ZIP on the final line, e.g., Kensington 20895
            last=lines[-1];m=re.search(r'(?P<city>.+?)\s+(?P<zip>\d{5})(?:-\d{4})?\s*$',last)
            if not m:continue
            city=m.group('city').strip(' ,\u2002\u2003\u2009\u00a0')
            if city.lower().endswith('maryland'):city=city[:-8].strip(' ,')
            if not city or not street or len(street)>135:continue
            yield {'name':name,'county':county,'address':street,'city':city,'state':'MD','zip':m.group('zip'),'source':SOURCE}

def score(a,b):
    x,y=normalize(a),normalize(b)
    if x==y and x:return 1.0
    # Avoid merging branch schools solely on generic shared names.
    return difflib.SequenceMatcher(None,x,y).ratio()

def match(school,items):
    group=[x for x in items if county_key(x['county'])==county_key(school['county'])]
    ranked=sorted(((score(school['name'],r['name']),r) for r in group),key=lambda x:-x[0])
    if not ranked:return None,0.0,0.0
    first=ranked[0];second=ranked[1][0] if len(ranked)>1 else 0
    return first[1],first[0],second

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--db',type=Path,default=DB)
    ap.add_argument('--html',type=Path,help='Use a previously downloaded Maryland directory HTML for offline/reproducible runs')
    ap.add_argument('--out',type=Path,default=Path('data/locations/md-state-proposals.csv'))
    args=ap.parse_args()
    if args.html: page=args.html.read_text(encoding='utf-8')
    else:
        req=urllib.request.Request(SOURCE,headers={'User-Agent':'SchoolVis-directory-enrichment/0.11.7 (https://github.com/blakeplock/schoolvis)'})
        with urllib.request.urlopen(req,timeout=40) as f:page=f.read(5_000_000).decode('utf-8','replace')
    listing=list(extract(page))
    if len(listing)<100:raise SystemExit(f'Official directory parse returned only {len(listing)} entries. No output written; review source HTML table format.')
    with sqlite3.connect(args.db) as db:
        schools=[dict(zip(('id','name','county'),r)) for r in db.execute('SELECT id,name,county FROM schools ORDER BY name')]
        previously={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='school_locations'")}
        done={r[0] for r in db.execute('SELECT school_id FROM school_locations')} if previously else set()
    proposed=[];review=[]
    for s in schools:
        if s['id'] in done:continue
        if s['county']=='Washington DC':
            review.append({'school_id':s['id'],'registry_name':s['name'],'registry_county':s['county'],'matched_name':'','match_score':'','reason':'DC institution: separate DC source needed','source_url':''});continue
        r,best,second=match(s,listing)
        if not r or best<0.91 or (best-second)<0.10 or ' and ' in r['city'].lower():
            review.append({'school_id':s['id'],'registry_name':s['name'],'registry_county':s['county'],'matched_name':r['name'] if r else '','match_score':round(best,3),'reason':'no unambiguous MD directory match' if r else 'not in directory','source_url':SOURCE});continue
        proposed.append({'school_id':s['id'],'address':r['address'],'city':r['city'],'state':'MD','zip':r['zip'],'address_source_url':SOURCE})
    args.out.parent.mkdir(parents=True,exist_ok=True)
    with args.out.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=['school_id','address','city','state','zip','address_source_url']);w.writeheader();w.writerows(proposed)
    reviewpath=args.out.with_name(args.out.stem+'-review.csv')
    with reviewpath.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=['school_id','registry_name','registry_county','matched_name','match_score','reason','source_url']);w.writeheader();w.writerows(review)
    print(f'Maryland directory entries parsed: {len(listing)}')
    print(f'Already geocoded: {len(done)}; sourced address proposals: {len(proposed)}; review queue: {len(review)}')
    print('Proposals:',args.out,'\nReview:',reviewpath)
    print('This command did not modify the registry. Review matches before geocoding. DC remains separately sourced.')

if __name__=='__main__':main()
