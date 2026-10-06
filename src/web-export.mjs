import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { verify, readJson } from './qpo.mjs';
import { git, repo } from './git.mjs';
import { storageFrom } from './storage.mjs';
import { Chain } from './chain.mjs';
import { hash, check } from './protocol.mjs';
export async function webExport(destination,cwd=process.cwd()) {
  await verify(cwd);
  const r=repo(cwd),cfg=await readJson(r.state),storage=storageFrom(process.env.QPO_STORAGE || cfg.storage,process.env.QPO_STORAGE_TOKEN);
  const chain=new Chain(process.env.QPO_API || cfg.api,cfg.chainId);
  const history=await chain.history(cfg.publicKey,cfg.repositoryId,cfg.owner,cfg.repository,storage,cfg.sequence),last=history.at(-1),m=last.envelope.manifest;
  check(last.envelopeCid===cfg.envelopeCid,'Repository changed during export');
  const objects=[]; let size=0;
  for(const oid of git(r.root,['rev-list','--objects','--no-object-names',m.head]).trim().split(/\r?\n/).sort()) {
    const type=git(r.root,['cat-file','-t',oid]).trim(),bytes=git(r.root,['cat-file',type,oid],{encoding:null});size+=bytes.length;check(size<=32*1024*1024,'Website snapshot exceeds 32 MiB limit');objects.push({oid,type,base64:bytes.toString('base64')});
  }
  const out=resolve(destination),key=hash(cfg.repositoryId),relative=`repositories/${key}.json`,bundlePath=`bundles/${m.bundle_cid.slice(7)}.bundle`;
  await mkdir(join(out,'repositories'),{recursive:true});await mkdir(join(out,'bundles'),{recursive:true});
  // Publish read-only CAS objects so a verifier can clone without the publisher's disk.
  await mkdir(join(out,'objects'),{recursive:true});
  for(const record of history) {
    for(const objectCid of [record.envelopeCid,record.envelope.manifest.bundle_cid]) {
      await writeFile(join(out,'objects',objectCid.slice(7)),await storage.get(objectCid));
    }
  }
  let catalogue={version:1,repositories:[]};try{catalogue=JSON.parse(await readFile(join(out,'catalogue.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  check(catalogue.version===1&&Array.isArray(catalogue.repositories),'Invalid website catalogue');
  const uri=`rouge://${cfg.owner}/${cfg.repository}`;check(!catalogue.repositories.some(x=>x.uri===uri&&x.repositoryId!==cfg.repositoryId),'Website alias is pinned to another identity');
  await writeFile(join(out,relative),JSON.stringify({version:1,expectedKey:cfg.publicKey,api:process.env.QPO_API || cfg.api,chainId:cfg.chainId,envelopeCid:last.envelopeCid,proof:last.proof,history:history.map(x=>({envelope:x.envelope,cid:x.envelopeCid})),objects,bundlePath}));
  await writeFile(join(out,bundlePath),await storage.get(m.bundle_cid));
  catalogue.repositories=catalogue.repositories.filter(x=>x.repositoryId!==cfg.repositoryId);catalogue.repositories.push({owner:cfg.owner,name:cfg.repository,uri,repositoryId:cfg.repositoryId,head:m.head,sequence:m.sequence,timestamp:m.timestamp,data:relative});
  await writeFile(join(out,'catalogue.json'),JSON.stringify(catalogue,null,2));return {uri,destination:out};
}
