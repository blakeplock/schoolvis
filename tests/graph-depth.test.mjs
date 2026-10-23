import test from 'node:test';
import assert from 'node:assert/strict';
import {neighborhood} from '../lib/competition-graph.mjs';
const graph={nodes:['a','b','c','d','e'].map(id=>({id})),edges:[{source:'a',target:'b'},{source:'b',target:'c'},{source:'c',target:'d'}]};
test('one layer excludes second hop',()=>{const g=neighborhood(graph,'a',1);assert.deepEqual(g.nodes.map(n=>n.id),['a','b']);assert.equal(g.edges.length,1);});
test('two layers includes second hop and preserves isolated focus',()=>{assert.deepEqual(neighborhood(graph,'a',2).nodes.map(n=>n.id),['a','b','c']);assert.deepEqual(neighborhood(graph,'e',2).nodes.map(n=>n.id),['e']);});
test('invalid focus and depth handled',()=>{assert.equal(neighborhood(graph,'z',1).nodes.length,0);assert.throws(()=>neighborhood(graph,'a',3));});
