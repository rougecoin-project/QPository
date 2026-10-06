import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { verifyPublished, filesAt, commitsAt, checkChain, canonical } from '../website/src/verify.mjs';
import { canonical as cliCanonical } from '../src/protocol.mjs';
const catalogue=JSON.parse(await readFile('website/dist/catalogue.json','utf8'));
const data=JSON.parse(await readFile(join('website/dist',catalogue.repositories[0].data),'utf8'));
test('browser independently verifies the real published Git snapshot',async()=>{
 const v=await verifyPublished(data);assert.equal(v.manifest.head,catalogue.repositories[0].head);
 const files=filesAt(v.map,v.manifest.head);assert.equal(new TextDecoder().decode(files.find(x=>x.path==='hello.txt').bytes),'hello qpository\n');
 assert.equal(commitsAt(v.map,v.manifest.head)[0].message,'initial commit');
 assert.deepEqual(Buffer.from(canonical(v.manifest)),cliCanonical(v.manifest));
});
test('browser rejects modified manifests, signatures, objects and unsigned download paths',async()=>{
 let altered=structuredClone(data);altered.history[0].envelope.manifest.root='0'.repeat(64);await assert.rejects(verifyPublished(altered),/signature/);
 altered=structuredClone(data);altered.history[0].envelope.signature='0'.repeat(6618);await assert.rejects(verifyPublished(altered),/signature/);
 altered=structuredClone(data);altered.objects[0].base64=Buffer.from('tampered').toString('base64');await assert.rejects(verifyPublished(altered),/Git object identity/);
 altered=structuredClone(data);altered.bundlePath='javascript:alert(1)';await assert.rejects(verifyPublished(altered),/bundle path/);
});
test('browser validates chain binding and rejects stale or incompatible records',async()=>{
 const old=globalThis.fetch,m=data.history.at(-1).envelope.manifest,id=data.proof.slice(0,data.proof.lastIndexOf(':'));let minted=m.sequence;
 globalThis.fetch=async url=>({ok:true,json:async()=>String(url).endsWith('/health')?{chain_id:data.chainId}:String(url).includes('/nft/token/')?{creator:data.expectedKey,collection_id:id,token_id:1,name:'QPOSITORY_V1',metadata_uri:data.envelopeCid,attributes:{protocol:'qpository',version:1,manifest_hash:await import('../src/protocol.mjs').then(x=>x.hash(x.canonical(m))),repository_id:m.repository_id}}:{creator:data.expectedKey,collection_id:id,public_mint:false,description:`QPOSITORY_V1:${m.repository_id}`,minted}});
 try{await checkChain(data);minted++;await assert.rejects(checkChain(data),/no longer the latest/);}finally{globalThis.fetch=old;}
});
