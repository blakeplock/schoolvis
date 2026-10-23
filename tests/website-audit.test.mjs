import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWebsite,inspectMarkup} from '../lib/website-audit.mjs';
test('only public HTTPS domain candidates are accepted',()=>{
 assert.equal(validateWebsite('https://www.gilman.edu/').hostname,'www.gilman.edu');
 for(const u of ['http://school.edu','https://127.0.0.1','https://localhost','https://my-school.local','https://user:pw@school.edu','https://school.edu:8443','https://[::1]','https://school.example','https://school.edu/?q=abc']) assert.throws(()=>validateWebsite(u));
});
test('metadata is extracted without adding unsupported assertions',()=>{
 const x=inspectMarkup('<html><head><title>School Admissions</title><meta name="description" content="Visit our school"><meta name="robots" content="noindex"><link rel="canonical" href="https://school.edu/admissions"><script type="application/ld+json">{}</script></head><body><h1>Admissions</h1></body></html>');
 assert.equal(x.title,'School Admissions');assert.equal(x.description,'Visit our school');assert.equal(x.canonical,'https://school.edu/admissions');assert.equal(x.robots,'noindex');assert.equal(x.hasJsonLd,true);assert.equal(x.hasH1,true);
});
