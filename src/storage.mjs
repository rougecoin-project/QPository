import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { check, cid, validCid } from './protocol.mjs';
export const MAX_OBJECT = 128 * 1024 * 1024;
export class FileStorage {
  constructor(directory) { this.directory = resolve(directory); }
  path(id) { return join(this.directory,validCid(id).slice(7)); }
  async put(bytes) {
    check(bytes.length <= MAX_OBJECT,'Storage object exceeds V0.1 limit'); const id = cid(bytes);
    await mkdir(this.directory,{recursive:true});
    try { await writeFile(this.path(id),bytes,{flag:'wx'}); } catch(e) { if(e.code !== 'EEXIST') throw e; await this.get(id); }
    return id;
  }
  async get(id) { const path = this.path(id); check((await stat(path)).size <= MAX_OBJECT,'Oversized storage object'); const bytes = await readFile(path); check(cid(bytes) === id,'Corrupted storage object'); return bytes; }
  async exists(id) { try { await this.get(id); return true; } catch(e) { if(e.code === 'ENOENT') return false; throw e; } }
}
export class HttpStorage {
  constructor(url, token) {
    const u = new URL(url); check(u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname)),'Storage requires HTTPS except on localhost');
    check(!u.username && !u.password && !u.search && !u.hash,'Invalid storage URL'); this.url = url.replace(/\/+$/,''); this.token = token;
  }
  async request(id, options={}) { validCid(id); return fetch(`${this.url}/objects/${id.slice(7)}`,{...options,signal:AbortSignal.timeout(30000)}); }
  async put(bytes) { check(bytes.length <= MAX_OBJECT,'Oversized storage object'); const id = cid(bytes); const r = await this.request(id,{method:'PUT',body:bytes,headers:this.token ? {Authorization:`Bearer ${this.token}`} : {}}); check(r.ok,`Storage PUT failed: ${r.status}`); return id; }
  async get(id) {
    const r = await this.request(id); check(r.ok,`Storage GET failed: ${r.status}`);
    const chunks=[]; let size=0;
    for await (const chunk of r.body) { size+=chunk.length; if(size > MAX_OBJECT) { await r.body.cancel().catch(()=>{}); throw new Error('Oversized storage object'); } chunks.push(chunk); }
    const bytes=Buffer.concat(chunks); check(cid(bytes) === id,'Corrupted storage object'); return bytes;
  }
  async exists(id) { const r = await this.request(id,{method:'HEAD'}); if(r.status===404) return false; check(r.ok,`Storage HEAD failed: ${r.status}`); return true; }
}
export function storageFrom(value,token) { return /^https?:/.test(value) ? new HttpStorage(value,token) : new FileStorage(value); }
