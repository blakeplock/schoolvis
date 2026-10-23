#!/usr/bin/env python3
"""Import the NCES 2023-24 PSS public-use CSV or its ZIP into the local SchoolVis registry.
No third-party packages, no network requests, no changes to existing Maryland/DC records.
"""
import csv, io, os, sqlite3, sys, zipfile
from pathlib import Path

DB = Path.home()/'.schoolvis'/'schools.sqlite'
SOURCE = 'https://nces.ed.gov/surveys/pss/pssdata.asp'

def key(s): return ''.join(ch.lower() for ch in s if ch.isalnum())
def choose(fields, *aliases):
    indexes={key(f):f for f in fields}
    for a in aliases:
        if key(a) in indexes:return indexes[key(a)]
    return None

def candidates(path):
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as z:
            members=[m for m in z.infolist() if m.filename.lower().endswith(('.csv','.txt')) and m.file_size<150_000_000]
            for m in sorted(members,key=lambda x:-x.file_size):
                if m.file_size > 0:
                    yield m.filename, io.StringIO(z.read(m).decode('utf-8-sig', errors='replace'))
    else:
        with open(path,encoding='utf-8-sig',errors='replace',newline='') as f:yield path.name,f

def read_records(reader):
    fields=reader.fieldnames or []
    name=choose(fields,'pname','schname','schoolname','school_name','school name','name')
    pin=choose(fields,'pin','ppin','psspin','permanent identification number')
    ident=choose(fields,'ppin','pin','psu','ncesid','nces_id','schoolid','school_id')
    city=choose(fields,'pcity','city','cityname','schoolcity')
    state=choose(fields,'pstabb','state','stateabbr','state_abbr','pstate')
    zipcode=choose(fields,'pzip','zip','zipcode','zipcode5','zip_code')
    if not all((name,ident,city,state)):
        raise ValueError('Cannot recognize NCES fields. Found: '+', '.join(fields[:35])+'. Required: name, ID/PIN, city, state. Check the 2023-24 PSS CSV layout.')
    out=[]
    for r in reader:
        n=(r.get(name) or '').strip();i=(r.get(ident) or '').strip();s=(r.get(state) or '').strip().upper()
        if not n or not i or len(n)>220 or len(i)>40 or len(s)!=2:continue
        out.append((i,n,(r.get(city) or '').strip()[:120],s,(r.get(zipcode) or '').strip()[:12] if zipcode else '',(r.get(pin) or '').strip()[:40] if pin else None))
    return out

def main():
    if len(sys.argv)!=2:raise SystemExit('Usage: python3 scripts/import-nces.py ~/Downloads/<NCES_2023-24_text_file.zip>')
    src=Path(sys.argv[1]).expanduser()
    if not src.is_file() or src.stat().st_size>200_000_000:raise SystemExit('Expected an NCES CSV or ZIP file smaller than 200 MB')
    records=None;errors=[]
    for filename,f in candidates(src):
        try:
            sample=f.readline();f.seek(0)
            dialect=csv.excel_tab if sample.count('\t')>sample.count(',') else csv.excel
            r=read_records(csv.DictReader(f,dialect=dialect))
            if len(r)>1000:records=r;print('Using:',filename);break
            errors.append(f'{filename}: only {len(r)} eligible rows')
        except Exception as e:errors.append(f'{filename}: {e}')
        finally:f.close()
    if not records:raise SystemExit('No valid nationwide PSS CSV found. '+ ' | '.join(errors[:3]))
    DB.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    con=sqlite3.connect(DB)
    try:
        con.execute("""CREATE TABLE IF NOT EXISTS national_schools (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL,
        zip TEXT, pin TEXT, survey TEXT NOT NULL, source_url TEXT NOT NULL)""")
        con.execute('CREATE INDEX IF NOT EXISTS national_name_idx ON national_schools(name)')
        con.execute('CREATE INDEX IF NOT EXISTS national_state_idx ON national_schools(state)')
        with con:
            con.execute('DELETE FROM national_schools WHERE survey=?',('2023-24',))
            con.executemany('INSERT OR REPLACE INTO national_schools VALUES (?,?,?,?,?,?,?,?)',( (i,n,c,s,z,pin,'2023-24',SOURCE) for i,n,c,s,z,pin in records))
        print(f'Imported {len(records):,} NCES school records into {DB}')
        print('Official websites are NOT inferred from NCES records.')
    finally:con.close()
if __name__=='__main__':main()
