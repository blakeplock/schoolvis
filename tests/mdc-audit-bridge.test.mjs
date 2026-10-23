import test from 'node:test';import assert from 'node:assert/strict';import {buildAuditSelection} from '../lib/mdc-audit-bridge.mjs';
const rows=[{id:'home',name:'Home',website:'https://home.edu/'},{id:'peer',name:'Peer',website:'https://peer.edu/'}];
test('home first; exactly selected peer set',()=>{const x=buildAuditSelection('home',['peer'],rows);assert.deepEqual(x.lines,['Home | https://home.edu/','Peer | https://peer.edu/']);assert.equal(x.missing.length,0)});
test('missing websites remain unready and visible',()=>{const x=buildAuditSelection('home',['peer'],[{...rows[0],website:''},rows[1]]);assert.equal(x.missing.length,1)});
test('selecting no peers fails',()=>assert.throws(()=>buildAuditSelection('home',[],rows)));
test('never silently add a sixth school',()=>{const ids=['home','a','b','c','d','e'];const x=buildAuditSelection('home',ids.slice(1),ids.map(id=>({id,name:id,website:'https://x.edu'})));assert.equal(x.lines.length,5);assert.equal(x.extra.length,1)});
