#!/usr/bin/env python3
"""Enrich existing CC0 Wikidata candidate schools, without erasing local data.

Reads only QIDs already in the local index. Wikidata claims are evidence, not verification
of school operation, private-school status, location, or website ownership.
"""
import argparse
import datetime as dt
import json
import re
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

DB = Path.home() / '.schoolvis' / 'schools.sqlite'
API = 'https://www.wikidata.org/w/api.php'
UA = 'SchoolVis/0.11.2 (Wikidata CC0 candidate enrichment; https://github.com/blakeplock/schoolvis)'
QID = re.compile(r'^Q[1-9][0-9]*$')
COLUMNS = {
    'city_source': "TEXT NOT NULL DEFAULT ''",
    'state_source': "TEXT NOT NULL DEFAULT 'category_inference'",
    'identity_status': "TEXT NOT NULL DEFAULT 'unreviewed'",
    'identity_flags': "TEXT NOT NULL DEFAULT '[]'",
    'location_claims': "TEXT NOT NULL DEFAULT '[]'",
    'website_source': "TEXT NOT NULL DEFAULT ''",
    'enriched_at': "TEXT NOT NULL DEFAULT ''",
}

def statements(entity, prop):
    for stmt in entity.get('claims', {}).get(prop, []):
        if stmt.get('rank') == 'deprecated':
            continue
        val = stmt.get('mainsnak', {}).get('datavalue', {}).get('value')
        if val is not None:
            yield val

def claim_ids(entity, prop):
    return sorted({v['id'] for v in statements(entity, prop)
                   if isinstance(v, dict) and QID.fullmatch(v.get('id', ''))})

def fetch_entities(ids, delay=1.0, opener=urllib.request.urlopen):
    params = {'action': 'wbgetentities', 'format': 'json', 'ids': '|'.join(ids),
              'props': 'labels|claims', 'languages': 'en'}
    req = urllib.request.Request(API + '?' + urllib.parse.urlencode(params),
                                 headers={'User-Agent': UA, 'Accept': 'application/json'})
    for attempt in range(6):
        try:
            with opener(req, timeout=35) as response:
                result = json.loads(response.read(10_000_000))['entities']
            time.sleep(delay)
            return result
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 5:
                raise
            retry = exc.headers.get('Retry-After', '') if exc.headers else ''
            wait = min(90, max(2 ** (attempt + 1), float(retry) if retry.isdigit() else 0))
            print(f'Wikidata HTTP {exc.code}: waiting {wait:.0f}s', flush=True)
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError):
            if attempt == 5:
                raise
            time.sleep(2 ** (attempt + 1))

def label(entity):
    return entity.get('labels', {}).get('en', {}).get('value', '').strip()

def assess(entity, inherited_state, places):
    """Conservative signals: never label a candidate as confirmed private/operating."""
    flags = []
    types = claim_ids(entity, 'P31')
    if not types:
        flags.append('institution_type_not_stated')
    if claim_ids(entity, 'P576') or list(statements(entity, 'P576')):
        flags.append('dissolution_date_present')
    location_ids = claim_ids(entity, 'P131') + claim_ids(entity, 'P159')
    location_ids = list(dict.fromkeys(location_ids))
    names = [places[q]['label'] for q in location_ids if places.get(q, {}).get('label')]
    city = ''
    # Only direct P131 location values explicitly typed as a city/town/village.
    # A county, state, or administrative district is not a verified city.
    municipality_types = {'Q515', 'Q3957', 'Q532', 'Q1549591', 'Q1093829'}
    for q in claim_ids(entity, 'P131'):
        place = places.get(q, {})
        if municipality_types.intersection(place.get('types', [])) and place.get('label'):
            city = place['label'][:120]
            break
    if inherited_state:
        flags.append('state_derived_from_category')
    if not location_ids:
        flags.append('location_claim_missing')
    if not list(statements(entity, 'P856')):
        flags.append('official_website_claim_missing')
    if not types:
        status = 'needs_review'
    elif 'dissolution_date_present' in flags:
        status = 'possible_historical'
    else:
        status = 'candidate_unverified'
    return status, flags, names, city

def migrate(db):
    columns = {r[1] for r in db.execute('PRAGMA table_info(wikidata_schools)')}
    if not columns:
        raise SystemExit('No wikidata_schools table. Run scripts/import-wikidata.py first.')
    with db:
        for name, definition in COLUMNS.items():
            if name not in columns:
                db.execute(f'ALTER TABLE wikidata_schools ADD COLUMN {name} {definition}')

def enrich(dbfile, delay=1.0, batch_size=35, fetch=fetch_entities):
    db = sqlite3.connect(dbfile)
    db.row_factory = sqlite3.Row
    try:
        migrate(db)
        records = db.execute('SELECT id, state, city, website_candidate, website_status FROM wikidata_schools ORDER BY id').fetchall()
        if not records:
            raise SystemExit('No Wikidata candidates to enrich.')
        stats = Counter()
        stamp = dt.datetime.now(dt.timezone.utc).isoformat()
        for offset in range(0, len(records), batch_size):
            batch = records[offset:offset + batch_size]
            entities = fetch([r['id'] for r in batch], delay)
            place_ids = set()
            for item in entities.values():
                place_ids.update(claim_ids(item, 'P131'))
                place_ids.update(claim_ids(item, 'P159'))
            places = {}
            # Labels of location items provide evidence, not verified city/state boundaries.
            for index in range(0, len(place_ids), 45):
                ids = sorted(place_ids)[index:index + 45]
                found = fetch(ids, delay)
                places.update({qid: {'label': label(item), 'types': claim_ids(item, 'P31')} for qid, item in found.items()})
            updates = []
            for r in batch:
                qid = r['id']
                entity = entities.get(qid)
                if not entity or entity.get('missing'):
                    stats['missing_entity'] += 1
                    continue
                status, flags, locations, city = assess(entity, r['state'], places)
                websites = [v for v in statements(entity, 'P856') if isinstance(v, str) and v.startswith('https://') and len(v) <= 2048]
                # Preserve existing claims when Wikidata now has no current P856 claim.
                site = websites[0] if websites else r['website_candidate'] or ''
                site_status = r['website_status'] if r['website_status'] == 'verified' and site == r['website_candidate'] else 'unverified'
                updates.append((status, json.dumps(flags), json.dumps(locations),
                                'wikidata:P856' if websites else '', site, site_status,
                                city or r['city'], 'wikidata:P131' if city else '', stamp, qid))
                stats[status] += 1
                if site:
                    stats['website_candidate'] += 1
                if locations:
                    stats['location_claim'] += 1
                if city:
                    stats['city_from_typed_location'] += 1
            with db:
                db.executemany('''UPDATE wikidata_schools SET identity_status=?, identity_flags=?,
                    location_claims=?, website_source=?, website_candidate=?, website_status=?, city=?, city_source=?, enriched_at=?
                    WHERE id=?''', updates)
            print(f'Enriched {min(offset + batch_size, len(records))}/{len(records)}', flush=True)
        return stats
    finally:
        db.close()

def report(dbfile):
    db = sqlite3.connect(dbfile)
    try:
        rows = db.execute('''SELECT identity_status, identity_flags, city, state, website_candidate,
                                    website_status, location_claims FROM wikidata_schools''').fetchall()
        print(f'Total candidates: {len(rows)}')
        print(f'Website candidates: {sum(bool(r[4]) for r in rows)} (NOT domain-verified)')
        print(f'Explicit location claims: {sum(r[6] not in ("", "[]", None) for r in rows)}')
        print(f'Verified cities: {sum(bool(r[2]) for r in rows)}')
        print(f'Category-inferred states: {sum(bool(r[3]) for r in rows)}')
        for status, count in Counter(r[0] for r in rows).most_common():
            print(f'{status}: {count}')
        print('No school is automatically classified as verified private, currently operating, or website-owned.')
    finally:
        db.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, default=DB)
    parser.add_argument('--delay', type=float, default=1.0)
    parser.add_argument('--batch-size', type=int, default=35)
    parser.add_argument('--report-only', action='store_true')
    args = parser.parse_args()
    if not 0.25 <= args.delay <= 10 or not 1 <= args.batch_size <= 45:
        parser.error('Invalid bounded requests settings')
    if args.report_only:
        report(args.db.expanduser())
    else:
        result = enrich(args.db.expanduser(), args.delay, args.batch_size)
        print('Enrichment finished:', dict(result))
        report(args.db.expanduser())
