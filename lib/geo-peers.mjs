// SPDX-License-Identifier: Apache-2.0
export function milesBetween(a,b){
 if(![a?.lat,a?.lon,b?.lat,b?.lon].every(Number.isFinite))return null;
 const rad=x=>x*Math.PI/180, dlat=rad(b.lat-a.lat), dlon=rad(b.lon-a.lon);
 const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;
 return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function nearbySchools(schools, homeId, radius){
 if(![10,15,25,50].includes(radius))throw Error('Invalid radius');
 const home=schools.find(s=>s.id===homeId);
 if(!home||!Number.isFinite(home.lat)||!Number.isFinite(home.lon))return {nearby:[],missingHomeLocation:true,withoutCoordinates:schools.filter(s=>!Number.isFinite(s.lat)||!Number.isFinite(s.lon)).length};
 return {nearby:schools.filter(s=>s.id!==homeId).map(s=>({...s,distance:milesBetween(home,s)})).filter(s=>s.distance!==null && s.distance<=radius).sort((a,b)=>a.distance-b.distance||a.name.localeCompare(b.name)),missingHomeLocation:false,withoutCoordinates:schools.filter(s=>!Number.isFinite(s.lat)||!Number.isFinite(s.lon)).length};
}
