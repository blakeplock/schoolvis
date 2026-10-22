// SPDX-License-Identifier: Apache-2.0
// Provisional editorial metadata. Not independently verified school attributes.
import { SEED } from '../data/aims-seed.mjs';
const norm = x => String(x).toLowerCase().replace(/^the\s+/,'').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const enrollment = {
 'gilman school':'boys','loyola blakefield':'boys','boys latin school of maryland':'boys','mount saint joseph high school':'boys','calvert hall college high school':'boys',
 'roland park country school':'girls','bryn mawr school':'girls','mercy high school':'girls','mount de sales academy':'girls','catholic high school of baltimore':'girls',
 'friends school of baltimore':'coed','mcdonogh school':'coed','park school of baltimore':'coed','jemicy school':'coed','greenspring montessori school':'coed',
 'archbishop spalding high school':'coed','bard high school early college baltimore':'coed','eastern technical high school':'coed','woodlawn high school center for math science and engineering':'coed'
};
const faith = {
 'loyola blakefield':'religious','mercy high school':'religious','mount saint joseph high school':'religious','mount de sales academy':'religious','catholic high school of baltimore':'religious','calvert hall college high school':'religious','archbishop spalding high school':'religious','st ignatius loyola academy':'religious','friends school of baltimore':'religious',
 'gilman school':'nonreligious','mcdonogh school':'nonreligious','park school of baltimore':'nonreligious','bryn mawr school':'nonreligious','roland park country school':'nonreligious'
};
const additionalLocations = {
 'bard high school early college baltimore':'Baltimore City','carver vocational technical high school':'Baltimore City','digital harbor high school':'Baltimore City',
 'paul laurence dunbar high school':'Baltimore City','woodlawn high school center for math science and engineering':'Baltimore County',
 'coppin academy high school':'Baltimore City','eastern technical high school':'Baltimore County','mount de sales academy':'Baltimore City'
};
const locationByName = new Map(SEED.map(s=>[norm(s.name),s.county]));
// A few observed name variants not identical to legacy seed entries.
locationByName.set('woodlawn high school center for math science and engineering','Baltimore County');
export function describeSchool(name) {
 const key=norm(name);
 return {gender:enrollment[key]||'unknown',religion:faith[key]||'unknown',county:locationByName.get(key)||additionalLocations[key]||'unknown',status:'provisional-unverified'};
}
export function locationGroup(county) {
 if(county==='Baltimore City'||county==='Baltimore County')return 'Baltimore area';
 if(county==='Washington DC')return 'Washington DC';
 if(county==='unknown')return 'Unknown';
 return 'Other Maryland counties';
}
// All 23 Maryland counties, plus Baltimore City (an independent city) and DC.
export const MARYLAND_COUNTIES = Object.freeze([
 'Allegany County','Anne Arundel County','Baltimore County','Calvert County',
 'Caroline County','Carroll County','Cecil County','Charles County',
 'Dorchester County','Frederick County','Garrett County','Harford County',
 'Howard County','Kent County','Montgomery County',"Prince George's County",
 "Queen Anne's County",'St. Mary\'s County','Somerset County','Talbot County',
 'Washington County','Wicomico County','Worcester County'
]);
export function locationMatches(county, location) {
 if (location === 'all') return true;
 if (location === 'baltimore-metro') return county === 'Baltimore City' || county === 'Baltimore County';
 if (location === 'maryland') return county === 'Baltimore City' || MARYLAND_COUNTIES.includes(county);
 if (location === 'dc') return county === 'Washington DC';
 if (location === 'unknown') return county === 'unknown';
 return county === location && (county === 'Baltimore City' || MARYLAND_COUNTIES.includes(county));
}
export function filterSchools(schools,{gender='all',religion='all',location='all'}={}) {
 return schools.filter(s=>{
  const p=describeSchool(s.name);
  return (gender==='all'||p.gender===gender)&&(religion==='all'||p.religion===religion)&&locationMatches(p.county,location);
 });
}
export function knownCount(schools,field){return schools.filter(s=>describeSchool(s.name)[field]!=='unknown').length;}
