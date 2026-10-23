// SPDX-License-Identifier: Apache-2.0
// Pure bridge between geographic institution IDs and the current 2–5 school audit contract.
export function buildAuditSelection(homeId, peerIds, rows){
 if(!homeId || !Array.isArray(peerIds) || !Array.isArray(rows))throw Error('Select a home school and peers first');
 const ids=[homeId,...peerIds.filter(id=>id!==homeId)];
 const selected=[...new Set(ids)];
 if(selected.length<2)throw Error('Select at least one competitor before preparing an audit');
 const limited=selected.slice(0,5);
 const byId=new Map(rows.map(r=>[r.id,r]));
 const ready=[],missing=[];
 for(const id of limited){
  const r=byId.get(id);if(!r)throw Error('School not present in the regional registry: '+id);
  let valid=false;try{const u=new URL(r.website);valid=u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&r.website.length<=2048;}catch{}
  (valid?ready:missing).push(r);
 }
 return {ready,missing,extra:selected.slice(5),lines:limited.map(id=>{const r=byId.get(id);return `${r.name} | ${r.website||''}`;})};
}
