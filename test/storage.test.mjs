import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { FileStorage, HttpStorage } from '../src/storage.mjs';
import { cid } from '../src/protocol.mjs';
test('file CAS is content addressed, idempotent and rejects corruption',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'qpo-cas-'));
  try {
    const storage=new FileStorage(dir),bytes=Buffer.from('public object'),id=await storage.put(bytes);
    assert.equal(id,cid(bytes)); assert.equal(await storage.put(bytes),id); assert.deepEqual(await storage.get(id),bytes);
    assert.equal(await storage.exists(id),true); assert.equal(await storage.exists(`sha256:${'0'.repeat(64)}`),false);
    await writeFile(storage.path(id),'tampered'); await assert.rejects(storage.get(id),/Corrupted/); await assert.rejects(storage.put(bytes),/Corrupted/);
    assert.throws(()=>storage.path('../../identity.json'),/Malformed CID/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('HTTP consumer independently rejects lying storage bytes',async()=>{
  const server=createServer((req,res)=>res.end('wrong bytes')); server.listen(0,'127.0.0.1'); await once(server,'listening');
  try { const storage=new HttpStorage(`http://127.0.0.1:${server.address().port}`); await assert.rejects(storage.get(cid(Buffer.from('expected'))),/Corrupted storage object/); }
  finally { server.closeAllConnections(); await new Promise(r=>server.close(r)); }
});
test('remote providers require HTTPS and URLs do not embed credentials',()=>{
  assert.throws(()=>new HttpStorage('http://untrusted.example'),/HTTPS/);
  assert.throws(()=>new HttpStorage('https://user:secret@example.com'),/Invalid storage URL/);
});
