import importlib.util
import pathlib
import unittest
p=pathlib.Path(__file__).resolve().parents[1]/'scripts/reconcile-aims-md.py'
s=importlib.util.spec_from_file_location('reconcile',p)
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Reconcile(unittest.TestCase):
 def test_exact(self):
  source=[dict(name='The Academy of the Holy Cross',address='4920 Strathmore Avenue',city='Kensington',zip='20895')]
  good,bad=m.plan([('id','Academy of the Holy Cross','Montgomery County')],set(),source)
  self.assertEqual(len(good),1);self.assertEqual(len(bad),0)
 def test_dont_guess(self):
  source=[dict(name='Baltimore Montessori School',address='1 Wrong Street',city='Baltimore',zip='21201')]
  good,bad=m.plan([('id','Baltimore Lab School','Baltimore City')],set(),source)
  self.assertEqual(len(good),0);self.assertEqual(len(bad),1)
 def test_preserves_existing(self):
  source=[dict(name='Gilman School',address='1 Street',city='Baltimore',zip='21210')]
  good,bad=m.plan([('id','Gilman School','Baltimore City')],{'id'},source)
  self.assertFalse(good or bad)
 def test_no_dc(self):
  source=[dict(name='Gilman School',address='1 Street',city='Baltimore',zip='21210')]
  good,bad=m.plan([('id','Gilman School','Washington DC')],set(),source)
  self.assertFalse(good or bad)
 def test_reference_count(self):
  self.assertGreaterEqual(len(m.load_reference(m.REFERENCE)),95)
if __name__=='__main__':unittest.main()
