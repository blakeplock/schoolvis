#!/usr/bin/env python3
"""Report every MD/DC school and remaining address work; no network, read-only database."""
import argparse,csv,sqlite3,collections
from pathlib import Path
DB=Path.home()/'.schoolvis'/'schools.sqlite'
def load_csv(p):
    if not p.exists():return {}
    with p.open(newline='',encoding='utf-8-sig') as f:return {r['school_id']:r for r in csv.DictReader(f)}
def main():
    a=argparse.ArgumentParser(description=__doc__);a.add_argument('--db',type=Path,default=DB);a.add_argument('--triage',type=Path,default=Path('data/locations/mdc-review-triaged.csv'));a.add_argument('--output',type=Path,default=Path('data/locations/mdc-all-schools-status.csv'));x=a.parse_args()
    db=sqlite3.connect(f'file:{x.db}?mode=ro',uri=True)
    schools=list(db.execute('SELECT id,name,county FROM schools ORDER BY county,name'))
    location_table=db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='school_locations'").fetchone()
    loc={r[0]:r[1:] for r in db.execute('SELECT school_id,street_address,city,state,postal_code,lat,lon,address_source_url,review_status FROM school_locations')} if location_table else {}
    triage=load_csv(x.triage);rows=[]
    for sid,name,county in schools:
        if sid in loc:
            street,city,state,zip_code,lat,lon,source,review=loc[sid];status='located';action='Inspect campus match before customer release';origin=source
        else:
            t=triage.get(sid,{})
            status='unlocated';origin=t.get('source_url','');street=city=state=zip_code=lat=lon='';review=t.get('triage','')
            action=('DC dataset crosswalk or official school website' if county=='Washington DC' else 'Official school address or reviewed MD directory match')
            if t.get('action'):action+='; '+t['action']
        rows.append(dict(school_id=sid,school_name=name,county=county,status=status,address=street,city=city,state=state,zip=zip_code,latitude=lat,longitude=lon,source_url=origin,review_category=review,next_action=action))
    x.output.parent.mkdir(parents=True,exist_ok=True)
    with x.output.open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    c=collections.Counter((r['status'], 'DC' if r['county']=='Washington DC' else 'MD') for r in rows)
    print('Registry records:',len(rows),'| Located:',sum(r['status']=='located' for r in rows),'| Remaining:',sum(r['status']=='unlocated' for r in rows))
    print('Breakdown:',dict(c));print('Manifest:',x.output)
if __name__=='__main__':main()
