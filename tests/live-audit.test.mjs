// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAuditRequest, identifySchools, parseResponse, makeDataset } from '../lib/live-audit.mjs';
import { validateDataset } from '../lib/analysis.mjs';
import { runAudit } from '../lib/runner.mjs';
const raw={location:'Baltimore, Maryland',schools:[{name:'Harbor Preparatory School',website:'https://harbor.example.org'},{name:'Ridge Academy',website:'https://ridge.example.org'}]};
test('validation requires 2-5 distinct public HTTPS school identifiers',()=>{
 const c=validateAuditRequest(raw);assert.equal(c.schools.length,2);
 assert.throws(()=>validateAuditRequest({...raw,schools:[raw.schools[0]]}));
 assert.throws(()=>validateAuditRequest({...raw,schools:[raw.schools[0],{...raw.schools[0]}]}));
 assert.throws(()=>validateAuditRequest({...raw,schools:[raw.schools[0],{name:'Bad',website:'http://bad.example.org'}]}));
});
test('matches complete names, not substrings',()=>{
 const {schools}=validateAuditRequest(raw);
 assert.deepEqual(identifySchools('Harbor Preparatory School and Ridge Academy.',schools),['school1','school2']);
 assert.deepEqual(identifySchools('The Ridge Academyesque name',schools),[]);
});
test('extracts citations only from HTTPS URL annotations',()=>{
 const x=parseResponse({model:'gpt-4.1-mini',output:[{type:'message',content:[{type:'output_text',text:'Ridge Academy',annotations:[{type:'url_citation',url:'https://example.org/source'},{type:'url_citation',url:'http://example.org/unsafe'}]}]}]});
 assert.deepEqual(x.sourceUrls,['https://example.org/source']);
 assert.equal(x.answer,'Ridge Academy');
});
test('five mocked provider calls yield schema-valid data and no stores',async()=>{
 const config=validateAuditRequest(raw);let calls=0;
 const fetcher=async(url,opts)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.match(opts.headers.Authorization,/^Bearer /);const body=JSON.parse(opts.body);assert.equal(body.store,false);assert.equal(body.max_output_tokens,900);return {ok:true,json:async()=>({model:'gpt-4.1-mini',output:[{type:'message',content:[{type:'output_text',text:'Ridge Academy',annotations:[]}]}]})};};
 const result=await runAudit(config,'fake-test-key',{fetcher});assert.equal(calls,5);assert.equal(result.dataset.observations.length,5);
 assert.equal(result.dataset.observations[0].method,'api');assert.equal(result.dataset.observations[0].schoolIds[0],'school2');
 assert.doesNotThrow(()=>validateDataset(result.dataset));
});
