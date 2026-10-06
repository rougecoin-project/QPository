#!/usr/bin/env node
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { FileStorage, MAX_OBJECT } from '../src/storage.mjs';
import { cid } from '../src/protocol.mjs';
export function storageServer(directory,token) {
  const storage=new FileStorage(directory);
  return createServer(async(req,res)=>{
    try {
      const match=/^\/objects\/([a-f0-9]{64})$/.exec(req.url); if(!match) { res.writeHead(404).end(); return; }
      const id=`sha256:${match[1]}`;
      if(req.method==='GET' || req.method==='HEAD') { const bytes=await storage.get(id); res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'public, max-age=31536000, immutable'}); res.end(req.method==='HEAD'?undefined:bytes); return; }
      if(req.method==='PUT') {
        if(token && req.headers.authorization!==`Bearer ${token}`) { res.writeHead(401).end(); return; }
        const chunks=[]; let size=0;
        for await(const chunk of req) { size+=chunk.length; if(size>MAX_OBJECT) { res.writeHead(413).end(); req.destroy(); return; } chunks.push(chunk); }
        const bytes=Buffer.concat(chunks); if(cid(bytes)!==id) { res.writeHead(400).end('CID mismatch'); return; }
        await storage.put(bytes); res.writeHead(201).end(); return;
      }
      res.writeHead(405).end();
    } catch(e) { res.writeHead(e.code==='ENOENT'?404:500).end('Object unavailable'); }
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const server=storageServer(process.env.QPO_STORAGE_DIR || '.qpo-storage',process.env.QPO_STORAGE_TOKEN);
  server.listen(Number(process.env.QPO_STORAGE_PORT || 8787),process.env.QPO_STORAGE_HOST || '127.0.0.1',()=>console.log(`QPository public CAS listening on ${JSON.stringify(server.address())}`));
}
