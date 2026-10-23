#!/usr/bin/env python3
"""Resolve four Baltimore-area campuses from CC0 Wikidata coordinates (P625).

Published street addresses are retained from school-controlled pages. Wikipedia
article titles are transient identity lookup keys only: no Wikipedia text/data is
stored or redistributed. Rejects ambiguous/missing/out-of-area coordinates.
Existing locations and audit data are never deleted.
"""
import argparse
import datetime as dt
import json
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_DB = Path.home() / '.schoolvis' / 'schools.sqlite'
API = 'https://www.wikidata.org/w/api.php'
UA = 'SchoolVis-MD-DC/0.11.6 (educational school directory; https://github.com/blakeplock/schoolvis)'
# Addresses independently published by the schools. Wikipedia article titles are
# used solely as Wikidata entity resolution keys, and never persisted.
SCHOOLS = [
    dict(id='mdc-mcdonogh-school-baltimore-county', name='McDonogh School',
         title='McDonogh School', address='8600 McDonogh Road', city='Owings Mills', state='MD', zip='21117',
         source='https://www.mcdonogh.org/about/campus-facilities/directions-parking',
         qid='Q6800971'),
    dict(id='mdc-loyola-blakefield-baltimore-county', name='Loyola Blakefield',
         title='Loyola Blakefield', address='500 Chestnut Avenue', city='Towson', state='MD', zip='21204',
         source='https://www.loyolablakefield.org/', qid='Q6694537'),
    dict(id='mdc-park-school-of-baltimore-baltimore-county', name='Park School of Baltimore',
         title='Park School of Baltimore', address='2425 Old Court Road', city='Baltimore', state='MD', zip='21208',
         source='https://parkschool.net/about/directions/', qid=None),
    dict(id='mdc-st-paul-s-schools-baltimore-county', name="The St. Paul's Schools",
         title="St. Paul's School (Brooklandville, Maryland)", address='11152 Falls Road', city='Brooklandville',
         state='MD', zip='21022', source='https://www.stpaulsmd.org/contact-us', qid=None),
]

def fetch(params, delay=1):
    query = dict(action='wbgetentities', format='json', **params)
    url = API + '?' + urllib.parse.urlencode(query)
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.load(resp)
            time.sleep(delay)
            return data
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 4:
                raise
            retry_after = exc.headers.get('Retry-After', '')
            wait = float(retry_after) if retry_after.isdecimal() else min(60, 2 ** (attempt + 2))
            print(f'Wikidata HTTP {exc.code}, waiting {wait:g}s', flush=True)
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError):
            if attempt == 4:
                raise
            time.sleep(min(60, 2 ** (attempt + 2)))
    raise RuntimeError('Could not contact Wikidata')

def coordinates(entity):
    out = []
    for claim in entity.get('claims', {}).get('P625', []):
        if claim.get('rank') == 'deprecated':
            continue
        v = claim.get('mainsnak', {}).get('datavalue', {}).get('value', {})
        if isinstance(v, dict) and v.get('globe', '').endswith('/Q2'):
            try:
                lat, lon = float(v['latitude']), float(v['longitude'])
                if 39.0 <= lat <= 39.8 and -77.2 <= lon <= -76.2:
                    out.append((lat, lon))
            except (KeyError, ValueError, TypeError):
                pass
    unique = {(round(lat, 5), round(lon, 5)) for lat, lon in out}
    return next(iter(unique)) if len(unique) == 1 else None

def resolve(s):
    if s['qid']:
        data = fetch({'ids': s['qid'], 'props': 'claims|labels|sitelinks', 'languages': 'en'})
    else:
        data = fetch({'sites': 'enwiki', 'titles': s['title'], 'props': 'claims|labels|sitelinks', 'languages': 'en'})
    entities = [e for e in data.get('entities', {}).values() if not e.get('missing')]
    if len(entities) != 1:
        return None, 'No unique Wikidata entity'
    e = entities[0]
    label = e.get('labels', {}).get('en', {}).get('value', '')
    qid = e.get('id', '')
    if not label or not qid.startswith('Q'):
        return None, 'Wikidata label or QID unavailable'
    # Identity guard: use exact QIDs for first two; require school-specific tokens
    # for resolved page titles, to prevent accidentally matching a namesake.
    if not s['qid'] and not any(t in label.lower() for t in ('park school', "st. paul", 'st paul')):
        return None, f'Unexpected Wikidata identity {qid} ({label})'
    coord = coordinates(e)
    if coord is None:
        return None, f'No single usable Baltimore-area Wikidata coordinate on {qid} ({label})'
    return (qid, *coord), None

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--db', type=Path, default=DEFAULT_DB)
    p.add_argument('--dry-run', action='store_true')
    args = p.parse_args()
    if not args.db.is_file():
        raise SystemExit(f'No SchoolVis database at {args.db}. Run npm start first.')
    db = sqlite3.connect(args.db)
    db.row_factory = sqlite3.Row
    try:
        if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schools'").fetchone():
            raise SystemExit('SchoolVis regional schools table missing.')
        if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='school_locations'").fetchone():
            raise SystemExit('school_locations table missing. Run the Baltimore starter import first.')
        inserted = 0
        for s in SCHOOLS:
            if not db.execute('SELECT 1 FROM schools WHERE id=?', (s['id'],)).fetchone():
                print(f"SKIP {s['name']}: registry ID absent")
                continue
            if db.execute('SELECT 1 FROM school_locations WHERE school_id=?', (s['id'],)).fetchone():
                print(f"KEEP {s['name']}: already has coordinates")
                continue
            try:
                result, error = resolve(s)
                if error:
                    print(f"REVIEW {s['name']}: {error}")
                    continue
                qid, lat, lon = result
                print(f"FOUND {s['name']}: {lat:.5f}, {lon:.5f} ({qid})")
                if args.dry_run:
                    continue
                db.execute('''INSERT INTO school_locations
                  (school_id,street_address,city,state,postal_code,lat,lon,address_source_url,geocode_source,geocoded_at,review_status)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
                    (s['id'],s['address'],s['city'],s['state'],s['zip'],lat,lon,s['source'],
                     'Wikidata CC0 coordinate claim P625: https://www.wikidata.org/wiki/'+qid,
                     dt.datetime.now(dt.timezone.utc).isoformat(),'coordinate_candidate_unverified'))
                db.commit()
                inserted += 1
            except (urllib.error.URLError, TimeoutError, ValueError, sqlite3.Error) as exc:
                print(f"REVIEW {s['name']}: {exc}")
        print(f'Added {inserted} coordinates. Existing locations preserved. Remaining schools require manual coordinate review.')
    finally:
        db.close()

if __name__ == '__main__':
    main()
