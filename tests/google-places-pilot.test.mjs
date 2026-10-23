import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPilotInput} from '../lib/google-places-pilot.mjs';
test('pilot rejects invalid coordinates, over-radius, and malformed home names',()=>{
 assert.throws(()=>checkPilotInput({action:'nearby',latitude:0,longitude:0,radiusMiles:15}));
 assert.throws(()=>checkPilotInput({action:'nearby',latitude:39.2,longitude:-76.7,radiusMiles:75}));
 assert.throws(()=>checkPilotInput({action:'home',query:'X'}));
 assert.deepEqual(checkPilotInput({action:'nearby',latitude:39.2,longitude:-76.7,radiusMiles:15}),{action:'nearby',latitude:39.2,longitude:-76.7,radiusMiles:15});
});
