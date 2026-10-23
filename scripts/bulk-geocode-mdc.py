#!/usr/bin/env python3
"""Batch geocode sourced SchoolVis MD/DC addresses via the US Census Geocoder.

Dry-run by default; --apply writes unique matches, never overwrites existing rows.
Requires only Python stdlib; no Google API and no AI services.
"""
import argparse
import csv
import datetime
import io
import json
import urllib.parse
import secrets
import sqlite3
import urllib.error
import urllib.request
from pathlib import Path

DB = Path.home() / '.schoolvis' / 'schools.sqlite'
ENDPOINT = 'https://geocoding.geo.census.gov/geocoder/locations/addressbatch'
FIELDS = ('school_id', 'address', 'city', 'state', 'zip', 'address_source_url')
SINGLE_ENDPOINT = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress'



def load_inputs(paths):
    combined = {}
    conflicts = []
    for path in paths:
        with path.open(newline='', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            if not set(FIELDS).issubset(reader.fieldnames or []):
                raise ValueError(f'{path}: expected {FIELDS}')
            for raw in reader:
                row = {key: (raw.get(key) or '').strip() for key in FIELDS}
                key = row['school_id']
                if not key or not row['address'] or not row['city'] or row['state'].upper() not in ('MD', 'DC') or not row['address_source_url'].startswith('https://'):
                    conflicts.append((key, 'invalid or unsourced input'))
                    continue
                row['state'] = row['state'].upper()
                if key in combined and combined[key] != row:
                    conflicts.append((key, 'conflicting addresses across input files'))
                    combined.pop(key)
                    continue
                if not any(c[0] == key for c in conflicts):
                    combined[key] = row
    return combined, conflicts


def census_batch(rows, timeout=120, raw_output=None):
    stream = io.StringIO(newline='')
    writer = csv.writer(stream, lineterminator='\r\n')
    for row in rows:
        writer.writerow([row['school_id'], row['address'], row['city'], row['state'], row['zip']])
    boundary = 'schoolvis-' + secrets.token_hex(14)
    def field(name, value):
        return (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n').encode()
    body = field('benchmark', 'Public_AR_Current')
    body += (f'--{boundary}\r\nContent-Disposition: form-data; name="addressFile"; filename="addresses.csv"\r\nContent-Type: text/csv\r\n\r\n').encode()
    body += stream.getvalue().encode('utf-8') + b'\r\n' + (f'--{boundary}--\r\n').encode()
    req = urllib.request.Request(ENDPOINT, data=body, headers={
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'User-Agent': 'SchoolVis-mdc-batch/0.11.7 (https://github.com/blakeplock/schoolvis)',
        'Accept': 'text/csv',
    }, method='POST')
    with urllib.request.urlopen(req, timeout=timeout) as res:
        content = res.read(5_000_000).decode('utf-8-sig', 'replace')
    if raw_output is not None:
        raw_output.parent.mkdir(parents=True, exist_ok=True)
        raw_output.write_text(content, encoding='utf-8')
    results = {}
    for parts in csv.reader(io.StringIO(content)):
        if not parts:
            continue
        sid = parts[0].strip()
        if len(parts) < 6:
            if sid:
                results[sid] = ('review', 'short Census response row (' + str(len(parts)) + ' columns)', '', '')
            continue
        sid, _, matched, _, matched_address, coordinates = (x.strip() for x in parts[:6])
        if sid in results:
            results[sid] = ('review', 'duplicate geocoder response', '', '')
        elif matched.upper() != 'MATCH' or not coordinates:
            results[sid] = ('review', 'Census no match', '', '')
        else:
            try:
                lon, lat = map(float, coordinates.split(','))
                if not (37 <= lat <= 40 and -80 <= lon <= -75):
                    raise ValueError('coordinates outside MD/DC pilot bounds')
                results[sid] = ('matched', matched_address, lat, lon)
            except (ValueError, TypeError):
                results[sid] = ('review', 'invalid coordinate response', '', '')
    return results


def census_single(row, timeout=30):
    address = ', '.join(filter(None, [row['address'], row['city'], row['state'], row['zip']]))
    url = SINGLE_ENDPOINT + '?' + urllib.parse.urlencode({'address':address,'benchmark':'Public_AR_Current','format':'json'})
    req = urllib.request.Request(url, headers={'User-Agent':'SchoolVis-mdc-exceptions/0.11.8 (https://github.com/blakeplock/schoolvis)','Accept':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=timeout) as res:
            payload=json.loads(res.read(2_000_000))
    except (urllib.error.URLError,TimeoutError,ValueError) as exc:
        return ('review','single-address request failed: '+str(exc),'','')
    matches = payload.get('result',{}).get('addressMatches',[])
    if len(matches)!=1:
        return ('review', 'single-address '+ ('no match' if not matches else 'ambiguous matches'), '', '')
    match=matches[0]
    try:
        lat=float(match['coordinates']['y']);lon=float(match['coordinates']['x'])
        if not (37 <= lat <= 40 and -80 <= lon <= -75):
            raise ValueError('outside MD/DC bounds')
    except (ValueError,KeyError,TypeError) as exc:
        return ('review','single-address invalid coordinates: '+str(exc),'','')
    return ('matched',str(match.get('matchedAddress','Census single-address match')),lat,lon)


def run(paths, dbpath, apply, output, batch_size=100, retry_single=True, raw_dir=None):
    inputs, conflicts = load_inputs(paths)
    if not dbpath.exists():
        raise ValueError(f'No registry database found: {dbpath}')
    db = sqlite3.connect(dbpath)
    try:
        if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schools'").fetchone():
            raise ValueError('School registry must first be initialized with npm start')
        has_locations = bool(db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='school_locations'").fetchone())
        existing = {r[0] for r in db.execute('SELECT school_id FROM school_locations')} if has_locations else set()
        known = {r[0] for r in db.execute('SELECT id FROM schools')}
        review = [{'school_id': sid, 'reason': reason, 'address': ''} for sid, reason in conflicts]
        todo = []
        for sid, row in inputs.items():
            if sid not in known:
                review.append({'school_id': sid, 'reason': 'school ID absent from local registry', 'address': row['address']})
            elif sid not in existing:
                todo.append(row)
        print(f'Source-backed rows: {len(inputs)}; already located: {len(inputs) - len(todo) - sum(1 for s in inputs if s not in known)}; new geocode candidates: {len(todo)}; input conflicts: {len(conflicts)}')
        matches = []
        for offset in range(0, len(todo), batch_size):
            batch = todo[offset:offset+batch_size]
            print(f'Census batch: {offset + 1}-{offset + len(batch)} / {len(todo)}', flush=True)
            try:
                raw_path = raw_dir / f"census-batch-{offset//batch_size+1}.csv" if raw_dir else None
                response = census_batch(batch, raw_output=raw_path)
            except (urllib.error.URLError, TimeoutError) as exc:
                for item in batch:
                    review.append({'school_id': item['school_id'], 'reason': f'batch request failed: {exc}', 'address': item['address']})
                continue
            for item in batch:
                state, detail, lat, lon = response.get(item['school_id'], ('review', 'no response row returned', '', ''))
                if state != 'matched' and retry_single and (detail in ('no response row returned', 'Census no match') or detail.startswith('short Census response row')):
                    state, detail, lat, lon = census_single(item)
                    print(f"Single-address retry: {item['school_id']} -> {state}: {detail}", flush=True)
                if state != 'matched':
                    review.append({'school_id': item['school_id'], 'reason': detail, 'address': item['address']})
                else:
                    matches.append((item, lat, lon, detail))
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open('w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['school_id', 'reason', 'address'])
            writer.writeheader()
            writer.writerows(review)
        if apply and matches:
            with db:
                db.execute('''CREATE TABLE IF NOT EXISTS school_locations (school_id TEXT PRIMARY KEY REFERENCES schools(id),street_address TEXT NOT NULL,city TEXT NOT NULL,state TEXT NOT NULL,postal_code TEXT NOT NULL,lat REAL NOT NULL CHECK(lat BETWEEN -90 AND 90),lon REAL NOT NULL CHECK(lon BETWEEN -180 AND 180),address_source_url TEXT NOT NULL,geocode_source TEXT NOT NULL,geocoded_at TEXT NOT NULL,review_status TEXT NOT NULL DEFAULT 'geocoded_unverified')''')
                now = datetime.datetime.now(datetime.timezone.utc).isoformat()
                db.executemany('''INSERT OR IGNORE INTO school_locations(school_id,street_address,city,state,postal_code,lat,lon,address_source_url,geocode_source,geocoded_at,review_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)''', [(r['school_id'],r['address'],r['city'],r['state'],r['zip'],lat,lon,r['address_source_url'],'US Census batch geocoder',now,'geocoded_unverified') for r,lat,lon,_ in matches])
        print(f'Census coordinate matches: {len(matches)}; needs review: {len(review)}; mode: {"APPLIED" if apply else "DRY RUN"}')
        print(f'Review CSV: {output}')
    finally:
        db.close()


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('csv_files', nargs='+', type=Path)
    p.add_argument('--db', default=DB, type=Path)
    p.add_argument('--apply', action='store_true', help='Write Census matches, preserving already located schools')
    p.add_argument('--batch-size', type=int, default=100)
    p.add_argument('--no-single-retry', action='store_true', help='Disable second-pass single address geocoding')
    p.add_argument('--raw-dir', type=Path, default=Path('data/locations/census-raw'), help='Save raw Census batch responses for diagnosis')
    p.add_argument('--review-output', type=Path, default=Path('data/locations/bulk-geocode-review.csv'))
    args = p.parse_args()
    if not 1 <= args.batch_size <= 500:
        p.error('Batch size must be 1-500')
    try:
        run(args.csv_files, args.db, args.apply, args.review_output, args.batch_size, not args.no_single_retry, args.raw_dir)
    except ValueError as exc:
        p.error(str(exc))
