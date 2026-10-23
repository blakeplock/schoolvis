"""Run via python3 -m unittest discover -s tests -p '*enrichment.test.py'."""
import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[1]/'scripts'/'enrich-wikidata.py'
spec=importlib.util.spec_from_file_location('wikidata_enrich',SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class EnrichmentTest(unittest.TestCase):
    def test_migration_and_enrichment_are_additive(self):
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/'schools.sqlite'
            conn=sqlite3.connect(file)
            conn.execute('CREATE TABLE wikidata_schools (id TEXT PRIMARY KEY, name TEXT, city TEXT, state TEXT, zip TEXT, website_candidate TEXT, website_status TEXT, source_url TEXT, statement_source TEXT, retrieved_at TEXT, rights TEXT, provider TEXT)')
            conn.execute("INSERT INTO wikidata_schools VALUES ('Q123','School Test','','MD','','','unverified','https://www.wikidata.org/wiki/Q123','','','CC0-1.0','Wikidata')")
            conn.execute('CREATE TABLE untouched_records (id INTEGER PRIMARY KEY)')
            conn.execute('INSERT INTO untouched_records VALUES (1)')
            conn.commit();conn.close()
            def fetch(ids, delay):
                if ids==['Q123']:
                    return {'Q123':{'claims':{'P31':[{'mainsnak':{'datavalue':{'value':{'id':'Q398141'}}}}], 'P131':[{'mainsnak':{'datavalue':{'value':{'id':'Q987'}}}}], 'P856':[{'mainsnak':{'datavalue':{'value':'https://example.edu/'}}}]}}}
                return {'Q987':{'labels':{'en':{'value':'Sample City'}},'claims':{'P31':[{'mainsnak':{'datavalue':{'value':{'id':'Q515'}}}}]}}}
            stats=mod.enrich(file,0.25,35,fetch)
            self.assertEqual(stats['city_from_typed_location'],1)
            conn=sqlite3.connect(file)
            row=conn.execute('SELECT city,city_source,website_candidate,website_status,identity_status,location_claims FROM wikidata_schools').fetchone()
            self.assertEqual(row[0],'Sample City')
            self.assertEqual(row[1],'wikidata:P131')
            self.assertEqual(row[2],'https://example.edu/')
            self.assertEqual(row[3],'unverified')
            self.assertEqual(row[4],'candidate_unverified')
            self.assertEqual(conn.execute('SELECT count(*) FROM untouched_records').fetchone()[0],1)
            conn.close()
if __name__=='__main__':unittest.main()
