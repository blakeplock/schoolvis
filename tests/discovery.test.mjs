// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCapture,summarizeDiscoveries} from '../lib/discovery.mjs';
test('discovers untracked shortlist candidates and does not verify Google Maps links',()=>{
 const a=analyzeCapture('Here are some schools you might consider:\n**[Gilman School](https://www.google.com/maps/search/Gilman)**\n**[Bryn Mawr School](https://www.google.com/maps/search/Bryn)**',[{id:'one',name:'Gilman School'}],['https://www.google.com/maps/search/Gilman']);
 assert.equal(a.candidates.length,2);assert.equal(a.candidates[0].trackedId,'one');assert.equal(a.candidates[1].trackedId,null);
 assert.equal(a.citationSummary.mapSearchLinks,1);assert.equal(a.citationSummary.verifiedOfficialSources,0);
 assert.equal(summarizeDiscoveries([a]).find(x=>x.name==='Bryn Mawr School').tracked,false);
});
test('flags numerical claims without treating them as facts',()=>{
 const a=analyzeCapture('SAT 1386 and acceptance rate 8%',[ ],[]);
 assert.equal(a.claims.length,2);assert.equal(a.reviewRequired,true);
});
test('does not pretend unlinked school mentions are recommendations',()=>{
 const a=analyzeCapture('A school might be discussed negatively. Gilman School was mentioned.',[],[]);
 assert.equal(a.candidates.length,0);
});
