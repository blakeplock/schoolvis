import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {buildCompetitionGraph} from '../lib/competition-graph.mjs';
const dataset={kind:'observed',schools:[{id:'a',name:'Bryn Mawr School'},{id:'b',name:'Gilman School'}],questions:[{id:'q01',prompt:'Which schools?'}],observations:[]};
test('co-appearance counts unique question observations, merges known articles',()=>{
 const g=buildCompetitionGraph(dataset,{captures:[{questionId:'q01',candidates:[{name:'The Bryn Mawr School'},{name:'Bryn Mawr School'},{name:'Gilman School'}]}]});
 assert.equal(g.nodes.length,2);assert.equal(g.edges.length,1);assert.equal(g.edges[0].count,1);assert.equal(g.edges[0].questions[0].id,'q01');
});
test('no edge from appearances in separate responses',()=>{
 const g=buildCompetitionGraph(dataset,{captures:[{questionId:'q01',candidates:[{name:'Gilman School'}]},{questionId:'q02',candidates:[{name:'Bryn Mawr School'}]}]});assert.equal(g.edges.length,0);
});
test('demo graph filters platforms and labels synthetic',()=>{
 const d={...dataset,kind:'synthetic',observations:[{platform:'ChatGPT',questionId:'q01',schoolIds:['a','b']},{platform:'Gemini',questionId:'q01',schoolIds:['a']}]};
 const g=buildCompetitionGraph(d,null,'ChatGPT');assert.equal(g.responses,1);assert.equal(g.edges[0].count,1);assert.equal(g.isSynthetic,true);
});
