#!/usr/bin/env python3
"""Prepare source-attributed AIMS Maryland address matches for human review.

No geocoding, network calls, or database writes. Reference list is the AIMS
2024-25 directory (30 Sep 2024); dated addresses are NOT current verification.
"""
import argparse
import csv
import difflib
import re
import sqlite3
from pathlib import Path

SOURCE = 'https://cdn.ymaws.com/www.aimsmddc.org/resource/resmgr/aimsmembership/new_2024-25_aims_school_dire.pdf'
DB = Path.home() / '.schoolvis' / 'schools.sqlite'
ROOT = Path(__file__).resolve().parent.parent
REFERENCE = ROOT / 'data/locations/aims-2024-25-md-addresses.tsv'
ALIASES = {
    'beth tfiloh dahan community': 'beth tfiloh community dahan',
    'mclean of maryland': 'mclean',
    'naval academy primary': 'naval academy primary secondary',
    'seneca academy and circle': 'seneca academy',
    'holy trinity': 'holy trinity episcopal',
    'st paul s': 'st paul s',
    'sidwell friends lower': 'sidwell friends',
}
STOP = {'the', 'school', 'schools', 'of', 'and', 'inc', 'incorporated', 'maryland'}

def normalize(s):
    s = s.lower().replace('’', "'").replace('&', ' and ')
    s = re.sub(r'\bst[.]?\b', 'saint', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return ' '.join(w for w in s.split() if w not in STOP)

def canonical(s):
    n = normalize(s)
    return ALIASES.get(n, n)

def load_reference(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        records = list(csv.DictReader(f, delimiter='|'))
    for r in records:
        if not all(r.get(k) for k in ('name', 'address', 'city', 'zip')):
            raise ValueError('Malformed source record: ' + str(r))
    return records

def decide(name, entries):
    target = canonical(name)
    scores = []
    for row in entries:
        candidate = canonical(row['name'])
        similarity = difflib.SequenceMatcher(None, target, candidate).ratio()
        exact = target == candidate
        scores.append((1.0 if exact else similarity, row))
    scores.sort(key=lambda v: -v[0])
    if not scores:
        return None, 0, 0, 'missing_reference'
    top, row = scores[0]
    second = scores[1][0] if len(scores) > 1 else 0
    if top == 1.0 and second < 1.0:
        return row, top, second, 'exact_or_reviewed_alias'
    if top >= .94 and top - second >= .12:
        return row, top, second, 'strong_name_match_review_address'
    return row, top, second, 'needs_identity_review'

def plan(schools, located, records):
    proposal, review = [], []
    for sid, name, county in schools:
        if county == 'Washington DC' or sid in located:
            continue
        row, score, runner_up, outcome = decide(name, records)
        if outcome in ('exact_or_reviewed_alias', 'strong_name_match_review_address'):
            proposal.append(dict(school_id=sid, address=row['address'], city=row['city'], state='MD', zip=row['zip'][:5], address_source_url=SOURCE))
        else:
            review.append(dict(school_id=sid, school_name=name, reason=outcome,
                               proposed_name=row['name'] if row else '', confidence=f'{score:.3f}',
                               runner_up=f'{runner_up:.3f}', proposed_address=row['address'] if row else '',
                               source_url=SOURCE))
    return proposal, review

def save_csv(path, rows, fields):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader();writer.writerows(rows)

def main():
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument('--db', type=Path, default=DB)
    a.add_argument('--source', type=Path, default=REFERENCE)
    a.add_argument('--output', type=Path, default=Path('data/locations/md-aims-address-proposals.csv'))
    x = a.parse_args()
    entries = load_reference(x.source)
    uri = x.db.expanduser().resolve().as_uri() + '?mode=ro'
    db = sqlite3.connect(uri, uri=True)
    try:
        schools = list(db.execute('SELECT id,name,county FROM schools ORDER BY name'))
        has = db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='school_locations'").fetchone()
        located = {r[0] for r in db.execute('SELECT school_id FROM school_locations')} if has else set()
    finally:
        db.close()
    proposal, review = plan(schools, located, entries)
    save_csv(x.output, proposal, ['school_id', 'address', 'city', 'state', 'zip', 'address_source_url'])
    review_file = x.output.with_name(x.output.stem + '-review.csv')
    save_csv(review_file, review, ['school_id','school_name','reason','proposed_name','confidence','runner_up','proposed_address','source_url'])
    md = sum(c != 'Washington DC' for _,_,c in schools)
    print(f'Maryland registry: {md}; previously located across MD/DC: {len(located)}; AIMS reference records: {len(entries)}')
    print(f'New source-backed address proposals: {len(proposal)}; manual review: {len(review)}')
    print('Proposals:', x.output, '\nReview:', review_file)
    print('No database changes. AIMS source snapshot dated September 2024; independently confirm campus changes before applying.')

if __name__ == '__main__':
    main()
