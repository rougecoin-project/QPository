import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
export const encoder=new TextEncoder(),decoder=new TextDecoder();
export function assert(ok,message){if(!ok)throw new Error(message);}
export const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export function unhex(value){assert(typeof value==='string'&&/^(?:[a-f0-9]{2})+$/.test(value),'Malformed hex');return Uint8Array.from(value.match(/../g),x=>parseInt(x,16));}
export function bytes64(value){const text=atob(value);return Uint8Array.from(text,x=>x.charCodeAt(0));}
export function canonical(value){
 function sort(v){if(v===null||typeof v==='boolean')return v;if(typeof v==='string'){assert(/^[\x20-\x7e]*$/.test(v),'Non-ASCII canonical string');return v;}if(typeof v==='number'){assert(Number.isSafeInteger(v)&&!Object.is(v,-0),'Invalid canonical number');return v;}if(Array.isArray(v))return v.map(sort);assert(v&&Object.getPrototypeOf(v)===Object.prototype,'Invalid canonical object');const out=Object.create(null);for(const key of Object.keys(v).sort()){assert(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key),'Invalid canonical field');out[key]=sort(v[key]);}return out;}
 return encoder.encode(JSON.stringify(sort(value)));
}
export async function sha(bytes,algorithm='SHA-256'){return hex(new Uint8Array(await crypto.subtle.digest(algorithm,bytes)));}
export async function verifyPublished(data){
 assert(data.version===1&&/^[a-f0-9]{3904}$/.test(data.expectedKey),'Invalid snapshot identity');
 assert(Array.isArray(data.history)&&data.history.length>0&&data.history.length<=10000,'Invalid proof history');let previous=null;
 const fields=['bundle_cid','chain_id','head','owner','owner_public_key','previous','protocol','repository','repository_id','root','sequence','timestamp','version'].sort().join(',');
 for(let i=0;i<data.history.length;i++){
  const record=data.history[i],e=record.envelope,m=e.manifest;
  assert(Object.keys(e).sort().join(',')==='manifest,signature'&&Object.keys(m).sort().join(',')===fields,'Malformed manifest fields');
  assert(m.protocol==='qpository'&&m.version===1&&m.chain_id===data.chainId,'Incompatible manifest');assert(m.owner_public_key===data.expectedKey&&/^[a-f0-9]{6618}$/.test(e.signature),'Unknown signer or malformed signature');
  assert(/^[a-z0-9][a-z0-9_-]{0,63}$/.test(m.owner)&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(m.repository),'Invalid repository name');
  assert(m.repository_id===`${await sha(unhex(data.expectedKey))}/${m.repository}`,'Invalid repository identity');const first=data.history[0].envelope.manifest;
  assert(m.repository_id===first.repository_id&&m.owner===first.owner&&m.sequence===i+1&&m.previous===previous,'Broken proof history');
  assert(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(m.head)&&/^[a-f0-9]{64}$/.test(m.root)&&/^sha256:[a-f0-9]{64}$/.test(m.bundle_cid),'Malformed hash');
  assert(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(m.timestamp)&&new Date(m.timestamp).toISOString()===m.timestamp,'Malformed timestamp');if(i)assert(m.timestamp>=data.history[i-1].envelope.manifest.timestamp,'Timestamp rollback');
  const prefix=encoder.encode('ROUGECHAIN_QPOSITORY_V1\0'),body=canonical(m),message=new Uint8Array(prefix.length+body.length);message.set(prefix);message.set(body,prefix.length);
  assert(ml_dsa65.verify(unhex(e.signature),message,unhex(data.expectedKey)),'ML-DSA-65 signature invalid');assert(record.cid===`sha256:${await sha(canonical(e))}`,'Manifest CID mismatch');previous=record.cid;
 }
 assert(previous===data.envelopeCid,'Latest manifest mismatch');const m=data.history.at(-1).envelope.manifest;
 assert(data.bundlePath==='bundles/'+m.bundle_cid.slice(7)+'.bundle','Invalid bundle path');
 assert(Array.isArray(data.objects)&&data.objects.length>0&&data.objects.length<=100000,'Invalid Git objects');const inventory=[],map=new Map();let total=0;
 for(const o of [...data.objects].sort((a,b)=>a.oid<b.oid?-1:a.oid>b.oid?1:0)){
  assert(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(o.oid)&&['commit','tree','blob','tag'].includes(o.type)&&!map.has(o.oid),'Invalid Git object');const bytes=bytes64(o.base64);total+=bytes.length;assert(total<=32*1024*1024,'Snapshot too large');
  const header=encoder.encode(`${o.type} ${bytes.length}\0`),gitBytes=new Uint8Array(header.length+bytes.length);gitBytes.set(header);gitBytes.set(bytes,header.length);assert(await sha(gitBytes,o.oid.length===40?'SHA-1':'SHA-256')===o.oid,'Git object identity mismatch');
  inventory.push({oid:o.oid,type:o.type,size:bytes.length,sha256:await sha(bytes)});map.set(o.oid,{...o,bytes});
 }
 assert(await sha(canonical({objects:inventory}))===m.root,'Repository content root mismatch');assert(map.get(m.head)?.type==='commit','Proven HEAD is missing');return {manifest:m,map};
}
export function commitDetails(object){assert(object?.type==='commit','Missing commit');const text=decoder.decode(object.bytes),split=text.indexOf('\n\n'),header=text.slice(0,split),message=text.slice(split+2).trim();return {oid:object.oid,tree:/^tree ([a-f0-9]+)$/m.exec(header)?.[1],parents:[...header.matchAll(/^parent ([a-f0-9]+)$/gm)].map(x=>x[1]),author:/^author (.+) <[^>]*> (\d+) [+-]\d+$/m.exec(header)?.[1]||'Unknown author',date:Number(/^author .+ (\d+) [+-]\d+$/m.exec(header)?.[1])*1000,message};}
export function filesAt(map,head){const result=[],length=head.length/2;let visited=0;function walk(oid,prefix,depth=0){assert(depth<100&&++visited<=100000,'Invalid tree depth');const obj=map.get(oid);assert(obj?.type==='tree','Missing tree');const b=obj.bytes;let offset=0;while(offset<b.length){const space=b.indexOf(32,offset),nul=b.indexOf(0,space+1);assert(space>offset&&nul>space&&nul+1+length<=b.length,'Invalid tree');const mode=decoder.decode(b.subarray(offset,space)),name=decoder.decode(b.subarray(space+1,nul));assert(name!=='.'&&name!=='..'&&!name.includes('/')&&!name.includes('\\'),'Invalid file path');const id=hex(b.subarray(nul+1,nul+1+length));offset=nul+1+length;if(mode==='40000')walk(id,`${prefix}${name}/`,depth+1);else{assert(map.get(id)?.type==='blob','Missing file content');result.push({path:prefix+name,oid:id,mode,bytes:map.get(id).bytes});}}}walk(commitDetails(map.get(head)).tree,'');return result.sort((a,b)=>a.path.localeCompare(b.path));}
export function commitsAt(map,head){const result=[],queue=[head],visited=new Set();while(queue.length){const id=queue.shift();if(visited.has(id))continue;visited.add(id);const c=commitDetails(map.get(id));result.push(c);queue.push(...c.parents);}return result;}
export async function checkChain(data){
 const m=data.history.at(-1).envelope.manifest,id=`col:${data.expectedKey.slice(0,16)}:QPO${(await sha(encoder.encode(m.repository_id))).slice(0,24).toUpperCase()}`;assert(data.proof===`${id}:${m.sequence}`,'Malformed chain proof ID');
 const base=new URL(data.api);assert(base.protocol==='https:'&&(base.hostname==='rougechain.io'||base.hostname.endsWith('.rougechain.io')),'Untrusted chain endpoint in website snapshot');
 async function get(path){const r=await fetch(`${data.api}${path}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});assert(r.ok,`RougeChain request failed (${r.status})`);return r.json();}
 assert((await get('/health')).chain_id===data.chainId,'RougeChain network mismatch');const c=await get(`/nft/collection/${encodeURIComponent(id)}`);
 assert(c.creator===data.expectedKey&&c.collection_id===id&&c.public_mint===false&&c.description===`QPOSITORY_V1:${m.repository_id}`,'Invalid RougeChain collection');assert(c.minted===m.sequence,'Website snapshot is no longer the latest proof; publish a fresh export');
 for(let i=0;i<data.history.length;i++){const record=data.history[i],token=await get(`/nft/token/${encodeURIComponent(id)}/${i+1}`);assert(token.creator===data.expectedKey&&token.collection_id===id&&token.token_id===i+1&&token.name==='QPOSITORY_V1'&&token.metadata_uri===record.cid,'RougeChain proof mismatch');const expected={protocol:'qpository',version:1,manifest_hash:await sha(canonical(record.envelope.manifest)),repository_id:m.repository_id};assert(decoder.decode(canonical(token.attributes))===decoder.decode(canonical(expected)),'On-chain manifest hash mismatch');}
 assert((await get(`/nft/collection/${encodeURIComponent(id)}`)).minted===m.sequence,'Chain changed during verification; retry');return true;
}
