// SPDX-License-Identifier: Apache-2.0
// An edge means co-appearance within a single captured response, not proven competition.
const canonical = name => String(name || '').trim().replace(/^the\s+/i,'').replace(/[’]/g,"'");
export const identityKey = name => canonical(name).toLowerCase();
export function buildCompetitionGraph(dataset, discovery = null, platform = 'All platforms') {
  const nodes = new Map(), edges = new Map();
  const tracked = new Map((dataset.schools || []).map(s => [identityKey(s.name), s]));
  function add(name, trackedId = null) {
    const id = identityKey(name); if (!id) return null;
    if (!nodes.has(id)) nodes.set(id,{id,name:canonical(name),trackedId:trackedId || tracked.get(id)?.id || null,appearances:0});
    const node = nodes.get(id);if(trackedId)node.trackedId=trackedId;
    return id;
  }
  const responses = [];
  if (discovery?.captures?.length) {
    const questionMap = new Map((dataset.questions||[]).map(q=>[q.id,q.prompt]));
    for (const capture of discovery.captures) {
      const ids = new Set();
      for (const c of capture.candidates || []) {
        const id=add(c.name,c.trackedId);if(id)ids.add(id);
      }
      responses.push({questionId:capture.questionId,question:questionMap.get(capture.questionId)||capture.questionId,ids:[...ids]});
    }
  } else {
    for (const school of dataset.schools || []) add(school.name,school.id);
    const names = new Map((dataset.schools||[]).map(s=>[s.id,identityKey(s.name)]));
    for (const o of dataset.observations || []) {
      if (platform !== 'All platforms' && o.platform !== platform) continue;
      responses.push({questionId:o.questionId,question:(dataset.questions||[]).find(q=>q.id===o.questionId)?.prompt||o.questionId,ids:[...new Set(o.schoolIds.map(id=>names.get(id)).filter(Boolean))]});
    }
  }
  for (const r of responses) {
    for (const id of r.ids) nodes.get(id).appearances++;
    for(let i=0;i<r.ids.length;i++)for(let j=i+1;j<r.ids.length;j++){
      const pair=[r.ids[i],r.ids[j]].sort();const key=pair.join('::');
      if(!edges.has(key))edges.set(key,{source:pair[0],target:pair[1],count:0,questions:[]});
      const edge=edges.get(key);edge.count++;edge.questions.push({id:r.questionId,prompt:r.question});
    }
  }
  return {nodes:[...nodes.values()].sort((a,b)=>b.appearances-a.appearances||a.name.localeCompare(b.name)),edges:[...edges.values()],responses:responses.length,method:discovery?.captures?.length?'heuristic answer-link candidates':'tracked name mentions',isSynthetic:dataset.kind==='synthetic'};
}
