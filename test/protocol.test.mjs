import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet, serializePayload } from '@rougechain/sdk';
import { canonical, hash, repositoryId, signManifest, verifyEnvelope, signingBytes, parseCanonical } from '../src/protocol.mjs';
const wallet=Wallet.generateRandom();
export const manifest={protocol:'qpository',version:1,repository_id:repositoryId(wallet.publicKey,'demo'),owner:'test',repository:'demo',owner_public_key:wallet.publicKey,chain_id:'qpo-test-chain',head:'a'.repeat(40),root:'b'.repeat(64),bundle_cid:`sha256:${'c'.repeat(64)}`,timestamp:'2026-10-05T00:00:00.000Z',sequence:1,previous:null};
test('canonical fixed byte vector and SDK equivalence across key insertion order',()=>{
  const a={z:null,b:[true,3],a:'ASCII'}; const expected='{"a":"ASCII","b":[true,3],"z":null}';
  assert.equal(canonical(a).toString(),expected);
  assert.deepEqual(canonical(a),canonical({a:'ASCII',z:null,b:[true,3]}));
  assert.deepEqual(canonical(a),Buffer.from(serializePayload(a)));
  assert.equal(hash(canonical(a)),'9f1f09f19b063e2cd3f4994b1c78a8becb237737a205c34b42f37617ec0423c9');
});
test('real ML-DSA signing, verification and domain separation',()=>{
  const e=signManifest(manifest,wallet),bytes=canonical(e);
  assert.equal(verifyEnvelope(bytes,wallet.publicKey).manifest.head,manifest.head);
  assert.equal(e.signature.length,6618); assert.ok(signingBytes(manifest).subarray(0,23).toString().startsWith('ROUGECHAIN_QPOSITORY_V1'));
  const altered=structuredClone(e); altered.manifest.root='d'.repeat(64);
  assert.throws(()=>verifyEnvelope(canonical(altered),wallet.publicKey),/signature/);
  altered.signature='0'.repeat(6618); assert.throws(()=>verifyEnvelope(canonical(altered),wallet.publicKey),/signature/);
  assert.throws(()=>verifyEnvelope(bytes,Wallet.generateRandom().publicKey),/Unknown signer/);
});
test('reject duplicate keys, noncanonical bytes, unknown fields and unsupported values',()=>{
  assert.throws(()=>parseCanonical(Buffer.from('{"a":1,"a":1}')),/Noncanonical/);
  assert.throws(()=>parseCanonical(Buffer.from('{ "a":1}')),/Noncanonical/);
  for(const value of [NaN,1.1,-0,undefined,'é']) assert.throws(()=>canonical({a:value}));
  const e=signManifest(manifest,wallet); e.manifest.extra=true; assert.throws(()=>verifyEnvelope(canonical(e),wallet.publicKey),/fields/);
  e.manifest.version=2; delete e.manifest.extra; assert.throws(()=>verifyEnvelope(canonical(e),wallet.publicKey),/protocol/);
});
