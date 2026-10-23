import test from 'node:test';import assert from 'node:assert/strict';import {searchSchools} from '../lib/fuzzy-schools.mjs';
const schools=[{name:'Mount Saint Joseph High School',county:'Baltimore City'},{name:'McDonogh School',county:'Baltimore County'},{name:'Loyola Blakefield',county:'Baltimore County'}];
test('prefix searches find schools immediately',()=>{assert.equal(searchSchools(schools,'Mou')[0].name,'Mount Saint Joseph High School');});
test('partial tokens and misspelled omissions',()=>{assert.equal(searchSchools(schools,'Blake')[0].name,'Loyola Blakefield');assert.equal(searchSchools(schools,'McDnogh')[0].name,'McDonogh School');});
test('no query yields no results',()=>{assert.deepEqual(searchSchools(schools,''),[]);});
