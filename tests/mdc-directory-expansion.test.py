import importlib.util
from pathlib import Path
import unittest
p=Path(__file__).resolve().parents[1]/'scripts'/'expand-mdc-locations.py'
spec=importlib.util.spec_from_file_location('expansion',p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class TestDirectory(unittest.TestCase):
 def test_structured_state_table(self):
  page='''<table><tr><th>Advanced Link Number</th><th>School Name and Classification</th><th>County</th><th>Address</th><th>Phone</th></tr><tr><td>09-15-2010</td><td>Academy of the Holy Cross<br>Grades 9 through 12</td><td>Montgomery</td><td>4920 Strathmore Avenue<br>Kensington 20895</td><td>301-222</td></tr></table>'''
  rec=list(m.extract(page));self.assertEqual(len(rec),1);self.assertEqual(rec[0]['city'],'Kensington');self.assertEqual(rec[0]['address'],'4920 Strathmore Avenue')
 def test_conservative_alias_review(self):
  self.assertGreaterEqual(m.score('Academy of the Holy Cross','Academy of the Holy Cross'),.99)
  self.assertNotEqual(m.normalize('St. Paul\'s Schools'),m.normalize('St. James Academy'))
 def test_county_match(self):
  self.assertEqual(m.county_key('Baltimore County'),m.county_key('Baltimore'))
  self.assertNotEqual(m.county_key('Baltimore City'),m.county_key('Baltimore'))
if __name__=='__main__':unittest.main()
