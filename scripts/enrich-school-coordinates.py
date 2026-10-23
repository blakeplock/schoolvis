#!/usr/bin/env python3
"""Retrieve Wikidata P625 coordinates for existing MD/DC candidate school QIDs.
Only explicit P625 coordinates on the institution item are accepted. CC0 data.
No location is inferred from city/category and no old observations are deleted.
"""
import argparse
import datetime as dt
import json
import sqlite3
from pathlib import Path
from importlib.machinery import SourceFileLoader

CORE = SourceFileLoader('school_wikidata_enrich',str(Path(__file__).with_name('enrich-wikidata.py'))).load_module()
DB = Path.home()/'.schoolvis'/'schools.sqlite'

def coordinates(entity):
    for value in CORE.statements(entity,'P625'):
        if not isinstance(value,dict) or value.get('globe') not in (None,'http://www.wikidata.org/entity/Q2'):
            continue
        lat,lon=value.get('latitude'),value.get('longitude')
        if isinstance(lat,(float,int)) and isinstance(lon,(float,int)) and -90<=lat<=90 and -180<=lon<=180:
            return (lat,lon)
    return None

def run(dbfile,delay=1.0):
    db=sqlite3.connect(dbfile)
    try:
        cols={row[1] for row in db.execute('PRAGMA table_info(wikidata_schools)')}
        if not cols:raise SystemExit('First run import-wikidata.py')
        for column,definition in [('latitude','REAL'),('longitude','REAL'),('coordinate_source',"TEXT NOT NULL DEFAULT ''"),('coordinates_at',"TEXT NOT NULL DEFAULT ''")]:
            if column not in cols:db.execute(f'ALTER TABLE wikidata_schools ADD COLUMN {column} {definition}')
        db.commit()
        rows=db.execute("SELECT id FROM wikidata_schools WHERE state IN ('MD','DC') ORDER BY id").fetchall()
        stamp=dt.datetime.now(dt.timezone.utc).isoformat()
        found=0
        for i in range(0,len(rows),35):
            ids=[r[0] for r in rows[i:i+35]]
            data=CORE.fetch_entities(ids,delay)
            updates=[]
            for qid in ids:
                loc=coordinates(data.get(qid,{}))
                if loc:found+=1
                updates.append((loc[0] if loc else None,loc[1] if loc else None,'wikidata:P625' if loc else '',stamp,qid))
            with db:
                db.executemany('UPDATE wikidata_schools SET latitude=?,longitude=?,coordinate_source=?,coordinates_at=? WHERE id=?',updates)
            print(f'Coordinate lookup: {min(i+35,len(rows))}/{len(rows)} MD/DC candidates',flush=True)
        print(f'MD/DC candidates: {len(rows)}; explicit school coordinates: {found}; missing: {len(rows)-found}')
        print('These are Wikidata coordinate claims, not independently verified campuses or enrollment competitors.')
    finally:db.close()

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--db',type=Path,default=DB)
    p.add_argument('--delay',type=float,default=1.0)
    a=p.parse_args()
    if not 0.25<=a.delay<=10:p.error('Delay must be 0.25 to 10 seconds')
    run(a.db.expanduser(),a.delay)
