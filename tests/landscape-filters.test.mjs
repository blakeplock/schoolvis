import {test} from 'node:test';
import assert from 'node:assert/strict';
import {describeSchool,filterSchools,locationGroup} from '../lib/landscape-filters.mjs';
test('gender classification is provisional',()=>{assert.equal(describeSchool('Gilman School').gender,'boys');assert.equal(describeSchool('Bryn Mawr School').gender,'girls');assert.equal(describeSchool('Not on file').gender,'unknown');});
test('region and county filters combine',()=>{const schools=[{name:'Gilman School'},{name:'Loyola Blakefield'},{name:'Georgetown Day School'},{name:'Not on file'}];assert.deepEqual(filterSchools(schools,{location:'Baltimore area',county:'Baltimore City'}).map(s=>s.name),['Gilman School']);assert.equal(filterSchools(schools,{location:'Unknown'}).length,1);assert.equal(locationGroup('Washington DC'),'Washington DC');});
test('religion filter excludes unknown, which can be selected',()=>{const schools=[{name:'Loyola Blakefield'},{name:'Gilman School'},{name:'Not on file'}];assert.equal(filterSchools(schools,{religion:'religious'}).length,1);assert.equal(filterSchools(schools,{religion:'unknown'}).length,1);});
