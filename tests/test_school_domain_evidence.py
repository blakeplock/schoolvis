import importlib.util, pathlib, sqlite3, tempfile, unittest
modpath=pathlib.Path(__file__).resolve().parents[1]/'scripts'/'check-school-domains.py'
spec=importlib.util.spec_from_file_location('school_domains',modpath)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class EvidenceTests(unittest.TestCase):
 def test_rejects_private_and_untrusted(self):
  for url in ['http://school.edu','https://127.0.0.1','https://localhost','https://internal.local','https://name:pw@school.edu','https://school.edu:8080']:
   self.assertFalse(m.public_https(url),url)
 def test_migration_and_report_fields(self):
  with tempfile.TemporaryDirectory() as d:
   con=sqlite3.connect(pathlib.Path(d)/'schools.sqlite');con.execute('CREATE TABLE wikidata_schools (id TEXT PRIMARY KEY, name TEXT, website_candidate TEXT)');m.migrate(con)
   cols={r[1] for r in con.execute('PRAGMA table_info(wikidata_schools)')}
   self.assertTrue(set(m.SCHEMA).issubset(cols));con.close()
 def test_title_name_evidence_not_ownership(self):
  # Validate without network using an injected transport and DNS mocking.
  from unittest.mock import patch
  with patch.object(m,'public_addresses',return_value=['8.8.8.8']):
   s,d,title,url=m.domain_evidence('https://example.org','Gilman School',lambda:(200,'text/html',b'<title>Gilman School | Welcome</title>',''))
   self.assertEqual(s,'name_correlated');self.assertIn('Gilman',title)
if __name__=='__main__':unittest.main()
