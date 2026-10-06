import { mkdir, readFile, writeFile, rename, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Wallet } from '@rougechain/sdk';
import { canonical, check, name, keyHex, repositoryId, signManifest, verifyEnvelope, fingerprint } from './protocol.mjs';
import { storageFrom } from './storage.mjs';
import { Chain } from './chain.mjs';
import { repo, optionalConfig, head, clean, rootHash, bundle, checkBundle, checkoutBundle } from './git.mjs';
export async function readJson(path) { return JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,'')); }
export async function saveJson(path,value,exclusive=false) {
  await mkdir(resolve(path,'..'),{recursive:true,mode:0o700});
  if(exclusive) return writeFile(path,JSON.stringify(value),{mode:0o600,flag:'wx'});
  const temp=`${path}.${process.pid}.tmp`; await writeFile(temp,JSON.stringify(value),{mode:0o600}); await rename(temp,path);
}
export function settings() {
  return {home:resolve(process.env.QPO_HOME || join(homedir(),'.qpository')),api:process.env.QPO_API || 'https://testnet.rougechain.io/api',chainId:process.env.QPO_CHAIN_ID || 'rougechain-devnet-1',storage:process.env.QPO_STORAGE || resolve(process.env.QPO_HOME || join(homedir(),'.qpository'),'objects')};
}
async function identity(s) {
  const path=process.env.QPO_KEY_FILE || join(s.home,'identity.json');
  let w;
  try { w=await readJson(path); } catch(e) { if(e.code!=='ENOENT' || process.env.QPO_KEY_FILE) throw e; w=Wallet.generateRandom().toJSON(); await mkdir(s.home,{recursive:true,mode:0o700});
    if(process.platform==='win32') {
      const sid=execFileSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8'}).match(/S-1-[0-9-]+/)?.[0];
      check(sid,'Cannot determine local identity SID');
      execFileSync('icacls',[s.home,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F'],{stdio:'pipe'});
    }
    await saveJson(path,w,true); }
  keyHex(w.publicKey); keyHex(w.privateKey,4032); check(Wallet.fromKeys(w.publicKey,w.privateKey).verify(),'Invalid local identity'); return w;
}
async function pin(s,owner,key) {
  const path=join(s.home,'owners',`${name(owner)}.json`);
  try { const old=await readJson(path); check(old.publicKey===key,'Owner alias already pinned to another signer'); }
  catch(e) { if(e.code!=='ENOENT') throw e; await saveJson(path,{publicKey:key},true); }
}
async function expected(s,owner) {
  const supplied=process.env.QPO_OWNER_KEY; let pinned;
  try { pinned=(await readJson(join(s.home,'owners',`${name(owner)}.json`))).publicKey; } catch(e) { if(e.code!=='ENOENT') throw e; }
  check(supplied || pinned,'Unknown signer: set QPO_OWNER_KEY to the expected full ML-DSA public key');
  if(supplied && pinned) check(supplied===pinned,'Owner key conflicts with trust pin'); return keyHex(supplied || pinned);
}
export async function init(cwd=process.cwd()) {
  const r=repo(cwd); head(r.root); clean(r.root); rootHash(r.root,head(r.root));
  try { await readFile(r.state); throw new Error('Repository already initialized'); } catch(e) { if(e.code!=='ENOENT') throw e; }
  const s=settings(),w=await identity(s),owner=name(process.env.QPO_OWNER || 'test'),repository=name(process.env.QPO_REPO || basename(r.root).toLowerCase());
  await pin(s,owner,w.publicKey);
  const cfg={version:1,owner,repository,publicKey:w.publicKey,repositoryId:repositoryId(w.publicKey,repository),api:s.api,chainId:s.chainId,storage:s.storage,sequence:0,envelopeCid:null,proof:null,pending:null};
  await saveJson(r.state,cfg,true); return cfg;
}
async function context(cwd) {
  const r=repo(cwd),cfg=await readJson(r.state); check(cfg.version===1,'Incompatible local QPository state');
  const s=settings(); const key=await expected(s,cfg.owner); check(key===cfg.publicKey && cfg.repositoryId===repositoryId(key,cfg.repository),'Local signer identity mismatch');
  check(!process.env.QPO_CHAIN_ID || process.env.QPO_CHAIN_ID===cfg.chainId,'Configured chain ID conflicts with repository');
  return {r,cfg,s,storage:storageFrom(process.env.QPO_STORAGE || cfg.storage,process.env.QPO_STORAGE_TOKEN),chain:new Chain(process.env.QPO_API || cfg.api,cfg.chainId)};
}
async function history(ctx) {
  const {cfg,storage,chain}=ctx; const records=await chain.history(cfg.publicKey,cfg.repositoryId,cfg.owner,cfg.repository,storage,cfg.sequence);
  if(cfg.sequence>0) check(records[cfg.sequence-1]?.envelopeCid===cfg.envelopeCid,'RougeChain proof checkpoint mismatch'); return records;
}
export async function push(cwd=process.cwd()) {
  const ctx=await context(cwd),{r,cfg,s,storage,chain}=ctx;
  // A local exclusive lock prevents duplicate submissions by this repository.
  const lock=`${r.state}.lock`; await writeFile(lock,'push',{flag:'wx',mode:0o600});
  try {
    clean(r.root); const commit=head(r.root),root=rootHash(r.root,commit),records=await history(ctx),last=records.at(-1);
    const wallet=await identity(s); check(wallet.publicKey===cfg.publicKey,'Local private key does not match repository owner');
    // Recover a successfully mined push whose local state update was interrupted.
    if(last && last.envelope.manifest.head===commit && last.envelope.manifest.root===root) {
      Object.assign(cfg,{sequence:last.envelope.manifest.sequence,envelopeCid:last.envelopeCid,proof:last.proof,pending:null}); await saveJson(r.state,cfg); return cfg;
    }
    check(!cfg.pending,'Previous push has an uncertain outcome; do not resubmit until its on-chain record is reconciled (see README)');
    const bundleCid=await storage.put(await bundle(r.root,commit));
    check(head(r.root)===commit,'HEAD changed during packaging'); clean(r.root);
    const manifest={protocol:'qpository',version:1,repository_id:cfg.repositoryId,owner:cfg.owner,repository:cfg.repository,owner_public_key:cfg.publicKey,chain_id:cfg.chainId,head:commit,root,bundle_cid:bundleCid,timestamp:new Date().toISOString(),sequence:records.length+1,previous:last?.envelopeCid || null};
    const envelopeCid=await storage.put(canonical(signManifest(manifest,wallet)));
    cfg.pending=envelopeCid; await saveJson(r.state,cfg);
    const proof=await chain.anchor(wallet,cfg.repositoryId,envelopeCid,manifest.sequence,manifest);
    const confirmed=await chain.history(cfg.publicKey,cfg.repositoryId,cfg.owner,cfg.repository,storage,cfg.sequence);
    check(confirmed.at(-1)?.envelopeCid===envelopeCid,'Push superseded during confirmation');
    Object.assign(cfg,{sequence:manifest.sequence,envelopeCid,proof,pending:null}); await saveJson(r.state,cfg); return cfg;
  } finally { await rm(lock,{force:true}); }
}
export async function clone(uri,cwd=process.cwd(),destination) {
  const match=/^rouge:\/\/([a-z0-9][a-z0-9_-]{0,63})\/([a-z0-9][a-z0-9_-]{0,63})$/.exec(uri); check(match,'Malformed rouge URI');
  const [,owner,repository]=match,s=settings(),key=await expected(s,owner),id=repositoryId(key,repository);
  const storage=storageFrom(s.storage,process.env.QPO_STORAGE_TOKEN),chain=new Chain(s.api,s.chainId);
  const records=await chain.history(key,id,owner,repository,storage),latest=records.at(-1); check(latest,'No canonical QPository proof found');
  const m=latest.envelope.manifest,bytes=await storage.get(m.bundle_cid),dir=await mkdtemp(join(tmpdir(),'qpo-clone-')),target=resolve(cwd,destination || repository);
  try {
    const path=join(dir,'repo.bundle'); await writeFile(path,bytes); await checkBundle(path,m); await checkoutBundle(path,target,m);
    const r=repo(target); await saveJson(r.state,{version:1,owner,repository,publicKey:key,repositoryId:id,api:s.api,chainId:s.chainId,storage:s.storage,sequence:m.sequence,envelopeCid:latest.envelopeCid,proof:latest.proof},true);
    await pin(s,owner,key); await verify(target); return target;
  } finally { await rm(dir,{recursive:true,force:true}); }
}
export async function verify(cwd=process.cwd()) {
  const ctx=await context(cwd),{r,cfg,storage}=ctx; check(cfg.envelopeCid,'Repository has no published proof');
  const records=await history(ctx),latest=records.at(-1); check(latest?.envelopeCid===cfg.envelopeCid,'Local repository proof is not the latest canonical proof; clone the latest state');
  const e=verifyEnvelope(await storage.get(cfg.envelopeCid),cfg.publicKey),m=e.manifest;
  check(head(r.root)===m.head,'Local Git HEAD does not match proven HEAD'); clean(r.root); check(rootHash(r.root,m.head)===m.root,'Repository root mismatch');
  await storage.get(m.bundle_cid); return {head:m.head,root:m.root,proof:latest.proof,fingerprint:fingerprint(cfg.publicKey)};
}
export async function status(cwd=process.cwd()) {
  const {r,cfg}=await context(cwd); return {uri:`rouge://${cfg.owner}/${cfg.repository}`,head:head(r.root),sequence:cfg.sequence,proof:cfg.proof,publicKey:cfg.publicKey,fingerprint:fingerprint(cfg.publicKey),storage:cfg.storage,api:cfg.api,chainId:cfg.chainId,scope:'Committed reachable Git objects; untracked files excluded'};
}
