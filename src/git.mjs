import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { hash, canonical, check } from './protocol.mjs';
export function git(cwd,args,options={}) {
  return execFileSync('git',['-c','core.hooksPath=', '-c','protocol.file.allow=always', ...args],{cwd,encoding:'utf8',maxBuffer:160*1024*1024,stdio:['pipe','pipe','pipe'],env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1'},...options});
}
export function repo(cwd) {
  check(git(cwd,['rev-parse','--is-bare-repository']).trim()==='false','A normal working repository is required');
  const root=git(cwd,['rev-parse','--show-toplevel']).trim();
  check(!git(root,['rev-parse','--is-shallow-repository']).trim().includes('true'),'Shallow repositories are unsupported');
  check(!optionalConfig(root,'extensions.partialClone'), 'Partial clones unsupported');
  return {root, state:resolve(root,git(root,['rev-parse','--git-path','qpository.json']).trim())};
}
// --get exits 1 when absent; use a dedicated optional configuration query.
export function optionalConfig(cwd,key) { try { return git(cwd,['config','--local','--get',key]).trim(); } catch(e) { if(e.status===1) return ''; throw e; } }
export function head(cwd) { return git(cwd,['rev-parse','--verify','HEAD^{commit}']).trim(); }
export function clean(cwd) {
  check(!git(cwd,['ls-files','-v']).split('\n').some(line=>/^[a-zS] /.test(line)), 'Hidden tracked changes (assume-unchanged/skip-worktree) unsupported');
  check(git(cwd,['status','--porcelain=v1','--untracked-files=no']).trim()==='', 'Tracked repository content has changed');
  check(!git(cwd,['ls-files','--stage']).split('\n').some(x=>x.startsWith('160000 ')), 'Submodules unsupported in V0.1');
}
export function rootHash(cwd,commit) {
  git(cwd,['fsck','--strict','--no-reflogs',commit]);
  const ids=git(cwd,['rev-list','--objects','--no-object-names',commit]).trim().split(/\r?\n/).sort();
  const inventory=ids.map(oid=>{
    const type=git(cwd,['cat-file','-t',oid]).trim();
    const bytes=git(cwd,['cat-file',type,oid],{encoding:null});
    if(type==='tree') check(!bytes.includes(Buffer.from('160000 ')),'Submodules unsupported in V0.1');
    if(type==='blob') check(!bytes.subarray(0,100).toString().startsWith('version https://git-lfs.github.com/spec/v1'),'Git LFS unsupported in V0.1');
    return {oid,type,size:bytes.length,sha256:hash(bytes)};
  });
  return hash(canonical({objects:inventory}));
}
export async function bundle(cwd,commit) {
  const dir=await mkdtemp(join(tmpdir(),'qpo-bundle-'));
  try { const path=join(dir,'repo.bundle'); check(head(cwd)===commit,'HEAD changed before packaging'); git(cwd,['bundle','create',path,'HEAD']); return await readFile(path); } finally { await rm(dir,{recursive:true,force:true}); }
}
export async function checkBundle(path,manifest) {
  const dir=await mkdtemp(join(tmpdir(),'qpo-check-'));
  try {
    git(dir,['init','--bare',...(manifest.head.length===64?['--object-format=sha256']:[])]);
    git(dir,['bundle','verify',path]); git(dir,['fetch','--no-tags',path,manifest.head]);
    check(rootHash(dir,manifest.head)===manifest.root,'Repository root mismatch');
  } finally { await rm(dir,{recursive:true,force:true}); }
}
export async function checkoutBundle(path,target,manifest) {
  check(!(await lstat(target).catch(e=>{if(e.code==='ENOENT') return null; throw e;})), 'Clone destination already exists');
  git(undefined,['init',...(manifest.head.length===64?['--object-format=sha256']:[]),target]);
  git(target,['config','core.autocrlf','false']);
  git(target,['fetch','--no-tags',path,manifest.head]);
  git(target,['checkout','--detach',manifest.head]);
  check(head(target)===manifest.head && rootHash(target,manifest.head)===manifest.root,'Clone HEAD/root mismatch'); clean(target);
}
