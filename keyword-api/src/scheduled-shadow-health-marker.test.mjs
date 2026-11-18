import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHealthMarker} from './scheduled-shadow-health-marker.mjs';

test('marker is present only while healthy, including after repeated removal',()=>{
 const dir=mkdtempSync(join(tmpdir(),'kits-marker-')),path=join(dir,'healthy');
 try{const marker=createHealthMarker({path});assert.equal(marker.sync(false),true);assert.equal(marker.sync(true),true);assert.equal(readFileSync(path,'utf8'),'healthy\n');assert.equal(statSync(path).mode&0o777,0o644);assert.equal(marker.sync(false),true);assert.equal(marker.sync(false),true);assert.throws(()=>statSync(path),{code:'ENOENT'});}finally{rmSync(dir,{recursive:true,force:true});}
});
test('reports failure without exposing I/O exception',()=>{
 const marker=createHealthMarker({path:'/ignored',writeFile:()=>{throw Error('sensitive')}});assert.equal(marker.sync(true),false);
});
