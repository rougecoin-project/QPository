#!/usr/bin/env node
// Opt-in REAL testnet integration; never part of the offline fixture tests.
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { RougeChain } from '@rougechain/sdk';
import { git } from '../src/git.mjs';
import { init, settings, readJson } from '../src/qpo.mjs';
const root=await mkdtemp(join(tmpdir(),'qpository-live-'));
const repository=join(root,'qpository-demo'); await mkdir(repository);
process.env.QPO_HOME=join(root,'owner-identity');
process.env.QPO_STORAGE=join(root,'public-objects');
process.env.QPO_OWNER='test';
process.env.QPO_CHAIN_ID ||= 'rougechain-devnet-1';
process.env.QPO_CONFIRM_TIMEOUT_MS ||= '60000';
console.log(`Live demo artifacts: ${root}`);
const cli=resolve('bin/qpo.mjs');
async function run(args,cwd) {
  const child=spawn(process.execPath,[cli,...args],{cwd,env:process.env,stdio:'inherit'}); const [code]=await once(child,'close'); if(code) throw new Error(`qpo ${args[0]} failed`);
}
try {
  git(repository,['init']); git(repository,['config','user.name','QPository Demo']); git(repository,['config','user.email','qpo@example.test']); git(repository,['config','core.autocrlf','false']);
  await writeFile(join(repository,'hello.txt'),'hello qpository\n'); git(repository,['add','.']); git(repository,['commit','-m','initial commit']);
  const cfg=await init(repository),s=settings(),wallet=await readJson(join(s.home,'identity.json'));
  const sdk=new RougeChain(s.api,{fetch:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(15000)})});
  const health=await sdk.getHealth(); if(health.chain_id!==s.chainId) throw new Error(`Expected ${s.chainId}, node returned ${health.chain_id}`);
  const faucet=await sdk.faucet(wallet); if(!faucet.success) throw new Error(`Testnet faucet rejected: ${faucet.error}`);
  console.log('Signed faucet request accepted; waiting for testnet funding.');
  const deadline=Date.now()+60000; let funded=false;
  while(Date.now()<deadline) { const b=await sdk.getBalance(wallet.publicKey); if(b.balance>=55) { funded=true; break; } await new Promise(r=>setTimeout(r,1000)); }
  if(!funded) throw new Error('Testnet funding not confirmed within 60 seconds');
  await run(['push'],repository);
  const independent=join(root,'independent-machine'); await mkdir(independent);
  process.env.QPO_HOME=join(root,'verifier-trust'); process.env.QPO_OWNER_KEY=wallet.publicKey;
  await run(['clone','rouge://test/qpository-demo'],independent); await run(['verify'],join(independent,'qpository-demo'));
  const published=JSON.parse(await readFile(join(repository,'.git','qpository.json'),'utf8'));
  await writeFile(join(root,'live-result.json'),JSON.stringify({api:s.api,chainId:s.chainId,proof:published.proof,envelopeCid:published.envelopeCid,ownerPublicKey:wallet.publicKey,mode:'real RougeChain node canonical state',independentIdentityDirectory:true},null,2));
  console.log(`REAL testnet milestone passed. Proof: ${published.proof}`);
} catch(e) { console.error(`Live testnet milestone not completed: ${e.message}`); process.exitCode=1; }
