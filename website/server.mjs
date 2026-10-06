import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve('dist');
const server=createServer(async(req,res)=>{
 try { const path=new URL(req.url,'http://localhost').pathname; if(!/^\/[a-zA-Z0-9_.\/-]*$/.test(path)||path.includes('..')) {res.writeHead(400).end();return;}
 const file=path==='/'?'index.html':path.slice(1),bytes=await readFile(resolve(root,file));
 res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream'}).end(bytes);
 } catch {res.writeHead(404).end('Not found');}
});
server.listen(4173,'127.0.0.1',()=>console.log('QPository preview: http://127.0.0.1:4173'));
