import importlib.util
import pathlib
import unittest
from unittest.mock import patch
import io

src=pathlib.Path(__file__).resolve().parents[1]/'scripts'/'bulk-geocode-mdc.py'
spec=importlib.util.spec_from_file_location('bulk_geocode',src)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class Tests(unittest.TestCase):
    def test_short_row_recorded(self):
        class Resp:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,n):return b'"school1","address","No_Match","",""\n'
        with patch.object(m.urllib.request,'urlopen',return_value=Resp()):
            data=m.census_batch([{'school_id':'school1','address':'1 Main','city':'Baltimore','state':'MD','zip':'21201'}])
        self.assertIn('short Census response',data['school1'][1])
    def test_single_unmatched(self):
        class Resp:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,n):return b'{"result":{"addressMatches":[]}}'
        with patch.object(m.urllib.request,'urlopen',return_value=Resp()):
            self.assertEqual(m.census_single({'address':'1 Main','city':'Baltimore','state':'MD','zip':'21201'})[0],'review')
    def test_single_matched(self):
        class Resp:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,n):return b'{"result":{"addressMatches":[{"coordinates":{"y":39.28,"x":-76.61},"matchedAddress":"1 MAIN ST"}]}}'
        with patch.object(m.urllib.request,'urlopen',return_value=Resp()):
            self.assertEqual(m.census_single({'address':'1 Main','city':'Baltimore','state':'MD','zip':'21201'})[0],'matched')

if __name__=='__main__':unittest.main()
