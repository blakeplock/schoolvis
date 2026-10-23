#!/usr/bin/env python3
"""Import independently sourced regional school addresses and Census geocodes.

CSV columns: school_id,address,city,state,zip,address_source_url
No source-backed address => no coordinate. Requires network only for optional --geocode.
"""
import argparse,csv,datetime,json,sqlite3,time,urllib.parse,urllib.request,urllib.error
from pathlib import Path
DB=Path.home()/'.schoolvis'/'schools.sqlite'
def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('csv_file',type=Path)
 p.add_argument('--db',type=Path,default=DB)
 p.add_argument('--geocode',action='store_true',help='Use US Census free geocoder for source-backed addresses')
 args=p.parse_args()
 with args.csv_file.open(newline='',encoding='utf-8-sig') as f: rows=list(csv.DictReader(f))
 if not args.db.exists():
  raise SystemExit('School registry not initialized. Run npm start once before importing locations.')
 db=sqlite3.connect(args.db)
 db.execute('''CREATE TABLE IF NOT EXISTS school_locations (school_id TEXT PRIMARY KEY REFERENCES schools(id),street_address TEXT NOT NULL,city TEXT NOT NULL,state TEXT NOT NULL,postal_code TEXT NOT NULL,lat REAL NOT NULL CHECK(lat BETWEEN -90 AND 90),lon REAL NOT NULL CHECK(lon BETWEEN -180 AND 180),address_source_url TEXT NOT NULL,geocode_source TEXT NOT NULL,geocoded_at TEXT NOT NULL,review_status TEXT NOT NULL DEFAULT 'geocoded_unverified')''')
 added=0;skipped=0
 for row in rows:
  try:
   ident=row['school_id'].strip();street=row['address'].strip();city=row['city'].strip();state=row['state'].strip().upper();zipcode=row['zip'].strip();source=row['address_source_url'].strip()
   if not all([ident,street,city,source]) or state not in ('MD','DC') or not source.startswith('https://') or not db.execute('SELECT 1 FROM schools WHERE id=?',(ident,)).fetchone():raise ValueError('missing source, unknown school, or invalid address')
   if args.geocode:
    params=urllib.parse.urlencode({'street':street,'city':city,'state':state,'zip':zipcode,'benchmark':'Public_AR_Current','format':'json'})
    req=urllib.request.Request('https://geocoding.geo.census.gov/geocoder/locations/address?'+params,headers={'User-Agent':'SchoolVis-geocoder/0.11.6 (https://github.com/blakeplock/schoolvis)'})
    with urllib.request.urlopen(req,timeout=25) as res: data=json.load(res)
    matches=data.get('result',{}).get('addressMatches',[])
    if len(matches)!=1:raise ValueError('No unique Census geocoding match')
    lat=float(matches[0]['coordinates']['y']);lon=float(matches[0]['coordinates']['x']);method='US Census Geocoder'
    time.sleep(.3)
   else:
    lat=float(row['lat']);lon=float(row['lon']);method=row.get('geocode_source','manually supplied').strip() or 'manually supplied'
   if not (37<=lat<=40 and -80<=lon<=-75):raise ValueError('outside MD/DC pilot bounds')
   db.execute('''INSERT INTO school_locations VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(school_id) DO UPDATE SET street_address=excluded.street_address,city=excluded.city,state=excluded.state,postal_code=excluded.postal_code,lat=excluded.lat,lon=excluded.lon,address_source_url=excluded.address_source_url,geocode_source=excluded.geocode_source,geocoded_at=excluded.geocoded_at,review_status=excluded.review_status''',(ident,street,city,state,zipcode,lat,lon,source,method,datetime.datetime.now(datetime.timezone.utc).isoformat(),'geocoded_unverified'))
   db.commit();added+=1
  except urllib.error.HTTPError as exc:
   skipped+=1
   detail=exc.read(500).decode('utf-8',errors='replace').strip()
   print(f'Skipping {row.get("school_id", "unknown")}: Census HTTP {exc.code}: {detail or exc.reason}')
  except (ValueError,KeyError,urllib.error.URLError) as exc:
   skipped+=1;print(f'Skipping {row.get("school_id", "unknown")}: {exc}')
 db.close();print(f'Imported {added} sourced locations; skipped {skipped}. Geocoded addresses are not independently verified.')
if __name__=='__main__':main()
