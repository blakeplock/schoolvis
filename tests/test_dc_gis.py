import importlib.util, pathlib, sqlite3, tempfile, json
p=pathlib.Path(__file__).parents[1]/'scripts'/'import-dc-independent-schools.py'
spec=importlib.util.spec_from_file_location('dc_gis',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def test_dc():
    assert m.norm('The Maret School')=='maret'
    doc={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'NAME':'Maret School','ADDRESS':'3000 Cathedral Avenue NW','ZIP':'20008'},'geometry':{'type':'Point','coordinates':[-77.061,38.929]}}]}
    with tempfile.TemporaryDirectory() as d:
        db=pathlib.Path(d)/'schools.sqlite';con=sqlite3.connect(db);con.execute('CREATE TABLE schools(id TEXT,name TEXT,county TEXT)');con.execute("INSERT INTO schools VALUES ('test','Maret School','Washington DC')");con.commit();con.close()
        out=pathlib.Path(d)/'out';m.run(db,doc,out,True)
        c=sqlite3.connect(db);assert c.execute('SELECT COUNT(*) FROM school_locations').fetchone()[0]==1;c.close()
        m.run(db,doc,out,True)
        c=sqlite3.connect(db);assert c.execute('SELECT COUNT(*) FROM school_locations').fetchone()[0]==1;c.close()
if __name__=='__main__':test_dc();print('PASS')
